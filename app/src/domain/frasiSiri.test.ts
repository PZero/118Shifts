import { describe, expect, it } from 'vitest';
import { costruisciFrasiSiri } from './frasiSiri';

const medici = [
  { id: 'io', nome: 'Anna Verdi' },
  { id: 'mr', nome: 'Mario Rossi' },
  { id: 'gb', nome: 'Giulia Bianchi' },
];
const sedi = { '1': 'Voltri', '2': 'Nervi' };

// Ottobre 2026: 21 mer, 22 gio, 23 ven, 24 sab
const quadro = {
  '2026-10': {
    '20': { mr: ['N1'] },
    '21': { io: ['M1'], gb: ['P1'], mr: ['N1'] },
    '22': { io: ['N1'], gb: ['M1'], mr: ['P1'] },
    '23': { gb: ['M1'] },
  },
};
const base = { medicoId: 'io', quadro, medici, sedi };
const MSG_SMONTO = 'Grazie per la notte di servizio: ora pensa a te.'; // scelto dall'hash della data (fisso)

describe('costruisciFrasiSiri', () => {
  it('turno singolo con cambio dato e ricevuto', () => {
    const r = costruisciFrasiSiri({ ...base, turni: { '2026-10-21': ['M1'] }, da: '2026-10-21', a: '2026-10-21' });
    expect(r['2026-10-21']!.testo).toBe(
      'Oggi lavori a Voltri, di mattina. Alle 8 darai il cambio a Mario Rossi, alle 14 ti darà il cambio Giulia Bianchi.',
    );
    expect(r['2026-10-21']!.primaDelle8).toBeUndefined();
  });

  it('MP: cambio dato prima della mattina, ricevuto dopo il pomeriggio', () => {
    const q = { '2026-10': { '20': { mr: ['N1'] }, '21': { io: ['M1', 'P1'], gb: ['N1'] } } };
    const r = costruisciFrasiSiri({ ...base, quadro: q, turni: { '2026-10-21': ['M1', 'P1'] }, da: '2026-10-21', a: '2026-10-21' });
    expect(r['2026-10-21']!.testo).toBe(
      'Oggi lavori a Voltri, di mattina e pomeriggio. Alle 8 darai il cambio a Mario Rossi, alle 20 ti darà il cambio Giulia Bianchi.',
    );
  });

  it('notte e smonto prima delle 8', () => {
    const turni = { '2026-10-22': ['N1'], '2026-10-23': [], '2026-10-24': ['M2'] };
    const r = costruisciFrasiSiri({ ...base, turni, da: '2026-10-22', a: '2026-10-23' });
    expect(r['2026-10-22']!.testo).toBe(
      'Oggi lavori a Voltri, di notte. Alle 20 darai il cambio a Mario Rossi, domattina alle 8 ti darà il cambio Giulia Bianchi.',
    );
    expect(r['2026-10-23']!.primaDelle8).toBe(
      'Alle 8 smonti dalla notte a Voltri: ti darà il cambio Giulia Bianchi. Oggi sei di riposo. ' + MSG_SMONTO,
    );
    expect(r['2026-10-23']!.testo).toBe(r['2026-10-23']!.primaDelle8 + ' Il prossimo turno è domani, di mattina a Nervi.');
  });

  it('riposo con prossimo turno dopo qualche giorno e ferie', () => {
    const turni = { '2026-10-20': [], '2026-10-21': ['F'], '2026-10-24': ['N1'], '2026-11-03': ['P2'] };
    const r = costruisciFrasiSiri({ ...base, turni, da: '2026-10-20', a: '2026-10-24' });
    expect(r['2026-10-20']!.testo).toContain('Oggi sei di riposo.');
    expect(r['2026-10-20']!.testo).toMatch(/ Il prossimo turno è sabato 24, di notte a Voltri\.$/);
    expect(r['2026-10-21']!.testo).toMatch(/^Oggi sei in ferie\. .* Il prossimo turno è sabato 24, di notte a Voltri\.$/);
    const r2 = costruisciFrasiSiri({ ...base, turni, da: '2026-10-24', a: '2026-10-25' });
    expect(r2['2026-10-25']!.testo).toMatch(/^Alle 8 smonti dalla notte a Voltri\..*Oggi sei di riposo\..* Il prossimo turno è martedì 3 novembre, di pomeriggio a Nervi\.$/);
  });

  it('cavallo di mese: notte del 31 e smonto il primo', () => {
    const q = {
      '2026-10': { '31': { io: ['N1'], mr: ['P1'] } },
      '2026-11': { '1': { gb: ['M1'] } },
    };
    const turni = { '2026-10-31': ['N1'], '2026-11-01': [] };
    const r = costruisciFrasiSiri({ ...base, quadro: q, turni, da: '2026-10-31', a: '2026-11-01' });
    expect(r['2026-10-31']!.testo).toBe(
      'Oggi lavori a Voltri, di notte. Alle 20 darai il cambio a Mario Rossi, domattina alle 8 ti darà il cambio Giulia Bianchi.',
    );
    expect(r['2026-11-01']!.primaDelle8).toContain('ti darà il cambio Giulia Bianchi.');
  });

  it('colleghi mancanti: frasi omesse senza errori', () => {
    const r = costruisciFrasiSiri({
      ...base,
      quadro: {},
      turni: { '2026-10-21': ['M1'] },
      da: '2026-10-21',
      a: '2026-10-21',
    });
    expect(r['2026-10-21']!.testo).toBe('Oggi lavori a Voltri, di mattina.');
    const r2 = costruisciFrasiSiri({ ...base, medici: [], turni: { '2026-10-21': ['M1'] }, da: '2026-10-21', a: '2026-10-21' });
    expect(r2['2026-10-21']!.testo).toBe('Oggi lavori a Voltri, di mattina.');
  });

  it('assenze, reperibilità e codici sconosciuti', () => {
    const turni = { '2026-10-21': ['f'], '2026-10-22': ['C'], '2026-10-23': ['RG'], '2026-10-24': ['ZZ'], '2026-10-25': ['E'] };
    const r = costruisciFrasiSiri({ ...base, turni, da: '2026-10-21', a: '2026-10-25' });
    expect(r['2026-10-21']!.testo).toBe('Oggi sei in malattia o in permesso. Ti auguro di rimetterti presto.');
    expect(r['2026-10-22']!.testo).toBe('Oggi sei a un corso.');
    expect(r['2026-10-23']!.testo).toBe('Oggi sei reperibile tutto il giorno.');
    expect(r['2026-10-24']!.testo).toBe('Oggi hai il codice ZZ.');
    expect(r['2026-10-25']!.testo).toBe('Oggi hai il codice E.');
  });

  it('sede senza nome in config: usa il numero', () => {
    const r = costruisciFrasiSiri({ ...base, sedi: {}, quadro: {}, turni: { '2026-10-21': ['P3'] }, da: '2026-10-21', a: '2026-10-21' });
    expect(r['2026-10-21']!.testo).toBe('Oggi lavori a sede 3, di pomeriggio.');
  });

  describe('frasi autonome per data parlata', () => {
    const q = {
      // mr: notte del 20 (finisce alle 8 del 21: troppo vicino); gb: pomeriggio del 21 (nessun riposo); lv: libero
      '2026-10': { '20': { mr: ['N1'] }, '21': { io: ['M1'], gb: ['P1'], lv2: ['M2'] }, '22': { gb: ['M1'] } },
      '2026-11': { '3': { io: ['N1'], gb: ['F'], lv: ['P1'], mr: ['M2'] } },
    };
    const m4 = [...medici, { id: 'lv', nome: 'Luca Verdi' }, { id: 'lv2', nome: 'Paola Neri' }];
    const b = { ...base, quadro: q, medici: m4 };

    it('turno di mattina: dove, diTurno, cambio (11 ore) e conMe', () => {
      const r = costruisciFrasiSiri({ ...b, turni: { '2026-10-21': ['M1'] }, da: '2026-10-21', a: '2026-10-21' })['2026-10-21']!;
      expect(r.dove).toBe('Mercoledì 21 ottobre sei a Voltri, di mattina.');
      expect(r.diTurno).toBe('Sì, mercoledì 21 ottobre sei di turno di mattina a Voltri.');
      // Mario esce dalla notte alle 8: escluso; Giulia ha il pomeriggio: escluso; Luca è libero; Paola lavora di mattina: escluso
      expect(r.cambio).toBe('Mercoledì 21 ottobre possono darti il cambio: Luca Verdi.');
      expect(r.conMe).toBe("Mercoledì 21 ottobre con te c'è Paola Neri, di mattina a Nervi.");
    });

    it('data lontana (novembre): data parlata con mese, nessun oggi/domani', () => {
      const turni = { '2026-11-03': ['N1'] };
      const r = costruisciFrasiSiri({ ...b, turni, da: '2026-11-03', a: '2026-11-03' })['2026-11-03']!;
      expect(r.dove).toBe('Martedì 3 novembre sei a Voltri, di notte.');
      expect(r.diTurno).toBe('Sì, martedì 3 novembre sei di turno di notte a Voltri.');
      // Giulia in ferie, Mario di mattina (solo 6 ore prima della notte), Luca di pomeriggio: tutti esclusi; Paola libera
      expect(r.cambio).toBe('Martedì 3 novembre possono darti il cambio: Paola Neri.');
      expect(r.conMe).toBe('Martedì 3 novembre nessun collega in turno con te.');
      for (const t of [r.dove, r.diTurno, r.cambio!, r.conMe!, r.testo]) {
        if (t !== r.testo) expect(t.toLowerCase()).not.toMatch(/oggi|domani/);
      }
    });

    it('riposo e ferie', () => {
      const turni = { '2026-10-22': [], '2026-10-23': ['F'] };
      const r = costruisciFrasiSiri({ ...b, turni, da: '2026-10-22', a: '2026-10-23' });
      expect(r['2026-10-22']!.dove).toBe('Giovedì 22 ottobre non lavori: sei di riposo.');
      expect(r['2026-10-22']!.diTurno).toBe('No, giovedì 22 ottobre sei di riposo.');
      expect(r['2026-10-22']!.cambio).toBe('Giovedì 22 ottobre non sei di turno.');
      expect(r['2026-10-22']!.conMe).toBe('Giovedì 22 ottobre non sei di turno.');
      expect(r['2026-10-23']!.dove).toBe('Venerdì 23 ottobre non lavori: sei in ferie.');
      expect(r['2026-10-23']!.diTurno).toBe('No, venerdì 23 ottobre sei in ferie.');
    });

    it('quadro mancante: cambio e conMe assenti, il resto resta', () => {
      const r = costruisciFrasiSiri({ ...base, quadro: {}, turni: { '2026-10-21': ['N2'] }, da: '2026-10-21', a: '2026-10-21' })['2026-10-21']!;
      expect(r.cambio).toBeUndefined();
      expect(r.conMe).toBeUndefined();
      expect(r.dove).toBe('Mercoledì 21 ottobre sei a Nervi, di notte.');
      expect(r.diTurno).toBe('Sì, mercoledì 21 ottobre sei di turno di notte a Nervi.');
    });

    it('nessun collega in turno con te ma qualcuno libero', () => {
      const qq = { '2026-10': { '22': { io: ['P1'] } } };
      const r = costruisciFrasiSiri({ ...base, quadro: qq, turni: { '2026-10-22': ['P1'] }, da: '2026-10-22', a: '2026-10-22' })['2026-10-22']!;
      expect(r.conMe).toBe('Giovedì 22 ottobre nessun collega in turno con te.');
      expect(r.cambio).toBe('Giovedì 22 ottobre possono darti il cambio: Mario Rossi e Giulia Bianchi.');
    });

    it('nessun collega libero per il cambio', () => {
      const r = costruisciFrasiSiri({ ...b, turni: { '2026-11-03': ['N1'] }, quadro: { '2026-11': { '3': { io: ['N1'], gb: ['F'], lv: ['P1'], mr: ['M2'], lv2: ['C'] } } }, da: '2026-11-03', a: '2026-11-03' })['2026-11-03']!;
      expect(r.cambio).toBe('Martedì 3 novembre nessun collega è libero per darti il cambio.');
    });

    const molti = (n: number, lung = 'Collega Numero') => Array.from({ length: n }, (_, k) => ({ id: `c${String(k).padStart(2, '0')}`, nome: `${lung}${k}` }));
    const lungo = (colleghi: ReturnType<typeof molti>, lavorano: boolean) => {
      const giorno: Record<string, string[]> = { io: ['M1'] };
      if (lavorano) for (const c of colleghi) giorno[c.id] = ['M1'];
      return costruisciFrasiSiri({
        ...base, quadro: { '2026-10': { '22': giorno } }, medici: [{ id: 'io', nome: 'Anna Verdi' }, ...colleghi],
        turni: { '2026-10-22': ['M1'] }, da: '2026-10-22', a: '2026-10-22',
      })['2026-10-22']!;
    };

    it('elenco lungo: massimo 8 nomi poi "e altri N"', () => {
      const c = molti(12);
      const conMe = lungo(c, true).conMe!;
      expect(conMe).toContain('Collega Numero7, di mattina a Voltri e altri 4.');
      expect(conMe).not.toContain('Numero8');
      const cambio = lungo(c, false).cambio!;
      expect(cambio).toBe('Giovedì 22 ottobre possono darti il cambio: ' + c.slice(0, 8).map((x) => x.nome).join(', ') + ' e altri 4.');
    });

    it('nomi molto lunghi: tronca gli elenchi sotto i 600 caratteri', () => {
      const c = molti(12, 'Nome'.repeat(15));
      for (const lav of [true, false]) {
        const r = lungo(c, lav);
        for (const t of [r.testo, r.dove, r.diTurno, r.cambio, r.conMe]) expect((t ?? '').length).toBeLessThanOrEqual(600);
      }
      expect(lungo(c, false).cambio).toMatch(/ e altri \d+\.$/);
      expect(lungo(c, true).conMe).toMatch(/ e altri \d+\.$/);
    });
  });
});
