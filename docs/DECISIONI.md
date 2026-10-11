# Registro delle decisioni

| Data | Decisione | Motivazione |
|---|---|---|
| 2026-10-11 | PWA Vite + React + TypeScript, mobile first | Ecosistema maturo, ottimo supporto PWA, tipizzazione per il modello dati |
| 2026-10-11 | Firebase progetto `shifts-be876`, piano gratuito Spark | Login Google, database e hosting gratis per ~50 utenti; vincolo: zero spese |
| 2026-10-11 | Niente Cloud Functions | Richiedono il piano Blaze (a pagamento) |
| 2026-10-11 | Excel letto nel browser dell'admin (SheetJS), con anteprima | Nessun server necessario; l'admin controlla prima di pubblicare |
| 2026-10-11 | Ore calcolate dall'app, colonna totale dell'Excel ignorata | Il conteggio deve includere i cambi |
| 2026-10-11 | Notte: 4 h sul giorno D, 8 h sul giorno D+1 | Regola di conteggio indicata dall'utente |
| 2026-10-11 | Proiezione con ciclo P, M, N, smonto, festa (solo P/M/N visibili) | Turnazione standard; i definitivi saranno diversi |
| 2026-10-11 | Cambi privati, salvati su server, visibili a tutti gli account del medico | Devono vederli anche gli account secondari |
| 2026-10-11 | Colleghi dei cambi scelti solo da elenco | Coerenza con l'anagrafica |
| 2026-10-11 | Sedi provvisorie `Sede 1…7`, nomi in una tabella modificabile | I nomi reali non sono ancora noti |
| 2026-10-11 | Festività nazionali + 24 giugno (patrono di Genova) | Richiesta dell'utente |
| 2026-10-11 | Ripartenza da zero: vecchio repository e dati Firebase eliminati | Il vecchio repository pubblico conteneva turni reali con nomi |
| 2026-10-11 | Mai dati reali né email admin nel repository | Repository pubblico; privacy dei medici |
| 2026-10-11 | Import Excel: admin e delegati | Richiesta dell'utente |
| 2026-10-11 | Partenza ciclo proiezione: dall'ultimo P-M-N reale, correggibile a mano | Automatico ma con controllo |
| 2026-10-11 | Admin = documento `admins/{uid}` creato a mano in console | Nessuna email nel codice |
| 2026-10-11 | Notifiche fase 1: badge in app | Gratuito; GitHub Actions eventualmente dopo |
| 2026-10-11 | Test delle regole automatici con emulatore locale (Java 21 installato), project id `demo-*` | Test eseguibili in autonomia senza toccare il progetto reale |
| 2026-10-11 | Admin e delegati non vedono i cambi degli altri medici | I cambi sono privati del medico |
| 2026-10-11 | I delegati li nomina solo l'admin | Evita catene di deleghe non controllate |
| 2026-10-11 | Un solo account principale per medico, garantito anche dalle regole (`medici.principaleUid`) | Solo il principale scrive i cambi: deve essere univoco |
| 2026-10-11 | Contano ore solo i turni M/P/N (anche MC/PC/NC e at/att) | Indicazione dell'utente |
| 2026-10-11 | Reperibilità RM/RP/RN/RG: contatore di giorni per tipo, 0 ore | Interessa la frequenza, non le ore |
| 2026-10-11 | Codici di significato ignoto: "tbd"; non riconosciuti: "da controllare" negli avvisi di import | Si completano quando l'utente avrà la legenda |
| 2026-10-11 | 4 ottobre (San Francesco) festivo dal 2026 | Festa nazionale reintrodotta nel 2025 |
| 2026-10-11 | Interfaccia professionale mobile first ma completa anche su desktop; icona tema 112 unica per PWA e schermata Home | Richiesta dell'utente |
| 2026-10-11 | Subagenti su Sonnet, Haiku per compiti meccanici, Opus solo su richiesta | Risparmio token a parità di qualità per compiti ben definiti |
| 2026-10-11 | Cronologia GitHub riscritta in un solo commit | Rimuovere due cognomi reali finiti negli esempi |
