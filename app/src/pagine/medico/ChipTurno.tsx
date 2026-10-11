import type { Fascia } from '../../domain/codici';
import type { Sedi } from '../../servizi/tipi';
import { Icona } from '../../ui/Icona';
import { NOME_FASCIA, etichettaCodice, nomeSede } from '../../ui/etichette';
import type { VoceVista } from './vista';

interface Props {
  voce: VoceVista;
  sedi: Sedi;
  nomeCollega?: string;
  /** Mostra il nome della sede e del collega (celle larghe e dettaglio). */
  esteso?: boolean;
}

export function ChipTurno({ voce, sedi, nomeCollega, esteso }: Props) {
  const e = etichettaCodice(voce.info, sedi);
  const sede = voce.info?.categoria === 'turno' ? nomeSede(sedi, voce.info.sede) : undefined;
  return (
    <span className="voce">
      <span className={`chip chip-${e.tono} chip-${voce.stato}`}>
        {voce.stato === 'ricevuto' && <Icona nome="ricevuto" piccola />}
        <b>{e.breve}</b>
        {esteso && sede && <span className="chip-sede">{sede}</span>}
        {voce.stato === 'ceduto' && <span className="sr-only">(ceduto)</span>}
      </span>
      {esteso && voce.stato !== 'normale' && (
        <span className={`voce-collega voce-collega-${voce.stato}`}>
          {voce.stato === 'ceduto' ? '→ ' : 'da '}
          {nomeCollega ?? 'collega'}
        </span>
      )}
    </span>
  );
}

export function ChipPrevisione({ fascia, esteso }: { fascia: Fascia; esteso?: boolean }) {
  return (
    <span className="voce">
      <span className={`chip chip-${fascia} chip-previsione`} title="Turno previsto (indicativo)">
        <b>{fascia}</b>
        {esteso && <span className="chip-sede">{NOME_FASCIA[fascia]}</span>}
        <span className="sr-only">previsto</span>
      </span>
    </span>
  );
}
