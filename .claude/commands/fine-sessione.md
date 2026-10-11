---
description: Salva lo stato della sessione nei documenti del progetto e pubblica su GitHub
---

Chiudiamo la sessione. Senza rileggere file che non servono:

1. Aggiorna `docs/STATO.md`: data di oggi, fase attuale, cosa è stato fatto in questa sessione, prossimi passi, problemi aperti. **Riscrivi** il file tenendolo sotto le 60 righe: è una fotografia dello stato, non un diario.
2. Aggiungi a `docs/DECISIONI.md` le decisioni prese oggi (data, decisione, una riga di motivazione). Non riscrivere quelle vecchie.
3. Se sono cambiati raccolte, campi o permessi, verifica che `docs/MODELLO-DATI.md` e `firebase/firestore.rules` siano allineati; se è cambiata la legenda dei codici, aggiorna `docs/REQUISITI.md`.
4. Aggiorna `README.md` (vetrina pubblica su GitHub) se sono cambiati stato, funzioni, architettura o istruzioni. Screenshot solo con dati inventati, in `docs/screenshot/`.
5. Se ci sono test (`app/`: `npm test`; `firebase/`: `npm run test:rules`), eseguili e riporta l'esito.
6. **Controllo prima del commit** (repository pubblico): esegui `python -I scripts/controlla-privacy.py` (deve dare 0 problemi) e verifica inoltre: nessuna chiave, token o password; nessun `.env`; nessun file Excel/CSV; **nessun dato reale** (nomi o turni dei medici); **nessuna email dell'amministratore**.
7. Fai un commit con un messaggio che riassume la sessione e fai il push su `origin main`.
8. Rispondimi con 5 righe al massimo: cosa è stato salvato e da dove ripartire la prossima volta.

Dopo questo comando posso chiudere la chat o usare `/clear`.
