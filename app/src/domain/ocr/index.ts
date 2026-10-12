// Pipeline OCR dei fogli turni (immagine -> celle -> codici). Logica pura, adatta a un Web Worker.
export * from './tipi';
export { trovaGriglia, grigliaDaPunti, type OpzioniGriglia } from './griglia';
export { estraiCella, rettangoloCella, CELLA_W, CELLA_H, CELLA_N, SOGLIA_INCHIOSTRO } from './cella';
export { classifica, SIM_MIN, MARG_MIN } from './classifica';
export {
  apprendi,
  modelloVuoto,
  serializzaModello,
  deserializzaModello,
  codiceCanonico,
  MAX_ESEMPI,
  MAX_ESEMPI_PER_CODICE,
  MAX_CARATTERI_MODELLO,
  type ModelloSerializzato,
} from './modello';
export { leggiFoglio, aFoglioMese, type CellaLetta, type FoglioLetto, type OpzioniLettura, type OpzioniFoglioMese } from './foglio';
export { abbinaCognome, rettangoloNome, preparaRitaglioNome, type EsitoCognome, type OpzioniNomi } from './nomi';
