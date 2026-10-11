import { describe, expect, it } from 'vitest';
import { festivitaAnno, festivitaDi, isFestivo, isWeekend, pasqua, riepilogoWeekendFestivita, statoGiorno } from './festivita';

describe('Pasqua', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2038, '2038-04-25'],
    [2000, '2000-04-23'],
  ])('%i → %s', (anno, data) => expect(pasqua(anno)).toBe(data));
});

describe('festività', () => {
  it('include Pasquetta, San Giovanni (Genova) e le nazionali', () => {
    const f = festivitaAnno(2026);
    expect(festivitaDi('2026-04-06')?.nome).toMatch(/Pasquetta/);
    expect(festivitaDi('2026-06-24')?.nome).toMatch(/San Giovanni/);
    expect(f.map((x) => x.data)).toContain('2026-12-26');
    expect(f).toHaveLength(14); // 11 fisse + San Francesco + Pasqua + Pasquetta
    expect(festivitaAnno(2025)).toHaveLength(13); // senza San Francesco
  });
  it('San Francesco, 4 ottobre: festivo dal 2026 (confermato), non prima', () => {
    expect(festivitaDi('2026-10-04')?.nome).toMatch(/San Francesco/);
    expect(isFestivo('2027-10-04')).toBe(true); // lunedì
    expect(festivitaDi('2027-10-04')?.nome).toMatch(/San Francesco/);
    expect(festivitaDi('2025-10-04')).toBeUndefined();
    expect(isFestivo('2024-10-04')).toBe(false); // venerdì
  });
  it('weekend e festivi', () => {
    expect(isWeekend('2026-10-10')).toBe(true); // sabato
    expect(isWeekend('2026-10-12')).toBe(false);
    expect(isFestivo('2026-10-11')).toBe(true); // domenica
    expect(isFestivo('2026-12-08')).toBe(true); // martedì, Immacolata
    expect(isFestivo('2026-12-09')).toBe(false);
  });
});

describe('statoGiorno (regola libero/parziale)', () => {
  it('libero, parziale di giorno/notte, lavorato, smonto', () => {
    expect(statoGiorno('2026-10-10', [], []).stato).toBe('libero');
    expect(statoGiorno('2026-10-10', ['F'], []).stato).toBe('libero');
    expect(statoGiorno('2026-10-10', ['N3'], [])).toMatchObject({ stato: 'parziale', liberoDiGiorno: true, liberoDiNotte: false });
    expect(statoGiorno('2026-10-10', ['M3'], [])).toMatchObject({ stato: 'parziale', liberoDiGiorno: false, liberoDiNotte: true });
    expect(statoGiorno('2026-10-10', ['MC', 'PC'], []).stato).toBe('parziale');
    expect(statoGiorno('2026-10-10', ['P1', 'N1'], []).stato).toBe('lavorato');
    expect(statoGiorno('2026-10-10', [], ['N2'])).toMatchObject({ stato: 'libero', smonto: true });
    expect(statoGiorno('2026-10-10', ['RN', 'f'], []).altri).toEqual(['RN', 'f']);
  });
});

describe('riepilogoWeekendFestivita', () => {
  it('ottobre 2026: sabati, domeniche, San Francesco, cambi', () => {
    // Sabati: 3, 10, 17, 24, 31; domeniche: 4, 11, 18, 25.
    const r = riepilogoWeekendFestivita({
      anno: 2026,
      mese: 10,
      giorni: { '3': ['N1'], '10': ['M2'], '17': ['P1', 'N1'], '25': ['M4'] },
      ultimoGiornoPrecedente: [],
      cambi: [{ data: '2026-10-25', slot: 0, codice: 'M4', verso: 'ceduto' }],
    });
    expect(r.sabati.map((s) => s.stato)).toEqual(['parziale', 'parziale', 'lavorato', 'libero', 'libero']);
    expect(r.domeniche[0]).toMatchObject({ data: '2026-10-04', stato: 'libero', smonto: true });
    expect(r.domeniche[3]!.stato).toBe('libero'); // M4 ceduto
    expect(r.festivita).toHaveLength(1);
    expect(r.festivita[0]).toMatchObject({ data: '2026-10-04', stato: 'libero' });
    expect(r.conteggi.sabati).toEqual({ liberi: 2, parziali: 2, lavorati: 1 });
    expect(r.conteggi.domeniche).toEqual({ liberi: 4, parziali: 0, lavorati: 0 });
  });
  it('smonto del giorno 1 dal mese precedente', () => {
    // 1 novembre 2026 è domenica e Ognissanti.
    const r = riepilogoWeekendFestivita({ anno: 2026, mese: 11, giorni: {}, ultimoGiornoPrecedente: ['N1att'] });
    expect(r.domeniche[0]).toMatchObject({ data: '2026-11-01', smonto: true, stato: 'libero' });
    expect(r.festivita[0]!.nome).toBe('Ognissanti');
  });
});
