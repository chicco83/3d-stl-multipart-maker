# 3D STL Multipart Maker — changelog.md
**Versione corrente: 0.4.0-beta — 2026-09-28 10:34**

## [0.4.0-beta] — 2026-09-28 10:34
### Aggiunto
- **Versione web** pubblicabile su GitHub Pages (stesso codice dell'exe, tutto calcolato nel browser).
- Pulsante **"⬇ Versione Windows"** nella barra in alto, visibile solo sul web, che porta all'ultima Release.
- Repository GitHub `3d-stl-multipart-maker`: `README.md`, licenza MIT, `.gitignore`.
- Workflow **Pubblica versione web** (`.github/workflows/pages.yml`): a ogni push su `main` compila e pubblica il sito.
- Workflow **Release Windows** (`.github/workflows/release.yml`): a ogni tag `v*` compila l'exe e crea la Release (pre-release per le beta).
- Script **`pubblica-github.ps1`**: installa Git/GitHub CLI se mancano, login, crea il repo, attiva Pages, crea il tag della release.

### Modificato
- Il segnale di vita verso il launcher (`/api/ping`) viene inviato solo quando l'app è servita in locale.
- `web/package.json`: nome, versione, licenza, script `build`.


## [0.3.0-beta] — 2026-09-28 10:24
### Modificato
- **Nuovo nome del programma: "3D STL Multipart Maker"** (prima "Model Splitter Evo", troppo simile al progetto originale). Aggiornati titolo finestra, intestazione dell'interfaccia, metadati STL/3MF, manifest, modulo Go, commenti e documenti.
- Nome repository GitHub previsto: `3d-stl-multipart-maker`.
- Eseguibile: `3D-STL-Multipart-Maker_v0.3.0-beta_20260928-1024.exe`.
- Dati locali spostati in `%LOCALAPPDATA%\3DSTLMultipartMaker\` (la vecchia cartella `ModelSplitterEvo` si può eliminare).
- **Nuovo modello di prova "Razzo demo"** (alto 390 mm, alette larghe 250 mm) al posto della statuina.


## [0.2.0-beta] — 2026-09-28 10:10
### Modificato
- La finestra non è più un'istanza di Edge in modalità app: l'interfaccia gira in una **finestra nativa** del programma con il componente di sistema **WebView2** (libreria Go `go-webview2`, senza cgo). Nessun processo/profilo Edge separato.
- Titolo finestra con versione, icona dell'exe, barra del titolo scura, dimensione adattata allo schermo (minimo 1000×640), DPI per-monitor (manifest).
- Salvataggio: finestra **"Salva con nome" nativa di Windows** (comdlg32), ricorda l'ultima cartella.
- Dati WebView2 in `%LOCALAPPDATA%\ModelSplitterEvo\webview2`.
- Se il runtime WebView2 non è presente il programma ripiega sulla modalità 0.1.0 (Edge/Chrome `--app`).
- Eseguibile: `ModelSplitterEvo_v0.2.0-beta_20260928-1010.exe`.

### Aggiunto
- **Splitter** tra pannello strumenti e sezione **Parti**: trascinalo per ridimensionare in altezza l'elenco parti (altezza ricordata, doppio click = ripristina).


## [0.1.0-beta] — 2026-09-28 09:58
Prima beta per il test.

### Aggiunto
- Eseguibile Windows portable `ModelSplitterEvo_v0.1.0-beta_20260928-0958.exe` (Go + Edge in modalità app).
- Import STL (ascii/binario), 3MF (oggetti, componenti, trasformazioni), OBJ; trascina e rilascia.
- Vista 3D Z-up con piano/volume di stampa, viste standard, vista esplosa, avviso parti fuori volume.
- Strumenti di taglio: Piano, Multi-piano, Auto multi-piano (per parte, secondo la stampante), Linea, Corda (lazo a mano libera), Banda elastica (punti modificabili), Pennello di taglio (con "Isola").
- Faccia di taglio: piana oppure innesto rastremato a gradini.
- Giunti: perni integrati (anche sull'altra metà), tenoni sciolti (stampati a parte), sedi per magneti; forme tonda/quadra/esagonale/rombo; quantità auto o fissa; raggio, lunghezza, profondità, tolleranza; numerazione incisa (profondità regolabile).
- Scultura: Leviga, Gonfia/Sgonfia, Appiattisci, Maschera, Aumenta dettaglio.
- Forme: cubo, sfera, cilindro, tubo, cono, anello; bordi vivi/smussati/arrotondati.
- Booleane: unione, differenza, intersezione, intaglia e mantieni, con gioco.
- Inlay con fondo piatto, profondità e gioco.
- Modello: ispeziona, ripara rapida, ricostruzione volumetrica, riduci dettaglio, separa pezzi, unisci, duplica, elimina, mostra/nascondi, rinomina.
- Sposta/Ruota/Scala con gizmo, dimensioni numeriche, rotazioni 90°, specchia, appoggia sul piano, appoggia faccia, orientamento migliore, disponi sul piano.
- Export: STL singolo, STL separati (ZIP), 3MF unico, pacchetto ZIP (STL + 3MF + guida PDF), guida di montaggio PDF.
- Annulla/Ripeti (40 livelli), scorciatoie da tastiera, preferenze salvate.
