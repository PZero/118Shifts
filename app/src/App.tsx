// Radice dell'app: instradamento in base allo stato e al ruolo della sessione.

import { lazy, Suspense } from 'react';
import { Redirect, Route, Router, Switch, useLocation } from 'wouter';
import { Caricamento, Disabilitato, Errore, InAttesa } from './pagine/Stati';
import { AreaGestione } from './pagine/gestione/AreaGestione';
import { AreaMedico } from './pagine/medico/AreaMedico';
import { FeedbackMedico } from './pagine/feedback/Feedback';
import { Pubblica } from './pagine/Pubblica';
import { configurazionePresente } from './servizi/firebase';
import { isStaff, useSessione } from './sessione/contesto';
import { SessioneFirebase } from './sessione/SessioneFirebase';
import { AvvisoAggiornamento } from './ui/AvvisoAggiornamento';
import { Guscio } from './ui/Guscio';

// La demo esiste solo in sviluppo: in produzione la condizione è falsa a tempo di build
// e il modulo (con i suoi dati inventati) non entra nel bundle.
const Demo = import.meta.env.DEV ? lazy(() => import('./demo/DemoApp')) : null;

function Rotte() {
  const { sessione } = useSessione();
  switch (sessione.tipo) {
    case 'caricamento':
      return <Caricamento />;
    case 'anonimo':
      return <Pubblica />;
    case 'errore':
      return configurazionePresente() ? <Errore messaggio={sessione.messaggio} /> : <Pubblica />;
    case 'attesa':
      return <InAttesa email={sessione.utente.email} utente={sessione.utente} />;
    case 'disabilitato':
      return <Disabilitato email={sessione.utente.email} />;
    case 'attivo': {
      const { profilo } = sessione;
      const staff = isStaff(profilo);
      // Account approvato ma non ancora associato a un medico (e non staff): niente da mostrare.
      if (!profilo.medicoId && !staff) return <InAttesa email={profilo.email} />;
      return (
        <Guscio>
          <Switch>
            {profilo.medicoId && <Route path="/turni/:mese?" component={AreaMedico} />}
            {profilo.medicoId && <Route path="/feedback/:id?" component={FeedbackMedico} />}
            {staff && <Route path="/gestione/*?" component={AreaGestione} />}
            <Route>
              <Redirect to={profilo.medicoId ? '/turni' : '/gestione'} replace />
            </Route>
          </Switch>
        </Guscio>
      );
    }
  }
}

function Radice() {
  const [percorso] = useLocation();
  if (Demo && (percorso === '/demo' || percorso.startsWith('/demo/'))) {
    return (
      <Router base="/demo">
        <Suspense fallback={<Caricamento />}>
          <Demo />
        </Suspense>
      </Router>
    );
  }
  return (
    <SessioneFirebase>
      <Rotte />
    </SessioneFirebase>
  );
}

export default function App() {
  return (
    <>
      <Radice />
      <AvvisoAggiornamento />
    </>
  );
}
