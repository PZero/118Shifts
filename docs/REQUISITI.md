# Requisiti

## Fase 1: gestione turni

### Accesso e ruoli
- **Pagina pubblica**: informazioni generali e descrizione dell'app, pulsante di login.
- **Login con Google** (gestito da Firebase Auth).
- **Amministratore** (non medico): un solo account, definito fuori dal codice.
- **Delegati**: medici a cui l'amministratore delega la gestione degli account (approvazione, associazione, disabilitazione) e il **caricamento dell'Excel**.
- **Primo accesso**: landing privata "in attesa di approvazione". Admin e delegati ricevono una notifica.
- **Approvazione** = associare l'account Google a un medico dell'anagrafica (dall'Excel).
- **Più account per medico**: uno **principale**, gli altri **secondari**; stesso iter di approvazione.
- Admin e delegati possono **disabilitare** un account o un medico.

### Vista del medico (mese corrente, navigabile)
1. **Calendario** con i propri turni:
   - sabati, domeniche e festività italiane + **San Giovanni Battista (24 giugno, patrono di Genova)** + **San Francesco (4 ottobre, festa nazionale dal 2026)** evidenziati con codice colore;
   - per ogni turno si vede la **sede** (il numero dopo la lettera, es. `M6` = Mattino in sede 6);
   - **proiezione** per i 12 mesi successivi all'ultimo mese caricato (vedi sotto).
2. **Card weekend e festività**: sabati e domeniche liberi o parzialmente liberi, e stato delle festività del mese.
3. **Card ore**: totale ore del mese **calcolato dall'app** (non dalla colonna dell'Excel), cambi compresi. Contano solo i turni M/P/N (anche con suffissi C, at/att).
4. **Contatori reperibilità**: numero di **giorni** del mese per tipo RM, RP, RN, RG (non le ore).

### Cambi turno
- Li inserisce **solo l'account principale**; gli account secondari li vedono.
- Il collega si sceglie **sempre da un elenco** (anagrafica medici).
- Turno **ceduto**: resta sul calendario **barrato**, con il nome del collega che lo riceve.
- Turno **ricevuto**: graficamente collegato al cambio, con il nome di chi l'ha ceduto.
- I cambi sono **privati**: visibili solo agli account di quel medico (non agli altri medici). Salvati su server.

### Orari e calcolo ore
| Turno | Orario | Ore |
|---|---|---|
| M Mattino | 08–14 | 6 |
| P Pomeriggio | 14–20 | 6 |
| N Notte | 20–08 | 12: **4 sul giorno D, 8 sul giorno D+1** |

La notte dell'ultimo giorno del mese conta quindi 8 ore nel mese successivo.

### Proiezione
- Ciclo di 5 giorni, uguale per tutti i medici: **giorno 1 = M e P (stesso giorno, "MP"), giorno 2 = N, giorno 3 = smonto, giorni 4-5 = riposo**. In proiezione si mostrano solo MP (due fasce nello stesso giorno) e N.
- È indicativa: i turni definitivi saranno diversi.
- Punto di partenza del ciclo: l'ancora è il **giorno MP**: l'ultimo giorno reale con M e P seguito da un giorno con N. Se la cadenza non è riconoscibile, è **correggibile a mano** da admin/delegati.

### Notifiche
- In app (badge "account da approvare") + notifica push o email ad admin e delegati.
- Vincolo: piano gratuito, niente Cloud Functions (vedi STATO).

## Formato dell'Excel (analisi su file di esempio, mar 2025 – ott 2026)
- Un foglio per mese, nome `MESE AA` (es. `OTTOBRE 26`), a volte con spazi in più.
- Riga 1: giorno della settimana; riga 2: numero del giorno. `A1` = mese, `A2` = anno.
- **La colonna B è l'ultimo giorno del mese precedente**; a volte la colonna C è vuota.
  I giorni vanno trovati **leggendo i numeri della riga 2**, non per posizione.
- Ogni medico ha **2 righe** (cella del nome unita su A): due turni possibili nello stesso giorno (es. `MC` + `PC`).
- I nomi possono variare (`Desantis` / `De santis`); i medici entrano ed escono nel tempo.
  Serve un'**anagrafica stabile con alias**.
- Colonne dopo i giorni (AH, AI, …: ore dovute, totale, corsi, altro, scostamento): **ignorate**.
- Legenda in fondo al foglio (righe ~100–120), parzialmente basata sul **colore delle celle**
  (ore extra convenzionati, turni festivi, grandi festività, gettone dipendenti).
- Dati sporchi: spazi e spazi non separabili, maiuscole/minuscole, testo libero (`PC16,30`, `laurea`, …).
  Il parser deve **segnalare** i codici non riconosciuti nell'anteprima, non scartarli in silenzio.

### Legenda codici (da completare)
| Codice | Significato | Ore |
|---|---|---|
| `M`, `P`, `N` + cifra 1–7 | turno + **sede** di lavoro | da tabella orari |
| `MC`, `PC`, `NC` | turno + `C` (significato tbd) | come M/P/N |
| `F` | Ferie | 0 |
| `f` | Malattia / permessi (**dato sanitario: mostrare con discrezione**) | 0 |
| `-` | Indisponibilità giustificata | 0 |
| `C` | Corsi (formazione obbligatoria) | 0 |
| `Q`, `MR`, `PR` | Qualità / Mattina riascolto / Pomeriggio riascolto | 0 |
| suffisso `at` / `att` | Attivazione (significato esatto tbd) | come M/P/N |
| `RM`, `RP`, `RN`, `RG` | Reperibilità Mattina / Pomeriggio / Notte / Giorno (= mattina + pomeriggio) | 0 ore; **contatore di giorni per tipo** |
| `RE` | tbd | 0 |
| `E`, `e`, `Ex`, `EU`, `A`, `G`, `SC`, `CD`, `REC` | tbd | 0 |
| altri codici non riconosciuti | **da controllare**: segnalati negli avvisi di import | 0 |
| corrispondenza sede 1–7 → nome | provvisorio: `Sede 1` … `Sede 7`; nomi reali in seguito (tabella configurabile dall'admin) | — |

## Fase 2 — Pianificazione assistita dei turni (indicazione, da progettare)
Oggi l'app riceve turni già decisi. In Fase 2 potrebbe **accentrare la definizione dei turni**: raccoglie le indisponibilità di tutti, calcola una **proposta** di turnazione e la consegna al responsabile, che la corregge e la approva (**human in the loop**). La decisione resta sempre umana: l'app propone, il responsabile dispone.

Flusso ipotizzato:
1. **Raccolta**: finestra con scadenza per le indisponibilità del mese successivo, con promemoria nell'app; il responsabile vede il quadro di tutti e chi non ha ancora risposto. Le email preparate in Fase 1 diventano superflue.
2. **Proposta automatica**: un motore di vincoli genera una bozza che rispetta i vincoli obbligatori e ottimizza quelli preferenziali.
3. **Revisione**: il responsabile modifica la bozza (scambi, sostituzioni) con verifica in tempo reale dei vincoli e spiegazione di ogni conflitto; può rigenerare bloccando le celle già decise.
4. **Approvazione e pubblicazione**: la versione approvata entra nel calendario come oggi; storico delle versioni ed export Excel nel formato attuale, per compatibilità con chi lo usa ancora.

Vincoli da raccogliere e formalizzare:
- **obbligatori**: copertura di ogni sede e fascia, 11 ore di riposo, ciclo MP → N → smonto → riposo → riposo, assenze e ferie, reperibilità, limiti di ore mensili e contrattuali;
- **preferenziali**: indisponibilità (con priorità), equa distribuzione nel tempo di notti, weekend e festivi (con lo storico dei mesi precedenti), continuità di sede, preferenze personali.

Indicatori per il responsabile: indisponibilità rispettate, carico per medico (ore, notti, weekend, festivi) rispetto alla media, vincoli preferenziali violati e perché.

Punti aperti:
- **Motore**: senza Cloud Functions (piano Spark) il calcolo gira nel browser del responsabile, per esempio un solver di programmazione lineare intera in WebAssembly; dimensioni e tempi da verificare.
- **Modello dati e regole**: indisponibilità leggibili dal responsabile (oggi solo dall'account principale), bozze e versioni separate dai turni pubblicati, ruolo "responsabile" distinto o coincidente con l'amministratore.
- **Organizzazione**: regole contrattuali e consuetudini (anche non scritte) da raccogliere con chi oggi compila i turni; adozione graduale, per esempio una sede o un mese di prova in parallelo al metodo attuale.
- **Trasparenza**: ogni medico vede che la proposta è automatica e che l'approvazione è del responsabile.
