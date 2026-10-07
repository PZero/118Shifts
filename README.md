# Turni 118 EMS - Progressive Web App (PWA)

Applicazione web progressiva (PWA) moderna, ad alte prestazioni e ottimizzata per dispositivi mobili (iOS / iPhone) e desktop, per il monitoraggio e la gestione dei turni dei medici del **118 Emergenza Sanitaria Territoriale**.

**Versione Corrente**: `V1.0.0.0`

---

## 🚑 Funzionalità Principali

1. **Autenticazione Google & Flusso di Approvazione**:
   - Accesso con un click tramite account Google/Gmail.
   - Super Amministratore predefinito: `fnicora@gmail.com`.
   - Schermata "In Attesa di Approvazione" per i nuovi accessi con autorizzazione selettiva.
   - Delega permessi: l'amministratore può abilitare altri colleghi come approvatori.

2. **Caricamento & Parser Multi-foglio Excel**:
   - Supporto per file Excel (.xlsx) strutturati con un foglio per ogni mese.
   - Gestione delle 2 righe per medico per ogni mese.
   - Riconoscimento automatico turni:
     - **M**: Mattino (08:00 - 14:00, 6h)
     - **P**: Pomeriggio (14:00 - 20:00, 6h)
     - **N**: Notte (20:00 - 08:00, 12h)
     - **RG / RN**: Reperibilità Giorno / Notte
     - **e / Re**: Elicottero 118
     - **F / f**: Ferie e permessi
     - **C**: Corsi di formazione
   - Il caricamento da parte di qualsiasi medico autorizzato aggiorna il calendario per tutti i colleghi.

3. **Card Festività & Domeniche Libere**:
   - Conteggio automatico di tutte le festività nazionali italiane e domeniche del mese in cui il medico **non lavora**.

4. **Calendario Mensile Professionale & Minimal**:
   - Griglia reattiva con evidenziazione grafica festività e domeniche.
   - Dettaglio turno con orari e colleghi in servizio nella stessa giornata.
   - Navigatore per mesi e statistiche complessive ore e turni.

5. **PWA & Aggiornamento Cache Immediato**:
   - Service Worker Workbox con `skipWaiting: true` e `clientsClaim: true`.
   - Nessun blocco da cache obsoleta su Safari/iOS o Chrome.
   - Versionamento semantico visibile in ogni schermata (`V1.0.0.0`).

---

## 🛠️ Come Configurare Firebase (`118shifts`)

1. Apri la [Firebase Console](https://console.firebase.google.com/) e seleziona il progetto **118shifts**.
2. Abilita **Authentication** con provider **Google**.
3. Abilita **Cloud Firestore** in modalità test/produzione.
4. Nelle **Impostazioni Progetto** (icona ingranaggio) → **Generale**, aggiungi un'app Web (`</>`) e copia le variabili nel file `.env`:
   ```env
   VITE_FIREBASE_API_KEY=tuo_api_key
   VITE_FIREBASE_AUTH_DOMAIN=118shifts.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=118shifts
   VITE_FIREBASE_STORAGE_BUCKET=118shifts.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=tuo_sender_id
   VITE_FIREBASE_APP_ID=tuo_app_id
   ```
5. In alternativa, puoi inserire le credenziali direttamente dall'app cliccando su **"Firebase / Demo"** nell'interfaccia.

---

## 🚀 Sviluppo in Locale

```bash
npm install
npm run dev
```

Per il build di produzione e generazione PWA:
```bash
npm run build
```
