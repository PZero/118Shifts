import { conta } from '../servizi/statistiche';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { isStaff, useServizi, useSessione, useProfilo } from '../sessione/contesto';
import { useFeedback } from '../pagine/feedback/contestoFeedback';
import { ProviderFeedback } from '../pagine/feedback/ProviderFeedback';
import { Dialogo } from './Dialogo';
import { Icona, Marchio, type NomeIcona } from './Icona';
import { SelettoreTema } from './Tema';

function iniziali(nome: string): string {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? (p[p.length - 1]?.[0] ?? '') : '')).toUpperCase() || '?';
}

function ruolo(p: ReturnType<typeof useProfilo>): string {
  if (p.admin) return 'Amministratore';
  const parti = [p.principale ? 'Account principale' : 'Account secondario'];
  if (p.delegato) parti.unshift('Delegato');
  return parti.join(' · ');
}

interface VoceNav {
  href: string;
  etichetta: string;
  icona: NomeIcona;
  badge?: number;
}

/** Numero di account in attesa (solo admin e delegati), aggiornato in tempo reale. */
function useInAttesa(attivo: boolean): number {
  const servizi = useServizi();
  const [n, setN] = useState(0);
  useEffect(() => (attivo ? servizi.osservaInAttesa(setN) : undefined), [servizi, attivo]);
  return n;
}

export function Guscio({ children }: { children: ReactNode }) {
  return (
    <ProviderFeedback>
      <GuscioInterno>{children}</GuscioInterno>
    </ProviderFeedback>
  );
}

function GuscioInterno({ children }: { children: ReactNode }) {
  const profilo = useProfilo();
  const { esci, demo } = useSessione();
  const [percorso] = useLocation();
  const [menu, setMenu] = useState(false);
  const staff = isStaff(profilo);
  const inAttesa = useInAttesa(staff);
  const { nonLette } = useFeedback();
  const feedbackAdmin = profilo.admin ? nonLette : 0;

  useEffect(() => conta('sessione'), []);

  const voci: VoceNav[] = [];
  if (profilo.medicoId) voci.push({ href: '/turni', etichetta: 'I miei turni', icona: 'calendario' });
  if (profilo.medicoId) voci.push({ href: '/feedback', etichetta: 'Feedback', icona: 'messaggio', badge: nonLette });
  if (staff) voci.push({ href: '/gestione', etichetta: 'Gestione', icona: 'utenti', badge: inAttesa + feedbackAdmin });
  const attiva = (href: string) => percorso === href || percorso.startsWith(`${href}/`);

  return (
    <div className={`guscio ${voci.length > 1 ? 'con-tab' : ''}`}>
      <a href="#contenuto" className="salta-contenuto">
        Vai al contenuto
      </a>
      <header className="testata">
        <div className="testata-interno">
          <Link href={voci[0]?.href ?? '/'} className="marchio" aria-label="GestioneTurni, pagina iniziale">
            <Marchio lato={30} />
            <span className="marchio-testo">
              <span className="marchio-nome">GestioneTurni</span>
              <span className="marchio-sotto">Medici 112 · Genova</span>
            </span>
          </Link>
          {demo && <span className="etichetta etichetta-warn">Demo</span>}
          {voci.length > 1 && (
            <nav className="nav-principale" aria-label="Sezioni">
              {voci.map((v) => (
                <Link key={v.href} href={v.href} className="nav-voce" aria-current={attiva(v.href) ? 'page' : undefined}>
                  <Icona nome={v.icona} />
                  {v.etichetta}
                  {v.badge ? (
                    <span className="badge" aria-label={`${v.badge} da vedere`}>
                      {v.badge}
                    </span>
                  ) : null}
                </Link>
              ))}
            </nav>
          )}
          {voci.length === 1 && staff && inAttesa + feedbackAdmin > 0 && (
            <Link href={inAttesa > 0 ? '/gestione/account' : '/gestione/feedback'} className="btn btn-fantasma btn-piccolo avviso-attesa">
              <span className="badge">{inAttesa + feedbackAdmin}</span> da vedere
            </Link>
          )}
          <button type="button" className="avatar" onClick={() => setMenu(true)} aria-label={`Account di ${profilo.nome}`} aria-haspopup="dialog">
            {iniziali(profilo.nome)}
          </button>
        </div>
      </header>

      <main id="contenuto" tabIndex={-1}>
        {children}
      </main>

      {voci.length > 1 && (
        <nav className="tab-basso" aria-label="Sezioni">
          {voci.map((v) => (
            <Link key={v.href} href={v.href} className="tab-voce" aria-current={attiva(v.href) ? 'page' : undefined}>
              <span className="tab-icona">
                <Icona nome={v.icona} />
                {v.badge ? <span className="badge badge-tab">{v.badge}</span> : null}
              </span>
              <span>{v.etichetta}</span>
            </Link>
          ))}
        </nav>
      )}

      <Dialogo aperto={menu} titolo="Account" onChiudi={() => setMenu(false)}>
        <div className="scheda-account">
          <span className="avatar avatar-grande" aria-hidden="true">
            {iniziali(profilo.nome)}
          </span>
          <div>
            <strong>{profilo.nome}</strong>
            <p className="testo-tenue">{profilo.email}</p>
            <p className="testo-tenue">{ruolo(profilo)}</p>
          </div>
        </div>
        <div className="riga-impostazione">
          <span>Aspetto</span>
          <SelettoreTema />
        </div>
        <button type="button" className="btn btn-secondario btn-blocco" onClick={() => void esci()}>
          <Icona nome="esci" /> Esci
        </button>
        <p className="nota">All’uscita i dati salvati su questo dispositivo vengono cancellati.</p>
      </Dialogo>
    </div>
  );
}
