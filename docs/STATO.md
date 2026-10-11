# Stato del progetto

**Ultimo aggiornamento:** 2026-10-11 — Fase 1, app online in prova (https://shifts-be876.web.app)

## Fatto
- Requisiti, modello dati, decisioni (`docs/`).
- **Logica turni** `app/src/domain/`: parser Excel, codici e sedi, anagrafica con alias, ore (solo M/P/N, notte 4+8), cambi, festività, weekend, proiezione P-M-N, reperibilità, avvisi di import. **89 test**.
- **Regole Firestore** `firebase/`: ruoli, approvazione, principale unico, `mesiPubblicati`, `caricatoIl`, `turni/{id}/meta/ciclo` leggibile dal medico. **95 test** (emulatore, Java 21).
- **Interfaccia** completa e online:
  - medico: calendario in cima su mobile, dettaglio giorno, weekend raggruppati e colorati, ore, reperibilità, cambi, data di caricamento, **condivisione del mese come immagine PNG** (titolo + griglia, cambi applicati);
  - gestione: account, medici (clic → **calendario del medico in sola lettura**, senza cambi), sedi, **Carica Excel** con mese di partenza (default mese successivo), sostituzione completa del mese, card **Mesi pubblicati**;
  - pagina pubblica con "Accesso per i familiari" (account in sola lettura);
  - demo `/demo` con dati inventati, solo in sviluppo (`.claude/launch.json` → `app`).
- **Produzione**: admin creato (`admins/{uid}`, l'admin non è un medico); primo Excel reale importato dall'utente.
- **Login PWA su iPhone**: `authDomain` = dominio del sito su Firebase Hosting; redirect URI `https://shifts-be876.web.app/__/auth/handler` aggiunto in Google Cloud.
- **README** con screenshot della demo (telefono e computer) in `docs/screenshot/`.

## Prossimi passi
1. Verificare sull'iPhone: login dalla PWA installata e condivisione immagine su WhatsApp.
2. Verificare che la card "Mesi pubblicati" mostri i mesi importati (se vuota, ripetere l'import: è sicuro).
3. Approvare 1–2 medici e raccogliere riscontri.

## Problemi aperti
- Significato di `C` (MC/PC/NC), `at/att`, `RE`, `E/e/Ex/EU/A/G/SC/CD/REC`: **tbd**. `RNatt` ecc.: 0 ore, tbd.
- Nomi reali delle sedi: per ora `Sede 1…7`.
- `giornoPrecedente` (colonna B) non salvato: riserva per le notti a cavallo di mese non usata.
- Mesi oltre 450 operazioni: import in più batch, non atomico (documentato).
- Authentication: c'è un secondo account (`UAgEsiNl…`) da verificare/eliminare.
- Lint: 4 avvisi `set-state-in-effect`, non bloccanti. Bundle ~290 kB gzip.
- Notifiche: solo badge in app (piano gratuito).

## Note tecniche
- Test regole: Java 21 nel PATH (`JAVA_HOME` su `jdk-21`; quello di sistema è Java 11).
- Deploy hosting: automatico con GitHub Action a ogni push su `main` (test + build + deploy; segreti `VITE_FIREBASE_*` e `FIREBASE_SERVICE_ACCOUNT_SHIFTS_BE876`). Se cambia `.env`, aggiornare anche i segreti.
- Deploy regole: manuale, `firebase deploy --only firestore` dalla radice dopo i test sull'emulatore.
- Screenshot README: script CDP in Chrome headless sulla demo locale; solo dati inventati.
- Scrittura/lettura del Firestore di produzione da CLI bloccata dai permessi: le operazioni in console le fa l'utente.
