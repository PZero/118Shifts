import { describe, expect, it } from 'vitest';
import { costruisciFrasiSiri } from './frasiSiri';
import {
  MESSAGGI_POSITIVI,
  messaggioFisso,
  messaggioPositivo,
  riepilogoGiorno,
  testoRiepilogo,
  tipoMessaggio,
} from './riepilogoGiorno';

const medici = [
  { id: 'io', nome: 'Anna Verdi' },
  { id: 'mr', nome: 'Mario Rossi' },
  { id: 'gb', nome: 'Giulia Bianchi' },
];
const sedi = { '1': 'Voltri', '2': 'Nervi' };
const quadro = {
  '2026-10': {
    '21': { io: ['M1', 'P1'], gb: ['N1'], mr: ['N1'] },
    '22': { io: ['N1'], gb: ['M1'], mr: ['P1'] },
    '23': { gb: ['M1'], mr: ['P1'] },
  },
};
const base = { medicoId: 'io', quadro, medici, sedi };

describe('riepilogoGiorno', () => {
  it('turno M+P con orari dei cambi', () => {
    const q = { '2026-10': { '20': { mr: ['N1'] }, '21': { io: ['M1', 'P1'], gb: ['N1'] } } };
    const r = riepilogoGiorno({ ...base, quadro: q, turni: { '2026-10-21': ['M1', 'P1'] }, data: '2026-10-21' });
    expect(r.tipo).toBe('turno');
    expect(r.frase).toBe('lavori a Voltri, di mattina e pomeriggio. Alle 8 darai il cambio a Mario Rossi, alle 20 ti darà il cambio Giulia Bianchi.');
    expect(r.smonto).toBeUndefined();
    expect(r.positivo).toBeUndefined();
  });

  it('notte: cambio dato alle 20, ricevuto la mattina dopo (parole in base al prefisso)', () => {
    const turni = { '2026-10-22': ['N1'] };
    expect(riepilogoGiorno({ ...base, turni, data: '2026-10-22' }).frase).toBe(
      'lavori a Voltri, di notte. Alle 20 darai il cambio a Mario Rossi, domattina alle 8 ti darà il cambio Giulia Bianchi.',
    );
    expect(riepilogoGiorno({ ...base, turni, data: '2026-10-22', prefisso: 'Domani' }).frase).toContain('dopodomani mattina alle 8');
    expect(riepilogoGiorno({ ...base, turni, data: '2026-10-22', prefisso: 'giovedì 22 ottobre' }).frase).toContain('il mattino dopo alle 8');
  });

  it('smonto + riposo (giorno festivo): tipo smonto, positivo', () => {
    // 2026-12-25 Natale: dopo la notte del 24
    const q = { '2026-12': { '24': { io: ['N1'], gb: ['P1'] }, '25': { gb: ['M1'] } } };
    const turni = { '2026-12-24': ['N1'], '2026-12-25': [] };
    const r = riepilogoGiorno({ ...base, quadro: q, turni, data: '2026-12-25' });
    expect(r.tipo).toBe('smonto');
    expect(r.smonto).toBe('Alle 8 smonti dalla notte a Voltri: ti darà il cambio Giulia Bianchi.');
    expect(r.frase).toBe('sei di riposo.');
    expect(r.positivo).toBe(true);
    expect(tipoMessaggio(r)).toBe('dopoSmonto');
    const d = riepilogoGiorno({ ...base, quadro: q, turni, data: '2026-12-25', prefisso: 'Domani' });
    expect(d.smonto).toMatch(/^Domani alle 8 smonti/);
  });

  it('smonto + turno P lo stesso giorno: smonto presente, tipo turno', () => {
    const q = { '2026-10': { '21': { io: ['N1'], gb: ['M1'] }, '22': { io: ['P1'], mr: ['N1'], gb: ['M1'] } } };
    const turni = { '2026-10-21': ['N1'], '2026-10-22': ['P1'] };
    const r = riepilogoGiorno({ ...base, quadro: q, turni, data: '2026-10-22' });
    expect(r.tipo).toBe('turno');
    expect(r.smonto).toContain('Alle 8 smonti dalla notte a Voltri');
    expect(r.frase).toMatch(/^lavori a Voltri, di pomeriggio\./);
    expect(r.positivo).toBeUndefined();
    expect(tipoMessaggio(r)).toBeUndefined();
    expect(testoRiepilogo(r, 'Oggi')).toBe(`${r.smonto} Oggi ${r.frase}`);
  });

  it('smonto + ferie: smonto sempre presente', () => {
    const turni = { '2026-10-22': ['N1'], '2026-10-23': ['F'] };
    const r = riepilogoGiorno({ ...base, turni, data: '2026-10-23' });
    expect(r.tipo).toBe('ferie');
    expect(r.smonto).toBeDefined();
    expect(r.positivo).toBe(true);
    expect(tipoMessaggio(r)).toBe('dopoSmonto');
  });

  it('ferie, riposo, malattia, reperibilità, codice sconosciuto', () => {
    const turni = { '2026-10-20': ['F'], '2026-10-21': [], '2026-10-22': ['f'], '2026-10-23': ['RM'], '2026-10-24': ['ZZ'] };
    const r = (data: string) => riepilogoGiorno({ ...base, turni, data });
    expect(r('2026-10-20')).toEqual({ tipo: 'ferie', frase: 'sei in ferie.', positivo: true });
    expect(r('2026-10-21')).toEqual({ tipo: 'riposo', frase: 'sei di riposo.', positivo: true });
    expect(r('2026-10-22')).toEqual({ tipo: 'malattia', frase: 'sei in malattia o in permesso.' });
    expect(tipoMessaggio(r('2026-10-22'))).toBe('sobrio');
    expect(r('2026-10-23')).toEqual({ tipo: 'reperibilita', frase: 'sei reperibile al mattino.' });
    expect(r('2026-10-24')).toEqual({ tipo: 'altro', frase: 'hai il codice ZZ.' });
  });

  it('quadro mancante e sede senza nome: parti omesse senza errori', () => {
    const r = riepilogoGiorno({ ...base, quadro: {}, sedi: {}, turni: { '2026-10-21': ['P3'] }, data: '2026-10-21' });
    expect(r.frase).toBe('lavori a sede 3, di pomeriggio.');
    const s = riepilogoGiorno({ ...base, quadro: {}, turni: { '2026-10-21': ['N1'], '2026-10-22': [] }, data: '2026-10-22' });
    expect(s.smonto).toBe('Alle 8 smonti dalla notte a Voltri.');
  });
});

describe('messaggioPositivo', () => {
  it('liste non vuote, frasi corte e senza duplicati', () => {
    for (const lista of Object.values(MESSAGGI_POSITIVI)) {
      expect(lista.length).toBeGreaterThan(0);
      expect(new Set(lista).size).toBe(lista.length);
      for (const m of lista) expect(m.length).toBeLessThan(80);
    }
    const totale = Object.values(MESSAGGI_POSITIVI).reduce((n, l) => n + l.length, 0);
    expect(totale).toBeGreaterThanOrEqual(20);
  });

  it('usa il generatore casuale (anche agli estremi) e rispetta il tipo', () => {
    expect(messaggioPositivo('ferie', () => 0)).toBe(MESSAGGI_POSITIVI.ferie[0]);
    expect(messaggioPositivo('ferie', () => 0.9999)).toBe(MESSAGGI_POSITIVI.ferie.at(-1));
    expect(messaggioPositivo('ferie', () => 1)).toBe(MESSAGGI_POSITIVI.ferie.at(-1));
    expect(messaggioPositivo(undefined, () => 0)).toBe(MESSAGGI_POSITIVI.riposo[0]);
  });

  it('escludi: evita la frase precedente', () => {
    const prima = MESSAGGI_POSITIVI.riposo[0]!;
    expect(messaggioPositivo('riposo', () => 0, prima)).toBe(MESSAGGI_POSITIVI.riposo[1]);
    for (let k = 0; k < 20; k++) expect(messaggioPositivo('riposo', () => k / 20, prima)).not.toBe(prima);
  });
});

describe('frasi Siri: determinismo', () => {
  it('stesso input, stesso output; il messaggio dipende solo dalla data', () => {
    const args = { ...base, turni: { '2026-10-20': [], '2026-10-21': ['F'] }, da: '2026-10-20' as const, a: '2026-10-21' as const };
    const a = costruisciFrasiSiri(args);
    const b = costruisciFrasiSiri(args);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const r = riepilogoGiorno({ ...base, turni: args.turni, data: '2026-10-20' });
    expect(a['2026-10-20']!.testo).toContain(messaggioFisso(r, '2026-10-20')!);
  });
});
