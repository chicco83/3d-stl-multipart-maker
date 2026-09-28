// =============================================================================
// 3D STL Multipart Maker — build.mjs
// Versione: 0.3.0-beta — 2026-09-28 10:24
// Bundle del frontend con esbuild -> dist/ (app.js, manifold.wasm, html, css)
// =============================================================================
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'fs';
const BUILD = process.env.BUILD_STAMP || new Date().toISOString();
rmSync('dist', { recursive: true, force: true }); mkdirSync('dist');
await build({
  entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'esm', target: 'chrome110',
  outfile: 'dist/app.js', define: { __BUILD__: JSON.stringify(BUILD) },
  // dipendenze opzionali di jsPDF non usate (html(), svg)
  external: ['html2canvas', 'dompurify', 'canvg', 'node:*', 'module', 'fs', 'path', 'worker_threads', 'url'],
  logLevel: 'info', legalComments: 'none',
  // manifold.js contiene rami per Node (import di 'module'): esclusi nel browser
  platform: 'browser',
});
cpSync('node_modules/manifold-3d/manifold.wasm', 'dist/manifold.wasm');
for (const f of ['index.html', 'style.css', 'icon.png']) cpSync('public/' + f, 'dist/' + f);
console.log('OK', BUILD);
