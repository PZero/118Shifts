// Servizi in memoria per la modalità demo (SOLO sviluppo). Tutti i dati sono inventati.
// Questo modulo è importato solo da demo/DemoApp.tsx, a sua volta caricato solo se import.meta.env.DEV.

import { aggiungiMesi, chiaveMese, dataISO, giorniNelMese, type AnnoMese } from '../domain/date';
import { anteprima, prossimoContatore, type LimiteFeedback } from '../domain/feedback';
import type { GiorniIndisponibili } from '../domain/indisponibilita';
import { CICLO } from '../domain/proiezione';
import { costruisciQuadro } from '../domain/quadro';
import {
  SEDI_PREDEFINITE,
  type CambioDoc,
  type Conversazione,
  type MessaggioFeedback,
  type Importazione,
  type MedicoAnagrafica,
  type MeseDoc,
  type MesePubblicato,
  type Sedi,
  type Servizi,
  type StatoAccount,
  type Utente,
} from '../servizi/tipi';

export const MEDICO_DEMO = 'demo-1';

const NOMI: { id: string; nome: string; alias: string[]; scarto: number; sede: number }[] = [
  { id: 'demo-1', nome: 'Rossi Demo', alias: [], scarto: 0, sede: 6 },
  { id: 'demo-2', nome: 'Bianchi Demo', alias: ['Bianchi D.'], scarto: 1, sede: 6 },
  { id: 'demo-3', nome: 'Verdi Demo', alias: [], scarto: 2, sede: 4 },
  { id: 'demo-4', nome: 'Neri Demo', alias: [], scarto: 3, sede: 6 },
  { id: 'demo-5', nome: 'Gialli Demo', alias: [], scarto: 4, sede: 3 },
  { id: 'demo-6', nome: 'Blu Demo', alias: [], scarto: 0, sede: 2 },
  { id: 'demo-7', nome: 'Viola Demo', alias: [], scarto: 1, sede: 5 },
];

/** Ciclo inventato MP-N-smonto-riposo-riposo, con qualche ferie e una reperibilità per il medico demo. */
function giorniDemo(am: AnnoMese, scarto: number, sede: number, ricco: boolean): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const n = giorniNelMese(am.anno, am.mese);
  const base = Math.floor(Date.UTC(am.anno, am.mese - 1, 1) / 86_400_000);
  for (let g = 1; g <= n; g++) {
    const fasce = CICLO[(((base + g + scarto) % 5) + 5) % 5] ?? [];
    if (fasce.length > 0) out[String(g)] = fasce.map((f) => `${f}${sede}`);
    // Reperibilità inventate per il quadro dei colleghi (nei giorni senza turno).
    else if (scarto === 1 && sede === 5) {
      if (g % 5 === 0) out[String(g)] = ['RN'];
      else if (g % 3 === 0) out[String(g)] = ['RG'];
      else if (g % 2 === 0) out[String(g)] = ['RM'];
    }
  }
  if (ricco) {
    for (const g of [20, 21, 22]) if (g <= n) out[String(g)] = ['F'];
    if (n >= 27) out['27'] = ['RM'];
    if (n >= 8) out['8'] = ['f'];
  }
  return out;
}

export function creaServiziDemo(): Servizi {
  const oggi = new Date();
  const corrente: AnnoMese = { anno: oggi.getFullYear(), mese: oggi.getMonth() + 1 };
  const mesiBase = [-1, 0, 1].map((d) => aggiungiMesi(corrente, d));

  const turni = new Map<string, Map<string, MeseDoc>>();
  const imposta = (medicoId: string, am: AnnoMese, giorni: Record<string, string[]>, caricatoIl?: Date) => {
    const k = chiaveMese(am);
    const perMedico = turni.get(medicoId) ?? new Map<string, MeseDoc>();
    perMedico.set(k, { chiave: k, anno: am.anno, mese: am.mese, giorni, caricatoIl: caricatoIl ?? new Date() });
    turni.set(medicoId, perMedico);
  };
  // Date di caricamento inventate, diverse per mese.
  const caricatoDemo = (i: number) => new Date(oggi.getTime() - (3 - i) * 9 * 86_400_000);
  for (const m of NOMI) mesiBase.forEach((am, i) => imposta(m.id, am, giorniDemo(am, m.scarto, m.sede, m.id === MEDICO_DEMO), caricatoDemo(i)));
  const pubblicatiDemo: MesePubblicato[] = mesiBase.slice(1).map((am, i) => ({
    chiave: chiaveMese(am),
    medici: NOMI.map((m) => m.id),
    caricatoIl: caricatoDemo(i + 1),
    importId: `imp-demo-${i + 1}`,
  }));

  let medici: MedicoAnagrafica[] = NOMI.map((m) => ({
    id: m.id,
    nome: m.nome,
    alias: m.alias,
    attivo: true,
    cicloManuale: false,
    principaleUid: m.id === MEDICO_DEMO ? 'demo-uid' : null,
  }));
  let sedi: Sedi = { ...SEDI_PREDEFINITE };
  const importazioni: Importazione[] = [];
  let ocrDemo: unknown = null;
  const cambi: CambioDoc[] = [];
  let seq = 0;

  // Un cambio ceduto e uno ricevuto di esempio nel mese corrente.
  const mc = turni.get(MEDICO_DEMO)?.get(chiaveMese(corrente));
  const lavorati = Object.entries(mc?.giorni ?? {}).filter(([, c]) => /^[MPN]\d/.test(c[0] ?? ''));
  const ced = lavorati.find(([g]) => Number(g) >= 12);
  if (ced) {
    cambi.push({ id: `c${++seq}`, data: dataISO(corrente.anno, corrente.mese, Number(ced[0])), slot: 0, codice: ced[1][0]!, verso: 'ceduto', collegaId: 'demo-2' });
  }
  const libero = Array.from({ length: 28 }, (_, i) => i + 1).find((g) => g > 12 && !mc?.giorni[String(g)]);
  if (libero) {
    cambi.push({ id: `c${++seq}`, data: dataISO(corrente.anno, corrente.mese, libero), slot: 0, codice: 'N2', verso: 'ricevuto', collegaId: 'demo-3' });
  }

  const giorniFa = (n: number) => new Date(Date.now() - n * 86_400_000);
  let utenti: Utente[] = [
    { uid: 'demo-uid', email: 'rossi.demo@esempio.invalid', nome: 'Rossi Demo', stato: 'approvato', medicoId: 'demo-1', principale: true, delegato: true, ultimoAccesso: giorniFa(0) },
    { uid: 'demo-uid-2', email: 'rossi.demo.2@esempio.invalid', nome: 'Rossi Demo (secondo account)', stato: 'approvato', medicoId: 'demo-1', principale: false, delegato: false, ultimoAccesso: giorniFa(20) },
    { uid: 'demo-uid-3', email: 'bianchi.demo@esempio.invalid', nome: 'Bianchi Demo', stato: 'approvato', medicoId: 'demo-2', principale: true, delegato: false, ultimoAccesso: giorniFa(1) },
    { uid: 'demo-uid-4', email: 'nuovo.demo@esempio.invalid', nome: 'Nuovo Utente Demo', stato: 'attesa', principale: false, delegato: false, presentazione: 'Sono la moglie del dr Bianchi (account per consultare i turni insieme a lui).' },
    { uid: 'demo-uid-5', email: 'ex.demo@esempio.invalid', nome: 'Ex Utente Demo', stato: 'disabilitato', medicoId: 'demo-5', principale: false, delegato: false },
  ];

  // Feedback inventato: due conversazioni del medico demo e una di un collega (visibile solo all'admin).
  const oreFa = (n: number) => new Date(Date.now() - n * 3_600_000);
  let conversazioni: Conversazione[] = [
    { id: 'f1', autoreUid: 'demo-uid', autoreNome: 'Rossi Demo', argomento: 'Notifica prima del turno', creatoIl: oreFa(30), aggiornatoIl: oreFa(3), ultimoTesto: 'Buona idea, la valuto per la prossima versione.', nonLettoAdmin: false, nonLettoUtente: true },
    { id: 'f2', autoreUid: 'demo-uid', autoreNome: 'Rossi Demo', argomento: 'Colori del calendario', creatoIl: oreFa(80), aggiornatoIl: oreFa(70), ultimoTesto: 'Grazie, tutto chiaro.', nonLettoAdmin: false, nonLettoUtente: false },
    { id: 'f3', autoreUid: 'demo-uid-3', autoreNome: 'Bianchi Demo', argomento: 'Esportare i turni in PDF', creatoIl: oreFa(5), aggiornatoIl: oreFa(5), ultimoTesto: 'Sarebbe utile poter stampare il mese.', nonLettoAdmin: true, nonLettoUtente: false },
  ];
  const messaggiFeedback = new Map<string, MessaggioFeedback[]>([
    ['f1', [
      { id: 'm1', testo: 'Sarebbe comodo ricevere un promemoria la sera prima di un turno di notte.', daAdmin: false, autoreUid: 'demo-uid', creatoIl: oreFa(30) },
      { id: 'm2', testo: 'Buona idea, la valuto per la prossima versione.', daAdmin: true, autoreUid: 'admin-demo', creatoIl: oreFa(3) },
    ]],
    ['f2', [
      { id: 'm3', testo: 'Il sabato si distingue poco dai giorni feriali nel tema scuro.', daAdmin: false, autoreUid: 'demo-uid', creatoIl: oreFa(80) },
      { id: 'm4', testo: 'Ho rivisto la tinta: ora dovrebbe leggersi meglio.', daAdmin: true, autoreUid: 'admin-demo', creatoIl: oreFa(72) },
      { id: 'm5', testo: 'Grazie, tutto chiaro.', daAdmin: false, autoreUid: 'demo-uid', creatoIl: oreFa(70) },
    ]],
    ['f3', [{ id: 'm6', testo: 'Sarebbe utile poter stampare il mese.', daAdmin: false, autoreUid: 'demo-uid-3', creatoIl: oreFa(5) }]],
  ]);
  const limiti = new Map<string, LimiteFeedback>();
  const contaMessaggio = (uid: string) => {
    const prossimo = prossimoContatore(limiti.get(uid), new Date());
    if (!prossimo) throw Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
    limiti.set(uid, prossimo);
  };
  const ascoltatori = new Set<() => void>();
  const notifica = () => ascoltatori.forEach((f) => f());
  const osserva = (calcola: () => void) => {
    ascoltatori.add(calcola);
    calcola();
    return () => void ascoltatori.delete(calcola);
  };
  const ordineRecente = (l: Conversazione[]) => [...l].sort((a, b) => (b.aggiornatoIl?.getTime() ?? 0) - (a.aggiornatoIl?.getTime() ?? 0));

  const aggiornaUtente = (uid: string, mod: Partial<Utente>) => {
    utenti = utenti.map((u) => (u.uid === uid ? { ...u, ...mod } : u));
  };
  // Indisponibilità inventate: mesi successivi e mese corrente (con un conflitto voluto, se possibile).
  const indisp = new Map<string, GiorniIndisponibili>();
  {
    const succ = chiaveMese(aggiungiMesi(corrente, 1));
    indisp.set(succ, { '5': ['M', 'P', 'N'], '12': ['N'], '19': ['P'] });
    // Il mese successivo ha turni pubblicati (sola lettura); un mese senza turni è modificabile.
    indisp.set(chiaveMese(aggiungiMesi(corrente, 2)), { '8': ['M'], '21': ['N'] });
    const giorniCorr = turni.get(MEDICO_DEMO)?.get(chiaveMese(corrente))?.giorni ?? {};
    const g1 = Object.keys(giorniCorr).find((g) => /^M/.test(giorniCorr[g]?.[0] ?? ''));
    const g2 = Object.keys(giorniCorr).find((g) => !giorniCorr[g]?.length);
    const conf: GiorniIndisponibili = { '2': ['N'], '25': ['P'] };
    if (g1) conf[g1] = ['M'];
    if (g2) conf[g2] = ['M', 'P'];
    indisp.set(chiaveMese(corrente), conf);
  }
  const copia = <T,>(v: T): T => structuredClone(v);

  return {
    turniMedico: async (id) => copia([...(turni.get(id)?.values() ?? [])].sort((a, b) => a.chiave.localeCompare(b.chiave))),
    cambiMedico: async (id) => (id === MEDICO_DEMO ? copia(cambi).sort((a, b) => a.data.localeCompare(b.data)) : []),
    async aggiungiCambio(_id, c) {
      cambi.push({ ...c, id: `c${++seq}`, creatoIl: new Date() });
    },
    async eliminaCambio(_id, id) {
      const i = cambi.findIndex((c) => c.id === id);
      if (i >= 0) cambi.splice(i, 1);
    },
    elencoMedici: async () => medici.filter((m) => m.attivo).map((m) => ({ id: m.id, nome: m.nome })),
    sedi: async () => ({ ...sedi }),
    cicloMedico: async () => ({ cicloManuale: false }),
    indisponibilita: async () => copia(Object.fromEntries(indisp)),
    async salvaIndisponibilita(_id, chiave, giorni) {
      if (Object.keys(giorni).length === 0) indisp.delete(chiave);
      else indisp.set(chiave, copia(giorni));
    },
    async quadro(chiave) {
      const voci = [...turni].flatMap(([medicoId, perMese]) => {
        const d = perMese.get(chiave);
        return d ? [{ medicoId, giorni: d.giorni }] : [];
      });
      if (voci.length === 0) return null;
      return { chiave, giorni: copia(costruisciQuadro(voci)), caricatoIl: new Date() };
    },

    osservaConversazioni: (uid, cb) =>
      osserva(() => cb(structuredClone(ordineRecente(conversazioni.filter((c) => !uid || c.autoreUid === uid))))),
    osservaLimiteFeedback: (uid, cb) => osserva(() => cb(limiti.get(uid) ?? null)),
    osservaMessaggi: (convId, cb) => osserva(() => cb(structuredClone(messaggiFeedback.get(convId) ?? []))),
    async creaConversazione(autore, argomento, testo) {
      contaMessaggio(autore.uid);
      const id = `f${++seq + 10}`;
      const adesso = new Date();
      conversazioni.push({ id, autoreUid: autore.uid, autoreNome: autore.nome, argomento: argomento.trim(), creatoIl: adesso, aggiornatoIl: adesso, ultimoTesto: anteprima(testo), nonLettoAdmin: true, nonLettoUtente: false });
      messaggiFeedback.set(id, [{ id: `m${++seq + 10}`, testo: testo.trim(), daAdmin: false, autoreUid: autore.uid, creatoIl: adesso }]);
      notifica();
      return id;
    },
    async inviaMessaggio(conv, autore, testo, daAdmin) {
      if (!daAdmin) contaMessaggio(autore.uid);
      const adesso = new Date();
      messaggiFeedback.set(conv.id, [...(messaggiFeedback.get(conv.id) ?? []), { id: `m${++seq + 10}`, testo: testo.trim(), daAdmin, autoreUid: autore.uid, creatoIl: adesso }]);
      conversazioni = conversazioni.map((c) =>
        c.id === conv.id ? { ...c, aggiornatoIl: adesso, ultimoTesto: anteprima(testo), ...(daAdmin ? { nonLettoUtente: true } : { nonLettoAdmin: true }) } : c,
      );
      notifica();
    },
    async segnaLetta(convId, comeAdmin) {
      conversazioni = conversazioni.map((c) => (c.id === convId ? { ...c, ...(comeAdmin ? { nonLettoAdmin: false } : { nonLettoUtente: false }) } : c));
      notifica();
    },
    async eliminaConversazione(convId) {
      conversazioni = conversazioni.filter((c) => c.id !== convId);
      messaggiFeedback.delete(convId);
      notifica();
    },
    async salvaPresentazione(uid, testo) {
      aggiornaUtente(uid, { presentazione: testo.trim() });
    },

    osservaInAttesa(cb) {
      cb(utenti.filter((u) => u.stato === 'attesa').length);
      return () => undefined;
    },
    utenti: async () => copia(utenti),
    async associa(utente, medicoId, principale) {
      aggiornaUtente(utente.uid, { stato: 'approvato', medicoId, principale });
      medici = medici.map((m) => (m.id === medicoId && principale ? { ...m, principaleUid: utente.uid } : m));
    },
    async impostaStato(utente, stato: StatoAccount) {
      aggiornaUtente(utente.uid, { stato });
    },
    async impostaDelegato(utente, delegato) {
      aggiornaUtente(utente.uid, { delegato });
    },
    medici: async () => copia(medici),
    async salvaMedico(m) {
      const id = m.id ?? `demo-nuovo-${++seq}`;
      const nuovo: MedicoAnagrafica = { ...m, id };
      medici = medici.some((x) => x.id === id) ? medici.map((x) => (x.id === id ? { ...x, ...nuovo } : x)) : [...medici, nuovo];
      return id;
    },
    async salvaSedi(s) {
      sedi = { ...s };
    },
    ocrModello: async () => ocrDemo,
    async salvaOcrModello(m) {
      ocrDemo = m;
    },
    importazioni: async () => copia(importazioni),
    mesiPubblicati: async () => copia(pubblicatiDemo),
    async pubblicaImport(piano, autoreUid, avanzamento) {
      const ids = new Map<string, string>();
      for (const n of piano.nuoviMedici) {
        const id = `demo-nuovo-${++seq}`;
        ids.set(n.rif, id);
        medici = [...medici, { id, nome: n.nome, alias: [], attivo: true, cicloManuale: false, principaleUid: null }];
      }
      for (const a of piano.alias) medici = medici.map((m) => (m.id === a.medicoId ? { ...m, alias: [...m.alias, a.alias] } : m));
      const adesso = new Date();
      for (const t of piano.turni) {
        const [anno, mese] = t.chiave.split('-').map(Number) as [number, number];
        imposta(ids.get(t.medico) ?? t.medico, { anno, mese }, t.giorni, adesso);
      }
      piano.mesi.forEach((k, i) => {
        const medici = piano.turni.filter((t) => t.chiave === k).map((t) => ids.get(t.medico) ?? t.medico);
        const voce: MesePubblicato = { chiave: k, medici, caricatoIl: adesso, importId: `imp-demo-${++seq}` };
        const pos = pubblicatiDemo.findIndex((p) => p.chiave === k);
        if (pos >= 0) pubblicatiDemo[pos] = voce;
        else pubblicatiDemo.push(voce);
        avanzamento?.(i + 1, piano.mesi.length);
      });
      const id = `imp${++seq}`;
      importazioni.unshift({ id, data: new Date(), autoreUid, mesi: piano.mesi, numeroAvvisi: piano.avvisi.length });
      return id;
    },
  };
}
