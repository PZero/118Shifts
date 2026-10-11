import { useState } from 'react';
import type { Fascia } from '../../domain/codici';
import type { NuovoCambio, Sedi, VoceElenco } from '../../servizi/tipi';
import { Dialogo } from '../../ui/Dialogo';
import { NOME_FASCIA, ORARIO_FASCIA, dataEstesa, etichettaCodice } from '../../ui/etichette';
import type { GiornoVista, VoceVista } from './vista';

export type RichiestaCambio =
  | { tipo: 'cedi'; giorno: GiornoVista; voce: VoceVista }
  | { tipo: 'ricevuto'; giorno: GiornoVista };

interface Props {
  richiesta: RichiestaCambio | null;
  colleghi: VoceElenco[];
  sedi: Sedi;
  onChiudi: () => void;
  onConferma: (c: NuovoCambio) => Promise<void>;
}

export function DialogoCambio({ richiesta, colleghi, sedi, onChiudi, onConferma }: Props) {
  // Chiave sul contenuto: lo stato interno riparte da zero a ogni apertura.
  const chiave = richiesta ? `${richiesta.tipo}-${richiesta.giorno.data}-${richiesta.tipo === 'cedi' ? richiesta.voce.indice : ''}` : 'chiuso';
  return (
    <Dialogo
      aperto={richiesta !== null}
      titolo={richiesta?.tipo === 'cedi' ? 'Cedi il turno' : 'Registra un turno ricevuto'}
      onChiudi={onChiudi}
    >
      {richiesta && (
        <ModuloCambio key={chiave} richiesta={richiesta} colleghi={colleghi} sedi={sedi} onChiudi={onChiudi} onConferma={onConferma} />
      )}
    </Dialogo>
  );
}

function ModuloCambio({ richiesta, colleghi, sedi, onChiudi, onConferma }: Props & { richiesta: RichiestaCambio }) {
  const [collegaId, setCollegaId] = useState('');
  const [fascia, setFascia] = useState<Fascia>('M');
  const [sede, setSede] = useState('');
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string>();

  const conferma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collegaId) {
      setErrore('Scegli il collega dall’elenco.');
      return;
    }
    const g = richiesta.giorno;
    const cambio: NuovoCambio =
      richiesta.tipo === 'cedi'
        ? { data: g.data, slot: richiesta.voce.indice === 1 ? 1 : 0, codice: richiesta.voce.codice, verso: 'ceduto', collegaId }
        : {
            data: g.data,
            slot: g.voci.filter((v) => v.stato !== 'ricevuto').length > 0 ? 1 : 0,
            codice: `${fascia}${sede}`,
            verso: 'ricevuto',
            collegaId,
          };
    setInvio(true);
    setErrore(undefined);
    try {
      await onConferma(cambio);
      onChiudi();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
      setInvio(false);
    }
  };

  return (
    <form onSubmit={conferma} className="modulo">
      <p className="testo-tenue">{dataEstesa(richiesta.giorno.data)}</p>

      {richiesta.tipo === 'cedi' ? (
        <div className="riepilogo-turno">
          <span className="etichetta">{richiesta.voce.codice}</span>
          <span>{etichettaCodice(richiesta.voce.info, sedi).lunga}</span>
        </div>
      ) : (
        <>
          <fieldset className="campo campo-gruppo">
            <legend>Turno ricevuto</legend>
            <div className="segmenti segmenti-larghi" role="group" aria-label="Fascia">
              {(['M', 'P', 'N'] as const).map((f) => (
                <button key={f} type="button" aria-pressed={fascia === f} onClick={() => setFascia(f)}>
                  {NOME_FASCIA[f]} <span className="testo-tenue num">{ORARIO_FASCIA[f]}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <label className="campo">
            <span>Sede</span>
            <select className="select" value={sede} onChange={(e) => setSede(e.target.value)}>
              <option value="">Non indicata</option>
              {Object.entries(sedi).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      <label className="campo">
        <span>{richiesta.tipo === 'cedi' ? 'Collega che riceve il turno' : 'Collega che ti ha ceduto il turno'}</span>
        <select className="select" value={collegaId} onChange={(e) => setCollegaId(e.target.value)} required>
          <option value="">Scegli dall’elenco…</option>
          {colleghi.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <small>Il cambio è privato: lo vedono solo i tuoi account.</small>
      </label>

      {errore && (
        <p className="avviso avviso-danger" role="alert">
          {errore}
        </p>
      )}

      <div className="dialogo-piede dialogo-piede-interno">
        <button type="button" className="btn btn-secondario" onClick={onChiudi}>
          Annulla
        </button>
        <button type="submit" className="btn btn-primario" disabled={invio}>
          {invio ? 'Salvataggio…' : 'Conferma cambio'}
        </button>
      </div>
    </form>
  );
}
