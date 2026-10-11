// Servizi in memoria per la modalità demo (SOLO sviluppo). Tutti i dati sono inventati.
// Questo modulo è importato solo da demo/DemoApp.tsx, a sua volta caricato solo se import.meta.env.DEV.

import { aggiungiMesi, chiaveMese, dataISO, giorniNelMese, type AnnoMese } from '../domain/date';
import { CICLO } from '../domain/proiezione';
import {
  SEDI_PREDEFINITE,
  type CambioDoc,
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
  { id: 'demo-2', nome: 'Bianchi Demo', alias: ['Bianchi D.'], scarto: 1, sede: 2 },
  { id: 'demo-3', nome: 'Verdi Demo', alias: [], scarto: 2, sede: 4 },
  { id: 'demo-4', nome: 'Neri Demo', alias: [], scarto: 3, sede: 1 },
  { id: 'demo-5', nome: 'Gialli Demo', alias: [], scarto: 4, sede: 3 },
];

/** Ciclo inventato P-M-N-smonto-riposo, con qualche ferie e una reperibilità per il medico demo. */
function giorniDemo(am: AnnoMese, scarto: number, sede: number, ricco: boolean): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const n = giorniNelMese(am.anno, am.mese);
  const base = Math.floor(Date.UTC(am.anno, am.mese - 1, 1) / 86_400_000);
  for (let g = 1; g <= n; g++) {
    const fascia = CICLO[(((base + g + scarto) % 5) + 5) % 5];
    if (fascia) out[String(g)] = [`${fascia}${sede}`];
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

  let utenti: Utente[] = [
    { uid: 'demo-uid', email: 'rossi.demo@esempio.invalid', nome: 'Rossi Demo', stato: 'approvato', medicoId: 'demo-1', principale: true, delegato: true },
    { uid: 'demo-uid-2', email: 'rossi.demo.2@esempio.invalid', nome: 'Rossi Demo (secondo account)', stato: 'approvato', medicoId: 'demo-1', principale: false, delegato: false },
    { uid: 'demo-uid-3', email: 'bianchi.demo@esempio.invalid', nome: 'Bianchi Demo', stato: 'approvato', medicoId: 'demo-2', principale: true, delegato: false },
    { uid: 'demo-uid-4', email: 'nuovo.demo@esempio.invalid', nome: 'Nuovo Utente Demo', stato: 'attesa', principale: false, delegato: false },
    { uid: 'demo-uid-5', email: 'ex.demo@esempio.invalid', nome: 'Ex Utente Demo', stato: 'disabilitato', medicoId: 'demo-5', principale: false, delegato: false },
  ];

  const aggiornaUtente = (uid: string, mod: Partial<Utente>) => {
    utenti = utenti.map((u) => (u.uid === uid ? { ...u, ...mod } : u));
  };
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
