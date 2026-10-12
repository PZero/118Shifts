// Tipi condivisi della pipeline OCR dei fogli turni (logica pura: niente DOM, niente Node).

/** Immagine RGBA, compatibile con ImageData del canvas. */
export interface ImmagineRGBA {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface Punto {
  x: number;
  y: number;
}

export interface Rettangolo {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Griglia del foglio, in pixel dell'immagine.
 * Ogni medico occupa due sotto-righe (passoMedico / 2 ciascuna).
 */
export interface Griglia {
  /** Angolo alto-sinistra della cella del giorno 1, prima sotto-riga del primo medico. */
  x0: number;
  y0: number;
  /** Larghezza di una colonna-giorno. */
  passoX: number;
  /** Altezza di un medico (due sotto-righe). */
  passoMedico: number;
  giorni: number;
  /** Numero di medici (coppie di sotto-righe) coperti dalla griglia. */
  righe: number;
  /** 0..1: quanto la griglia trovata è netta (sotto 0,5 conviene far correggere a mano). */
  affidabilita: number;
}

/** Esempio del modello: codice normalizzato + vettore unitario. */
export interface EsempioOcr {
  c: string;
  v: Float32Array;
}

export interface ModelloOcr {
  versione: number;
  cellaW: number;
  cellaH: number;
  /** In ordine di inserimento: i primi sono i più vecchi. */
  esempi: EsempioOcr[];
}

/** Cella estratta dall'immagine, pronta per la classificazione. */
export interface CellaEstratta {
  /** Vettore centrale normalizzato (norma 1), lunghezza cellaW * cellaH. */
  vettore: Float32Array;
  /** Vettori traslati (per la tolleranza al disallineamento); vuoto per le celle vuote. */
  varianti: Float32Array[];
  /** Numero di campioni scuri: misura dell'inchiostro. */
  inchiostro: number;
  vuota: boolean;
}

export interface Classificazione {
  /** '' = cella vuota (o modello senza esempi). */
  codice: string;
  sim: number;
  marg: number;
  /** Da far verificare all'utente. */
  incerto: boolean;
  /** Secondo candidato, utile come suggerimento. */
  secondo?: string;
}
