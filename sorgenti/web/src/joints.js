// =============================================================================
// 3D STL Multipart Maker — joints.js
// Versione: 0.3.0-beta — 2026-09-28 10:24
// -----------------------------------------------------------------------------
// Taglio planare con giunti. Flusso:
//  1. il solido viene portato in un sistema locale dove il piano di taglio è
//     z=0 e la normale è +Z;
//  2. splitByPlane -> pezzo "pos" (z>0) e "neg" (z<0);
//  3. si calcola la sezione di contatto (CrossSection) all'interfaccia;
//  4. opzionale: innesto rastremato ("chamfer") = tappo a gradini che sporge
//     dal pezzo neg e incava il pezzo pos (con tolleranza);
//  5. si distribuiscono i giunti dentro la sezione ristretta (offset interno)
//     con campionamento "farthest point": perni integrati, tenoni sciolti
//     (stampati a parte) o sedi per magneti;
//  6. numerazione del giunto incisa su entrambe le facce (cifre a 7 segmenti,
//     specchiate sul lato opposto per essere leggibili);
//  7. si riportano i pezzi nel sistema mondo.
// =============================================================================

import * as THREE from 'three';
import { Manifold, CrossSection, matAlignToZ, pointInside as pointInsideL } from './geo.js';

// -----------------------------------------------------------------------------
// Forme della sezione del giunto
// -----------------------------------------------------------------------------
function shapeCS(shape, r) {
  if (shape === 'square') return CrossSection.square([r * 2 * 0.886, r * 2 * 0.886], true); // stessa area del cerchio
  if (shape === 'hex') return CrossSection.circle(r * 1.05, 6);
  if (shape === 'diamond') return CrossSection.square([r * 1.8, r * 1.8], true).rotate(45);
  return CrossSection.circle(r, 40);
}
// Estrude una sezione tra z0 e z1 (sistema locale)
function prism(cs, z0, z1) { return cs.extrude(z1 - z0).translate([0, 0, z0]); }

// -----------------------------------------------------------------------------
// Cifre a 7 segmenti come CrossSection (altezza h), testo centrato in 0,0
// -----------------------------------------------------------------------------
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
export function textCS(str, h) {
  const w = h * 0.55, s = h * 0.16, gap = h * 0.22; const rects = [];
  const segRect = (seg, ox) => {
    const hw = w / 2, hh = h / 2;
    switch (seg) {
      case 'a': return [ox, hh - s / 2, w, s];
      case 'g': return [ox, 0, w, s];
      case 'd': return [ox, -hh + s / 2, w, s];
      case 'f': return [ox - hw + s / 2, hh / 2, s, hh + s];
      case 'b': return [ox + hw - s / 2, hh / 2, s, hh + s];
      case 'e': return [ox - hw + s / 2, -hh / 2, s, hh + s];
      case 'c': return [ox + hw - s / 2, -hh / 2, s, hh + s];
    }
  };
  const total = str.length * w + (str.length - 1) * gap;
  let ox = -total / 2 + w / 2;
  for (const ch of str) { for (const sg of (SEG[ch] || '')) { const [x, y, rw, rh] = segRect(sg, ox); rects.push(CrossSection.square([rw, rh], true).translate([x, y])); } ox += w + gap; }
  // trattino sotto il numero: distingue 6 da 9 e indica il verso di lettura
  rects.push(CrossSection.square([total, s * 0.8], true).translate([0, -h / 2 - s * 1.4]));
  const u = CrossSection.union(rects); rects.forEach(r => r.delete());
  return { cs: u, w: total, h: h + s * 2.2 };
}

// -----------------------------------------------------------------------------
// Utilità 2D: punto nel poligono (even-odd) e distanza dal bordo
// -----------------------------------------------------------------------------
function inside(polys, x, y) {
  let c = false;
  for (const P of polys) for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c;
  }
  return c;
}
function distEdge(polys, x, y) {
  let d = Infinity;
  for (const P of polys) for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [ax, ay] = P[j], [bx, by] = P[i]; const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const ex = ax + t * dx - x, ey = ay + t * dy - y; d = Math.min(d, ex * ex + ey * ey);
  }
  return Math.sqrt(d);
}
// Candidati su griglia dentro una regione
function candidates(region, max = 1600) {
  const b = region.bounds(); const polys = region.toPolygons();
  const W = b.max[0] - b.min[0], H = b.max[1] - b.min[1]; if (!(W > 0 && H > 0)) return [];
  const step = Math.max(Math.sqrt(W * H / max), 0.25); const out = [];
  for (let x = b.min[0] + step / 2; x < b.max[0]; x += step) for (let y = b.min[1] + step / 2; y < b.max[1]; y += step)
    if (inside(polys, x, y)) out.push({ x, y, d: distEdge(polys, x, y) });
  if (!out.length) { // regione minuscola: uso il baricentro dei vertici
    const pts = polys.flat(); if (pts.length) { const x = pts.reduce((s, p) => s + p[0], 0) / pts.length, y = pts.reduce((s, p) => s + p[1], 0) / pts.length; if (inside(polys, x, y)) out.push({ x, y, d: 0 }); }
  }
  return out;
}
// Campionamento "farthest point" con distanza minima
function spread(cands, n, minDist) {
  if (!cands.length || n <= 0) return [];
  const chosen = [cands.reduce((a, b) => (b.d > a.d ? b : a))];
  while (chosen.length < n) {
    let best = null, bs = -1;
    for (const c of cands) {
      let md = Infinity; for (const p of chosen) md = Math.min(md, Math.hypot(c.x - p.x, c.y - p.y));
      if (md < minDist) continue; const sc = md + c.d * 0.3; if (sc > bs) { bs = sc; best = c; }
    }
    if (!best) break; chosen.push(best);
  }
  return chosen;
}

// -----------------------------------------------------------------------------
// TAGLIO PLANARE CON GIUNTI
//   man: Manifold da tagliare (non viene liberato)
//   n: THREE.Vector3 normale unitaria, d: offset (piano n·x = d)
//   o: opzioni giunto (vedi settings.joint)
//   jointNo: numero da incidere
// Ritorna { pos, neg, dowels:[Manifold], used:boolean } oppure null se il
// piano non interseca il solido.
// -----------------------------------------------------------------------------
export function jointedSplit(man, n, d, o, jointNo, samples = null) {
  const R = matAlignToZ(n);
  const M = new THREE.Matrix4().makeTranslation(0, 0, -d).multiply(R);
  const Minv = M.clone().invert();
  const tmp = []; const T = x => { tmp.push(x); return x; };
  const local = T(man.transform(M.elements));
  const [posL, negL] = local.splitByPlane([0, 0, 1], 0);
  if (posL.isEmpty() || negL.isEmpty()) { posL.delete(); negL.delete(); tmp.forEach(x => x.delete()); return null; }
  let pos = posL, neg = negL; const dowels = []; let used = false; let count = 0;

  // ---- modalità "pennello": stacca solo i componenti che contengono i
  //      punti campione; gli altri tornano uniti al lato neg ----------------
  if (samples && samples.length) {
    const loc = samples.map(p => p.clone().applyMatrix4(M));
    const comps = posL.decompose(); const pick = [], rest = [];
    for (const c of comps) {
      let hits = 0; for (const p of loc) if (pointInsideL(c, p)) hits++;
      (hits > 0 ? pick : rest).push(c);
    }
    if (pick.length && rest.length) {
      pos = Manifold.union(pick); neg = Manifold.union([negL, ...rest]);
    }
    comps.forEach(c => c.delete());
  }

  try {
    // sezione d'interfaccia (materiale presente su entrambi i lati)
    const sP = T(pos.slice(0.02)), sN = T(neg.slice(-0.02));
    const cs = T(sP.intersect(sN));
    if (!cs.isEmpty() && (o.type !== 'none' || o.face === 'chamfer')) {
      const tol = o.tol, wall = Math.max(1.2, 2 * tol + 1);
      const addN = [], subP = [], subN = [], addP = [];

      // ---- innesto rastremato (face = chamfer): tappo a 4 gradini ----------
      let plugRegion = null;
      if (o.face === 'chamfer') {
        const h = o.chamfer, steps = 4, sh = h / steps;
        for (let i = 0; i < steps; i++) {
          const layer = T(cs.offset(-(wall + i * sh), 'Round'));
          if (layer.isEmpty()) break;
          addN.push(T(prism(layer, i === 0 ? -0.3 : i * sh, (i + 1) * sh)));
          const hole = T(layer.offset(tol, 'Round'));
          subP.push(T(prism(hole, -0.3, (i + 1) * sh + tol)));
          if (i === 0) plugRegion = layer;
        }
        used = addN.length > 0;
      }

      // ---- giunti -----------------------------------------------------------
      if (o.type !== 'none') {
        const r = o.type === 'magnet' ? o.magD / 2 + o.magClr : o.radius;
        const inset = T(cs.offset(-(r + tol + Math.max(wall, 2, r)), 'Round'));  // distanza dal bordo: evita pareti troppo sottili
        const len = o.depth > 0 ? o.depth : o.length;
        const pts = [];
        for (const isl of inset.decompose()) {
          T(isl); const a = isl.area(); if (a <= 0) continue;
          const nAuto = a < 60 ? 1 : a < 900 ? 2 : a < 3500 ? 3 : 4;
          const cnt = o.count > 0 ? o.count : nAuto;
          pts.push(...spread(candidates(isl), cnt, 2 * r + 2 * tol + wall));
        }
        count = pts.length;
        for (const p of pts) {
          used = true;
          if (o.type === 'pin') {
            const pin = T(shapeCS(o.shape, o.radius)).translate([p.x, p.y]); T(pin);
            const hole = T(T(shapeCS(o.shape, o.radius + tol)).translate([p.x, p.y]));
            if (!o.swap) { addN.push(T(prism(pin, -0.4, len))); subP.push(T(prism(hole, -0.1, len + tol))); }
            else { addP.push(T(prism(pin, -len, 0.4))); subN.push(T(prism(hole, -len - tol, 0.1))); }
          } else if (o.type === 'tenon') {
            const hole = T(T(shapeCS(o.shape, o.radius + tol)).translate([p.x, p.y]));
            subP.push(T(prism(hole, -0.1, len / 2 + tol))); subN.push(T(prism(hole, -len / 2 - tol, 0.1)));
            const dw = T(shapeCS(o.shape, o.radius)); dowels.push(dw.extrude(len - tol));
          } else if (o.type === 'magnet') {
            const hole = T(T(CrossSection.circle(o.magD / 2 + o.magClr, 48)).translate([p.x, p.y]));
            const dep = o.magT + o.magClr;
            subP.push(T(prism(hole, -0.1, dep))); subN.push(T(prism(hole, -dep, 0.1)));
          }
        }

        // ---- numerazione incisa -------------------------------------------
        if (o.number && used) {
          const str = String(jointNo);
          for (const th of [6, 4.5, 3.2]) {
            const t = textCS(str, th); T(t.cs);
            const half = Math.max(t.w, t.h) / 2 + 0.8;
            const reg = T(cs.offset(-half, 'Round')); if (reg.isEmpty()) continue;
            const c = candidates(reg, 900).filter(q => pts.every(p => Math.hypot(q.x - p.x, q.y - p.y) > r + tol + half + 0.8));
            if (!c.length) continue;
            const best = c.reduce((a, b) => (b.d > a.d ? b : a));
            subN.push(T(prism(T(t.cs.translate([best.x, best.y])), -o.numDepth, 0.05)));
            // lato pos: guardato da sotto -> specchiato in X
            subP.push(T(prism(T(t.cs.mirror([1, 0]).translate([best.x, best.y])), -0.05, o.numDepth)));
            break;
          }
        }
      }

      // ---- applica le booleane in blocco ---------------------------------
      if (addN.length) { const u = Manifold.union([neg, ...addN]); neg !== negL && neg.delete(); neg = u; }
      if (addP.length) { const u = Manifold.union([pos, ...addP]); pos !== posL && pos.delete(); pos = u; }
      if (subP.length) { const u = Manifold.difference([pos, ...subP]); pos !== posL && pos.delete(); pos = u; }
      if (subN.length) { const u = Manifold.difference([neg, ...subN]); neg !== negL && neg.delete(); neg = u; }
    }
    // ritorno al sistema mondo
    const P = pos.transform(Minv.elements), N = neg.transform(Minv.elements);
    if (pos !== posL) pos.delete(); if (neg !== negL) neg.delete(); posL.delete(); negL.delete();
    return { pos: P, neg: N, dowels, used, count };
  } finally { tmp.forEach(x => { try { x.delete(); } catch (e) { /* ok */ } }); }
}
