// =============================================================================
// 3D STL Multipart Maker — tools.js
// Versione: 0.3.0-beta — 2026-09-28 10:24
// -----------------------------------------------------------------------------
// Strumenti di modellazione e gestione modello:
//  primitive (cubo, sfera, cilindro, tubo, cono, anello) con bordi
//  vivi/smussati/arrotondati; booleane (unione, differenza, intersezione,
//  intaglia e mantieni) con gioco; inlay; riduzione dettaglio; ispezione e
//  riparazione (rapida + ricostruzione volumetrica); separazione pezzi;
//  orientamento migliore; appoggio faccia; disposizione sul piano; scala.
// =============================================================================

import * as THREE from 'three';
import { Manifold, CrossSection, manFromData, dataFromMan, bboxOf, transformData, weld, soup, meshStats } from './geo.js';
import { state, makePart, withPart, commit, settings } from './state.js';
import { childName } from './cuts.js';

const replace = (olds, news, label, sel) => {
  const set = new Set(olds.map(p => p.id));
  const parts = []; let inserted = false;
  for (const p of state.parts) { if (set.has(p.id)) { if (!inserted) { parts.push(...news); inserted = true; } } else parts.push(p); }
  if (!inserted) parts.push(...news);
  commit(parts, label, { select: sel || news.map(p => p.id) });
};

// -----------------------------------------------------------------------------
// PRIMITIVE
// -----------------------------------------------------------------------------
export function primitive(kind, dims, edge = 'sharp', er = 1) {
  let m; const seg = 64;
  const E = Math.max(0.05, er);
  switch (kind) {
    case 'cube': {
      const [x, y, z] = dims;
      const e = Math.min(E, x / 2 - 0.01, y / 2 - 0.01, z / 2 - 0.01);
      if (edge === 'round') {
        const pts = []; for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) pts.push(Manifold.sphere(e, 24).translate([sx * (x / 2 - e), sy * (y / 2 - e), sz * (z / 2 - e)]));
        m = Manifold.hull(pts); pts.forEach(p => p.delete());
      } else if (edge === 'chamfer') {
        const b = [Manifold.cube([x, y - 2 * e, z - 2 * e], true), Manifold.cube([x - 2 * e, y, z - 2 * e], true), Manifold.cube([x - 2 * e, y - 2 * e, z], true)];
        m = Manifold.hull(b); b.forEach(p => p.delete());
      } else m = Manifold.cube([x, y, z], true);
      break;
    }
    case 'sphere': m = Manifold.sphere(dims[0] / 2, seg); break;
    case 'cylinder': case 'tube': {
      const [d, h, di] = dims; const r = d / 2; const e = Math.min(E, r - 0.01, h / 2 - 0.01);
      if (edge === 'round') {
        const t = CrossSection.circle(e, 24).translate([r - e, 0]); const tor = t.revolve(seg);
        const a = tor.translate([0, 0, e - h / 2]), b = tor.translate([0, 0, h / 2 - e]);
        m = Manifold.hull([a, b]); [t, tor, a, b].forEach(p => p.delete());
      } else if (edge === 'chamfer') {
        const a = Manifold.cylinder(h, r - e, r - e, seg, true), b = Manifold.cylinder(h - 2 * e, r, r, seg, true);
        m = Manifold.hull([a, b]); a.delete(); b.delete();
      } else m = Manifold.cylinder(h, r, r, seg, true);
      if (kind === 'tube') { const hole = Manifold.cylinder(h + 2, Math.min(di, d - 0.4) / 2, Math.min(di, d - 0.4) / 2, seg, true); const t = m.subtract(hole); m.delete(); hole.delete(); m = t; }
      break;
    }
    case 'cone': { const [d1, d2, h] = dims; m = Manifold.cylinder(h, d1 / 2, Math.max(d2 / 2, 0), seg, true); break; }
    case 'ring': { const [D, d] = dims; const c = CrossSection.circle(d / 2, 32).translate([D / 2, 0]); m = c.revolve(seg); c.delete(); break; }
    default: throw new Error('Primitiva sconosciuta');
  }
  // posizionamento: sopra la parte selezionata o al centro del piano
  const b = m.boundingBox(); let tx = 0, ty = 0, tz = -b.min[2];
  const sel = state.parts.filter(p => state.selected.has(p.id));
  if (sel.length) { const bb = new THREE.Box3(); sel.forEach(p => bb.union(bboxOf(p.data))); const c = bb.getCenter(new THREE.Vector3()); tx = c.x; ty = c.y; tz = bb.max.z - (b.max[2] - b.min[2]) / 2 - b.min[2]; }
  const moved = m.translate([tx, ty, tz]); m.delete();
  const names = { cube: 'Cubo', sphere: 'Sfera', cylinder: 'Cilindro', tube: 'Tubo', cone: 'Cono', ring: 'Anello' };
  const p = makePart(dataFromMan(moved), names[kind], { kind: 'shape' }); moved.delete();
  commit([...state.parts, p], 'Aggiungi ' + names[kind], { select: [p.id] });
}

// Gioco (clearance): somma di Minkowski con una sfera (lenta su mesh grandi)
function withClearance(m, c) { if (!(c > 0)) return m; const s = Manifold.sphere(c, 12); const r = m.minkowskiSum(s); s.delete(); return r; }

// -----------------------------------------------------------------------------
// BOOLEANE. A = prima parte selezionata, B = le altre
// -----------------------------------------------------------------------------
export function boolean(op, sel, clearance = 0) {
  if (sel.length < 2) throw new Error('Seleziona almeno 2 parti (la prima è quella principale)');
  const [A, ...Bs] = sel; const a = manFromData(A.data);
  const bs = Bs.map(p => manFromData(p.data)); const b0 = Manifold.union(bs); bs.forEach(x => x.delete());
  const b = (op === 'union') ? b0 : withClearance(b0, clearance);
  let res = [], label = '';
  try {
    if (op === 'union') { const u = a.add(b); res = [makePart(dataFromMan(u), A.name, { color: A.color })]; u.delete(); label = 'Unione'; }
    else if (op === 'difference') { const u = a.subtract(b); res = [makePart(dataFromMan(u), A.name, { color: A.color })]; u.delete(); label = 'Differenza'; }
    else if (op === 'intersect') { const u = a.intersect(b); res = [makePart(dataFromMan(u), A.name, { color: A.color })]; u.delete(); label = 'Intersezione'; }
    else if (op === 'carve') { const u = a.subtract(b); res = [makePart(dataFromMan(u), A.name, { color: A.color }), ...Bs]; u.delete(); label = 'Intaglia e mantieni'; }
    if (res[0] && res[0].data.tv.length === 0) throw new Error('Il risultato è vuoto');
  } finally { a.delete(); b0.delete(); if (b !== b0) b.delete(); }
  replace(sel, res, label);
}

// -----------------------------------------------------------------------------
// INLAY: preme la forma B nella parte A.
//   Crea la sede in A e una parte inlay separata. Con "fondo piatto" la forma
//   viene limitata a `depth` mm sotto il punto più alto dell'intersezione.
// -----------------------------------------------------------------------------
export function inlay(sel, depth = 3, flat = true, clearance = 0) {
  if (sel.length !== 2) throw new Error('Seleziona prima il modello e poi la forma (2 parti)');
  const [A, B] = sel; const a = manFromData(A.data), b = manFromData(B.data);
  const tmp = [a, b];
  try {
    let cutter = b;
    const inter = a.intersect(b); tmp.push(inter);
    if (inter.isEmpty()) throw new Error('La forma non tocca il modello: spostala dentro la superficie');
    if (flat) { const top = inter.boundingBox().max[2]; cutter = b.trimByPlane([0, 0, 1], top - depth); tmp.push(cutter); }
    const piece = a.intersect(cutter); tmp.push(piece);
    const cl = withClearance(cutter, clearance); if (cl !== cutter) tmp.push(cl);
    const rec = a.subtract(cl); tmp.push(rec);
    const pA = makePart(dataFromMan(rec), A.name, { color: A.color, joints: A.joints });
    const pI = makePart(dataFromMan(piece), 'Inlay ' + B.name, { kind: 'model' });
    replace(sel, [pA, pI], 'Inlay');
  } finally { tmp.forEach(x => x.delete()); }
}

// -----------------------------------------------------------------------------
// RIDUCI DETTAGLIO (semplificazione entro tolleranza)
// -----------------------------------------------------------------------------
export function simplify(sel, tol) {
  const out = []; let before = 0, after = 0;
  for (const p of sel) {
    const m = manFromData(p.data); const s = m.simplify(tol); before += m.numTri(); after += s.numTri();
    out.push(withPart(p, { data: dataFromMan(s) })); m.delete(); s.delete();
  }
  replace(sel, out, 'Riduci dettaglio');
  return { before, after };
}

// -----------------------------------------------------------------------------
// ISPEZIONA: statistiche geometriche
// -----------------------------------------------------------------------------
export function inspect(p) {
  const st = meshStats(p.data); const m = manFromData(p.data); const bb = bboxOf(p.data); const sz = bb.getSize(new THREE.Vector3());
  const ok = m.status() === 'NoError';
  const r = { ...st, manifold: ok, status: m.status(), size: [sz.x, sz.y, sz.z], volume: ok ? m.volume() : NaN, area: ok ? m.surfaceArea() : NaN, genus: ok ? m.genus() : NaN, pieces: ok ? m.decompose().map(x => (x.delete(), 1)).length : NaN };
  m.delete(); return r;
}

// -----------------------------------------------------------------------------
// RIPARA
//  rapida: risaldatura con tolleranza crescente + merge di manifold
//  profonda: ricostruzione volumetrica (voxel) con parità dei raggi sui 3 assi
// -----------------------------------------------------------------------------
export function repairQuick(p) {
  for (const tol of [1e-4, 1e-3, 1e-2, 0.05]) {
    const d = weld(soup(p.data), tol); const m = manFromData(d);
    if (m.status() === 'NoError' && !m.isEmpty()) { const out = dataFromMan(m); m.delete(); return out; }
    m.delete();
  }
  return null;
}

export function repairVoxel(p, res = 160) {
  const { vp, tv } = p.data; const bb = bboxOf(p.data); const size = bb.getSize(new THREE.Vector3());
  const h = Math.max(size.x, size.y, size.z) / res; const pad = 2 * h;
  const mn = bb.min.clone().subScalar(pad); const N = [0, 1, 2].map(i => Math.ceil((size.getComponent(i) + 2 * pad) / h) + 1);
  const idx = (i, j, k) => (k * N[1] + j) * N[0] + i;
  const votes = new Uint8Array(N[0] * N[1] * N[2]); const dist = new Float32Array(N[0] * N[1] * N[2]).fill(h * 3);
  // triangoli
  const T = tv.length / 3; const P = i => [vp[i * 3], vp[i * 3 + 1], vp[i * 3 + 2]];
  // scanline lungo l'asse ax: per ogni riga calcolo le intersezioni con i triangoli
  const axes = [[0, 1, 2], [1, 2, 0], [2, 0, 1]];
  for (const [ax, u, v] of axes) {
    // bucket dei triangoli per cella (u,v)
    const nu = N[u], nv = N[v]; const buckets = new Map();
    for (let t = 0; t < T; t++) {
      const a = P(tv[t * 3]), b = P(tv[t * 3 + 1]), c = P(tv[t * 3 + 2]);
      const umin = Math.floor((Math.min(a[u], b[u], c[u]) - mn.getComponent(u)) / h), umax = Math.ceil((Math.max(a[u], b[u], c[u]) - mn.getComponent(u)) / h);
      const vmin = Math.floor((Math.min(a[v], b[v], c[v]) - mn.getComponent(v)) / h), vmax = Math.ceil((Math.max(a[v], b[v], c[v]) - mn.getComponent(v)) / h);
      for (let i = Math.max(0, umin); i <= Math.min(nu - 1, umax); i++) for (let j = Math.max(0, vmin); j <= Math.min(nv - 1, vmax); j++) {
        const key = i * nv + j; let l = buckets.get(key); if (!l) buckets.set(key, l = []); l.push(t);
      }
    }
    for (const [key, list] of buckets) {
      const i = Math.floor(key / nv), j = key % nv; const pu = mn.getComponent(u) + i * h, pv = mn.getComponent(v) + j * h;
      const hits = [];
      for (const t of list) {
        const a = P(tv[t * 3]), b = P(tv[t * 3 + 1]), c = P(tv[t * 3 + 2]);
        // intersezione retta (u=pu, v=pv) con triangolo proiettato sul piano uv
        const d = (b[u] - a[u]) * (c[v] - a[v]) - (c[u] - a[u]) * (b[v] - a[v]); if (Math.abs(d) < 1e-12) continue;
        const l1 = ((b[u] - pu) * (c[v] - pv) - (c[u] - pu) * (b[v] - pv)) / d;
        const l2 = ((c[u] - pu) * (a[v] - pv) - (a[u] - pu) * (c[v] - pv)) / d; const l3 = 1 - l1 - l2;
        if (l1 < 0 || l2 < 0 || l3 < 0) continue;
        hits.push(l1 * a[ax] + l2 * b[ax] + l3 * c[ax]);
      }
      if (!hits.length) continue; hits.sort((x, y) => x - y);
      let inside = false, hi = 0;
      for (let s = 0; s < N[ax]; s++) {
        const x = mn.getComponent(ax) + s * h;
        while (hi < hits.length && hits[hi] <= x) { inside = !inside; hi++; }
        const gi = [0, 0, 0]; gi[ax] = s; gi[u] = i; gi[v] = j; const id = idx(gi[0], gi[1], gi[2]);
        if (inside) votes[id]++;
        let dm = Infinity; for (const y of hits) dm = Math.min(dm, Math.abs(y - x)); if (dm < dist[id]) dist[id] = dm;
      }
    }
  }
  // campo con segno (maggioranza dei voti = interno), interpolazione trilineare
  const field = new Float32Array(votes.length); for (let q = 0; q < votes.length; q++) field[q] = (votes[q] >= 2 ? 1 : -1) * Math.min(dist[q], h * 3);
  const sample = ([x, y, z]) => {
    const fx = (x - mn.x) / h, fy = (y - mn.y) / h, fz = (z - mn.z) / h;
    const i = Math.min(Math.max(Math.floor(fx), 0), N[0] - 2), j = Math.min(Math.max(Math.floor(fy), 0), N[1] - 2), k = Math.min(Math.max(Math.floor(fz), 0), N[2] - 2);
    const tx = Math.min(Math.max(fx - i, 0), 1), ty = Math.min(Math.max(fy - j, 0), 1), tz = Math.min(Math.max(fz - k, 0), 1);
    const f = (a, b, c) => field[idx(i + a, j + b, k + c)];
    const c00 = f(0, 0, 0) * (1 - tx) + f(1, 0, 0) * tx, c10 = f(0, 1, 0) * (1 - tx) + f(1, 1, 0) * tx;
    const c01 = f(0, 0, 1) * (1 - tx) + f(1, 0, 1) * tx, c11 = f(0, 1, 1) * (1 - tx) + f(1, 1, 1) * tx;
    return (c00 * (1 - ty) + c10 * ty) * (1 - tz) + (c01 * (1 - ty) + c11 * ty) * tz;
  };
  const bounds = { min: [mn.x, mn.y, mn.z], max: [mn.x + (N[0] - 1) * h, mn.y + (N[1] - 1) * h, mn.z + (N[2] - 1) * h] };
  const m0 = Manifold.levelSet(sample, bounds, h, 0);
  const m = m0.simplify(h * 0.15); m0.delete();   // riduce i triangoli superflui del reticolo
  const out = dataFromMan(m); m.delete(); return out;
}

// -----------------------------------------------------------------------------
// SEPARA PEZZI SCIOLTI
// -----------------------------------------------------------------------------
export function separate(sel) {
  const out = []; let n = 0;
  for (const p of sel) {
    const m = manFromData(p.data); const comps = m.decompose(); m.delete();
    if (comps.length <= 1) { comps.forEach(c => c.delete()); out.push(p); continue; }
    comps.sort((a, b) => b.volume() - a.volume());
    for (const c of comps) { out.push(makePart(dataFromMan(c), childName(p), { joints: p.joints, kind: p.kind })); c.delete(); n++; }
  }
  replace(sel, out, 'Separa pezzi'); return n;
}

// -----------------------------------------------------------------------------
// TRASFORMAZIONI (bake della matrice nei dati)
// -----------------------------------------------------------------------------
export function transformParts(sel, mat, label = 'Trasforma') {
  replace(sel, sel.map(p => withPart(p, { data: transformData(p.data, mat) })), label);
}
// appoggia sul piano (z min = 0)
export function dropToBed(sel) { replace(sel, sel.map(p => withPart(p, { data: transformData(p.data, dropMatrix(p)) })), 'Appoggia sul piano'); }
export function dropMatrix(p) { const b = bboxOf(p.data); return new THREE.Matrix4().makeTranslation(0, 0, -b.min.z); }

// Ruota la parte in modo che la direzione `down` punti verso -Z e appoggia
export function orientDown(p, down) {
  const q = new THREE.Quaternion().setFromUnitVectors(down.clone().normalize(), new THREE.Vector3(0, 0, -1));
  const bb = bboxOf(p.data); const c = bb.getCenter(new THREE.Vector3());
  const R = new THREE.Matrix4().makeTranslation(c.x, c.y, 0).multiply(new THREE.Matrix4().makeRotationFromQuaternion(q)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
  const d = transformData(p.data, R); const b2 = bboxOf(d);
  return transformData(d, new THREE.Matrix4().makeTranslation(0, 0, -b2.min.z));
}

// -----------------------------------------------------------------------------
// ORIENTAMENTO MIGLIORE: candidati = facce dello scafo convesso (più grandi) +
// 6 assi. Punteggio = area di contatto − 0.6·area in sbalzo (>45°) − altezza.
// -----------------------------------------------------------------------------
export function bestDown(p) {
  const { vp, tv } = p.data; const T = tv.length / 3;
  const nrm = new Float32Array(T * 3), area = new Float32Array(T);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let t = 0; t < T; t++) {
    a.fromArray(vp, tv[t * 3] * 3); b.fromArray(vp, tv[t * 3 + 1] * 3); c.fromArray(vp, tv[t * 3 + 2] * 3);
    n.subVectors(b, a).cross(c.clone().sub(a)); const l = n.length(); area[t] = l / 2; if (l > 0) n.divideScalar(l); nrm.set([n.x, n.y, n.z], t * 3);
  }
  // candidati dallo scafo convesso
  const m = manFromData(p.data); const hull = m.hull(); m.delete(); const hd = dataFromMan(hull); hull.delete();
  const groups = new Map();
  for (let t = 0; t < hd.tv.length / 3; t++) {
    a.fromArray(hd.vp, hd.tv[t * 3] * 3); b.fromArray(hd.vp, hd.tv[t * 3 + 1] * 3); c.fromArray(hd.vp, hd.tv[t * 3 + 2] * 3);
    n.subVectors(b, a).cross(c.clone().sub(a)); const ar = n.length() / 2; n.normalize();
    const key = [n.x, n.y, n.z].map(v => Math.round(v * 50)).join(','); const g = groups.get(key) || { n: n.clone(), a: 0 }; g.a += ar; groups.set(key, g);
  }
  const cands = [...groups.values()].sort((x, y) => y.a - x.a).slice(0, 24).map(g => g.n);
  for (const v of [[0, 0, -1], [0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]]) cands.push(new THREE.Vector3(...v));
  let best = null, bs = -Infinity;
  for (const d of cands) {
    let zmin = Infinity, zmax = -Infinity;
    for (let i = 0; i < vp.length; i += 3) { const z = -(vp[i] * d.x + vp[i + 1] * d.y + vp[i + 2] * d.z); if (z < zmin) zmin = z; if (z > zmax) zmax = z; }
    let contact = 0, over = 0;
    for (let t = 0; t < T; t++) {
      const cd = nrm[t * 3] * d.x + nrm[t * 3 + 1] * d.y + nrm[t * 3 + 2] * d.z;
      if (cd > 0.7071) {
        const v0 = tv[t * 3]; const z = -(vp[v0 * 3] * d.x + vp[v0 * 3 + 1] * d.y + vp[v0 * 3 + 2] * d.z);
        if (cd > 0.999 && z - zmin < 0.2) contact += area[t]; else over += area[t];
      }
    }
    const sc = contact - 0.6 * over - (zmax - zmin) * 0.05;
    if (sc > bs) { bs = sc; best = d.clone(); }
  }
  return best;
}

// -----------------------------------------------------------------------------
// DISPONI SUL PIANO: ogni parte appoggiata a z=0 e impacchettata a scaffali
// -----------------------------------------------------------------------------
export function arrange(sel, gap = 5) {
  const items = sel.map(p => { const d = transformData(p.data, dropMatrix(p)); const b = bboxOf(d); return { p, d, b, w: b.max.x - b.min.x, h: b.max.y - b.min.y }; });
  items.sort((x, y) => y.h - x.h);
  const W = Math.max(settings.bed[0], ...items.map(i => i.w));
  let x = 0, y = 0, row = 0; const place = [];
  for (const it of items) { if (x + it.w > W && x > 0) { x = 0; y += row + gap; row = 0; } place.push([it, x, y]); x += it.w + gap; row = Math.max(row, it.h); }
  const totW = Math.max(...place.map(([it, x]) => x + it.w)), totH = y + row;
  const out = place.map(([it, x, y]) => withPart(it.p, { data: transformData(it.d, new THREE.Matrix4().makeTranslation(x - it.b.min.x - totW / 2, y - it.b.min.y - totH / 2, 0)) }));
  replace(sel, out, 'Disponi sul piano');
}
