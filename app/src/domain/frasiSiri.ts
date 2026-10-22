// Frasi per la sintesi vocale (Siri / Comando rapido iOS): cosa fa il medico in ogni giorno.
// Logica pura, nessun accesso a Firebase. Testo senza sigle né parentesi.
import { interpretaCodice, type Fascia } from './codici';
import { doveTurni as doveTurniBase, maiuscola, messaggioFisso, NOME_FASCIA, quadroEffettivo, riepilogoGiorno, testoRiepilogo, turniDi, type MedicoNome as MedicoNomeBase, type TurnoFascia } from './riepilogoGiorno';
import { aggiungiGiorni, differenzaGiorni, giornoSettimana, scomponi, type DataISO } from './date';
import { colleghiDisponibili } from './disponibilita';
import { chiConMe, type GiorniQuadro } from './quadro';

export type MedicoNome = MedicoNomeBase;
/**
 * Frasi di un giorno. `dove`, `diTurno`, `cambio` e `conMe` nominano sempre la data parlata
 * (mai "oggi"/"domani"), così restano corrette qualunque sia il giorno in cui si chiede.
 */
export interface FrasiGiorno {
  testo: string;
  primaDelle8?: string;
  dove: string;
  diTurno: string;
  /** Assente se il quadro del mese non è disponibile. */
  cambio?: string;
  /** Assente se il quadro del mese non è disponibile. */
  conMe?: string;
}
export const MAX_TESTO_FRASE = 600;
const MAX_NOMI = 8;
export type FrasiSiri = Record<DataISO, FrasiGiorno>;

export interface ArgomentiFrasiSiri {
  medicoId: string;
  /** Codici effettivi del medico per data (cambi già applicati, ceduti esclusi). */
  turni: Readonly<Record<DataISO, readonly string[]>>;
  /** Quadro per mese, chiave "aaaa-mm" (doc quadro/{aaaa-mm}.giorni). Mese assente = non disponibile. */
  quadro: Readonly<Record<string, GiorniQuadro>>;
  medici: readonly MedicoNome[];
  /** config/sedi, es. {"1":"Voltri"}. */
  sedi: Readonly<Record<string, string>>;
  /** Intervallo (inclusivo) di date da generare. */
  da: DataISO;
  a: DataISO;
}

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/**
 * Elenco in italiano naturale ("A, B e C"; con `virgolaPrima` "A, B, e C"). Al massimo 8 voci, poi "e altri N";
 * riduce ancora le voci finché la frase costruita da `componi` sta in 600 caratteri.
 */
function elencoNaturale(voci: readonly string[], componi: (elenco: string) => string, virgolaPrima = false): string {
  const unisci = (v: readonly string[]) =>
    v.length <= 1 ? (v[0] ?? '') : `${v.slice(0, -1).join(', ')}${virgolaPrima && v.length > 2 ? ',' : ''} e ${v[v.length - 1]}`;
  let frase = '';
  for (let n = Math.min(voci.length, MAX_NOMI); n >= 1; n--) {
    const resto = voci.length - n;
    frase = componi(resto > 0 ? `${voci.slice(0, n).join(', ')} e altri ${resto}` : unisci(voci.slice(0, n)));
    if (frase.length <= MAX_TESTO_FRASE) return frase;
  }
  return frase.slice(0, MAX_TESTO_FRASE);
}

export function costruisciFrasiSiri(args: ArgomentiFrasiSiri): FrasiSiri {
  const { medicoId, turni, quadro, medici, sedi, da, a } = args;
  const nomi = new Map(medici.map((m) => [m.id, m.nome]));
  const nomeSede = (n: number) => sedi[String(n)] ?? `sede ${n}`;
  const ultimaData = Object.keys(turni).sort().pop();

  const giornoQuadro = (data: DataISO) => quadroEffettivo({ medicoId, turni, quadro }, data);

  function descrTurni(ts: readonly TurnoFascia[]): string {
    if (new Set(ts.map((t) => t.sede)).size > 1) {
      return ts.map((t) => `di ${NOME_FASCIA[t.fascia]}${t.sede !== undefined ? ` a ${nomeSede(t.sede)}` : ''}`).join(' e ');
    }
    const sede = ts[0]?.sede;
    return `di ${ts.map((t) => NOME_FASCIA[t.fascia]).join(' e ')}${sede !== undefined ? ` a ${nomeSede(sede)}` : ''}`;
  }

  /** Predicato di "Oggi ...": "sei di riposo", "in ferie", "di turno di mattina a Voltri". */
  function statoOggi(data: DataISO, dopoNotte: boolean): { frase: string; turno: boolean } {
    const codici = turni[data] ?? [];
    const ts = turniDi(codici);
    if (ts.length > 0) return { frase: `sei di turno ${descrTurni(ts)}`, turno: true };
    const parti: string[] = [];
    const ignoti: string[] = [];
    for (const c of codici) {
      const i = interpretaCodice(c);
      if (!i) continue;
      let p: string | undefined;
      switch (i.categoria) {
        case 'ferie': p = 'in ferie'; break;
        case 'malattia': p = 'in malattia o in permesso'; break;
        case 'indisponibile': p = 'indisponibile'; break;
        case 'corso': p = 'a un corso'; break;
        case 'qualita': p = i.grezzo === 'Q' ? 'di qualità' : 'di riascolto'; break;
        case 'reperibilita':
          if (i.reperibilita === 'RG') p = 'reperibile tutto il giorno';
          else if (i.reperibilita) p = `reperibile di ${NOME_FASCIA[i.reperibilita.charAt(1) as Fascia]}`;
          break;
        default: break;
      }
      if (p === undefined) ignoti.push(i.grezzo);
      else if (!parti.includes(p)) parti.push(p);
    }
    if (parti.length === 0 && ignoti.length === 0) return { frase: dopoNotte ? 'sei di riposo dopo la notte' : 'sei di riposo', turno: false };
    if (parti.length === 0) return { frase: `hai il codice ${ignoti.join(' e ')}`, turno: false };
    return { frase: `sei ${parti.join(' e ')}`, turno: false };
  }

  /** Data parlata completa, es. "giovedì 22 ottobre". */
  function dataParlata(data: DataISO): string {
    const { giorno, mese } = scomponi(data);
    return `${GIORNI[giornoSettimana(data)]} ${giorno} ${MESI[mese - 1]}`;
  }

  const doveTurni = (ts: readonly TurnoFascia[]) => doveTurniBase(ts, nomeSede);

  /** Frasi autonome (con data parlata) di un giorno. `cambio` e `conMe` solo se il quadro del mese c'è. */
  function frasiGiorno(data: DataISO, stato: { frase: string; turno: boolean }, ts: readonly TurnoFascia[]) {
    const quando = dataParlata(data);
    const Quando = maiuscola(quando);
    const dove = stato.turno ? `${Quando} sei ${doveTurni(ts)}.` : `${Quando} non lavori: ${stato.frase}.`;
    const diTurno = stato.turno ? `Sì, ${quando} ${stato.frase}.` : `No, ${quando} ${stato.frase}.`;
    const res: { dove: string; diTurno: string; cambio?: string; conMe?: string } = { dove, diTurno };
    const quadroGiorno = giornoQuadro(data);
    if (!quadroGiorno) return res;
    if (!stato.turno) {
      res.cambio = `${Quando} non sei di turno.`;
      res.conMe = `${Quando} non sei di turno.`;
      return res;
    }
    // Come nell'app (DialoghiCambio): colleghiDisponibili per fascia, con riposo di 11 ore e assenti esclusi.
    // Con più fasce nel giorno servono i colleghi liberi per tutte (cambio dell'intera giornata).
    // Le indisponibilità dei colleghi non sono note a Siri: non vengono considerate.
    let liberi = medici.map((m) => m.id).filter((id) => id !== medicoId);
    for (const t of ts) {
      const ok = new Set(
        colleghiDisponibili({
          data,
          fascia: t.fascia,
          giornoPrima: giornoQuadro(aggiungiGiorni(data, -1)),
          giorno: quadroGiorno,
          giornoDopo: giornoQuadro(aggiungiGiorni(data, 1)),
          candidati: liberi,
        }),
      );
      liberi = liberi.filter((id) => ok.has(id));
    }
    const nomiLiberi = liberi.map((id) => nomi.get(id)).filter((n): n is string => !!n);
    res.cambio =
      nomiLiberi.length === 0
        ? `${Quando} nessun collega è libero per darti il cambio.`
        : elencoNaturale(nomiLiberi, (e) => `${Quando} possono darti il cambio: ${e}.`);
    const colleghi: string[] = [];
    for (const g of chiConMe(quadroGiorno, medicoId, turni[data] ?? [])) {
      for (const c of g.inTurno) {
        const nome = nomi.get(c.medicoId);
        if (nome) colleghi.push(`${nome}, di ${NOME_FASCIA[g.fascia]}${c.sede !== undefined ? ` a ${nomeSede(c.sede)}` : ''}`);
      }
    }
    res.conMe =
      colleghi.length === 0
        ? `${Quando} nessun collega in turno con te.`
        : elencoNaturale(colleghi, (e) => `${Quando} con te ${colleghi.length === 1 ? "c'è" : 'ci sono'} ${e}.`, true);
    return res;
  }

  function etichettaGiorno(origine: DataISO, data: DataISO): string {
    if (differenzaGiorni(origine, data) === 1) return 'domani';
    const { giorno, mese } = scomponi(data);
    const base = `${GIORNI[giornoSettimana(data)]} ${giorno}`;
    return differenzaGiorni(origine, data) > 6 ? `${base} ${MESI[mese - 1]}` : base;
  }

  function prossimoTurno(data: DataISO): string {
    if (!ultimaData) return '';
    for (let d = aggiungiGiorni(data, 1); d <= ultimaData; d = aggiungiGiorni(d, 1)) {
      const ts = turniDi(turni[d]);
      if (ts.length > 0) return ` Il prossimo turno è ${etichettaGiorno(data, d)}, ${descrTurni(ts)}.`;
    }
    return '';
  }

  const out: FrasiSiri = {};
  for (let data = da; data <= a; data = aggiungiGiorni(data, 1)) {
    const oggi = statoOggi(data, turniDi(turni[aggiungiGiorni(data, -1)]).some((t) => t.fascia === 'N'));
    const ts = turniDi(turni[data]);
    const r = riepilogoGiorno({ medicoId, turni, quadro, medici, sedi, data });
    const testoBase = testoRiepilogo(r, 'Oggi', messaggioFisso(r, data));
    const giorno: FrasiGiorno = { testo: oggi.turno ? testoBase : testoBase + prossimoTurno(data), ...frasiGiorno(data, oggi, ts) };
    if (r.smonto) giorno.primaDelle8 = testoBase;
    out[data] = giorno;
  }
  return out;
}
