// Un solo ascolto in tempo reale delle conversazioni, condiviso da navigazione (badge) e pagine.
// Attivo per l'amministratore (tutte) e per gli account approvati con medico associato (solo le proprie).

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { contaNonLette, messaggiRestanti, type LimiteFeedback } from '../../domain/feedback';
import { useProfilo, useServizi } from '../../sessione/contesto';
import type { Conversazione } from '../../servizi/tipi';
import { messaggioErroreGenerico } from '../../ui/errori';
import { FeedbackCtx, type StatoFeedback } from './contestoFeedback';

export function ProviderFeedback({ children }: { children: ReactNode }) {
  const servizi = useServizi();
  const profilo = useProfilo();
  const abilitato = profilo.admin || Boolean(profilo.medicoId);
  const [conversazioni, setConversazioni] = useState<Conversazione[] | null>(null);
  const [errore, setErrore] = useState<string>();
  const [limite, setLimite] = useState<LimiteFeedback | null | undefined>(undefined);

  useEffect(() => {
    if (!abilitato) return;
    return servizi.osservaConversazioni(
      profilo.admin ? undefined : profilo.uid,
      (c) => {
        setConversazioni(c);
        setErrore(undefined);
      },
      (e) => setErrore(messaggioErroreGenerico(e)),
    );
  }, [servizi, abilitato, profilo.admin, profilo.uid]);

  // Contatore giornaliero: solo per i medici. Il conteggio riparte a mezzanotte UTC.
  const contato = abilitato && !profilo.admin;
  useEffect(() => {
    if (!contato) return;
    return servizi.osservaLimiteFeedback(profilo.uid, setLimite, () => setLimite(null));
  }, [servizi, contato, profilo.uid]);

  const valore = useMemo<StatoFeedback>(
    () => ({
      conversazioni: abilitato ? conversazioni : null,
      nonLette: conversazioni ? contaNonLette(conversazioni, profilo.admin) : 0,
      comeAdmin: profilo.admin,
      restanti: contato && limite !== undefined ? messaggiRestanti(limite, new Date()) : null,
      ...(errore ? { errore } : {}),
    }),
    [abilitato, conversazioni, errore, profilo.admin, contato, limite],
  );
  return <FeedbackCtx.Provider value={valore}>{children}</FeedbackCtx.Provider>;
}
