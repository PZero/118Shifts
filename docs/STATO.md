# Stato del progetto

**Ultimo aggiornamento:** 2026-10-11 — Fase 1, interfaccia in corso

## Fatto
- Analisi dell'Excel; requisiti, modello dati, decisioni (`docs/`).
- Ripartenza da zero: repository e Firebase `shifts-be876` svuotati; cronologia GitHub riscritta (privacy).
- **Logica turni** `app/src/domain/`: parser Excel (SheetJS 0.20.3 da CDN ufficiale), codici e sedi, anagrafica con alias, ore (solo M/P/N, notte 4+8), cambi, festività (+24/6, +4/10 dal 2026), weekend liberi, proiezione P-M-N, contatori reperibilità RM/RP/RN/RG, avvisi di import strutturati. **89 test** (`npm test`).
- **Regole Firestore** `firebase/`: ruoli, approvazione, principale unico (`medici.principaleUid`, batch atomica). **78 test** sull'emulatore (`npm run test:rules`, Java 21, progetto `demo-shifts`).
- Controllo privacy prima del push: `python -I scripts/controlla-privacy.py`.
- Agenti su Sonnet (`.claude/agents/`), comandi `/stato` e `/fine-sessione`.

## In corso: interfaccia (branch `frontend-wip`)
Agente `frontend-pwa` interrotto a metà (per passare a Sonnet). Già scritti in `app/`:
- icone da un unico SVG (`scripts/genera-icone.mjs`, `npm run icone`), manifest/PWA (`vite-plugin-pwa`);
- design system `src/stili/` (token, tema chiaro/scuro, font Inter), componenti `src/ui/`;
- Firebase e sessione (`src/servizi/`, `src/sessione/`), router `wouter`;
- pagine: pubblica, stati (attesa/disabilitato), area medico (calendario, dettaglio giorno, cambi, riepiloghi), gestione (account, medici, sedi).

**Mancano** (la build fallisce per questo):
1. `src/App.tsx` (router e instradamento per ruolo/stato) — importato da `main.tsx`;
2. `src/pagine/gestione/Import.tsx` (import Excel con anteprima e avvisi) — importato da `AreaGestione.tsx`;
3. modalità demo solo sviluppo (`/demo`, dati inventati);
4. verifica nel browser a 375 px e 1280 px, chiaro/scuro; `npm run build` e `npm run lint` verdi.

## Prossimi passi
1. Rilanciare `frontend-pwa` (Sonnet) con compito circoscritto: completare i 4 punti sopra **partendo dai file esistenti**, senza riprogettare.
2. Unire `frontend-wip` in `main`; primo deploy di regole + hosting; creare a mano `admins/{uid}` dopo il primo login.
3. Prove reali con 1–2 medici.

## Problemi aperti
- Significato di `C` (MC/PC/NC), `at/att`, `RE`, `E/e/Ex/EU/A/G/SC/CD/REC`: **tbd**. `RNatt` ecc.: 0 ore, tbd.
- Nomi reali delle sedi: per ora `Sede 1…7`.
- Notifiche: per ora solo badge in app (piano gratuito).
- Authentication: verificare che i 2 vecchi account siano stati eliminati.
