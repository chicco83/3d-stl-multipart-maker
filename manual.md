# 3D STL Multipart Maker — Manuale utente
**Versione: 0.4.1-beta — 2026-09-28 11:20**

## 1. Avvio
- Fai doppio clic su `3D-STL-Multipart-Maker_v0.3.0-beta_….exe`. Non serve installare nulla.
- Si apre la finestra del programma (componente Windows WebView2, già presente su Windows 10/11). Chiudendo la finestra il programma termina.
- Se WebView2 mancasse, il programma usa Edge/Chrome in modalità app.
- Tutto resta sul tuo PC: nessun file viene caricato in rete.
- Al primo avvio Windows SmartScreen può avvisare ("app non riconosciuta"): *Ulteriori informazioni → Esegui comunque*.

### Versione web
- Stesse funzioni, nel browser (Chrome o Edge consigliati): `https://<utente>.github.io/3d-stl-multipart-maker/`.
- I modelli restano sul tuo PC: il calcolo avviene nel browser, nulla viene caricato.
- In Firefox/Safari i file esportati finiscono nei Download invece della finestra "Salva con nome".
- Il pulsante **⬇ Versione Windows** in alto apre la pagina delle Release da cui scaricare l'exe portable.

## 2. Interfaccia
| Zona | Contenuto |
|---|---|
| Barra in alto | Apri, Annulla/Ripeti, Inquadra, viste (Iso/Alto/Fronte/Destra), slider **Esplodi**, Stampante, Guida |
| Barra a sinistra | Strumenti (Base, Taglio, Modella, File) |
| Centro | Vista 3D con piano e volume di stampa |
| Destra | Opzioni dello strumento attivo + elenco **Parti** (trascina la barra tra le due sezioni per cambiarne l'altezza; doppio click = ripristina) |
| In basso | Suggerimento dello strumento e statistiche |

**Navigazione:** tasto destro = orbita · centrale = sposta · rotella = zoom. In *Seleziona* anche il sinistro orbita.
**Selezione:** click su una parte (Ctrl/Shift = aggiungi). Gli strumenti lavorano sulle parti selezionate, o su tutte quelle visibili se non c'è selezione.
**Elenco parti:** doppio click sul nome = rinomina · pallino = mostra/nascondi · ⚠ = non entra nel volume di stampa.

## 3. Aprire un modello
Trascina file **STL, 3MF o OBJ** nella finestra, oppure *Apri* (Ctrl+O). Il modello viene centrato e appoggiato sul piano.
Se appare "non è un solido chiuso", usa **Modello › Ripara** prima di tagliare. Per provare senza file: *Modello di prova* (un razzo alto 390 mm, più grande del piatto).

## 4. Strumenti di taglio
Tutti i tagli piani usano le opzioni **Faccia di taglio** e **Giunti** (vedi §5).

| Strumento | Tasto | Uso |
|---|---|---|
| **Piano** | P | Piano arancione con maniglie (W sposta, E ruota). Pulsanti X/Y/Z/Vista, slider posizione, *Inverti lato*, *Centra*. **Taglia** o Invio. |
| **Multi-piano** | M | Numero di tagli su X, Y, Z: si distribuiscono uniformi. Anteprima dei piani. |
| **Auto** | A | Imposta il volume della stampante e il margine: calcola i tagli perché ogni pezzo entri. Lavora parte per parte. |
| **Linea** | L | Trascina una linea sulla vista: diventa un piano perpendicolare allo schermo e si apre *Piano* per rifinire. |
| **Corda** | R | Disegna a mano libera un contorno chiuso: al rilascio la zona interna viene staccata attraverso tutto il modello, lungo la vista. |
| **Banda** | B | Click = aggiungi punto, trascina i punti per spostarli, click sui pallini intermedi = inserisci punto. Invio taglia, Backspace toglie l'ultimo, Esc svuota. |
| **Pennello** | T | Dipingi l'intera zona da staccare (es. un braccio); il pennello segue le facce collegate. Dopo ogni tratto compare il piano proposto, regolabile con le maniglie. *Taglia regione* (con giunti) o *Isola* (senza). `[` `]` dimensione, Alt = cancella. |

## 5. Faccia di taglio e giunti
- **Faccia:** *Piana*, oppure *Innesto rastremato* (tappo a gradini che centra le due metà; altezza regolabile).
- **Giunti:**
  - *Perni* — sporgono da una metà, fori nell'altra. Opzione *Perni sull'altra metà*.
  - *Tenoni* — fori in entrambe le metà + parti "Tenone G…" da stampare a parte (compaiono accanto al modello).
  - *Magneti* — sedi su entrambe le facce (diametro, spessore, gioco).
- **Forma:** tondo, quadro, esagono, rombo · **Quantità:** 0 = automatica in base alla sezione.
- **Raggio, Lunghezza, Profondità** (0 = uguale alla lunghezza), **Tolleranza** (default 0,2 mm).
- **Incidi il numero del giunto:** stesso numero sulle due facce da unire (profondità default 0,6 mm; il trattino sotto indica il verso).

## 6. Modellazione
- **Sposta/Ruota/Scala (G):** gizmo (W/E/R), dimensioni in mm con *Proporzionale*, rotazioni 90°, specchia, *Appoggia sul piano*, *Centra*, **Orientamento migliore** (massimo appoggio, minimi sbalzi), *Appoggia faccia* (clicca la faccia da mettere sul piatto), *Disponi sul piano*.
- **Scolpisci (S):** Leviga, Gonfia (Alt = sgonfia), Appiattisci, Maschera/Togli maschera; dimensione e intensità (40%). *Aumenta dettaglio* suddivide la parte selezionata per una scultura più morbida.
- **Forme (H):** cubo, sfera, cilindro, tubo, cono, anello; bordi vivi/smussati/arrotondati. Con una parte selezionata la forma viene posta sulla sua sommità.
- **Booleane (O):** seleziona A, poi Ctrl+click su B. Unione, Differenza A−B, Intersezione, *Intaglia e mantieni* (sottrae e tiene B). *Gioco* allarga B (lento su mesh grandi).
- **Inlay (I):** seleziona il modello, poi Ctrl+click sulla forma già posizionata dentro la superficie. Crea la sede e la parte inlay. *Fondo piatto* + profondità dall'alto.

## 7. Modello (K)
*Ispeziona* (stato, triangoli, bordi aperti, volume, superficie, pezzi, fori) · *Ripara rapida* · *Ricostruzione volumetrica* (chiude buchi; risoluzione regolabile) · *Riduci dettaglio* (tolleranza, default 0,02 mm) · *Separa pezzi sciolti* · *Unisci* · *Duplica* · *Mostra tutte* · *Elimina* (Canc).

## 8. Esporta (X)
- *Pacchetto ZIP*: STL numerati + 3MF + **guida di montaggio PDF**.
- *3MF unico*, *STL singolo / separati*, *Solo guida PDF*.
- *Disponi ogni parte sul piano* appoggia ogni pezzo a z=0 nei file (la scena non cambia).
- La guida contiene: panoramica numerata, tabella giunti (G1, G2…) con le parti da unire, istruzioni per tipo di giunto, scheda di ogni parte con miniatura e misure.

- Il salvataggio usa la finestra "Salva con nome" di Windows, che ricorda l'ultima cartella.

## 9. Scorciatoie
| Tasto | Azione | Tasto | Azione |
|---|---|---|---|
| Ctrl+Z / Ctrl+Shift+Z | Annulla / Ripeti | Ctrl+O | Apri |
| Ctrl+A | Seleziona tutto | Esc | Deseleziona |
| Canc | Elimina | F | Inquadra |
| `[` `]` | Dimensione pennello | Invio | Esegui taglio |
| V G P M A L R B T S H O I K X | Strumenti | W / E / R | Modalità gizmo |

## 10. Stampante
Pulsante *Stampante*: volume X/Y/Z e margine per il taglio automatico (preset Ender 220, Bambu/Prusa 250, Bambu 256). Le impostazioni vengono ricordate.

## 11. Problemi comuni
- **Finestra non si apre:** serve il runtime Microsoft WebView2 (incluso in Windows 10/11); in mancanza viene usato Edge/Chrome o il browser predefinito.
- **"Non è un solido chiuso":** Modello › Ripara rapida; se non basta, Ricostruzione volumetrica.
- **Operazioni lente:** Modello › Riduci dettaglio prima di tagliare modelli con milioni di triangoli.
- **Giunti non creati:** la sezione di taglio è troppo piccola per il raggio scelto: riduci il raggio o la tolleranza.
