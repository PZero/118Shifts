// Modalità demo (SOLO sviluppo, rotta /demo): area medico e gestione con dati inventati, senza Firebase.

import { useMemo } from 'react';
import { Redirect, Route, Switch } from 'wouter';
import { AreaGestione } from '../pagine/gestione/AreaGestione';
import { AreaMedico } from '../pagine/medico/AreaMedico';
import { SessioneCtx, type ContestoSessione } from '../sessione/contesto';
import { Guscio } from '../ui/Guscio';
import { creaServiziDemo, MEDICO_DEMO } from './servizi';

export default function DemoApp() {
  const valore = useMemo<ContestoSessione>(
    () => ({
      sessione: {
        tipo: 'attivo',
        profilo: {
          uid: 'demo-uid',
          email: 'rossi.demo@esempio.invalid',
          nome: 'Rossi Demo',
          admin: false,
          delegato: true,
          medicoId: MEDICO_DEMO,
          principale: true,
        },
      },
      servizi: creaServiziDemo(),
      accedi: async () => undefined,
      esci: async () => {
        window.location.assign('/');
      },
      demo: true,
    }),
    [],
  );
  return (
    <SessioneCtx.Provider value={valore}>
      <Guscio>
        <Switch>
          <Route path="/turni/:mese?" component={AreaMedico} />
          <Route path="/gestione/*?" component={AreaGestione} />
          <Route>
            <Redirect to="/turni" replace />
          </Route>
        </Switch>
      </Guscio>
    </SessioneCtx.Provider>
  );
}
