# Siri e CarPlay: costruire il Comando rapido "Turni 118"

Esiste **un solo Comando rapido**, «Turni 118». Si costruisce **una volta** nell'app **Comandi** (iPhone, in italiano) e si condivide con un link iCloud. Ogni medico lo aggiunge con un tocco dalla card «Siri e CarPlay» dell'app. Il comando chiede «Cosa vuoi sapere?» (su CarPlay Siri lo chiede a voce) e risponde in base alla domanda.

Domande supportate: «Dove lavoro oggi?», «Sarò di turno il 30 maggio?», «Chi mi può dare il cambio il 20 maggio?», «Chi lavora con me oggi?».

## Come funziona
1. In app, «Attiva Siri» crea il documento `siri/{chiave}` (chiave casuale di 64 caratteri) con le frasi da ieri alla fine dell'ultimo mese pubblicato (al massimo 100 giorni, documento sotto ~700 KB) e copia negli appunti `118siri:<chiave>`.
2. L'app apre il link iCloud del comando (costante `LINK_COMANDO_SIRI` in `app/src/servizi/siri.ts`).
3. Alla prima esecuzione il comando legge la chiave dagli appunti e la salva in `118/chiave.txt`; poi legge via REST il documento, senza login, e pronuncia la frase giusta.
4. L'app tiene le frasi aggiornate (apertura, cambi, pubblicazione Excel). Disattivando Siri la chiave viene cancellata e il comando smette di rispondere.

Voci di ogni giorno (`giorni.<aaaa-mm-gg>`), già complete della data parlata: `testo` (frase generale), `primaDelle8?` (dopo una notte, se l'ora è prima delle 8), `dove`, `diTurno`, `cambio?`, `conMe?` (assenti se non disponibili). Contratto: riga `siri/{chiave}` di `docs/MODELLO-DATI.md`.

## Costruire il comando (app Comandi, lingua italiana)
Nuovo comando, nome **Turni 118** (la frase di attivazione è «Ehi Siri, Turni 118»). Azioni, nell'ordine:

**A. Chiave**
1. **Ottieni file**: percorso `118/chiave.txt`, cartella Comandi; disattiva «Mostra selettore documenti» e «Errore se non trovato».
2. **Se** *File* **non ha nessun valore**:
   1. **Ottieni appunti**.
   2. **Se** *Appunti* **inizia con** `118siri:`:
      - **Sostituisci testo** `118siri:` con niente sull'input *Appunti*.
      - **Salva file** in Comandi, percorso `118/chiave.txt`, «Sovrascrivi se esiste» attivo, «Chiedi dove salvare» disattivo.
   3. **Altrimenti**: **Pronuncia testo** «Apri l'app dei turni e tocca Attiva Siri», poi **Interrompi comando**. **Fine Se**.
   4. **Ottieni file** `118/chiave.txt` di nuovo.
3. **Fine Se**. **Sostituisci testo** `\n` con niente sul *File* e salva in variabile *Chiave*.

**B. Domanda e data**
4. **Chiedi input**: tipo *Testo*, prompt `Cosa vuoi sapere?`. Salva in variabile *Domanda*.
5. **Rileva date** sull'input *Domanda*.
6. **Se** *Date rilevate* **non ha nessun valore**: **Data attuale** in variabile *DataScelta* e *SenzaData* = `1`. **Altrimenti**: primo elemento di *Date rilevate* in *DataScelta* e *SenzaData* = `0`. **Fine Se**.
7. **Formatta data** *DataScelta*, formato personalizzato `yyyy-MM-dd` (variabile *Giorno*). **Data attuale** formattata `H` (variabile *Ora*).

**C. Lettura del documento**
8. **Ottieni contenuto di URL**: GET, URL
   `https://firestore.googleapis.com/v1/projects/shifts-be876/databases/(default)/documents/siri/` seguito da *Chiave*. Salva in *Risposta*.
9. **Ottieni valore dizionario** da *Risposta*, percorso `fields.giorni.mapValue.fields.<Giorno>.mapValue.fields` (cioè `fields` → `giorni` → `mapValue` → `fields` → *Giorno* → `mapValue` → `fields`). Salva in *Voci*.
10. **Se** *Voci* **non ha nessun valore**: se *Risposta* contiene `error` (chiave revocata) **Pronuncia** «Siri non è più attivo, riattivalo dall'app»; altrimenti **Pronuncia** «Non ho ancora i turni di quel giorno.»; poi **Interrompi comando**. **Fine Se**.

**D. Scelta della voce.** Prima **Cambia maiuscole/minuscole** su *Domanda* → *minuscolo* (variabile *Q*). Poi blocchi **Se** *Q* **contiene**, in quest'ordine (vale il primo che corrisponde):
11. `cambio` → voce `cambio`.
12. `con me`, oppure `chi lavora`, oppure `chi c'è` → voce `conMe` (condizioni multiple «Qualsiasi» o più **Se** annidati).
13. `dove` → voce `dove`.
14. `di turno`, oppure `lavoro`, oppure `lavorerò` → voce `diTurno`.
15. **Altrimenti** → voce `testo`; se *SenzaData* = `1` e *Ora* < `8`, leggi `primaDelle8` e, se esiste, usalo al posto di `testo`.

In ogni ramo: **Ottieni valore dizionario** `<voce>` → `stringValue` da *Voci*, salva in *Testo*.
16. **Se** *Testo* **non ha nessun valore**: **Pronuncia** «Questa informazione non è disponibile per il tuo account.» e **Interrompi comando** (succede per `cambio` e `conMe` quando mancano).

**E. Risposta**
17. **Pronuncia testo** *Testo* e **Mostra risultato** *Testo* (su CarPlay legge a voce).

Con iPhone bloccato serve «Consenti Siri con iPhone bloccato» in Impostazioni > Siri (iOS può chiedere di sbloccare per leggere il file).

Prova: «Esegui», poi «Ehi Siri, Turni 118» e rispondi alla domanda.

## Condividere il comando con un link iCloud
1. In Comandi: tre puntini del comando > **Condividi** > **Copia link iCloud** (nel comando non c'è nessun dato personale: la chiave sta in `118/chiave.txt`, creato su ciascun dispositivo).
2. Incolla il link nella costante `LINK_COMANDO_SIRI` in `app/src/servizi/siri.ts` (vuota = «Comando non ancora disponibile»).
3. Ripubblica l'app: «Attiva Siri» copia la chiave e apre il link, l'utente tocca «Aggiungi comando».

## Aggiungere nuove domande in futuro
1. Aggiungi una voce a `FrasiGiorno` in `app/src/domain/frasiSiri.ts` (frase completa con la data parlata, max 600 caratteri), adegua `limitaFrasi` e `frasiUguali` in `siri.ts`, le regole (`firebase/firestore.rules`, riga `siri`) e `docs/MODELLO-DATI.md`.
2. Nel comando aggiungi un ramo **Se** *Q* **contiene** `<parola>` che legge la nuova voce.
3. **Attenzione**: il comando installato è una copia sul telefono di ogni medico. Un ramo nuovo richiede di **ricondividere il comando e farlo reinstallare** a tutti (nuovo link in `LINK_COMANDO_SIRI`). I comandi vecchi continuano a funzionare ma non conoscono le nuove domande. Conviene quindi **progettare ora tutte le voci** che si vorranno, così il comando non cambia più.

## Revoca e sicurezza
Ogni chiave restituisce **solo i turni del medico dell'account che l'ha creata**; chi la conosce legge quelle frasi, quindi va tenuta riservata. «Disattiva Siri» in app cancella tutte le chiavi dell'utente; l'amministratore può cancellare il documento da console. Il repository non contiene chiavi né link con dati personali.
