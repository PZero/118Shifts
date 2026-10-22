// Riepilogo di un giorno per un medico: usato dalla card "Oggi e domani" dell'app e da Siri (stessa sorgente).
// Logica pura, nessun accesso a Firebase. Testo senza sigle né parentesi.
//
// Uso dalla card:
//   const r = riepilogoGiorno({ ...contesto, data, prefisso: 'Oggi' });   // oppure 'Domani' o una data parlata
//   const tipo = tipoMessaggio(r);
//   const msg = tipo ? messaggioPositivo(tipo, Math.random, messaggioPrecedente) : undefined;
//   testo = testoRiepilogo(r, 'Oggi', msg);   // [smonto] + "Oggi <frase>" + [messaggio]
// Per Siri il messaggio è fisso: `messaggioFisso(r, data)`.
import { interpretaCodice, type Fascia } from './codici';
import { aggiungiGiorni, chiaveMese, scomponi, type DataISO } from './date';
import { chiDoIlCambio, chiMiDaIlCambio, type GiornoQuadro, type GiorniQuadro } from './quadro';

export interface MedicoNome { id: string; nome: string }

export type TipoRiepilogo = 'turno' | 'smonto' | 'ferie' | 'riposo' | 'malattia' | 'reperibilita' | 'altro' | 'nessuno';

export interface RiepilogoGiorno {
  tipo: TipoRiepilogo;
  /** Predicato senza prefisso, con punto finale: "lavori a Voltri, di notte. Alle 20 ...". Il chiamante antepone "Oggi"/"Domani"/data. */
  frase: string;
  /** Presente se la notte prima c'era un turno di notte (anche se il giorno è festa/riposo/ferie). */
  smonto?: string;
  /** True per ferie/riposo/smonto senza turno: il chiamante aggiunge un messaggio positivo (vedi `tipoMessaggio`). */
  positivo?: boolean;
}

export interface ArgomentiRiepilogo {
  medicoId: string;
  /** Codici effettivi del medico per data (cambi già applicati, ceduti esclusi). */
  turni: Readonly<Record<DataISO, readonly string[]>>;
  /** Quadro per mese, chiave "aaaa-mm". Mese assente = non disponibile (si omettono i colleghi). */
  quadro: Readonly<Record<string, GiorniQuadro>>;
  medici: readonly MedicoNome[];
  /** config/sedi, es. {"1":"Voltri"}. */
  sedi: Readonly<Record<string, string>>;
  data: DataISO;
  /** 'Oggi' (default), 'Domani' o una data parlata: serve solo per scegliere le parole ("domattina", "Domani alle 8 smonti"). */
  prefisso?: string;
}

export const FASCE: readonly Fascia[] = ['M', 'P', 'N'];
export const NOME_FASCIA: Record<Fascia, string> = { M: 'mattina', P: 'pomeriggio', N: 'notte' };
/** Ore di inizio e fine dei turni: M 8-14, P 14-20, N 20-8 del giorno dopo. */
const INIZIO: Record<Fascia, number> = { M: 8, P: 14, N: 20 };
const FINE: Record<Fascia, number> = { M: 14, P: 20, N: 8 };

export interface TurnoFascia { fascia: Fascia; sede?: number }

export function turniDi(codici: readonly string[] | undefined): TurnoFascia[] {
  const out: TurnoFascia[] = [];
  for (const c of codici ?? []) {
    const i = interpretaCodice(c);
    if (i && i.categoria === 'turno' && i.fascia && !out.some((t) => t.fascia === i.fascia)) {
      out.push(i.sede !== undefined ? { fascia: i.fascia, sede: i.sede } : { fascia: i.fascia });
    }
  }
  return out.sort((x, y) => FASCE.indexOf(x.fascia) - FASCE.indexOf(y.fascia));
}

export const maiuscola = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Quadro del giorno con i miei codici effettivi al posto degli originali. */
export function quadroEffettivo(
  a: Pick<ArgomentiRiepilogo, 'medicoId' | 'turni' | 'quadro'>,
  data: DataISO,
): GiornoQuadro | undefined {
  const { anno, mese, giorno } = scomponi(data);
  const doc = a.quadro[chiaveMese({ anno, mese })];
  if (!doc) return undefined;
  const base = doc[String(giorno)] ?? {};
  const miei = a.turni[data];
  if (!miei) return base;
  const altri: Record<string, readonly string[]> = { ...base };
  delete altri[a.medicoId];
  if (miei.length > 0) altri[a.medicoId] = miei;
  return altri;
}

/** "a Voltri, di mattina e pomeriggio" / "a Voltri, di mattina e a Nervi, di notte". */
export function doveTurni(ts: readonly TurnoFascia[], nomeSede: (n: number) => string): string {
  const parte = (fasce: string, sede: number | undefined) => `${sede !== undefined ? `a ${nomeSede(sede)}, ` : ''}di ${fasce}`;
  if (new Set(ts.map((t) => t.sede)).size > 1) return ts.map((t) => parte(NOME_FASCIA[t.fascia], t.sede)).join(' e ');
  return parte(ts.map((t) => NOME_FASCIA[t.fascia]).join(' e '), ts[0]?.sede);
}

const MATTINO_DOPO: Record<string, string> = { Oggi: 'domattina', Domani: 'dopodomani mattina' };

function riposoOAssenza(codici: readonly string[]): { tipo: TipoRiepilogo; frase: string; positivo?: boolean } {
  const parti: string[] = [];
  const ignoti: string[] = [];
  let tipo: TipoRiepilogo | undefined;
  for (const c of codici) {
    const i = interpretaCodice(c);
    if (!i) continue;
    let p: string | undefined;
    let t: TipoRiepilogo = 'altro';
    switch (i.categoria) {
      case 'ferie': p = 'in ferie'; t = 'ferie'; break;
      case 'malattia': p = 'in malattia o in permesso'; t = 'malattia'; break;
      case 'indisponibile': p = 'indisponibile'; break;
      case 'corso': p = 'a un corso'; break;
      case 'qualita': p = i.grezzo === 'Q' ? 'di qualità' : 'di riascolto'; break;
      case 'reperibilita': {
        const r = i.reperibilita;
        t = 'reperibilita';
        if (r === 'RG') p = 'reperibile tutto il giorno';
        else if (r === 'RM') p = 'reperibile al mattino';
        else if (r === 'RP') p = 'reperibile al pomeriggio';
        else if (r === 'RN') p = 'reperibile di notte';
        break;
      }
      default: break;
    }
    if (p === undefined) ignoti.push(i.grezzo);
    else {
      tipo ??= t;
      if (!parti.includes(p)) parti.push(p);
    }
  }
  if (parti.length === 0 && ignoti.length === 0) return { tipo: 'riposo', frase: 'sei di riposo.', positivo: true };
  if (parti.length === 0) return { tipo: 'altro', frase: `hai il codice ${ignoti.join(' e ')}.` };
  const t = tipo ?? 'altro';
  return { tipo: t, frase: `sei ${parti.join(' e ')}.`, ...(t === 'ferie' ? { positivo: true } : {}) };
}

export function riepilogoGiorno(args: ArgomentiRiepilogo): RiepilogoGiorno {
  const { medicoId, turni, medici, sedi, data } = args;
  const prefisso = args.prefisso ?? 'Oggi';
  const nomi = new Map(medici.map((m) => [m.id, m.nome]));
  const nomeSede = (n: number) => sedi[String(n)] ?? `sede ${n}`;
  const nomeDi = (id: string | undefined) => (id ? nomi.get(id) : undefined);
  const giorniDa = (d: DataISO, passo: 1 | -1, n = 5) =>
    Array.from({ length: n }, (_, k) => quadroEffettivo(args, aggiungiGiorni(d, passo * k)));
  const chiRiceve = (d: DataISO, fascia: Fascia) =>
    nomeDi(chiMiDaIlCambio({ medicoId, giorni: giorniDa(d, 1), fasciaPartenza: fascia })?.cambio?.medicoId);
  const aChiDo = (d: DataISO, fascia: Fascia) =>
    nomeDi(chiDoIlCambio({ medicoId, giorni: giorniDa(d, -1), fasciaArrivo: fascia })?.cambio?.medicoId);

  const ieri = aggiungiGiorni(data, -1);
  const notteIeri = turniDi(turni[ieri]).find((t) => t.fascia === 'N');
  let smonto: string | undefined;
  if (notteIeri) {
    const sede = notteIeri.sede !== undefined ? ` a ${nomeSede(notteIeri.sede)}` : '';
    const chi = chiRiceve(ieri, 'N');
    const inizio = prefisso === 'Oggi' ? 'Alle' : `${maiuscola(prefisso)} alle`;
    smonto = `${inizio} 8 smonti dalla notte${sede}${chi ? `: ti darà il cambio ${chi}` : ''}.`;
  }
  const conSmonto = (r: RiepilogoGiorno): RiepilogoGiorno => (smonto ? { ...r, smonto } : r);

  const ts = turniDi(turni[data]);
  if (ts.length > 0) {
    const prima = ts[0]!.fascia;
    const ultima = ts[ts.length - 1]!.fascia;
    const chiPrima = aChiDo(data, prima);
    const chiDopo = chiRiceve(data, ultima);
    const fine = ultima === 'N' ? `${MATTINO_DOPO[prefisso] ?? 'il mattino dopo'} alle ${FINE.N}` : `alle ${FINE[ultima]}`;
    const parti: string[] = [];
    if (chiPrima) parti.push(`alle ${INIZIO[prima]} darai il cambio a ${chiPrima}`);
    if (chiDopo) parti.push(`${fine} ti darà il cambio ${chiDopo}`);
    let frase = `lavori ${doveTurni(ts, nomeSede)}.`;
    if (parti.length > 0) frase += ` ${maiuscola(parti.join(', '))}.`;
    return conSmonto({ tipo: 'turno', frase });
  }

  const r = riposoOAssenza(turni[data] ?? []);
  if (r.tipo === 'riposo' && smonto) return { tipo: 'smonto', frase: r.frase, smonto, positivo: true };
  return conSmonto({ tipo: r.tipo, frase: r.frase, ...(r.positivo ? { positivo: true } : {}) });
}

/** Testo completo: [smonto] + "<Prefisso> <frase>" + [messaggio]. */
export function testoRiepilogo(r: RiepilogoGiorno, prefisso: string, messaggio?: string): string {
  return [r.smonto, `${maiuscola(prefisso)} ${r.frase}`, messaggio].filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Messaggi positivi

export type TipoMessaggio = 'ferie' | 'riposo' | 'dopoSmonto' | 'sobrio';

export const MESSAGGI_POSITIVI: Readonly<Record<TipoMessaggio, readonly string[]>> = {
  ferie: [
    'Buone ferie: te le sei meritate.',
    'Goditi il tempo per te e per le persone a cui tieni.',
    'Stacca del tutto: il servizio è in buone mani.',
    'Ricarica le energie, il tuo lavoro conta e lo sai.',
    'Che siano giorni sereni e senza pensieri.',
    'Riposa bene: tornerai più forte di prima.',
    'Dedicati a ciò che ami: te lo sei guadagnato.',
  ],
  riposo: [
    'Giornata di riposo: sfruttala bene.',
    'Un giorno per te: te lo sei meritato.',
    'Respira e ricarica le energie.',
    'Il riposo fa parte del lavoro: goditelo.',
    'Pensa a stare bene, oggi non devi correre.',
    'Grazie per quello che fai ogni giorno: oggi tocca a te.',
    'Staccare la spina oggi è la cosa giusta.',
    'Buona giornata, con calma e senza pensieri.',
  ],
  dopoSmonto: [
    'Poi riposati: te lo sei meritato.',
    'Dopo una notte così, il riposo è sacrosanto.',
    'Buon riposo: hai fatto la tua parte.',
    'Torna a casa e riposa con tranquillità.',
    'Grazie per la notte di servizio: ora pensa a te.',
  ],
  sobrio: [
    'Riguardati.',
    'Prenditi il tempo che serve per stare meglio.',
    'Ti auguro di rimetterti presto.',
    'La salute viene prima di tutto.',
  ],
};

/** Quale lista di messaggi si applica a un riepilogo (nessuna per turni e altro). */
export function tipoMessaggio(r: RiepilogoGiorno): TipoMessaggio | undefined {
  if (r.tipo === 'malattia') return 'sobrio';
  if (!r.positivo) return undefined;
  if (r.smonto) return 'dopoSmonto';
  return r.tipo === 'ferie' ? 'ferie' : 'riposo';
}

/** Sceglie una frase della lista (diversa da `escludi` se possibile). `casuale` restituisce un numero in [0,1). */
export function messaggioPositivo(tipo: TipoMessaggio = 'riposo', casuale: () => number = Math.random, escludi?: string): string {
  const tutte = MESSAGGI_POSITIVI[tipo];
  const lista = tutte.filter((m) => m !== escludi);
  const scelta = lista.length > 0 ? lista : tutte;
  return scelta[Math.min(scelta.length - 1, Math.max(0, Math.floor(casuale() * scelta.length)))]!;
}

/** Messaggio deterministico (hash della data): stesso giorno, stessa frase a ogni sincronizzazione. */
export function messaggioFisso(r: RiepilogoGiorno, data: DataISO): string | undefined {
  const tipo = tipoMessaggio(r);
  if (!tipo) return undefined;
  let h = 0;
  for (const c of data) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const lista = MESSAGGI_POSITIVI[tipo];
  return lista[h % lista.length];
}
