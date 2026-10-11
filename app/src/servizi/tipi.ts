// Tipi dei documenti Firestore (contratto: docs/MODELLO-DATI.md) e interfaccia dei servizi.
// L'interfaccia `Servizi` ha due implementazioni: Firestore (produzione) e demo (solo sviluppo).

import type { Cambio } from '../domain/cambi';
import type { TipoAvviso } from '../domain/excel';

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
}

export interface CicloMedico {
  cicloInizio?: string;
  cicloManuale: boolean;
}

export interface Servizi {
  // --- area medico ---
  turniMedico(medicoId: string): Promise<MeseDoc[]>;
  cambiMedico(medicoId: string): Promise<CambioDoc[]>;
  aggiungiCambio(medicoId: string, cambio: NuovoCambio): Promise<void>;
  eliminaCambio(medicoId: string, id: string): Promise<void>;
  elencoMedici(): Promise<VoceElenco[]>;
  sedi(): Promise<Sedi>;
  /** Ancora del ciclo salvata in anagrafica; `null` se non leggibile (vedi report: regole). */
  cicloMedico(medicoId: string): Promise<CicloMedico | null>;

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
  importazioni(): Promise<Importazione[]>;
  pubblicaImport(piano: PianoImport, autoreUid: string, avanzamento?: (fatto: number, totale: number) => void): Promise<string>;
}
