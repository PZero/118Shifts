// Tipi dei documenti Firestore (contratto: docs/MODELLO-DATI.md) e interfaccia dei servizi.
// L'interfaccia `Servizi` ha due implementazioni: Firestore (produzione) e demo (solo sviluppo).

import type { Cambio } from '../domain/cambi';
import type { LimiteFeedback } from '../domain/feedback';
import type { FrasiSiri } from '../domain/frasiSiri';
import type { GiorniQuadro } from '../domain/quadro';
import type { TipoAvviso } from '../domain/excel';
import type { GiorniIndisponibili } from '../domain/indisponibilita';
import type { ModelloSerializzato } from '../domain/ocr/modello';

export type StatoAccount = 'attesa' | 'approvato' | 'disabilitato';

export interface Utente {
  uid: string;
  email: string;
  nome: string;
  stato: StatoAccount;
  medicoId?: string;
  principale: boolean;
  delegato: boolean;
  creatoIl?: Date;
  ultimoAccesso?: Date;
  /** Presentazione all'amministratore (≤200), modificabile dall'utente solo in attesa. */
  presentazione?: string;
}

export interface MedicoAnagrafica {
  id: string;
  nome: string;
  alias: string[];
  attivo: boolean;
  /** "aaaa-mm-gg": giorno P di riferimento del ciclo. */
  cicloInizio?: string;
  cicloManuale: boolean;
  principaleUid?: string | null;
}

export interface VoceElenco {
  id: string;
  nome: string;
}

/** turni/{medicoId}/mesi/{aaaa-mm} */
export interface MeseDoc {
  chiave: string;
  anno: number;
  mese: number;
  giorni: Record<string, string[]>;
  importId?: string;
  /** Data di caricamento (turni/{medico}/mesi/{mese}.caricatoIl), mostrata al medico. */
  caricatoIl?: Date;
}

/** mesiPubblicati/{aaaa-mm}: indice dei medici con turni pubblicati nel mese (solo admin e delegati). */
export interface MesePubblicato {
  chiave: string;
  medici: string[];
  caricatoIl?: Date;
  importId: string;
}

/** quadro/{aaaa-mm}: chi lavora ogni giorno (tutti i medici); leggibile solo da staff e account principali. */
export interface QuadroMese {
  chiave: string;
  giorni: GiorniQuadro;
  caricatoIl?: Date;
}

/** cambi/{medicoId}/voci/{id} */
export interface CambioDoc extends Cambio {
  id: string;
  collegaId: string;
  creatoIl?: Date;
}

export type NuovoCambio = Omit<CambioDoc, 'id' | 'creatoIl'>;

/** config/sedi: { "1": "Sede 1", ... } */
export type Sedi = Record<string, string>;

export const SEDI_PREDEFINITE: Sedi = Object.fromEntries(
  Array.from({ length: 7 }, (_, i) => [String(i + 1), `Sede ${i + 1}`]),
);

export interface AvvisoSalvato {
  tipo: TipoAvviso | 'nome-non-abbinato';
  foglio: string;
  cella?: string;
  messaggio: string;
}

export interface Importazione {
  id: string;
  data?: Date;
  autoreUid: string;
  mesi: string[];
  numeroAvvisi: number;
}

/** Piano di pubblicazione dell'Excel, già validato nell'anteprima. */
export interface PianoImport {
  /** Medici nuovi da creare: `rif` è un riferimento provvisorio usato in `turni`. */
  nuoviMedici: { rif: string; nome: string }[];
  /** Alias da aggiungere a medici esistenti (nomi abbinati a mano). */
  alias: { medicoId: string; alias: string }[];
  /** Turni da scrivere: medicoId reale oppure `rif` di un nuovo medico. */
  turni: { medico: string; chiave: string; giorni: Record<string, string[]> }[];
  mesi: string[];
  avvisi: AvvisoSalvato[];
  /** Mese di partenza "aaaa-mm": mesi/turni precedenti sono ignorati (difesa in `pubblicaImport`). */
  meseDa?: string;
}

export interface CicloMedico {
  cicloInizio?: string;
  cicloManuale: boolean;
}

/** feedback/{id}: conversazione riservata tra un utente e l'amministratore. */
export interface Conversazione {
  id: string;
  autoreUid: string;
  autoreNome: string;
  argomento: string;
  creatoIl?: Date;
  aggiornatoIl?: Date;
  ultimoTesto: string;
  nonLettoAdmin: boolean;
  nonLettoUtente: boolean;
}

/** feedback/{id}/messaggi/{id} */
export interface MessaggioFeedback {
  id: string;
  testo: string;
  daAdmin: boolean;
  autoreUid: string;
  creatoIl?: Date;
}

export interface AutoreFeedback {
  uid: string;
  nome: string;
}

/** siri/{chiave}: frasi lette da Siri/CarPlay tramite il Comando rapido (la chiave è il segreto). */
export interface ChiaveSiri {
  chiave: string;
  giorni: FrasiSiri;
}

export interface Servizi {
  // --- area medico ---
  turniMedico(medicoId: string): Promise<MeseDoc[]>;
  cambiMedico(medicoId: string): Promise<CambioDoc[]>;
  aggiungiCambio(medicoId: string, cambio: NuovoCambio): Promise<void>;
  eliminaCambio(medicoId: string, id: string): Promise<void>;
  elencoMedici(): Promise<VoceElenco[]>;
  sedi(): Promise<Sedi>;
  /** Ancora del ciclo (turni/{id}/meta/ciclo, leggibile dal medico); `null` se non ancora impostata. */
  cicloMedico(medicoId: string): Promise<CicloMedico | null>;
  /** Quadro del mese (solo account principali e staff; i secondari ricevono permission-denied); `null` se non esiste. */
  quadro(chiaveMese: string): Promise<QuadroMese | null>;
  /** Indisponibilità dichiarate (solo account principale): chiave mese -> giorni. Privato del medico. */
  indisponibilita(medicoId: string): Promise<Record<string, GiorniIndisponibili>>;
  /** Salva il mese; con `giorni` vuoto cancella il documento. */
  salvaIndisponibilita(medicoId: string, chiaveMese: string, giorni: GiorniIndisponibili): Promise<void>;

  // --- Siri e CarPlay (siri/{chiave}) ---
  /** Le chiavi dell'utente collegato (una per dispositivo). */
  siriMie(): Promise<ChiaveSiri[]>;
  /** Le chiavi di un medico (solo staff). */
  siriDelMedico(medicoId: string): Promise<ChiaveSiri[]>;
  siriCrea(medicoId: string, chiave: string, giorni: FrasiSiri): Promise<void>;
  siriAggiorna(chiave: string, giorni: FrasiSiri): Promise<void>;
  siriElimina(chiavi: readonly string[]): Promise<void>;

  // --- feedback (account approvati e admin; i delegati non vedono le chat altrui) ---
  /** Tempo reale. `uid` = solo le conversazioni di quell'utente; senza `uid` tutte (admin). */
  osservaConversazioni(uid: string | undefined, cb: (c: Conversazione[]) => void, errore: (e: unknown) => void): () => void;
  /** Contatore giornaliero dei messaggi del medico (limiteFeedback/{uid}); `null` se non esiste. */
  osservaLimiteFeedback(uid: string, cb: (l: LimiteFeedback | null) => void, errore: (e: unknown) => void): () => void;
  osservaMessaggi(convId: string, cb: (m: MessaggioFeedback[]) => void, errore: (e: unknown) => void): () => void;
  /** Conversazione + primo messaggio (+ contatore giornaliero) in una batch; restituisce l'id. */
  creaConversazione(autore: AutoreFeedback, argomento: string, testo: string): Promise<string>;
  /** Messaggio + aggiornamento della conversazione (+ contatore giornaliero se del medico) in una batch. */
  inviaMessaggio(conv: Conversazione, autore: AutoreFeedback, testo: string, daAdmin: boolean): Promise<void>;
  /** Mette a "letto" solo il flag della propria parte. */
  segnaLetta(convId: string, comeAdmin: boolean): Promise<void>;
  /** Cancella i messaggi a blocchi e poi la conversazione. */
  eliminaConversazione(convId: string): Promise<void>;
  /** users/{uid}.presentazione: consentito solo finché l'account è in attesa. */
  salvaPresentazione(uid: string, testo: string): Promise<void>;

  // --- gestione (admin e delegati) ---
  osservaInAttesa(cb: (numero: number) => void): () => void;
  utenti(): Promise<Utente[]>;
  /** Associa l'account a un medico come principale o secondario (batch coerente con le regole). */
  associa(utente: Utente, medicoId: string, principale: boolean): Promise<void>;
  impostaStato(utente: Utente, stato: StatoAccount): Promise<void>;
  impostaDelegato(utente: Utente, delegato: boolean): Promise<void>;
  medici(): Promise<MedicoAnagrafica[]>;
  salvaMedico(medico: Omit<MedicoAnagrafica, 'id'> & { id?: string }): Promise<string>;
  salvaSedi(sedi: Sedi): Promise<void>;
  /** Modello OCR per l'import da screenshot (`ocrModello/corrente`); `null` se non ancora caricato. */
  ocrModello(): Promise<unknown | null>;
  /** Sostituisce il modello OCR con una sola scrittura (aggiornatoIl lato server). */
  salvaOcrModello(modello: ModelloSerializzato, autoreUid: string): Promise<void>;
  importazioni(): Promise<Importazione[]>;
  /** Indice dei mesi già pubblicati (per l'avviso "già pubblicato il …, verrà sostituito"). */
  mesiPubblicati(): Promise<MesePubblicato[]>;
  /**
   * Ogni mese di `piano.mesi` (>= `piano.meseDa`) sostituisce il precedente: i medici presenti
   * nell'indice ma assenti dal piano perdono i turni di quel mese. Atomico per mese (batch).
   */
  pubblicaImport(piano: PianoImport, autoreUid: string, avanzamento?: (fatto: number, totale: number) => void): Promise<string>;
}
