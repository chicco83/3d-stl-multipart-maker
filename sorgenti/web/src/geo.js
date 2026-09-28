// =============================================================================
// 3D STL Multipart Maker — geo.js
// Versione: 0.3.0-beta — 2026-09-28 10:24
// -----------------------------------------------------------------------------
// Nucleo geometrico: inizializzazione Manifold (WASM), conversioni tra
// Manifold <-> dati mesh <-> BufferGeometry three.js, saldatura vertici,
// parsing formati di input (STL ascii/binario, 3MF, OBJ).
// Le "parti" dell'applicazione sono oggetti IMMUTABILI che contengono solo
// array tipizzati (vp = posizioni, tv = indici triangoli): questo rende
// l'undo/redo economico (gli snapshot condividono i riferimenti).
// =============================================================================

import Module from 'manifold-3d';
import * as THREE from 'three';
import { unzipSync, strFromU8 } from 'fflate';

// -----------------------------------------------------------------------------
// Inizializzazione WASM. Il file manifold.wasm è servito accanto a app.js.
// -----------------------------------------------------------------------------
export let W = null;          // modulo manifold completo
export let Manifold = null;   // classe Manifold
export let CrossSection = null;
export let MMesh = null;      // classe Mesh di manifold

export async function initGeo(wasmPath = 'manifold.wasm') {
  W = await Module({ locateFile: () => wasmPath });
  W.setup();
  Manifold = W.Manifold;
  CrossSection = W.CrossSection;
  MMesh = W.Mesh;
}

// -----------------------------------------------------------------------------
// Gestione memoria: gli oggetti Manifold vivono nell'heap WASM e vanno
// liberati con delete(). `track` raccoglie oggetti temporanei da liberare in
// blocco con `freeAll` a fine operazione.
// -----------------------------------------------------------------------------
const _tmp = [];
export function track(o) { if (o && o.delete) _tmp.push(o); return o; }
export function freeAll() { while (_tmp.length) { try { _tmp.pop().delete(); } catch (e) { /* già liberato */ } } }

// -----------------------------------------------------------------------------
// Dati mesh <-> Manifold
// -----------------------------------------------------------------------------
export function manFromData(d) {
  const mesh = new MMesh({ numProp: 3, vertProperties: d.vp, triVerts: d.tv });
  let m = new Manifold(mesh);
  if (m.status() !== 'NoError') {
    // tentativo: merge dei vertici sui bordi aperti
    m.delete();
    mesh.merge();
    m = new Manifold(mesh);
  }
  return m;
}

export function dataFromMan(m) {
  const mesh = m.getMesh();
  // getMesh può restituire numProp>3: estraggo solo xyz
  let vp = mesh.vertProperties;
  if (mesh.numProp !== 3) {
    const n = vp.length / mesh.numProp; const o = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { o[i * 3] = vp[i * mesh.numProp]; o[i * 3 + 1] = vp[i * mesh.numProp + 1]; o[i * 3 + 2] = vp[i * mesh.numProp + 2]; }
    vp = o;
  } else vp = new Float32Array(vp);
  return { vp, tv: new Uint32Array(mesh.triVerts) };
}

// Geometria three.js indicizzata (per visualizzazione, pittura, scultura)
export function geomFromData(d) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(d.vp), 3));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(d.tv), 1));
  g.computeVertexNormals();
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

// Geometria "flat" non indicizzata (bordi netti), usata per il rendering
export function flatGeomFromData(d) {
  const tri = d.tv.length / 3; const pos = new Float32Array(tri * 9);
  for (let t = 0; t < tri; t++) for (let k = 0; k < 3; k++) {
    const v = d.tv[t * 3 + k]; pos[t * 9 + k * 3] = d.vp[v * 3]; pos[t * 9 + k * 3 + 1] = d.vp[v * 3 + 1]; pos[t * 9 + k * 3 + 2] = d.vp[v * 3 + 2];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

// -----------------------------------------------------------------------------
// Saldatura vertici di una "zuppa" di triangoli (STL) con tolleranza.
// Rimuove anche triangoli degeneri (vertici coincidenti).
// -----------------------------------------------------------------------------
export function weld(pos, tol = 1e-4) {
  // Tabella hash ad indirizzamento aperto su coordinate quantizzate:
  // molto più veloce di una Map con chiavi stringa su mesh da milioni di triangoli.
  const nV = pos.length / 3; const inv = 1 / tol;
  let cap = 1; while (cap < nV * 2) cap <<= 1; const mask = cap - 1;
  const table = new Int32Array(cap).fill(-1);
  const qx = new Int32Array(nV), qy = new Int32Array(nV), qz = new Int32Array(nV);
  const vp = new Float32Array(nV * 3); let nu = 0;
  const remap = new Uint32Array(nV);
  for (let i = 0; i < nV; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const ix = Math.round(x * inv), iy = Math.round(y * inv), iz = Math.round(z * inv);
    let h = (Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ Math.imul(iz, 83492791)) & mask;
    for (;;) {
      const u = table[h];
      if (u === -1) { table[h] = nu; qx[nu] = ix; qy[nu] = iy; qz[nu] = iz; vp[nu * 3] = x; vp[nu * 3 + 1] = y; vp[nu * 3 + 2] = z; remap[i] = nu++; break; }
      if (qx[u] === ix && qy[u] === iy && qz[u] === iz) { remap[i] = u; break; }
      h = (h + 1) & mask;
    }
  }
  // triangoli, scartando i degeneri
  const nT = nV / 3; const tv = new Uint32Array(nT * 3); let k = 0;
  for (let t = 0; t < nT; t++) {
    const a = remap[t * 3], b = remap[t * 3 + 1], c = remap[t * 3 + 2];
    if (a === b || b === c || a === c) continue;
    tv[k++] = a; tv[k++] = b; tv[k++] = c;
  }
  return { vp: vp.slice(0, nu * 3), tv: tv.slice(0, k) };
}

// Da mesh indicizzata a zuppa (per ri-saldare con altra tolleranza)
export function soup(d) {
  const n = d.tv.length / 3; const p = new Float32Array(n * 9);
  for (let t = 0; t < n; t++) for (let k = 0; k < 3; k++) { const v = d.tv[t * 3 + k]; p.set(d.vp.subarray(v * 3, v * 3 + 3), t * 9 + k * 3); }
  return p;
}

// -----------------------------------------------------------------------------
// PARSER STL (binario e ascii) -> zuppa di triangoli Float32Array
// -----------------------------------------------------------------------------
export function parseSTL(buf) {
  const dv = new DataView(buf);
  if (buf.byteLength >= 84) {
    const n = dv.getUint32(80, true);
    if (84 + n * 50 === buf.byteLength) {           // STL binario
      const pos = new Float32Array(n * 9);
      for (let i = 0; i < n; i++) { const o = 84 + i * 50 + 12; for (let j = 0; j < 9; j++) pos[i * 9 + j] = dv.getFloat32(o + j * 4, true); }
      return pos;
    }
  }
  // STL ascii
  const txt = new TextDecoder().decode(buf);
  const re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g; const a = []; let m;
  while ((m = re.exec(txt))) a.push(+m[1], +m[2], +m[3]);
  return new Float32Array(a.slice(0, a.length - (a.length % 9)));
}

// -----------------------------------------------------------------------------
// PARSER OBJ (solo v/f, triangolazione a ventaglio dei poligoni)
// -----------------------------------------------------------------------------
export function parseOBJ(buf) {
  const txt = new TextDecoder().decode(buf); const v = []; const out = [];
  for (const line of txt.split(/\r?\n/)) {
    const p = line.trim().split(/\s+/);
    if (p[0] === 'v') v.push([+p[1], +p[2], +p[3]]);
    else if (p[0] === 'f') {
      const ids = p.slice(1).map(s => { let i = parseInt(s.split('/')[0], 10); return i < 0 ? v.length + i : i - 1; });
      for (let k = 1; k + 1 < ids.length; k++) for (const i of [ids[0], ids[k], ids[k + 1]]) out.push(...v[i]);
    }
  }
  return new Float32Array(out);
}

// -----------------------------------------------------------------------------
// PARSER 3MF: zip -> 3D/3dmodel.model (XML). Gestisce oggetti mesh, componenti
// annidati e trasformazioni degli item di build. Restituisce una lista di
// { name, pos(zuppa) } — un elemento per item di build.
// -----------------------------------------------------------------------------
export function parse3MF(buf) {
  const files = unzipSync(new Uint8Array(buf));
  const modelKey = Object.keys(files).find(k => /3dmodel\.model$/i.test(k)) || Object.keys(files).find(k => /\.model$/i.test(k));
  if (!modelKey) throw new Error('3MF senza file .model');
  const doc = new DOMParser().parseFromString(strFromU8(files[modelKey]), 'application/xml');
  const byTag = (el, t) => Array.from(el.getElementsByTagNameNS('*', t));
  const objects = new Map();
  for (const o of byTag(doc, 'object')) objects.set(o.getAttribute('id'), o);
  // trasformazione 3MF "m00 m01 m02 m10 ... m32" (3x4 row-major, vettori riga)
  const parseT = s => {
    const m = new THREE.Matrix4(); if (!s) return m;
    const a = s.trim().split(/\s+/).map(Number);
    m.set(a[0], a[3], a[6], a[9], a[1], a[4], a[7], a[10], a[2], a[5], a[8], a[11], 0, 0, 0, 1);
    return m;
  };
  const v3 = new THREE.Vector3();
  const emit = (obj, mat, out) => {
    const mesh = byTag(obj, 'mesh')[0];
    if (mesh) {
      const vs = byTag(mesh, 'vertex').map(e => [+e.getAttribute('x'), +e.getAttribute('y'), +e.getAttribute('z')]);
      for (const t of byTag(mesh, 'triangle')) for (const a of ['v1', 'v2', 'v3']) {
        const p = vs[+t.getAttribute(a)]; v3.set(p[0], p[1], p[2]).applyMatrix4(mat); out.push(v3.x, v3.y, v3.z);
      }
    }
    for (const c of byTag(obj, 'component')) {
      const sub = objects.get(c.getAttribute('objectid')); if (!sub) continue;
      emit(sub, mat.clone().multiply(parseT(c.getAttribute('transform'))), out);
    }
  };
  const res = []; const items = byTag(doc, 'item');
  const list = items.length ? items : Array.from(objects.values()).map(o => ({ getAttribute: k => k === 'objectid' ? o.getAttribute('id') : null }));
  for (const it of list) {
    const obj = objects.get(it.getAttribute('objectid')); if (!obj) continue;
    const out = []; emit(obj, parseT(it.getAttribute('transform')), out);
    if (out.length) res.push({ name: obj.getAttribute('name') || ('Oggetto ' + it.getAttribute('objectid')), pos: new Float32Array(out) });
  }
  return res;
}

// -----------------------------------------------------------------------------
// Statistiche e controlli sulla mesh (per "Ispeziona")
// -----------------------------------------------------------------------------
export function meshStats(d) {
  const edges = new Map(); const n = d.tv.length / 3;
  for (let t = 0; t < n; t++) for (let k = 0; k < 3; k++) {
    const a = d.tv[t * 3 + k], b = d.tv[t * 3 + (k + 1) % 3];
    const key = a < b ? a * 4294967296 + b : b * 4294967296 + a;
    edges.set(key, (edges.get(key) || 0) + 1);
  }
  let open = 0, nonMan = 0; for (const c of edges.values()) { if (c === 1) open++; else if (c > 2) nonMan++; }
  return { tris: n, verts: d.vp.length / 3, openEdges: open, nonManifoldEdges: nonMan };
}

// Bounding box di dati mesh
export function bboxOf(d) {
  const b = new THREE.Box3(); const v = new THREE.Vector3();
  for (let i = 0; i < d.vp.length; i += 3) b.expandByPoint(v.set(d.vp[i], d.vp[i + 1], d.vp[i + 2]));
  return b;
}

// Applica una Matrix4 ai dati mesh (restituisce nuovi dati, inverte i
// triangoli se la matrice ha determinante negativo = specchiatura)
export function transformData(d, mat) {
  const vp = new Float32Array(d.vp.length); const v = new THREE.Vector3();
  for (let i = 0; i < vp.length; i += 3) { v.set(d.vp[i], d.vp[i + 1], d.vp[i + 2]).applyMatrix4(mat); vp[i] = v.x; vp[i + 1] = v.y; vp[i + 2] = v.z; }
  let tv = d.tv;
  if (mat.determinant() < 0) { tv = new Uint32Array(d.tv); for (let i = 0; i < tv.length; i += 3) { const t = tv[i + 1]; tv[i + 1] = tv[i + 2]; tv[i + 2] = t; } }
  return { vp, tv };
}

// Matrice che porta il vettore n su +Z (rotazione minima)
export function matAlignToZ(n) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3().copy(n).normalize(), new THREE.Vector3(0, 0, 1));
  return new THREE.Matrix4().makeRotationFromQuaternion(q);
}

// Test "punto dentro solido" tramite parità delle intersezioni di un raggio
export function pointInside(man, p, far = 1e5) {
  try {
    const hits = man.rayCast([p.x, p.y, p.z], [p.x + far * 0.5773, p.y + far * 0.5774, p.z + far * 0.5772]);
    return (hits.length % 2) === 1;
  } catch (e) { return false; }
}
