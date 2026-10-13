# Stato del progetto

**Ultimo aggiornamento:** 2026-10-13 — Fase 1, app online in prova (https://shifts-be876.web.app). Fase 2 (pianificazione assistita) solo come indicazione in `docs/REQUISITI.md`.

## Fatto
- Requisiti, modello dati, decisioni (`docs/`).
- **Logica turni** `app/src/domain/`: parser Excel, codici e sedi, anagrafica con alias, ore (solo M/P/N, notte 4+8), cambi, festività, weekend, proiezione MP-N-smonto-riposo-riposo, reperibilità, avvisi di import, quadro mensile, disponibilità colleghi (11 ore), mesi ammessi per le indisponibilità, testo della richiesta di cambio. **162 test**.
- **Regole Firestore** `firebase/`: ruoli, approvazione, principale unico, mesi pubblicati, ciclo, ultimo accesso, quadro, feedback, presentazione, `ocrModello`, indisponibilità (mese futuro senza turni pubblicati del medico, fino a +12). **137 test** (emulatore, Java 21).
- **Interfaccia** online:
  - medico: Oggi e domani, Chi è di turno con me, calendario con mesi adiacenti, weekend, ore, reperibilità, cambi, condivisione PNG, indisponibilità con email, feedback;
  - **Cedi il turno**: "Possono darti il cambio" e **Chiedi il cambio** (messaggio modificabile, Condividi via Web Share / Copia testo; registrazione sempre con Conferma cambio);
  - gestione: account (con presentazione), medici, calendario del medico, Carica Excel o **screenshot** (OCR nel browser; barra anteprima fissa solo a controllo completato), mesi pubblicati, feedback (solo admin);
  - pagina pubblica, demo `/demo` (solo sviluppo).
- **Produzione**: admin, primo Excel reale, login PWA su iPhone, primo import da screenshot riuscito (modello OCR caricato).
- **Guida PDF per i medici** `docs/Guida-GestioneTurni.pdf` (2 pagine, QR alla pagina pubblica, "chi vede cosa"; sorgente `docs/guida/guida.html`, generata con Chrome headless dalla scratchpad).
- **Feedback: max 3 messaggi al giorno** per account (contatore `limiteFeedback/{uid}`, imposto dalle regole; frase con i restanti nella pagina).
- **README**: link alla guida, panoramica estesa, collage delle novità (medico e gestione), Fase 2 in roadmap.

## Prossimi passi
1. **Pubblicare le regole PRIMA del push**: `npm run deploy:regole` in `firebase/` (test + deploy + impronta). Il frontend nuovo scrive `limiteFeedback`: con le regole vecchie il feedback fallisce; senza, anche le indisponibilità da dicembre vengono rifiutate. Poi committare `firebase/regole-pubblicate.sha256` e fare push.
2. Provare su iPhone: **Condividi** di "Chiedi il cambio" (non verificabile nel browser di sviluppo), indisponibilità (Copia/Apri email), feedback.
3. **Reimportare l'Excel** per creare il quadro: attiva "Chi è di turno con me" e "Possono darti il cambio".
4. Provare la cessione con suggerimenti a cavallo di mese e il caricamento dell'Excel dall'app.
5. Controllare i medici ancora "Manuale": la data vale come giorno MP.
6. Approvare 1–2 medici e raccogliere riscontri. Idee: export .ics, offline, riepilogo annuale, differenze prima di ripubblicare.

## Problemi aperti
- Significato di `C` (MC/PC/NC), `at/att`, `RE`, `E/e/Ex/EU/A/G/SC/CD/REC`: **tbd**. `RNatt` ecc.: 0 ore, tbd.
- Nomi reali delle sedi: per ora `Sede 1…7`.
- `giornoPrecedente` (colonna B) non salvato.
- Mesi oltre 450 operazioni: import in più batch, non atomico.
- Authentication: secondo account (`UAgEsiNl…`) da verificare/eliminare.
- Quadro = solo Excel: "Chi è con me" e i suggerimenti di cambio ignorano i cambi dei colleghi.
- Suggerimenti e tendina colleghi non in ordine alfabetico.
- Messaggio di cambio: saluto con il nome completo dell'anagrafica (manca un campo cognome).
- Indisponibilità: un medico assente da un mese pubblicato può ancora modificarlo (innocuo).
- Card con app aperta oltre mezzanotte: dati del giorno prima fino al ricaricamento.
- Feedback: limite 3/giorno su giorno UTC (si azzera all'1/2 di notte italiane); notifiche solo con badge in app.
- OCR: '-' su cella rosa letto come vuoto; codici mai visti incerti finché non confermati; un solo screenshot per mese; tesseract ~7 MB alla prima lettura. Modello ≤ ~680 esempi (1 MiB).
- Lint: avvisi preesistenti. Bundle ~290 kB gzip.

## Note tecniche
- Test regole: Java 21 (`JAVA_HOME` su `jdk-21`; quello di sistema è Java 11).
- Deploy hosting: automatico con GitHub Action su push in `main`. Se cambia `.env`, aggiornare i segreti.
- Deploy regole: `npm run deploy:regole` in `firebase/` (test, deploy, poi impronta in `firebase/regole-pubblicate.sha256`); `node scripts/impronta-regole.mjs verifica` segnala regole modificate e non pubblicate.
- Screenshot README: Chrome headless (`playwright-core` nella scratchpad, mai nel progetto) sulla demo locale, 375x812 a 2x, collage a tre telefoni ~2025x1356; solo dati inventati.
- Firestore di produzione da CLI bloccato: le operazioni in console le fa l'utente.
- Su Windows PowerShell 5.1 non usare `Set-Content -Encoding utf8` sui documenti (aggiunge il BOM).
