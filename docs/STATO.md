# Stato del progetto

**Ultimo aggiornamento:** 2026-10-25 — Fase 1, app online in prova (https://shifts-be876.web.app). Fase 2 (pianificazione assistita) solo come indicazione in `docs/REQUISITI.md`.

## Fatto
- Requisiti, modello dati, decisioni (`docs/`).
- **Logica turni** `app/src/domain/`: parser Excel, codici e sedi, alias, ore (notte 4+8), cambi, festività, weekend, proiezione, reperibilità, quadro, disponibilità colleghi, indisponibilità, richiesta di cambio, limite feedback, chi do/chi mi dà il cambio, **riepilogo del giorno** (orari dei cambi, smonto, messaggi positivi), **frasi Siri** con parole chiave. **235 test**.
- **Regole Firestore** `firebase/`: ruoli, approvazione, principale unico, quadro, feedback, OCR, indisponibilità, limite feedback, **`siri/{chiave}`** (get anonimo con chiave segreta, campo `regole`), **`statistiche/{aaaa-mm}`** (contatori anonimi, lettura solo admin). **164 test**. Pubblicate il 2026-10-22 (impronta allineata).
- **Interfaccia** online:
  - medico: **Oggi e domani con riepilogo** («alle 8 darai il cambio a…, alle 20 ti darà il cambio…», smonto anche nei giorni di festa, messaggio positivo casuale in ferie/riposo), Chi è di turno con me, Cosa fa oggi un collega, calendario, ore, reperibilità, cambi, PNG, indisponibilità, feedback, **card Siri e CarPlay**. Card "Chi ti dà il cambio" **tolta** (assorbita dal riepilogo e da Siri);
  - gestione: account, medici, carica Excel/screenshot, sedi, feedback e **Utilizzo** (solo admin: classifica card/azioni, confronto mese precedente); schede su più righe su telefono;
  - pagina pubblica con video e card "Siri e CarPlay".
- **Siri/CarPlay**: Comando rapido unico «Turni 118» (link iCloud in `LINK_COMANDO_SIRI`, verificato: nessuna chiave, domanda di importazione). Domande: dove, sono di turno, chi lavora con me, chi mi darà il cambio, a chi darò il cambio, chi può sostituirmi, cosa posso chiederti. Frasi precalcolate dall'app (apertura, cambi, pubblicazione Excel). Guida `docs/SIRI.md`.
- **Admin anche secondario di un medico**: profilo in `users`, all'ingresso apre "I miei turni"; ultimo accesso registrato.
- **Cambi ricevuti nel quadro** (2026-10-25): "Chi è con me", riepilogo e Siri tolgono chi mi ha ceduto il turno (stessa fascia e sede), così la mia sede non compare tra i colleghi.
- **Guida PDF** rigenerata (2 pagine) con la riga sulle statistiche anonime.

## Prossimi passi
1. Interrompere la condivisione dei link iCloud di prova (tenere solo `d5201cc6…`), in particolare `929d992f…` (conteneva una chiave, già revocata).
2. Far provare Siri a qualche medico (Attiva Siri → Aggiungi il comando → incolla chiave) e raccogliere riscontri.
3. Guardare **Gestione → Utilizzo** dopo qualche settimana per decidere cosa semplificare.
4. Distribuire guida PDF e video; reimportare l'Excel per il quadro se non fatto.
5. Idee: conversazione continua con Siri (solo con un Mac per firmare il comando generato), export .ics, offline, riepilogo annuale.

## Problemi aperti
- Codici `C` (MC/PC/NC), `at/att`, `RE`, `E/e/Ex/EU/A/G/SC/CD/REC`: **tbd**; `RNatt` 0 ore.
- Quadro = Excel + solo i miei turni ricevuti: chi riceve un mio turno ceduto non compare al mio posto; i cambi tra altri colleghi sono ignorati (anche nei suggerimenti di cambio).
- Siri: dopo la pubblicazione dell'Excel le frasi ignorano i cambi del medico finché non riapre l'app; secondari non staff senza nomi dei colleghi; risposta letta ad alta voce solo con «Ehi Siri» e impostazione risposte vocali (da icona solo a schermo); blocco `può ` con spazio finale (non riconosce «…può?» a fine frase).
- Statistiche: le regole non impongono il +1 (un client approvato potrebbe gonfiare un contatore; solo dati statistici).
- Mesi oltre 450 operazioni: import non atomico. `giornoPrecedente` non salvato.
- Authentication: secondo account (`UAgEsiNl…`) da verificare/eliminare.
- Card aperte oltre mezzanotte: dati del giorno prima fino al ricaricamento.
- Feedback: limite su giorno UTC. OCR: '-' su cella rosa letto come vuoto; un solo screenshot per mese.
- Lint: avvisi preesistenti. Bundle ~290 kB gzip.

## Note tecniche
- Java 21: Temurin in `C:\Program Files\Eclipse Adoptium\jdk-21*` (installato il 2026-10-22). In PowerShell impostare `JAVA_HOME` **e** anteporre `$env:JAVA_HOME\bin` al `Path` (altrimenti vince Java 11).
- Deploy regole: `cd firebase; npm run deploy:regole` (test, deploy, impronta); lo lancia l'utente. `node scripts/impronta-regole.mjs verifica` segnala regole non pubblicate. Pubblicare le regole **prima** del push se l'app scrive campi nuovi.
- Deploy hosting: GitHub Action su push in `main`. Prima del push verificare che `npm run build` esca con codice 0.
- Comando rapido: verificarlo scaricando il file dal link (`www.icloud.com/shortcuts/api/records/<id>` → `downloadURL`) e leggendo il plist: niente chiavi, domanda di importazione sul passo 1, ogni «Imposta Voce» collegato al Testo del proprio blocco.
- Guida PDF: Chrome headless `--print-to-pdf` da `docs/guida/guida.html`, controllare 2 pagine.
- Video e screenshot README: strumenti nella scratchpad, mai nel progetto; solo dati inventati.
- Firestore di produzione da CLI bloccato: operazioni in console le fa l'utente.
- PowerShell 5.1: niente `&&`; non usare `Set-Content -Encoding utf8` (BOM).
