// =============================================================================
// 3D STL Multipart Maker — main.js
// Versione: 0.5.0-beta — 2026-09-28 11:35
// -----------------------------------------------------------------------------
// Punto d'ingresso dell'interfaccia: import file, elenco parti, strumenti,
// gestione mouse/tastiera. Ogni strumento è un oggetto con:
//   title, desc, orbit (sinistro orbita?), panel() -> html,
//   enter(), exit(), down/move/up(ev), key(ev), onParam(k)
// =============================================================================

import * as THREE from 'three';
import { initGeo, Manifold, CrossSection, parseSTL, parse3MF, parseOBJ, weld, manFromData, dataFromMan, bboxOf, transformData } from './geo.js';
import { state, onChange, commit, undo, redo, select, selectedParts, targetParts, makePart, withPart, settings, saveSettings, notify } from './state.js';
import { V, initViewer, redraw, leftOrbit, drawBed, setExplode, frameAll, viewFrom, pick, toScreen, ndc, renderThumb, fitsBed } from './viewer.js';
import { planeCut, autoPlanesEach, evenPlanes, withSeamTypes, lassoCut, paintPlane, planeFromLine } from './cuts.js';
import * as T from './tools.js';
import { paintStamp, sculptStamp, endSculpt, clearLayer, refreshColors, brushData } from './brush.js';
import { stl, threeMF, stlZip, guidePDF, saveFile } from './exporter.js';
import { $, toast, run, bind, num, range, chk, sel, seg, row, btn, ICONS } from './ui.js';

// [2026-09-28 v0.1.0] const VERSION = '0.1.0-beta';
// [2026-09-28 v0.2.0] const VERSION = '0.2.0-beta';
// [2026-09-28 v0.3.0] const VERSION = '0.3.0-beta';
// [2026-09-28 v0.4.0] const VERSION = '0.4.0-beta';
// [2026-09-28 v0.4.1] const VERSION = '0.4.1-beta';
const VERSION = '0.5.0-beta';
const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';

// =============================================================================
// AVVIO
// =============================================================================
async function boot() {
  $('#ver').textContent = `v${VERSION}`; $('#ver').title = 'build ' + BUILD;
  initViewer($('#view'), $('#overlay'));
  V.onCarry = m => refreshColors(m);
  await initGeo();
  // [2026-09-28 v0.4.1] buildToolbar(); bindGlobal(); initSplitter(); setTool('select');
  buildToolbar(); bindGlobal(); initSplitter(); setTool('guide');
  // [2026-09-28 v0.4.1] onChange(() => { renderParts(); refreshPanelLight(); });
  onChange(() => {
    // v0.5.0: un'operazione di taglio completata segna il passo "Giunti e taglio"
    const last = state.undo[state.undo.length - 1];
    G.cutDone = state.undo.some(u => /taglio|piano|isola|corda|banda/i.test(u.label || ''));
    void last; renderParts(); refreshPanelLight(); renderSteps();
  });
  renderParts();
  heartbeat(); webDownloadLink();
}

// Segnale di vita per il launcher (chiude il server quando la finestra è chiusa)
// [2026-09-28 v0.3.0] function heartbeat() { const ping = () => fetch('/api/ping', { cache: 'no-store' }).catch(() => { }); ping(); setInterval(ping, 3000); }
// v0.4.0: l'app gira anche come sito web (GitHub Pages). Il ping serve solo
// quando è servita dal launcher locale (127.0.0.1); sul web non esiste /api/ping.
const IS_LOCAL = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
function heartbeat() {
  if (!IS_LOCAL) return;
  const ping = () => fetch('/api/ping', { cache: 'no-store' }).catch(() => { }); ping(); setInterval(ping, 3000);
}
// v0.4.0: versione web -> pulsante "Scarica per Windows" verso l'ultima release.
// Proprietario e repository sono ricavati dall'indirizzo <utente>.github.io/<repo>/
function webDownloadLink() {
  if (IS_LOCAL || typeof window.nativeSave === 'function') return;
  const owner = location.hostname.endsWith('.github.io') ? location.hostname.split('.')[0] : null;
  const repo = location.pathname.split('/').filter(Boolean)[0] || '3d-stl-multipart-maker';
  if (!owner) return;
  const a = document.createElement('a');
  // [2026-09-28 v0.4.0] a.href = `https://github.com/${owner}/${repo}/releases/latest`; a.target = '_blank'; a.rel = 'noopener';
  // v0.4.1: "latest" ignora le pre-release (le beta): si apre l'elenco delle release
  a.href = `https://github.com/${owner}/${repo}/releases`; a.target = '_blank'; a.rel = 'noopener';
  a.className = 'dl'; a.textContent = '⬇ Versione Windows'; a.title = 'Scarica l\'eseguibile portable per Windows (GitHub Releases)';
  document.querySelector('#top .grow').after(a);
}

// =============================================================================
// IMPORT FILE
// =============================================================================
async function importFiles(files) {
  const added = [];
  await run('Importazione', async () => {
    for (const f of files) {
      const ext = f.name.toLowerCase().split('.').pop(); const buf = await f.arrayBuffer();
      const base = f.name.replace(/\.[^.]+$/, '');
      let items = [];
      if (ext === 'stl') items = [{ name: base, pos: parseSTL(buf) }];
      else if (ext === 'obj') items = [{ name: base, pos: parseOBJ(buf) }];
      else if (ext === '3mf') items = parse3MF(buf).map((it, i, a) => ({ ...it, name: a.length > 1 ? `${base} - ${it.name}` : base }));
      else { toast(`Formato non supportato: ${f.name}`, 'warn'); continue; }
      const group = [];
      for (const it of items) {
        if (!it.pos.length) continue;
        let d = weld(it.pos);
        const m = manFromData(d); const ok = m.status() === 'NoError';
        if (ok) d = dataFromMan(m); m.delete();
        group.push({ d, name: it.name, ok });
      }
      if (!group.length) { toast(`${f.name}: nessun triangolo trovato`, 'warn'); continue; }
      // posiziona il gruppo al centro del piano, appoggiato a z=0
      const bb = new THREE.Box3(); group.forEach(g => bb.union(bboxOf(g.d)));
      const c = bb.getCenter(new THREE.Vector3()); const M = new THREE.Matrix4().makeTranslation(-c.x, -c.y, -bb.min.z);
      for (const g of group) {
        const p = makePart(transformData(g.d, M), g.name); added.push(p);
        if (!g.ok) toast(`"${g.name}" non è un solido chiuso: usa Modello › Ripara prima di tagliare.`, 'warn', 8000);
        if (p.data.tv.length / 3 > 800000) toast(`"${g.name}" ha ${(p.data.tv.length / 3 / 1e6).toFixed(1)} M triangoli: valuta Modello › Riduci dettaglio.`, 'warn', 8000);
      }
    }
    if (added.length) { commit([...state.parts, ...added], 'Importa', { select: added.map(p => p.id) }); frameAll(); toast(`Importate ${added.length} parti`, 'ok'); }
  });
}

// [2026-09-28 v0.2.0] versione precedente (statuina):
// // Modello dimostrativo (supera il volume di stampa: utile per provare i tagli)
// function demoModel() {
//   run('Creazione modello di prova', () => {
//     const parts = [];
//     const body = Manifold.hull([Manifold.sphere(45, 48).scale([1, 0.75, 1.2]).translate([0, 0, 150]), Manifold.sphere(38, 48).translate([0, 0, 70])]);
//     const head = Manifold.sphere(34, 48).translate([0, 0, 232]);
//     const armL = Manifold.cylinder(120, 14, 11, 32).rotate([0, 90, 0]).translate([30, 0, 185]);
//     const armR = Manifold.cylinder(120, 14, 11, 32).rotate([0, -90, 0]).translate([-30, 0, 185]);
//     const base = Manifold.cylinder(24, 70, 62, 96).translate([0, 0, 0]);
//     const legs = Manifold.cylinder(50, 26, 22, 32).translate([0, 0, 20]);
//     const all = Manifold.union([body, head, armL, armR, base, legs]);
//     const d = dataFromMan(all); [body, head, armL, armR, base, legs, all].forEach(m => m.delete());
//     const p = makePart(d, 'Statuina demo'); parts.push(p);
//     commit([...state.parts, ...parts], 'Demo', { select: [p.id] }); frameAll();
//   });
// }

// v0.3.0: modello dimostrativo "Razzo demo" (alto 390 mm, alette larghe 250 mm):
// supera il volume di stampa in altezza e larghezza, utile per provare i tagli.
function demoModel() {
  run('Creazione modello di prova', () => {
    const tmp = []; const T = m => (tmp.push(m), m);
    const nozzle = T(Manifold.cylinder(40, 24, 34, 64));                          // ugello
    const body = T(Manifold.cylinder(250, 36, 36, 96).translate([0, 0, 40]));     // fusoliera
    const nose = T(Manifold.cylinder(100, 36, 2, 96).translate([0, 0, 290]));     // ogiva
    const ring1 = T(T(CrossSection.circle(3, 24).translate([37, 0])).revolve(96)).translate([0, 0, 120]);
    const ring2 = T(T(CrossSection.circle(3, 24).translate([37, 0])).revolve(96)).translate([0, 0, 230]);
    // aletta: profilo nel piano XZ, spessore 6 mm, replicata 3 volte a 120°
    const finCS = T(new CrossSection([[[30, 40], [125, 0], [125, 45], [30, 150]]]));
    const fin = T(T(finCS.extrude(6)).translate([0, 0, -3])).rotate([90, 0, 0]); T(fin);
    const fins = [0, 120, 240].map(a => T(fin.rotate([0, 0, a])));
    const all = Manifold.union([nozzle, body, nose, ring1, ring2, ...fins]);
    const d = dataFromMan(all); all.delete(); tmp.forEach(m => m.delete());
    const p = makePart(d, 'Razzo demo');
    commit([...state.parts, p], 'Demo', { select: [p.id] }); frameAll();
  });
}

// =============================================================================
// ELENCO PARTI
// =============================================================================
function renderParts() {
  const ul = $('#parts'); ul.innerHTML = '';
  $('#empty').classList.toggle('hidden', state.parts.length > 0);
  let tris = 0;
  for (const p of state.parts) {
    tris += p.data.tv.length / 3;
    const bb = bboxOf(p.data); const s = bb.getSize(new THREE.Vector3());
    const fits = fitsBed(s, settings.bed);
    const li = document.createElement('li'); li.className = (state.selected.has(p.id) ? 'sel ' : '') + (p.hidden ? 'hid' : '');
    li.innerHTML = `<span class="dot" style="background:${p.color}"></span><span class="nm" title="Doppio click per rinominare">${esc(p.name)}</span>`
      + `<span class="sz">${s.x.toFixed(0)}×${s.y.toFixed(0)}×${s.z.toFixed(0)}</span>${fits ? '' : '<span class="bad" title="Non entra nel volume di stampa">⚠</span>'}`
      + `<button class="eye" title="Mostra/nascondi">${p.hidden ? '◌' : '●'}</button>`;
    li.addEventListener('click', e => { if (e.target.classList.contains('eye')) return; select([p.id], e.ctrlKey || e.shiftKey || e.metaKey); });
    li.querySelector('.eye').addEventListener('click', () => commit(state.parts.map(x => x === p ? withPart(p, { hidden: !p.hidden }) : x), 'Visibilità'));
    li.querySelector('.nm').addEventListener('dblclick', e => {
      const inp = document.createElement('input'); inp.value = p.name; inp.style.width = '100%'; e.target.replaceWith(inp); inp.focus(); inp.select();
      const done = () => { const v = inp.value.trim(); if (v && v !== p.name) commit(state.parts.map(x => x === p ? withPart(p, { name: v }) : x), 'Rinomina'); else renderParts(); };
      inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') done(); if (ev.key === 'Escape') renderParts(); ev.stopPropagation(); });
      inp.addEventListener('blur', done);
    });
    ul.appendChild(li);
  }
  $('#partcount').textContent = state.parts.length ? `(${state.parts.length})` : '';
  const sp = selectedParts();
  $('#info').textContent = `${state.parts.length} parti · ${Math.round(tris).toLocaleString('it-IT')} triangoli` + (sp.length ? ` · selezionate: ${sp.length}` : '');
}
const esc = s => s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

// =============================================================================
// PIANO DI TAGLIO (widget) E ANTEPRIME PIANI
// =============================================================================
const planeObj = new THREE.Group();
{
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffb142, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)), new THREE.LineBasicMaterial({ color: 0xffb142 }));
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 0.18, 0x4f9dff, 0.06, 0.04);
  planeObj.add(m, e, arrow); planeObj.visible = false; planeObj.userData.init = false;
}
const previewGroup = new THREE.Group();
function targetsBox(parts = targetParts()) { const b = new THREE.Box3(); parts.forEach(p => b.union(bboxOf(p.data))); if (b.isEmpty()) b.set(new THREE.Vector3(-50, -50, 0), new THREE.Vector3(50, 50, 100)); return b; }
function planeNormal() { return new THREE.Vector3(0, 0, 1).applyQuaternion(planeObj.quaternion).normalize(); }
function planeSize() { const s = targetsBox().getSize(new THREE.Vector3()).length() * 1.15; planeObj.scale.set(s, s, s); }
function setPlane(n, point) {
  planeObj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n.clone().normalize());
  if (point) planeObj.position.copy(point); planeSize(); planeObj.userData.init = true; redraw();
}
function planeRange() {
  const b = targetsBox(); const n = planeNormal(); let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < 8; i++) { const v = new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z); const d = v.dot(n); mn = Math.min(mn, d); mx = Math.max(mx, d); }
  return [mn, mx];
}
function showPreviewPlanes(planes) {
  while (previewGroup.children.length) { const c = previewGroup.children.pop(); c.geometry.dispose(); }
  const b = targetsBox(); const c = b.getCenter(new THREE.Vector3()); const s = b.getSize(new THREE.Vector3());
  for (const pl of planes) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffb142, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pl.n);
    const p = c.clone().addScaledVector(pl.n, pl.d - c.dot(pl.n)); m.position.copy(p);
    const ax = Math.abs(pl.n.x) > 0.9 ? [s.y, s.z] : Math.abs(pl.n.y) > 0.9 ? [s.x, s.z] : [s.x, s.y];
    m.scale.set(ax[0] * 1.1 + 4, ax[1] * 1.1 + 4, 1); previewGroup.add(m);
  }
  redraw();
}

// =============================================================================
// PANNELLO GIUNTI (condiviso da piano, multi, auto, linea, pennello)
// =============================================================================
// [2026-09-28 v0.4.1] versione precedente di jointForm():
// function jointForm() {
//   const j = settings.joint; let h = '';
//   h += `<fieldset><legend>Faccia di taglio</legend><div class="row">${seg('joint.face', [['flat', 'Piana'], ['chamfer', 'Innesto rastremato']])}</div>`;
//   if (j.face === 'chamfer') h += row('Altezza innesto', num('joint.chamfer', 1, 40, 0.5) + ' mm');
//   h += `</fieldset><fieldset><legend>Giunti</legend><div class="row">${seg('joint.type', [['none', 'Nessuno'], ['pin', 'Perni'], ['tenon', 'Tenoni'], ['magnet', 'Magneti']])}</div>`;
//   if (j.type === 'pin' || j.type === 'tenon') {
//     h += row('Forma', seg('joint.shape', [['round', 'Tondo'], ['square', 'Quadro'], ['hex', 'Esagono'], ['diamond', 'Rombo']]));
//     h += row('Quantità', num('joint.count', 0, 12, 1) + '<span class="small">0 = auto</span>');
//     h += row('Raggio', num('joint.radius', 0.8, 15, 0.1) + ' mm');
//     h += row('Lunghezza', num('joint.length', 2, 60, 0.5) + ' mm');
//     h += row('Profondità', num('joint.depth', 0, 12, 0.5) + '<span class="small">mm, 0 = auto (lunghezza)</span>');
//     h += row('Tolleranza', num('joint.tol', 0, 1, 0.05) + ' mm');
//     if (j.type === 'pin') h += `<div class="row">${chk('joint.swap', 'Perni sull\'altra metà')}</div>`;
//   } else if (j.type === 'magnet') {
//     h += row('Quantità', num('joint.count', 0, 12, 1) + '<span class="small">0 = auto</span>');
//     h += row('Diametro magnete', num('joint.magD', 2, 30, 0.5) + ' mm');
//     h += row('Spessore magnete', num('joint.magT', 0.5, 15, 0.5) + ' mm');
//     h += row('Gioco', num('joint.magClr', 0, 1, 0.05) + ' mm');
//   }
//   if (j.type !== 'none') { h += `<div class="row">${chk('joint.number', 'Incidi il numero del giunto')}</div>`; if (j.number) h += row('Prof. numero', num('joint.numDepth', 0.2, 2, 0.1) + ' mm'); }
//   return h + '</fieldset>';
// }

// v0.5.0: aggiunti Chiavetta e Coda di rondine; i campi mostrati dipendono da
// tutti i tipi in uso (tipo generale + tipi scelti per i singoli tagli: extra)
const JOINT_TYPES = [['none', 'Nessuno'], ['pin', 'Perni'], ['tenon', 'Tenoni'], ['magnet', 'Magneti'], ['key', 'Chiavetta'], ['dovetail', 'Coda di rondine']];
function jointForm(extra = []) {
  const j = settings.joint; let h = '';
  const used = new Set([j.type, ...extra].filter(t => t && t !== 'default' && t !== 'none'));
  const many = used.size > 1; const sub = t => many ? `<p class="small" style="margin:8px 0 2px"><b>${t}</b></p>` : '';
  h += `<fieldset><legend>Faccia di taglio</legend><div class="row">${seg('joint.face', [['flat', 'Piana'], ['chamfer', 'Innesto rastremato']])}</div>`;
  if (j.face === 'chamfer') h += row('Altezza innesto', num('joint.chamfer', 1, 40, 0.5) + ' mm');
  h += `</fieldset><fieldset><legend>Giunti</legend><div class="row">${seg('joint.type', JOINT_TYPES.slice(0, 4))}</div><div class="row">${seg('joint.type', JOINT_TYPES.slice(4))}</div>`;
  if (j.type === 'key') h += '<p class="small">Linguetta rettangolare lunga su una metà, sede chiusa sull\'altra: allinea bene e regge la flessione.</p>';
  if (j.type === 'dovetail') h += '<p class="small">Profilo trapezoidale che attraversa la sezione: il pezzo si infila di lato scorrendo e non si sfila tirando.</p>';
  if (used.has('pin') || used.has('tenon')) {
    h += sub('Perni / Tenoni');
    h += row('Forma', seg('joint.shape', [['round', 'Tondo'], ['square', 'Quadro'], ['hex', 'Esagono'], ['diamond', 'Rombo']]));
    h += row('Raggio', num('joint.radius', 0.8, 15, 0.1) + ' mm');
    h += row('Lunghezza', num('joint.length', 2, 60, 0.5) + ' mm');
    h += row('Profondità', num('joint.depth', 0, 12, 0.5) + '<span class="small">mm, 0 = auto (lunghezza)</span>');
  }
  if (used.has('magnet')) {
    h += sub('Magneti');
    h += row('Diametro magnete', num('joint.magD', 2, 30, 0.5) + ' mm');
    h += row('Spessore magnete', num('joint.magT', 0.5, 15, 0.5) + ' mm');
    h += row('Gioco', num('joint.magClr', 0, 1, 0.05) + ' mm');
  }
  if (used.has('key') || used.has('dovetail')) {
    h += sub('Chiavetta / Coda di rondine');
    h += row('Larghezza', num('joint.keyW', 2, 40, 0.5) + ' mm');
    h += row('Altezza', num('joint.keyH', 1, 30, 0.5) + ' mm');
    if (used.has('key')) h += row('Lunghezza', num('joint.keyLen', 10, 100, 5) + '<span class="small">% della sezione</span>');
    if (used.has('dovetail')) h += row('Svasatura', num('joint.dvAngle', 5, 30, 1) + '<span class="small">gradi</span>');
  }
  if (used.size) {
    h += sub('Comuni');
    h += row('Quantità', num('joint.count', 0, 12, 1) + '<span class="small">0 = auto</span>');
    h += row('Tolleranza', num('joint.tol', 0, 1, 0.05) + ' mm');
    if (used.has('pin') || used.has('key')) h += `<div class="row">${chk('joint.swap', 'Parte sporgente sull\'altra metà')}</div>`;
    h += `<div class="row">${chk('joint.number', 'Incidi il numero del giunto')}</div>`; if (j.number) h += row('Prof. numero', num('joint.numDepth', 0.2, 2, 0.1) + ' mm');
  }
  return h + '</fieldset>';
}

// v0.5.0: elenco dei tagli con scelta del giunto per ciascuno ("pick per seam")
const SEAM_TYPES = [['default', 'Come sopra'], ...JOINT_TYPES];
function seamList(planes, showPos = true) {
  tp.seams = tp.seams || {}; const seen = new Map();
  for (const p of planes) if (p.key && !seen.has(p.key)) seen.set(p.key, p);
  if (!seen.size) return '';
  let rows = '';
  for (const [k, p] of seen) {
    if (!tp.seams[k]) tp.seams[k] = 'default';
    const ax = k[0].toLowerCase();
    rows += row(`Taglio ${k}${showPos ? ` <span class="small">${ax} = ${p.d.toFixed(0)}</span>` : ''}`, sel('tp.seams.' + k, SEAM_TYPES));
  }
  return `<fieldset><legend>Giunto per ogni taglio</legend><p class="small">"Come sopra" usa il tipo di giunto scelto qui sopra. X = tagli verticali trasversali, Z = tagli orizzontali.</p>${rows}</fieldset>`;
}
const seamExtra = () => Object.values(tp.seams || {});

// =============================================================================
// STRUMENTI
// =============================================================================
const tools = {};
let tool = null; let toolName = ''; const tp = {}; // tp = parametri locali dello strumento

// ---------------------------------------------------------------- Seleziona --
tools.select = {
  title: 'Seleziona', icon: 'select', hk: 'v', orbit: true,
  desc: 'Click su una parte per selezionarla (Ctrl/Shift = aggiungi). Tasto sinistro o destro trascinato = orbita.',
  panel: () => `<p class="small">Scegli uno strumento a sinistra. Gli strumenti lavorano sulle parti <b>selezionate</b> oppure, se nessuna è selezionata, su tutte le parti visibili.</p>
    <div class="btns">${btn('open', 'Apri file…', 'primary')}${btn('demo', 'Modello di prova')}</div>`,
};

// ------------------------------------------------------------------- Sposta --
let pivot = null, pivotStart = null, faceMode = false;
function attachPivot() {
  detachPivot(); const sp = selectedParts(); if (!sp.length) return;
  const b = targetsBox(sp); pivot = new THREE.Object3D(); pivot.position.copy(b.getCenter(new THREE.Vector3())); V.root.add(pivot); pivot.updateMatrixWorld();
  for (const p of sp) { const m = V.meshes.get(p.id); if (m) pivot.attach(m); }
  pivotStart = pivot.matrixWorld.clone(); V.gizmo.attach(pivot); V.gizmo.setMode(tp.gmode || 'translate'); redraw();
}
function detachPivot() {
  if (!pivot) return; V.gizmo.detach();
  for (const c of [...pivot.children]) V.root.attach(c);
  pivot.removeFromParent(); pivot = null; redraw();
}
function bakePivot() {
  if (!pivot) return; pivot.updateMatrixWorld();
  const M = pivot.matrixWorld.clone().multiply(pivotStart.clone().invert());
  const sp = selectedParts(); detachPivot();
  if (!sp.length) return;
  T.transformParts(sp, M, 'Sposta/Ruota/Scala');
}
tools.move = {
  short: 'Sposta', title: 'Sposta / Ruota / Scala', icon: 'move', hk: 'g', orbit: true,
  desc: 'Trascina le maniglie del gizmo sulle parti selezionate. Oppure usa i comandi numerici qui sotto.',
  panel: () => {
    const sp = selectedParts(); const s = sp.length ? targetsBox(sp).getSize(new THREE.Vector3()) : null;
    if (s && !tp.lockInit) { tp.sx = +s.x.toFixed(2); tp.sy = +s.y.toFixed(2); tp.sz = +s.z.toFixed(2); }
    tp.lockInit = false; if (tp.lock === undefined) tp.lock = true;
    return `${sp.length ? '' : '<p class="small" style="color:var(--warn)">Seleziona una o più parti.</p>'}
    <div class="row">${seg('tp.gmode', [['translate', 'Sposta (W)'], ['rotate', 'Ruota (E)'], ['scale', 'Scala (R)']])}</div>
    <fieldset><legend>Dimensioni</legend>
      ${row('X', num('tp.sx', 0.01, 1e5, 0.1, 90) + ' mm')}${row('Y', num('tp.sy', 0.01, 1e5, 0.1, 90) + ' mm')}${row('Z', num('tp.sz', 0.01, 1e5, 0.1, 90) + ' mm')}
      <div class="row">${chk('tp.lock', 'Proporzionale')}</div>
      <div class="btns">${btn('applySize', 'Applica dimensioni', 'primary')}${btn('scalePct', 'Scala %…')}</div></fieldset>
    <fieldset><legend>Rotazione rapida 90°</legend><div class="btns">${btn('rot', 'X', '', 'data-ax="x"')}${btn('rot', 'Y', '', 'data-ax="y"')}${btn('rot', 'Z', '', 'data-ax="z"')}
      ${btn('mirror', 'Specchia X', '', 'data-ax="x"')}${btn('mirror', 'Specchia Y', '', 'data-ax="y"')}</div></fieldset>
    <fieldset><legend>Appoggio e orientamento</legend><div class="btns">
      ${btn('drop', 'Appoggia sul piano')}${btn('center', 'Centra')}${btn('best', 'Orientamento migliore', 'primary')}
      ${btn('faceMode', faceMode ? 'Clicca una faccia…' : 'Appoggia faccia', faceMode ? 'on' : '')}${btn('arrange', 'Disponi sul piano')}</div></fieldset>`;
  },
  enter() { setExplodeUI(0); attachPivot(); },
  exit() { detachPivot(); faceMode = false; leftOrbit(true); },
  onSel() { attachPivot(); renderPanel(); },
  onParam(k, v) {
    if (k === 'tp.gmode') V.gizmo.setMode(v);
    if (tp.lock && ['tp.sx', 'tp.sy', 'tp.sz'].includes(k)) {
      const s = targetsBox(selectedParts()).getSize(new THREE.Vector3()); const f = v / s[k.slice(-1)];
      tp.sx = +(s.x * f).toFixed(2); tp.sy = +(s.y * f).toFixed(2); tp.sz = +(s.z * f).toFixed(2); tp.lockInit = true; renderPanel();
    }
  },
  down(ev) {
    if (!faceMode || ev.button !== 0) return false;
    const h = pick(ev); if (!h) return true;
    const p = state.parts.find(x => x.id === h.object.userData.partId);
    const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
    detachPivot(); faceMode = false; leftOrbit(true);
    commit(state.parts.map(x => x === p ? withPart(p, { data: T.orientDown(p, n) }) : x), 'Appoggia faccia', { select: [] });
    return true;
  },
};
function selCenterMatrix(sp, M) { const c = targetsBox(sp).getCenter(new THREE.Vector3()); return new THREE.Matrix4().makeTranslation(c.x, c.y, c.z).multiply(M).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z)); }

// -------------------------------------------------------------------- Piano --
tools.plane = {
  short: 'Piano', title: 'Taglio a piano', icon: 'plane', hk: 'p', orbit: true,
  desc: 'Un taglio dritto. Posiziona il piano con le maniglie (W sposta, E ruota) o con i comandi, poi premi Taglia.',
  panel: () => {
    const [mn, mx] = planeRange(); const d = planeObj.position.dot(planeNormal());
    tp.off = +d.toFixed(2); tp.offMin = Math.floor(mn); tp.offMax = Math.ceil(mx);
    return `<div class="row"><label>Orientamento</label><div class="seg">${btn('axis', 'X', '', 'data-ax="x"')}${btn('axis', 'Y', '', 'data-ax="y"')}${btn('axis', 'Z', '', 'data-ax="z"')}${btn('axis', 'Vista', '', 'data-ax="view"')}</div></div>
    <div class="row"><label>Posizione</label><input type="range" data-k="tp.off" min="${tp.offMin}" max="${tp.offMax}" step="0.1"></div>
    <div class="row"><label></label>${num('tp.off', -1e5, 1e5, 0.1, 90)} mm</div>
    <div class="btns">${btn('gm', 'Sposta (W)', '', 'data-m="translate"')}${btn('gm', 'Ruota (E)', '', 'data-m="rotate"')}${btn('flip', 'Inverti lato')}${btn('pcenter', 'Centra')}</div>
    ${jointForm()}
    <div class="btns">${btn('doPlane', 'Taglia (Invio)', 'primary')}</div>`;
  },
  enter() {
    setExplodeUI(0); V.helpers.add(planeObj); planeObj.visible = true;
    if (!planeObj.userData.init) setPlane(new THREE.Vector3(0, 0, 1), targetsBox().getCenter(new THREE.Vector3())); else planeSize();
    V.gizmo.attach(planeObj); V.gizmo.setMode('translate'); V.gizmo.addEventListener('objectChange', planeChanged);
  },
  exit() { V.gizmo.removeEventListener('objectChange', planeChanged); V.gizmo.detach(); planeObj.visible = false; redraw(); },
  onParam(k, v) {
    if (k === 'tp.off') { const n = planeNormal(); planeObj.position.addScaledVector(n, v - planeObj.position.dot(n)); redraw(); syncOffInputs(); }
    else renderPanel();
  },
  key(ev) { if (ev.key === 'Enter') { act.doPlane(); return true; } if (ev.key === 'w') V.gizmo.setMode('translate'); if (ev.key === 'e') V.gizmo.setMode('rotate'); return false; },
};
function planeChanged() { tp.off = +planeObj.position.dot(planeNormal()).toFixed(2); syncOffInputs(); }
function syncOffInputs() { document.querySelectorAll('[data-k="tp.off"]').forEach(el => { el.value = tp.off; }); }

// ------------------------------------------------------------ Multi-piano --
tools.multi = {
  title: 'Multi-piano', icon: 'multi', hk: 'm', orbit: true,
  desc: 'Tagli lungo X, Y e Z che si distribuiscono in modo uniforme.',
  panel: () => {
    ['nx', 'ny', 'nz'].forEach(k => { if (tp[k] === undefined) tp[k] = k === 'nz' ? 1 : 0; });
    return `${row('Tagli su X', num('tp.nx', 0, 20, 1))}${row('Tagli su Y', num('tp.ny', 0, 20, 1))}${row('Tagli su Z', num('tp.nz', 0, 20, 1))}
    <p class="small">Totale pezzi per parte: fino a ${(tp.nx + 1) * (tp.ny + 1) * (tp.nz + 1)}</p>${jointForm(seamExtra())}${seamList(tools.multi.planes())}
    <div class="btns">${btn('doMulti', 'Taglia (Invio)', 'primary')}</div>`;
  },
  planes: () => evenPlanes(targetsBox(), [tp.nx || 0, tp.ny || 0, tp.nz || 0]),
  enter() { setExplodeUI(0); V.helpers.add(previewGroup); showPreviewPlanes(this.planes()); },
  exit() { showPreviewPlanes([]); },
  onParam() { showPreviewPlanes(this.planes()); renderPanel(); },
  onParts() { showPreviewPlanes(this.planes()); },
  key(ev) { if (ev.key === 'Enter') { act.doMulti(); return true; } return false; },
};

// -------------------------------------------------------- Auto multi-piano --
tools.auto = {
  short: 'Auto', title: 'Auto multi-piano', icon: 'auto', hk: 'a', orbit: true,
  desc: 'Calcola da solo i tagli perché ogni pezzo entri nel volume della tua stampante.',
  panel: () => {
    const r = autoPlanesEach(targetParts(), settings.bed, settings.bedMargin);
    return `<fieldset><legend>Volume di stampa</legend>${row('X', num('bed.0', 20, 2000, 1) + ' mm')}${row('Y', num('bed.1', 20, 2000, 1) + ' mm')}${row('Z', num('bed.2', 20, 2000, 1) + ' mm')}
    ${row('Margine', num('bedMargin', 0, 50, 1) + ' mm')}</fieldset>
    <p>${r.all.length ? `Parti da tagliare: <b>${r.parts}</b> · piani: <b>${r.all.length}</b> → circa <b>${r.cells}</b> pezzi` : '<span style="color:var(--ok)">Tutte le parti entrano già nel volume di stampa ✓</span>'}</p>
    ${jointForm(seamExtra())}${seamList(r.all, false)}<div class="btns">${btn('doAuto', 'Taglia (Invio)', 'primary')}</div>`;
  },
  enter() { setExplodeUI(0); V.helpers.add(previewGroup); showPreviewPlanes(autoPlanesEach(targetParts(), settings.bed, settings.bedMargin).all); },
  exit() { showPreviewPlanes([]); },
  onParam(k) { if (k.startsWith('bed')) { drawBed(); renderParts(); } showPreviewPlanes(autoPlanesEach(targetParts(), settings.bed, settings.bedMargin).all); renderPanel(); },
  onParts() { showPreviewPlanes(autoPlanesEach(targetParts(), settings.bed, settings.bedMargin).all); },
  key(ev) { if (ev.key === 'Enter') { act.doAuto(); return true; } return false; },
};

// -------------------------------------------------------------------- Linea --
let drag = null; // stato del trascinamento corrente
tools.line = {
  short: 'Linea', title: 'Taglio a linea', icon: 'line', hk: 'l', orbit: false,
  desc: 'Trascina una linea dritta sulla vista: diventa un piano di taglio perpendicolare allo schermo (poi regolabile).',
  panel: () => `<p class="small">Tasto sinistro: traccia la linea. Destro: orbita. Al rilascio si apre lo strumento Piano con il piano già posizionato.</p>`,
  down(ev) { if (ev.button !== 0) return false; drag = { a: px(ev), b: px(ev) }; drawOverlay(); return true; },
  move(ev) { if (!drag) return; drag.b = px(ev); drawOverlay(); },
  up() {
    if (!drag) return; const { a, b } = drag; drag = null; drawOverlay();
    if (Math.hypot(a.x - b.x, a.y - b.y) < 8) return;
    const pl = planeFromLine(V.camera, toNdc(a), toNdc(b));
    const c = targetsBox().getCenter(new THREE.Vector3()); const p = c.clone().addScaledVector(pl.n, pl.d - c.dot(pl.n));
    setPlane(pl.n, p); setTool('plane'); toast('Piano impostato dalla linea: regola se serve e premi Taglia', 'ok');
  },
  overlay() { return drag ? `<line class="line" x1="${drag.a.x}" y1="${drag.a.y}" x2="${drag.b.x}" y2="${drag.b.y}"/>` : ''; },
};

// -------------------------------------------------------------------- Corda --
tools.rope = {
  short: 'Corda', title: 'Corda (lazo)', icon: 'rope', hk: 'r', orbit: false,
  desc: 'Disegna a mano libera un contorno chiuso attorno alla zona da staccare: il taglio attraversa il modello lungo la vista.',
  panel: () => `<p class="small">Tasto sinistro: disegna. Al rilascio il contorno si chiude e viene tagliato. Il taglio segue il contorno (cucitura) in profondità.</p><p class="small">Nota beta: i giunti automatici sono disponibili sui tagli piani.</p>`,
  down(ev) { if (ev.button !== 0) return false; drag = { pts: [px(ev)] }; return true; },
  move(ev) { if (!drag) return; const p = px(ev); const l = drag.pts[drag.pts.length - 1]; if (Math.hypot(p.x - l.x, p.y - l.y) > 4) { drag.pts.push(p); drawOverlay(); } },
  up() {
    if (!drag) return; const pts = drag.pts; drag = null; drawOverlay();
    if (pts.length < 6) return;
    run('Taglio a corda', () => { const n = lassoCut(targetParts(), pts.map(p => { const q = toNdc(p); return [q.x, q.y]; }), V.camera, 'Taglio a corda'); toast(n ? `Tagliate ${n} parti` : 'Il contorno non attraversa nessuna parte', n ? 'ok' : 'warn'); });
  },
  overlay() { return drag ? `<polygon class="lasso" points="${drag.pts.map(p => p.x + ',' + p.y).join(' ')}"/>` : ''; },
};

// -------------------------------------------------------------------- Banda --
let band = [];
tools.band = {
  short: 'Banda', title: 'Banda elastica', icon: 'band', hk: 'b', orbit: false,
  desc: 'Un anello elastico: clicca per aggiungere punti, trascinali per spostarli, clicca sui pallini intermedi per inserirne altri.',
  panel: () => `<p class="small">Punti: <b>${band.length}</b>. <kbd>Invio</kbd> taglia · <kbd>Backspace</kbd> toglie l'ultimo · <kbd>Esc</kbd> svuota.</p>
    <div class="btns">${btn('doBand', 'Taglia', 'primary', band.length < 3 ? 'disabled' : '')}${btn('clearBand', 'Svuota')}</div>`,
  down(ev) {
    if (ev.button !== 0) return false; const p = px(ev);
    const hi = band.findIndex(q => Math.hypot(q.x - p.x, q.y - p.y) < 9);
    if (hi >= 0) { drag = { idx: hi }; return true; }
    for (let i = 0; i < band.length && band.length > 1; i++) { const a = band[i], b = band[(i + 1) % band.length]; if (Math.hypot((a.x + b.x) / 2 - p.x, (a.y + b.y) / 2 - p.y) < 8) { band.splice(i + 1, 0, p); drag = { idx: i + 1 }; drawOverlay(); renderPanel(); return true; } }
    band.push(p); drag = { idx: band.length - 1 }; drawOverlay(); renderPanel(); return true;
  },
  move(ev) { if (drag && drag.idx !== undefined) { band[drag.idx] = px(ev); drawOverlay(); } },
  up() { drag = null; },
  key(ev) {
    if (ev.key === 'Enter') { act.doBand(); return true; }
    if (ev.key === 'Backspace') { band.pop(); drawOverlay(); renderPanel(); return true; }
    if (ev.key === 'Escape') { band = []; drawOverlay(); renderPanel(); return true; }
    return false;
  },
  exit() { drawOverlay(''); },
  overlay() {
    if (!band.length) return '';
    let s = `<polygon class="lasso" points="${band.map(p => p.x + ',' + p.y).join(' ')}"/>`;
    if (band.length > 1) for (let i = 0; i < band.length; i++) { const a = band[i], b = band[(i + 1) % band.length]; s += `<circle class="mid" cx="${(a.x + b.x) / 2}" cy="${(a.y + b.y) / 2}" r="4"/>`; }
    for (const p of band) s += `<circle class="handle" cx="${p.x}" cy="${p.y}" r="6"/>`;
    return s;
  },
};

// ------------------------------------------------------ Pennello di taglio --
let paintMesh = null, stroke = null;
tools.paint = {
  short: 'Pennello', title: 'Pennello di taglio', icon: 'paint', hk: 't', orbit: false,
  desc: 'Dipingi l\'intera sezione da staccare (es. un braccio). Il pennello segue le facce collegate. Il taglio usa un piano adattato al bordo dell\'area dipinta.',
  panel: () => {
    if (tp.brush === undefined) tp.brush = defaultBrush(); if (tp.erase === undefined) tp.erase = false;
    return `${row('Dimensione', range('tp.brush', 0.5, Math.max(50, defaultBrush() * 6), 0.1) + num('tp.brush', 0.1, 1000, 0.5, 60))}
    <div class="row">${seg('tp.erase', [['false', 'Dipingi'], ['true', 'Cancella']])}<span class="small">Alt = inverti · <kbd>[</kbd> <kbd>]</kbd> dimensione</span></div>
    <div class="btns">${btn('clearPaint', 'Pulisci')}</div>
    <p class="small">Dopo ogni tratto compare il piano di taglio proposto: puoi regolarlo con le maniglie (${seg('tp.pgm', [['translate', 'Sposta'], ['rotate', 'Ruota']])}).</p>
    ${jointForm()}
    <div class="btns">${btn('doPaint', 'Taglia regione', 'primary')}${btn('doIsolate', 'Isola (senza giunti)')}</div>`;
  },
  enter() { setExplodeUI(0); V.helpers.add(planeObj); },
  exit() { V.gizmo.detach(); planeObj.visible = false; $('#brushCursor').classList.add('hidden'); if (paintMesh) { clearLayer(paintMesh, 'paint'); paintMesh = null; } redraw(); },
  down(ev) {
    if (ev.button !== 0) return false; const h = pick(ev); if (!h) return true;
    if (paintMesh && paintMesh !== h.object) clearLayer(paintMesh, 'paint');
    paintMesh = h.object; stroke = { last: null }; this.stamp(h, ev); return true;
  },
  stamp(h, ev) {
    if (h.object !== paintMesh) return;
    const p = paintMesh.worldToLocal(h.point.clone());
    if (stroke.last && stroke.last.distanceTo(p) < tp.brush * 0.25) return; stroke.last = p;
    paintStamp(paintMesh, p, h.faceIndex, tp.brush, (tp.erase !== ev.altKey) ? 0 : 1, 'paint'); redraw();
  },
  move(ev) { const h = pick(ev); brushCursor(ev, h, tp.brush); if (stroke && h) this.stamp(h, ev); },
  up() { if (!stroke) return; stroke = null; this.preview(); },
  preview() {
    try {
      const part = paintMesh && state.parts.find(x => x.id === paintMesh.userData.partId); if (!part) return;
      const pp = paintPlane(part, brushData(paintMesh).paint);
      const c = pp.samples.reduce((s, q) => s.add(q), new THREE.Vector3()).divideScalar(pp.samples.length);
      setPlane(pp.n, c.addScaledVector(pp.n, pp.d - c.dot(pp.n))); planeObj.visible = true;
      const s = bboxOf(part.data).getSize(new THREE.Vector3()).length() * 0.5; planeObj.scale.set(s, s, s);
      // il piano proposto è regolabile con il gizmo prima di tagliare
      V.gizmo.attach(planeObj); V.gizmo.setMode(tp.pgm || 'translate');
    } catch (e) { planeObj.visible = false; V.gizmo.detach(); redraw(); }
  },
  onParam(k, v) { if (k === 'tp.pgm') V.gizmo.setMode(v); },
  key(ev) { return brushKeys(ev, 'brush'); },
};
function defaultBrush() { const s = targetsBox().getSize(new THREE.Vector3()).length(); return +(Math.max(1, s * 0.04)).toFixed(1); }
function brushKeys(ev, k) {
  if (ev.key === '[') { tp[k] = +(tp[k] / 1.2).toFixed(2); renderPanel(); return true; }
  if (ev.key === ']') { tp[k] = +(tp[k] * 1.2).toFixed(2); renderPanel(); return true; }
  return false;
}
function brushCursor(ev, h, R) {
  const el = $('#brushCursor'); if (!h) { el.classList.add('hidden'); return; }
  const a = toScreen(h.point); const right = new THREE.Vector3().setFromMatrixColumn(V.camera.matrixWorld, 0);
  const b = toScreen(h.point.clone().addScaledVector(right, R)); const r = Math.max(4, Math.hypot(a.x - b.x, a.y - b.y));
  const p = px(ev); el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; el.style.width = el.style.height = (2 * r) + 'px'; el.classList.remove('hidden');
}

// -------------------------------------------------------------- Scolpisci --
let sculptMesh = null;
tools.sculpt = {
  title: 'Scolpisci', icon: 'sculpt', hk: 's', orbit: false,
  desc: 'Leviga, gonfia o appiattisci la superficie. La maschera protegge le zone da non toccare.',
  panel: () => {
    if (tp.sBrush === undefined) tp.sBrush = defaultBrush(); if (tp.sStr === undefined) tp.sStr = 0.4; if (!tp.sType) tp.sType = 'smooth';
    return `<div class="row">${seg('tp.sType', [['smooth', 'Leviga'], ['inflate', 'Gonfia'], ['flatten', 'Appiattisci']])}</div>
    <div class="row">${seg('tp.sType', [['mask', 'Maschera'], ['unmask', 'Togli maschera']])}</div>
    ${row('Dimensione', range('tp.sBrush', 0.5, Math.max(50, defaultBrush() * 6), 0.1) + num('tp.sBrush', 0.1, 1000, 0.5, 60))}
    ${row('Intensità', range('tp.sStr', 0.05, 1, 0.05) + `<span class="small">${Math.round(tp.sStr * 100)}%</span>`)}
    <p class="small">Alt = effetto inverso (es. sgonfia). <kbd>[</kbd> <kbd>]</kbd> dimensione. Ogni tratto è annullabile con Ctrl+Z.</p>
    <div class="btns">${btn('clearMask', 'Pulisci maschera')}${btn('refine', 'Aumenta dettaglio')}</div>
    <p class="small">"Aumenta dettaglio" suddivide i triangoli della parte selezionata (lato max ≈ ¼ del pennello) per scolpire in modo più morbido.</p>`;
  },
  enter() { setExplodeUI(0); },
  exit() { $('#brushCursor').classList.add('hidden'); },
  down(ev) {
    if (ev.button !== 0) return false; const h = pick(ev); if (!h) return true;
    sculptMesh = h.object; stroke = { last: null, changed: false }; this.stamp(h, ev); return true;
  },
  stamp(h, ev) {
    if (h.object !== sculptMesh) return; const p = sculptMesh.worldToLocal(h.point.clone());
    if (stroke.last && stroke.last.distanceTo(p) < tp.sBrush * 0.2) return; stroke.last = p;
    if (tp.sType === 'mask' || tp.sType === 'unmask') { paintStamp(sculptMesh, p, h.faceIndex, tp.sBrush, (tp.sType === 'mask') !== ev.altKey ? 1 : 0, 'mask'); }
    else { sculptStamp(sculptMesh, p, h.faceIndex, tp.sBrush, tp.sType, tp.sStr, ev.altKey); stroke.changed = true; }
    redraw();
  },
  move(ev) { const h = pick(ev, stroke && sculptMesh ? [sculptMesh.userData.partId] : null); brushCursor(ev, h, tp.sBrush); if (stroke && h) this.stamp(h, ev); },
  up() {
    if (!stroke) return; const changed = stroke.changed; stroke = null; if (!changed || !sculptMesh) return;
    endSculpt(sculptMesh);
    const part = state.parts.find(x => x.id === sculptMesh.userData.partId); if (!part) return;
    const np = withPart(part, { data: { vp: new Float32Array(sculptMesh.geometry.attributes.position.array), tv: part.data.tv } });
    V.carry.set(np.id, { mask: brushData(sculptMesh).mask });
    commit(state.parts.map(x => x === part ? np : x), 'Scolpisci', { select: [...state.selected].map(id => id === part.id ? np.id : id) });
  },
  onParam() { renderPanel(); },
  key(ev) { return brushKeys(ev, 'sBrush'); },
};

// ------------------------------------------------------------------- Forme --
tools.shapes = {
  title: 'Forme', icon: 'shapes', hk: 'h', orbit: true,
  desc: 'Aggiungi forme solide da usare con booleane e inlay. Se una parte è selezionata la forma viene posta sulla sua sommità.',
  panel: () => {
    const D = { kind: 'cube', a: 20, b: 20, c: 20, d: 10, edge: 'sharp', er: 2 }; for (const k in D) if (tp[k] === undefined) tp[k] = D[k];
    const k = tp.kind; let f = '';
    if (k === 'cube') f = row('X', num('tp.a', 0.1, 5000, 0.5)) + row('Y', num('tp.b', 0.1, 5000, 0.5)) + row('Z', num('tp.c', 0.1, 5000, 0.5));
    if (k === 'sphere') f = row('Diametro', num('tp.a', 0.1, 5000, 0.5));
    if (k === 'cylinder') f = row('Diametro', num('tp.a', 0.1, 5000, 0.5)) + row('Altezza', num('tp.b', 0.1, 5000, 0.5));
    if (k === 'tube') f = row('Diam. esterno', num('tp.a', 0.1, 5000, 0.5)) + row('Altezza', num('tp.b', 0.1, 5000, 0.5)) + row('Diam. interno', num('tp.d', 0.1, 5000, 0.5));
    if (k === 'cone') f = row('Diam. base', num('tp.a', 0.1, 5000, 0.5)) + row('Diam. cima', num('tp.d', 0, 5000, 0.5)) + row('Altezza', num('tp.c', 0.1, 5000, 0.5));
    if (k === 'ring') f = row('Diam. anello', num('tp.a', 1, 5000, 0.5)) + row('Spessore', num('tp.d', 0.1, 5000, 0.5));
    const edges = ['cube', 'cylinder', 'tube'].includes(k);
    return `<div class="row">${seg('tp.kind', [['cube', 'Cubo'], ['sphere', 'Sfera'], ['cylinder', 'Cilindro'], ['tube', 'Tubo']])}</div>
      <div class="row">${seg('tp.kind', [['cone', 'Cono'], ['ring', 'Anello']])}</div>${f}
      ${edges ? `<div class="row">${seg('tp.edge', [['sharp', 'Vivi'], ['chamfer', 'Smussati'], ['round', 'Arrotondati']])}</div>` + (tp.edge !== 'sharp' ? row('Raggio bordo', num('tp.er', 0.1, 100, 0.1) + ' mm') : '') : ''}
      <div class="btns">${btn('addShape', 'Aggiungi forma', 'primary')}</div>`;
  },
  onParam() { renderPanel(); },
};

// --------------------------------------------------------------- Booleane --
tools.bool = {
  title: 'Booleane', icon: 'bool', hk: 'o', orbit: true,
  desc: 'Seleziona prima la parte principale (A) e poi le altre (B) con Ctrl+click.',
  panel: () => {
    const sp = selectedParts(); if (tp.clr === undefined) tp.clr = 0;
    return `<p>A: <b>${sp[0] ? esc(sp[0].name) : '—'}</b><br>B: <b>${sp.slice(1).map(p => esc(p.name)).join(', ') || '—'}</b></p>
    ${row('Gioco', num('tp.clr', 0, 5, 0.05) + '<span class="small">mm (solo differenza/intaglio; lento su mesh grandi)</span>')}
    <div class="btns">${btn('bool', 'Unione', '', 'data-op="union"')}${btn('bool', 'Differenza A−B', '', 'data-op="difference"')}${btn('bool', 'Intersezione', '', 'data-op="intersect"')}${btn('bool', 'Intaglia e mantieni', '', 'data-op="carve"')}</div>`;
  },
  onSel() { renderPanel(); },
};

// ------------------------------------------------------------------ Inlay --
tools.inlay = {
  title: 'Inlay', icon: 'inlay', hk: 'i', orbit: true,
  desc: 'Preme una forma nel modello invece di tagliarlo: crea la sede nel modello e una parte inlay separata (es. loghi in altro colore).',
  panel: () => {
    const sp = selectedParts(); if (tp.idepth === undefined) { tp.idepth = 3; tp.iflat = true; tp.iclr = 0; }
    return `<p>Modello: <b>${sp[0] ? esc(sp[0].name) : '—'}</b><br>Forma: <b>${sp[1] ? esc(sp[1].name) : '—'}</b></p>
    <p class="small">Seleziona il modello, poi Ctrl+click sulla forma (posizionata dentro la superficie con Sposta).</p>
    <div class="row">${chk('tp.iflat', 'Fondo piatto')}</div>${tp.iflat ? row('Profondità', num('tp.idepth', 0.2, 100, 0.1) + ' mm dall\'alto') : ''}
    ${row('Gioco', num('tp.iclr', 0, 2, 0.05) + ' mm')}
    <div class="btns">${btn('doInlay', 'Applica inlay', 'primary')}</div>`;
  },
  onSel() { renderPanel(); }, onParam() { renderPanel(); },
};

// ----------------------------------------------------------------- Modello --
tools.model = {
  title: 'Modello', icon: 'model', hk: 'k', orbit: true,
  desc: 'Ispezione, riparazione, riduzione dettaglio, separazione pezzi e gestione parti.',
  panel: () => {
    const sp = selectedParts(); if (tp.vres === undefined) tp.vres = 160;
    let info = '<p class="small">Seleziona una parte per vederne le statistiche.</p>';
    if (sp.length === 1) {
      const r = tp.inspect && tp.inspect.id === sp[0].id ? tp.inspect.r : null;
      info = r ? `<table>
        <tr><td>Stato</td><td>${r.manifold ? '<span style="color:var(--ok)">Solido chiuso ✓</span>' : `<span style="color:var(--err)">Non valido (${r.status})</span>`}</td></tr>
        <tr><td>Triangoli</td><td>${r.tris.toLocaleString('it-IT')}</td></tr><tr><td>Vertici</td><td>${r.verts.toLocaleString('it-IT')}</td></tr>
        <tr><td>Bordi aperti</td><td>${r.openEdges}</td></tr><tr><td>Bordi non-manifold</td><td>${r.nonManifoldEdges}</td></tr>
        <tr><td>Dimensioni</td><td>${r.size.map(v => v.toFixed(2)).join(' × ')} mm</td></tr>
        <tr><td>Volume</td><td>${isNaN(r.volume) ? '-' : (r.volume / 1000).toFixed(2) + ' cm³'}</td></tr>
        <tr><td>Superficie</td><td>${isNaN(r.area) ? '-' : (r.area / 100).toFixed(1) + ' cm²'}</td></tr>
        <tr><td>Pezzi separati</td><td>${isNaN(r.pieces) ? '-' : r.pieces}</td></tr><tr><td>Genere (fori)</td><td>${isNaN(r.genus) ? '-' : r.genus}</td></tr></table>`
        : btn('inspect', 'Ispeziona', 'primary');
    }
    return `<fieldset><legend>Ispeziona</legend>${info}</fieldset>
    <fieldset><legend>Ripara</legend><div class="btns">${btn('repairQ', 'Ripara rapida')}</div>
      ${row('Risoluzione', num('tp.vres', 40, 400, 10) + '<span class="small">celle sul lato lungo</span>')}
      <div class="btns">${btn('repairV', 'Ricostruzione volumetrica')}</div><p class="small">La ricostruzione chiude buchi e auto-intersezioni ma arrotonda i dettagli più piccoli di una cella.</p></fieldset>
    <fieldset><legend>Riduci dettaglio</legend>${row('Tolleranza', num('simplifyTol', 0.001, 5, 0.01) + ' mm')}<div class="btns">${btn('simplify', 'Riduci dettaglio')}</div></fieldset>
    <fieldset><legend>Parti</legend><div class="btns">${btn('separate', 'Separa pezzi sciolti')}${btn('merge', 'Unisci selezionate')}${btn('dup', 'Duplica')}${btn('showAll', 'Mostra tutte')}${btn('del', 'Elimina', 'danger')}</div></fieldset>`;
  },
  onSel() { renderPanel(); },
};

// ----------------------------------------------------------------- Esporta --
tools.export = {
  title: 'Esporta', icon: 'export', hk: 'x', orbit: true,
  desc: 'Esporta le parti selezionate (o tutte le visibili) per lo slicer, con guida di montaggio.',
  panel: () => {
    if (tp.arr === undefined) tp.arr = true;
    const n = targetParts().length;
    return `<p>Parti da esportare: <b>${n}</b> ${selectedParts().length ? '(selezionate)' : '(tutte le visibili)'}</p>
    <div class="row">${chk('tp.arr', 'Disponi ogni parte sul piano (z=0) nel file')}</div>
    <div class="btns" style="flex-direction:column;align-items:stretch">
      ${btn('exZip', 'Pacchetto ZIP: STL + 3MF + guida PDF', 'primary')}
      ${btn('ex3mf', '3MF unico (tutte le parti)')}
      ${btn('exStl', n === 1 ? 'STL singolo' : 'STL separati (ZIP)')}
      ${btn('exPdf', 'Solo guida di montaggio PDF')}
    </div><p class="small">I file vengono salvati con la finestra "Salva con nome" di Windows.</p>`;
  },
  onSel() { renderPanel(); },
};

// ----------------------------------------------------------- Impostazioni --
tools.settings = {
  title: 'Stampante e preferenze', hidden: true, orbit: true, desc: 'Volume di stampa usato per i controlli e per il taglio automatico.',
  panel: () => `${row('Volume X', num('bed.0', 20, 2000, 1) + ' mm')}${row('Volume Y', num('bed.1', 20, 2000, 1) + ' mm')}${row('Volume Z', num('bed.2', 20, 2000, 1) + ' mm')}${row('Margine auto', num('bedMargin', 0, 50, 1) + ' mm')}
    <div class="btns">${btn('preset', 'Bambu/Prusa 250', '', 'data-b="250,210,210"')}${btn('preset', 'Ender 220', '', 'data-b="220,220,250"')}${btn('preset', 'Bambu X1/P1 256', '', 'data-b="256,256,256"')}</div>`,
  onParam() { drawBed(); renderParts(); },
};
tools.help = {
  title: 'Guida rapida', hidden: true, orbit: true, desc: `3D STL Multipart Maker v${VERSION} (build ${BUILD}) — tutto gira in locale, nessun file viene caricato in rete.`,
  panel: () => `<table>
   <tr><td>Orbita</td><td>Tasto destro (o sinistro in Seleziona)</td></tr><tr><td>Sposta vista</td><td>Tasto centrale</td></tr><tr><td>Zoom</td><td>Rotella</td></tr>
   <tr><td>Annulla / Ripeti</td><td><kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Shift+Z</kbd></td></tr><tr><td>Apri</td><td><kbd>Ctrl+O</kbd></td></tr><tr><td>Inquadra</td><td><kbd>F</kbd></td></tr>
   <tr><td>Seleziona tutto</td><td><kbd>Ctrl+A</kbd></td></tr><tr><td>Elimina</td><td><kbd>Canc</kbd></td></tr><tr><td>Pennello</td><td><kbd>[</kbd> <kbd>]</kbd> dimensione</td></tr>
   ${Object.values(tools).filter(t => t.hk).map(t => `<tr><td>${t.title}</td><td><kbd>${t.hk.toUpperCase()}</kbd></td></tr>`).join('')}</table>`,
};


// =============================================================================
// v0.5.0 — PROCEDURA GUIDATA
// Accompagna l'utente nella sequenza: 1 Modello → 2 Stampante → 3 Orienta →
// 4 Metodo di taglio → 5 Giunti e taglio → 6 Controllo → 7 Esporta.
// Una barra dei passi (in alto sulla vista) mostra dove si è e cosa è fatto;
// ogni passo è cliccabile. Gli strumenti manuali restano disponibili e, se la
// guida è attiva, mostrano il pulsante "Torna alla guida".
// =============================================================================
const G = { step: 0, active: false, cutDone: false, exported: false, method: 'auto', visited: new Set() };
const STEPS = [
  { t: 'Modello', d: 'Carica il modello da dividere' },
  { t: 'Stampante', d: 'Volume di stampa della tua stampante' },
  { t: 'Orienta', d: 'Posizione e scala (facoltativo)' },
  { t: 'Metodo', d: 'Come tagliare il modello' },
  { t: 'Giunti e taglio', d: 'Scegli i giunti ed esegui il taglio' },
  { t: 'Controllo', d: 'Verifica i pezzi prima di esportare' },
  { t: 'Esporta', d: 'Salva i file per lo slicer' },
];
const MANUAL_TOOLS = ['plane', 'line', 'rope', 'band', 'paint', 'multi', 'auto'];
const visibleParts = () => state.parts.filter(p => !p.hidden);
const allFit = () => visibleParts().every(p => fitsBed(bboxOf(p.data).getSize(new THREE.Vector3()), settings.bed));
// stato di completamento di ogni passo (per la barra)
function stepDone(i) {
  switch (i) {
    case 0: return state.parts.length > 0;
    case 1: case 2: case 3: return G.visited.has(i) && state.parts.length > 0;
    case 4: return G.cutDone;
    case 5: return G.visited.has(5) && G.cutDone && allFit();
    case 6: return G.exported;
  }
  return false;
}
function renderSteps() {
  const el = $('#steps'); if (!el) return;
  el.innerHTML = STEPS.map((st, i) => {
    const cls = ['step', stepDone(i) ? 'done' : '', (toolName === 'guide' && G.step === i) ? 'cur' : ''].join(' ');
    return `<button class="${cls}" data-act="gstep" data-s="${i}" title="${st.d}"><i>${stepDone(i) ? '✓' : i + 1}</i>${st.t}</button>`;
  }).join('<span class="arr">›</span>');
}
function gotoStep(i) {
  G.step = Math.max(0, Math.min(STEPS.length - 1, i)); G.visited.add(G.step);
  $('#hint').textContent = tools.guide.desc;
  if (toolName !== 'guide') setTool('guide'); else { tools.guide.enter(); renderPanel(); }
  renderSteps();
}
// piani proposti per il passo 5 (auto o multi) con il giunto di ogni taglio
function guidePlanes() {
  if (G.method === 'multi') return { all: tools.multi.planes(), forPart: null };
  const r = autoPlanesEach(targetParts(), settings.bed, settings.bedMargin);
  return { all: r.all, forPart: r.planesFor, info: r };
}
const card = (act, title, text, rec = false, extra = '') => `<button class="card${rec ? ' rec' : ''}" data-act="${act}" ${extra}><b>${title}${rec ? ' <em>consigliato</em>' : ''}</b><span>${text}</span></button>`;
const navBtns = (nextLabel = 'Avanti →', nextDisabled = false) => `<div class="btns gnav">${G.step > 0 ? btn('gprev', '← Indietro') : ''}<span class="grow"></span>${G.step < STEPS.length - 1 ? btn('gnext', nextLabel, 'primary', nextDisabled ? 'disabled' : '') : ''}</div>`;

tools.guide = {
  short: 'Guida', title: 'Procedura guidata', icon: 'guide', hk: 'u', orbit: true,
  get desc() { return `Passo ${G.step + 1} di ${STEPS.length} — ${STEPS[G.step].d}.`; },
  enter() {
    G.active = true; G.visited.add(G.step);
    showPreviewPlanes([]); V.helpers.add(previewGroup);
    if (G.step === 4) showPreviewPlanes(guidePlanes().all);
    if (G.step === 5) setExplodeUI(0.45); else setExplodeUI(0);
    renderSteps();
  },
  exit() { showPreviewPlanes([]); renderSteps(); },
  onParam(k) {
    if (k && k.startsWith('bed')) { drawBed(); renderParts(); }
    if (G.step === 4) showPreviewPlanes(guidePlanes().all);
    renderPanel(); renderSteps();
  },
  onParts() { if (G.step === 4) showPreviewPlanes(guidePlanes().all); renderSteps(); },
  panel() {
    const n = visibleParts().length; const bb = targetsBox(visibleParts()); const sz = bb.getSize(new THREE.Vector3());
    const dims = `${sz.x.toFixed(0)} × ${sz.y.toFixed(0)} × ${sz.z.toFixed(0)} mm`;
    switch (G.step) {
      case 0: return n ? `<p>Modello caricato: <b>${n}</b> ${n === 1 ? 'parte' : 'parti'}, ingombro <b>${dims}</b>.</p>
          <p class="small">Puoi aggiungere altri file con Apri o trascinandoli nella finestra.</p><div class="btns">${btn('open', 'Apri altri file…')}</div>${navBtns()}`
        : `<p>Trascina un file <b>STL, 3MF o OBJ</b> nella finestra oppure:</p><div class="btns">${btn('open', 'Apri file…', 'primary')}${btn('demo', 'Modello di prova')}</div>${navBtns('Avanti →', true)}`;
      case 1: {
        const fit = allFit();
        return `<p>Imposta il volume di stampa: i pezzi verranno tagliati per starci dentro.</p>
          ${row('X', num('bed.0', 20, 2000, 1) + ' mm')}${row('Y', num('bed.1', 20, 2000, 1) + ' mm')}${row('Z', num('bed.2', 20, 2000, 1) + ' mm')}${row('Margine', num('bedMargin', 0, 50, 1) + ' mm')}
          <div class="btns">${btn('preset', 'Ender 220', 'mini', 'data-b="220,220,250"')}${btn('preset', 'Prusa 250×210', 'mini', 'data-b="250,210,210"')}${btn('preset', 'Bambu 256', 'mini', 'data-b="256,256,256"')}${btn('preset', 'Bambu A1 mini', 'mini', 'data-b="180,180,180"')}</div>
          <p>Modello: <b>${dims}</b> — ${fit ? '<span style="color:var(--ok)">entra già nel volume ✓ (puoi comunque dividerlo)</span>' : '<span style="color:var(--warn)">più grande del volume: va diviso</span>'}</p>${navBtns()}`;
      }
      case 2: return `<p>Facoltativo: ruotare o scalare il modello prima di tagliarlo può ridurre il numero di pezzi.</p>
          <div class="btns">${btn('gbest', 'Orientamento migliore')}${btn('grot', 'Ruota 90° X', '', 'data-ax="x"')}${btn('grot', 'Ruota 90° Y', '', 'data-ax="y"')}${btn('grot', 'Ruota 90° Z', '', 'data-ax="z"')}${btn('gscale', 'Scala %…')}</div>
          <p class="small">Per spostare o ruotare a mano usa lo strumento <b>Sposta (G)</b>, poi torna qui.</p>${navBtns('Avanti →')}`;
      case 3: return `<p>Come vuoi dividere il modello?</p>
          ${card('gmethod', 'Automatico', 'Calcola i tagli perché ogni pezzo entri nella stampante.', true, 'data-m="auto"')}
          ${card('gmethod', 'Griglia (multi-piano)', 'Scegli tu quanti tagli su X, Y e Z, equidistanti.', false, 'data-m="multi"')}
          ${card('gmethod', 'Manuale', 'Taglio dove vuoi tu: piano, linea, corda, banda o pennello.', false, 'data-m="manual"')}${navBtns('Avanti →', true)}`;
      case 4: {
        if (G.method === 'manual') return `<p>Scegli lo strumento di taglio, esegui il taglio e poi premi <b>Torna alla guida</b>:</p>
          <div class="btns">${['plane', 'line', 'rope', 'band', 'paint'].map(t => btn('tool', tools[t].short || tools[t].title, '', `data-tool="${t}"`)).join('')}</div>
          <p class="small">Suggerimento: prima di tagliare imposta i giunti nel pannello dello strumento.</p>${navBtns('Avanti →', !G.cutDone)}`;
        const gp = guidePlanes();
        let head = '';
        if (G.method === 'multi') { ['nx', 'ny', 'nz'].forEach(k => { if (tp[k] === undefined) tp[k] = k === 'nz' ? 1 : 0; }); head = `${row('Tagli su X', num('tp.nx', 0, 20, 1))}${row('Tagli su Y', num('tp.ny', 0, 20, 1))}${row('Tagli su Z', num('tp.nz', 0, 20, 1))}`; }
        else head = gp.all.length ? `<p>Piani proposti: <b>${gp.all.length}</b> → circa <b>${gp.info.cells}</b> pezzi (in arancione nella vista).</p>` : '<p style="color:var(--ok)">Il modello entra già nel volume: nessun taglio necessario. Puoi passare al controllo o scegliere il metodo Griglia.</p>';
        return `${head}${jointForm(seamExtra())}${seamList(gp.all, G.method === 'multi')}
          <div class="btns">${btn('gcut', 'Taglia', 'primary', gp.all.length ? '' : 'disabled')}${G.cutDone ? btn('undo', 'Annulla taglio') : ''}</div>${navBtns('Avanti →', !G.cutDone && gp.all.length > 0)}`;
      }
      case 5: {
        const bad = visibleParts().filter(p => !fitsBed(bboxOf(p.data).getSize(new THREE.Vector3()), settings.bed));
        return `<p>Pezzi: <b>${n}</b> · giunti: <b>${state.jointLog.length}</b>. La vista è esplosa per vedere i giunti (slider <b>Esplodi</b> in alto).</p>
          ${bad.length ? `<p style="color:var(--warn)">${bad.length} pezzi non entrano ancora nel volume: ${bad.slice(0, 4).map(p => esc(p.name)).join(', ')}${bad.length > 4 ? '…' : ''}</p><div class="btns">${btn('gstep', 'Rifai il taglio', '', 'data-s="4"')}</div>` : '<p style="color:var(--ok)">Tutti i pezzi entrano nel volume di stampa ✓</p>'}
          <div class="btns">${btn('gbest', 'Orienta tutti i pezzi per la stampa')}${btn('garrange', 'Disponi sul piano')}</div>
          <p class="small">Clicca un pezzo per selezionarlo; con Modello (K) puoi ispezionarlo o ripararlo.</p>${navBtns()}`;
      }
      case 6: return `${tools.export.panel()}${G.exported ? '<p style="color:var(--ok)">File salvati ✓ — nella guida PDF trovi l\'ordine di montaggio.</p>' : ''}${navBtns()}`;
    }
    return '';
  },
};

// =============================================================================
// AZIONI (pulsanti data-act)
// =============================================================================
const act = {
  open: () => $('#file').click(),
  demo: demoModel,
  undo: () => { if (!undo()) toast('Niente da annullare'); },
  redo: () => { if (!redo()) toast('Niente da ripetere'); },
  frame: () => frameAll(),
  view: el => viewFrom({ iso: [0.6, -1, 0.7], top: [0, -0.001, 1], front: [0, -1, 0.001], right: [1, 0, 0.001] }[el.dataset.v]),
  tool: el => setTool(el.dataset.tool),
  selall: () => select(state.parts.filter(p => !p.hidden).map(p => p.id)),
  selnone: () => select([]),
  // piano
  axis: el => { const a = el.dataset.ax; const n = a === 'view' ? new THREE.Vector3().setFromMatrixColumn(V.camera.matrixWorld, 2) : new THREE.Vector3(a === 'x' ? 1 : 0, a === 'y' ? 1 : 0, a === 'z' ? 1 : 0); setPlane(n, planeObj.position.clone()); renderPanel(); },
  gm: el => V.gizmo.setMode(el.dataset.m),
  flip: () => { setPlane(planeNormal().negate(), null); renderPanel(); },
  pcenter: () => { setPlane(planeNormal(), targetsBox().getCenter(new THREE.Vector3())); renderPanel(); },
  doPlane: () => cutWith([{ n: planeNormal(), d: planeObj.position.dot(planeNormal()) }], 'Taglio a piano'),
  // [2026-09-28 v0.4.1] doMulti: () => cutWith(tools.multi.planes(), 'Multi-piano'),
  doMulti: () => cutWith(withSeamTypes(tools.multi.planes(), tp.seams), 'Multi-piano'),
  // [2026-09-28 v0.4.1] doAuto: () => { ... cutWith(r.planesFor, 'Auto multi-piano'); },
  doAuto: () => { const r = autoPlanesEach(targetParts(), settings.bed, settings.bedMargin); if (!r.all.length) return toast('Tutte le parti entrano già nel volume di stampa', 'ok'); cutWith(p => withSeamTypes(r.planesFor(p), tp.seams), 'Auto multi-piano'); },
  doBand: () => {
    if (band.length < 3) return toast('Servono almeno 3 punti', 'warn');
    const pts = band.map(p => { const q = toNdc(p); return [q.x, q.y]; });
    run('Taglio a banda', () => { const n = lassoCut(targetParts(), pts, V.camera, 'Taglio a banda'); if (n) { band = []; drawOverlay(); renderPanel(); } toast(n ? `Tagliate ${n} parti` : 'La banda non attraversa nessuna parte', n ? 'ok' : 'warn'); });
  },
  clearBand: () => { band = []; drawOverlay(); renderPanel(); },
  clearPaint: () => { if (paintMesh) clearLayer(paintMesh, 'paint'); planeObj.visible = false; V.gizmo.detach(); redraw(); },
  doPaint: () => paintCut(settings.joint, 'Taglio a pennello'),
  doIsolate: () => paintCut({ ...settings.joint, type: 'none', face: 'flat' }, 'Isola regione'),
  refine: () => {
    const sp = selectedParts(); if (!sp.length) return toast('Seleziona la parte da suddividere', 'warn');
    const L = Math.max(0.2, (tp.sBrush || defaultBrush()) / 4);
    run('Suddivisione', () => commit(state.parts.map(p => { if (!sp.includes(p)) return p; const m = manFromData(p.data); const r = m.refineToLength(L); m.delete(); const d = dataFromMan(r); r.delete(); if (d.tv.length / 3 > 3e6) throw new Error('Risultato troppo pesante: aumenta la dimensione del pennello'); return withPart(p, { data: d }); }), 'Aumenta dettaglio'));
  },
  clearMask: () => { for (const m of V.meshes.values()) if (m.userData.mask) clearLayer(m, 'mask'); redraw(); },
  // sposta
  applySize: () => { const sp = selectedParts(); if (!sp.length) return; const s = targetsBox(sp).getSize(new THREE.Vector3()); T.transformParts(sp, selCenterMatrix(sp, new THREE.Matrix4().makeScale(tp.sx / s.x, tp.sy / s.y, tp.sz / s.z)), 'Ridimensiona'); },
  scalePct: () => { const sp = selectedParts(); if (!sp.length) return; const v = parseFloat(prompt('Scala in percentuale', '100')); if (!(v > 0)) return; T.transformParts(sp, selCenterMatrix(sp, new THREE.Matrix4().makeScale(v / 100, v / 100, v / 100)), 'Scala'); },
  rot: el => { const sp = selectedParts(); if (!sp.length) return; const a = el.dataset.ax; const R = a === 'x' ? new THREE.Matrix4().makeRotationX(Math.PI / 2) : a === 'y' ? new THREE.Matrix4().makeRotationY(Math.PI / 2) : new THREE.Matrix4().makeRotationZ(Math.PI / 2); T.transformParts(sp, selCenterMatrix(sp, R), 'Ruota 90°'); },
  mirror: el => { const sp = selectedParts(); if (!sp.length) return; const a = el.dataset.ax; T.transformParts(sp, selCenterMatrix(sp, new THREE.Matrix4().makeScale(a === 'x' ? -1 : 1, a === 'y' ? -1 : 1, 1)), 'Specchia'); },
  drop: () => { const sp = selectedParts(); if (sp.length) T.dropToBed(sp); },
  center: () => { const sp = selectedParts(); if (!sp.length) return; const c = targetsBox(sp).getCenter(new THREE.Vector3()); T.transformParts(sp, new THREE.Matrix4().makeTranslation(-c.x, -c.y, 0), 'Centra'); },
  best: () => { const sp = selectedParts(); if (!sp.length) return toast('Seleziona una parte', 'warn'); run('Calcolo orientamento', () => { commit(state.parts.map(p => sp.includes(p) ? withPart(p, { data: T.orientDown(p, T.bestDown(p)) }) : p), 'Orientamento migliore', { select: [] }); toast('Parti orientate per la stampa', 'ok'); }); },
  faceMode: () => { faceMode = !faceMode; detachPivot(); leftOrbit(!faceMode); renderPanel(); if (faceMode) toast('Clicca sulla faccia da appoggiare al piano'); else attachPivot(); },
  arrange: () => { const sp = selectedParts().length ? selectedParts() : state.parts.filter(p => !p.hidden); if (sp.length) T.arrange(sp); },
  // forme / booleane / inlay
  addShape: () => run('Creazione forma', () => {
    const k = tp.kind; const dims = { cube: [tp.a, tp.b, tp.c], sphere: [tp.a], cylinder: [tp.a, tp.b], tube: [tp.a, tp.b, tp.d], cone: [tp.a, tp.d, tp.c], ring: [tp.a, tp.d] }[k];
    T.primitive(k, dims, tp.edge, tp.er);
  }),
  bool: el => run('Operazione booleana', () => T.boolean(el.dataset.op, selectedParts(), tp.clr)),
  doInlay: () => run('Inlay', () => { T.inlay(selectedParts(), tp.idepth, tp.iflat, tp.iclr); toast('Inlay creato', 'ok'); }),
  // modello
  inspect: () => { const p = selectedParts()[0]; if (!p) return; run('Ispezione', () => { tp.inspect = { id: p.id, r: T.inspect(p) }; renderPanel(); }); },
  repairQ: () => eachSel('Riparazione', p => { const d = T.repairQuick(p); if (!d) { toast(`"${p.name}": riparazione rapida non riuscita, prova la ricostruzione volumetrica`, 'warn'); return p; } return withPart(p, { data: d }); }),
  repairV: () => eachSel('Ricostruzione volumetrica', p => withPart(p, { data: T.repairVoxel(p, tp.vres) })),
  simplify: () => { const sp = selectedParts(); if (!sp.length) return toast('Seleziona una parte', 'warn'); run('Riduzione dettaglio', () => { const r = T.simplify(sp, settings.simplifyTol); toast(`Triangoli: ${r.before.toLocaleString('it-IT')} → ${r.after.toLocaleString('it-IT')}`, 'ok'); }); },
  separate: () => { const sp = selectedParts(); if (!sp.length) return toast('Seleziona una parte', 'warn'); run('Separazione', () => { const n = T.separate(sp); toast(n ? `Creati ${n} pezzi` : 'Nessun pezzo sciolto trovato', n ? 'ok' : ''); }); },
  merge: () => { const sp = selectedParts(); if (sp.length < 2) return toast('Seleziona almeno 2 parti', 'warn'); run('Unione', () => T.boolean('union', sp)); },
  dup: () => { const sp = selectedParts(); if (!sp.length) return; const cp = sp.map(p => makePart(transformData(p.data, new THREE.Matrix4().makeTranslation(10, 10, 0)), p.name + ' copia', { joints: p.joints, kind: p.kind })); commit([...state.parts, ...cp], 'Duplica', { select: cp.map(p => p.id) }); },
  showAll: () => commit(state.parts.map(p => p.hidden ? withPart(p, { hidden: false }) : p), 'Mostra tutte'),
  del: () => { const sp = selectedParts(); if (!sp.length) return; commit(state.parts.filter(p => !sp.includes(p)), 'Elimina'); },
  // esporta
  exZip: () => doExport('zip'), ex3mf: () => doExport('3mf'), exStl: () => doExport('stl'), exPdf: () => doExport('pdf'),
  // v0.5.0: azioni della procedura guidata
  guide: () => gotoStep(G.step),
  gstep: el => gotoStep(parseInt(el.dataset.s, 10)),
  gnext: () => gotoStep(G.step + 1),
  gprev: () => gotoStep(G.step - 1),
  gmethod: el => { G.method = el.dataset.m; gotoStep(4); },
  gbest: () => { const ids = visibleParts().filter(p => p.kind !== 'dowel').map(p => p.id); if (!ids.length) return; select(ids); act.best(); },
  grot: el => { const ids = visibleParts().map(p => p.id); if (!ids.length) return; select(ids); act.rot(el); setTimeout(() => { select([]); T.dropToBed(visibleParts()); }, 50); },
  gscale: () => { select(visibleParts().map(p => p.id)); act.scalePct(); },
  garrange: () => { select([]); act.arrange(); },
  gcut: () => {
    const gp = guidePlanes(); if (!gp.all.length) return;
    if (G.method === 'multi') cutWith(withSeamTypes(gp.all, tp.seams), 'Multi-piano', () => gotoStep(5));
    else cutWith(p => withSeamTypes(gp.forPart(p), tp.seams), 'Auto multi-piano', () => gotoStep(5));
  },
  preset: el => { settings.bed = el.dataset.b.split(',').map(Number); saveSettings(); drawBed(); renderParts(); renderPanel(); },
};

function eachSel(label, fn) {
  const sp = selectedParts(); if (!sp.length) return toast('Seleziona una parte', 'warn');
  run(label, () => { commit(state.parts.map(p => sp.includes(p) ? fn(p) : p), label); tp.inspect = null; renderPanel(); });
}
// [2026-09-28 v0.4.1] function cutWith(planes, label) {
// v0.5.0: callback opzionale "done" chiamata se il taglio ha creato parti
function cutWith(planes, label, done) {
  if (Array.isArray(planes) && !planes.length) return toast('Nessun piano di taglio', 'warn');
  const tg = targetParts(); if (!tg.length) return toast('Nessuna parte da tagliare', 'warn');
  run(label, () => { const r = planeCut(tg, planes, settings.joint, label); toast(r.created ? `Create ${r.created} parti${r.dowels ? ` + ${r.dowels} tenoni` : ''}` : 'Il piano non attraversa nessuna parte', r.created ? 'ok' : 'warn'); tool.onParts && tool.onParts(); if (r.created && done) done(); });
}
function paintCut(opts, label) {
  const part = paintMesh && state.parts.find(x => x.id === paintMesh.userData.partId);
  if (!part) return toast('Dipingi prima la regione da staccare', 'warn');
  run(label, () => {
    const pp = paintPlane(part, brushData(paintMesh).paint);
    // se il piano è visibile uso la posa (eventualmente regolata dall'utente)
    if (planeObj.visible) { pp.n = planeNormal(); pp.d = planeObj.position.dot(pp.n); }
    V.gizmo.detach();
    const r = planeCut([part], [pp], opts, label, pp.samples); paintMesh = null; planeObj.visible = false;
    toast(r.created ? 'Regione staccata' : 'Il piano calcolato non attraversa la parte', r.created ? 'ok' : 'warn');
  });
}

// Esportazione
async function doExport(kind) {
  let parts = targetParts(); if (!parts.length) return toast('Niente da esportare', 'warn');
  const title = (parts[0].name || 'modello').replace(/ #\d+$/, '');
  // copie disposte sul piano (non modifica la scena)
  if (tp.arr) parts = parts.map(p => ({ ...p, data: transformData(p.data, T.dropMatrix(p)) }));
  // data e ora locali nel nome file: AAAAMMGG-HHMM
  const dt = new Date(); const z = n => String(n).padStart(2, '0');
  const stamp = `${dt.getFullYear()}${z(dt.getMonth() + 1)}${z(dt.getDate())}-${z(dt.getHours())}${z(dt.getMinutes())}`;
  await run('Esportazione', async () => {
    const guide = () => guidePDF(title, targetParts(), state.jointLog, renderThumb, settings.joint);
    let saved = null;
    if (kind === 'stl') saved = parts.length === 1 ? await saveFile(`${title}.stl`, stl(parts[0].data, parts[0].name), 'model/stl', 'STL') : await saveFile(`${title}_parti_${stamp}.zip`, stlZip(parts), 'application/zip', 'ZIP');
    if (kind === '3mf') saved = await saveFile(`${title}_${stamp}.3mf`, threeMF(parts), 'model/3mf', '3MF');
    if (kind === 'pdf') saved = await saveFile(`${title}_guida_${stamp}.pdf`, guide(), 'application/pdf', 'PDF');
    if (kind === 'zip') saved = await saveFile(`${title}_${stamp}.zip`, stlZip(parts, { [`${title}.3mf`]: threeMF(parts), [`${title}_guida_montaggio.pdf`]: guide() }), 'application/zip', 'ZIP');
    // [2026-09-28 v0.4.1] if (saved) toast(`Salvato: ${saved}`, 'ok');
    if (saved) { toast(`Salvato: ${saved}`, 'ok'); G.exported = true; renderSteps(); if (toolName === 'guide') renderPanel(); }
  });
}

// =============================================================================
// GESTIONE STRUMENTI E PANNELLO
// =============================================================================
function buildToolbar() {
  const nav = $('#tools'); const groups = [['Base', ['guide', 'select', 'move']], ['Taglio', ['plane', 'multi', 'auto', 'line', 'rope', 'band', 'paint']], ['Modella', ['sculpt', 'shapes', 'bool', 'inlay']], ['File', ['model', 'export']]];
  for (const [g, list] of groups) {
    nav.insertAdjacentHTML('beforeend', `<div class="grp">${g}</div>`);
    for (const k of list) { const t = tools[k]; nav.insertAdjacentHTML('beforeend', `<button data-act="tool" data-tool="${k}" title="${t.title} (${t.hk.toUpperCase()})"><svg viewBox="0 0 24 24">${ICONS[t.icon]}</svg>${t.short || t.title.split(' ')[0]}</button>`); }
  }
}
function setTool(name) {
  if (tool && tool.exit) tool.exit();
  if (name !== 'move') detachPivot();
  toolName = name; tool = tools[name]; for (const k in tp) if (k.startsWith('tmp')) delete tp[k];
  document.querySelectorAll('#tools button, #top button[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === name));
  leftOrbit(!!tool.orbit); $('#hint').textContent = tool.desc;
  if (tool.enter) tool.enter();
  renderPanel(); drawOverlay(); renderSteps();
}
function renderPanel() {
  const el = $('#toolpanel');
  // [2026-09-28 v0.4.1] el.innerHTML = `<h3>${tool.title}</h3><p class="desc">${tool.desc}</p>${tool.panel()}`;
  // v0.5.0: con la guida attiva gli altri strumenti mostrano "Torna alla guida"
  const back = G.active && toolName !== 'guide' ? `<div class="gback">${btn('guide', `↩ Torna alla guida (passo ${G.step + 1}: ${STEPS[G.step].t})`)}</div>` : '';
  el.innerHTML = `${back}<h3>${tool.title}</h3><p class="desc">${tool.desc}</p>${tool.panel()}`;
  bind(el, tp, (k, v) => { tool.onParam && tool.onParam(k, v); }, renderPanel);
}
// aggiornamento leggero dopo cambi di stato (selezione/parti)
let _lastSel = '';
function refreshPanelLight() {
  const s = [...state.selected].join(',');
  if (s !== _lastSel) { _lastSel = s; if (tool.onSel) tool.onSel(); }
  // v0.5.0: nella guida, appena caricato il primo modello si passa al passo Stampante
  if (toolName === 'guide' && G.step === 0 && state.parts.length && !G.visited.has(1)) { gotoStep(1); return; }
  if (['multi', 'auto', 'export', 'model', 'bool', 'inlay', 'band', 'guide'].includes(toolName)) { tool.onParts && tool.onParts(); renderPanel(); }
  if (toolName === 'move' && !pivot && !faceMode) attachPivot();
}
function setExplodeUI(v) { $('#explode').value = v; setExplode(v); }

// Overlay SVG
function drawOverlay() { $('#overlay').innerHTML = tool && tool.overlay ? tool.overlay() : ''; }
function px(ev) { const r = V.renderer.domElement.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
function toNdc(p) { const r = V.renderer.domElement; return { x: p.x / r.clientWidth * 2 - 1, y: -(p.y / r.clientHeight * 2 - 1) }; }

// =============================================================================
// EVENTI GLOBALI
// =============================================================================
function bindGlobal() {
  // pulsanti con data-act (delegazione)
  document.body.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const f = act[b.dataset.act]; if (f) f(b);
  });
  $('#file').addEventListener('change', e => { importFiles([...e.target.files]); e.target.value = ''; });
  $('#explode').addEventListener('input', e => setExplode(parseFloat(e.target.value)));

  // trascina e rilascia
  let dc = 0;
  window.addEventListener('dragenter', e => { e.preventDefault(); dc++; $('#drop').classList.remove('hidden'); });
  window.addEventListener('dragleave', e => { e.preventDefault(); if (--dc <= 0) { dc = 0; $('#drop').classList.add('hidden'); } });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => { e.preventDefault(); dc = 0; $('#drop').classList.add('hidden'); if (e.dataTransfer.files.length) importFiles([...e.dataTransfer.files]); });

  // mouse sul canvas
  const cv = V.renderer.domElement; let downAt = null, consumed = false;
  cv.addEventListener('pointerdown', e => {
    downAt = { x: e.clientX, y: e.clientY, b: e.button }; consumed = false;
    if (V.gizmo.dragging || V.gizmo.axis) { consumed = true; return; }
    if (tool.down && tool.down(e)) { consumed = true; cv.setPointerCapture(e.pointerId); }
  });
  cv.addEventListener('pointermove', e => { if (tool.move) tool.move(e); });
  cv.addEventListener('pointerup', e => {
    if (tool.up) tool.up(e);
    if (!consumed && downAt && e.button === 0 && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 5 && !V.gizmo.dragging) {
      const h = pick(e); select(h ? [h.object.userData.partId] : [], e.ctrlKey || e.shiftKey || e.metaKey);
    }
    downAt = null;
  });
  cv.addEventListener('pointerleave', () => $('#brushCursor').classList.add('hidden'));
  window.addEventListener('pointermove', e => { if (drag && e.target !== cv && tool.move) tool.move(e); });
  window.addEventListener('pointerup', e => { if (drag && e.target !== cv && tool.up) tool.up(e); });
  window.addEventListener('resize', drawOverlay);

  // tastiera
  window.addEventListener('keydown', e => {
    if (e.target.matches('input:not([type=range]):not([type=checkbox]), select, textarea')) return;
    const k = e.key.toLowerCase();
    if (e.ctrlKey && k === 'z') { e.preventDefault(); e.shiftKey ? act.redo() : act.undo(); return; }
    if (e.ctrlKey && k === 'y') { e.preventDefault(); act.redo(); return; }
    if (e.ctrlKey && k === 'o') { e.preventDefault(); act.open(); return; }
    if (e.ctrlKey && k === 'a') { e.preventDefault(); act.selall(); return; }
    if (e.ctrlKey || e.metaKey) return;
    if (tool.key && tool.key(e)) { e.preventDefault(); return; }
    if (toolName === 'move' && ['w', 'e', 'r'].includes(k)) { tp.gmode = { w: 'translate', e: 'rotate', r: 'scale' }[k]; V.gizmo.setMode(tp.gmode); renderPanel(); return; }
    if (e.key === 'Delete') { act.del(); return; }
    if (e.key === 'Escape') { select([]); return; }
    if (k === 'f') { frameAll(); return; }
    const t = Object.entries(tools).find(([, t]) => t.hk === k); if (t) setTool(t[0]);
  });
}

// =============================================================================
// v0.2.0 — SPLITTER: ridimensiona in altezza la sezione "Parti" trascinando la
// barra tra pannello strumenti ed elenco. Altezza ricordata (localStorage),
// doppio click = valore predefinito.
// =============================================================================
function initSplitter() {
  const sp = $('#splitter'), panel = $('#panel');
  const apply = h => {
    const max = panel.clientHeight - 150;               // lascia spazio al pannello strumenti
    const v = Math.max(90, Math.min(h, max));
    panel.style.setProperty('--parts-h', v + 'px'); return v;
  };
  try { const h = parseFloat(localStorage.getItem('mse.partsH')); if (h > 0) apply(h); } catch (e) { /* storage non disponibile */ }
  let dragging = false;
  sp.addEventListener('pointerdown', e => { dragging = true; sp.setPointerCapture(e.pointerId); sp.classList.add('drag'); document.body.classList.add('resizing'); e.preventDefault(); });
  sp.addEventListener('pointermove', e => {
    if (!dragging) return;
    const r = panel.getBoundingClientRect(); const v = apply(r.bottom - e.clientY - 3);
    try { localStorage.setItem('mse.partsH', String(v)); } catch (err) { /* ok */ }
  });
  const stop = () => { dragging = false; sp.classList.remove('drag'); document.body.classList.remove('resizing'); };
  sp.addEventListener('pointerup', stop); sp.addEventListener('pointercancel', stop);
  sp.addEventListener('dblclick', () => { panel.style.removeProperty('--parts-h'); try { localStorage.removeItem('mse.partsH'); } catch (e) { /* ok */ } });
  // alla riduzione della finestra l'altezza viene riportata nei limiti
  window.addEventListener('resize', () => { const cur = parseFloat(panel.style.getPropertyValue('--parts-h')); if (cur > 0) apply(cur); });
}

// hk = tasto rapido dello strumento; key(ev) = gestore tastiera dello strumento
boot().catch(e => { console.error(e); toast('Errore di avvio: ' + e.message, 'err', 20000); });
