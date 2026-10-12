// Modalità demo (SOLO sviluppo, rotta /demo): area medico e gestione con dati inventati, senza Firebase.

import { useMemo } from 'react';
import { Redirect, Route, Switch } from 'wouter';
import { AreaGestione } from '../pagine/gestione/AreaGestione';
import { InAttesa } from '../pagine/Stati';
import { FeedbackMedico } from '../pagine/feedback/Feedback';
import { AreaMedico } from '../pagine/medico/AreaMedico';
import { SessioneCtx, type ContestoSessione } from '../sessione/contesto';
import { Guscio } from '../ui/Guscio';
import { creaServiziDemo, MEDICO_DEMO } from './servizi';

export default function DemoApp() {
  // `/demo?admin=1` mostra la vista amministratore (senza medico associato).
  const comeAdmin = new URLSearchParams(window.location.search).get('admin') === '1';
  const valore = useMemo<ContestoSessione>(
    () => ({
      sessione: {
        tipo: 'attivo',
        profilo: comeAdmin
          ? { uid: 'admin-demo', email: 'admin.demo@esempio.invalid', nome: 'Amministratore Demo', admin: true, delegato: false, principale: false }
          : {
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
    [comeAdmin],
  );
  return (
    <SessioneCtx.Provider value={valore}>
      <Switch>
        {/* Schermata di attesa approvazione (solo per verifica in sviluppo). */}
        <Route path="/attesa">
          <InAttesa email="nuovo.demo@esempio.invalid" utente={{ uid: 'demo-uid-4', email: 'nuovo.demo@esempio.invalid', nome: 'Nuovo Utente Demo', stato: 'attesa', principale: false, delegato: false }} />
        </Route>
        <Route>
      <Guscio>
        <Switch>
          {!comeAdmin && <Route path="/turni/:mese?" component={AreaMedico} />}
          {!comeAdmin && <Route path="/feedback/:id?" component={FeedbackMedico} />}
          <Route path="/gestione/*?" component={AreaGestione} />
          <Route>
            <Redirect to={comeAdmin ? '/gestione' : '/turni'} replace />
          </Route>
        </Switch>
      </Guscio>
        </Route>
      </Switch>
    </SessioneCtx.Provider>
  );
}
