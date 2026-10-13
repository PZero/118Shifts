# Modello dati (Firestore) — bozza v1

Contratto condiviso tra `dati-turni`, `backend-sicurezza` e `frontend-pwa`. Ogni modifica va segnalata al coordinatore.

## Raccolte

| Percorso | Campi principali | Lettura | Scrittura |
|---|---|---|---|
| `admins/{uid}` | `{}` (esistenza = admin) | l'utente stesso | nessuno (solo console) |
| `users/{uid}` | `email`, `nome`, `stato: "attesa"\|"approvato"\|"disabilitato"`, `medicoId?`, `principale: bool`, `delegato: bool`, `creatoIl`, `presentazione?: string` (0..200, messaggio in attesa di approvazione), `ultimoAccesso?` (timestamp server, ultimo utilizzo dell'app, scritto dall'utente al massimo una volta al giorno) | l'utente stesso; admin e delegati | creazione da parte dell'utente solo con `stato:"attesa"`, `delegato:false`, `principale:false`, senza `medicoId`, email del token; l'utente cambia solo `nome`, oppure solo `presentazione` (solo se `stato=="attesa"`), oppure solo `ultimoAccesso` (== `request.time`, in qualsiasi stato); resto: admin e delegati (`delegato` solo admin; i delegati non gestiscono altri delegati né sé stessi). `principale:true` ammesso solo se `medici/{medicoId}.principaleUid == uid` (anche nella stessa batch) |
| `medici/{medicoId}` | `nome`, `alias: string[]`, `attivo`, `cicloInizio?: "aaaa-mm-gg"` (giorno MP di riferimento), `cicloManuale: bool`, `principaleUid?` (uid dell'**unico** account principale) | admin e delegati | admin e delegati. Approvazione come principale o passaggio = **una batch**: `medici.principaleUid` + `users` nuovo (`principale:true`) + `users` ex (`principale:false`); senza l'ex retrocesso è negata |
| `elencoMedici/elenco` | `medici: {id, nome}[]` (solo attivi) | utenti approvati | admin e delegati |
| `turni/{medicoId}/mesi/{aaaa-mm}` | `giorni: { "1": ["M6","P6"], ... }` (codici grezzi normalizzati, max 2 per giorno), `importId`, `caricatoIl` (timestamp server, obbligatorio, validato) | account approvati di quel medico; admin e delegati | admin e delegati (creazione, sovrascrittura, cancellazione) |
| `turni/{medicoId}/meta/ciclo` | `cicloInizio?: "aaaa-mm-gg"`, `cicloManuale: bool` (copia di `medici/{id}`; si scrive sempre in batch con l'anagrafica) | account approvati di quel medico (principale e secondari); admin e delegati | admin e delegati |
| `quadro/{aaaa-mm}` | `giorni: { "1": { "<medicoId>": ["M6","P6"] } }` (turni di tutti, per la card "Chi è di turno con me"), `importId`, `caricatoIl` (timestamp server, validato) | admin e delegati; **solo account principali** approvati con medico attivo (i secondari NO) | admin e delegati |
| `mesiPubblicati/{aaaa-mm}` | `medici: string[]` (id con turni nel mese), `caricatoIl` (timestamp server), `importId` | **solo admin e delegati** (elenca i medici: i medici non lo leggono) | admin e delegati |
| `cambi/{medicoId}/voci/{id}` | `data`, `slot: 0\|1`, `codice`, `verso: "ceduto"\|"ricevuto"`, `collegaId`, `creatoIl` | account approvati di quel medico (admin e delegati no; un delegato vede i propri come medico) | **solo account principale**: approvato, `principale:true` e uid == `medici/{medicoId}.principaleUid`; campi validati, `collegaId` medico esistente diverso da sé, `creatoIl` = ora server |
| `indisponibilita/{medicoId}/mesi/{aaaa-mm}` | `giorni`: mappa `"1".."31"` -> lista non vuota (1..3, senza duplicati) di `"M"\|"P"\|"N"`; `aggiornatoIl` (== `request.time`); nessun altro campo | **solo l'account principale** del medico (stessa condizione dei `cambi`: approvato, `principale:true`, uid == `medici/{medicoId}.principaleUid`, medico attivo). Secondari, delegati, admin e altri medici: no. Un delegato che e' principale di un medico vede le proprie | stesso account principale (create/update/delete), **solo se `{aaaa-mm}` e' strettamente successivo al mese corrente, entro 12 mesi (incluso) da `request.time` (UTC, gestito dicembre -> gennaio) e se `turni/{medicoId}/mesi/{aaaa-mm}` non esiste** (turni di quel mese non ancora pubblicati per il medico; vale anche per il delete). Le chiavi dei giorni sono validate per mese (mesi da 30 giorni, febbraio 28/29 con bisestili). I mesi passati restano leggibili ma non modificabili. Il client cancella il documento quando non resta nessun giorno (una mappa vuota e' comunque accettata). Ogni valore e' confrontato con le 15 liste ammesse (ordine libero, es. `["P","M"]`) |
| `ocrModello/corrente` | `versione` (int), `cellaW`, `cellaH` (int 1..64), `esempi`: lista (max 3000) di `{c: string 1..8, v: base64 <= 2000 car.}`, `aggiornatoIl` (== `request.time`), `autoreUid` (== uid) | admin e delegati | admin e delegati (create/update/delete). Le regole non scorrono la lista: verificano `size() <= 3000` e la forma del solo primo esempio; il vincolo reale sul totale e' il limite di 1 MiB per documento Firestore (con 3000 esempi da 2000 car. lo si supererebbe: il client deve restare sotto) |
| `feedback/{convId}` | `autoreUid`, `autoreNome` (1..100), `argomento` (1..80), `creatoIl`, `aggiornatoIl`, `ultimoTesto` (≤120), `nonLettoAdmin`, `nonLettoUtente` | **solo** il titolare (account approvato, principale o secondario, anche se delegato) e l'admin; i delegati in quanto staff **no**. Query medico: `where("autoreUid","==",uid)` + `orderBy("aggiornatoIl","desc")` (indice composito); admin: tutta la raccolta | creazione: titolare, `nonLettoAdmin:true`, `nonLettoUtente:false`, `creatoIl==aggiornatoIl==request.time`, in batch col primo messaggio. Update: immutabili `autoreUid/autoreNome/argomento/creatoIl`; titolare: `aggiornatoIl`(==time)/`ultimoTesto`/`nonLettoAdmin`(solo true)/`nonLettoUtente`(solo false); admin simmetrico; `ultimoTesto` solo insieme a `aggiornatoIl`. Delete: titolare o admin |
| `feedback/{convId}/messaggi/{msgId}` | `testo` (1..1000), `daAdmin`, `autoreUid` (==auth), `convAutoreUid` (==`autoreUid` della conversazione, validato con getAfter), `creatoIl` (==time) | titolare (via `convAutoreUid`, o via genitore) e admin | create: titolare con `daAdmin:false`, admin con `daAdmin:true`; la conversazione deve esistere (anche in batch). Nessun update. Delete: titolare (`convAutoreUid`) o admin, anche se il genitore non esiste più (cancellare prima i messaggi, ≤450 per batch). **Limite**: i messaggi con `daAdmin:false` richiedono che nella stessa scrittura `limiteFeedback/{uid}` sia creato/incrementato (3 al giorno); i messaggi dell'admin non hanno limite |
| `limiteFeedback/{uid}` | `giorno` (int aaaammgg, UTC), `conteggio` (1..3) | titolare (account approvato) e admin | create: titolare, `giorno`==oggi, `conteggio`==1. Update: titolare, `giorno`==oggi e (stesso giorno: `conteggio`==vecchio+1; giorno diverso: `conteggio`==1). Delete: mai. Limite di 3 messaggi al giorno per account |
| `config/sedi` | `{ "1": "Sede 1", ..., "7": "Sede 7" }` | utenti approvati | admin e delegati |
| `importazioni/{id}` | `data`, `autoreUid`, `mesi: string[]`, `avvisi` | admin e delegati | admin e delegati |

Un account con `stato != "approvato"` o medico non `attivo` non legge nulla oltre a `users/{proprio uid}`.

## Codice turno interpretato (logica in `app/src/domain/`)
```ts
type Fascia = "M" | "P" | "N";
interface CodiceTurno {
  grezzo: string;          // es. "M6", "NCatt", "F"
  fascia?: Fascia;         // se è un turno lavorato
  sede?: number;           // 1..7
  centrale?: boolean;      // suffisso C (da confermare)
  attivazione?: boolean;   // suffisso at/att
  categoria: "turno" | "ferie" | "malattia" | "indisponibile" | "corso" | "qualita" | "reperibilita" | "altro" | "sconosciuto";
}
```

## Import: sostituzione completa del mese
- L'admin sceglie un mese di partenza; si importano solo i fogli da quel mese in poi (`PianoImport.meseDa`).
- Per ogni mese importato, `pubblicaImport` legge `mesiPubblicati/{mese}`, scrive i turni dei medici presenti nel file, **cancella** `turni/{medico}/mesi/{mese}` dei medici presenti nell'indice ma assenti dal file, e riscrive l'indice: tutto in **una batch atomica per mese**.
- Limite Firestore 500 operazioni per batch: se un mese ne supera 450 viene spezzato; l'indice provvisorio (unione vecchi + nuovi) va nella prima batch, quello definitivo in una batch finale.
- I nuovi medici creati dall'import ricevono anche `turni/{id}/meta/ciclo`. Medici preesistenti senza copia del ciclo: `cicloMedico` ripiega su `medici/{id}` (solo staff); la funzione `sincronizzaCicli()` (una tantum) crea le copie.
- L'import scrive anche `quadro/{mese}` (sostituzione completa del documento, nella stessa batch del mese).
- Rischio noto: chi legge `quadro` (account principali) vede la turnistica completa del mese di tutti i medici, secondo l'Excel e senza i cambi turno.
