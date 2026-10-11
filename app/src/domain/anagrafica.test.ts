import { describe, expect, it } from 'vitest';
import { abbinaNome, chiaviInConflitto, conAlias, normalizzaNome, pulisciNome, type Medico } from './anagrafica';

const medici: Medico[] = [
  { id: 'a', nome: 'Desantis', alias: [] },
  { id: 'b', nome: 'Rossi Mario', alias: ['Rossi M.'] },
  { id: 'c', nome: "D'Arco", alias: [] },
  { id: 'd', nome: 'Bianchi', alias: [] },
];

describe('normalizzazione', () => {
  it('ignora spazi, maiuscole, accenti, apostrofi, punti', () => {
    expect(normalizzaNome('De santis')).toBe('desantis');
    expect(normalizzaNome('DE  SANTIS')).toBe('desantis');
    expect(normalizzaNome("D'Àrco")).toBe('darco');
    expect(normalizzaNome('Rossi\u00A0M.')).toBe('rossim');
  });
  it('pulisciNome normalizza solo gli spazi', () => {
    expect(pulisciNome('  Rossi\u00A0  Mario ')).toBe('Rossi Mario');
  });
});

describe('abbinaNome', () => {
  it('per nome normalizzato', () => {
    expect(abbinaNome('De santis', medici)).toEqual({ tipo: 'nome', medico: medici[0] });
    expect(abbinaNome('d arco', medici)).toMatchObject({ tipo: 'nome', medico: { id: 'c' } });
  });
  it('per alias', () => {
    expect(abbinaNome('ROSSI M', medici)).toMatchObject({ tipo: 'alias', medico: { id: 'b' } });
  });
  it('nessun abbinamento automatico per refusi: solo suggerimenti', () => {
    const r = abbinaNome('Desantiz', medici);
    expect(r.tipo).toBe('nessuno');
    expect(r.tipo === 'nessuno' && r.suggerimenti.map((m) => m.id)).toEqual(['a']);
  });
  it('suggerisce parole invertite', () => {
    const r = abbinaNome('Mario Rossi', medici);
    expect(r.tipo === 'nessuno' && r.suggerimenti.map((m) => m.id)).toEqual(['b']);
  });
  it("il nome prevale sull'alias; ambiguo se la chiave appartiene a più medici", () => {
    const doppi: Medico[] = [...medici, { id: 'e', nome: 'Neri', alias: ['Bianchi'] }];
    expect(abbinaNome('bianchi', doppi)).toMatchObject({ tipo: 'nome', medico: { id: 'd' } });
    expect(chiaviInConflitto(doppi)).toEqual(['bianchi']);
    const senzaNome: Medico[] = [{ id: 'x', nome: 'X', alias: ['Bianchi'] }, { id: 'y', nome: 'Y', alias: ['Bianchi'] }];
    expect(abbinaNome('Bianchi', senzaNome).tipo).toBe('ambiguo');
  });
  it('nome vuoto', () => {
    expect(abbinaNome('  ', medici)).toEqual({ tipo: 'nessuno', suggerimenti: [] });
  });
});

describe('conAlias', () => {
  it('aggiunge solo alias nuovi', () => {
    expect(conAlias(medici[0]!, 'De Santis').alias).toEqual([]);
    expect(conAlias(medici[0]!, ' De Santis A. ').alias).toEqual(['De Santis A.']);
  });
});
