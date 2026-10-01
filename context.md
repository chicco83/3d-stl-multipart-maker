# 3D STL Multipart Maker — context.md
**Versione: 0.6.0-beta — 2026-10-01 11:03**

## Obiettivo
**3D STL Multipart Maker** (fino alla 0.2.0 "Model Splitter Evo") — programma Windows **portable** (un solo `.exe`, nessuna installazione) con le funzioni offerte da
[modelsplitter.com](https://modelsplitter.com/), preso come riferimento funzionale: dividere modelli 3D troppo grandi per la stampante in parti
stampabili, con giunti di allineamento, e fornire strumenti di modellazione e riparazione. Tutto gira in locale.

## Scelte tecniche (decise in autonomia)
| Ambito | Scelta | Motivo |
|---|---|---|
| Motore geometrico | **manifold-3d 3.5** (WASM) | Booleane robuste e garantite "manifold", split per piano, sezioni 2D (CrossSection con offset), hull, Minkowski, semplificazione, level-set per la riparazione volumetrica |
| Vista 3D | **three.js 0.186** + **three-mesh-bvh** | Rendering WebGL, gizmo TransformControls, raycast accelerato per pennelli e selezione |
| Export | **fflate** (ZIP/3MF), **jsPDF** (guida montaggio) | Leggeri, nessuna dipendenza nativa |
| Manuale | **README.md** + **marked** (dalla 0.5.1) | Una sola fonte: home GitHub e finestra Manuale dell'app |
| Bundle | **esbuild** (ESM) | Un solo `app.js` + `manifold.wasm` |
| Eseguibile | **Go 1.24** con `go:embed` | Cross-compilazione da Linux senza toolchain Windows; exe unico ~7,5 MB; nessuna console (`-H windowsgui`) |
| Finestra | **WebView2 nativo** (`github.com/jchv/go-webview2`, Go puro) — dalla 0.2.0 | Finestra propria del programma con il motore di sistema presente su Windows 10/11; "Salva con nome" nativo via comdlg32. Fallback: Edge/Chrome `--app` (modalità 0.1.0) |

## Architettura
```
3D-STL-Multipart-Maker_vX.Y.Z_….exe (Go, risorse: manifest id 1, icona id 2)
 ├─ server HTTP interno solo su 127.0.0.1:47913 (fallback porta casuale)
 ├─ dist/ incorporata: index.html, style.css, app.js, manifold.wasm, icon.png
 ├─ finestra nativa WebView2 (dati in %LOCALAPPDATA%\3DSTLMultipartMaker\webview2)
 │    └─ binding JS window.nativeSave(nome, descr, ext, base64) → GetSaveFileNameW
 └─ fallback: Edge --app (+ /api/ping heartbeat per la chiusura)
```

### Moduli frontend (`web/src`)
| File | Ruolo |
|---|---|
| `geo.js` | Init WASM, conversioni Manifold ↔ dati ↔ BufferGeometry, saldatura vertici (hash a indirizzamento aperto), parser STL/3MF/OBJ, utilità |
| `state.js` | Parti **immutabili** `{id,name,color,data:{vp,tv},joints,kind,hidden}`, selezione ordinata, registro giunti, undo/redo a snapshot (40 livelli), impostazioni in localStorage |
| `viewer.js` | Scena Z-up, pipeline EffectComposer con OutlinePass per il contorno di selezione (0.5.2), piano e volume di stampa, sincronizzazione mesh, vista esplosa, raycast, miniature per il PDF |
| `joints.js` | Taglio planare con giunti: sistema locale del piano, sezione d'interfaccia, innesto rastremato a gradini, perni/tenoni/magneti con campionamento "farthest point", **chiavetta e coda di rondine** (0.5.0) lungo l'asse principale (PCA) di ogni isola della sezione, numeri a 7 segmenti incisi |
| `cuts.js` | Piano, multi-piano, auto multi-piano (per parte), lazo prospettico (Corda/Banda), piano dal pennello (PCA del bordo), piano da linea |
| `tools.js` | Primitive con bordi, booleane con gioco (Minkowski), inlay, riduzione dettaglio, ispezione, riparazione rapida/volumetrica, separazione, orientamento migliore, disponi |
| `brush.js` | Pittura/maschera/scultura su adiacenza CSR con flood-fill entro il raggio |
| `exporter.js` | STL binario, 3MF multi-oggetto, ZIP, guida PDF, salvataggio |
| `main.js` (0.2.0) | anche lo splitter della sezione Parti |
| `manual.js` (0.5.1) | Manuale integrato: README.md incorporato in build (`__MANUAL__`), reso con `marked`, indice, ricerca; mostrato fino al marcatore `fine-manuale` |
| `i18n.js` (0.6.0) | Interfaccia IT/EN: dizionario IT→EN + modelli regex; MutationObserver traduce testi e attributi del DOM conservando l'originale (cambio lingua reversibile); `t()` per PDF e nomi parti; esclusi nomi parti e manuale |
| `ui.js` | Toast, overlay attesa, campi e binding automatico `data-k` |
| `main.js` | Strumenti, pannelli, eventi mouse/tastiera, import, export; dalla 0.5.0 **procedura guidata** (oggetto `G`, `tools.guide`, barra `#steps`) e scelta del giunto per taglio (`seamList`, chiavi piano `X1/Y1/Z1`, `withSeamTypes`) |

## Repository e distribuzione (dalla 0.4.0)
- GitHub: `3d-stl-multipart-maker` (pubblico, licenza MIT).
- **Web:** GitHub Pages `https://<utente>.github.io/3d-stl-multipart-maker/` — pubblicato dal workflow `pages.yml` a ogni push su `main` (build di `web/` → `web/dist`). Percorsi relativi, nessun backend.
- **Windows:** workflow `release.yml` su tag `v*` → `build.sh` su Ubuntu → Release con l'exe (pre-release se il tag contiene `-`).
- `pubblica-github.ps1`: primo caricamento dal PC Windows (Git + GitHub CLI).
- Anteprima link: meta Open Graph in `index.html` + `web/public/og.png` (1200×630). Nei commenti di `<head>` non inserire tag HTML (i parser delle anteprime li leggono).
- Rilevamento ambiente in `main.js`: `IS_LOCAL` (127.0.0.1/localhost) abilita il ping al launcher; sul web compare il link alle Release (pagina elenco: `latest` esclude le pre-release).

## Convenzioni
- Unità: millimetri. Asse Z verso l'alto (come le stampanti).
- Ogni operazione produce nuove parti → una voce di undo.
- Commenti in italiano; testi dell'interfaccia scritti in italiano nel codice e tradotti in inglese da `i18n.js` (aggiungere ogni nuovo testo al dizionario `DICT`). Versione in testa a ogni file e nel nome dell'exe.

## Limiti noti della beta
- Giunti automatici solo sui tagli **piani** (piano, multi, auto, linea, pennello). Corda/Banda tagliano "a stampo" lungo la vista senza giunti.
- Il pennello di taglio usa un piano adattato al bordo dell'area dipinta (regolabile col gizmo), non una superficie libera.
- Le operazioni pesanti girano nel thread principale (la finestra resta in attesa durante il calcolo).
- Il gioco nelle booleane usa la somma di Minkowski: lenta su mesh molto grandi.
