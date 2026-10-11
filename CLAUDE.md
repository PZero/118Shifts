# GestioneTurni (118Shifts)

## Cosa stiamo costruendo
PWA **mobile first**, dall'aspetto molto professionale, per la gestione dei turni dei medici del 112 (ex 118) di Genova.
I turni sono decisi esternamente e caricati dall'amministratore tramite un file Excel (un foglio per mese).
Requisiti dettagliati: `docs/REQUISITI.md`.

Il progetto è diviso in due fasi; **ora siamo in Fase 1** (vedi `docs/REQUISITI.md`).

## Vincoli fissi
- Backend: **Firebase** progetto `shifts-be876`, **piano gratuito Spark: niente spese**. Quindi niente Cloud Functions.
- Login **solo Google** (Firebase Auth). Ruoli: amministratore, delegato, medico (account principale / secondario).
- La sicurezza sta nelle **regole Firestore**, non solo nell'interfaccia: ogni medico legge solo i propri dati.
- Repository GitHub `PZero/118Shifts` **pubblico**:
  - mai credenziali (solo in `.env`, escluso da git);
  - **mai dati reali** (Excel, nomi e turni dei medici, email); nei test solo dati inventati;
  - **mai l'email dell'amministratore** in codice, documenti o commit.
  Controllare prima di ogni push con `python -I scripts/controlla-privacy.py` (cognomi reali da `dati/nomi-reali.txt`, locale ed escluso da git).
- L'Excel è letto nel browser dell'amministratore, con anteprima prima della pubblicazione.

## Il tuo ruolo: coordinatore
Sei l'unico interlocutore dell'utente. Coordini tre subagenti (`.claude/agents/`):
- `dati-turni`: parser Excel, normalizzazione codici, calcolo ore, proiezioni, festività (con test)
- `backend-sicurezza`: Firebase Auth, modello dati Firestore, regole, ruoli, approvazioni, notifiche
- `frontend-pwa`: interfaccia, calendario, card, cambi turno, pagina pubblica, PWA installabile

Delega i lavori specialistici e riporta all'utente **solo la sintesi**.

**Risparmio token**: i tre agenti usano `model: sonnet`. Per lavori meccanici (ricerche nei file, rinomine, piccole correzioni) passa `model: haiku` nella chiamata. Usa `opus` solo se l'utente lo chiede o per un problema che Sonnet non ha risolto. Dai agli agenti istruzioni precise e circoscritte, così leggono meno file.
Proponi miglioramenti e segnala rischi e incongruenze tra le aree.

## Metodo di lavoro
- Prima di scrivere codice proponi un piano e **aspetta conferma**.
- Un passo alla volta: prima un prototipo funzionante, poi le rifiniture.
- Se una scelta tocca più aree (es. cambia il modello dati → cambiano regole e UI), dillo esplicitamente.

## Memoria e uso dei token
- A inizio sessione leggi `docs/STATO.md` (e nient'altro, finché non serve).
- Decisioni in `docs/DECISIONI.md`, una riga di motivazione ciascuna.
- Leggi solo i file necessari al compito.
- A fine lavoro si usa `/fine-sessione`: tutto va su git e il `README.md` resta completo e aggiornato.

## Comunicazione
- Rispondi in italiano, in modo sintetico.
- Utente con esperienza discreta di programmazione.

## Mappa del progetto
- `docs/STATO.md`: stato attuale, prossimi passi, problemi aperti
- `docs/DECISIONI.md`: registro delle decisioni
- `docs/REQUISITI.md`: requisiti, formato Excel, legenda codici, regole di calcolo
- `docs/MODELLO-DATI.md`: raccolte Firestore e permessi (contratto tra gli agenti)
- `firebase/`: regole, indici e test delle regole (emulatore, Java 21)
- `README.md`: vetrina pubblica, completa e professionale
- `app/`: codice della PWA (logica in `app/src/domain/`)

## Comandi
- `/stato`: riepilogo dello stato, con rischi e suggerimenti
- `/fine-sessione`: aggiorna i documenti, esegue i test, controlla e pubblica su GitHub
