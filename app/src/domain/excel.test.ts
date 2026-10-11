import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { avvisiAbbinamento, categoriaAvviso, leggiExcel, leggiWorkbook, meseDaNomeFoglio, raggruppaAvvisi } from './excel';
import { creaFoglio, workbookFittizio, workbookFittizioXlsx } from './test/workbookFittizio';

describe('meseDaNomeFoglio', () => {
  it('riconosce nomi con spazi e anni a 2 o 4 cifre', () => {
    expect(meseDaNomeFoglio('OTTOBRE 26')).toEqual({ anno: 2026, mese: 10 });
    expect(meseDaNomeFoglio('  novembre   2026 ')).toEqual({ anno: 2026, mese: 11 });
    expect(meseDaNomeFoglio('Riepilogo')).toBeNull();
  });
});

describe('leggiExcel (workbook fittizio)', () => {
  const { mesi, avvisi } = leggiExcel(workbookFittizioXlsx());
  const ottobre = mesi.find((m) => m.mese === 10)!;
  const novembre = mesi.find((m) => m.mese === 11)!;
  const tipi = (t: string) => avvisi.filter((a) => a.tipo === t);

  it('legge i fogli-mese in ordine e segnala quello non riconosciuto', () => {
    expect(mesi.map((m) => [m.anno, m.mese])).toEqual([
      [2026, 10],
      [2026, 11],
    ]);
    expect(tipi('foglio-non-riconosciuto').map((a) => a.foglio)).toEqual(['Riepilogo']);
  });

  it('trova tutti i giorni dalla riga 2, anche con la colonna C vuota', () => {
    expect(ottobre.giorniTrovati).toBe(31);
    expect(novembre.giorniTrovati).toBe(30);
    expect(tipi('giorni-anomali')).toHaveLength(0);
    expect(tipi('intestazione-incoerente')).toHaveLength(0);
  });

  it('legge i medici dai nomi uniti, ignorando legenda e blocchi vuoti', () => {
    expect(ottobre.medici.map((m) => m.nome)).toEqual(['Rossi Mario', 'Di Bello', 'Bianchi Anna', 'Verdi']);
    expect(tipi('righe-senza-nome')).toHaveLength(1);
  });

  it('due codici nello stesso giorno, normalizzati', () => {
    const rossi = ottobre.medici[0]!;
    expect(rossi.giorni['6']).toEqual(['MC', 'PC']);
    expect(rossi.giorni['31']).toEqual(['N1att']);
    expect(rossi.giorni['1']).toEqual(['P3']);
    expect(Object.keys(rossi.giorni)).not.toContain('0');
  });

  it('la colonna del mese precedente va in giornoPrecedente, non nei giorni', () => {
    expect(ottobre.medici[0]!.giornoPrecedente).toEqual(['N2']);
    expect(novembre.medici[0]!.giornoPrecedente).toEqual(['N1att']);
  });

  it('pulizia: spazi non separabili, f/F, numeri', () => {
    const dibello = ottobre.medici[1]!;
    expect(dibello.giorni['1']).toEqual(['f']);
    expect(dibello.giorni['2']).toEqual(['F']);
    expect(dibello.giorni['3']).toEqual(['M5']);
  });

  it('ignora le colonne totali', () => {
    for (const m of ottobre.medici) {
      expect(Object.keys(m.giorni).every((g) => Number(g) >= 1 && Number(g) <= 31)).toBe(true);
      expect(Object.values(m.giorni).flat()).not.toContain('150');
    }
  });

  it('segnala i codici sconosciuti con cella e valore originale, senza scartarli', () => {
    const sconosciuti = tipi('codice-da-controllare');
    expect(sconosciuti.map((a) => a.valore).sort()).toEqual(['274', 'PC16,30', 'laurea']);
    expect(sconosciuti.every((a) => a.cella)).toBe(true);
    expect(ottobre.medici[1]!.giorni['4']).toEqual(['LAUREA']);
  });

  it('segnala i nomi duplicati (dopo normalizzazione)', () => {
    const dup = tipi('nome-duplicato');
    expect(dup).toHaveLength(1);
    expect(dup[0]!.foglio).toBe(' NOVEMBRE  26 ');
  });

  it('controlla la colonna del mese precedente contro il foglio precedente', () => {
    // Rossi: ottobre 31 = N1att, novembre col. B = N1att → coerente. Dibello ≠ "Di Bello"? stesso nome normalizzato:
    // in ottobre il 31 è vuoto, in novembre la colonna B ha "Q" → incoerente.
    const inc = tipi('incoerenza-mese-precedente');
    expect(inc).toHaveLength(1);
    expect(inc[0]!.foglio).toBe(' NOVEMBRE  26 ');
  });
});

describe('casi limite', () => {
  it('mese duplicato: tiene il primo foglio', () => {
    const wb = workbookFittizio();
    XLSX.utils.book_append_sheet(wb, creaFoglio({ nomeFoglio: 'OTTOBRE 2026', anno: 2026, mese: 10, medici: [] }), 'OTTOBRE 2026');
    const r = leggiWorkbook(wb);
    expect(r.mesi.filter((m) => m.mese === 10)).toHaveLength(1);
    expect(r.avvisi.some((a) => a.tipo === 'mese-duplicato')).toBe(true);
  });

  it('nome del foglio e A1/A2 discordanti → avviso', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, creaFoglio({ nomeFoglio: 'MARZO 26', anno: 2026, mese: 3, a1: 'APRILE', medici: [] }), 'MARZO 26');
    const r = leggiWorkbook(wb);
    expect(r.mesi[0]).toMatchObject({ anno: 2026, mese: 3 });
    expect(r.avvisi.some((a) => a.tipo === 'intestazione-incoerente')).toBe(true);
  });

  it('febbraio: si ferma al 28 anche se seguono altre colonne numeriche', () => {
    const wb = XLSX.utils.book_new();
    const ws = creaFoglio({ nomeFoglio: 'FEBBRAIO 27', anno: 2027, mese: 2, medici: [{ nome: 'Gialli', celle: [[28, 0, 'M1']] }] });
    XLSX.utils.book_append_sheet(wb, ws, 'FEBBRAIO 27');
    const r = leggiWorkbook(wb);
    expect(r.mesi[0]!.giorniTrovati).toBe(28);
    expect(r.mesi[0]!.medici[0]!.giorni['28']).toEqual(['M1']);
  });

  it('nome non unito in mezzo ai medici → avviso', () => {
    const wb = XLSX.utils.book_new();
    const ws = creaFoglio({
      nomeFoglio: 'MAGGIO 27',
      anno: 2027,
      mese: 5,
      medici: [
        { nome: 'Uno', celle: [] },
        { nome: 'Due', celle: [] },
      ],
    });
    ws['!merges'] = ws['!merges']!.slice(1); // "Uno" non più unito
    XLSX.utils.book_append_sheet(wb, ws, 'MAGGIO 27');
    const r = leggiWorkbook(wb);
    expect(r.mesi[0]!.medici.map((m) => m.nome)).toEqual(['Due']);
    expect(r.avvisi.some((a) => a.tipo === 'nome-non-unito')).toBe(true);
  });

  it('senza celle unite: lettura a coppie di righe, legenda scartata', () => {
    const wb = XLSX.utils.book_new();
    const ws = creaFoglio({
      nomeFoglio: 'GIUGNO 27',
      anno: 2027,
      mese: 6,
      legenda: true,
      medici: [{ nome: 'Uno', celle: [[1, 0, 'M1'], [1, 1, 'P1']] }],
    });
    delete ws['!merges'];
    XLSX.utils.book_append_sheet(wb, ws, 'GIUGNO 27');
    const r = leggiWorkbook(wb);
    expect(r.mesi[0]!.medici.map((m) => [m.nome, m.giorni['1']])).toEqual([['Uno', ['M1', 'P1']]]);
    expect(r.avvisi.some((a) => a.tipo === 'senza-celle-unite')).toBe(true);
  });
});

describe('avvisi di import strutturati (anteprima UI)', () => {
  const risultato = leggiExcel(workbookFittizioXlsx());
  const gruppi = raggruppaAvvisi(risultato.avvisi);

  it('ogni avviso ha la categoria derivata dal tipo', () => {
    for (const a of risultato.avvisi) expect(a.categoria).toBe(categoriaAvviso(a.tipo));
    expect(Object.keys(gruppi).sort()).toEqual(['anagrafica', 'codici', 'formato', 'mese-precedente', 'senza-nome']);
  });

  it('codici da controllare: foglio, medico, giorno, riga, cella, valore', () => {
    const laurea = gruppi.codici.find((a) => a.valore === 'laurea')!;
    expect(laurea).toMatchObject({ tipo: 'codice-da-controllare', foglio: 'OTTOBRE 26', medico: 'Di Bello', giorno: 4 });
    expect(laurea.riga).toBeGreaterThan(2);
    expect(laurea.cella).toMatch(/^[A-Z]+\d+$/);
    expect(gruppi.codici.map((a) => a.giorno).sort((x, y) => x! - y!)).toEqual([4, 5, 9]);
  });

  it('righe con turni ma senza nome', () => {
    expect(gruppi['senza-nome']).toHaveLength(1);
    expect(gruppi['senza-nome'][0]).toMatchObject({ foglio: 'OTTOBRE 26', tipo: 'righe-senza-nome' });
    expect(gruppi['senza-nome'][0]!.riga).toBeGreaterThan(2);
  });

  it('colonna B incoerente con il mese precedente: medico e riga', () => {
    expect(gruppi['mese-precedente']).toHaveLength(1);
    expect(gruppi['mese-precedente'][0]).toMatchObject({ foglio: ' NOVEMBRE  26 ', medico: 'Dibello' });
    expect(gruppi['mese-precedente'][0]!.messaggio).toMatch(/Q/);
  });

  it('riga con turni senza nome fuori dalle celle unite', () => {
    const wb = XLSX.utils.book_new();
    const ws = creaFoglio({
      nomeFoglio: 'MAGGIO 27',
      anno: 2027,
      mese: 5,
      medici: [
        { nome: null, celle: [[3, 0, 'M1']] },
        { nome: 'Due', celle: [] },
      ],
    });
    ws['!merges'] = ws['!merges']!.slice(1); // primo blocco non unito, senza nome
    XLSX.utils.book_append_sheet(wb, ws, 'MAGGIO 27');
    const r = leggiWorkbook(wb);
    expect(r.avvisi.filter((a) => a.tipo === 'righe-senza-nome').map((a) => a.riga)).toEqual([3]);
  });

  it('nomi non abbinati o ambigui all\'anagrafica (avvisiAbbinamento)', () => {
    const anagrafica = [
      { id: 'a', nome: 'Rossi Mario', alias: [] },
      { id: 'b', nome: 'Di Bello', alias: [] },
      { id: 'c', nome: 'Bianchi Ana', alias: [] }, // refuso: suggerimento, non abbinamento
      { id: 'd', nome: 'Neri', alias: [] },
      { id: 'e', nome: 'neri', alias: [] }, // ambiguo
    ];
    const avvisi = avvisiAbbinamento(risultato, anagrafica);
    expect(avvisi.every((a) => a.categoria === 'anagrafica')).toBe(true);
    const nonAbbinati = avvisi.filter((a) => a.tipo === 'nome-non-abbinato').map((a) => [a.foglio, a.medico, a.suggerimenti]);
    expect(nonAbbinati).toEqual([
      ['OTTOBRE 26', 'Bianchi Anna', ['Bianchi Ana']],
      ['OTTOBRE 26', 'Verdi', []],
    ]);
    const ambigui = avvisi.filter((a) => a.tipo === 'nome-ambiguo');
    expect(ambigui).toHaveLength(1); // "Neri" e "NERI" nello stesso foglio: un solo avviso
    expect(ambigui[0]).toMatchObject({ foglio: ' NOVEMBRE  26 ', medico: 'Neri' });
  });
});
