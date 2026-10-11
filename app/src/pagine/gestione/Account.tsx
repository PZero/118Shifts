// Account: approvazione (associazione a un medico, principale o secondario), disabilitazione, delegati.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { testoUltimoAccesso } from '../../domain/accessi';
import { isStaff, useProfilo, useServizi } from '../../sessione/contesto';
import type { MedicoAnagrafica, StatoAccount, Utente } from '../../servizi/tipi';
import { Dialogo } from '../../ui/Dialogo';
import { messaggioErroreGenerico } from '../../ui/errori';
import { Icona } from '../../ui/Icona';

type Filtro = 'attesa' | 'approvato' | 'disabilitato' | 'tutti';

const NOME_STATO: Record<StatoAccount, string> = { attesa: 'In attesa', approvato: 'Approvato', disabilitato: 'Disabilitato' };
const TONO_STATO: Record<StatoAccount, string> = { attesa: 'etichetta-warn', approvato: 'etichetta-ok', disabilitato: 'etichetta-danger' };

export function Account() {
  const servizi = useServizi();
  const io = useProfilo();
  const [utenti, setUtenti] = useState<Utente[] | null>(null);
  const [medici, setMedici] = useState<MedicoAnagrafica[]>([]);
  const [errore, setErrore] = useState<string>();
  const [filtro, setFiltro] = useState<Filtro>('attesa');
  const [cerca, setCerca] = useState('');
  const [daAssociare, setDaAssociare] = useState<Utente | null>(null);
  const [conferma, setConferma] = useState<{ utente: Utente; azione: 'disabilita' | 'riattiva' | 'delegato-si' | 'delegato-no' } | null>(null);
  const [esito, setEsito] = useState<string>();

  const carica = useCallback(async () => {
    try {
      const [u, m] = await Promise.all([servizi.utenti(), servizi.medici()]);
      setUtenti(u.sort((a, b) => (b.creatoIl?.getTime() ?? 0) - (a.creatoIl?.getTime() ?? 0)));
      setMedici(m);
      setErrore(undefined);
    } catch (e) {
      setErrore(messaggioErroreGenerico(e));
    }
  }, [servizi]);

  useEffect(() => {
    void carica();
  }, [carica]);

  const perMedico = useMemo(() => new Map(medici.map((m) => [m.id, m])), [medici]);
  const conteggi = useMemo(() => {
    const c = { attesa: 0, approvato: 0, disabilitato: 0, tutti: utenti?.length ?? 0 };
    for (const u of utenti ?? []) c[u.stato]++;
    return c;
  }, [utenti]);

  const visibili = (utenti ?? []).filter((u) => {
    if (filtro !== 'tutti' && u.stato !== filtro) return false;
    const q = cerca.trim().toLowerCase();
    if (!q) return true;
    const medico = u.medicoId ? perMedico.get(u.medicoId)?.nome ?? '' : '';
    return `${u.nome} ${u.email} ${medico}`.toLowerCase().includes(q);
  });

  /** Un delegato non gestisce sé stesso né altri delegati (regole Firestore). */
  const gestibile = (u: Utente) => io.admin || (isStaff(io) && u.uid !== io.uid && !u.delegato);

  const esegui = async () => {
    if (!conferma) return;
    const { utente, azione } = conferma;
    try {
      if (azione === 'disabilita') await servizi.impostaStato(utente, 'disabilitato');
      if (azione === 'riattiva') await servizi.impostaStato(utente, utente.medicoId ? 'approvato' : 'attesa');
      if (azione === 'delegato-si') await servizi.impostaDelegato(utente, true);
      if (azione === 'delegato-no') await servizi.impostaDelegato(utente, false);
      setEsito('Modifica salvata.');
      setConferma(null);
      await carica();
    } catch (e) {
      setErrore(messaggioErroreGenerico(e));
      setConferma(null);
    }
  };

  return (
    <section aria-labelledby="titolo-account">
      <div className="intestazione-sezione">
        <div>
          <h1 id="titolo-account">Account</h1>
          <p className="testo-tenue">Approva i nuovi accessi associandoli a un medico dell’anagrafica.</p>
        </div>
      </div>

      <div className="barra-filtri">
        <div className="segmenti segmenti-scorrevoli" role="tablist" aria-label="Filtra per stato">
          {(['attesa', 'approvato', 'disabilitato', 'tutti'] as const).map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filtro === f} onClick={() => setFiltro(f)}>
              {f === 'tutti' ? 'Tutti' : NOME_STATO[f]} <span className="conteggio num">{conteggi[f]}</span>
            </button>
          ))}
        </div>
        <label className="campo-cerca">
          <Icona nome="cerca" piccola />
          <span className="sr-only">Cerca</span>
          <input className="input" type="search" placeholder="Cerca nome, email o medico" value={cerca} onChange={(e) => setCerca(e.target.value)} />
        </label>
      </div>

      {errore && (
        <p className="avviso avviso-danger" role="alert">
          <Icona nome="attenzione" /> {errore}
        </p>
      )}
      {esito && (
        <p className="avviso avviso-ok" role="status">
          <Icona nome="spunta" /> {esito}
        </p>
      )}

      {utenti === null ? (
        <div className="scheletro" style={{ height: 240 }} />
      ) : visibili.length === 0 ? (
        <div className="vuoto">
          <Icona nome={filtro === 'attesa' ? 'spunta' : 'utenti'} />
          <p>{filtro === 'attesa' ? 'Nessun account in attesa di approvazione.' : 'Nessun account in questo elenco.'}</p>
        </div>
      ) : (
        <ul className="elenco-righe" role="list">
          {visibili.map((u) => {
            const medico = u.medicoId ? perMedico.get(u.medicoId) : undefined;
            const puo = gestibile(u);
            return (
              <li key={u.uid} className="riga-elenco">
                <div className="riga-elenco-principale">
                  <div className="riga-elenco-nome">
                    <strong>{u.nome}</strong>
                    <span className={`etichetta ${TONO_STATO[u.stato]}`}>{NOME_STATO[u.stato]}</span>
                    {u.delegato && (
                      <span className="etichetta etichetta-info">
                        <Icona nome="stella" piccola /> Delegato
                      </span>
                    )}
                  </div>
                  <span className="testo-tenue riga-elenco-email">{u.email}</span>
                  {medico && (
                    <span className="riga-elenco-medico">
                      <Icona nome="medici" piccola /> {medico.nome} · {u.principale ? 'principale' : 'secondario'}
                      {!medico.attivo && <span className="etichetta etichetta-danger">medico disabilitato</span>}
                    </span>
                  )}
                  {u.creatoIl && <span className="nota">Richiesta del {u.creatoIl.toLocaleDateString('it-IT')}</span>}
                  {u.stato !== 'attesa' && <span className="nota">Ultimo accesso: {testoUltimoAccesso(u.ultimoAccesso)}</span>}
                </div>
                <div className="riga-elenco-azioni">
                  {!puo ? (
                    <span className="nota">
                      <Icona nome="lucchetto" piccola /> {u.uid === io.uid ? 'Il tuo account' : 'Gestito dall’amministratore'}
                    </span>
                  ) : (
                    <>
                      {u.stato !== 'disabilitato' && (
                        <button type="button" className={`btn btn-piccolo ${u.stato === 'attesa' ? 'btn-primario' : 'btn-secondario'}`} onClick={() => setDaAssociare(u)}>
                          {u.stato === 'attesa' ? 'Approva' : 'Associazione'}
                        </button>
                      )}
                      {io.admin && u.stato === 'approvato' && (
                        <button type="button" className="btn btn-secondario btn-piccolo" onClick={() => setConferma({ utente: u, azione: u.delegato ? 'delegato-no' : 'delegato-si' })}>
                          {u.delegato ? 'Revoca delega' : 'Nomina delegato'}
                        </button>
                      )}
                      {u.stato === 'disabilitato' ? (
                        <button type="button" className="btn btn-secondario btn-piccolo" onClick={() => setConferma({ utente: u, azione: 'riattiva' })}>
                          Riattiva
                        </button>
                      ) : (
                        <button type="button" className="btn btn-fantasma btn-piccolo testo-pericolo" onClick={() => setConferma({ utente: u, azione: 'disabilita' })}>
                          Disabilita
                        </button>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <DialogoAssocia
        utente={daAssociare}
        medici={medici}
        utenti={utenti ?? []}
        onChiudi={() => setDaAssociare(null)}
        onFatto={async (msg) => {
          setDaAssociare(null);
          setEsito(msg);
          await carica();
        }}
      />

      <Dialogo
        aperto={conferma !== null}
        titolo={
          conferma?.azione === 'disabilita'
            ? 'Disabilitare l’account?'
            : conferma?.azione === 'riattiva'
              ? 'Riattivare l’account?'
              : conferma?.azione === 'delegato-si'
                ? 'Nominare delegato?'
                : 'Revocare la delega?'
        }
        onChiudi={() => setConferma(null)}
        descrizione={conferma ? `${conferma.utente.nome} (${conferma.utente.email})` : undefined}
        piede={
          <>
            <button type="button" className="btn btn-secondario" onClick={() => setConferma(null)}>
              Annulla
            </button>
            <button type="button" className={`btn ${conferma?.azione === 'disabilita' ? 'btn-pericolo' : 'btn-primario'}`} onClick={() => void esegui()}>
              Conferma
            </button>
          </>
        }
      >
        <p className="testo-tenue">
          {conferma?.azione === 'disabilita' && 'L’account non potrà più leggere alcun dato finché non viene riattivato.'}
          {conferma?.azione === 'riattiva' && 'L’account torna attivo con l’associazione precedente.'}
          {conferma?.azione === 'delegato-si' && 'Il delegato potrà approvare e disabilitare account, gestire l’anagrafica e caricare l’Excel.'}
          {conferma?.azione === 'delegato-no' && 'L’account resta attivo come medico, senza funzioni di gestione.'}
        </p>
      </Dialogo>
    </section>
  );
}

function DialogoAssocia({
  utente,
  medici,
  utenti,
  onChiudi,
  onFatto,
}: {
  utente: Utente | null;
  medici: MedicoAnagrafica[];
  utenti: Utente[];
  onChiudi: () => void;
  onFatto: (messaggio: string) => Promise<void>;
}) {
  return (
    <Dialogo aperto={utente !== null} titolo={utente?.stato === 'attesa' ? 'Approva account' : 'Associazione account'} onChiudi={onChiudi}>
      {utente && <ModuloAssocia key={utente.uid} utente={utente} medici={medici} utenti={utenti} onChiudi={onChiudi} onFatto={onFatto} />}
    </Dialogo>
  );
}

function ModuloAssocia({
  utente,
  medici,
  utenti,
  onChiudi,
  onFatto,
}: {
  utente: Utente;
  medici: MedicoAnagrafica[];
  utenti: Utente[];
  onChiudi: () => void;
  onFatto: (messaggio: string) => Promise<void>;
}) {
  const servizi = useServizi();
  const [medicoId, setMedicoId] = useState(utente.medicoId ?? '');
  const medico = medici.find((m) => m.id === medicoId);
  const exPrincipale = medico?.principaleUid && medico.principaleUid !== utente.uid ? utenti.find((u) => u.uid === medico.principaleUid) : undefined;
  const [principale, setPrincipale] = useState(utente.medicoId ? utente.principale : true);
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string>();
  const attivi = medici.filter((m) => m.attivo || m.id === utente.medicoId);

  // Se il medico non ha ancora un principale, il primo account lo diventa per default.
  const cambiaMedico = (id: string) => {
    setMedicoId(id);
    const m = medici.find((x) => x.id === id);
    setPrincipale(!m?.principaleUid || m.principaleUid === utente.uid);
  };

  const salva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicoId) return setErrore('Scegli il medico da associare.');
    setInvio(true);
    setErrore(undefined);
    try {
      await servizi.associa(utente, medicoId, principale);
      await onFatto(`${utente.nome} associato a ${medico?.nome ?? 'medico'} come account ${principale ? 'principale' : 'secondario'}.`);
    } catch (err) {
      setErrore(messaggioErroreGenerico(err));
      setInvio(false);
    }
  };

  return (
    <form className="modulo" onSubmit={salva}>
      <div className="scheda-account">
        <span className="avatar avatar-grande" aria-hidden="true">
          <Icona nome="utente" />
        </span>
        <div>
          <strong>{utente.nome}</strong>
          <p className="testo-tenue">{utente.email}</p>
        </div>
      </div>
      <label className="campo">
        <span>Medico dell’anagrafica</span>
        <select className="select" value={medicoId} onChange={(e) => cambiaMedico(e.target.value)} required>
          <option value="">Scegli…</option>
          {attivi.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
        <small>Il medico va prima inserito in anagrafica (o creato dal caricamento dell’Excel).</small>
      </label>
      <fieldset className="campo campo-gruppo">
        <legend>Tipo di account</legend>
        <label className="opzione">
          <input type="radio" name="tipo" checked={principale} onChange={() => setPrincipale(true)} />
          <span>
            <strong>Principale</strong>
            <small>Unico per medico: può inserire e annullare i cambi turno.</small>
          </span>
        </label>
        <label className="opzione">
          <input type="radio" name="tipo" checked={!principale} onChange={() => setPrincipale(false)} />
          <span>
            <strong>Secondario</strong>
            <small>Vede turni e cambi in sola lettura.</small>
          </span>
        </label>
      </fieldset>
      {principale && medico?.principaleUid && medico.principaleUid !== utente.uid && (
        <p className="avviso avviso-warn">
          <Icona nome="attenzione" />
          <span>
            {exPrincipale ? <strong>{exPrincipale.nome}</strong> : 'Un altro account'} è oggi l’account principale di {medico.nome}: diventerà secondario.
          </span>
        </p>
      )}
      {errore && (
        <p className="avviso avviso-danger" role="alert">
          <Icona nome="attenzione" /> {errore}
        </p>
      )}
      <div className="dialogo-piede dialogo-piede-interno">
        <button type="button" className="btn btn-secondario" onClick={onChiudi}>
          Annulla
        </button>
        <button type="submit" className="btn btn-primario" disabled={invio || !medicoId}>
          {invio ? 'Salvataggio…' : utente.stato === 'attesa' ? 'Approva' : 'Salva'}
        </button>
      </div>
    </form>
  );
}
