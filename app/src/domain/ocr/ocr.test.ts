// Test della pipeline OCR con immagini sintetiche: griglia disegnata a pixel, glifi finti.
// Nessun dato reale.

import { describe, expect, it } from 'vitest';
import type { Medico } from '../anagrafica';
import {
  aFoglioMese,
  abbinaCognome,
  apprendi,
  CELLA_N,
  classifica,
  deserializzaModello,
  estraiCella,
  grigliaDaPunti,
  leggiFoglio,
  MARG_MIN,
  MAX_CARATTERI_MODELLO,
  MAX_ESEMPI_PER_CODICE,
  modelloVuoto,
  preparaRitaglioNome,
  rettangoloNome,
  serializzaModello,
  SIM_MIN,
  trovaGriglia,
  type Griglia,
  type ImmagineRGBA,
  type ModelloOcr,
} from './index';

// ---- Generatore di immagini sintetiche ---------------------------------------------------------

const GIORNI = 10;
const X0 = 100;
const Y0 = 60;
const PX = 24;
const PM = 28; // altezza di un medico (due sotto-righe da 14)

function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tratti (x, y, w, h) nella finestra 22x11 della cella, per il carattere in posizione `pos`. */
function tratti(ch: string, pos: number): [number, number, number, number][] {
  const r = prng(ch.charCodeAt(0) * 31 + pos * 977 + 5);
  const out: [number, number, number, number][] = [];
  const x0 = pos === 0 ? 1 : 12;
  for (let i = 0; i < 3; i++) {
    out.push([x0 + Math.floor(r() * 5), 1 + Math.floor(r() * 5), 2 + Math.floor(r() * 4), 2 + Math.floor(r() * 5)]);
  }
  return out;
}

class Tela {
  readonly img: ImmagineRGBA;
  readonly width: number;
  readonly height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.img = { width, height, data: new Uint8ClampedArray(width * height * 4).fill(255) };
  }
  px(x: number, y: number, v: number): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.img.data[i] = v;
    this.img.data[i + 1] = v;
    this.img.data[i + 2] = v;
  }
  rett(x: number, y: number, w: number, h: number, v: number): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, v);
  }
}

function glifo(t: Tela, codice: string, cx: number, cy: number): void {
  [...codice].slice(0, 2).forEach((ch, pos) => {
    for (const [x, y, w, h] of tratti(ch, pos)) t.rett(cx + 1 + x, cy + 2 + y, w, h, 40);
  });
}

interface Contenuto {
  /** codici[medico][sottoRiga][giorno-1] */
  codici: string[][][];
}

/** Foglio: colonna nomi a sinistra, colonna "mese precedente", giorni, due colonne extra a destra. */
function foglio(c: Contenuto, extraSopra = 0): Tela {
  const medici = c.codici.length;
  const W = X0 + PX * (GIORNI + 3) + 20;
  const H = Y0 + PM * (medici + extraSopra) + 40;
  const t = new Tela(W, H);
  const yTop = Y0 - extraSopra * PM;
  // linee verticali: da una colonna prima (mese precedente) a due oltre l'ultimo giorno
  for (let k = -1; k <= GIORNI + 2; k++) t.rett(X0 + PX * k, yTop, 1, PM * (medici + extraSopra), 90);
  // linee orizzontali: solo tra un medico e l'altro (anche nella colonna dei nomi)
  for (let i = 0; i <= medici + extraSopra; i++) t.rett(10, yTop + PM * i, X0 + PX * (GIORNI + 2) - 10, 1, 90);
  // intestazione e nomi finti nella colonna A
  for (let i = 0; i < medici; i++) t.rett(20, Y0 + PM * i + 9, 30, 6, 60);
  c.codici.forEach((sotto, r) => {
    sotto.forEach((giorni, s) => {
      giorni.forEach((codice, d) => {
        if (codice) glifo(t, codice, X0 + PX * d, Y0 + PM * r + 14 * s);
      });
    });
  });
  return t;
}

const CODICI = ['M1', 'M2', 'P1', 'N3', 'F', 'Q', 'RN', 'C'];

function contenutoBase(): Contenuto {
  const riga = (offset: number): string[] =>
    Array.from({ length: GIORNI }, (_, d) => (d % 3 === 2 ? '' : CODICI[(d + offset) % CODICI.length]!));
  return {
    codici: [
      [riga(0), riga(1)],
      [riga(2), riga(3)],
      [riga(4), riga(5)],
      [riga(6), riga(7)],
    ],
  };
}

/** Modello addestrato sulle celle di una tela (verità = i codici disegnati). */
function addestra(c: Contenuto, g: Griglia, img: ImmagineRGBA, modello: ModelloOcr = modelloVuoto()): ModelloOcr {
  let m = modello;
  c.codici.forEach((sotto, r) =>
    sotto.forEach((giorni, s) =>
      giorni.forEach((codice, d) => {
        if (!codice) return;
        const cella = estraiCella(img, g, r, s as 0 | 1, d + 1, { varianti: false });
        m = apprendi(m, cella.vettore, codice);
      }),
    ),
  );
  return m;
}

const GRIGLIA_NOTA: Griglia = { x0: X0, y0: Y0, passoX: PX, passoMedico: PM, giorni: GIORNI, righe: 4, affidabilita: 1 };

// ---- Griglia -----------------------------------------------------------------------------------

describe('trovaGriglia', () => {
  const t = foglio(contenutoBase());

  it('trova origine, passi e numero di medici, anche con colonne extra a destra e a sinistra', () => {
    const g = trovaGriglia(t.img, { giorni: GIORNI });
    expect(g).not.toBeNull();
    expect(g!.x0).toBeCloseTo(X0, 0);
    expect(g!.passoX).toBeCloseTo(PX, 0);
    expect(g!.y0).toBeCloseTo(Y0, 0);
    expect(g!.passoMedico).toBeCloseTo(PM, 0);
    expect(g!.righe).toBe(4);
    expect(g!.affidabilita).toBeGreaterThan(0.5);
  });

  it('con "righe" noto limita la griglia ai primi medici', () => {
    const g = trovaGriglia(t.img, { giorni: GIORNI, righe: 2 });
    expect(g!.righe).toBe(2);
    expect(g!.y0).toBeCloseTo(Y0, 0);
  });

  it('immagine vuota: nessuna griglia', () => {
    const vuota = new Tela(300, 300).img;
    expect(trovaGriglia(vuota, { giorni: GIORNI })).toBeNull();
  });

  it('correzione manuale con due punti', () => {
    const g = grigliaDaPunti({ x: 100, y: 60 }, { x: 100 + 24 * 10, y: 60 + 28 * 4 }, 10, 4);
    expect(g).toMatchObject({ x0: 100, y0: 60, passoX: 24, passoMedico: 28, giorni: 10, righe: 4, affidabilita: 1 });
  });
});

// ---- Celle e classificazione -------------------------------------------------------------------

describe('estraiCella', () => {
  const c = contenutoBase();
  const t = foglio(c);

  it('cella vuota riconosciuta dalla soglia di inchiostro', () => {
    const v = estraiCella(t.img, GRIGLIA_NOTA, 0, 0, 3); // giorno 3: vuoto
    expect(v.vuota).toBe(true);
    expect(v.varianti).toHaveLength(0);
  });

  it('cella con glifo: vettore unitario e 25 varianti', () => {
    const v = estraiCella(t.img, GRIGLIA_NOTA, 0, 0, 1);
    expect(v.vuota).toBe(false);
    expect(v.vettore).toHaveLength(CELLA_N);
    expect(Math.hypot(...v.vettore)).toBeCloseTo(1, 3);
    expect(v.varianti).toHaveLength(25);
  });
});

describe('classifica', () => {
  const c = contenutoBase();
  const t = foglio(c);
  const modello = addestra(c, GRIGLIA_NOTA, t.img);

  it('riconosce i codici disegnati (anche con la griglia trovata automaticamente)', () => {
    const g = trovaGriglia(t.img, { giorni: GIORNI })!;
    for (const griglia of [GRIGLIA_NOTA, g]) {
      let sbagliati = 0;
      c.codici.forEach((sotto, r) =>
        sotto.forEach((giorni, s) =>
          giorni.forEach((codice, d) => {
            const x = classifica(estraiCella(t.img, griglia, r, s as 0 | 1, d + 1), modello);
            if (x.codice !== codice) sbagliati++;
          }),
        ),
      );
      expect(sbagliati).toBe(0);
    }
  });

  it('spareggio sulla cifra: M1 e M2 differiscono solo nella parte destra', () => {
    const x1 = classifica(estraiCella(t.img, GRIGLIA_NOTA, 0, 0, 1), modello); // M1
    const x2 = classifica(estraiCella(t.img, GRIGLIA_NOTA, 0, 0, 2), modello); // M2
    expect([x1.codice, x2.codice]).toEqual(['M1', 'M2']);
    expect(x1.incerto).toBe(false);
  });

  it('glifo sconosciuto: incerto (similitudine sotto soglia)', () => {
    const ignoto = new Tela(t.width, t.height);
    glifo(ignoto, 'XZ', X0, Y0);
    const x = classifica(estraiCella(ignoto.img, GRIGLIA_NOTA, 0, 0, 1), modello);
    expect(x.sim).toBeLessThan(SIM_MIN);
    expect(x.incerto).toBe(true);
  });

  it('cella vuota: codice vuoto, mai incerto', () => {
    const x = classifica(estraiCella(t.img, GRIGLIA_NOTA, 0, 0, 3), modello);
    expect(x).toMatchObject({ codice: '', incerto: false });
  });

  it('modello senza esempi: incerto', () => {
    const x = classifica(estraiCella(t.img, GRIGLIA_NOTA, 0, 0, 1), modelloVuoto());
    expect(x).toMatchObject({ codice: '', incerto: true });
  });

  it('margine sotto soglia: due codici con lo stesso aspetto sono incerti', () => {
    const v = estraiCella(t.img, GRIGLIA_NOTA, 0, 0, 1, { varianti: false }).vettore;
    let m = apprendi(modelloVuoto(), v, 'Q');
    const quasi = Float32Array.from(v);
    quasi[100] = quasi[100]! + 0.001; // praticamente identico, non scartato come duplicato
    m = apprendi(m, quasi, 'F');
    const x = classifica(v, m);
    expect(x.sim).toBeGreaterThan(SIM_MIN);
    expect(x.marg).toBeLessThan(MARG_MIN);
    expect(x.incerto).toBe(true);
  });

  it('codice fuori grammatica: sempre incerto, anche con corrispondenza perfetta', () => {
    const v = estraiCella(t.img, GRIGLIA_NOTA, 0, 0, 1, { varianti: false }).vettore;
    const m = apprendi(modelloVuoto(), v, 'ZZ9');
    const x = classifica(v, m);
    expect(x.codice).toBe('ZZ9');
    expect(x.sim).toBeGreaterThan(0.99);
    expect(x.incerto).toBe(true);
  });
});

// ---- Modello -----------------------------------------------------------------------------------

describe('apprendi e serializzazione', () => {
  const c = contenutoBase();
  const t = foglio(c);
  const modello = addestra(c, GRIGLIA_NOTA, t.img);

  it('un esempio già presente non viene duplicato; il modello originale non cambia', () => {
    const v = estraiCella(t.img, GRIGLIA_NOTA, 0, 0, 1, { varianti: false }).vettore;
    const n = modello.esempi.length;
    expect(apprendi(modello, v, 'M1').esempi).toHaveLength(n);
    expect(apprendi(modello, v, 'M1')).toBe(modello);
  });

  it('tetto per codice: i più vecchi vengono sostituiti', () => {
    let m = modelloVuoto();
    const r = prng(42);
    for (let i = 0; i < MAX_ESEMPI_PER_CODICE + 10; i++) {
      const v = Float32Array.from({ length: CELLA_N }, () => r());
      m = apprendi(m, v, 'm1');
    }
    expect(m.esempi).toHaveLength(MAX_ESEMPI_PER_CODICE);
    expect(m.esempi.every((e) => e.c === 'M1')).toBe(true);
  });

  it('il budget del documento limita il totale', () => {
    let m = modelloVuoto();
    const r = prng(7);
    const codici = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'F', 'Q', 'C'];
    for (let i = 0; i < codici.length * 30; i++) {
      m = apprendi(m, Float32Array.from({ length: CELLA_N }, () => r()), codici[i % codici.length]!);
    }
    const json = JSON.stringify(serializzaModello(m));
    expect(json.length).toBeLessThan(MAX_CARATTERI_MODELLO + 20_000);
    expect(json.length).toBeLessThan(1_000_000);
  });

  it('round-trip: stessi codici, vettori praticamente uguali, v sotto i 2000 caratteri', () => {
    const ser = serializzaModello(modello);
    expect(ser).toMatchObject({ versione: 1, cellaW: 44, cellaH: 22 });
    expect(ser.esempi.every((e) => e.v.length <= 2000)).toBe(true);
    const back = deserializzaModello(JSON.parse(JSON.stringify(ser)))!;
    expect(back.esempi.map((e) => e.c)).toEqual(modello.esempi.map((e) => e.c));
    modello.esempi.forEach((e, i) => {
      let d = 0;
      for (let k = 0; k < CELLA_N; k++) d += e.v[k]! * back.esempi[i]!.v[k]!;
      expect(d).toBeGreaterThan(0.999);
    });
    // il modello ricaricato classifica come l'originale
    const x = classifica(estraiCella(t.img, GRIGLIA_NOTA, 0, 0, 1), back);
    expect(x.codice).toBe('M1');
  });

  it('formato non valido: null; esempi corrotti scartati', () => {
    expect(deserializzaModello(null)).toBeNull();
    expect(deserializzaModello({ versione: 99, cellaW: 44, cellaH: 22, esempi: [] })).toBeNull();
    const ser = serializzaModello(modello);
    const rotto = { ...ser, esempi: [...ser.esempi, { c: 'M1', v: '!!!' }, { c: '', v: ser.esempi[0]!.v }] };
    expect(deserializzaModello(rotto)!.esempi).toHaveLength(ser.esempi.length);
  });
});

// ---- Lettura del foglio e struttura dell'import --------------------------------------------------

describe('leggiFoglio e aFoglioMese', () => {
  const c = contenutoBase();
  const t = foglio(c);
  const modello = addestra(c, GRIGLIA_NOTA, t.img);

  it('legge tutte le celle, con ritaglio e progresso', () => {
    const g = trovaGriglia(t.img, { giorni: GIORNI })!;
    const avanzamento: number[] = [];
    const letto = leggiFoglio(t.img, g, modello, { onProgresso: (fatti) => avanzamento.push(fatti) });
    expect(letto.celle).toHaveLength(4 * 2 * GIORNI);
    expect(avanzamento).toEqual([1, 2, 3, 4]);
    expect(letto.nomi).toHaveLength(4);
    for (const cella of letto.celle) {
      expect(cella.codice).toBe(c.codici[cella.riga]![cella.sottoRiga]![cella.giorno - 1]);
      expect(cella.incerto).toBe(false);
      expect(cella.rect.w).toBeCloseTo(PX, 0);
    }
  });

  it('produce la struttura dell\'import Excel: max 2 codici per giorno, righe senza nome segnalate', () => {
    const letto = leggiFoglio(t.img, GRIGLIA_NOTA, modello);
    const { mesi, avvisi } = aFoglioMese(letto, { nomi: ['Rossi', 'Bianchi', '', 'Verdi'], anno: 2030, mese: 3 });
    expect(mesi).toHaveLength(1);
    const m = mesi[0]!;
    expect(m).toMatchObject({ anno: 2030, mese: 3, giorniTrovati: GIORNI });
    expect(m.medici.map((x) => x.nome)).toEqual(['Rossi', 'Bianchi', 'Verdi']);
    // giorno 1 del primo medico: M1 sopra, M2 sotto (CODICI[0], CODICI[1])
    expect(m.medici[0]!.giorni['1']).toEqual(['M1', 'M2']);
    expect(m.medici[0]!.giorni['3']).toBeUndefined();
    expect(Object.values(m.medici[0]!.giorni).every((l) => l.length <= 2)).toBe(true);
    expect(avvisi.map((a) => a.tipo)).toEqual(['righe-senza-nome']);
  });

  it('celle incerte e codici sconosciuti diventano avvisi "da controllare"', () => {
    const letto = leggiFoglio(t.img, GRIGLIA_NOTA, modello);
    const cella = letto.celle.find((x) => x.riga === 0 && x.sottoRiga === 0 && x.giorno === 1)!;
    cella.incerto = true;
    const strano = letto.celle.find((x) => x.riga === 0 && x.sottoRiga === 0 && x.giorno === 2)!;
    strano.codice = 'ZZ9';
    const { avvisi } = aFoglioMese(letto, { nomi: ['Rossi', 'Bianchi', 'Verdi', 'Neri'], anno: 2030, mese: 3 });
    expect(avvisi.filter((a) => a.tipo === 'codice-da-controllare').map((a) => a.giorno)).toEqual([1, 2]);
  });
});

// ---- Nomi --------------------------------------------------------------------------------------

describe('cognomi', () => {
  const medici: Medico[] = [
    { id: 'a', nome: 'Alfieri', alias: [] },
    { id: 'b', nome: 'Bertolini', alias: ['Berto'] },
    { id: 'c', nome: 'Bertolino', alias: [] },
    { id: 'd', nome: 'Carminati', alias: [] },
    { id: 'e', nome: 'De Santis', alias: [] },
  ];

  it('esatto (nome o alias, ignorando maiuscole e spazi)', () => {
    expect(abbinaCognome('desantis', medici)).toMatchObject({ tipo: 'esatto', medico: { id: 'e' } });
    expect(abbinaCognome('BERTO', medici)).toMatchObject({ tipo: 'esatto', medico: { id: 'b' } });
  });

  it('piccoli errori di lettura: abbinato con distanza e margine', () => {
    const x = abbinaCognome('Carminat1', medici);
    expect(x).toMatchObject({ tipo: 'approssimato', medico: { id: 'd' }, distanza: 1 });
    expect(abbinaCognome('Alfleri', medici)).toMatchObject({ tipo: 'approssimato', medico: { id: 'a' } });
  });

  it('ambiguo (margine < 1): nessun abbinamento', () => {
    // "Bertolinx" è a distanza 1 sia da Bertolini sia da Bertolino
    expect(abbinaCognome('Bertolinx', medici)).toEqual({ tipo: 'nessuno' });
  });

  it('troppo lontano o troppo corto: nessun abbinamento', () => {
    expect(abbinaCognome('Zanzotto', medici)).toEqual({ tipo: 'nessuno' });
    expect(abbinaCognome('Al', medici)).toEqual({ tipo: 'nessuno' });
    expect(abbinaCognome('', medici)).toEqual({ tipo: 'nessuno' });
  });

  it('ritaglio del nome: rettangolo a sinistra della griglia e immagine in scala', () => {
    const t = foglio(contenutoBase());
    const r = rettangoloNome(GRIGLIA_NOTA, 1);
    expect(r.x + r.w).toBeLessThan(X0);
    expect(r.y).toBeGreaterThan(Y0 + PM);
    const img = preparaRitaglioNome(t.img, r, 3);
    expect(img.width).toBe(Math.round(r.w * 3));
    expect(img.data).toHaveLength(img.width * img.height * 4);
  });
});
