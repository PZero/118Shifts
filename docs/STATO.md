# Stato del progetto

**Ultimo aggiornamento:** 2026-10-11 — Fase 1, app online in prova (https://shifts-be876.web.app)

## Fatto
- Requisiti, modello dati, decisioni (`docs/`).
- **Logica turni** `app/src/domain/`: parser Excel, codici e sedi, anagrafica con alias, ore (solo M/P/N, notte 4+8), cambi, festività, weekend, **proiezione ciclo MP-N-smonto-riposo-riposo** (ancora = giorno MP, correggibile a mano), reperibilità, avvisi di import, quadro mensile e "chi è con me", ultimo accesso. **108 test**.
- **Regole Firestore** `firebase/`: ruoli, approvazione, principale unico, `mesiPubblicati`, `caricatoIl`, `turni/{id}/meta/ciclo`, `users.ultimoAccesso` (solo proprio, = ora server), `quadro/{aaaa-mm}` (solo account principali e staff). **102 test** (emulatore, Java 21).
- **Interfaccia** online:
  - medico: card in cima **Oggi e domani** e **Chi è di turno con me** (collassate; la seconda segue il giorno selezionato, senza selezione oggi; solo principali); calendario con **giorni dei mesi adiacenti** attenuati e cliccabili; dettaglio giorno, weekend, ore, reperibilità, cambi, condivisione PNG;
  - gestione: account e medici con **ultimo accesso**, etichette **Abilitato/Disabilitato**, calendario del medico in sola lettura, sedi, Carica Excel (scrive anche il quadro del mese), Mesi pubblicati;
  - pagina pubblica, demo `/demo` (solo sviluppo).
- **Produzione**: admin creato, primo Excel reale importato, login PWA iPhone funzionante.
- `/fine-sessione` dal cloud (web/cellulare): branch + PR invece del push su `main`.
- README con screenshot demo aggiornati (`mobile-oggi.png`, `desktop-medici.png`).

## Prossimi passi
1. **Pubblicare le regole** (`firebase deploy --only firestore`, lo fa l'utente: il deploy da Claude è bloccato). Prima di questo l'import fallisce (scrive `quadro/`).
2. **Reimportare l'Excel** per creare il quadro e attivare "Chi è di turno con me".
3. Controllare i medici con ancora "Manuale": la data ora vale come giorno MP.
4. Verificare su iPhone (dopo riapertura PWA): proiezione MP-N, card, `ultimoAccesso` in `users/`.
5. Approvare 1–2 medici e raccogliere riscontri. Idee in coda: export .ics, offline, riepilogo annuale, differenze prima di ripubblicare.

## Problemi aperti
- Significato di `C` (MC/PC/NC), `at/att`, `RE`, `E/e/Ex/EU/A/G/SC/CD/REC`: **tbd**. `RNatt` ecc.: 0 ore, tbd.
- Nomi reali delle sedi: per ora `Sede 1…7`.
- `giornoPrecedente` (colonna B) non salvato.
- Mesi oltre 450 operazioni: import in più batch, non atomico.
- Authentication: secondo account (`UAgEsiNl…`) da verificare/eliminare.
- "Chi è con me" usa l'Excel: i cambi dei colleghi non compaiono. Chi la legge vede la turnistica completa del mese.
- Card con app aperta oltre mezzanotte: dati del giorno prima fino al ricaricamento.
- Lint: 4 avvisi `set-state-in-effect`. Bundle ~290 kB gzip. Notifiche: solo badge in app.

## Note tecniche
- Test regole: Java 21 (`JAVA_HOME` su `jdk-21`; quello di sistema è Java 11).
- Deploy hosting: automatico con GitHub Action su push in `main`. Se cambia `.env`, aggiornare i segreti.
- Deploy regole: manuale, `firebase deploy --only firestore` dalla radice, dopo i test.
- Screenshot README: script CDP/Chrome headless sulla demo locale (nella scratchpad, non nel repo); solo dati inventati.
- Firestore di produzione da CLI bloccato: le operazioni in console le fa l'utente.
