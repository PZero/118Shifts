// Un solo ascolto in tempo reale delle conversazioni, condiviso da navigazione (badge) e pagine.
// Attivo per l'amministratore (tutte) e per gli account approvati con medico associato (solo le proprie).

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { contaNonLette } from '../../domain/feedback';
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

  const valore = useMemo<StatoFeedback>(
    () => ({
      conversazioni: abilitato ? conversazioni : null,
      nonLette: conversazioni ? contaNonLette(conversazioni, profilo.admin) : 0,
      comeAdmin: profilo.admin,
      ...(errore ? { errore } : {}),
    }),
    [abilitato, conversazioni, errore, profilo.admin],
  );
  return <FeedbackCtx.Provider value={valore}>{children}</FeedbackCtx.Provider>;
}
