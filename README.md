# 3D STL Multipart Maker
**Versione: 0.7.0-beta — 2026-10-08 12:00**

🇮🇹 **Italiano** · 🇬🇧 [English](#3d-stl-multipart-maker-english)

![3D STL Multipart Maker](web/public/og.png)

Divide modelli 3D troppo grandi per la stampante in **parti stampabili**, con perni, tenoni, magneti, chiavette o code di rondine, numerazione dei giunti e **guida di montaggio PDF**.
Tutto il calcolo avviene sul tuo computer: nessun modello viene caricato in rete. Gratis e open source.

## Usala subito
- **Web:** [chicco83.github.io/3d-stl-multipart-maker](https://chicco83.github.io/3d-stl-multipart-maker/) — Chrome o Edge consigliati.
- **Windows portable:** scarica l'exe dalla pagina [Releases](https://github.com/chicco83/3d-stl-multipart-maker/releases) e avvialo con doppio clic (nessuna installazione).
- **Manuale dentro l'app:** pulsante **?** in alto a destra oppure tasto **F1**.
- **Lingua / Language:** interfaccia in italiano e in inglese — pulsante **🌐 IT / EN** in alto a destra.

## Funzioni in breve
- Import STL, 3MF, OBJ · export STL, 3MF, ZIP con **guida di montaggio PDF**
- **Procedura guidata** in 7 passi: modello → stampante → orientamento → metodo → giunti e taglio → controllo → esporta
- Tagli: piano, multi-piano, **automatico secondo il volume della stampante**, linea, corda, banda elastica, pennello
- Giunti: perni, tenoni sciolti, magneti, **chiavetta**, **coda di rondine**, innesto rastremato; tipo diverso per ogni taglio; numeri incisi; **gioco regolabile** e perni inclinati
- **Salva/Apri progetto** (`.stlmp`) · Corda e Banda con **4 stili di faccia**, punti fissabili e smussatura
- Scultura, forme, booleane, inlay, riparazione mesh, riduzione dettaglio, orientamento migliore

---

# Manuale

## 1. Avvio
### Versione Windows
- Fai doppio clic su `3D-STL-Multipart-Maker_v…exe`. Non serve installare nulla.
- Si apre la finestra del programma (componente Windows WebView2, già presente su Windows 10/11). Chiudendo la finestra il programma termina.
- Se WebView2 mancasse, il programma usa Edge/Chrome in modalità app.
- Al primo avvio Windows SmartScreen può avvisare ("app non riconosciuta"): *Ulteriori informazioni → Esegui comunque*.

### Versione web
- Stesse funzioni, nel browser: [chicco83.github.io/3d-stl-multipart-maker](https://chicco83.github.io/3d-stl-multipart-maker/).
- I modelli restano sul tuo PC: il calcolo avviene nel browser, nulla viene caricato.
- In Firefox/Safari i file esportati finiscono nei Download invece della finestra "Salva con nome".
- Il pulsante **⬇ Versione Windows** in alto apre la pagina delle Release da cui scaricare l'exe portable.

## 2. Procedura guidata
All'avvio si apre la **Guida**, che accompagna passo passo. La barra in alto sulla vista mostra i 7 passi (✓ = completato); cliccali per spostarti.

1. **Modello** — apri il file o il modello di prova (si passa da soli al passo 2).
2. **Stampante** — volume di stampa e margine (preset rapidi). Vedi subito se il modello entra.
3. **Orienta** — facoltativo: orientamento migliore, rotazioni di 90°, scala.
4. **Metodo** — *Automatico* (consigliato), *Griglia* (numero di tagli per asse) o *Manuale* (Piano, Linea, Corda, Banda, Pennello: al termine premi **Torna alla guida**).
5. **Giunti e taglio** — scegli il tipo di giunto e, se vuoi, un giunto diverso per ogni taglio; premi **Taglia**.
6. **Controllo** — vista esplosa, verifica che tutti i pezzi entrino nel volume, *Orienta tutti i pezzi per la stampa*, *Disponi sul piano*; dal passo 5 puoi annullare il taglio (*Annulla taglio*) e rifarlo.
7. **Esporta** — ZIP con STL, 3MF e guida PDF.

## 3. Interfaccia
| Zona | Contenuto |
|---|---|
| Barra in alto | Apri, **Salva** (progetto), Annulla/Ripeti, Inquadra, viste (Iso/Alto/Fronte/Destra), slider **Esplodi**, Stampante, **?** (manuale), **🌐 IT/EN** (lingua) |
| Barra dei passi | In alto sulla vista: passi della procedura guidata |
| Barra a sinistra | Strumenti (Base, Taglio, Modella, File) |
| Centro | Vista 3D con piano e volume di stampa |
| Destra | Opzioni dello strumento attivo + elenco **Parti** (trascina la barra tra le due sezioni per cambiarne l'altezza; doppio click = ripristina) |
| In basso | Suggerimento dello strumento e statistiche |

- **Navigazione:** tasto destro = orbita · centrale = sposta · rotella = zoom. In *Seleziona* anche il sinistro orbita.
- **Selezione:** click su una parte (Ctrl/Shift = aggiungi); le parti selezionate hanno un contorno azzurro. Gli strumenti lavorano sulle parti selezionate, o su tutte quelle visibili se non c'è selezione.
- **Elenco parti:** doppio click sul nome = rinomina · pallino = mostra/nascondi · ⚠ = non entra nel volume di stampa.

## 4. Aprire un modello
Trascina file **STL, 3MF o OBJ** nella finestra, oppure *Apri* (Ctrl+O). Il modello viene centrato e appoggiato sul piano.

**Progetto (`.stlmp`):** *Salva* (Ctrl+S) registra in un solo file tutte le parti (anche nascoste e tenoni), il registro dei giunti, il volume di stampa e le impostazioni dei giunti. Per riaprirlo usa *Apri* o trascinalo nella finestra: sostituisce le parti attuali (si può annullare con Ctrl+Z).
Se appare "non è un solido chiuso", usa **Modello › Ripara** prima di tagliare. Per provare senza file: *Modello di prova* (un razzo alto 390 mm, più grande del piatto).

## 5. Strumenti di taglio
Tutti i tagli piani usano le opzioni **Faccia di taglio** e **Giunti** (vedi capitolo 6).

| Strumento | Tasto | Uso |
|---|---|---|
| **Piano** | P | Piano arancione con maniglie (W sposta, E ruota). Pulsanti X/Y/Z/Vista, slider posizione, *Inverti lato*, *Centra*. **Taglia** o Invio. |
| **Multi-piano** | M | Numero di tagli su X, Y, Z: si distribuiscono uniformi. Anteprima dei piani. |
| **Auto** | A | Imposta il volume della stampante e il margine: calcola i tagli perché ogni pezzo entri. Lavora parte per parte. |
| **Linea** | L | Trascina una linea sulla vista: diventa un piano perpendicolare allo schermo e si apre *Piano* per rifinire. |
| **Corda** | R | Disegna a mano libera un contorno chiuso: al rilascio la zona interna viene staccata attraverso tutto il modello, lungo la vista. Vale lo stile di faccia scelto (vedi sotto). |
| **Banda** | B | Click = aggiungi punto, trascina i punti per spostarli, click sui pallini intermedi = inserisci punto. **Click su un punto senza trascinare = lo fissa** (pallino pieno); **tasto destro su un punto fissato = lo rilascia**. **Alt** mentre trascini = il punto si posa sulla superficie visibile (fuori dal modello, sul profilo più vicino). *Smussatura* arrotonda la cucitura (i punti fissati restano dove sono); *Ripara bordi che si toccano* risolve incroci e sovrapposizioni del contorno. Invio taglia, Backspace toglie l'ultimo, Esc svuota. |
| **Pennello** | T | Dipingi l'intera zona da staccare (es. un braccio); il pennello segue le facce collegate. Dopo ogni tratto compare il piano proposto, regolabile con le maniglie. *Taglia regione* (con giunti) o *Isola* (senza). `[` `]` dimensione, Alt = cancella. |

**Stile della faccia di taglio per Corda e Banda:**
- *Segue la cucitura* — il taglio segue il contorno disegnato in profondità (prospettiva); nessun giunto automatico.
- *Gradino disegnato* — pareti dritte, parallele alla direzione di vista: la sagoma disegnata resta come gradino; nessun giunto automatico.
- *Piana* — il contorno individua la zona da staccare e il taglio avviene su un piano adattato al contorno (come il Pennello): ammette tutti i giunti.
- *Rastremata* — come *Piana* ma con innesto rastremato.

## 6. Faccia di taglio e giunti
- **Faccia (tagli piani):** *Piana*, oppure *Innesto rastremato* (tappo a gradini che centra le due metà; altezza regolabile).
- **Tipi di giunto:**
  - *Perni* — sporgono da una metà, fori nell'altra.
  - *Tenoni* — fori in entrambe le metà + parti "Tenone G…" da stampare a parte (compaiono accanto al modello).
  - *Magneti* — sedi su entrambe le facce (diametro, spessore, gioco).
  - *Chiavetta* — linguetta rettangolare lunga su una metà e sede sull'altra (larghezza, altezza, lunghezza in % della sezione).
  - *Coda di rondine* — profilo trapezoidale che attraversa la sezione: le metà si infilano scorrendo di lato e non si sfilano tirando (larghezza, altezza, svasatura).
- **Giunto per ogni taglio:** in Multi-piano, Auto e nella guida l'elenco "Giunto per ogni taglio" permette un tipo diverso per ciascun taglio (X1, Y1, Z1…); "Come sopra" usa il tipo generale.
- **Forma** (perni e tenoni): tondo, quadro, esagono, rombo · **Quantità:** 0 = automatica in base alla sezione.
- **Raggio, Lunghezza, Profondità** (0 = uguale alla lunghezza).
- **Inclinazione e direzione** (perni e tenoni): i giunti si inclinano fino a 35° nella direzione scelta (gradi nel piano di taglio); si incastrano in un solo verso e non si sfilano dritti. Con l'inclinazione il giunto si tiene più lontano dal bordo.
- **Gioco di accoppiamento** (tutti i giunti e l'innesto): la stampa non è mai esatta, quindi il foro è più largo del perno. *Gioco laterale* (default 0,2 mm) allarga fori, sedi e fessure; *Gioco in profondità* (default 0,3 mm) rende i fori più profondi e i tenoni più corti. Preset *Stretto* 0,1/0,2 · *Normale* 0,2/0,3 · *Largo* 0,35/0,5 · *Molto largo* 0,5/0,7. Se i pezzi non si infilano alzalo di 0,05–0,1 mm; se ballano abbassalo. I magneti hanno il proprio *Gioco magnete*.
- **Ripristina giunti predefiniti:** riporta tutte le impostazioni dei giunti ai valori iniziali.
- **Parte sporgente sull'altra metà:** inverte il lato di perni e chiavette.
- **Incidi il numero del giunto:** stesso numero sulle due facce da unire (profondità default 0,6 mm; il trattino sotto indica il verso).

## 7. Modellazione
- **Sposta/Ruota/Scala (G):** gizmo (W/E/R), dimensioni in mm con *Proporzionale*, rotazioni 90°, *Scala %…*, specchia, *Appoggia sul piano*, *Centra*, **Orientamento migliore** (massimo appoggio, minimi sbalzi), *Appoggia faccia* (clicca la faccia da mettere sul piatto), *Disponi sul piano*.
- **Scolpisci (S):** Leviga, Gonfia (Alt = sgonfia), Appiattisci, Maschera/Togli maschera; dimensione e intensità (40%). *Aumenta dettaglio* suddivide la parte selezionata per una scultura più morbida.
- **Forme (H):** cubo, sfera, cilindro, tubo, cono, anello; bordi vivi/smussati/arrotondati. Con una parte selezionata la forma viene posta sulla sua sommità.
- **Booleane (O):** seleziona A, poi Ctrl+click su B. Unione, Differenza A−B, Intersezione, *Intaglia e mantieni* (sottrae e tiene B). *Gioco* allarga B (lento su mesh grandi).
- **Inlay (I):** seleziona il modello, poi Ctrl+click sulla forma già posizionata dentro la superficie. Crea la sede e la parte inlay. *Fondo piatto* + profondità dall'alto.

## 8. Modello (K)
*Ispeziona* (stato, triangoli, bordi aperti, volume, superficie, pezzi, fori) · *Ripara rapida* · *Ricostruzione volumetrica* (chiude buchi; risoluzione regolabile) · *Riduci dettaglio* (tolleranza, default 0,02 mm) · *Separa pezzi sciolti* · *Unisci* · *Duplica* · *Mostra tutte* · *Elimina* (Canc).

## 9. Esporta (X)
- *Pacchetto ZIP*: STL numerati + 3MF + **guida di montaggio PDF**.
- *3MF unico*, *STL singolo / separati*, *Solo guida PDF*.
- *Converti in STEP (Mesh2STEP)*: apre [Mesh2STEP](https://chicco83.github.io/mesh2step/) in una nuova finestra e le passa le parti (una parte = STL, più parti = 3MF a più corpi); serve la connessione e il permesso ai popup.
- *Disponi ogni parte sul piano* appoggia ogni pezzo a z=0 nei file (la scena non cambia).
- La guida contiene: panoramica numerata, tabella giunti (G1, G2…) con le parti da unire, istruzioni per tipo di giunto, scheda di ogni parte con miniatura e misure.
- Nella versione Windows il salvataggio usa la finestra "Salva con nome", che ricorda l'ultima cartella.

## 10. Stampante
Pulsante *Stampante* (o passo 2 della guida): volume X/Y/Z e margine per il taglio automatico, con preset (Ender 220, Prusa 250×210, Bambu 256, Bambu A1 mini; il pulsante *Stampante* offre anche Bambu/Prusa 250). Le impostazioni vengono ricordate.

## 11. Scorciatoie
| Tasto | Azione | Tasto | Azione |
|---|---|---|---|
| F1 | Manuale | U | Procedura guidata |
| Ctrl+Z / Ctrl+Shift+Z (o Ctrl+Y) | Annulla / Ripeti | Ctrl+O / Ctrl+S | Apri / Salva progetto |
| Ctrl+A | Seleziona tutto | Esc | Deseleziona / chiudi manuale |
| Canc | Elimina | F | Inquadra |
| `[` `]` | Dimensione pennello | Invio | Esegui taglio |
| V G P M A L R B T S H O I K X | Strumenti | W / E / R | Modalità gizmo |

## 12. Problemi comuni
- **Finestra non si apre:** serve il runtime Microsoft WebView2 (incluso in Windows 10/11); in mancanza viene usato Edge/Chrome o il browser predefinito.
- **"Non è un solido chiuso":** Modello › Ripara rapida; se non basta, Ricostruzione volumetrica.
- **Operazioni lente:** Modello › Riduci dettaglio prima di tagliare modelli con milioni di triangoli.
- **Giunti non creati:** la sezione di taglio è troppo piccola per il giunto scelto: riduci raggio/larghezza o gioco.

<!-- fine-manuale: il testo sotto non viene mostrato nel manuale dentro l'app -->

---

# Per sviluppatori
Note tecniche: [context.md](context.md) · Novità: [changelog.md](changelog.md) · Regole di sviluppo: [claude.md](claude.md)

## Compilare
```
./build.sh 0.7.0-beta      # Node >= 18, Go >= 1.22 (opz. rsrc per icona e manifest)
```
Pubblicazione automatica: ogni push su `main` aggiorna il sito (workflow *Pubblica versione web*); ogni tag `v*` crea una Release con l'exe (workflow *Release Windows*). Primo caricamento da Windows: `pubblica-github.ps1`.

## Licenze
Codice sotto licenza MIT. Librerie usate: [manifold-3d](https://github.com/elalish/manifold) (Apache-2.0), [three.js](https://threejs.org) (MIT), three-mesh-bvh (MIT), fflate (MIT), jsPDF (MIT), marked (MIT), go-webview2 (MIT).

---
---

# 3D STL Multipart Maker (English)
**Version: 0.7.0-beta — 2026-10-08 12:00**

🇮🇹 [Italiano](#3d-stl-multipart-maker) · 🇬🇧 **English**

<!-- manual-en-start: from here to manual-en-end is the in-app manual in English -->

Splits 3D models that are too big for your printer into **printable parts**, with pins, dowels, magnets, keys or dovetails, numbered joints and a **PDF assembly guide**.
All processing happens on your computer: no model is ever uploaded. Free and open source.

## Get started
- **Web:** [chicco83.github.io/3d-stl-multipart-maker](https://chicco83.github.io/3d-stl-multipart-maker/) — Chrome or Edge recommended.
- **Windows portable:** download the exe from the [Releases](https://github.com/chicco83/3d-stl-multipart-maker/releases) page and double-click it (no installation).
- **Manual inside the app:** **? Manual** button at the top right or the **F1** key.
- **Language:** Italian and English interface — **🌐 IT / EN** button at the top right.

## Features at a glance
- Import STL, 3MF, OBJ · export STL, 3MF, ZIP with a **PDF assembly guide**
- **Guided workflow** in 7 steps: model → printer → orientation → method → joints & cut → check → export
- Cuts: plane, multi-plane, **automatic based on the printer's build volume**, line, rope, elastic band, brush
- Joints: pins, loose dowels, magnets, **key**, **dovetail**, tapered plug; a different type for each cut; engraved numbers; **adjustable clearance** and tilted pins
- **Save/Open project** (`.stlmp`) · Rope and Band with **4 cut-face styles**, pinnable points and smoothing
- Sculpting, shapes, booleans, inlays, mesh repair, detail reduction, best orientation

# User manual

## 1. Getting started
### Windows version
- Double-click `3D-STL-Multipart-Maker_v…exe`. Nothing to install.
- The program window opens (Windows WebView2 component, already included in Windows 10/11). Closing the window quits the program.
- If WebView2 is missing, the program uses Edge/Chrome in app mode.
- On first launch Windows SmartScreen may warn ("unrecognized app"): *More info → Run anyway*.

### Web version
- Same features, in the browser: [chicco83.github.io/3d-stl-multipart-maker](https://chicco83.github.io/3d-stl-multipart-maker/).
- Your models stay on your PC: processing happens in the browser, nothing is uploaded.
- In Firefox/Safari exported files go to Downloads instead of a "Save as" dialog.
- The **⬇ Windows version** button at the top opens the Releases page where you can download the portable exe.

## 2. Guided workflow
On startup the **Guide** opens and walks you through the process. The bar at the top of the view shows the 7 steps (✓ = done); click them to jump.

1. **Model** — open your file or the sample model (you move to step 2 automatically).
2. **Printer** — build volume and margin (quick presets). You immediately see whether the model fits.
3. **Orient** — optional: best orientation, 90° rotations, scale.
4. **Method** — *Automatic* (recommended), *Grid* (number of cuts per axis) or *Manual* (Plane, Line, Rope, Band, Brush: when done press **Back to the guide**).
5. **Joints & cut** — choose the joint type and, if you like, a different joint for each cut; press **Cut**.
6. **Check** — exploded view, check that every piece fits the volume, *Orient all pieces for printing*, *Arrange on bed*; from step 5 you can undo the cut (*Undo cut*) and redo it.
7. **Export** — ZIP with STL, 3MF and the PDF guide.

## 3. Interface
| Area | Content |
|---|---|
| Top bar | Open, **Save** (project), Undo/Redo, Frame, views (Iso/Top/Front/Right), **Explode** slider, Printer, **? Manual**, **🌐 IT/EN** (language) |
| Step bar | At the top of the view: steps of the guided workflow |
| Left bar | Tools (Basics, Cut, Model, File) |
| Center | 3D view with bed and build volume |
| Right | Options of the active tool + **Parts** list (drag the bar between the two sections to change its height; double-click = reset) |
| Bottom | Tool hint and statistics |

- **Navigation:** right button = orbit · middle = pan · wheel = zoom. In *Select* the left button orbits too.
- **Selection:** click a part (Ctrl/Shift = add); selected parts get a blue outline. Tools work on the selected parts, or on all visible parts if nothing is selected.
- **Parts list:** double-click the name = rename · dot = show/hide · ⚠ = does not fit the build volume.

## 4. Opening a model
Drag **STL, 3MF or OBJ** files into the window, or use *Open* (Ctrl+O). The model is centered and placed on the bed.

**Project (`.stlmp`):** *Save* (Ctrl+S) stores in a single file all the parts (including hidden ones and dowels), the joint log, the build volume and the joint settings. To reopen it use *Open* or drop it into the window: it replaces the current parts (undo with Ctrl+Z).
If you see "is not a closed solid", use **Model › Repair** before cutting. To try it without a file: *Sample model* (a 390 mm tall rocket, larger than the bed).

## 5. Cutting tools
All planar cuts use the **Cut face** and **Joints** options (see chapter 6).

| Tool | Key | Use |
|---|---|---|
| **Plane** | P | Orange plane with handles (W move, E rotate). X/Y/Z/View buttons, position slider, *Flip side*, *Center*. **Cut** or Enter. |
| **Multi-plane** | M | Number of cuts on X, Y, Z: they are evenly spaced. Planes are previewed. |
| **Auto** | A | Set the printer volume and margin: it computes the cuts so every piece fits. Works part by part. |
| **Line** | L | Drag a line on the view: it becomes a plane perpendicular to the screen and *Plane* opens to fine-tune it. |
| **Rope** | R | Draw a closed freehand outline: on release the inner area is detached through the whole model, along the view. The chosen face style applies (see below). |
| **Band** | B | Click = add point, drag points to move them, click the middle dots = insert a point. **Click a point without dragging = pins it** (solid dot); **right-click a pinned point = releases it**. **Alt** while dragging = the point is placed on the visible surface (outside the model, on the nearest outline). *Smoothing* rounds the seam (pinned points stay where they are); *Repair touching boundaries* fixes crossings and overlaps of the outline. Enter cuts, Backspace removes the last one, Esc clears. |
| **Brush** | T | Paint the whole area to detach (e.g. an arm); the brush follows connected faces. After each stroke the proposed plane appears and can be adjusted with the handles. *Cut region* (with joints) or *Isolate* (without). `[` `]` size, Alt = erase. |

**Cut-face style for Rope and Band:**
- *Follows the seam* — the cut follows the drawn outline in depth (perspective); no automatic joints.
- *Drawn step* — straight walls parallel to the view direction: the drawn shape stays as a step; no automatic joints.
- *Flat* — the outline selects the area to detach and the cut is made on a plane fitted to the outline (like the Brush): allows all joints.
- *Tapered* — like *Flat* but with a tapered plug.

## 6. Cut face and joints
- **Face (planar cuts):** *Flat*, or *Tapered plug* (stepped plug that centers the two halves; adjustable height).
- **Joint types:**
  - *Pins* — stick out of one half, holes in the other.
  - *Dowels* — holes in both halves + "Dowel G…" parts to print separately (they appear next to the model).
  - *Magnets* — seats on both faces (diameter, thickness, clearance).
  - *Key* — long rectangular tongue on one half and slot on the other (width, height, length as % of the section).
  - *Dovetail* — trapezoidal profile across the section: the halves slide together sideways and cannot be pulled apart (width, height, flare).
- **Joint for each cut:** in Multi-plane, Auto and the guide, the "Joint for each cut" list lets you choose a different type for each cut (X1, Y1, Z1…); "Same as above" uses the general type.
- **Shape** (pins and dowels): round, square, hexagon, diamond · **Quantity:** 0 = automatic based on the section.
- **Radius, Length, Depth** (0 = same as length).
- **Tilt and direction** (pins and dowels): joints lean up to 35° in the chosen direction (degrees in the cut plane); they fit in one direction only and cannot be pulled out straight. With tilt the joint keeps further from the edge.
- **Fit clearance** (all joints and the plug): printing is never exact, so the hole is wider than the pin. *Side clearance* (default 0.2 mm) widens holes, seats and slots; *Depth clearance* (default 0.3 mm) makes holes deeper and dowels shorter. Presets *Tight* 0.1/0.2 · *Normal* 0.2/0.3 · *Loose* 0.35/0.5 · *Very loose* 0.5/0.7. If the pieces do not go together raise it by 0.05–0.1 mm; if they wobble lower it. Magnets have their own *Magnet clearance*.
- **Reset joints to defaults:** restores all joint settings to their initial values.
- **Protruding part on the other half:** swaps the side of pins and keys.
- **Engrave the joint number:** same number on the two faces to join (default depth 0.6 mm; the underline shows the reading direction).

## 7. Modelling
- **Move/Rotate/Scale (G):** gizmo (W/E/R), dimensions in mm with *Proportional*, 90° rotations, *Scale %…*, mirror, *Drop to bed*, *Center*, **Best orientation** (largest contact, fewest overhangs), *Lay face flat* (click the face to put on the bed), *Arrange on bed*.
- **Sculpt (S):** Smooth, Inflate (Alt = deflate), Flatten, Mask/Unmask; size and strength (40%). *Increase detail* subdivides the selected part for smoother sculpting.
- **Shapes (H):** cube, sphere, cylinder, tube, cone, ring; sharp/chamfered/rounded edges. With a part selected, the shape is placed on its top.
- **Booleans (O):** select A, then Ctrl+click B. Union, Difference A−B, Intersection, *Carve and keep* (subtracts and keeps B). *Clearance* enlarges B (slow on large meshes).
- **Inlay (I):** select the model, then Ctrl+click the shape already placed inside the surface. Creates the recess and the inlay part. *Flat floor* + depth from the top.

## 8. Model (K)
*Inspect* (status, triangles, open edges, volume, surface, pieces, holes) · *Quick repair* · *Volumetric rebuild* (closes holes; adjustable resolution) · *Reduce detail* (tolerance, default 0.02 mm) · *Separate loose pieces* · *Merge* · *Duplicate* · *Show all* · *Delete* (Del).

## 9. Export (X)
- *ZIP package*: numbered STLs + 3MF + **PDF assembly guide**.
- *Single 3MF*, *Single STL / separate STLs*, *Assembly guide PDF only*.
- *Convert to STEP (Mesh2STEP)*: opens [Mesh2STEP](https://chicco83.github.io/mesh2step/) in a new window and sends it the parts (one part = STL, several = multi-body 3MF); needs a connection and popups allowed.
- *Place every part on the bed* puts each piece at z=0 in the files (the scene does not change).
- The guide contains: numbered overview, joint table (G1, G2…) with the parts to join, instructions per joint type, a card for each part with thumbnail and size. It is written in the interface language.
- In the Windows version saving uses the "Save as" dialog, which remembers the last folder.

## 10. Printer
*Printer* button (or step 2 of the guide): X/Y/Z volume and margin for automatic cutting, with presets (Ender 220, Prusa 250×210, Bambu 256, Bambu A1 mini; the *Printer* button also offers Bambu/Prusa 250). Settings are remembered.

## 11. Shortcuts
| Key | Action | Key | Action |
|---|---|---|---|
| F1 | Manual | U | Guided workflow |
| Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y) | Undo / Redo | Ctrl+O / Ctrl+S | Open / Save project |
| Ctrl+A | Select all | Esc | Deselect / close manual |
| Del | Delete | F | Frame |
| `[` `]` | Brush size | Enter | Run the cut |
| V G P M A L R B T S H O I K X | Tools | W / E / R | Gizmo mode |

## 12. Troubleshooting
- **The window does not open:** the Microsoft WebView2 runtime is required (included in Windows 10/11); if missing, Edge/Chrome or the default browser is used.
- **"Is not a closed solid":** Model › Quick repair; if that is not enough, Volumetric rebuild.
- **Slow operations:** Model › Reduce detail before cutting models with millions of triangles.
- **Joints not created:** the cut section is too small for the chosen joint: reduce the radius/width or the clearance.

<!-- manual-en-end -->

## For developers
Technical notes (Italian): [context.md](context.md) · Changes: [changelog.md](changelog.md) · Development rules: [claude.md](claude.md)

```
./build.sh 0.7.0-beta      # Node >= 18, Go >= 1.22 (optional: rsrc for icon and manifest)
```
Automatic publishing: every push to `main` updates the website; every `v*` tag creates a Release with the exe. First upload from Windows: `pubblica-github.ps1`.

**License:** MIT. Libraries: [manifold-3d](https://github.com/elalish/manifold) (Apache-2.0), [three.js](https://threejs.org) (MIT), three-mesh-bvh (MIT), fflate (MIT), jsPDF (MIT), marked (MIT), go-webview2 (MIT).
