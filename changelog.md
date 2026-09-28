# 3D STL Multipart Maker — changelog.md
**Versione corrente: 0.5.0-beta — 2026-09-28 11:36**

## [0.5.0-beta] — 2026-09-28 11:36
### Aggiunto
- **Procedura guidata** (strumento "Guida", attivo all'avvio): 7 passi — Modello, Stampante, Orienta, Metodo, Giunti e taglio, Controllo, Esporta — con pulsanti Indietro/Avanti, scelta del metodo (Automatico consigliato, Griglia, Manuale) e controlli finali (pezzi fuori volume, orientamento, disposizione).
- **Barra dei passi** in alto sulla vista: mostra passo corrente e passi completati (✓); ogni passo è cliccabile.
- Negli strumenti manuali, con la guida attiva, pulsante **"Torna alla guida"**.
- Nuovo giunto **Chiavetta**: linguetta rettangolare lunga lungo l'asse principale della sezione (larghezza, altezza, lunghezza in % della sezione, anche sull'altra metà).
- Nuovo giunto **Coda di rondine**: profilo trapezoidale che attraversa la sezione, sede aperta per l'inserimento a scorrimento (larghezza, altezza, svasatura in gradi).
- **Giunto per ogni taglio**: in Multi-piano, Auto e nella guida ogni taglio (X1, Y1, Z1…) può avere un tipo di giunto diverso.
- Preset stampante "Bambu A1 mini" nella guida.

### Modificato
- Il pannello giunti mostra i parametri di tutti i tipi in uso (generale + singoli tagli).


## [0.4.1-beta] — 2026-09-28 11:20
### Corretto
- Anteprima del link (WhatsApp, Telegram, social) mostrava il vecchio nome: un commento in `index.html` conteneva il vecchio tag del titolo e veniva letto come titolo. Commento riscritto senza tag.
- Il pulsante "⬇ Versione Windows" e il README puntavano a `releases/latest`, che non mostra le pre-release (beta): ora aprono l'elenco delle Release.
- La barra superiore andava a capo nelle finestre strette.
- La vecchia cartella `sorgenti/` finita nel repository viene esclusa (`.gitignore`) e rimossa dal repository dallo script.

### Aggiunto
- Metadati Open Graph/Twitter e descrizione: anteprima con titolo, descrizione e immagine `og.png` (1200×630).


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
