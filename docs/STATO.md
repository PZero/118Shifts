# Stato del progetto

**Ultimo aggiornamento:** 2026-10-11 — Fase 1, prima versione online (https://shifts-be876.web.app)

## Fatto
- Requisiti, modello dati, decisioni (`docs/`).
- **Logica turni** `app/src/domain/`: parser Excel (SheetJS), codici e sedi, anagrafica con alias, ore (solo M/P/N, notte 4+8), cambi, festività, weekend, proiezione P-M-N, reperibilità, avvisi di import. **89 test**.
- **Regole Firestore** `firebase/`: ruoli, approvazione, principale unico, mesi pubblicati, `caricatoIl`, ciclo leggibile dal medico. **95 test** (emulatore, Java 21).
- **Interfaccia** `app/src/` completa e unita in `main`:
  - pagina pubblica, attesa/disabilitato, area medico (calendario in cima su mobile, dettaglio giorno, weekend raggruppati e colorati, ore, reperibilità, cambi, data di caricamento del mese);
  - gestione: account, medici, sedi, **Carica Excel** con mese di partenza (default mese successivo), fogli precedenti ignorati, sostituzione completa del mese, avvisi e avanzamento;
  - demo `/demo` con dati inventati, **solo in sviluppo** (`.claude/launch.json` → server `app`).
- **Deploy** su Firebase: regole, indici, hosting (no-cache per `sw.js`/`index.html`).
- Controllo privacy: ammette solo email con domini riservati (`.invalid`, `.test`, `example.*`).

## Prossimi passi
1. L'utente crea a mano in console `admins/{suo UID}` (l'admin **non è un medico**: vede solo Gestione).
2. Prima prova reale: anagrafica medici, import di un Excel, approvazione di 1–2 medici.
3. Rifiniture dopo le prove; eventuale alleggerimento del bundle (~290 kB gzip) con caricamento per area.

## Problemi aperti
- Significato di `C` (MC/PC/NC), `at/att`, `RE`, `E/e/Ex/EU/A/G/SC/CD/REC`: **tbd**. `RNatt` ecc.: 0 ore, tbd.
- Nomi reali delle sedi: per ora `Sede 1…7`.
- `giornoPrecedente` (colonna B dell'Excel) non viene salvato: la riserva per le notti a cavallo di mese non è usata.
- Mesi oltre 450 operazioni: import diviso in più batch, non atomico (documentato in `MODELLO-DATI.md`).
- Notifiche: per ora solo badge in app (piano gratuito).
- Lint: 2 avvisi `set-state-in-effect` (Medici, Account), non bloccanti.
- Authentication: verificare che i 2 vecchi account siano stati eliminati.

## Note tecniche
- Test regole: serve Java 21 nel PATH (`JAVA_HOME` su `jdk-21`; quello di sistema è Java 11).
- Deploy: `firebase deploy --only firestore,hosting` dalla radice, dopo `npm run build` in `app/` (verificare che la build non fallisca).
