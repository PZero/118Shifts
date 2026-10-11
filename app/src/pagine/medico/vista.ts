// Modello di vista del mese: compone i risultati del dominio (cambi, ore, festività, proiezione)
// in una struttura pronta da disegnare. Nessuna regola di calcolo qui: solo composizione.

import { applicaCambi, type VoceTurno } from '../../domain/cambi';
import { interpretaCodice, type CodiceTurno, type Fascia } from '../../domain/codici';
import {
  aggiungiMesi,
  chiaveMese,
  confrontaMesi,
  dataISO,
  giorniNelMese,
  giornoSettimana,
  type AnnoMese,
  type DataISO,
} from '../../domain/date';
import { festivitaDi, isDomenica, isSabato, riepilogoWeekendFestivita, type RiepilogoWeekend } from '../../domain/festivita';
import { oreMese } from '../../domain/ore';
import type { RisultatoProiezione } from '../../domain/proiezione';
import { contaReperibilitaMese, type ContoReperibilita } from '../../adattatori/reperibilita';
import type { CambioDoc, MeseDoc } from '../../servizi/tipi';

export type TipoMese = 'reale' | 'previsione' | 'vuoto';

export interface VoceVista {
  codice: string;
  info: CodiceTurno | null;
  stato: VoceTurno['stato'];
  collegaId?: string;
  /** Posizione nel giorno (per i ceduti: lo slot dell'Excel). */
  indice: number;
}

export interface GiornoVista {
  data: DataISO;
  giorno: number;
  /** 0 = lunedì … 6 = domenica (griglia europea). */
  colonna: number;
  sabato: boolean;
  domenica: boolean;
  festa?: string;
  oggi: boolean;
  voci: VoceVista[];
  previsione?: Fascia[];
  ore: number;
  cambi: CambioDoc[];
}

export interface MeseVista extends AnnoMese {
  chiave: string;
  tipo: TipoMese;
  giorni: GiornoVista[];
  ore: number;
  conteggioFasce: Record<Fascia, number>;
  reperibilita: ContoReperibilita;
  weekend: RiepilogoWeekend;
  cambi: CambioDoc[];
  cambiNonApplicati: CambioDoc[];
}

export function oggiISO(): DataISO {
  const d = new Date();
  return dataISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function meseDaChiave(chiave: string | undefined): AnnoMese | null {
  const m = chiave ? /^(\d{4})-(\d{2})$/.exec(chiave) : null;
  if (!m) return null;
  const mese = Number(m[2]);
  return mese >= 1 && mese <= 12 ? { anno: Number(m[1]), mese } : null;
}

/** Intervallo navigabile: dal primo mese caricato all'ultimo mese di previsione (sempre incluso il mese corrente). */
export function limitiNavigazione(mesi: readonly MeseDoc[], proiezione: RisultatoProiezione, oggi: AnnoMese) {
  let primo: AnnoMese = oggi;
  let ultimo: AnnoMese = oggi;
  for (const m of mesi) {
    if (confrontaMesi(m, primo) < 0) primo = { anno: m.anno, mese: m.mese };
    if (confrontaMesi(m, ultimo) > 0) ultimo = { anno: m.anno, mese: m.mese };
  }
  const date = Object.keys(proiezione.turni).sort();
  const ultimaPrevista = date[date.length - 1];
  if (ultimaPrevista) {
    const [a, mm] = ultimaPrevista.split('-').map(Number) as [number, number];
    if (confrontaMesi({ anno: a, mese: mm }, ultimo) > 0) ultimo = { anno: a, mese: mm };
  }
  return { primo, ultimo };
}

function giorniPrevisti(am: AnnoMese, proiezione: RisultatoProiezione): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (let g = 1; g <= giorniNelMese(am.anno, am.mese); g++) {
    const f = proiezione.turni[dataISO(am.anno, am.mese, g)];
    if (f) out[String(g)] = [...f];
  }
  return out;
}

export function costruisciMese(
  am: AnnoMese,
  mesi: readonly MeseDoc[],
  cambi: readonly CambioDoc[],
  proiezione: RisultatoProiezione,
  oggi: DataISO,
): MeseVista {
  const chiave = chiaveMese(am);
  const precedente = aggiungiMesi(am, -1);
  const docMese = mesi.find((m) => m.chiave === chiave);
  const docPrec = mesi.find((m) => m.chiave === chiaveMese(precedente));
  const nGiorni = giorniNelMese(am.anno, am.mese);

  const previsti = docMese ? {} : giorniPrevisti(am, proiezione);
  const tipo: TipoMese = docMese ? 'reale' : Object.keys(previsti).length > 0 ? 'previsione' : 'vuoto';
  const giorniCodici: Record<string, string[]> = docMese ? docMese.giorni : previsti;

  // Ultimo giorno del mese precedente: dal suo documento, o dalla previsione.
  const ultimoPrec = String(giorniNelMese(precedente.anno, precedente.mese));
  const ultimoGiornoPrecedente =
    docPrec?.giorni[ultimoPrec] ?? (docMese ? undefined : giorniPrevisti(precedente, proiezione)[ultimoPrec]);

  const primo = dataISO(am.anno, am.mese, 1);
  const ultimo = dataISO(am.anno, am.mese, nGiorni);
  const cambiMese = tipo === 'previsione' ? [] : cambi.filter((c) => c.data >= primo && c.data <= ultimo);

  const ore = oreMese({ anno: am.anno, mese: am.mese, giorni: giorniCodici, ultimoGiornoPrecedente, cambi: tipo === 'previsione' ? [] : cambi });
  const weekend = riepilogoWeekendFestivita({ anno: am.anno, mese: am.mese, giorni: giorniCodici, ultimoGiornoPrecedente, cambi: cambiMese });

  const perData: Record<DataISO, string[]> = {};
  if (tipo !== 'previsione') for (const [g, c] of Object.entries(giorniCodici)) perData[dataISO(am.anno, am.mese, Number(g))] = c;
  const { giorni: effettivi, nonApplicati } = applicaCambi(perData, cambiMese);

  const conteggioFasce: Record<Fascia, number> = { M: 0, P: 0, N: 0 };
  const giorni: GiornoVista[] = [];
  for (let g = 1; g <= nGiorni; g++) {
    const data = dataISO(am.anno, am.mese, g);
    const voci: VoceVista[] = (effettivi[data] ?? []).map((v, indice) => {
      const vv: VoceVista = { codice: v.codice, info: interpretaCodice(v.codice), stato: v.stato, indice };
      if (v.collegaId) vv.collegaId = v.collegaId;
      return vv;
    });
    const previsione = tipo === 'previsione' ? proiezione.turni[data] : undefined;
    for (const v of voci) if (v.stato !== 'ceduto' && v.info?.fascia && v.info.categoria === 'turno') conteggioFasce[v.info.fascia]++;
    if (previsione) for (const f of previsione) conteggioFasce[f]++;
    const gv: GiornoVista = {
      data,
      giorno: g,
      colonna: (giornoSettimana(data) + 6) % 7,
      sabato: isSabato(data),
      domenica: isDomenica(data),
      oggi: data === oggi,
      voci,
      ore: ore.perGiorno[String(g)] ?? 0,
      cambi: cambiMese.filter((c) => c.data === data),
    };
    const festa = festivitaDi(data);
    if (festa) gv.festa = festa.nome;
    if (previsione) gv.previsione = previsione;
    giorni.push(gv);
  }

  return {
    ...am,
    chiave,
    tipo,
    giorni,
    ore: ore.totale,
    conteggioFasce,
    reperibilita: contaReperibilitaMese(tipo === 'reale' ? giorniCodici : {}),
    weekend,
    cambi: cambiMese,
    cambiNonApplicati: cambiMese.filter((c) => nonApplicati.some((n) => n.data === c.data && n.codice === c.codice && n.slot === c.slot)),
  };
}

