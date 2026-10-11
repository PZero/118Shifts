import { createContext, useContext } from 'react';
import type { Servizi, Utente } from '../servizi/tipi';

export interface Profilo {
  uid: string;
  email: string;
  nome: string;
  admin: boolean;
  delegato: boolean;
  medicoId?: string;
  principale: boolean;
}

export type Sessione =
  | { tipo: 'caricamento' }
  | { tipo: 'anonimo' }
  | { tipo: 'attesa'; utente: Utente }
  | { tipo: 'disabilitato'; utente: Utente }
  | { tipo: 'errore'; messaggio: string }
  | { tipo: 'attivo'; profilo: Profilo };

export interface ContestoSessione {
  sessione: Sessione;
  servizi: Servizi | null;
  accedi(): Promise<void>;
  esci(): Promise<void>;
  /** Errore dell'ultimo tentativo di accesso, da mostrare nella pagina pubblica. */
  erroreAccesso?: string;
  /** Modalità demo (solo sviluppo): dati inventati in memoria. */
  demo?: boolean;
}

export const SessioneCtx = createContext<ContestoSessione | null>(null);

export function useSessione(): ContestoSessione {
  const c = useContext(SessioneCtx);
  if (!c) throw new Error('useSessione fuori dal provider');
  return c;
}

export function useServizi(): Servizi {
  const { servizi } = useSessione();
  if (!servizi) throw new Error('Servizi non disponibili');
  return servizi;
}

export function useProfilo(): Profilo {
  const { sessione } = useSessione();
  if (sessione.tipo !== 'attivo') throw new Error('Profilo non disponibile');
  return sessione.profilo;
}

export function isStaff(p: Profilo): boolean {
  return p.admin || p.delegato;
}
