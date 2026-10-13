import { createContext, useContext } from 'react';
import type { Conversazione } from '../../servizi/tipi';

export interface StatoFeedback {
  /** `null` = non ancora caricato (o funzione non disponibile per questo account). */
  conversazioni: Conversazione[] | null;
  errore?: string;
  /** Conversazioni non lette dalla propria parte (admin o utente). */
  nonLette: number;
  /** Vista amministratore (tutte le conversazioni) o utente (solo le proprie). */
  comeAdmin: boolean;
  /** Messaggi ancora inviabili oggi (solo medici); `null` = non applicabile o non ancora noto. */
  restanti: number | null;
}

export const FeedbackCtx = createContext<StatoFeedback>({ conversazioni: null, nonLette: 0, comeAdmin: false, restanti: null });

export function useFeedback(): StatoFeedback {
  return useContext(FeedbackCtx);
}
