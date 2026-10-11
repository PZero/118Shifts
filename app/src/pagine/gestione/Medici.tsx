// Anagrafica medici: nome, alias, attivo, ancora del ciclo (automatica o corretta a mano).

import { Link } from 'wouter';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { accessoPiuRecente, testoUltimoAccesso } from '../../domain/accessi';
import { chiaviInConflitto, conAlias, normalizzaNome } from '../../domain/anagrafica';
import { trovaAncora } from '../../domain/proiezione';
import { useServizi } from '../../sessione/contesto';
import type { MedicoAnagrafica, Utente } from '../../servizi/tipi';
import { Dialogo } from '../../ui/Dialogo';
import { messaggioErroreGenerico } from '../../ui/errori';
import { Icona } from '../../ui/Icona';
import { dataEstesa } from '../../ui/etichette';

type Bozza = Omit<MedicoAnagrafica, 'id'> & { id?: string };

const NUOVO: Bozza = { nome: '', alias: [], attivo: true, cicloManuale: false };

export function Medici() {
  const servizi = useServizi();
  const [medici, setMedici] = useState<MedicoAnagrafica[] | null>(null);
  const [utenti, setUtenti] = useState<Utente[] | null>([]);
  const [errore, setErrore] = useState<string>();
  const [cerca, setCerca] = useState('');
  const [mostraInattivi, setMostraInattivi] = useState(false);
  const [bozza, setBozza] = useState<Bozza | null>(null);

  const carica = useCallback(async () => {
    try {
      setMedici(await servizi.medici());
    } catch (e) {
      setErrore(messaggioErroreGenerico(e));
    }
    // Gli accessi sono un di più: se la lettura fallisce l'elenco resta utilizzabile.
    try {
      setUtenti(await servizi.utenti());
    } catch {
      setUtenti(null);
    }
  }, [servizi]);
  const accessoPerMedico = useMemo(() => {
    const per = new Map<string, Date[]>();
    for (const u of utenti ?? []) if (u.medicoId && u.ultimoAccesso) per.set(u.medicoId, [...(per.get(u.medicoId) ?? []), u.ultimoAccesso]);
    return new Map([...per].map(([id, date]) => [id, accessoPiuRecente(date)]));
  }, [utenti]);
  useEffect(() => {
    void carica();
  }, [carica]);

  const conflitti = useMemo(() => (medici ? chiaviInConflitto(medici) : []), [medici]);
  const q = normalizzaNome(cerca);
  const visibili = (medici ?? []).filter(
    (m) => (mostraInattivi || m.attivo) && (!q || [m.nome, ...m.alias].some((n) => normalizzaNome(n).includes(q))),
  );

  return (
    <section aria-labelledby="titolo-medici">
      <div className="intestazione-sezione">
        <div>
          <h1 id="titolo-medici">Anagrafica medici</h1>
          <p className="testo-tenue">Gli alias servono ad abbinare le varianti del nome che compaiono nell’Excel.</p>
        </div>
        <button type="button" className="btn btn-primario" onClick={() => setBozza({ ...NUOVO })}>
          <Icona nome="piu" /> Nuovo medico
        </button>
      </div>

      <div className="barra-filtri">
        <label className="campo-cerca">
          <Icona nome="cerca" piccola />
          <span className="sr-only">Cerca</span>
          <input className="input" type="search" placeholder="Cerca per nome o alias" value={cerca} onChange={(e) => setCerca(e.target.value)} />
        </label>
        <label className="interruttore">
          <input type="checkbox" checked={mostraInattivi} onChange={(e) => setMostraInattivi(e.target.checked)} />
          <span>Mostra disabilitati</span>
        </label>
      </div>

      {errore && (
        <p className="avviso avviso-danger" role="alert">
          <Icona nome="attenzione" /> {errore}
        </p>
      )}
      {conflitti.length > 0 && (
        <p className="avviso avviso-warn">
          <Icona nome="attenzione" />
          <span>
            Nomi o alias uguali su più medici ({conflitti.join(', ')}): l’abbinamento dell’Excel sarà ambiguo finché non vengono corretti.
          </span>
        </p>
      )}

      {medici === null ? (
        <div className="scheletro" style={{ height: 240 }} />
      ) : visibili.length === 0 ? (
        <div className="vuoto">
          <Icona nome="medici" />
          <p>Nessun medico. Puoi crearli qui o dal caricamento dell’Excel.</p>
        </div>
      ) : (
        <div className="tabella-contenitore">
          <table className="tabella">
            <thead>
              <tr>
                <th scope="col">Medico</th>
                <th scope="col">Alias</th>
                <th scope="col">Ciclo</th>
                <th scope="col">Stato</th>
                <th scope="col">Ultimo accesso</th>
                <th scope="col">
                  <span className="sr-only">Azioni</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibili.map((m) => (
                <tr key={m.id}>
                  <th scope="row">
                    <Link href={`/gestione/medici/${m.id}`} className="link-medico">
                      {m.nome}
                    </Link>
                  </th>
                  <td>
                    <span className="alias">
                      {m.alias.length === 0 ? <span className="testo-tenue">—</span> : m.alias.map((a) => <span key={a} className="etichetta">{a}</span>)}
                    </span>
                  </td>
                  <td>
                    {m.cicloManuale && m.cicloInizio ? (
                      <span className="etichetta etichetta-info">Manuale · {m.cicloInizio}</span>
                    ) : (
                      <span className="testo-tenue">Automatico</span>
                    )}
                  </td>
                  <td>{m.attivo ? <span className="etichetta etichetta-ok">Abilitato</span> : <span className="etichetta etichetta-danger">Disabilitato</span>}</td>
                  <td>
                    {accessoPerMedico.get(m.id) ? (
                      <span style={{ whiteSpace: 'nowrap' }}>{testoUltimoAccesso(accessoPerMedico.get(m.id))}</span>
                    ) : (
                      <span className="testo-tenue">{utenti ? 'mai' : '—'}</span>
                    )}
                  </td>
                  <td className="cella-azioni">
                    <button type="button" className="btn btn-secondario btn-piccolo" onClick={() => setBozza({ ...m })} aria-label={`Modifica ${m.nome}`}>
                      <Icona nome="matita" piccola /> Modifica
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialogo aperto={bozza !== null} titolo={bozza?.id ? 'Modifica medico' : 'Nuovo medico'} onChiudi={() => setBozza(null)}>
        {bozza && (
          <ModuloMedico
            key={bozza.id ?? 'nuovo'}
            iniziale={bozza}
            onChiudi={() => setBozza(null)}
            onSalvato={async () => {
              setBozza(null);
              await carica();
            }}
          />
        )}
      </Dialogo>
    </section>
  );
}

function ModuloMedico({ iniziale, onChiudi, onSalvato }: { iniziale: Bozza; onChiudi: () => void; onSalvato: () => Promise<void> }) {
  const servizi = useServizi();
  const [b, setB] = useState<Bozza>(iniziale);
  const [nuovoAlias, setNuovoAlias] = useState('');
  const [ancoraAuto, setAncoraAuto] = useState<string | null | undefined>(undefined);
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string>();

  // Ancora automatica calcolata dal dominio sugli ultimi turni reali del medico.
  useEffect(() => {
    if (!iniziale.id) {
      setAncoraAuto(null);
      return;
    }
    let attivo = true;
    servizi
      .turniMedico(iniziale.id)
      .then((mesi) => attivo && setAncoraAuto(trovaAncora(mesi.map((m) => ({ anno: m.anno, mese: m.mese, giorni: m.giorni })))))
      .catch(() => attivo && setAncoraAuto(null));
    return () => {
      attivo = false;
    };
  }, [servizi, iniziale.id]);

  const aggiungiAlias = () => {
    const prima = b.alias.length;
    const nuovo = conAlias({ id: b.id ?? '', nome: b.nome, alias: b.alias }, nuovoAlias);
    if (nuovo.alias.length === prima && nuovoAlias.trim()) setErrore('Alias già equivalente al nome o a un alias esistente.');
    else setErrore(undefined);
    setB({ ...b, alias: nuovo.alias });
    setNuovoAlias('');
  };

  const salva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!b.nome.trim()) return setErrore('Il nome è obbligatorio.');
    if (b.cicloManuale && !b.cicloInizio) return setErrore('Per la correzione manuale indica il giorno P di riferimento.');
    setInvio(true);
    try {
      await servizi.salvaMedico(b);
      await onSalvato();
    } catch (err) {
      setErrore(messaggioErroreGenerico(err));
      setInvio(false);
    }
  };

  return (
    <form className="modulo" onSubmit={salva}>
      <label className="campo">
        <span>Nome (come in anagrafica)</span>
        <input className="input" value={b.nome} onChange={(e) => setB({ ...b, nome: e.target.value })} maxLength={100} required autoComplete="off" />
      </label>

      <div className="campo">
        <span>Alias</span>
        <div className="alias">
          {b.alias.map((a) => (
            <span key={a} className="etichetta etichetta-rimovibile">
              {a}
              <button type="button" aria-label={`Rimuovi alias ${a}`} onClick={() => setB({ ...b, alias: b.alias.filter((x) => x !== a) })}>
                <Icona nome="chiudi" piccola />
              </button>
            </span>
          ))}
          {b.alias.length === 0 && <span className="testo-tenue">Nessun alias</span>}
        </div>
        <div className="riga-input">
          <input
            className="input"
            value={nuovoAlias}
            placeholder="Variante del nome nell’Excel"
            onChange={(e) => setNuovoAlias(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                aggiungiAlias();
              }
            }}
          />
          <button type="button" className="btn btn-secondario" onClick={aggiungiAlias} disabled={!nuovoAlias.trim()}>
            Aggiungi
          </button>
        </div>
      </div>

      <label className="interruttore">
        <input type="checkbox" checked={b.attivo} onChange={(e) => setB({ ...b, attivo: e.target.checked })} />
        <span>
          <strong>Medico abilitato</strong>
          <br />
          <small className="testo-tenue">Se disabilitato, i suoi account non leggono più alcun dato e sparisce dall’elenco dei colleghi.</small>
        </span>
      </label>

      <fieldset className="campo campo-gruppo">
        <legend>Ancora del ciclo di previsione</legend>
        <p className="testo-tenue">
          Automatica:{' '}
          {ancoraAuto === undefined ? 'calcolo…' : ancoraAuto ? <strong>{dataEstesa(ancoraAuto)}</strong> : 'nessuna sequenza P-M-N trovata'}
        </p>
        <label className="interruttore">
          <input type="checkbox" checked={b.cicloManuale} onChange={(e) => setB({ ...b, cicloManuale: e.target.checked })} />
          <span>Correggi a mano</span>
        </label>
        {b.cicloManuale && (
          <label className="campo">
            <span>Giorno P di riferimento</span>
            <input
              className="input"
              type="date"
              value={b.cicloInizio ?? ''}
              onChange={(e) => {
                const { cicloInizio: _scarta, ...resto } = b;
                setB(e.target.value ? { ...resto, cicloInizio: e.target.value } : resto);
              }}
            />
          </label>
        )}
      </fieldset>

      {errore && (
        <p className="avviso avviso-danger" role="alert">
          <Icona nome="attenzione" /> {errore}
        </p>
      )}
      <div className="dialogo-piede dialogo-piede-interno">
        <button type="button" className="btn btn-secondario" onClick={onChiudi}>
          Annulla
        </button>
        <button type="submit" className="btn btn-primario" disabled={invio}>
          {invio ? 'Salvataggio…' : 'Salva'}
        </button>
      </div>
    </form>
  );
}
