// =============================================================================
// 3D STL Multipart Maker — build.mjs
// Versione: 0.5.1-beta — 2026-09-28 11:42
// Bundle del frontend con esbuild -> dist/ (app.js, manifold.wasm, html, css)
// =============================================================================
import { build } from 'esbuild';
// [2026-09-28 v0.5.0] import { cpSync, mkdirSync, rmSync } from 'fs';
import { cpSync, mkdirSync, rmSync, readFileSync, existsSync } from 'fs';
// v0.5.1: il README del repository (che contiene il manuale) viene incorporato nell'app
const MANUAL = existsSync('../README.md') ? readFileSync('../README.md', 'utf8') : '# Manuale\nREADME.md non trovato in fase di build.';
const BUILD = process.env.BUILD_STAMP || new Date().toISOString();
rmSync('dist', { recursive: true, force: true }); mkdirSync('dist');
await build({
  entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'esm', target: 'chrome110',
  // [2026-09-28 v0.5.0] outfile: 'dist/app.js', define: { __BUILD__: JSON.stringify(BUILD) },
  outfile: 'dist/app.js', define: { __BUILD__: JSON.stringify(BUILD), __MANUAL__: JSON.stringify(MANUAL) },
  // dipendenze opzionali di jsPDF non usate (html(), svg)
  external: ['html2canvas', 'dompurify', 'canvg', 'node:*', 'module', 'fs', 'path', 'worker_threads', 'url'],
  logLevel: 'info', legalComments: 'none',
  // manifold.js contiene rami per Node (import di 'module'): esclusi nel browser
  platform: 'browser',
});
cpSync('node_modules/manifold-3d/manifold.wasm', 'dist/manifold.wasm');
// [2026-09-28 v0.4.0] for (const f of ['index.html', 'style.css', 'icon.png']) cpSync('public/' + f, 'dist/' + f);
// v0.4.1: aggiunta og.png (immagine anteprima link)
for (const f of ['index.html', 'style.css', 'icon.png', 'og.png']) cpSync('public/' + f, 'dist/' + f);
console.log('OK', BUILD);
