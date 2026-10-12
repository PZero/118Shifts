import { describe, expect, it } from 'vitest';
import { pulisciTesto } from './cognomi';

describe('pulisciTesto', () => {
  it('toglie i caratteri isolati dovuti ai bordi di cella e gli spazi doppi', () => {
    expect(pulisciTesto('Bianchi l\n')).toBe('Bianchi');
    expect(pulisciTesto("  De  Santis  I ")).toBe('De Santis');
    expect(pulisciTesto('')).toBe('');
  });
});
