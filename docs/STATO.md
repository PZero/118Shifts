# Stato del progetto

**Ultimo aggiornamento:** 2026-10-12 — Fase 1, app online in prova (https://shifts-be876.web.app)

## Fatto
- Requisiti, modello dati, decisioni (`docs/`).
- **Logica turni** `app/src/domain/`: parser Excel, codici e sedi, anagrafica con alias, ore (solo M/P/N, notte 4+8), cambi, festività, weekend, **proiezione ciclo MP-N-smonto-riposo-riposo** (ancora = giorno MP, correggibile a mano), reperibilità, avvisi di import, quadro mensile e "chi è con me", ultimo accesso, **disponibilità colleghi (11 ore di riposo)**. **155 test**.
- **Regole Firestore** `firebase/`: ruoli, approvazione, principale unico, `mesiPubblicati`, `caricatoIl`, `turni/{id}/meta/ciclo`, `users.ultimoAccesso`, `quadro/{aaaa-mm}` (solo account principali e staff). **136 test** (emulatore, Java 21).
- **Interfaccia** online:
  - medico: card **Oggi e domani** e **Chi è di turno con me**; calendario con giorni dei mesi adiacenti; dettaglio giorno, weekend, ore, reperibilità, cambi, condivisione PNG;
  - **Cedi il turno**: sezione "Possono darti il cambio" (solo principali) con i colleghi che hanno 11 ore di riposo prima e dopo (reperibilità = impegno, assenze ignorate); clic = selezione, salvataggio con Conferma; quadri in cache condivisa (`quadriCache.ts`);
  - gestione: account e medici con ultimo accesso, Abilitato/Disabilitato, calendario del medico in sola lettura, sedi, Carica Excel (scrive anche il quadro), Mesi pubblicati;
  - pagina pubblica, demo `/demo` (solo sviluppo).
- **Produzione**: admin creato, primo Excel reale importato, login PWA iPhone funzionante.
- **Feedback**: chat riservate medico ↔ admin per argomento (`feedback/`), delegati esclusi, secondari ammessi, chiudi e cancella da entrambe le parti, badge non lette; sezione Gestione → Feedback (solo admin).
- **Presentazione** in attesa di approvazione (`users.presentazione`), mostrata nella finestra di associazione. Regole e indice pubblicati.
- **Import da screenshot** (Gestione → Carica turni → Da screenshot) e **indisponibilità** (account principali): vedi README. Primo import reale da telefono **riuscito** (modello OCR caricato da `dati/modello-ocr.json`).
- Ultima sessione: barra "Vai all'anteprima" dell'import da screenshot fissa solo quando tutto è confermato (prima copriva righe e celle su telefono); radio di "Approva account" con descrizione a capo; README con due nuovi collage (novità medico e gestione).

## Prossimi passi
1. Provare indisponibilità (Copia/Apri email) e feedback su iPhone.
2. **Reimportare l'Excel** per creare il quadro: attiva "Chi è di turno con me" e "Possono darti il cambio".
3. Provare su iPhone la cessione con suggerimenti (anche a cavallo di mese) e il caricamento dell'Excel dall'app (Excel → Condividi → copia .xlsx).
4. Controllare i medici ancora "Manuale": la data vale come giorno MP.
5. Approvare 1–2 medici e raccogliere riscontri. Idee: export .ics, offline, riepilogo annuale, differenze prima di ripubblicare.

## Problemi aperti
- Significato di `C` (MC/PC/NC), `at/att`, `RE`, `E/e/Ex/EU/A/G/SC/CD/REC`: **tbd**. `RNatt` ecc.: 0 ore, tbd.
- Nomi reali delle sedi: per ora `Sede 1…7`.
- `giornoPrecedente` (colonna B) non salvato.
- Mesi oltre 450 operazioni: import in più batch, non atomico.
- Authentication: secondo account (`UAgEsiNl…`) da verificare/eliminare.
- Quadro = solo Excel: "Chi è con me" e i suggerimenti di cambio ignorano i cambi dei colleghi.
- Suggerimenti e tendina colleghi non in ordine alfabetico (ordine dell'elenco).
- Card con app aperta oltre mezzanotte: dati del giorno prima fino al ricaricamento.
- Feedback: nessun limite al numero di messaggi (niente rate limit senza Cloud Functions); notifica solo con badge in app.
- OCR: '-' su cella rosa letto come vuoto; codici mai visti (`att`, `RN1`) incerti finché non confermati; un solo screenshot per mese; tesseract ~7 MB alla prima lettura dei cognomi. Modello ≤ ~680 esempi (1 MiB).
- Lint: 5 avvisi preesistenti. Bundle ~290 kB gzip. Notifiche: solo badge in app.

## Note tecniche
- Test regole: Java 21 (`JAVA_HOME` su `jdk-21`; quello di sistema è Java 11).
- Deploy hosting: automatico con GitHub Action su push in `main`. Se cambia `.env`, aggiornare i segreti.
- Deploy regole: manuale, `firebase deploy --only firestore` dalla radice, dopo i test.
- Screenshot README: Chrome headless (CDP o `playwright-core` installato nella scratchpad, mai nel progetto) sulla demo locale, 375x812 a 2x, collage a tre telefoni ~2025x1356; solo dati inventati.
- Firestore di produzione da CLI bloccato: le operazioni in console le fa l'utente.
