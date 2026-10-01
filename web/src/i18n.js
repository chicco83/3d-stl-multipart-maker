// =============================================================================
// 3D STL Multipart Maker — i18n.js
// Versione: 0.6.0-beta — 2026-10-01 11:03
// -----------------------------------------------------------------------------
// Interfaccia bilingue Italiano / English.
// L'app genera i testi in italiano; questo modulo li traduce nel DOM in modo
// trasparente:
//  - un MutationObserver intercetta ogni nodo di testo e gli attributi
//    title / placeholder / aria-label aggiunti o modificati;
//  - traduzione per corrispondenza esatta (DICT, testo senza spazi esterni) o
//    con espressioni regolari per i testi con numeri/nomi (PATTERNS);
//  - l'originale italiano è conservato: il cambio lingua è immediato e
//    reversibile senza ricaricare la pagina (il lavoro non si perde);
//  - esclusi i contenuti dell'utente (nomi parti) e il testo del manuale.
// t(str) traduce stringhe fuori dal DOM (PDF, nomi predefiniti delle parti).
// Lingua: preferenza salvata, altrimenti lingua del browser (it -> IT, altro -> EN).
// =============================================================================

// -----------------------------------------------------------------------------
// Dizionario IT -> EN (testi esatti)
// -----------------------------------------------------------------------------
const DICT = {
  // barra superiore e generali
  'Apri': 'Open', 'Annulla': 'Undo', 'Ripeti': 'Redo', 'Apri STL / 3MF / OBJ': 'Open STL / 3MF / OBJ', 'Inquadra tutto': 'Frame all', 'Seleziona tutto': 'Select all',
  'Deseleziona': 'Deselect', 'Chiudi': 'Close', 'Cerca': 'Search', 'Cerca nel manuale…': 'Search the manual…', 'Doppio click per rinominare': 'Double-click to rename',
  'Mostra/nascondi': 'Show/hide', 'Non entra nel volume di stampa': 'Does not fit the build volume', 'Esc': 'Esc', 'Ctrl+Z': 'Ctrl+Z',
  'Trascina per ridimensionare la sezione Parti (doppio click = ripristina)': 'Drag to resize the Parts section (double-click = reset)',
  '↶ Annulla': '↶ Undo', '↷ Ripeti': '↷ Redo', 'Inquadra': 'Frame', 'Iso': 'Iso', 'Alto': 'Top', 'Fronte': 'Front', 'Destra': 'Right',
  'Esplodi': 'Explode', 'Stampante': 'Printer', '? Manuale': '? Manual', 'Manuale': 'Manual', '📖 Manuale': '📖 Manual', '⬇ Versione Windows': '⬇ Windows version',
  'Parti': 'Parts', 'Tutte': 'All', 'Nessuna': 'None', 'Nessuno': 'None', 'Elaborazione…': 'Processing…',
  'Rilascia qui i file STL / 3MF / OBJ': 'Drop STL / 3MF / OBJ files here', 'Trascina un modello qui': 'Drag a model here',
  'STL, 3MF oppure OBJ — oppure premi': 'STL, 3MF or OBJ — or press', 'Tasto destro: orbita · Centrale: sposta · Rotella: zoom': 'Right button: orbit · Middle: pan · Wheel: zoom',
  'Carica modello di prova': 'Load sample model', 'Base': 'Basics', 'Taglio': 'Cut', 'Modella': 'Model', 'File': 'File',
  // nomi strumenti (barra sinistra e titoli)
  'Guida': 'Guide', 'Procedura guidata': 'Guided workflow', 'Seleziona': 'Select', 'Sposta': 'Move', 'Sposta / Ruota / Scala': 'Move / Rotate / Scale',
  'Piano': 'Plane', 'Taglio a piano': 'Plane cut', 'Multi-piano': 'Multi-plane', 'Auto': 'Auto', 'Auto multi-piano': 'Auto multi-plane',
  'Linea': 'Line', 'Taglio a linea': 'Line cut', 'Corda': 'Rope', 'Corda (lazo)': 'Rope (lasso)', 'Banda': 'Band', 'Banda elastica': 'Elastic band',
  'Pennello': 'Brush', 'Pennello di taglio': 'Cut brush', 'Scolpisci': 'Sculpt', 'Forme': 'Shapes', 'Booleane': 'Booleans', 'Inlay': 'Inlay',
  'Modello': 'Model', 'Esporta': 'Export', 'Stampante e preferenze': 'Printer and preferences', 'Guida rapida': 'Quick help',
  // descrizioni strumenti
  'Click su una parte per selezionarla (Ctrl/Shift = aggiungi). Tasto sinistro o destro trascinato = orbita.': 'Click a part to select it (Ctrl/Shift = add). Left or right drag = orbit.',
  'Scegli uno strumento a sinistra. Gli strumenti lavorano sulle parti': 'Choose a tool on the left. Tools work on the',
  'selezionate': 'selected', 'oppure, se nessuna è selezionata, su tutte le parti visibili.': 'parts or, if none is selected, on all visible parts.',
  'Apri file…': 'Open file…', 'Modello di prova': 'Sample model', 'Apri altri file…': 'Open more files…',
  'Trascina le maniglie del gizmo sulle parti selezionate. Oppure usa i comandi numerici qui sotto.': 'Drag the gizmo handles on the selected parts, or use the numeric commands below.',
  'Un taglio dritto. Posiziona il piano con le maniglie (W sposta, E ruota) o con i comandi, poi premi Taglia.': 'A straight cut. Place the plane with the handles (W move, E rotate) or the controls, then press Cut.',
  'Tagli lungo X, Y e Z che si distribuiscono in modo uniforme.': 'Cuts along X, Y and Z, evenly spaced.',
  'Calcola da solo i tagli perché ogni pezzo entri nel volume della tua stampante.': 'Automatically computes the cuts so every piece fits your printer\'s build volume.',
  'Trascina una linea dritta sulla vista: diventa un piano di taglio perpendicolare allo schermo (poi regolabile).': 'Drag a straight line on the view: it becomes a cutting plane perpendicular to the screen (adjustable afterwards).',
  'Tasto sinistro: traccia la linea. Destro: orbita. Al rilascio si apre lo strumento Piano con il piano già posizionato.': 'Left button: draw the line. Right: orbit. On release the Plane tool opens with the plane already placed.',
  'Disegna a mano libera un contorno chiuso attorno alla zona da staccare: il taglio attraversa il modello lungo la vista.': 'Draw a closed freehand outline around the area to detach: the cut goes through the model along the view.',
  'Tasto sinistro: disegna. Al rilascio il contorno si chiude e viene tagliato. Il taglio segue il contorno (cucitura) in profondità.': 'Left button: draw. On release the outline closes and is cut. The cut follows the outline (seam) in depth.',
  'Nota beta: i giunti automatici sono disponibili sui tagli piani.': 'Beta note: automatic joints are available on planar cuts.',
  'Un anello elastico: clicca per aggiungere punti, trascinali per spostarli, clicca sui pallini intermedi per inserirne altri.': 'An elastic loop: click to add points, drag them to move, click the middle dots to insert more.',
  'Dipingi l\'intera sezione da staccare (es. un braccio). Il pennello segue le facce collegate. Il taglio usa un piano adattato al bordo dell\'area dipinta.': 'Paint the whole section to detach (e.g. an arm). The brush follows connected faces. The cut uses a plane fitted to the edge of the painted area.',
  'Leviga, gonfia o appiattisci la superficie. La maschera protegge le zone da non toccare.': 'Smooth, inflate or flatten the surface. The mask protects areas you don\'t want to touch.',
  'Aggiungi forme solide da usare con booleane e inlay. Se una parte è selezionata la forma viene posta sulla sua sommità.': 'Add solid shapes to use with booleans and inlays. If a part is selected the shape is placed on its top.',
  'Seleziona prima la parte principale (A) e poi le altre (B) con Ctrl+click.': 'Select the main part (A) first, then the others (B) with Ctrl+click.',
  'Preme una forma nel modello invece di tagliarlo: crea la sede nel modello e una parte inlay separata (es. loghi in altro colore).': 'Presses a shape into the model instead of cutting it: creates the recess in the model and a separate inlay part (e.g. logos in another colour).',
  'Ispezione, riparazione, riduzione dettaglio, separazione pezzi e gestione parti.': 'Inspection, repair, detail reduction, separating pieces and part management.',
  'Esporta le parti selezionate (o tutte le visibili) per lo slicer, con guida di montaggio.': 'Export the selected parts (or all visible ones) for the slicer, with an assembly guide.',
  'Volume di stampa usato per i controlli e per il taglio automatico.': 'Build volume used for checks and automatic cutting.',
  // campi e pulsanti comuni
  'Taglia': 'Cut', 'Taglia (Invio)': 'Cut (Enter)', 'Orientamento': 'Orientation', 'Posizione': 'Position', 'Vista': 'View', 'Sposta (W)': 'Move (W)', 'Ruota (E)': 'Rotate (E)', 'Scala (R)': 'Scale (R)',
  'Inverti lato': 'Flip side', 'Centra': 'Center', 'Faccia di taglio': 'Cut face', 'Piana': 'Flat', 'Innesto rastremato': 'Tapered plug', 'Altezza innesto': 'Plug height',
  'Giunti': 'Joints', 'Perni': 'Pins', 'Tenoni': 'Dowels', 'Magneti': 'Magnets', 'Chiavetta': 'Key', 'Coda di rondine': 'Dovetail',
  'Linguetta rettangolare lunga su una metà, sede chiusa sull\'altra: allinea bene e regge la flessione.': 'Long rectangular tongue on one half, closed slot on the other: aligns well and resists bending.',
  'Profilo trapezoidale che attraversa la sezione: il pezzo si infila di lato scorrendo e non si sfila tirando.': 'Trapezoidal profile across the section: the piece slides in from the side and cannot be pulled apart.',
  'Perni / Tenoni': 'Pins / Dowels', 'Chiavetta / Coda di rondine': 'Key / Dovetail', 'Comuni': 'Common',
  'Forma': 'Shape', 'Tondo': 'Round', 'Quadro': 'Square', 'Esagono': 'Hexagon', 'Rombo': 'Diamond', 'Quantità': 'Quantity', '0 = auto': '0 = auto',
  'Raggio': 'Radius', 'Lunghezza': 'Length', 'Profondità': 'Depth', 'mm, 0 = auto (lunghezza)': 'mm, 0 = auto (length)', 'Tolleranza': 'Tolerance',
  'Diametro magnete': 'Magnet diameter', 'Spessore magnete': 'Magnet thickness', 'Gioco': 'Clearance', 'Larghezza': 'Width', 'Altezza': 'Height',
  '% della sezione': '% of section', 'Svasatura': 'Flare', 'gradi': 'degrees', 'Parte sporgente sull\'altra metà': 'Protruding part on the other half',
  'Incidi il numero del giunto': 'Engrave the joint number', 'Prof. numero': 'Number depth', 'Giunto per ogni taglio': 'Joint for each cut', 'Come sopra': 'Same as above',
  '"Come sopra" usa il tipo di giunto scelto qui sopra. X = tagli verticali trasversali, Z = tagli orizzontali.': '"Same as above" uses the joint type chosen above. X = vertical transverse cuts, Z = horizontal cuts.',
  'Tagli su X': 'Cuts on X', 'Tagli su Y': 'Cuts on Y', 'Tagli su Z': 'Cuts on Z', 'Volume di stampa': 'Build volume', 'Margine': 'Margin', 'Margine auto': 'Auto margin',
  'Volume X': 'Volume X', 'Volume Y': 'Volume Y', 'Volume Z': 'Volume Z', 'Parti da tagliare:': 'Parts to cut:', '· piani:': '· planes:', '→ circa': '→ about', 'pezzi': 'pieces',
  'Tutte le parti entrano già nel volume di stampa ✓': 'All parts already fit the build volume ✓',
  // banda / pennello / scultura
  'Punti:': 'Points:', 'Invio': 'Enter', 'taglia ·': 'cut ·', 'toglie l\'ultimo ·': 'removes the last ·', 'svuota.': 'clears.', 'Svuota': 'Clear',
  'Dimensione': 'Size', 'Dipingi': 'Paint', 'Cancella': 'Erase', 'Alt = inverti ·': 'Alt = invert ·', 'dimensione': 'size', 'Pulisci': 'Clear',
  'Dopo ogni tratto compare il piano di taglio proposto: puoi regolarlo con le maniglie (': 'After each stroke the proposed cutting plane appears: you can adjust it with the handles (',
  'Ruota': 'Rotate', 'Taglia regione': 'Cut region', 'Isola (senza giunti)': 'Isolate (no joints)',
  'Leviga': 'Smooth', 'Gonfia': 'Inflate', 'Appiattisci': 'Flatten', 'Maschera': 'Mask', 'Togli maschera': 'Unmask', 'Intensità': 'Strength',
  'Alt = effetto inverso (es. sgonfia).': 'Alt = reverse effect (e.g. deflate).', 'dimensione. Ogni tratto è annullabile con Ctrl+Z.': 'size. Each stroke can be undone with Ctrl+Z.',
  'Pulisci maschera': 'Clear mask', 'Aumenta dettaglio': 'Increase detail',
  '"Aumenta dettaglio" suddivide i triangoli della parte selezionata (lato max ≈ ¼ del pennello) per scolpire in modo più morbido.': '"Increase detail" subdivides the triangles of the selected part (max edge ≈ ¼ of the brush) for smoother sculpting.',
  // sposta
  'Seleziona una o più parti.': 'Select one or more parts.', 'Dimensioni': 'Dimensions', 'Proporzionale': 'Proportional', 'Applica dimensioni': 'Apply dimensions', 'Scala %…': 'Scale %…',
  'Rotazione rapida 90°': 'Quick 90° rotation', 'Specchia X': 'Mirror X', 'Specchia Y': 'Mirror Y', 'Appoggio e orientamento': 'Placement and orientation',
  'Appoggia sul piano': 'Drop to bed', 'Orientamento migliore': 'Best orientation', 'Appoggia faccia': 'Lay face flat', 'Clicca una faccia…': 'Click a face…', 'Disponi sul piano': 'Arrange on bed',
  // forme
  'Cubo': 'Cube', 'Sfera': 'Sphere', 'Cilindro': 'Cylinder', 'Tubo': 'Tube', 'Cono': 'Cone', 'Anello': 'Ring', 'Diametro': 'Diameter', 'Diam. esterno': 'Outer diam.',
  'Diam. interno': 'Inner diam.', 'Diam. base': 'Base diam.', 'Diam. cima': 'Top diam.', 'Diam. anello': 'Ring diam.', 'Spessore': 'Thickness',
  'Vivi': 'Sharp', 'Smussati': 'Chamfered', 'Arrotondati': 'Rounded', 'Raggio bordo': 'Edge radius', 'Aggiungi forma': 'Add shape',
  // booleane / inlay
  'A:': 'A:', 'B:': 'B:', 'mm (solo differenza/intaglio; lento su mesh grandi)': 'mm (difference/carve only; slow on large meshes)',
  'Unione': 'Union', 'Differenza A−B': 'Difference A−B', 'Intersezione': 'Intersection', 'Intaglia e mantieni': 'Carve and keep',
  'Modello:': 'Model:', 'Forma:': 'Shape:', 'Seleziona il modello, poi Ctrl+click sulla forma (posizionata dentro la superficie con Sposta).': 'Select the model, then Ctrl+click the shape (placed inside the surface with Move).',
  'Fondo piatto': 'Flat floor', 'mm dall\'alto': 'mm from the top', 'Applica inlay': 'Apply inlay',
  // modello
  'Ispeziona': 'Inspect', 'Seleziona una parte per vederne le statistiche.': 'Select a part to see its statistics.', 'Stato': 'Status', 'Solido chiuso ✓': 'Closed solid ✓',
  'Triangoli': 'Triangles', 'Vertici': 'Vertices', 'Bordi aperti': 'Open edges', 'Bordi non-manifold': 'Non-manifold edges', 'Volume': 'Volume', 'Superficie': 'Surface area',
  'Pezzi separati': 'Separate pieces', 'Genere (fori)': 'Genus (holes)', 'Ripara': 'Repair', 'Ripara rapida': 'Quick repair', 'Risoluzione': 'Resolution', 'celle sul lato lungo': 'cells on the long side',
  'Ricostruzione volumetrica': 'Volumetric rebuild', 'La ricostruzione chiude buchi e auto-intersezioni ma arrotonda i dettagli più piccoli di una cella.': 'The rebuild closes holes and self-intersections but rounds off details smaller than a cell.',
  'Riduci dettaglio': 'Reduce detail', 'Separa pezzi sciolti': 'Separate loose pieces', 'Unisci selezionate': 'Merge selected', 'Duplica': 'Duplicate', 'Mostra tutte': 'Show all', 'Elimina': 'Delete',
  // esporta
  'Parti da esportare:': 'Parts to export:', '(selezionate)': '(selected)', '(tutte le visibili)': '(all visible)', 'Disponi ogni parte sul piano (z=0) nel file': 'Place every part on the bed (z=0) in the file',
  'Pacchetto ZIP: STL + 3MF + guida PDF': 'ZIP package: STL + 3MF + PDF guide', '3MF unico (tutte le parti)': 'Single 3MF (all parts)', 'STL singolo': 'Single STL', 'STL separati (ZIP)': 'Separate STLs (ZIP)',
  'Solo guida di montaggio PDF': 'Assembly guide PDF only', 'I file vengono salvati con la finestra "Salva con nome" di Windows.': 'Files are saved with the Windows "Save as" dialog.',
  // impostazioni / aiuto
  'Bambu/Prusa 250': 'Bambu/Prusa 250', 'Ender 220': 'Ender 220', 'Bambu X1/P1 256': 'Bambu X1/P1 256', '📖 Apri il manuale completo (F1)': '📖 Open the full manual (F1)',
  // procedura guidata
  'Metodo': 'Method', 'Orienta': 'Orient', 'Giunti e taglio': 'Joints & cut', 'Controllo': 'Check',
  'Carica il modello da dividere': 'Load the model to split', 'Volume di stampa della tua stampante': 'Your printer\'s build volume', 'Posizione e scala (facoltativo)': 'Position and scale (optional)',
  'Come tagliare il modello': 'How to cut the model', 'Scegli i giunti ed esegui il taglio': 'Choose the joints and cut', 'Verifica i pezzi prima di esportare': 'Check the pieces before exporting', 'Salva i file per lo slicer': 'Save the files for the slicer',
  'Trascina un file': 'Drag a', 'STL, 3MF o OBJ': 'STL, 3MF or OBJ file', 'nella finestra oppure:': 'into the window or:', 'Modello caricato:': 'Model loaded:', 'parte, ingombro': 'part, size', 'parti, ingombro': 'parts, size',
  'Puoi aggiungere altri file con Apri o trascinandoli nella finestra.': 'You can add more files with Open or by dragging them into the window.',
  'Imposta il volume di stampa: i pezzi verranno tagliati per starci dentro.': 'Set the build volume: the pieces will be cut to fit inside it.',
  'entra già nel volume ✓ (puoi comunque dividerlo)': 'already fits the volume ✓ (you can still split it)', 'più grande del volume: va diviso': 'larger than the volume: it must be split',
  'Facoltativo: ruotare o scalare il modello prima di tagliarlo può ridurre il numero di pezzi.': 'Optional: rotating or scaling the model before cutting can reduce the number of pieces.',
  'Ruota 90° X': 'Rotate 90° X', 'Ruota 90° Y': 'Rotate 90° Y', 'Ruota 90° Z': 'Rotate 90° Z',
  'Per spostare o ruotare a mano usa lo strumento': 'To move or rotate by hand use the', ', poi torna qui.': 'tool, then come back here.', 'Sposta (G)': 'Move (G)',
  'Come vuoi dividere il modello?': 'How do you want to split the model?', 'Automatico': 'Automatic', 'consigliato': 'recommended',
  'Calcola i tagli perché ogni pezzo entri nella stampante.': 'Computes the cuts so every piece fits the printer.', 'Griglia (multi-piano)': 'Grid (multi-plane)',
  'Scegli tu quanti tagli su X, Y e Z, equidistanti.': 'You choose how many cuts on X, Y and Z, evenly spaced.',
  'Taglio dove vuoi tu: piano, linea, corda, banda o pennello.': 'Cut wherever you want: plane, line, rope, band or brush.',
  'Scegli lo strumento di taglio, esegui il taglio e poi premi': 'Choose the cutting tool, make the cut and then press', 'Torna alla guida': 'Back to the guide',
  'Suggerimento: prima di tagliare imposta i giunti nel pannello dello strumento.': 'Tip: set the joints in the tool panel before cutting.',
  'Piani proposti:': 'Proposed planes:', 'pezzi (in arancione nella vista).': 'pieces (orange in the view).',
  'Il modello entra già nel volume: nessun taglio necessario. Puoi passare al controllo o scegliere il metodo Griglia.': 'The model already fits the volume: no cut needed. Go to the check step or choose the Grid method.',
  'Annulla taglio': 'Undo cut', 'Pezzi:': 'Pieces:', '· giunti:': '· joints:', '. La vista è esplosa per vedere i giunti (slider': '. The view is exploded to show the joints (', 'in alto).': 'slider at the top).',
  'Tutti i pezzi entrano nel volume di stampa ✓': 'All pieces fit the build volume ✓', 'Rifai il taglio': 'Redo the cut', 'Orienta tutti i pezzi per la stampa': 'Orient all pieces for printing',
  'Clicca un pezzo per selezionarlo; con Modello (K) puoi ispezionarlo o ripararlo.': 'Click a piece to select it; with Model (K) you can inspect or repair it.',
  'File salvati ✓ — nella guida PDF trovi l\'ordine di montaggio.': 'Files saved ✓ — the PDF guide contains the assembly order.', '← Indietro': '← Back', 'Avanti →': 'Next →',
  // manuale (finestra)
  '📖 Manuale': '📖 Manual', 'Apri su GitHub': 'Open on GitHub',
  // notifiche ed errori
  'Clicca sulla faccia da appoggiare al piano': 'Click the face to lay on the bed', 'Dipingi prima la regione da staccare': 'Paint the region to detach first', 'Inlay creato': 'Inlay created',
  'Nessun piano di taglio': 'No cutting plane', 'Nessuna parte da tagliare': 'No parts to cut', 'Niente da annullare': 'Nothing to undo', 'Niente da esportare': 'Nothing to export', 'Niente da ripetere': 'Nothing to redo',
  'Parti orientate per la stampa': 'Parts oriented for printing', 'Piano impostato dalla linea: regola se serve e premi Taglia': 'Plane set from the line: adjust it if needed and press Cut',
  'Seleziona almeno 2 parti': 'Select at least 2 parts', 'Seleziona la parte da suddividere': 'Select the part to subdivide', 'Seleziona una parte': 'Select a part', 'Servono almeno 3 punti': 'At least 3 points are needed',
  'Tutte le parti entrano già nel volume di stampa': 'All parts already fit the build volume', 'Nessun pezzo sciolto trovato': 'No loose pieces found', 'Il contorno non attraversa nessuna parte': 'The outline does not cross any part',
  'La banda non attraversa nessuna parte': 'The band does not cross any part', 'Regione staccata': 'Region detached', 'Il piano calcolato non attraversa la parte': 'The computed plane does not cross the part',
  'Il piano non attraversa nessuna parte': 'The plane does not cross any part', '3MF senza file .model': '3MF without a .model file', 'Contorno troppo corto': 'Outline too short',
  'Il risultato è vuoto': 'The result is empty', 'La forma non tocca il modello: spostala dentro la superficie': 'The shape does not touch the model: move it inside the surface',
  'La regione dipinta copre tutta la parte: non c\'è un bordo da tagliare': 'The painted region covers the whole part: there is no edge to cut', 'Nessuna area dipinta': 'No painted area',
  'Risultato troppo pesante: aumenta la dimensione del pennello': 'Result too heavy: increase the brush size', 'Seleziona almeno 2 parti (la prima è quella principale)': 'Select at least 2 parts (the first is the main one)',
  'Seleziona prima il modello e poi la forma (2 parti)': 'Select the model first and then the shape (2 parts)',
  // etichette operazioni (overlay di attesa)
  'Calcolo orientamento': 'Computing orientation', 'Creazione forma': 'Creating shape', 'Creazione modello di prova': 'Creating sample model', 'Esportazione': 'Exporting', 'Importazione': 'Importing',
  'Ispezione': 'Inspecting', 'Operazione booleana': 'Boolean operation', 'Riduzione dettaglio': 'Reducing detail', 'Separazione': 'Separating', 'Suddivisione': 'Subdividing', 'Taglio a banda': 'Band cut',
  'Taglio a corda': 'Rope cut', 'Taglio a pennello': 'Brush cut', 'Isola regione': 'Isolating region', 'Riparazione': 'Repairing',
  // nomi predefiniti delle parti (t())
  'Razzo demo': 'Demo rocket', 'Tenone': 'Dowel', 'copia': 'copy',
};

// -----------------------------------------------------------------------------
// Testi con parti variabili (numeri, nomi): regex -> funzione
// -----------------------------------------------------------------------------
const tr = s => DICT[s] !== undefined ? DICT[s] : s;
const PATTERNS = [
  [/^Passo (\d+) di (\d+) — (.+?)\.?$/, (m, a, b, c) => `Step ${a} of ${b} — ${tr(c)}.`],
  [/^(\d+) parti · ([\d.,]+) triangoli(?: · selezionate: (\d+))?$/, (m, a, b, c) => `${a} parts · ${b} triangles${c ? ` · selected: ${c}` : ''}`],
  [/^↩ Torna alla guida \(passo (\d+): (.+)\)$/, (m, a, b) => `↩ Back to the guide (step ${a}: ${tr(b)})`],
  [/^Taglio ([XYZ]\d+)$/, (m, a) => `Cut ${a}`],
  [/^Totale pezzi per parte: fino a (\d+)$/, (m, a) => `Total pieces per part: up to ${a}`],
  [/^(\d+) pezzi non entrano ancora nel volume: (.*)$/, (m, a, b) => `${a} pieces still don't fit the build volume: ${b}`],
  [/^Importate (\d+) parti$/, (m, a) => `Imported ${a} parts`],
  [/^Tagliate (\d+) parti$/, (m, a) => `Cut ${a} parts`],
  [/^Creati (\d+) pezzi$/, (m, a) => `Created ${a} pieces`],
  [/^Create (\d+) parti(?: \+ (\d+) tenoni)?$/, (m, a, b) => `Created ${a} parts${b ? ` + ${b} dowels` : ''}`],
  [/^Salvato: (.+)$/, (m, a) => `Saved: ${a}`],
  [/^Triangoli: (.+) → (.+)$/, (m, a, b) => `Triangles: ${a} → ${b}`],
  [/^Formato non supportato: (.+)$/, (m, a) => `Unsupported format: ${a}`],
  [/^(.+): nessun triangolo trovato$/, (m, a) => `${a}: no triangles found`],
  [/^"(.+)" non è un solido chiuso: usa Modello › Ripara prima di tagliare\.$/, (m, a) => `"${a}" is not a closed solid: use Model › Repair before cutting.`],
  [/^La parte "(.+)" non è un solido chiuso: usa Modello › Ripara prima di tagliare\.$/, (m, a) => `Part "${a}" is not a closed solid: use Model › Repair before cutting.`],
  [/^"(.+)" ha (.+) M triangoli: valuta Modello › Riduci dettaglio\.$/, (m, a, b) => `"${a}" has ${b} M triangles: consider Model › Reduce detail.`],
  [/^"(.+)": riparazione rapida non riuscita, prova la ricostruzione volumetrica$/, (m, a) => `"${a}": quick repair failed, try the volumetric rebuild`],
  [/^Errore di avvio: (.*)$/, (m, a) => `Startup error: ${a}`],
  [/^Non valido \((.+)\)$/, (m, a) => `Not valid (${a})`],
  [/^Taglio ([XYZ]\d+) (.*)$/, (m, a, b) => `Cut ${a} ${b}`],
  [/^(.+)…$/, (m, a) => DICT[a] !== undefined ? DICT[a] + '…' : null],
  // titoli con tasto rapido: "Nome (X)", "Annulla (Ctrl+Z)"
  [/^(.+?) \(([^()]+)\)$/, (m, a, b) => DICT[a] !== undefined ? `${DICT[a]} (${tr(b)})` : null],
];

// -----------------------------------------------------------------------------
// Stato lingua
// -----------------------------------------------------------------------------
let LANG = 'it';
try { LANG = localStorage.getItem('mse.lang') || ((navigator.language || 'it').toLowerCase().startsWith('it') ? 'it' : 'en'); } catch (e) { LANG = (navigator.language || 'it').toLowerCase().startsWith('it') ? 'it' : 'en'; }
export const getLang = () => LANG;
const listeners = new Set();
export const onLang = fn => listeners.add(fn);

// traduzione di una stringa (testo esatto o modello); null = nessuna traduzione
function translate(s) {
  const trim = s.trim(); if (!trim) return null;
  if (DICT[trim] !== undefined) return s.replace(trim, DICT[trim]);
  for (const [re, fn] of PATTERNS) { const m = trim.match(re); if (m) { const r = fn(...m); if (r !== null && r !== undefined) return s.replace(trim, r); } }
  return null;
}
// API per testi fuori dal DOM
export function t(s) { if (LANG === 'it') return s; const r = translate(s); return r === null ? s : r; }

// -----------------------------------------------------------------------------
// Traduzione del DOM
// -----------------------------------------------------------------------------
const ORIG = new WeakMap();                 // nodo di testo -> {orig, out}
const ATTRS = ['title', 'placeholder', 'aria-label'];
// testi esclusi: manuale (in italiano), nomi delle parti (contenuto dell'utente)
const EXCLUDE = '#manual article, #manual nav, #parts .nm, [data-noi18n], script, style, textarea';
const ATTR_EXCLUDE = '#manual article, [data-noi18n]';
let observer = null, busy = false;

function doText(n) {
  const p = n.parentElement; if (!p || p.closest(EXCLUDE)) return;
  let e = ORIG.get(n);
  if (!e || (n.nodeValue !== e.out && n.nodeValue !== e.orig)) { e = { orig: n.nodeValue, out: null }; ORIG.set(n, e); }
  const want = LANG === 'it' ? e.orig : (translate(e.orig) ?? e.orig);
  e.out = want; if (n.nodeValue !== want) n.nodeValue = want;
}
function doAttrs(el) {
  if (el.closest && el.closest(ATTR_EXCLUDE)) return;
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const key = 'data-i18n-' + a; const cur = el.getAttribute(a);
    let orig = el.getAttribute(key);
    if (orig === null || (cur !== orig && cur !== el.__i18nOut?.[a])) { orig = cur; el.setAttribute(key, orig); }
    const want = LANG === 'it' ? orig : (translate(orig) ?? orig);
    el.__i18nOut = { ...(el.__i18nOut || {}), [a]: want };
    if (cur !== want) el.setAttribute(a, want);
  }
}
function walk(root) {
  if (root.nodeType === 3) { doText(root); return; }
  if (root.nodeType !== 1) return;
  doAttrs(root);
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  while (tw.nextNode()) { const n = tw.currentNode; if (n.nodeType === 3) doText(n); else doAttrs(n); }
}
function apply(root = document.body) {
  busy = true; try { walk(root); } finally { busy = false; }
}

export function initI18n() {
  document.documentElement.lang = LANG;
  apply();
  observer = new MutationObserver(muts => {
    if (busy) return; busy = true;
    try {
      for (const m of muts) {
        if (m.type === 'childList') m.addedNodes.forEach(walk);
        else if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes' && !m.attributeName.startsWith('data-i18n')) doAttrs(m.target);
      }
    } finally { busy = false; }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

// cambio lingua al volo (il lavoro aperto non si perde)
export function setLang(l) {
  LANG = l; try { localStorage.setItem('mse.lang', l); } catch (e) { /* storage non disponibile */ }
  document.documentElement.lang = l;
  apply();
  for (const fn of listeners) fn(l);
}
