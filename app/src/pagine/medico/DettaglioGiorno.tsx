import type { CambioDoc, Sedi } from '../../servizi/tipi';
import { Icona } from '../../ui/Icona';
import { NOME_FASCIA, ORARIO_FASCIA, dataEstesa, etichettaCodice } from '../../ui/etichette';
import { ChipPrevisione, ChipTurno } from './ChipTurno';
import type { GiornoVista, VoceVista } from './vista';

interface Props {
  giorno: GiornoVista;
  sedi: Sedi;
  nomi: Map<string, string>;
  /** Solo l'account principale modifica i cambi. */
  puoModificare: boolean;
  onCedi: (giorno: GiornoVista, voce: VoceVista) => void;
  onRicevuto: (giorno: GiornoVista) => void;
  onAnnulla: (cambio: CambioDoc) => void;
}

export function DettaglioGiorno({ giorno, sedi, nomi, puoModificare, onCedi, onRicevuto, onAnnulla }: Props) {
  const nome = (id?: string) => nomi.get(id ?? '') ?? 'collega non in elenco';
  return (
    <section className="card dettaglio" aria-labelledby="titolo-dettaglio" aria-live="polite">
      <div className="card-corpo">
        <div className="dettaglio-testa">
          <h2 id="titolo-dettaglio" className="dettaglio-data">
            {dataEstesa(giorno.data)}
          </h2>
          <div className="dettaglio-etichette">
            {giorno.festa && <span className="etichetta etichetta-danger">{giorno.festa}</span>}
            {!giorno.festa && giorno.domenica && <span className="etichetta etichetta-danger">Domenica</span>}
            {giorno.sabato && <span className="etichetta etichetta-info">Sabato</span>}
            {giorno.oggi && <span className="etichetta">Oggi</span>}
          </div>
        </div>

        {giorno.previsione ? (
          <div className="dettaglio-lista">
            {giorno.previsione.map((f) => (
              <div className="riga-voce" key={f}>
                <ChipPrevisione fascia={f} esteso />
                <div className="riga-voce-testo">
                  <strong>{NOME_FASCIA[f]} {ORARIO_FASCIA[f]}</strong>
                  <span>Previsione indicativa dal ciclo MP-N: non è un turno pubblicato.</span>
                </div>
              </div>
            ))}
          </div>
        ) : giorno.voci.length === 0 ? (
          <p className="testo-tenue">Nessun turno in questo giorno.</p>
        ) : (
          <ul className="dettaglio-lista" role="list">
            {giorno.voci.map((v) => {
              const e = etichettaCodice(v.info, sedi);
              const turno = v.info?.categoria === 'turno';
              return (
                <li key={`${v.indice}-${v.codice}`} className={`riga-voce riga-${v.stato}`}>
                  <ChipTurno voce={v} sedi={sedi} />
                  <div className="riga-voce-testo">
                    <strong className={v.stato === 'ceduto' ? 'barrato' : undefined}>{e.lunga}</strong>
                    {v.stato === 'ceduto' && (
                      <span className="testo-cambio">
                        <Icona nome="scambio" piccola /> Ceduto a <b>{nome(v.collegaId)}</b>
                      </span>
                    )}
                    {v.stato === 'ricevuto' && (
                      <span className="testo-cambio">
                        <Icona nome="ricevuto" piccola /> Ricevuto da <b>{nome(v.collegaId)}</b>
                      </span>
                    )}
                  </div>
                  {puoModificare && turno && v.stato === 'normale' && (
                    <button type="button" className="btn btn-secondario btn-piccolo" onClick={() => onCedi(giorno, v)}>
                      Cedi
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {giorno.ore > 0 && (
          <p className="dettaglio-ore num">
            <Icona nome="orologio" piccola /> {giorno.ore} ore conteggiate in questo giorno
          </p>
        )}

        {giorno.cambi.length > 0 && (
          <div className="dettaglio-cambi">
            <h3 className="sottotitolo">Cambi registrati</h3>
            <ul role="list">
              {giorno.cambi.map((c) => (
                <li key={c.id} className="riga-cambio">
                  <span className={`etichetta ${c.verso === 'ricevuto' ? 'etichetta-cambio' : ''}`}>
                    {c.verso === 'ceduto' ? 'Ceduto' : 'Ricevuto'}
                  </span>
                  <span className="riga-cambio-testo">
                    <b>{c.codice}</b> {c.verso === 'ceduto' ? 'a' : 'da'} {nome(c.collegaId)}
                  </span>
                  {puoModificare && (
                    <button type="button" className="btn btn-fantasma btn-piccolo" onClick={() => onAnnulla(c)}>
                      Annulla
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {puoModificare && !giorno.previsione && (
          <button type="button" className="btn btn-secondario btn-blocco" onClick={() => onRicevuto(giorno)}>
            <Icona nome="ricevuto" /> Registra un turno ricevuto
          </button>
        )}
      </div>
    </section>
  );
}
