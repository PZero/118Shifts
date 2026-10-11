import { Link, Redirect, Route, Switch, useLocation } from 'wouter';
import { Icona, type NomeIcona } from '../../ui/Icona';
import { Account } from './Account';
import { Import } from './Import';
import { Medici } from './Medici';
import { SediPagina } from './Sedi';

const SEZIONI: { href: string; etichetta: string; icona: NomeIcona }[] = [
  { href: '/gestione/account', etichetta: 'Account', icona: 'utenti' },
  { href: '/gestione/medici', etichetta: 'Medici', icona: 'medici' },
  { href: '/gestione/import', etichetta: 'Carica Excel', icona: 'carica' },
  { href: '/gestione/sedi', etichetta: 'Sedi', icona: 'sede' },
];

export function AreaGestione() {
  const [percorso] = useLocation();
  return (
    <div className="pagina pagina-gestione">
      <nav className="sotto-nav" aria-label="Gestione">
        {SEZIONI.map((s) => (
          <Link key={s.href} href={s.href} className="sotto-nav-voce" aria-current={percorso.startsWith(s.href) ? 'page' : undefined}>
            <Icona nome={s.icona} piccola />
            {s.etichetta}
          </Link>
        ))}
      </nav>
      <Switch>
        <Route path="/gestione/account" component={Account} />
        <Route path="/gestione/medici" component={Medici} />
        <Route path="/gestione/import" component={Import} />
        <Route path="/gestione/sedi" component={SediPagina} />
        <Route>
          <Redirect to="/gestione/account" replace />
        </Route>
      </Switch>
    </div>
  );
}
