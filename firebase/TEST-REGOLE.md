# Prove delle regole Firestore

**Questa checklist è automatizzata** in `tests/regole.test.js` (121 test, stessi codici A1, D1, P1…).
Resta come documentazione e per eventuali verifiche a mano nel Rules Playground.

## Come lanciare i test

Requisiti: Node.js, firebase-tools (`npm i -g firebase-tools`) e **Java 21 o superiore**
(l'emulatore Firestore di firebase-tools 15 non parte con Java 11).

```bash
cd firebase
npm install
# se nel PATH c'è ancora un Java vecchio (bash):
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.12.101-hotspot"
export PATH="$JAVA_HOME/bin:$PATH"
npm run test:rules
```

`test:rules` avvia l'emulatore Firestore con il project id **`demo-shifts`**: con il prefisso
`demo-` l'emulatore non contatta mai il progetto reale. Nessun login né deploy necessari.

## Prove manuali (Rules Playground o app)

Solo dati di prova inventati: medici `medA`, `medB`, `medC`, `medD` (attivi), `medX` (`attivo: false`).
Ogni medico con principale ha `principaleUid` (medA → `uidPrincA`, medB → `uidDeleg`, medC → `uidPrincC`, medX → `uidInatt`; medD nessuno).
Nel Playground: attivare "Autenticato", impostare l'UID (e per la creazione utente `email` e `email_verified: true` nel token).

## Dati di prova da preparare (dalla console)

| Documento | Contenuto |
|---|---|
| `admins/uidAdmin` | `{}` |
| `users/uidDeleg` | approvato, `medicoId: medB`, `delegato: true`, `principale: true` |
| `users/uidPrincA` | approvato, `medicoId: medA`, `principale: true`, `delegato: false` |
| `users/uidSecA` | approvato, `medicoId: medA`, `principale: false`, `delegato: false` |
| `users/uidPrincC` | approvato, `medicoId: medC`, `principale: true` (estraneo rispetto a medA) |
| `users/uidAttesa` | `stato: attesa`, senza `medicoId` |
| `users/uidDisab` | `stato: disabilitato`, `medicoId: medA` |
| `users/uidInatt` | approvato, `medicoId: medX` (medico non attivo) |
| `turni/medA/mesi/2026-10` | `giorni: {"1": ["M6"]}`, `importId: "imp1"` |
| `cambi/medA/voci/c1` | cambio valido di medA |

Ogni `users` ha anche `email`, `nome`, `creatoIl` (timestamp).

## Checklist (caso → azione → esito atteso)

### Admin (`uidAdmin`)
| # | Azione | Atteso |
|---|---|---|
| A1 | get `admins/uidAdmin` | consentito |
| A2 | get `admins/uidDeleg` | negato |
| A3 | list `users` dove `stato == "attesa"` | consentito |
| A4 | update `users/uidAttesa`: `stato: approvato`, `medicoId: medA` | consentito |
| A5 | update `users/uidPrincA`: `delegato: true` | consentito |
| A6 | update `users/uidAttesa`: `stato: approvato` **senza** `medicoId` | negato |
| A7 | get `turni/medA/mesi/2026-10` | consentito |
| A8 | create `admins/qualcuno` | negato (solo console) |
| A9 | get `cambi/medA/voci/c1` | negato (cambi privati del medico) |

### Delegato (`uidDeleg`, medico medB)
| # | Azione | Atteso |
|---|---|---|
| D1 | list `users` | consentito |
| D2 | update `users/uidAttesa`: approvato + `medicoId: medA` | consentito |
| D3 | update `users/uidPrincA`: `delegato: true` | negato (solo admin) |
| D4 | update `users/uidDeleg` (sé stesso): `stato` o `principale` | negato |
| D5 | update di un altro utente con `delegato: true` | negato |
| D6 | write `turni/medA/mesi/2026-11` valido | consentito |
| D7 | write `medici/medA` valido | consentito |
| D8 | get `cambi/medA/voci/c1` | negato |
| D9 | create `importazioni/i1` con `autoreUid` = proprio uid | consentito; con altro uid: negato |

### Medico principale (`uidPrincA`)
| # | Azione | Atteso |
|---|---|---|
| P1 | get `turni/medA/mesi/2026-10` | consentito |
| P2 | get `turni/medB/mesi/2026-10` | negato |
| P3 | create `cambi/medA/voci/n1` valido (`data`, `slot` 0/1, `codice`, `verso`, `collegaId: medC`, `creatoIl` = ora server) | consentito |
| P4 | come P3 con `collegaId: medA` (sé stesso) | negato |
| P5 | come P3 con `collegaId` inesistente | negato |
| P6 | come P3 con `slot: 2`, oppure `verso: "altro"`, oppure campo extra | negato |
| P7 | create `cambi/medB/voci/n1` | negato |
| P8 | update `users/uidPrincA`: `nome` | consentito |
| P9 | update `users/uidPrincA`: `stato`, `medicoId`, `principale` o `delegato` | negato |
| P10 | write `turni/medA/mesi/2026-10` | negato |
| P11 | list `users` / get `medici/medA` | negato |
| P12 | get `elencoMedici/elenco`, `config/sedi` | consentito |

### Medico secondario (`uidSecA`)
| # | Azione | Atteso |
|---|---|---|
| S1 | get `turni/medA/mesi/2026-10` | consentito |
| S2 | get `cambi/medA/voci/c1` | consentito |
| S3 | create/update/delete `cambi/medA/voci/...` | negato |
| S4 | update `users/uidSecA`: `principale: true` | negato |

### Account in attesa (`uidAttesa`)
| # | Azione | Atteso |
|---|---|---|
| W1 | get `users/uidAttesa` | consentito |
| W2 | update `users/uidAttesa`: `stato: approvato` (autoapprovazione) | negato |
| W3 | update `users/uidAttesa`: `medicoId: medA` | negato |
| W4 | get `turni/medA/...`, `elencoMedici/elenco`, `config/sedi` | negato |

### Primo accesso (nuovo uid `uidNuovo`, token con email)
| # | Azione | Atteso |
|---|---|---|
| N1 | create `users/uidNuovo` con `stato: attesa`, `principale/delegato: false`, email = token, `creatoIl` = ora server | consentito |
| N2 | come N1 con `stato: approvato` | negato |
| N3 | come N1 con `delegato: true` o `principale: true` | negato |
| N4 | come N1 con `medicoId` presente | negato |
| N5 | come N1 con email diversa da quella del token | negato |
| N6 | create `users/altroUid` | negato |

### Disabilitato (`uidDisab`) e medico non attivo (`uidInatt`)
| # | Azione | Atteso |
|---|---|---|
| X1 | get proprio `users/{uid}` | consentito |
| X2 | get `turni/medA/...` (disab) / `turni/medX/...` (inatt) | negato |
| X3 | get `cambi/...`, `elencoMedici/elenco` | negato |
| X4 | update proprio `stato: approvato` | negato |

### Estraneo (`uidPrincC`) e non autenticato
| # | Azione | Atteso |
|---|---|---|
| E1 | get `turni/medA/mesi/2026-10` | negato |
| E2 | get/create `cambi/medA/voci/...` | negato |
| E3 | get `users/uidPrincA` | negato |
| E4 | non autenticato: qualsiasi lettura o scrittura | negato |
| E5 | qualsiasi utente: raccolta non prevista (es. `prova/x`) | negato |

### Unico account principale per medico
| # | Azione | Atteso |
|---|---|---|
| Q1 | admin: `users/uidSecA` → `principale: true` (medA ha già `uidPrincA`) | negato |
| Q2 | batch: `medici/medA.principaleUid = uidSecA` + `uidSecA.principale = true` + `uidPrincA.principale = false` | consentito |
| Q3 | come Q2 ma senza togliere il flag a `uidPrincA` | negato |
| Q4 | solo `medici/medA.principaleUid = uidSecA` | negato |
| Q5 | dopo Q2: `uidPrincA` crea un cambio / `uidSecA` crea un cambio | negato / consentito |
| Q6 | flag `principale` incoerente con `principaleUid` (scritto da console): crea cambio | negato |
| Q7 | delegato, batch: `medici/medD.principaleUid = uidAttesa` + approvazione di `uidAttesa` come principale di medD | consentito |
| Q8 | come Q7 senza aggiornare `medici/medD` | negato |
| Q9 | admin toglie `principale` a `uidPrincA`, poi lui crea un cambio | consentito / negato |
| Q10 | delegato (medico medB) crea e legge i propri cambi | consentito |
