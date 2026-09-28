// =============================================================================
// 3D STL Multipart Maker — ui.js
// Versione: 0.3.0-beta — 2026-09-28 10:24
// -----------------------------------------------------------------------------
// Utilità d'interfaccia: notifiche, overlay di attesa, costruttori di campi
// del pannello e binding automatico campo <-> impostazioni.
//   data-k="joint.radius"   -> settings.joint.radius
//   data-k="tp.nx"          -> parametro locale dello strumento (tp)
//   data-set / data-val     -> pulsanti segmentati (scelta esclusiva)
// =============================================================================

import { settings, saveSettings } from './state.js';

export const $ = s => document.querySelector(s);

// -----------------------------------------------------------------------------
// Notifiche a scomparsa
// -----------------------------------------------------------------------------
export function toast(msg, kind = '', ms = 4200) {
  const d = document.createElement('div'); d.className = 'toast ' + kind; d.textContent = msg;
  $('#toasts').appendChild(d); setTimeout(() => d.remove(), kind === 'err' ? ms * 2 : ms);
}

// -----------------------------------------------------------------------------
// Esegue un'operazione pesante mostrando l'overlay e intercettando gli errori
// -----------------------------------------------------------------------------
export async function run(label, fn) {
  $('#busytxt').textContent = label + '…'; $('#busy').classList.remove('hidden');
  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
  try { return await fn(); }
  catch (e) { console.error(e); toast(e && e.message ? e.message : String(e), 'err'); return undefined; }
  finally { $('#busy').classList.add('hidden'); }
}

// -----------------------------------------------------------------------------
// Lettura/scrittura di percorsi "a.b.c" su settings o tp
// -----------------------------------------------------------------------------
export function getPath(path, tp) {
  const [root, ...rest] = path.split('.'); let o = root === 'tp' ? tp : settings[root];
  if (root !== 'tp' && !rest.length) return settings[root];
  for (let i = 0; i < rest.length - 1; i++) o = o[rest[i]];
  return rest.length ? o[rest[rest.length - 1]] : o;
}
export function setPath(path, val, tp) {
  const [root, ...rest] = path.split('.');
  if (root !== 'tp' && !rest.length) { settings[root] = val; return; }
  let o = root === 'tp' ? tp : settings[root];
  for (let i = 0; i < rest.length - 1; i++) o = o[rest[i]];
  o[rest[rest.length - 1]] = val;
}

// -----------------------------------------------------------------------------
// Costruttori HTML dei campi (il valore corrente viene letto al bind)
// -----------------------------------------------------------------------------
export const num = (k, min, max, step = 1, w = 72) => `<input type="number" data-k="${k}" min="${min}" max="${max}" step="${step}" style="width:${w}px">`;
export const range = (k, min, max, step = 1) => `<input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}">`;
export const chk = (k, label) => `<label><input type="checkbox" data-k="${k}"> ${label}</label>`;
export const sel = (k, opts) => `<select data-k="${k}">${opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`;
export const seg = (k, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-set="${k}" data-val="${v}">${l}</button>`).join('')}</div>`;
export const row = (label, html) => `<div class="row"><label>${label}</label>${html}</div>`;
export const btn = (act, label, cls = '', extra = '') => `<button data-act="${act}" class="${cls}" ${extra}>${label}</button>`;

// -----------------------------------------------------------------------------
// Collega i campi di un contenitore. onChange(k) chiamato ad ogni modifica;
// rerender() per i pulsanti segmentati che cambiano la struttura del pannello.
// -----------------------------------------------------------------------------
export function bind(root, tp, onChange, rerender) {
  root.querySelectorAll('[data-k]').forEach(el => {
    const k = el.dataset.k; const v = getPath(k, tp);
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
    const ev = el.type === 'range' ? 'input' : 'change';
    el.addEventListener(ev, () => {
      let val = el.type === 'checkbox' ? el.checked : (el.type === 'number' || el.type === 'range') ? parseFloat(el.value) : el.value;
      if ((el.type === 'number' || el.type === 'range') && !Number.isFinite(val)) return;
      setPath(k, val, tp); saveSettings(); onChange && onChange(k, val);
    });
  });
  root.querySelectorAll('[data-set]').forEach(el => {
    const k = el.dataset.set; const cur = String(getPath(k, tp));
    el.classList.toggle('on', cur === el.dataset.val);
    el.addEventListener('click', () => {
      const old = getPath(k, tp); let val = el.dataset.val;
      if (typeof old === 'number') val = parseFloat(val); else if (typeof old === 'boolean') val = val === 'true';
      setPath(k, val, tp); saveSettings(); onChange && onChange(k, val); rerender && rerender();
    });
  });
}

// Icone SVG degli strumenti (tratti semplici)
export const ICONS = {
  select: '<path d="M5 3l14 8-6 2-3 6z"/>',
  move: '<path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3"/>',
  plane: '<path d="M3 16l6-9h12l-6 9z"/><path d="M12 3v18" stroke-dasharray="2 2"/>',
  multi: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
  auto: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18M3 12h18"/><path d="M16 6l2 2-2 2" />',
  line: '<path d="M4 20L20 4"/><circle cx="4" cy="20" r="1.8"/><circle cx="20" cy="4" r="1.8"/>',
  rope: '<path d="M5 12c0-5 5-8 9-7s6 5 4 8-6 3-8 6-1 4 2 4"/>',
  band: '<path d="M4 8l6-4 9 3 1 9-8 5-8-5z"/><circle cx="4" cy="8" r="1.5"/><circle cx="19" cy="7" r="1.5"/><circle cx="12" cy="21" r="1.5"/>',
  paint: '<path d="M14 4l6 6-9 9H5v-6z"/><path d="M12 6l6 6"/>',
  sculpt: '<path d="M4 18c3-6 6-9 9-9s5 3 7 1"/><circle cx="17" cy="7" r="3"/>',
  shapes: '<rect x="3" y="12" width="8" height="8"/><circle cx="16" cy="8" r="5"/>',
  bool: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
  inlay: '<rect x="3" y="8" width="18" height="12" rx="1"/><path d="M8 8l2 5h4l2-5"/>',
  model: '<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 12l9-5M12 12v10M12 12L3 7"/>',
  export: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/>',
};
