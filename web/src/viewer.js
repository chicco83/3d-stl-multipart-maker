// =============================================================================
// 3D STL Multipart Maker — viewer.js
// Versione: 0.5.2-beta — 2026-09-28 11:47
// -----------------------------------------------------------------------------
// Vista 3D (three.js): scena Z-up come le stampanti 3D, piano di stampa,
// volume di stampa, sincronizzazione mesh <-> parti, selezione con click,
// vista esplosa, gizmo di trasformazione, raycast accelerato (BVH),
// rendering di miniature per la guida PDF.
// Navigazione: tasto destro = orbita, centrale = pan, rotella = zoom
// (in modalità "Seleziona" anche il sinistro orbita).
// =============================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { state, onChange, settings } from './state.js';
import { geomFromData } from './geo.js';
// v0.5.2: contorno luminoso delle parti selezionate (post-processing)
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Raycast accelerato su tutte le mesh
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;
THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

export const V = {
  renderer: null, scene: null, camera: null, controls: null, gizmo: null,
  meshes: new Map(),   // id parte -> THREE.Mesh
  explode: 0,
  root: new THREE.Group(), helpers: new THREE.Group(),
  bedGroup: new THREE.Group(),
  el: null, overlay: null,
  needsRender: true,
  carry: new Map(),   // id nuova parte -> {mask} da riapplicare
  onCarry: null,
};

// -----------------------------------------------------------------------------
// Inizializzazione scena
// -----------------------------------------------------------------------------
export function initViewer(container, overlay) {
  V.el = container; V.overlay = overlay;
  const r = V.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(window.devicePixelRatio);
  container.appendChild(r.domElement);
  const s = V.scene = new THREE.Scene();
  s.background = new THREE.Color(0x1b1f27);
  V.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 20000);
  V.camera.up.set(0, 0, 1); V.camera.position.set(250, -350, 280);

  // luci
  s.add(new THREE.HemisphereLight(0xffffff, 0x303040, 1.6));
  const d1 = new THREE.DirectionalLight(0xffffff, 1.6); d1.position.set(1, -2, 3); s.add(d1);
  const d2 = new THREE.DirectionalLight(0xffffff, 0.6); d2.position.set(-2, 1, -1); s.add(d2);
  s.add(V.root, V.helpers, V.bedGroup);

  // controlli orbitali: destro orbita, centrale pan
  const c = V.controls = new OrbitControls(V.camera, r.domElement);
  c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
  c.enableDamping = false; c.target.set(0, 0, 40); c.update();
  c.addEventListener('change', () => V.needsRender = true);
  r.domElement.addEventListener('contextmenu', e => e.preventDefault());

  // gizmo di trasformazione (piano di taglio, spostamento parti)
  V.gizmo = new TransformControls(V.camera, r.domElement);
  V.gizmo.addEventListener('dragging-changed', e => { c.enabled = !e.value; });
  V.gizmo.addEventListener('change', () => V.needsRender = true);
  s.add(V.gizmo.getHelper());

  drawBed();
  new ResizeObserver(resize).observe(container); resize();
  onChange(k => { if (k === 'parts' || k === 'selection') syncMeshes(); });
  // v0.5.2: pipeline di rendering con contorno di selezione
  //   RenderPass (scena) -> OutlinePass (bordo azzurro sulle parti selezionate,
  //   visibile anche dietro altri oggetti, più tenue) -> OutputPass (colore)
  V.composer = new EffectComposer(r);
  V.composer.addPass(new RenderPass(s, V.camera));
  V.outline = new OutlinePass(new THREE.Vector2(1, 1), s, V.camera);
  V.outline.visibleEdgeColor.set(0x6fb4ff); V.outline.hiddenEdgeColor.set(0x2b5d9e);
  V.outline.edgeStrength = 6; V.outline.edgeThickness = 1.6; V.outline.edgeGlow = 0.4;
  V.composer.addPass(V.outline);
  V.composer.addPass(new OutputPass());
  resize();
  // [2026-09-28 v0.5.1] const loop = () => { requestAnimationFrame(loop); if (V.needsRender) { V.needsRender = false; r.render(s, V.camera); } };
  const loop = () => { requestAnimationFrame(loop); if (V.needsRender) { V.needsRender = false; V.composer.render(); } };
  loop();
}

function resize() {
  const w = V.el.clientWidth, h = V.el.clientHeight;
  V.renderer.setSize(w, h); V.camera.aspect = w / Math.max(h, 1); V.camera.updateProjectionMatrix();
  // v0.5.2: anche la pipeline del contorno segue le dimensioni della vista
  if (V.composer) { V.composer.setPixelRatio(window.devicePixelRatio); V.composer.setSize(w, h); }
  V.needsRender = true;
}
export const redraw = () => { V.needsRender = true; };

// Imposta se il tasto sinistro orbita (false durante gli strumenti di disegno)
export function leftOrbit(on) { V.controls.mouseButtons.LEFT = on ? THREE.MOUSE.ROTATE : null; }

// -----------------------------------------------------------------------------
// Piano di stampa: griglia + contorno del volume di stampa
// -----------------------------------------------------------------------------
export function drawBed() {
  const g = V.bedGroup; while (g.children.length) g.remove(g.children[0]);
  const [bx, by, bz] = settings.bed;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(bx, by), new THREE.MeshBasicMaterial({ color: 0x252b36, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
  plate.position.z = -0.05; g.add(plate);
  const grid = new THREE.GridHelper(Math.max(bx, by), Math.round(Math.max(bx, by) / 10), 0x3d4556, 0x2f3542);
  grid.rotation.x = Math.PI / 2; grid.scale.set(bx / Math.max(bx, by), 1, by / Math.max(bx, by)); g.add(grid);
  const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(bx, by, bz)), new THREE.LineBasicMaterial({ color: 0x4f9dff, transparent: true, opacity: 0.25 }));
  box.position.z = bz / 2; g.add(box);
  const ax = new THREE.AxesHelper(20); ax.position.set(-bx / 2, -by / 2, 0); g.add(ax);
  V.needsRender = true;
}

// -----------------------------------------------------------------------------
// Sincronizza le mesh visualizzate con le parti dello stato
// -----------------------------------------------------------------------------
function syncMeshes() {
  const ids = new Set(state.parts.map(p => p.id));
  for (const [id, m] of V.meshes) if (!ids.has(id)) { m.removeFromParent(); m.geometry.disposeBoundsTree?.(); m.geometry.dispose(); m.material.dispose(); V.meshes.delete(id); }
  const [bx, by, bz] = settings.bed;
  for (const p of state.parts) {
    let m = V.meshes.get(p.id);
    if (!m) {
      const g = geomFromData(p.data);
      const col = new Float32Array(g.attributes.position.count * 3).fill(1);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: p.color, flatShading: true, vertexColors: true, roughness: 0.65, metalness: 0.05, side: THREE.DoubleSide }));
      m.userData.partId = p.id; V.meshes.set(p.id, m); V.root.add(m);
      // dati pennello trasferiti da una versione precedente della parte (scultura)
      const c = V.carry.get(p.id); if (c) { V.carry.delete(p.id); if (c.mask && c.mask.length === col.length / 3) { m.userData.mask = c.mask; m.userData.paint = new Uint8Array(c.mask.length); V.onCarry && V.onCarry(m); } }
    }
    m.visible = !p.hidden;
    m.material.color.set(p.color);
    const sel = state.selected.has(p.id);
    // [2026-09-28 v0.5.1] m.material.emissive.set(sel ? 0x333333 : 0x000000);
    // v0.5.2: tinta azzurra più evidente sulle parti selezionate (oltre al contorno)
    m.material.emissive.set(sel ? 0x1c4a8a : 0x000000);
    // evidenzia le parti fuori dal volume di stampa
    const bb = m.geometry.boundingBox; const sz = bb.getSize(new THREE.Vector3());
    const fits = fitsBed(sz, [bx, by, bz]);
    m.userData.fits = fits;
    m.material.wireframe = false;
  }
  // v0.5.2: parti selezionate -> contorno
  if (V.outline) V.outline.selectedObjects = [...V.meshes.values()].filter(m => m.visible && state.selected.has(m.userData.partId));
  applyExplode();
}

// Controlla se una dimensione entra nel volume di stampa (anche ruotata di 90° in XY)
export function fitsBed(sz, bed) {
  return (sz.x <= bed[0] && sz.y <= bed[1] && sz.z <= bed[2]) || (sz.y <= bed[0] && sz.x <= bed[1] && sz.z <= bed[2]);
}

// -----------------------------------------------------------------------------
// Vista esplosa: sposta le mesh (solo visualizzazione) lontano dal centro
// -----------------------------------------------------------------------------
export function setExplode(f) { V.explode = f; applyExplode(); }
function applyExplode() {
  const all = new THREE.Box3(); for (const m of V.meshes.values()) if (m.visible) all.union(m.geometry.boundingBox);
  const c = all.getCenter(new THREE.Vector3());
  for (const m of V.meshes.values()) {
    const pc = m.geometry.boundingBox.getCenter(new THREE.Vector3());
    m.position.copy(pc.sub(c).multiplyScalar(V.explode));
  }
  V.needsRender = true;
}

// -----------------------------------------------------------------------------
// Inquadra tutto / le parti indicate
// -----------------------------------------------------------------------------
export function frameAll(parts) {
  const b = new THREE.Box3();
  for (const m of V.meshes.values()) if (m.visible && (!parts || parts.some(p => p.id === m.userData.partId))) b.union(m.geometry.boundingBox);
  if (b.isEmpty()) b.set(new THREE.Vector3(-100, -100, 0), new THREE.Vector3(100, 100, 100));
  const c = b.getCenter(new THREE.Vector3()); const r = b.getSize(new THREE.Vector3()).length() * 0.5 || 50;
  const dir = V.camera.position.clone().sub(V.controls.target).normalize();
  if (dir.lengthSq() < 0.5) dir.set(0.5, -0.7, 0.5).normalize();
  V.controls.target.copy(c); V.camera.position.copy(c).addScaledVector(dir, r / Math.sin(THREE.MathUtils.degToRad(V.camera.fov / 2)) * 1.05);
  V.camera.near = r / 100; V.camera.far = r * 100; V.camera.updateProjectionMatrix(); V.controls.update(); V.needsRender = true;
}

// Viste standard
export function viewFrom(dir) {
  const t = V.controls.target; const d = V.camera.position.distanceTo(t);
  V.camera.position.copy(t).addScaledVector(new THREE.Vector3(...dir).normalize(), d);
  V.controls.update(); V.needsRender = true;
}

// -----------------------------------------------------------------------------
// Raycast: coordinate schermo -> intersezione con le parti visibili
// -----------------------------------------------------------------------------
const _ray = new THREE.Raycaster(); _ray.firstHitOnly = true;
export function ndc(ev) {
  const r = V.renderer.domElement.getBoundingClientRect();
  return new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
}
export function pick(ev, onlyIds) {
  _ray.setFromCamera(ndc(ev), V.camera);
  const list = [...V.meshes.values()].filter(m => m.visible && (!onlyIds || onlyIds.includes(m.userData.partId)));
  for (const m of list) if (!m.geometry.boundsTree) m.geometry.computeBoundsTree();
  const h = _ray.intersectObjects(list, false)[0];
  return h || null;
}
export function rayFrom(ev) { _ray.setFromCamera(ndc(ev), V.camera); return _ray.ray.clone(); }

// Proiezione punto mondo -> pixel del canvas
export function toScreen(p) {
  const v = p.clone().project(V.camera); const r = V.renderer.domElement;
  return { x: (v.x + 1) / 2 * r.clientWidth, y: (1 - v.y) / 2 * r.clientHeight, z: v.z };
}

// -----------------------------------------------------------------------------
// Miniature (PNG dataURL) di una o più parti, per la guida di montaggio
// -----------------------------------------------------------------------------
export function renderThumb(ids, w = 600, h = 450, labels = false, jpeg = true) {
  const r = V.renderer; const prevSize = r.getSize(new THREE.Vector2());
  const cam = new THREE.PerspectiveCamera(35, w / h, 0.1, 50000); cam.up.set(0, 0, 1);
  const vis = new Map(); for (const [id, m] of V.meshes) { vis.set(id, m.visible); m.visible = ids.includes(id); }
  const bedVis = V.bedGroup.visible; V.bedGroup.visible = false; const hv = V.helpers.visible; V.helpers.visible = false;
  const gz = V.gizmo.getHelper().visible; V.gizmo.getHelper().visible = false;
  const b = new THREE.Box3(); for (const id of ids) { const m = V.meshes.get(id); if (m) b.union(m.geometry.boundingBox.clone().translate(m.position)); }
  const c = b.getCenter(new THREE.Vector3()); const rad = b.getSize(new THREE.Vector3()).length() * 0.5 || 10;
  cam.position.copy(c).add(new THREE.Vector3(0.6, -1, 0.7).normalize().multiplyScalar(rad / Math.sin(THREE.MathUtils.degToRad(17.5)) * 1.05));
  cam.lookAt(c); cam.near = rad / 100; cam.far = rad * 100; cam.updateProjectionMatrix();
  const bg = V.scene.background; V.scene.background = new THREE.Color(0xffffff);
  r.setPixelRatio(1); r.setSize(w, h, false); r.render(V.scene, cam);
  const url = jpeg ? r.domElement.toDataURL('image/jpeg', 0.85) : r.domElement.toDataURL('image/png');
  // etichette numeriche delle parti (per la panoramica)
  let pos = [];
  if (labels) for (const id of ids) { const m = V.meshes.get(id); if (!m) continue; const p = m.geometry.boundingBox.getCenter(new THREE.Vector3()).add(m.position).project(cam); pos.push({ id, x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h }); }
  V.scene.background = bg; for (const [id, m] of V.meshes) m.visible = vis.get(id);
  V.bedGroup.visible = bedVis; V.helpers.visible = hv; V.gizmo.getHelper().visible = gz;
  r.setPixelRatio(window.devicePixelRatio); r.setSize(prevSize.x, prevSize.y); V.needsRender = true;
  return { url, pos };
}
