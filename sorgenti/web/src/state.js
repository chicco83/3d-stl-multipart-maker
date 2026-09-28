// =============================================================================
// 3D STL Multipart Maker — state.js
// Versione: 0.3.0-beta — 2026-09-28 10:24
// -----------------------------------------------------------------------------
// Stato applicativo: elenco parti (immutabili), selezione, registro giunti,
// cronologia undo/redo (snapshot di array di riferimenti -> costo minimo),
// impostazioni persistenti (localStorage con try/catch).
// =============================================================================

// Palette colori delle parti (ciclica)
const PALETTE = ['#4f9dff', '#ff9f43', '#2ed573', '#ff6b81', '#a29bfe', '#feca57', '#1dd1a1', '#ff7f50', '#54a0ff', '#c8d6e5', '#5f27cd', '#e17055'];
let _pal = 0; let _id = 1;
export const nextColor = () => PALETTE[(_pal++) % PALETTE.length];

// Crea un nuovo oggetto parte immutabile
export function makePart(data, name, extra = {}) {
  return Object.freeze({ id: _id++, name, color: extra.color || nextColor(), data, joints: extra.joints || [], kind: extra.kind || 'model', hidden: !!extra.hidden });
}
// Copia di una parte con modifiche (nuovo id solo se cambia la geometria)
export function withPart(p, changes) {
  const geomChanged = changes.data && changes.data !== p.data;
  return Object.freeze({ ...p, ...changes, id: geomChanged ? _id++ : p.id });
}

// -----------------------------------------------------------------------------
// Store centrale con notifica ai listener
// -----------------------------------------------------------------------------
export const state = {
  parts: [],            // array di parti
  selected: new Set(),  // id selezionati
  jointNo: 1,           // prossimo numero giunto
  jointLog: [],         // [{no, type, a, b}] per la guida di montaggio
  undo: [], redo: [],
  listeners: new Set(),
};

export function onChange(fn) { state.listeners.add(fn); }
function emit(kind) { for (const fn of state.listeners) fn(kind); }

// Snapshot corrente (per la cronologia)
const snap = () => ({ parts: state.parts.slice(), jointNo: state.jointNo, jointLog: state.jointLog.slice() });
const MAX_HISTORY = 40;

// Applica un nuovo elenco parti registrando la cronologia
export function commit(parts, label = '', extra = {}) {
  state.undo.push({ ...snap(), label }); if (state.undo.length > MAX_HISTORY) state.undo.shift();
  state.redo.length = 0;
  state.parts = parts;
  if (extra.jointNo !== undefined) state.jointNo = extra.jointNo;
  if (extra.jointLog) state.jointLog = extra.jointLog;
  // pulizia selezione da id inesistenti
  const ids = new Set(parts.map(p => p.id));
  for (const s of [...state.selected]) if (!ids.has(s)) state.selected.delete(s);
  if (extra.select) { state.selected = new Set(extra.select); }
  emit('parts');
}

export function undo() {
  const s = state.undo.pop(); if (!s) return false;
  state.redo.push(snap()); restore(s); return true;
}
export function redo() {
  const s = state.redo.pop(); if (!s) return false;
  state.undo.push(snap()); restore(s); return true;
}
function restore(s) {
  state.parts = s.parts; state.jointNo = s.jointNo; state.jointLog = s.jointLog;
  const ids = new Set(s.parts.map(p => p.id));
  for (const x of [...state.selected]) if (!ids.has(x)) state.selected.delete(x);
  emit('parts');
}

// Selezione
export function select(ids, additive = false) {
  if (!additive) state.selected.clear();
  for (const i of ids) { if (additive && state.selected.has(i)) state.selected.delete(i); else state.selected.add(i); }
  emit('selection');
}
// in ordine di selezione (serve per booleane/inlay: la prima è la principale)
export const selectedParts = () => [...state.selected].map(id => state.parts.find(p => p.id === id)).filter(Boolean);
// Parti su cui operare: selezionate, altrimenti tutte le visibili
export const targetParts = () => { const s = selectedParts(); return s.length ? s : state.parts.filter(p => !p.hidden); };
export const notify = k => emit(k);

// -----------------------------------------------------------------------------
// Impostazioni persistenti (volume di stampa, preferenze giunti ecc.)
// -----------------------------------------------------------------------------
const DEFAULTS = {
  bed: [220, 220, 250], bedMargin: 5,
  joint: { type: 'pin', shape: 'round', count: 0, radius: 2.5, length: 8, tol: 0.2, swap: false, magD: 6, magT: 3, magClr: 0.15, depth: 0, number: true, numDepth: 0.6, face: 'flat', chamfer: 6 },
  simplifyTol: 0.02,
};
export const settings = (() => {
  try { const s = JSON.parse(localStorage.getItem('mse.settings') || '{}'); return { ...DEFAULTS, ...s, joint: { ...DEFAULTS.joint, ...(s.joint || {}) } }; }
  catch (e) { return structuredClone(DEFAULTS); }
})();
export function saveSettings() { try { localStorage.setItem('mse.settings', JSON.stringify(settings)); } catch (e) { /* storage non disponibile */ } }
