# Registro delle decisioni

| Data | Decisione | Motivazione |
|---|---|---|
| 2026-10-11 | PWA Vite + React + TypeScript, mobile first | Ecosistema maturo, ottimo supporto PWA, tipizzazione per il modello dati |
| 2026-10-11 | Firebase progetto `shifts-be876`, piano gratuito Spark | Login Google, database e hosting gratis per ~50 utenti; vincolo: zero spese |
| 2026-10-11 | Niente Cloud Functions | Richiedono il piano Blaze (a pagamento) |
| 2026-10-11 | Excel letto nel browser dell'admin (SheetJS), con anteprima | Nessun server necessario; l'admin controlla prima di pubblicare |
| 2026-10-11 | Ore calcolate dall'app, colonna totale dell'Excel ignorata | Il conteggio deve includere i cambi |
| 2026-10-11 | Notte: 4 h sul giorno D, 8 h sul giorno D+1 | Regola di conteggio indicata dall'utente |
| 2026-10-11 | Proiezione con ciclo MP (M+P stesso giorno), N, smonto, riposo, riposo (visibili solo MP e N) | Turnazione standard; i definitivi saranno diversi |
| 2026-10-11 | Cambi privati, salvati su server, visibili a tutti gli account del medico | Devono vederli anche gli account secondari |
| 2026-10-11 | Colleghi dei cambi scelti solo da elenco | Coerenza con l'anagrafica |
| 2026-10-11 | Sedi provvisorie `Sede 1…7`, nomi in una tabella modificabile | I nomi reali non sono ancora noti |
| 2026-10-11 | Festività nazionali + 24 giugno (patrono di Genova) | Richiesta dell'utente |
| 2026-10-11 | Ripartenza da zero: vecchio repository e dati Firebase eliminati | Il vecchio repository pubblico conteneva turni reali con nomi |
| 2026-10-11 | Mai dati reali né email admin nel repository | Repository pubblico; privacy dei medici |
| 2026-10-11 | Import Excel: admin e delegati | Richiesta dell'utente |
| 2026-10-11 | Partenza ciclo proiezione: dall'ultimo giorno MP seguito da N, correggibile a mano | Automatico ma con controllo |
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
| 2026-10-11 | Ogni mese importato sostituisce il precedente; indice `mesiPubblicati/{mese}` (solo admin e delegati) con i medici del mese | Serve sapere a chi cancellare i turni senza leggere tutte le raccolte; l'elenco dei medici non deve essere visibile ai medici |
| 2026-10-11 | `caricatoIl` (ora server, validata dalle regole) in ogni mese dei turni | Il medico vede quando i suoi turni sono stati caricati |
| 2026-10-11 | Ciclo MP-N copiato in `turni/{medico}/meta/ciclo`, scritto in batch con `medici/{id}` | `medici/{id}` è solo staff: il medico deve poter proiettare il proprio ciclo |
| 2026-10-11 | Import mese per mese in batch atomica (limite 450 operazioni; oltre, indice provvisorio a unione + indice finale) | Limite Firestore di 500 operazioni per batch; un'interruzione non lascia turni non tracciati |
| 2026-10-11 | L'amministratore non è un medico: nessun turno, vede solo l'area Gestione | Indicazione dell'utente |
| 2026-10-11 | Import con mese di partenza (default: mese successivo); fogli precedenti ignorati | Permette correzioni di un mese senza toccare i mesi passati |
| 2026-10-11 | Demo `/demo` con dati inventati solo in sviluppo, esclusa dal bundle di produzione | Verifica dell'interfaccia senza Firebase e senza dati reali |
| 2026-10-11 | Su mobile il calendario è in cima, poi weekend e festività, poi i conteggi | Il calendario è la parte più importante per il medico |
| 2026-10-11 | Weekend raggruppati in blocchi colorati (libero/parziale/lavorato) | Lettura immediata di ogni weekend |
| 2026-10-11 | Hosting: `sw.js`, `index.html` e manifest senza cache | Gli aggiornamenti della PWA arrivano subito |
| 2026-10-11 | Controllo privacy: ammesse solo email con domini riservati (`.invalid`, `.test`, `example.*`) | Dati demo realistici ma inesistenti |
| 2026-10-11 | Condivisione del mese come immagine PNG (titolo + calendario, cambi applicati, niente nomi né ore), generata nel telefono | Condivisibile come una foto (es. WhatsApp) senza esporre dati privati |
| 2026-10-11 | Su Firebase Hosting `authDomain` = dominio del sito (login via `/__/auth/handler` stesso dominio) | Safari blocca i dati tra domini: nella PWA iPhone il redirect perdeva il login |
| 2026-10-11 | Staff vede il calendario di ogni medico in sola lettura, senza cambi | Controllo dell'import; i cambi restano privati |
| 2026-10-11 | Card "Mesi pubblicati" nella pagina di import | Verifica immediata di cosa c'è nel database |
| 2026-10-11 | Pagina pubblica: accesso in sola lettura per i familiari esplicitato | Altrimenti gli account secondari non si capiscono |
| 2026-10-11 | Screenshot del README solo dalla demo con dati inventati | Repository pubblico |
| 2026-10-11 | Deploy hosting automatico con GitHub Action su push in `main` (test + build); niente anteprime sulle PR | Lavorare anche da remoto/cloud; le anteprime girano su domini non autorizzati al login |
| 2026-10-11 | Regole Firestore escluse dal deploy automatico | Toccano la sicurezza: si pubblicano a mano dopo i test sull'emulatore |
| 2026-10-11 | `/fine-sessione` nel cloud (senza `dati/nomi-reali.txt`): branch + Pull Request, mai push su `main` | Nel cloud il controllo dei cognomi reali salta; il merge si fa dal PC dopo il controllo |
| 2026-10-11 | `users.ultimoAccesso` scritto dal client all'apertura (max 1/giorno), invece del lastSignIn di Auth | Il login resta ricordato e lastSignIn si legge solo con Admin SDK (niente Functions) |
| 2026-10-11 | Etichette medico "Abilitato/Disabilitato" (campo dati resta `attivo`) | "Attivo" si confondeva con l'uso dell'app |
| 2026-10-11 | `quadro/{aaaa-mm}` scritto all'import, leggibile solo da account principali e staff | Serve a "Chi è di turno con me"; i familiari non vedono i turni dei colleghi; niente cambi dei colleghi (privati) |
| 2026-10-11 | Calendario con i giorni dei mesi adiacenti (attenuati, con turni o proiezione); conteggi solo sul mese | Vedere la settimana completa a inizio e fine mese |
| 2026-10-11 | "Chi è di turno con me" segue il giorno selezionato (senza selezione: oggi); card in cima | Scelta dell'utente; quadro letto per mese, una volta per sessione |
| 2026-10-12 | Cedendo un turno, suggeriti i colleghi con 11 ore di riposo prima e dopo (dal quadro; reperibilità = impegno; assenze ignorate); clic = selezione, salvataggio con Conferma | Richiesta dell'utente; le assenze non sono note a priori |
| 2026-10-12 | ~~Niente import da foto/screenshot dell'Excel~~ (superata: vedi import da screenshot) | Risoluzione insufficiente per errore < 1% (celle ~25 px, cifre 1/7, 3/8, 5/6 ambigue, riquadri sovrapposti); OCR serio richiederebbe servizi a pagamento |
| 2026-10-12 | Chat di feedback medico ↔ admin in `feedback/{id}` + `messaggi`, più conversazioni per argomento; delegati esclusi; secondari ammessi; chiudi = cancella (entrambe le parti) | Richiesta dell'utente: riservatezza garantita dalle regole; `convAutoreUid` sui messaggi per cancellare anche gli orfani |
| 2026-10-12 | `users.presentazione` (≤200) modificabile dall'utente solo in attesa, mostrata nell'associazione | Facilita la mappatura account → medico |
| 2026-10-12 | Import da screenshot nel browser: Web Worker per griglia e celle, tesseract.js (lazy, solo per i cognomi) con worker, core WASM e dati `eng` serviti da `/ocr-tesseract/` (copiati da `scripts/copia-ocr.mjs`, fuori da git e dal precache PWA); il modello si salva su Firestore una sola volta, alla pubblicazione | Nessun dato dell'immagine esce dal browser, nessuna CDN; piano Spark invariato. Sostituisce la decisione "niente import da foto" |
| 2026-10-12 | Import da screenshot con template matching (non tesseract) sulle celle, soglie sim ≥0,90 e marg ≥0,02; celle incerte da confermare prima di pubblicare; modello in `ocrModello/corrente` (solo staff), iniziale caricato a mano da `dati/` e migliorato dalle correzioni | Prova: ~96% corrette, ~4% incerte, 0,3% errori silenziosi; tesseract 62–71%. Template da dati reali fuori dal repo pubblico |
| 2026-10-12 | Indisponibilità in `indisponibilita/{medico}/mesi/{aaaa-mm}`, solo account principale, modificabili per mese +1 (+2 tollerato per UTC); restano evidenziate con conflitto se l'Excel le viola; email copiata/aperta dal medico | Richiesta dell'utente; verifica del rispetto quando arrivano i turni; nessun invio dall'app |
| 2026-10-12 | Barra "Vai all'anteprima" dell'import da screenshot sticky solo quando righe e celle sono confermate (classe `barra-ferma` altrimenti) | Su telefono la barra fissa copriva l'elenco dei medici e le celle da correggere |
