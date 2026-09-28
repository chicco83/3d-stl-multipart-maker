// =============================================================================
// 3D STL Multipart Maker — brush.js
// Versione: 0.3.0-beta — 2026-09-28 10:24
// -----------------------------------------------------------------------------
// Pennelli che lavorano sulla mesh visualizzata (geometria indicizzata con
// gli stessi indici dei dati della parte):
//  - pittura per "Pennello di taglio" (segue le facce collegate: flood-fill
//    sull'adiacenza dei vertici entro il raggio, non attraversa pareti sottili)
//  - maschera (protegge dalla scultura)
//  - scultura: Leviga (smooth), Gonfia (inflate, Alt = sgonfia), Appiattisci
// I colori dei vertici mostrano pittura (rosso) e maschera (grigio scuro).
// =============================================================================

import * as THREE from 'three';

// -----------------------------------------------------------------------------
// Adiacenza vertici in formato CSR (calcolata una volta per mesh)
// -----------------------------------------------------------------------------
export function adjacency(mesh) {
  if (mesh.userData.adj) return mesh.userData.adj;
  const idx = mesh.geometry.index.array; const n = mesh.geometry.attributes.position.count;
  const deg = new Uint32Array(n + 1);
  for (let i = 0; i < idx.length; i += 3) for (let k = 0; k < 3; k++) deg[idx[i + k]] += 2;
  const start = new Uint32Array(n + 1); for (let i = 0; i < n; i++) start[i + 1] = start[i] + deg[i];
  const fill = start.slice(0, n); const nb = new Uint32Array(start[n]);
  for (let i = 0; i < idx.length; i += 3) for (let k = 0; k < 3; k++) {
    const a = idx[i + k], b = idx[i + (k + 1) % 3], c = idx[i + (k + 2) % 3];
    nb[fill[a]++] = b; nb[fill[a]++] = c;
  }
  return (mesh.userData.adj = { start, nb });
}

// Stato per mesh: pittura e maschera per vertice
export function brushData(mesh) {
  const n = mesh.geometry.attributes.position.count;
  if (!mesh.userData.paint) mesh.userData.paint = new Uint8Array(n);
  if (!mesh.userData.mask) mesh.userData.mask = new Float32Array(n);
  return mesh.userData;
}

// -----------------------------------------------------------------------------
// Vertici collegati entro il raggio R dal punto p (coordinate locali mesh)
// -----------------------------------------------------------------------------
let _stamp = new Uint32Array(0), _sid = 1;
export function gather(mesh, p, faceIndex, R) {
  const pos = mesh.geometry.attributes.position.array; const n = pos.length / 3;
  if (_stamp.length < n) _stamp = new Uint32Array(n);
  _sid++; if (_sid > 4e9) { _stamp.fill(0); _sid = 1; }
  const { start, nb } = adjacency(mesh); const idx = mesh.geometry.index.array;
  const R2 = R * R; const out = []; const dist = [];
  const q = [idx[faceIndex * 3], idx[faceIndex * 3 + 1], idx[faceIndex * 3 + 2]];
  for (const v of q) _stamp[v] = _sid;
  while (q.length) {
    const v = q.pop(); const dx = pos[v * 3] - p.x, dy = pos[v * 3 + 1] - p.y, dz = pos[v * 3 + 2] - p.z;
    const d2 = dx * dx + dy * dy + dz * dz; if (d2 > R2) continue;
    out.push(v); dist.push(Math.sqrt(d2));
    for (let j = start[v]; j < start[v + 1]; j++) { const w = nb[j]; if (_stamp[w] !== _sid) { _stamp[w] = _sid; q.push(w); } }
  }
  return { verts: out, dist };
}

// Aggiorna i colori dei vertici in base a pittura/maschera
export function refreshColors(mesh, verts) {
  const col = mesh.geometry.attributes.color; const { paint, mask } = brushData(mesh);
  const set = v => { const m = 1 - 0.65 * mask[v]; if (paint[v]) col.setXYZ(v, 1.0 * m, 0.25 * m, 0.25 * m); else col.setXYZ(v, m, m, m); };
  if (verts) for (const v of verts) set(v); else for (let v = 0; v < col.count; v++) set(v);
  col.needsUpdate = true;
}

// -----------------------------------------------------------------------------
// Pittura / maschera: val 1 = dipingi, 0 = cancella
// -----------------------------------------------------------------------------
export function paintStamp(mesh, p, face, R, val, layer = 'paint') {
  const d = brushData(mesh); const g = gather(mesh, p, face, R);
  const arr = d[layer]; for (const v of g.verts) arr[v] = val;
  refreshColors(mesh, g.verts);
}
export function clearLayer(mesh, layer) { const d = brushData(mesh); d[layer].fill(0); refreshColors(mesh); }

// -----------------------------------------------------------------------------
// Scultura
//   type: 'smooth' | 'inflate' | 'flatten'
//   s: intensità 0..1, invert: inverte l'effetto (sgonfia)
// -----------------------------------------------------------------------------
export function sculptStamp(mesh, p, face, R, type, s, invert = false) {
  const geo = mesh.geometry; const pos = geo.attributes.position.array; const nor = geo.attributes.normal.array;
  const { mask } = brushData(mesh); const { start, nb } = adjacency(mesh);
  const g = gather(mesh, p, face, R); if (!g.verts.length) return;
  const fall = d => { const t = d / R; return (1 - t * t) * (1 - t * t); };
  if (type === 'inflate') {
    const k = (invert ? -1 : 1) * s * R * 0.08;
    for (let i = 0; i < g.verts.length; i++) { const v = g.verts[i]; const w = k * fall(g.dist[i]) * (1 - mask[v]); pos[v * 3] += nor[v * 3] * w; pos[v * 3 + 1] += nor[v * 3 + 1] * w; pos[v * 3 + 2] += nor[v * 3 + 2] * w; }
  } else if (type === 'smooth') {
    const nw = new Float32Array(g.verts.length * 3);
    for (let i = 0; i < g.verts.length; i++) {
      const v = g.verts[i]; let x = 0, y = 0, z = 0; const c = start[v + 1] - start[v];
      for (let j = start[v]; j < start[v + 1]; j++) { const w = nb[j]; x += pos[w * 3]; y += pos[w * 3 + 1]; z += pos[w * 3 + 2]; }
      const f = s * fall(g.dist[i]) * (1 - mask[v]);
      nw[i * 3] = pos[v * 3] + (x / c - pos[v * 3]) * f; nw[i * 3 + 1] = pos[v * 3 + 1] + (y / c - pos[v * 3 + 1]) * f; nw[i * 3 + 2] = pos[v * 3 + 2] + (z / c - pos[v * 3 + 2]) * f;
    }
    for (let i = 0; i < g.verts.length; i++) { const v = g.verts[i]; pos[v * 3] = nw[i * 3]; pos[v * 3 + 1] = nw[i * 3 + 1]; pos[v * 3 + 2] = nw[i * 3 + 2]; }
  } else if (type === 'flatten') {
    const c = new THREE.Vector3(), n = new THREE.Vector3();
    for (const v of g.verts) { c.x += pos[v * 3]; c.y += pos[v * 3 + 1]; c.z += pos[v * 3 + 2]; n.x += nor[v * 3]; n.y += nor[v * 3 + 1]; n.z += nor[v * 3 + 2]; }
    c.divideScalar(g.verts.length); n.normalize();
    for (let i = 0; i < g.verts.length; i++) {
      const v = g.verts[i]; const d = (pos[v * 3] - c.x) * n.x + (pos[v * 3 + 1] - c.y) * n.y + (pos[v * 3 + 2] - c.z) * n.z;
      const f = s * 0.5 * fall(g.dist[i]) * (1 - mask[v]);
      pos[v * 3] -= n.x * d * f; pos[v * 3 + 1] -= n.y * d * f; pos[v * 3 + 2] -= n.z * d * f;
    }
  }
  geo.attributes.position.needsUpdate = true;
  // normali: ricalcolo completo solo su mesh piccole, altrimenti a fine tratto
  if (geo.attributes.position.count < 200000) geo.computeVertexNormals();
}

// Fine tratto di scultura: normali, bbox e BVH aggiornati
export function endSculpt(mesh) {
  const g = mesh.geometry; g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
  if (g.boundsTree) g.boundsTree.refit();
}
