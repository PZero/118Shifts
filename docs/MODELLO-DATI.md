# Modello dati (Firestore) — bozza v1

Contratto condiviso tra `dati-turni`, `backend-sicurezza` e `frontend-pwa`. Ogni modifica va segnalata al coordinatore.

## Raccolte

| Percorso | Campi principali | Lettura | Scrittura |
|---|---|---|---|
| `admins/{uid}` | `{}` (esistenza = admin) | l'utente stesso | nessuno (solo console) |
| `users/{uid}` | `email`, `nome`, `stato: "attesa"\|"approvato"\|"disabilitato"`, `medicoId?`, `principale: bool`, `delegato: bool`, `creatoIl` | l'utente stesso; admin e delegati | creazione da parte dell'utente solo con `stato:"attesa"`, `delegato:false`, `principale:false`, senza `medicoId`, email del token; l'utente cambia solo `nome`; resto: admin e delegati (`delegato` solo admin; i delegati non gestiscono altri delegati né sé stessi). `principale:true` ammesso solo se `medici/{medicoId}.principaleUid == uid` (anche nella stessa batch) |
| `medici/{medicoId}` | `nome`, `alias: string[]`, `attivo`, `cicloInizio?: "aaaa-mm-gg"` (giorno P di riferimento), `cicloManuale: bool`, `principaleUid?` (uid dell'**unico** account principale) | admin e delegati | admin e delegati. Approvazione come principale o passaggio = **una batch**: `medici.principaleUid` + `users` nuovo (`principale:true`) + `users` ex (`principale:false`); senza l'ex retrocesso è negata |
| `elencoMedici/elenco` | `medici: {id, nome}[]` (solo attivi) | utenti approvati | admin e delegati |
| `turni/{medicoId}/mesi/{aaaa-mm}` | `giorni: { "1": ["M6","P6"], ... }` (codici grezzi normalizzati, max 2 per giorno), `importId` | account approvati di quel medico; admin e delegati | admin e delegati |
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
