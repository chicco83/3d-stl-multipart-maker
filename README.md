# 3D STL Multipart Maker
**Versione: 0.4.1-beta — 2026-09-28 11:19**

Divide modelli 3D troppo grandi per la stampante in parti stampabili, con perni, tenoni o sedi per magneti e numerazione dei giunti.
Tutto il calcolo avviene sul tuo computer: nessun modello viene caricato in rete.

## Usala subito
- **Web:** apri la pagina GitHub Pages del repository (Chrome o Edge consigliati).
- **Windows portable:** scarica l'exe dalla pagina [Releases](../../releases) e avvialo con doppio clic (nessuna installazione).

## Funzioni
- Import STL, 3MF, OBJ · export STL, 3MF, ZIP con **guida di montaggio PDF**
- Tagli: piano, multi-piano, **automatico secondo il volume della stampante**, linea, corda, banda elastica, pennello
- Giunti: perni, tenoni sciolti, magneti; innesto rastremato; numeri incisi
- Scultura, forme, booleane, inlay, riparazione mesh, riduzione dettaglio, orientamento migliore

Manuale completo: [manual.md](manual.md) · Note tecniche: [context.md](context.md) · Novità: [changelog.md](changelog.md)

## Compilare
```
./build.sh 0.4.0-beta      # Node >= 18, Go >= 1.22 (opz. rsrc per icona e manifest)
```
Pubblicazione automatica: ogni push su `main` aggiorna il sito (workflow *Pubblica versione web*); ogni tag `v*` crea una Release con l'exe (workflow *Release Windows*).

## Licenze
Codice sotto licenza MIT. Librerie usate: [manifold-3d](https://github.com/elalish/manifold) (Apache-2.0), [three.js](https://threejs.org) (MIT), three-mesh-bvh (MIT), fflate (MIT), jsPDF (MIT), go-webview2 (MIT).
