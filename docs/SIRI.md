# Siri e CarPlay: il Comando rapido «Turni 118»

Esiste **un solo Comando rapido**, «Turni 118» (link attuale in `LINK_COMANDO_SIRI`, verificato: nessuna chiave, domanda di importazione sul passo 1). Lo costruisce **l'amministratore una volta sola** sul proprio iPhone e lo condivide con un link iCloud. I medici non costruiscono niente: dalla card «Siri e CarPlay» dell'app toccano «Attiva Siri» (la chiave personale viene copiata e si apre l'app Comandi), incollano la chiave quando il comando la chiede e toccano «Aggiungi comando».

Uso: «Ehi Siri, Turni 118» → Siri chiede «Cosa vuoi sapere?» → «Dove lavoro oggi?», «Sarò di turno il 30 maggio?», «Chi mi può dare il cambio il 20 maggio?», «Chi lavora con me oggi?», «Chi mi dà il cambio allo smonto?». Funziona anche su CarPlay.

## Come funziona (in breve)
- «Attiva Siri» crea il documento `siri/{chiave}` (chiave casuale di 64 caratteri) con le frasi già pronte, da ieri alla fine dell'ultimo mese pubblicato (max 100 giorni), e copia la chiave negli appunti.
- Il comando legge il documento con una richiesta web, **senza login**, e mostra la frase giusta: Siri la legge ad alta voce.
- L'app tiene le frasi aggiornate (apertura, cambi, pubblicazione dell'Excel). «Disattiva Siri» cancella la chiave: il comando smette di rispondere.
- Voci di ogni giorno (`giorni.<aaaa-mm-gg>`): `testo` (frase completa), `primaDelle8?` (smonto dopo una notte), `dove`, `diTurno`, `cambio?`, `conMe?`. Contratto: riga `siri/{chiave}` di `docs/MODELLO-DATI.md`.

---

## Parte 1 — Costruire il comando (amministratore, una volta)

Prima: nell'app dei turni tocca **Attiva Siri**, così hai la tua chiave negli appunti.

Apri l'app **Comandi** → **+** in alto a destra → in alto tocca il nome e chiamalo **Turni 118**.

Ogni passo qui sotto è **un'azione**: tocca **Cerca azioni** in basso, scrivi la parola in grassetto e tocca l'azione. Le parole tra [parentesi quadre] sono **variabili**: **non vanno scritte né incollate**. Si inseriscono come **bolla** (pastiglia con icona) toccando il punto del campo e scegliendo la variabile dalla barra sopra la tastiera (o «Seleziona variabile»). Se copi un testo dalla guida, cancella la parte `[...]` e metti la bolla al suo posto.

Tutti i blocchi «Se» sono **uno dopo l'altro, mai uno dentro l'altro**.

### La chiave
1. **Testo** → incolla la tua chiave (tieni premuto nel campo → Incolla).
2. **Imposta variabile** → nome `Chiave`.

### La domanda e il giorno
3. **Richiedi input** (compare come «Richiedi *Testo* con …») → domanda `Cosa vuoi sapere?`; disattiva «Consenti più righe».
4. **Imposta variabile** → nome `Domanda`, e tocca **Input** (grigio = vuoto) per scegliere l'uscita di «Richiedi» (**Input fornito**): deve diventare blu. Vale per **ogni** «Imposta variabile» della guida: il valore va sempre collegato all'azione sopra.
5. **Ottieni date** (dall'input) → input: [Domanda].
6. Blocco **Se** → bolla [Date] (con formato *Personalizzato* `yyyy-MM-dd`, toccando la bolla) **ha qualsiasi valore**; rami vuoti. Dopo **Fine se**: **Imposta variabile** `Giorno` su [Risultato Se].
7. Secondo blocco **Se** → [Giorno] **ha qualsiasi valore**; ramo vuoto; in **Altrimenti**: **Data attuale** e **Formatta data** (*Personalizzato*, `yyyy-MM-dd`). Dopo **Fine se**: **Imposta variabile** `Giorno` su [Risultato Se] (di questo blocco). Così senza data nella domanda si usa oggi.

### Lettura delle frasi
8. **Ottieni contenuti dell'URL** → URL: incolla
   `https://firestore.googleapis.com/v1/projects/shifts-be876/databases/(default)/documents/siri/`
   e subito dopo, senza spazi, inserisci la bolla [Chiave].
9. **Ottieni valore dizionario** → *Valore* per la chiave
   `fields.giorni.mapValue.fields.` + bolla [Giorno] + `.mapValue.fields`
   in [Contenuti dell'URL].
10. **Imposta variabile** → nome `Voci`.
11. **Se** → [Voci] **non ha valore**
    - **Mostra risultato** → `Non ho i turni di quel giorno. Se succede sempre, riattiva Siri dall'app dei turni.`
    - **Interrompi questo comando**
    - (lascia vuoto **Altrimenti**, poi **Fine se**)

### Quale risposta
12. **Testo** → `testo`, poi **Imposta variabile** → nome `Voce`.
13. (passo eliminato: non serve convertire in minuscolo)
14. Sei blocchi **Se**, uno dopo l'altro, tutti uguali tranne la parola. Ognuno contiene **Testo** con il nome della voce e **Imposta variabile** → `Voce`:

    | Se [Input fornito] contiene | Testo |
    |---|---|
    | `turno` | `diTurno` |
    | `dove` | `dove` |
    | `Dove` | `dove` |
    | `con me` | `conMe` |
    | `cambio` | `cambio` |
    | `smont` | `primaDelle8` |

    L'ordine conta: vince l'ultimo che corrisponde («chi mi dà il cambio allo smonto» → smonto).

    **Come si costruisce un blocco** (esempio della prima riga; poi ripeti per le altre cinque):
    1. Aggiungi l'azione **Se**. Compare un blocco con **Se**, **Altrimenti** e **Fine se**.
    2. Nella riga «Se»: tocca il primo campo → **Seleziona variabile** → torna su fino all'azione **Richiedi** (passo 3) e tocca la sua uscita, la bolla **Input fornito**. È già di tipo testo, quindi tra le condizioni c'è **contiene** (con la variabile `Domanda` iOS mostra solo «ha qualsiasi valore / non ha valore»). Scegli **contiene** e nel campo di testo scrivi `turno`. Se anche così non compare «contiene», tocca la bolla «Input fornito» e scegli **Tipo → Testo**.
    3. Aggiungi l'azione **Testo** e scrivi `diTurno`. Le azioni nuove finiscono in fondo: **trascinala** tra «Se» e «Altrimenti».
    4. Aggiungi **Imposta variabile**, trascinala subito sotto il Testo (sempre prima di «Altrimenti»), scegli la variabile esistente `Voce`: come valore prende il Testo appena sopra.
    5. «Altrimenti» resta vuoto.

    Risultato del primo blocco:
    ```
    Se  [Input fornito]  contiene  turno
        Testo: diTurno
        Imposta variabile Voce a [Testo]
    Altrimenti
    Fine se
    ```
15. **Ottieni valore dizionario** → *Valore* per la chiave: bolla [Voce] + `.stringValue`, in [Voci].
16. **Imposta variabile** → nome `Risposta`.
17. **Se** → [Risposta] **non ha valore**
    - **Mostra risultato** → `Questa informazione non è disponibile per quel giorno o per il tuo account.`
    - **Interrompi questo comando** → **Fine se**
18. **Mostra risultato** → [Risposta]. Con Siri e su CarPlay viene letto ad alta voce.

### Prova
Tocca ▶︎ in basso: alla domanda scrivi «dove lavoro oggi». Poi prova a voce: «Ehi Siri, Turni 118».
La prima volta iOS chiede il permesso di collegarsi a `firestore.googleapis.com`: **Consenti sempre**.
Per usarlo con iPhone bloccato o in auto: Impostazioni → Siri → **Consenti Siri con iPhone bloccato**.

Se al passo 9 non esce niente, prova a dividere il percorso in più azioni **Ottieni valore dizionario** in fila: `fields`, `giorni`, `mapValue`, `fields`, [Giorno], `mapValue`, `fields`.

---

## Parte 2 — Condividerlo con tutti (amministratore, una volta)

La copia condivisa **non deve contenere la tua chiave**.

1. In Comandi tieni premuto **Turni 118** → **Duplica**. Lavora sulla copia, chiamala anch'essa **Turni 118**.
2. Nella copia, al passo 1, sostituisci la chiave con `incolla qui la chiave`.
3. Nella copia tocca **ⓘ** nella barra in basso → **Configurazione** (o «Domande di importazione») → **Aggiungi domanda** → scegli il campo **Testo** del passo 1; domanda: `Incolla la chiave copiata dall'app dei turni`.
4. Tieni premuto sulla copia → **Condividi** → **Copia link iCloud**.
5. Manda il link: va inserito nella costante `LINK_COMANDO_SIRI` in `app/src/servizi/siri.ts` e pubblicato. Da quel momento nella card compaiono le istruzioni e il tasto per aggiungere il comando.
6. Puoi cancellare la copia; tieni il tuo originale.

## Parte 3 — Cosa fa ogni medico
1. Nell'app dei turni, card **Siri e CarPlay** → **Attiva Siri**: la chiave è copiata e si apre Comandi.
2. **Imposta comando** → tieni premuto nel campo → **Incolla** → **Aggiungi comando**.
3. «Ehi Siri, Turni 118».

Su un altro iPhone o iPad: «Attiva su un altro iPhone» (crea una seconda chiave).

## Aggiungere nuove domande in futuro
1. Nuova voce in `FrasiGiorno` (`app/src/domain/frasiSiri.ts`, frase completa con la data parlata, max 600 caratteri); adegua `limitaFrasi` e `frasiUguali` in `siri.ts` e `docs/MODELLO-DATI.md`.
2. Nel comando un nuovo blocco **Se** [Input fornito] **contiene** `<parola>` al passo 14.
3. Il comando installato è una copia su ogni telefono: con una domanda nuova va ricondiviso (nuovo link) e reinstallato. I comandi vecchi continuano a funzionare ma non conoscono la domanda nuova.

## Sicurezza
Ogni chiave restituisce **solo i turni del medico dell'account che l'ha creata**. Chi la conosce legge quelle frasi: va tenuta riservata. «Disattiva Siri» cancella tutte le chiavi dell'utente; l'amministratore può cancellare il documento dalla console. Il repository non contiene chiavi; il link iCloud del comando non contiene dati personali (la copia condivisa ha il testo segnaposto al posto della chiave).
