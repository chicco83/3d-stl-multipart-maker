# 3D STL Multipart Maker — claude.md
**Versione: 0.7.0-beta — 2026-10-08 12:00**

Istruzioni per chi (persona o AI) lavora su questo progetto.

## Regole obbligatorie
1. **Versioning**: a ogni revisione incrementa la versione (SemVer: `MAJOR.MINOR.PATCH[-beta]`) e aggiornala:
   - in testa a **ogni** file modificato (`Versione: X.Y.Z — AAAA-MM-GG HH:MM`);
   - nella costante `VERSION` di `web/src/main.js`;
   - nel nome dell'eseguibile (lo fa `./build.sh X.Y.Z`, che aggiunge data e ora).
2. Aggiorna sempre i tre documenti:
   - `context.md` — obiettivo, scelte tecniche, architettura, limiti;
   - `changelog.md` — voce nuova con data/ora e modifiche (Aggiunto / Modificato / Corretto);
   - `manual.md` — dalla 0.5.1 rimanda al README: **il manuale utente si aggiorna in `README.md`** (sezione *Manuale*, fino al marcatore `fine-manuale`), che è anche il testo del manuale dentro l'app. Dalla 0.6.1 il README contiene anche la **versione inglese** in coda (tra i marcatori `manual-en-start` / `manual-en-end`): ogni modifica al manuale va fatta in entrambe le lingue.
3. Quando si corregge codice esistente, lasciare la versione precedente **commentata** con la data della modifica, poi il codice nuovo.
4. Spiegazioni sul funzionamento come commenti nelle sezioni del codice (in italiano).

## Nome
Programma: **3D STL Multipart Maker** · repository GitHub: `3d-stl-multipart-maker`.

## Build
```
./build.sh 0.7.0-beta     # richiede Node >= 18 e Go >= 1.22 (opz. rsrc per icona+manifest)
```
Output: `release/3D-STL-Multipart-Maker_v<versione>_<AAAAMMGG-HHMM>.exe`

## Pubblicazione
- Push su `main` → sito GitHub Pages aggiornato (workflow `pages.yml`).
- Nuova versione: aggiornare versione e documenti, commit, poi `git tag vX.Y.Z-beta && git push origin vX.Y.Z-beta` → Release con exe (workflow `release.yml`).
- Primo caricamento da Windows: `pubblica-github.ps1`.
- I workflow si modificano in `_github/workflows/` (la cartella `.github` non è scrivibile dagli strumenti remoti): lo script li copia in `.github/workflows/` prima del commit.

## Attenzione
- **Lingue (dalla 0.6.0):** i testi dell'interfaccia si scrivono in italiano e si aggiunge la traduzione inglese in `web/src/i18n.js` (`DICT` per testi fissi, `PATTERNS` per testi con numeri/nomi). Testi fuori dal DOM (PDF, nomi parti) con `t()`.
- Mai tag HTML dentro i commenti di `<head>` in `index.html`: le anteprime dei link li leggono (es. vecchio `<title>`). Per le versioni precedenti usare una descrizione testuale.

## Struttura
- `web/` frontend (sorgenti in `web/src`, statici in `web/public`, bundle `web/build.mjs`)
- `launcher/` eseguibile Go che incorpora `web/dist`: `main.go` (server + fallback), `native_windows.go` (finestra WebView2, Salva con nome), `app.manifest`
- `icon.ico` icona dell'exe
