// Siri e CarPlay: calcolo delle frasi, creazione/aggiornamento/revoca delle chiavi (siri/{chiave}).
// Il Comando rapido iOS legge il documento con la sola chiave (segreto), senza login.

import { applicaCambi, codiciEffettivi, type Cambio } from '../domain/cambi';
import { aggiungiGiorni, chiaveMese, dataISO, giorniNelMese, scomponi, type DataISO } from '../domain/date';
import { costruisciFrasiSiri, type FrasiGiorno, type FrasiSiri } from '../domain/frasiSiri';
import type { GiorniQuadro } from '../domain/quadro';
import type { MeseDoc, QuadroMese, Servizi, Sedi, VoceElenco } from './tipi';

/**
 * Link iCloud del Comando rapido "Turni 118" (vedi docs/SIRI.md). Vuoto finché il comando
 * non è stato costruito e condiviso: in quel caso l'app mostra "Comando non ancora disponibile".
 */
export const LINK_COMANDO_SIRI = 'https://www.icloud.com/shortcuts/d5201cc6a6124263b4a9b07ac3a38e2c';

export const MAX_GIORNI = 100;
/** Dimensione massima stimata del documento (JSON.stringify), in caratteri. */
export const MAX_DOCUMENTO = 700_000;
export const MAX_TESTO = 600;

/** Testo copiato negli appunti: la sola chiave, da incollare quando il Comando rapido la chiede all'installazione. */
export const testoAppunti = (chiave: string) => chiave;

/** Chiave casuale di 64 caratteri esadecimali (256 bit), richiesta dalle regole (32..200 caratteri). */
export function generaChiave(): string {
  const byte = new Uint8Array(32);
  crypto.getRandomValues(byte);
  return Array.from(byte, (b) => b.toString(16).padStart(2, '0')).join('');
}

type MesePerTurni = Pick<MeseDoc, 'anno' | 'mese' | 'giorni'>;

/** Codici effettivi per data (cambi applicati, turni ceduti esclusi). */
export function turniEffettivi(mesi: readonly MesePerTurni[], cambi: readonly Cambio[]): Record<DataISO, string[]> {
  const perData: Record<DataISO, string[]> = {};
  for (const m of mesi) for (const [g, codici] of Object.entries(m.giorni)) perData[dataISO(m.anno, m.mese, Number(g))] = codici;
  const { giorni } = applicaCambi(perData, cambi);
  const out: Record<DataISO, string[]> = {};
  for (const [data, voci] of Object.entries(giorni)) out[data as DataISO] = codiciEffettivi(voci);
  return out;
}

/** Da ieri alla fine dell'ultimo mese pubblicato, al massimo 100 giorni in totale. `null` se non c'è nulla da dire. */
export function intervalloFrasi(oggi: DataISO, mesi: readonly MesePerTurni[]): { da: DataISO; a: DataISO } | null {
  const ultimo = mesi.reduce<MesePerTurni | null>((u, m) => (!u || m.anno * 12 + m.mese > u.anno * 12 + u.mese ? m : u), null);
  if (!ultimo) return null;
  const fineDati = dataISO(ultimo.anno, ultimo.mese, giorniNelMese(ultimo.anno, ultimo.mese));
  const da = aggiungiGiorni(oggi, -1);
  const prevista = aggiungiGiorni(da, MAX_GIORNI - 1);
  const a = prevista < fineDati ? prevista : fineDati;
  return a < da ? null : { da, a };
}

/** Rispetta i limiti delle regole e del contratto: al massimo 100 giorni, testi di al massimo 600 caratteri. */
export function limitaFrasi(frasi: FrasiSiri): FrasiSiri {
  const taglia = (t: string) => (t.length > MAX_TESTO ? t.slice(0, MAX_TESTO) : t);
  const out: FrasiSiri = {};
  for (const data of Object.keys(frasi).sort().slice(0, MAX_GIORNI) as DataISO[]) {
    const f = frasi[data]!;
    const g: FrasiGiorno = { testo: taglia(f.testo), dove: taglia(f.dove), diTurno: taglia(f.diTurno) };
    if (f.primaDelle8) g.primaDelle8 = taglia(f.primaDelle8);
    if (f.cambio) g.cambio = taglia(f.cambio);
    if (f.conMe) g.conMe = taglia(f.conMe);
    if (f.successivo) g.successivo = taglia(f.successivo);
    if (f.precedente) g.precedente = taglia(f.precedente);
    if (f.aiuto) g.aiuto = taglia(f.aiuto);
    out[data] = g;
  }
  // Documento sotto ~700 KB: se servisse, si riducono i giorni futuri.
  const date = Object.keys(out).sort();
  while (date.length > 1 && JSON.stringify(out).length > MAX_DOCUMENTO) delete out[date.pop() as DataISO];
  return out;
}

export function frasiUguali(a: FrasiSiri, b: FrasiSiri): boolean {
  const ka = Object.keys(a).sort();
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => {
    const x = a[k as DataISO]!;
    const y = b[k as DataISO];
    return y !== undefined && x.testo === y.testo && (x.primaDelle8 ?? '') === (y.primaDelle8 ?? '') && x.dove === y.dove && x.diTurno === y.diTurno && (x.cambio ?? '') === (y.cambio ?? '') && (x.conMe ?? '') === (y.conMe ?? '') && (x.successivo ?? '') === (y.successivo ?? '') && (x.precedente ?? '') === (y.precedente ?? '') && (x.aiuto ?? '') === (y.aiuto ?? '');
  });
}

export interface ArgomentiCalcolo {
  medicoId: string;
  mesi: readonly MesePerTurni[];
  cambi: readonly Cambio[];
  elenco: readonly VoceElenco[];
  sedi: Sedi;
  oggi: DataISO;
  /** Quadro del mese; un errore (es. account secondario non staff) o `null` = quadro non disponibile. */
  caricaQuadro: (chiaveMese: string) => Promise<QuadroMese | null>;
}

/** Quadri (per mese) da 5 giorni prima di `da` a 5 dopo `a`, per chi smonta e chi dà il cambio. I mesi non leggibili mancano: frasi senza colleghi. */
export async function caricaQuadri(
  da: DataISO,
  a: DataISO,
  caricaQuadro: (chiaveMese: string) => Promise<QuadroMese | null>,
): Promise<Record<string, GiorniQuadro>> {
  const chiavi = new Set<string>();
  for (let d = aggiungiGiorni(da, -5); d <= aggiungiGiorni(a, 5); d = aggiungiGiorni(d, 1)) {
    const { anno, mese } = scomponi(d);
    chiavi.add(chiaveMese({ anno, mese }));
  }
  const quadro: Record<string, GiorniQuadro> = {};
  await Promise.all(
    [...chiavi].map(async (k) => {
      try {
        const q = await caricaQuadro(k);
        if (q) quadro[k] = q.giorni;
      } catch {
        /* quadro non leggibile */
      }
    }),
  );
  return quadro;
}

/** Frasi da ieri a fine dati (max 100 giorni). Senza quadro leggibile le frasi non nominano i colleghi. */
export async function calcolaFrasi(arg: ArgomentiCalcolo): Promise<FrasiSiri> {
  const intervallo = intervalloFrasi(arg.oggi, arg.mesi);
  if (!intervallo) return {};
  const { da, a } = intervallo;
  const quadro = await caricaQuadri(da, a, arg.caricaQuadro);
  return limitaFrasi(
    costruisciFrasiSiri({
      medicoId: arg.medicoId,
      turni: turniEffettivi(arg.mesi, arg.cambi),
      quadro,
      medici: arg.elenco,
      sedi: arg.sedi,
      da,
      a,
    }),
  );
}

/** Ultima impronta sincronizzata per medico: evita riletture e scritture inutili nella stessa sessione. */
const sincronizzate = new Map<string, string>();

export function dimenticaSincronizzazione(medicoId: string): void {
  sincronizzate.delete(medicoId);
}

/**
 * Aggiorna le chiavi dell'utente solo se le frasi sono cambiate. Restituisce il numero di chiavi aggiornate.
 * Gli errori non vanno propagati all'interfaccia: chi chiama li ignora.
 */
export async function sincronizzaSiri(servizi: Servizi, arg: ArgomentiCalcolo): Promise<number> {
  const frasi = await calcolaFrasi(arg);
  const firma = JSON.stringify(frasi);
  if (sincronizzate.get(arg.medicoId) === firma) return 0;
  const chiavi = await servizi.siriMie();
  let n = 0;
  for (const c of chiavi) {
    if (!c.regoleOk || !frasiUguali(c.giorni, frasi)) {
      await servizi.siriAggiorna(c.chiave, frasi);
      n++;
    }
  }
  sincronizzate.set(arg.medicoId, firma);
  return n;
}

/**
 * Dopo la pubblicazione dell'Excel: per ogni medico indicato con chiavi attive ricalcola le frasi
 * con i turni appena pubblicati (lo staff non legge i cambi). Restituisce quanti medici non si sono
 * potuti aggiornare, senza mai lanciare eccezioni.
 */
export async function aggiornaSiriDopoImport(servizi: Servizi, medicoIds: readonly string[], oggi: DataISO): Promise<{ aggiornati: number; errori: number }> {
  let aggiornati = 0;
  let errori = 0;
  try {
    const [medici, sedi] = await Promise.all([servizi.medici(), servizi.sedi()]);
    const elenco = medici.filter((m) => m.attivo).map((m) => ({ id: m.id, nome: m.nome }));
    const quadri = new Map<string, Promise<QuadroMese | null>>();
    const caricaQuadro = (k: string) => {
      let p = quadri.get(k);
      if (!p) quadri.set(k, (p = servizi.quadro(k)));
      return p;
    };
    for (const medicoId of new Set(medicoIds)) {
      try {
        const chiavi = await servizi.siriDelMedico(medicoId);
        if (chiavi.length === 0) continue;
        const mesi = await servizi.turniMedico(medicoId);
        const frasi = await calcolaFrasi({ medicoId, mesi, cambi: [], elenco, sedi, oggi, caricaQuadro });
        for (const c of chiavi) if (!c.regoleOk || !frasiUguali(c.giorni, frasi)) await servizi.siriAggiorna(c.chiave, frasi);
        dimenticaSincronizzazione(medicoId);
        aggiornati++;
      } catch {
        errori++;
      }
    }
  } catch {
    errori++;
  }
  return { aggiornati, errori };
}
