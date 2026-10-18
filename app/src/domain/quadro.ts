// Quadro del mese: chi lavora in ogni giorno (tutti i medici), per la card "Chi è di turno con me".
// Logica pura; i codici sono quelli normalizzati salvati in turni/{medicoId}/mesi/{aaaa-mm}.giorni.
import { interpretaCodice, type Fascia, type TipoReperibilita } from './codici';

/** Un giorno del quadro: medicoId -> codici del giorno. */
export type GiornoQuadro = Readonly<Record<string, readonly string[]>>;
/** Documento quadro/{aaaa-mm}.giorni: numero del giorno ("1".."31") -> GiornoQuadro. */
export type GiorniQuadro = Record<string, Record<string, string[]>>;

export interface TurnoPerQuadro {
  medicoId: string;
  giorni: Readonly<Record<string, readonly string[]>>;
}

/** Costruisce `giorni` del quadro dai turni di ogni medico abbinato; solo chi ha almeno un codice quel giorno. */
export function costruisciQuadro(turni: readonly TurnoPerQuadro[]): GiorniQuadro {
  const out: GiorniQuadro = {};
  for (const t of turni) {
    for (const [giorno, codici] of Object.entries(t.giorni)) {
      if (codici.length === 0) continue;
      (out[giorno] ??= {})[t.medicoId] = [...codici];
    }
  }
  return out;
}

export interface CollegaInTurno { medicoId: string; codice: string; sede?: number }
export interface CollegaReperibile { medicoId: string; tipo: TipoReperibilita }
export interface GruppoChiConMe {
  fascia: Fascia;
  inTurno: CollegaInTurno[];
  reperibili: CollegaReperibile[];
}

const FASCE: readonly Fascia[] = ['M', 'P', 'N'];
const TIPI_PER_FASCIA: Record<Fascia, readonly TipoReperibilita[]> = {
  M: ['RM', 'RG'],
  P: ['RP', 'RG'],
  N: ['RN'],
};
const ORDINE_TIPO: Record<TipoReperibilita, number> = { RM: 0, RP: 1, RN: 2, RG: 3 };

/** Fasce coperte da una lista di codici (turni e reperibilità; RG = M e P). */
function fasceDi(codici: readonly string[]): Set<Fascia> {
  const s = new Set<Fascia>();
  for (const c of codici) {
    const i = interpretaCodice(c);
    if (!i) continue;
    if (i.categoria === 'turno' && i.fascia) s.add(i.fascia);
    else if (i.reperibilita) for (const f of FASCE) if (TIPI_PER_FASCIA[f].includes(i.reperibilita)) s.add(f);
  }
  return s;
}

export function chiConMe(giornoQuadro: GiornoQuadro | undefined, mioMedicoId: string, mieiCodici: readonly string[]): GruppoChiConMe[] {
  const mie = fasceDi(mieiCodici);
  const gruppi: GruppoChiConMe[] = [];
  for (const fascia of FASCE) {
    if (!mie.has(fascia)) continue;
    const inTurno: CollegaInTurno[] = [];
    const reperibili: CollegaReperibile[] = [];
    for (const [medicoId, codici] of Object.entries(giornoQuadro ?? {})) {
      if (medicoId === mioMedicoId) continue;
      let turnoTrovato = false;
      let tipoTrovato: TipoReperibilita | undefined;
      for (const c of codici) {
        const i = interpretaCodice(c);
        if (!i) continue;
        if (i.categoria === 'turno' && i.fascia === fascia && !turnoTrovato) {
          turnoTrovato = true;
          const voce: CollegaInTurno = { medicoId, codice: i.grezzo };
          if (i.sede !== undefined) voce.sede = i.sede;
          inTurno.push(voce);
        } else if (i.reperibilita && TIPI_PER_FASCIA[fascia].includes(i.reperibilita) && !tipoTrovato) {
          tipoTrovato = i.reperibilita;
        }
      }
      if (tipoTrovato) reperibili.push({ medicoId, tipo: tipoTrovato });
    }
    inTurno.sort((a, b) => (a.sede ?? 99) - (b.sede ?? 99) || a.medicoId.localeCompare(b.medicoId));
    reperibili.sort((a, b) => ORDINE_TIPO[a.tipo] - ORDINE_TIPO[b.tipo] || a.medicoId.localeCompare(b.medicoId));
    gruppi.push({ fascia, inTurno, reperibili });
  }
  return gruppi;
}

export interface CambioSede {
  medicoId: string;
  codice: string;
  fascia: Fascia;
  sede: number;
  /** 0 = stesso giorno del turno di partenza, 1 = giorno dopo, ecc. */
  giorniDopo: number;
}

/** Turno (con fascia e sede) di un medico in un giorno del quadro, ignorando le reperibilità. */
function turnoInFascia(codici: readonly string[] | undefined, fascia: Fascia): { codice: string; sede?: number } | null {
  for (const c of codici ?? []) {
    const i = interpretaCodice(c);
    if (i && i.categoria === 'turno' && i.fascia === fascia) {
      return i.sede !== undefined ? { codice: i.grezzo, sede: i.sede } : { codice: i.grezzo };
    }
  }
  return null;
}

/**
 * "Chi mi dà il cambio": chi sarà sulla mia stessa sede dopo di me. `giorni[0]` è il giorno del turno
 * di partenza, `giorni[1]` il giorno dopo, ecc. (undefined = non disponibile). I miei turni consecutivi
 * sulla stessa sede vengono saltati; al primo slot senza di me si cerca un altro medico con quella
 * sede (primo in ordine di medicoId). Nessuno nello slot, o slot in un giorno non disponibile: cambio null.
 * Restituisce null se non ho un turno con sede nella fascia di partenza.
 */
export function chiMiDaIlCambio(args: {
  medicoId: string;
  giorni: ReadonlyArray<GiornoQuadro | undefined>;
  fasciaPartenza: Fascia;
}): { sede: number; cambio: CambioSede | null } | null {
  const { medicoId, giorni, fasciaPartenza } = args;
  const mio = turnoInFascia(giorni[0]?.[medicoId], fasciaPartenza);
  if (!mio || mio.sede === undefined) return null;
  const sede = mio.sede;
  for (let slot = FASCE.indexOf(fasciaPartenza) + 1; ; slot++) {
    const giorniDopo = Math.floor(slot / 3);
    const fascia = FASCE[slot % 3]!;
    const giorno = giorni[giorniDopo];
    if (!giorno) return { sede, cambio: null };
    const io = turnoInFascia(giorno[medicoId], fascia);
    if (io && io.sede === sede) continue;
    const altri = Object.keys(giorno).filter((id) => id !== medicoId).sort((a, b) => a.localeCompare(b));
    for (const id of altri) {
      const t = turnoInFascia(giorno[id], fascia);
      if (t && t.sede === sede) return { sede, cambio: { medicoId: id, codice: t.codice, fascia, sede, giorniDopo } };
    }
    return { sede, cambio: null };
  }
}

const FINE_FASCIA: Record<Fascia, number> = { M: 14, P: 20, N: 32 };

function fasceTurno(codici: readonly string[] | undefined): Fascia[] {
  const s = new Set<Fascia>();
  for (const c of codici ?? []) {
    const i = interpretaCodice(c);
    if (i && i.categoria === 'turno' && i.fascia) s.add(i.fascia);
  }
  return FASCE.filter((f) => s.has(f));
}

/**
 * Turno di partenza per la card: con giorno scelto a calendario (`ora` assente) = primo turno del giorno;
 * per "oggi" = il turno in corso o il prossimo di oggi, e prima delle 8 la notte iniziata ieri se c'è.
 */
export function turnoDiPartenza(args: {
  mieiCodiciIeri?: readonly string[];
  mieiCodiciOggi: readonly string[];
  ora?: number;
}): { giorno: 'ieri' | 'oggi'; fascia: Fascia } | null {
  const oggi = fasceTurno(args.mieiCodiciOggi);
  const { ora } = args;
  if (ora === undefined) return oggi[0] ? { giorno: 'oggi', fascia: oggi[0] } : null;
  if (ora < 8 && fasceTurno(args.mieiCodiciIeri).includes('N')) return { giorno: 'ieri', fascia: 'N' };
  const f = oggi.find((x) => FINE_FASCIA[x] > ora);
  return f ? { giorno: 'oggi', fascia: f } : null;
}
