// =============================================================================
// 3D STL Multipart Maker — exporter.js
// Versione: 0.7.0-beta — 2026-10-08 12:00
// -----------------------------------------------------------------------------
// Esportazione: STL binario, 3MF (un oggetto per parte), ZIP (STL + 3MF +
// guida PDF), guida di montaggio PDF (jsPDF) con panoramica numerata,
// schede parti con miniature e tabella giunti. Salvataggio con la finestra
// nativa "Salva con nome" (File System Access API) o download.
// =============================================================================

import * as THREE from 'three';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { jsPDF } from 'jspdf';
import { bboxOf } from './geo.js';
// v0.6.0: guida PDF nella lingua dell'interfaccia
import { getLang } from './i18n.js';

const safe = s => s.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'parte';

// -----------------------------------------------------------------------------
// STL binario
// -----------------------------------------------------------------------------
export function stl(d, name = 'part') {
  const n = d.tv.length / 3; const buf = new ArrayBuffer(84 + n * 50); const dv = new DataView(buf);
  // [2026-09-28 v0.2.0] const head = `Model Splitter Evo - ${name}`.slice(0, 79);
  const head = `3D STL Multipart Maker - ${name}`.slice(0, 79); for (let i = 0; i < head.length; i++) dv.setUint8(i, head.charCodeAt(i) & 0x7f);
  dv.setUint32(80, n, true);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nr = new THREE.Vector3();
  for (let t = 0; t < n; t++) {
    a.fromArray(d.vp, d.tv[t * 3] * 3); b.fromArray(d.vp, d.tv[t * 3 + 1] * 3); c.fromArray(d.vp, d.tv[t * 3 + 2] * 3);
    nr.subVectors(b, a).cross(c.clone().sub(a)).normalize();
    let o = 84 + t * 50;
    for (const v of [nr, a, b, c]) { dv.setFloat32(o, v.x, true); dv.setFloat32(o + 4, v.y, true); dv.setFloat32(o + 8, v.z, true); o += 12; }
  }
  return new Uint8Array(buf);
}

// -----------------------------------------------------------------------------
// 3MF: ogni parte è un oggetto mesh separato e un item di build
// -----------------------------------------------------------------------------
export function threeMF(parts) {
  const esc = s => s.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  let objs = '', items = '';
  parts.forEach((p, i) => {
    const id = i + 1; const vs = []; const ts = [];
    for (let v = 0; v < p.data.vp.length; v += 3) vs.push(`<vertex x="${+p.data.vp[v].toFixed(5)}" y="${+p.data.vp[v + 1].toFixed(5)}" z="${+p.data.vp[v + 2].toFixed(5)}"/>`);
    for (let t = 0; t < p.data.tv.length; t += 3) ts.push(`<triangle v1="${p.data.tv[t]}" v2="${p.data.tv[t + 1]}" v3="${p.data.tv[t + 2]}"/>`);
    objs += `<object id="${id}" name="${esc(p.name)}" type="model"><mesh><vertices>${vs.join('')}</vertices><triangles>${ts.join('')}</triangles></mesh></object>\n`;
    items += `<item objectid="${id}"/>`;
  });
  const model = `<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="it-IT" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n<metadata name="Application">3D STL Multipart Maker</metadata>\n<resources>\n${objs}</resources>\n<build>${items}</build>\n</model>`;
  const ct = `<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;
  return zipSync({ '[Content_Types].xml': strToU8(ct), '_rels/.rels': strToU8(rels), '3D/3dmodel.model': strToU8(model) }, { level: 6 });
}

// ZIP di STL singoli
export function stlZip(parts, extra = {}) {
  const files = {}; const used = new Set();
  parts.forEach((p, i) => { let n = `${String(i + 1).padStart(2, '0')}_${safe(p.name)}.stl`; while (used.has(n)) n = 'x' + n; used.add(n); files[n] = stl(p.data, p.name); });
  Object.assign(files, extra);
  return zipSync(files, { level: 6 });
}

// -----------------------------------------------------------------------------
// GUIDA DI MONTAGGIO PDF
//   parts: parti esportate; log: registro giunti; thumbs: funzione (ids,w,h,labels)->{url,pos}
// -----------------------------------------------------------------------------
export function guidePDF(title, parts, log, thumbs, opts) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' }); const W = 210, H = 297, M = 14;
  // i font standard PDF non hanno tutti i simboli unicode: sostituzioni sicure
  const fix = s => String(s).replace(/[—–]/g, '-').replace(/•/g, '-').replace(/×/g, 'x').replace(/…/g, '...').replace(/[^\x00-\xFF]/g, '?');
  const _t = doc.text.bind(doc); doc.text = (s, ...a) => _t(Array.isArray(s) ? s.map(fix) : fix(s), ...a);
  const num = new Map(parts.map((p, i) => [p.name, i + 1]));
  // [2026-09-28 v0.5.2] const typeName = { pin: 'Perni integrati', tenon: 'Tenoni sciolti', magnet: 'Sedi magneti', chamfer: 'Innesto rastremato', none: 'Nessuno' };
  // v0.6.0: testi della guida in italiano o inglese (+ chiavetta e coda di rondine, prima mancanti)
  const EN = getLang() === 'en';
  const L = EN ? {
    title: 'Assembly guide', parts: 'parts', joints: 'joints', jt: 'Joints', no: 'No.', type: 'Type', pa: 'Part A', pb: 'Part B', conn: 'Conn.',
    none: 'No joints recorded.', instrT: 'Instructions by joint type', partsT: 'Parts', jl: 'Joints', locale: 'en-GB',
    tips: ['Print each part with its largest cut face on the bed whenever possible.',
      `Joint clearance: ${opts.tol} mm (depth ${opts.tolDepth !== undefined ? opts.tolDepth : opts.tol} mm). If the fit is too tight, sand lightly or increase the tolerance.`,
      'The numbers engraved on the cut faces show which faces go together (same number = same joint).'],
    instr: [['Integrated pins', 'The pins stick out of one part: push them into the holes of the matching part. A thin layer of CA or epoxy glue makes the joint permanent.'],
      ['Loose dowels', 'Print the dowels ("Dowel G…" parts), glue them into one side first, then fit the other part.'],
      ['Magnet seats', `Insert Ø${opts.magD}×${opts.magT} mm magnets into both seats with a drop of glue, checking the polarity before gluing the second side.`],
      ['Key', 'The long tongue of one part slides into the slot of the other and aligns the two halves.'],
      ['Dovetail', 'Slide the two halves together sideways along the dovetail; it cannot be pulled apart.'],
      ['Tapered plug', 'The stepped plug of one part goes into the seat of the other and centers the two halves automatically.']],
    typeName: { pin: 'Integrated pins', tenon: 'Loose dowels', magnet: 'Magnet seats', key: 'Key', dovetail: 'Dovetail', chamfer: 'Tapered plug', none: 'None' },
  } : {
    title: 'Guida di montaggio', parts: 'parti', joints: 'giunti', tipsT: 'Consigli', jt: 'Giunti', no: 'N°', type: 'Tipo', pa: 'Parte A', pb: 'Parte B', conn: 'Conn.',
    none: 'Nessun giunto registrato.', instrT: 'Istruzioni per tipo di giunto', partsT: 'Parti', jl: 'Giunti', locale: 'it-IT',
    tips: ['Stampa ogni parte con la faccia di taglio più ampia appoggiata al piatto quando possibile.',
      `Gioco giunti: ${opts.tol} mm (profondità ${opts.tolDepth !== undefined ? opts.tolDepth : opts.tol} mm). Se l'accoppiamento è troppo duro, carteggia leggermente o aumenta la tolleranza.`,
      'I numeri incisi sulle facce di taglio indicano quali facce vanno unite (stesso numero = stesso giunto).'],
    instr: [['Perni integrati', 'I perni sporgono da una parte: inseriscili nei fori della parte corrispondente. Un velo di colla CA o epossidica rende l\'unione permanente.'],
      ['Tenoni sciolti', 'Stampa i tenoni (parti "Tenone G…"), incollali prima in un lato e poi accoppia l\'altra parte.'],
      ['Sedi magneti', `Inserisci magneti Ø${opts.magD}×${opts.magT} mm in entrambe le sedi con un punto di colla, verificando la polarità prima di incollare il secondo lato.`],
      ['Chiavetta', 'La linguetta lunga di una parte entra nella sede dell\'altra e allinea le due metà.'],
      ['Coda di rondine', 'Infila le due metà scorrendo di lato lungo la coda di rondine: non si sfilano tirando.'],
      ['Innesto rastremato', 'Il tappo a gradini di una parte entra nella sede dell\'altra e centra automaticamente le due metà.']],
    typeName: { pin: 'Perni integrati', tenon: 'Tenoni sciolti', magnet: 'Sedi magneti', key: 'Chiavetta', dovetail: 'Coda di rondine', chamfer: 'Innesto rastremato', none: 'Nessuno' },
  };
  if (EN) L.tipsT = 'Tips';
  const typeName = L.typeName;
  // --- pagina 1: panoramica
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text(L.title, M, 22);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(90);
  doc.text(`${title} — ${parts.length} ${L.parts}, ${log.length} ${L.joints} — ${new Date().toLocaleString(L.locale)}`, M, 29);
  doc.setTextColor(0);
  const ov = thumbs(parts.map(p => p.id), 1200, 900, true);
  const iw = W - 2 * M, ih = iw * 0.75; doc.addImage(ov.url, 'JPEG', M, 36, iw, ih);
  // etichette numerate sulla panoramica
  doc.setFontSize(9);
  for (const l of ov.pos) {
    const p = parts.find(x => x.id === l.id); if (!p) continue; const x = M + l.x / 1200 * iw, y = 36 + l.y / 900 * ih;
    doc.setFillColor(20, 20, 20); doc.circle(x, y, 3, 'F'); doc.setTextColor(255); doc.text(String(num.get(p.name)), x, y + 1.1, { align: 'center' }); doc.setTextColor(0);
  }
  let y = 36 + ih + 10; doc.setFontSize(11);
  // [2026-09-28 v0.5.2] const tips = [...] (solo italiano)
  const tips = L.tips;
  doc.setFont('helvetica', 'bold'); doc.text(L.tipsT, M, y); doc.setFont('helvetica', 'normal'); y += 6;
  for (const t of tips) { const lines = doc.splitTextToSize('• ' + t, W - 2 * M); doc.text(lines, M, y); y += lines.length * 5.2; }

  // --- tabella giunti
  doc.addPage(); y = 20; doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(L.jt, M, y); y += 8;
  doc.setFontSize(10); doc.text(L.no, M, y); doc.text(L.type, M + 14, y); doc.text(L.pa, M + 60, y); doc.text(L.pb, M + 120, y); doc.text(L.conn, M + 172, y);
  doc.setFont('helvetica', 'normal'); y += 2; doc.line(M, y, W - M, y); y += 5;
  const exported = new Set(parts.map(p => p.name));
  for (const j of log) {
    if (!exported.has(j.a) && !exported.has(j.b)) continue;
    if (y > H - 20) { doc.addPage(); y = 20; }
    doc.text('G' + j.no, M, y); doc.text(typeName[j.type] || j.type, M + 14, y);
    doc.text(`${num.get(j.a) ? '#' + num.get(j.a) + ' ' : ''}${j.a}`.slice(0, 32), M + 60, y);
    doc.text(`${num.get(j.b) ? '#' + num.get(j.b) + ' ' : ''}${j.b}`.slice(0, 32), M + 120, y);
    doc.text(String(j.count || '-'), M + 172, y); y += 6;
  }
  if (!log.length) { doc.text(L.none, M, y); y += 6; }
  y += 4; doc.setFont('helvetica', 'bold'); doc.text(L.instrT, M, y); doc.setFont('helvetica', 'normal'); y += 6;
  // [2026-09-28 v0.5.2] const instr = [...] (solo italiano, senza chiavetta e coda di rondine)
  const instr = L.instr;
  for (const [a, b] of instr) { const l = doc.splitTextToSize(`${a}: ${b}`, W - 2 * M); if (y + l.length * 5 > H - 15) { doc.addPage(); y = 20; } doc.text(l, M, y); y += l.length * 5 + 2; }

  // --- schede parti (6 per pagina)
  const cw = (W - 2 * M - 8) / 2, chh = 78;
  parts.forEach((p, i) => {
    if (i % 6 === 0) { doc.addPage(); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(L.partsT, M, 18); }
    const col = i % 2, row = Math.floor((i % 6) / 2); const x = M + col * (cw + 8), yy = 24 + row * (chh + 6);
    doc.setDrawColor(200); doc.roundedRect(x, yy, cw, chh, 2, 2);
    const t = thumbs([p.id], 480, 320); doc.addImage(t.url, 'JPEG', x + 2, yy + 2, cw - 4, (cw - 4) * 2 / 3);
    const b = bboxOf(p.data); const s = b.getSize(new THREE.Vector3());
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(`#${i + 1}  ${p.name}`.slice(0, 44), x + 3, yy + chh - 10);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.text(`${s.x.toFixed(1)} × ${s.y.toFixed(1)} × ${s.z.toFixed(1)} mm   ${L.jl}: ${p.joints.length ? p.joints.map(n => 'G' + n).join(', ') : '-'}`, x + 3, yy + chh - 4);
  });
  return new Uint8Array(doc.output('arraybuffer'));
}

// -----------------------------------------------------------------------------
// Salvataggio: finestra nativa se disponibile, altrimenti download
// -----------------------------------------------------------------------------
// [2026-09-28 v0.1.0] versione precedente:
// export async function saveFile(name, bytes, mime, desc = 'File') {
//   const ext = name.slice(name.lastIndexOf('.'));
//   if (window.showSaveFilePicker) {
//     try {
//       const h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: desc, accept: { [mime]: [ext] } }] });
//       const w = await h.createWritable(); await w.write(bytes); await w.close(); return h.name;
//     } catch (e) { if (e.name === 'AbortError') return null; /* altrimenti ripiego sul download */ }
//   }
//   const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
//   const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
//   setTimeout(() => URL.revokeObjectURL(url), 5000); return name;
// }

// v0.2.0: nella finestra nativa (WebView2) il launcher espone window.nativeSave,
// che apre la finestra "Salva con nome" di Windows e scrive il file su disco.
// Fuori dalla finestra nativa restano File System Access API e download.
const toB64 = bytes => new Promise((res, rej) => {
  const fr = new FileReader(); fr.onerror = () => rej(fr.error);
  fr.onload = () => res(String(fr.result).slice(String(fr.result).indexOf(',') + 1));
  fr.readAsDataURL(new Blob([bytes]));
});
export async function saveFile(name, bytes, mime, desc = 'File') {
  const ext = name.slice(name.lastIndexOf('.'));
  if (typeof window.nativeSave === 'function') {
    const saved = await window.nativeSave(name, desc, ext, await toB64(bytes));
    return saved ? saved.split(/[\\/]/).pop() : null;   // "" = annullato
  }
  if (window.showSaveFilePicker) {
    try {
      const h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: desc, accept: { [mime]: [ext] } }] });
      const w = await h.createWritable(); await w.write(bytes); await w.close(); return h.name;
    } catch (e) { if (e.name === 'AbortError') return null; /* altrimenti ripiego sul download */ }
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000); return name;
}

// -----------------------------------------------------------------------------
// v0.7.0 — FILE DI PROGETTO (.stlmp)
// Contenitore ZIP: project.json (impostazioni, registro giunti, elenco parti) +
// per ogni parte i vertici (p<i>.vp, Float32) e i triangoli (p<i>.tv, Uint32).
// Si salva tutto il lavoro (anche parti nascoste e tenoni) e si riapre identico.
// -----------------------------------------------------------------------------
export function projectBytes(parts, extra) {
  const files = {};
  const meta = parts.map((p, i) => {
    files[`p${i}.vp`] = new Uint8Array(p.data.vp.buffer, p.data.vp.byteOffset, p.data.vp.byteLength);
    files[`p${i}.tv`] = new Uint8Array(p.data.tv.buffer, p.data.tv.byteOffset, p.data.tv.byteLength);
    return { name: p.name, color: p.color, joints: p.joints, kind: p.kind, hidden: !!p.hidden };
  });
  files['project.json'] = strToU8(JSON.stringify({ app: '3D STL Multipart Maker', format: 1, ...extra, parts: meta }));
  return zipSync(files, { level: 3 });
}
export function readProject(buf) {
  const f = unzipSync(new Uint8Array(buf));
  if (!f['project.json']) throw new Error('File di progetto non valido');
  const j = JSON.parse(strFromU8(f['project.json']));
  const parts = j.parts.map((m, i) => {
    const a = f[`p${i}.vp`], b = f[`p${i}.tv`]; if (!a || !b) throw new Error('File di progetto incompleto');
    // copia in buffer allineati (le viste dello ZIP possono avere offset dispari)
    return { ...m, data: { vp: new Float32Array(a.slice().buffer), tv: new Uint32Array(b.slice().buffer) } };
  });
  return { ...j, parts };
}
