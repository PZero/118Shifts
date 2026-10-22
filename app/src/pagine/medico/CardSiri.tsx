// "Siri e CarPlay": attivazione del Comando rapido che legge a voce il turno di oggi.
// Contratto dati e regole: riga siri/{chiave} di docs/MODELLO-DATI.md; guida: docs/SIRI.md.

import { useCallback, useEffect, useId, useState } from 'react';
import type { DataISO } from '../../domain/date';
import { useServizi } from '../../sessione/contesto';
import type { CambioDoc, ChiaveSiri, MeseDoc, Sedi, VoceElenco } from '../../servizi/tipi';
import { calcolaFrasi, dimenticaSincronizzazione, generaChiave, LINK_COMANDO_SIRI, testoAppunti } from '../../servizi/siri';
import { copiaNegliAppunti } from '../../ui/appunti';
import { Dialogo } from '../../ui/Dialogo';
import { messaggioErroreGenerico } from '../../ui/errori';
import { Icona } from '../../ui/Icona';
import { caricaQuadro } from './quadriCache';

interface Props {
  medicoId: string;
  oggi: DataISO;
  mesi: readonly MeseDoc[];
  cambi: readonly CambioDoc[];
  elenco: readonly VoceElenco[];
  sedi: Sedi;
}

export function CardSiri({ medicoId, oggi, mesi, cambi, elenco, sedi }: Props) {
  const servizi = useServizi();
  const id = useId();
  const [chiavi, setChiavi] = useState<ChiaveSiri[] | null>(null);
  const [anteprima, setAnteprima] = useState<{ testo?: string; primaDelle8?: string } | null>(null);
  const [occupato, setOccupato] = useState(false);
  const [esito, setEsito] = useState<{ tono: 'ok' | 'info'; testo: string } | null>(null);
  const [errore, setErrore] = useState<string>();
  const [conferma, setConferma] = useState(false);

  const calcola = useCallback(
    () => calcolaFrasi({ medicoId, mesi, cambi, elenco, sedi, oggi, caricaQuadro: (k) => caricaQuadro(servizi, k) }),
    [servizi, medicoId, mesi, cambi, elenco, sedi, oggi],
  );

  useEffect(() => {
    let attivo = true;
    servizi
      .siriMie()
      .then((c) => attivo && setChiavi(c))
      .catch(() => attivo && setChiavi([]));
    return () => {
      attivo = false;
    };
  }, [servizi]);

  useEffect(() => {
    let attivo = true;
    calcola()
      .then((f) => attivo && setAnteprima(f[oggi] ?? {}))
      .catch(() => attivo && setAnteprima({}));
    return () => {
      attivo = false;
    };
  }, [calcola, oggi]);

  const attiva = async () => {
    setErrore(undefined);
    setEsito(null);
    setOccupato(true);
    // La copia parte subito, dentro il tocco: su iOS dopo un'attesa asincrona verrebbe rifiutata.
    const chiave = generaChiave();
    const copiata = copiaNegliAppunti(testoAppunti(chiave));
    try {
      await servizi.siriCrea(medicoId, chiave, await calcola());
      dimenticaSincronizzazione(medicoId);
      const ok = await copiata;
      setChiavi(await servizi.siriMie());
      if (LINK_COMANDO_SIRI) {
        setEsito({ tono: 'ok', testo: ok ? 'Chiave copiata. Apro il Comando rapido…' : 'Siri attivato. Usa «Copia di nuovo la chiave» e aggiungi il comando.' });
        window.location.href = LINK_COMANDO_SIRI;
      } else {
        setEsito({
          tono: 'info',
          testo: `Comando non ancora disponibile.${ok ? ' La chiave è già copiata negli appunti.' : ' Usa «Copia di nuovo la chiave».'}`,
        });
      }
    } catch (e) {
      setErrore(messaggioErroreGenerico(e));
    } finally {
      setOccupato(false);
    }
  };

  const copiaDiNuovo = async () => {
    const c = chiavi?.[0];
    if (!c) return;
    setErrore(undefined);
    const ok = await copiaNegliAppunti(testoAppunti(c.chiave));
    if (ok) setEsito({ tono: 'ok', testo: 'Chiave copiata negli appunti.' });
    else setErrore('Non riesco a copiare negli appunti: riprova.');
  };

  const disattiva = async () => {
    setOccupato(true);
    setErrore(undefined);
    try {
      await servizi.siriElimina((chiavi ?? []).map((c) => c.chiave));
      dimenticaSincronizzazione(medicoId);
      setChiavi([]);
      setEsito({ tono: 'info', testo: 'Siri disattivato: i comandi già installati smetteranno di rispondere.' });
    } catch (e) {
      setErrore(messaggioErroreGenerico(e));
    } finally {
      setConferma(false);
      setOccupato(false);
    }
  };

  const n = chiavi?.length ?? 0;
  const attivo = n > 0;

  return (
    <section className="card" aria-labelledby={`${id}-t`}>
      <div className="card-corpo">
        <div className="metrica-testa">
          <h2 id={`${id}-t`} className="card-titolo">
            Siri e CarPlay
          </h2>
          {attivo && (
            <span className="etichetta etichetta-ok">
              Attivo su {n} {n === 1 ? 'dispositivo' : 'dispositivi'}
            </span>
          )}
        </div>

        <p className="testo-tenue" style={{ marginTop: 8 }}>
          Dì «Ehi Siri, Turni 118», poi chiedi ad esempio: «Dove lavoro oggi?», «Sarò di turno il 30 maggio?», «Chi mi può dare il cambio il 20 maggio?», «Chi lavora con me oggi?». Funziona anche in auto con CarPlay.
        </p>

        {anteprima?.testo && (
          <blockquote className="presentazione" style={{ marginTop: 10 }}>
            <small>Esempio: la risposta di oggi</small>
            <p>{anteprima.testo}</p>
            {anteprima.primaDelle8 && <p className="nota">Prima delle 8: {anteprima.primaDelle8}</p>}
          </blockquote>
        )}

        {!attivo && chiavi !== null && (
          <ol className="testo-tenue" style={{ margin: '10px 0 0', paddingLeft: 20 }}>
            <li>Tocca «Attiva Siri», poi «Aggiungi comando».</li>
            <li>Dì «Ehi Siri, Turni 118». La prima volta il comando legge la chiave copiata.</li>
          </ol>
        )}

        {errore && (
          <p className="avviso avviso-danger" role="alert" style={{ marginTop: 10 }}>
            <Icona nome="attenzione" /> {errore}
          </p>
        )}
        {esito && (
          <p className={`avviso ${esito.tono === 'ok' ? 'avviso-ok' : ''}`} role="status" style={{ marginTop: 10 }}>
            <Icona nome={esito.tono === 'ok' ? 'spunta' : 'info'} /> {esito.testo}
          </p>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {chiavi === null ? null : attivo ? (
            <>
              <button type="button" className="btn btn-secondario btn-piccolo" onClick={() => void copiaDiNuovo()} disabled={occupato}>
                <Icona nome="file" piccola /> Copia di nuovo la chiave
              </button>
              <button type="button" className="btn btn-secondario btn-piccolo" onClick={() => void attiva()} disabled={occupato}>
                <Icona nome="piu" piccola /> Aggiungi un dispositivo
              </button>
              <button type="button" className="btn btn-fantasma btn-piccolo testo-pericolo" onClick={() => setConferma(true)} disabled={occupato}>
                Disattiva Siri
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primario" onClick={() => void attiva()} disabled={occupato}>
              {occupato ? 'Attivazione…' : 'Attiva Siri'}
            </button>
          )}
        </div>
        <p className="nota" style={{ marginTop: 10 }}>
          <Icona nome="lucchetto" piccola /> La chiave è un segreto personale: chi la possiede legge le frasi dei tuoi turni. Non condividerla.
        </p>
      </div>

      <Dialogo
        aperto={conferma}
        titolo="Disattivare Siri?"
        onChiudi={() => setConferma(false)}
        piede={
          <>
            <button type="button" className="btn btn-secondario" onClick={() => setConferma(false)}>
              Annulla
            </button>
            <button type="button" className="btn btn-pericolo" onClick={() => void disattiva()} disabled={occupato}>
              <Icona nome="cestino" /> Disattiva
            </button>
          </>
        }
      >
        <p className="testo-tenue">Le chiavi di tutti i tuoi dispositivi vengono cancellate: Siri smette di rispondere finché non lo riattivi.</p>
      </Dialogo>
    </section>
  );
}
