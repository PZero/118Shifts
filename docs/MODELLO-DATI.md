# Modello dati (Firestore) — bozza v1

Contratto condiviso tra `dati-turni`, `backend-sicurezza` e `frontend-pwa`. Ogni modifica va segnalata al coordinatore.

## Raccolte

| Percorso | Campi principali | Lettura | Scrittura |
|---|---|---|---|
| `admins/{uid}` | `{}` (esistenza = admin) | l'utente stesso | nessuno (solo console) |
| `users/{uid}` | `email`, `nome`, `stato: "attesa"\|"approvato"\|"disabilitato"`, `medicoId?`, `principale: bool`, `delegato: bool`, `creatoIl`, `ultimoAccesso?` (timestamp server, ultimo utilizzo dell'app, scritto dall'utente al massimo una volta al giorno) | l'utente stesso; admin e delegati | creazione da parte dell'utente solo con `stato:"attesa"`, `delegato:false`, `principale:false`, senza `medicoId`, email del token; l'utente cambia solo `nome`, oppure solo `ultimoAccesso` (== `request.time`, in qualsiasi stato); resto: admin e delegati (`delegato` solo admin; i delegati non gestiscono altri delegati né sé stessi). `principale:true` ammesso solo se `medici/{medicoId}.principaleUid == uid` (anche nella stessa batch) |
| `medici/{medicoId}` | `nome`, `alias: string[]`, `attivo`, `cicloInizio?: "aaaa-mm-gg"` (giorno P di riferimento), `cicloManuale: bool`, `principaleUid?` (uid dell'**unico** account principale) | admin e delegati | admin e delegati. Approvazione come principale o passaggio = **una batch**: `medici.principaleUid` + `users` nuovo (`principale:true`) + `users` ex (`principale:false`); senza l'ex retrocesso è negata |
| `elencoMedici/elenco` | `medici: {id, nome}[]` (solo attivi) | utenti approvati | admin e delegati |
| `turni/{medicoId}/mesi/{aaaa-mm}` | `giorni: { "1": ["M6","P6"], ... }` (codici grezzi normalizzati, max 2 per giorno), `importId`, `caricatoIl` (timestamp server, obbligatorio, validato) | account approvati di quel medico; admin e delegati | admin e delegati (creazione, sovrascrittura, cancellazione) |
| `turni/{medicoId}/meta/ciclo` | `cicloInizio?: "aaaa-mm-gg"`, `cicloManuale: bool` (copia di `medici/{id}`; si scrive sempre in batch con l'anagrafica) | account approvati di quel medico (principale e secondari); admin e delegati | admin e delegati |
| `quadro/{aaaa-mm}` | `giorni: { "1": { "<medicoId>": ["M6","P6"] } }` (turni di tutti, per la card "Chi è di turno con me"), `importId`, `caricatoIl` (timestamp server, validato) | admin e delegati; **solo account principali** approvati con medico attivo (i secondari NO) | admin e delegati |
| `mesiPubblicati/{aaaa-mm}` | `medici: string[]` (id con turni nel mese), `caricatoIl` (timestamp server), `importId` | **solo admin e delegati** (elenca i medici: i medici non lo leggono) | admin e delegati |
| `cambi/{medicoId}/voci/{id}` | `data`, `slot: 0\|1`, `codice`, `verso: "ceduto"\|"ricevuto"`, `collegaId`, `creatoIl` | account approvati di quel medico (admin e delegati no; un delegato vede i propri come medico) | **solo account principale**: approvato, `principale:true` e uid == `medici/{medicoId}.principaleUid`; campi validati, `collegaId` medico esistente diverso da sé, `creatoIl` = ora server |
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
