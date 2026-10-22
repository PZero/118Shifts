import { Link, Redirect, Route, Switch, useLocation } from 'wouter';
import { useProfilo } from '../../sessione/contesto';
import { useFeedback } from '../feedback/contestoFeedback';
import { FeedbackAdmin } from '../feedback/Feedback';
import { Icona, type NomeIcona } from '../../ui/Icona';
import { Account } from './Account';
import { Import } from './Import';
import { CalendarioStaff } from './CalendarioStaff';
import { Medici } from './Medici';
import { SediPagina } from './Sedi';
import { Utilizzo } from './Utilizzo';

const SEZIONI: { href: string; etichetta: string; icona: NomeIcona; soloAdmin?: boolean }[] = [
  { href: '/gestione/account', etichetta: 'Account', icona: 'utenti' },
  { href: '/gestione/feedback', etichetta: 'Feedback', icona: 'messaggio', soloAdmin: true },
  { href: '/gestione/medici', etichetta: 'Medici', icona: 'medici' },
  { href: '/gestione/import', etichetta: 'Carica turni', icona: 'carica' },
  { href: '/gestione/sedi', etichetta: 'Sedi', icona: 'sede' },
  { href: '/gestione/utilizzo', etichetta: 'Utilizzo', icona: 'previsione', soloAdmin: true },
];

export function AreaGestione() {
  const [percorso] = useLocation();
  const admin = useProfilo().admin;
  const { nonLette } = useFeedback();
  return (
    <div className="pagina pagina-gestione">
      <nav className="sotto-nav" aria-label="Gestione">
        {SEZIONI.filter((s) => admin || !s.soloAdmin).map((s) => (
          <Link key={s.href} href={s.href} className="sotto-nav-voce" aria-current={percorso.startsWith(s.href) ? 'page' : undefined}>
            <Icona nome={s.icona} piccola />
            {s.etichetta}
            {s.href.endsWith('/feedback') && nonLette > 0 ? <span className="badge badge-inline">{nonLette}</span> : null}
          </Link>
        ))}
      </nav>
      <Switch>
        <Route path="/gestione/account" component={Account} />
        <Route path="/gestione/medici" component={Medici} />
        <Route path="/gestione/medici/:id/:mese?" component={CalendarioStaff} />
        <Route path="/gestione/import" component={Import} />
        <Route path="/gestione/sedi" component={SediPagina} />
        {admin && <Route path="/gestione/utilizzo" component={Utilizzo} />}
        {admin && <Route path="/gestione/feedback/:id?" component={FeedbackAdmin} />}
        <Route>
          <Redirect to="/gestione/account" replace />
        </Route>
      </Switch>
    </div>
  );
}
