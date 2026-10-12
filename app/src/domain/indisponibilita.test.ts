import { describe, expect, it } from 'vitest';
import {
  alternaFascia,
  alternaTuttoIlGiorno,
  conflittiConTurni,
  linkMailto,
  normalizzaIndisponibilita,
  oggettoEmail,
  riepilogoIndisponibilita,
  testoEmail,
} from './indisponibilita';

describe('indisponibilità', () => {
  it('normalizza ordine, duplicati e valori non validi', () => {
    expect(normalizzaIndisponibilita({ '5': ['N', 'M', 'M', 'X'], '12': [], '99x': ['P'], '7': 'M' })).toEqual({ '5': ['M', 'N'] });
    expect(normalizzaIndisponibilita(null)).toEqual({});
  });

  it('alterna le fasce mantenendo l’ordine e rimuove i giorni vuoti', () => {
    let g = alternaFascia({}, 5, 'N');
    g = alternaFascia(g, 5, 'M');
    expect(g).toEqual({ '5': ['M', 'N'] });
    g = alternaFascia(alternaFascia(g, 5, 'M'), 5, 'N');
    expect(g).toEqual({});
  });

  it('"tutto il giorno" segna le tre fasce, poi le toglie', () => {
    const g = alternaTuttoIlGiorno({ '3': ['P'] }, 3);
    expect(g).toEqual({ '3': ['M', 'P', 'N'] });
    expect(alternaTuttoIlGiorno(g, 3)).toEqual({});
  });

  it('rileva i conflitti con i turni ufficiali', () => {
    const g = normalizzaIndisponibilita({ '5': ['M', 'N'], '12': ['P'] });
    const turni = { '5': ['N6'], '12': ['M2'], '20': ['P1'] };
    expect(conflittiConTurni(g, turni)).toEqual({ '5': ['N'] });
    expect(riepilogoIndisponibilita(g, turni)).toEqual({ giorni: 2, nonRispettate: 1 });
  });

  it('le assenze non sono conflitto', () => {
    expect(conflittiConTurni({ '5': ['M'] }, { '5': ['F'] })).toEqual({});
  });

  it('formatta il testo dell’email', () => {
    const t = testoEmail({ anno: 2026, mese: 11, giorni: { '12': ['P'], '5': ['M', 'N'] }, nomeMedico: 'Rossi Demo' });
    expect(t).toBe(
      [
        'Buongiorno,',
        'come da accordi invio le mie indisponibilità per il mese di novembre 2026:',
        '',
        '* indisponibile per il giorno 05/11/2026 per i turni: M, N',
        '* indisponibile per il giorno 12/11/2026 per i turni: P',
        '',
        'Cordiali saluti',
        'dr. Rossi Demo',
      ].join('\n'),
    );
    expect(oggettoEmail(2026, 11)).toBe('Indisponibilità novembre 2026');
    expect(linkMailto('A b', 'x\ny')).toBe('mailto:?subject=A%20b&body=x%0Ay');
  });
});
