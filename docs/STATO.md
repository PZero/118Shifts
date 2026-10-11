# Stato del progetto

**Ultimo aggiornamento:** 2026-10-11

## Fatto
- Analisi del file Excel di esempio (formato e codici in `REQUISITI.md`).
- Struttura del progetto: CLAUDE.md, docs, agenti, `.gitignore` (esclude `.env` ed Excel).

## In corso: ripartenza da zero
- [x] Vecchio repository eliminato e ricreato vuoto; struttura pubblicata.
- [x] Firestore svuotato, hosting disattivato.
- [ ] Eliminare i 2 vecchi account in Authentication (risultano ancora presenti).
- [x] Login Google abilitato (da verificare al primo accesso).

## Prossimi passi
1. Completare la legenda codici (`C`, `R*`, `at/att`, `E`, …). Sedi: per ora `Sede 1…7`, nomi reali in seguito.
2. Piano tecnico: modello dati Firestore + regole di sicurezza → conferma dell'utente.
3. Prototipo del parser Excel con test su dati inventati.

## Problemi aperti
- **Notifiche senza Cloud Functions** (piano gratuito). Ipotesi da valutare:
  a) solo badge in app per admin e delegati (zero infrastruttura);
  b) GitHub Actions programmata (gratuita) che ogni 10–15 min controlla gli account in attesa e invia push o email.
- **Punto di partenza del ciclo di proiezione** per ogni medico: impostato dall'admin o ricavato dall'ultimo P-M-N reale?
- **Nuovo Excel che contiene già un cambio** registrato dal medico: cosa mostrare.
- Ruolo admin: assegnarlo senza scrivere l'email nel codice (script locale con le credenziali dell'utente).
