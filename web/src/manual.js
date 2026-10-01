// =============================================================================
// 3D STL Multipart Maker — manual.js
// Versione: 0.6.1-beta — 2026-10-01 11:43
// -----------------------------------------------------------------------------
// Manuale integrato. Il testo è il README.md del repository, incorporato nel
// bundle in fase di build (costante __MANUAL__, vedi build.mjs): una sola
// fonte per GitHub e per l'app. Viene mostrato solo fino al marcatore
// "fine-manuale" (la parte per sviluppatori resta su GitHub).
// Finestra a tutto schermo con indice laterale dei capitoli, collegamenti
// esterni aperti in una nuova finestra e ricerca nel testo.
// =============================================================================

import { marked } from 'marked';
// v0.6.0: avviso nella versione inglese (il manuale è disponibile in italiano)
import { getLang } from './i18n.js';

const REPO = 'https://github.com/chicco83/3d-stl-multipart-maker';
const SRC = typeof __MANUAL__ !== 'undefined' ? __MANUAL__ : '# Manuale\nNon disponibile in questa build.';

// slug per gli id dei titoli (usati dall'indice)
const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let root = null;
let builtLang = null;   // v0.6.1: lingua con cui è stata costruita la finestra
let keyBound = false;   // v0.6.1: il gestore Esc va registrato una sola volta

// -----------------------------------------------------------------------------
// Costruisce la finestra la prima volta
// -----------------------------------------------------------------------------
// v0.6.1: il README contiene il manuale in italiano (dall'inizio al marcatore
// "fine-manuale") e in inglese (tra "manual-en-start" e "manual-en-end").
function sourceFor(lang) {
  if (lang === 'en') {
    const a = SRC.indexOf('<!-- manual-en-start'), b = SRC.indexOf('<!-- manual-en-end');
    if (a > 0 && b > a) return '# 3D STL Multipart Maker\n\n' + SRC.slice(SRC.indexOf('-->', a) + 3, b);
  }
  const cut = SRC.indexOf('<!-- fine-manuale');
  return cut > 0 ? SRC.slice(0, cut) : SRC;
}
function build() {
  // [2026-10-01 v0.6.0] solo la parte italiana del README:
  // const cut = SRC.indexOf('<!-- fine-manuale');
  // const md = (cut > 0 ? SRC.slice(0, cut) : SRC).replace(/^---\s*$/gm, '');
  // v0.6.1: testo nella lingua dell'interfaccia; tolta la riga dei link lingua (🇮🇹 / 🇬🇧)
  if (root) root.remove();
  builtLang = getLang();
  const md = sourceFor(builtLang).replace(/^---\s*$/gm, '').replace(/^🇮🇹.*$/gm, '');
  const html = marked.parse(md, { gfm: true, breaks: false });

  root = document.createElement('div'); root.id = 'manual'; root.className = 'hidden';
  root.innerHTML = `<div class="mbox" role="dialog" aria-label="Manuale">
    <header><b>📖 Manuale</b><input type="search" placeholder="Cerca nel manuale…" aria-label="Cerca"><span class="grow"></span>
      <a class="gh" href="${REPO}#readme" target="_blank" rel="noopener">Apri su GitHub</a><button class="close" title="Chiudi (Esc)">✕</button></header>
    <!-- [2026-10-01 v0.6.0] avviso "manuale solo in italiano": rimosso, ora c'è il manuale inglese -->
    <div class="mbody"><nav></nav><article>${html}</article></div></div>`;
  document.body.appendChild(root);
  const art = root.querySelector('article'), nav = root.querySelector('nav');

  // --- adattamenti del contenuto --------------------------------------------
  art.querySelectorAll('img').forEach(img => { const s = img.getAttribute('src') || ''; if (s.startsWith('web/public/')) img.src = s.replace('web/public/', ''); });
  art.querySelectorAll('a[href]').forEach(a => {
    const h = a.getAttribute('href');
    if (h.startsWith('#')) return;
    if (!/^https?:/.test(h)) a.href = `${REPO}/blob/main/${h}`;   // link relativi del repository
    a.target = '_blank'; a.rel = 'noopener';
  });
  art.querySelectorAll('table').forEach(t => { const w = document.createElement('div'); w.className = 'tw'; t.replaceWith(w); w.appendChild(t); });

  // --- indice: capitoli (h2) raggruppati sotto i titoli di primo livello ----
  let navHtml = '';
  art.querySelectorAll('h1, h2').forEach(h => {
    h.id = slug(h.textContent);
    navHtml += h.tagName === 'H1' ? `<a class="n1" href="#${h.id}">${h.textContent}</a>` : `<a class="n2" href="#${h.id}">${h.textContent}</a>`;
  });
  nav.innerHTML = navHtml;
  nav.addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a) return; e.preventDefault();
    // [2026-09-28 v0.5.1] art.querySelector(a.getAttribute('href'))... falliva con id che iniziano con una cifra ("#4-aprire...")
    const t = document.getElementById(a.getAttribute('href').slice(1)); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  // evidenzia nell'indice il capitolo visibile
  art.addEventListener('scroll', () => {
    let cur = null; for (const h of art.querySelectorAll('h1, h2')) if (h.offsetTop - art.scrollTop < 80) cur = h.id;
    nav.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + cur));
  });

  // --- ricerca: evidenzia e porta alla prima occorrenza --------------------
  const input = root.querySelector('input');
  const clearMarks = () => art.querySelectorAll('mark').forEach(m => m.replaceWith(document.createTextNode(m.textContent)));
  input.addEventListener('input', () => {
    clearMarks(); art.normalize(); const q = input.value.trim(); if (q.length < 2) return;
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); const hits = [];
    const walk = document.createTreeWalker(art, NodeFilter.SHOW_TEXT); const nodes = []; while (walk.nextNode()) nodes.push(walk.currentNode);
    for (const n of nodes) {
      if (!re.test(n.nodeValue)) continue; re.lastIndex = 0;
      const frag = document.createDocumentFragment(); let last = 0; n.nodeValue.replace(re, (m, i) => { frag.append(n.nodeValue.slice(last, i)); const mk = document.createElement('mark'); mk.textContent = m; frag.append(mk); hits.push(mk); last = i + m.length; return m; });
      frag.append(n.nodeValue.slice(last)); n.replaceWith(frag);
    }
    if (hits[0]) hits[0].scrollIntoView({ block: 'center' });
  });

  root.querySelector('.close').addEventListener('click', closeManual);
  root.addEventListener('click', e => { if (e.target === root) closeManual(); });
  // [2026-10-01 v0.6.0] registrazione ad ogni costruzione -> ora una sola volta
  if (!keyBound) { keyBound = true; window.addEventListener('keydown', e => { if (e.key === 'Escape' && root && !root.classList.contains('hidden')) { e.stopPropagation(); closeManual(); } }, true); }
}

// -----------------------------------------------------------------------------
// API: apre il manuale (facoltativamente a un capitolo, cercato per testo)
// -----------------------------------------------------------------------------
// v0.6.1: nomi dei capitoli in inglese per i collegamenti dalla procedura guidata
const SEC_EN = { 'Aprire un modello': 'Opening a model', 'Stampante': 'Printer', 'Modellazione': 'Modelling', 'Strumenti di taglio': 'Cutting tools', 'Faccia di taglio': 'Cut face', 'Procedura guidata': 'Guided workflow', 'Esporta': 'Export' };
export function openManual(section) {
  // [2026-10-01 v0.6.0] if (!root) build(); ... avviso lingua
  if (!root || builtLang !== getLang()) build();   // ricostruita se è cambiata la lingua
  root.classList.remove('hidden');
  if (section && builtLang === 'en') section = SEC_EN[section] || section;
  if (section) {
    const h = [...root.querySelectorAll('article h1, article h2')].find(x => x.textContent.toLowerCase().includes(section.toLowerCase()));
    if (h) setTimeout(() => h.scrollIntoView({ block: 'start' }), 0);
  }
}
export function closeManual() { if (root) root.classList.add('hidden'); }
export const manualOpen = () => !!root && !root.classList.contains('hidden');
