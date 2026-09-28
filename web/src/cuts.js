// =============================================================================
// 3D STL Multipart Maker — cuts.js
// Versione: 0.3.0-beta — 2026-09-28 10:24
// -----------------------------------------------------------------------------
// Operazioni di taglio ad alto livello sulle parti:
//  - planeCut:       uno o più piani (piano, multi-piano, auto multi-piano, linea)
//  - autoPlanes:     calcolo dei piani perché ogni pezzo entri nel volume stampa
//  - lassoCut:       taglio "a stampo" lungo la vista (Corda / Banda)
//  - paintCut:       taglio della regione dipinta (piano adattato al bordo)
// Ogni operazione produce un nuovo elenco parti e aggiorna il registro giunti.
// =============================================================================

import * as THREE from 'three';
import { Manifold, CrossSection, manFromData, dataFromMan, bboxOf } from './geo.js';
import { jointedSplit } from './joints.js';
import { state, makePart, commit, settings } from './state.js';

// Nome progressivo delle parti generate: "<base> #n"
let _seq = 1;
const baseName = n => n.replace(/ #\d+$/, '');
export const childName = p => `${baseName(p.name)} #${_seq++}`;

// Distanze con segno dei vertici del bbox rispetto al piano
function straddles(bb, n, d) {
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < 8; i++) {
    const v = new THREE.Vector3(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z);
    const s = v.dot(n) - d; mn = Math.min(mn, s); mx = Math.max(mx, s);
  }
  return mn < -1e-4 && mx > 1e-4;
}

// Posiziona i tenoni sciolti in fila accanto al modello, appoggiati al piano
function placeDowels(dowels, allParts) {
  const bb = new THREE.Box3(); for (const p of allParts) bb.union(bboxOf(p.data));
  let x = bb.max.x + 10, y = bb.min.y; const out = [];
  for (const dw of dowels) {
    const b = dw.man.boundingBox(); const w = b.max[0] - b.min[0];
    const moved = dw.man.translate([x - b.min[0], y - b.min[1], -b.min[2]]);
    out.push(makePart(dataFromMan(moved), dw.name, { kind: 'dowel', joints: [dw.no], color: '#d1d8e0' }));
    moved.delete(); dw.man.delete(); x += w + 3; if (x > bb.max.x + 80) { x = bb.max.x + 10; y += 12; }
  }
  return out;
}

// -----------------------------------------------------------------------------
// Taglio con uno o più piani. planes = [{n:Vector3 unitario, d:number}]
// targets = parti da tagliare. opts = impostazioni giunti.
// samples (opz.) = punti mondo che identificano il pezzo da staccare (paint)
// -----------------------------------------------------------------------------
export function planeCut(targets, planes, opts, label = 'Taglio', samples = null) {
  const keep = state.parts.filter(p => !targets.includes(p));
  let jointNo = state.jointNo; const log = state.jointLog.slice();
  const dowels = []; const created = []; const result = [];
  // planes può essere un array (stessi piani per tutte le parti) oppure una
  // funzione parte -> piani (es. auto multi-piano, calcolato per ogni parte)
  for (const t of targets) {
    let cur = [t];
    const pls = typeof planes === 'function' ? planes(t) : planes;
    for (const pl of pls) {
      const next = [];
      for (const p of cur) {
        if (p.kind === 'dowel' || !straddles(bboxOf(p.data), pl.n, pl.d)) { next.push(p); continue; }
        const man = manFromData(p.data);
        if (man.status() !== 'NoError') { man.delete(); throw new Error(`La parte "${p.name}" non è un solido chiuso: usa Modello › Ripara prima di tagliare.`); }
        const r = jointedSplit(man, pl.n, pl.d, opts, jointNo, samples);
        man.delete();
        if (!r) { next.push(p); continue; }
        const nNeg = childName(p), nPos = childName(p);
        const jn = r.used && opts.type !== 'none' ? [jointNo] : [];
        const neg = makePart(dataFromMan(r.neg), nNeg, { joints: [...p.joints, ...jn] });
        const pos = makePart(dataFromMan(r.pos), nPos, { joints: [...p.joints, ...jn] });
        r.neg.delete(); r.pos.delete();
        if (r.used) {
          log.push({ no: jointNo, type: opts.face === 'chamfer' && opts.type === 'none' ? 'chamfer' : opts.type, a: nNeg, b: nPos, count: r.count || 0 });
          r.dowels.forEach((m, i) => dowels.push({ man: m, name: `Tenone G${jointNo}-${i + 1}`, no: jointNo }));
          jointNo++;
        } else r.dowels.forEach(m => m.delete());
        next.push(neg, pos); created.push(neg.id, pos.id);
      }
      cur = next;
    }
    result.push(...cur);
  }
  // le parti intermedie (tagliate di nuovo) non vanno contate
  const finalIds = new Set(result.map(p => p.id));
  const dw = placeDowels(dowels, [...keep, ...result]);
  commit([...keep, ...result, ...dw], label, { jointNo, jointLog: log, select: [] });
  return { created: created.filter(id => finalIds.has(id)).length, dowels: dw.length };
}

// -----------------------------------------------------------------------------
// Auto multi-piano: numero di tagli per asse perché ogni cella entri nel
// volume di stampa (meno il margine). Tagli equidistanti.
// -----------------------------------------------------------------------------
export function autoPlanes(targets, bed, margin) {
  const bb = new THREE.Box3(); for (const p of targets) bb.union(bboxOf(p.data));
  if (bb.isEmpty()) return { counts: [0, 0, 0], planes: [] };
  const size = bb.getSize(new THREE.Vector3());
  // prova sia orientamento X/Y del piatto che ruotato di 90°
  const count = (s, lim) => Math.max(0, Math.ceil(s / Math.max(lim - margin, 1)) - 1);
  const a = [count(size.x, bed[0]), count(size.y, bed[1]), count(size.z, bed[2])];
  const b = [count(size.x, bed[1]), count(size.y, bed[0]), count(size.z, bed[2])];
  const cnt = (a[0] + 1) * (a[1] + 1) * (a[2] + 1) <= (b[0] + 1) * (b[1] + 1) * (b[2] + 1) ? a : b;
  return { counts: cnt, planes: evenPlanes(bb, cnt) };
}

// Auto multi-piano calcolato parte per parte (ogni pezzo ha i suoi tagli)
export function autoPlanesEach(targets, bed, margin) {
  const per = new Map(); let cells = 0; const all = [];
  for (const p of targets) { if (p.kind === 'dowel') continue; const r = autoPlanes([p], bed, margin); per.set(p.id, r.planes); all.push(...r.planes); if (r.planes.length) cells += (r.counts[0] + 1) * (r.counts[1] + 1) * (r.counts[2] + 1); }
  return { planesFor: p => per.get(p.id) || [], all, cells, parts: [...per.values()].filter(x => x.length).length };
}

// Piani equidistanti per asse dentro un bbox. counts = [nx, ny, nz] tagli
export function evenPlanes(bb, counts) {
  const planes = []; const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  const mn = [bb.min.x, bb.min.y, bb.min.z], mx = [bb.max.x, bb.max.y, bb.max.z];
  for (let a = 0; a < 3; a++) for (let i = 1; i <= counts[a]; i++) planes.push({ n: axes[a].clone(), d: mn[a] + (mx[a] - mn[a]) * i / (counts[a] + 1) });
  return planes;
}

// -----------------------------------------------------------------------------
// Taglio a lazo (Corda/Banda): il contorno disegnato sullo schermo diventa un
// tronco di piramide dalla camera (prospettiva esatta) che attraversa il
// modello; ogni parte viene divisa in "dentro" e "fuori".
//   ndcPts: [[x,y]] coordinate normalizzate (-1..1)
// -----------------------------------------------------------------------------
export function lassoCut(targets, ndcPts, camera, label = 'Taglio a lazo') {
  if (ndcPts.length < 3) throw new Error('Contorno troppo corto');
  camera.updateMatrixWorld();
  const C = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
  const e = camera.matrixWorld.elements;
  const r = new THREE.Vector3(e[0], e[1], e[2]).normalize(), u = new THREE.Vector3(e[4], e[5], e[6]).normalize();
  const f = new THREE.Vector3(-e[8], -e[9], -e[10]).normalize();
  const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tanX = tanY * camera.aspect;
  // profondità minima/massima delle parti lungo la direzione di vista
  let tmin = Infinity, tmax = -Infinity;
  for (const p of targets) { const b = bboxOf(p.data); for (let i = 0; i < 8; i++) { const v = new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z); const t = v.sub(C).dot(f); tmin = Math.min(tmin, t); tmax = Math.max(tmax, t); } }
  const t0 = Math.max(tmin - 1, tmax * 0.02, 0.05), t1 = tmax + 1;
  // sistema locale destrorso: X=r, Y=-u, Z=f (così la profondità cresce su +Z)
  const poly = ndcPts.map(([x, y]) => [x * tanX, -y * tanY]);
  const cs = new CrossSection([poly], 'EvenOdd');
  const base = cs.scale(t0);
  const k = t1 / t0;
  const pr = base.extrude(t1 - t0, 0, 0, [k, k]).translate([0, 0, t0]);
  const M = new THREE.Matrix4().makeBasis(r, u.clone().negate(), f).setPosition(C);
  const cutter = pr.transform(M.elements);
  cs.delete(); base.delete(); pr.delete();

  const keep = state.parts.filter(p => !targets.includes(p)); const out = []; let n = 0;
  try {
    for (const p of targets) {
      if (p.kind === 'dowel') { out.push(p); continue; }
      const man = manFromData(p.data);
      const [inn, outp] = man.split(cutter); man.delete();
      if (inn.isEmpty() || outp.isEmpty()) { inn.delete(); outp.delete(); out.push(p); continue; }
      out.push(makePart(dataFromMan(outp), childName(p), { joints: p.joints }), makePart(dataFromMan(inn), childName(p), { joints: p.joints }));
      inn.delete(); outp.delete(); n++;
    }
  } finally { cutter.delete(); }
  if (n) commit([...keep, ...out], label, { select: [] });
  return n;
}

// -----------------------------------------------------------------------------
// Taglio della regione dipinta.
//   part: parte; painted: Uint8Array per vertice (1 = dipinto)
// Calcola il bordo della regione, adatta un piano ai punti di bordo (PCA),
// orienta la normale verso la regione e stacca SOLO i componenti che
// contengono la regione (il resto viene riunito). I giunti vengono posizionati
// sulla sola sezione del pezzo staccato.
// -----------------------------------------------------------------------------
export function paintPlane(part, painted) {
  const { vp, tv } = part.data; const edge = new Map();
  const triPainted = t => (painted[tv[t * 3]] + painted[tv[t * 3 + 1]] + painted[tv[t * 3 + 2]]) >= 2;
  const pc = new THREE.Vector3(); let np = 0; const samples = [];
  const nT = tv.length / 3;
  for (let t = 0; t < nT; t++) {
    if (!triPainted(t)) continue;
    for (let k = 0; k < 3; k++) {
      const a = tv[t * 3 + k], b = tv[t * 3 + (k + 1) % 3]; const key = a < b ? a * 4294967296 + b : b * 4294967296 + a;
      edge.set(key, (edge.get(key) || 0) + 1);
    }
  }
  const bpts = [];
  for (const [key, c] of edge) if (c === 1) { const a = Math.floor(key / 4294967296), b = key % 4294967296; for (const v of [a, b]) bpts.push(new THREE.Vector3(vp[v * 3], vp[v * 3 + 1], vp[v * 3 + 2])); }
  for (let v = 0; v < painted.length; v++) if (painted[v]) { pc.x += vp[v * 3]; pc.y += vp[v * 3 + 1]; pc.z += vp[v * 3 + 2]; np++; }
  if (!np) throw new Error('Nessuna area dipinta');
  if (bpts.length < 3) throw new Error('La regione dipinta copre tutta la parte: non c\'è un bordo da tagliare');
  pc.divideScalar(np);
  // punti campione (baricentri di triangoli dipinti, leggermente all'interno)
  const step = Math.max(1, Math.floor(nT / 4000)); const A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3();
  for (let t = 0; t < nT && samples.length < 40; t += step) if (triPainted(t)) {
    A.fromArray(vp, tv[t * 3] * 3); B.fromArray(vp, tv[t * 3 + 1] * 3); Cc.fromArray(vp, tv[t * 3 + 2] * 3);
    const nrm = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(Cc, A)).normalize();
    samples.push(A.clone().add(B).add(Cc).divideScalar(3).addScaledVector(nrm, -0.05));
  }
  // PCA dei punti di bordo -> normale = autovettore minimo
  const c = bpts.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(bpts.length);
  const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of bpts) { const d = [p.x - c.x, p.y - c.y, p.z - c.z]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] += d[i] * d[j]; }
  const n = smallestEigen(cov);
  if (n.dot(pc.clone().sub(c)) < 0) n.negate();
  return { n, d: n.dot(c), samples };
}

// Autovettore dell'autovalore minimo di una 3x3 simmetrica (Jacobi)
function smallestEigen(a) {
  const A = a.map(r => r.slice()); const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let it = 0; it < 50; it++) {
    let p = 0, q = 1; for (const [i, j] of [[0, 2], [1, 2]]) if (Math.abs(A[i][j]) > Math.abs(A[p][q])) { p = i; q = j; }
    if (Math.abs(A[p][q]) < 1e-12) break;
    const th = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]); const cs = Math.cos(th), sn = Math.sin(th);
    for (let k = 0; k < 3; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = cs * akp - sn * akq; A[k][q] = sn * akp + cs * akq; }
    for (let k = 0; k < 3; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = cs * apk - sn * aqk; A[q][k] = sn * apk + cs * aqk; }
    for (let k = 0; k < 3; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = cs * vkp - sn * vkq; V[k][q] = sn * vkp + cs * vkq; }
  }
  let m = 0; for (let i = 1; i < 3; i++) if (A[i][i] < A[m][m]) m = i;
  return new THREE.Vector3(V[0][m], V[1][m], V[2][m]).normalize();
}

// Piano da una linea tracciata sullo schermo (contiene la direzione di vista)
export function planeFromLine(camera, a, b) {
  const p1 = new THREE.Vector3(a.x, a.y, -0.5).unproject(camera);
  const p2 = new THREE.Vector3(b.x, b.y, -0.5).unproject(camera);
  const p3 = new THREE.Vector3(a.x, a.y, 0.5).unproject(camera);
  const n = new THREE.Vector3().subVectors(p2, p1).cross(new THREE.Vector3().subVectors(p3, p1)).normalize();
  return { n, d: n.dot(p1) };
}

export { Manifold };
