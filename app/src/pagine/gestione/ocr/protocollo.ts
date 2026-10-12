// Messaggi tra interfaccia e Web Worker dell'OCR.
import type { FoglioLetto, Griglia, ImmagineRGBA, ModelloOcr, Rettangolo } from '../../../domain/ocr';

export type Richiesta =
  | { id: number; tipo: 'carica'; width: number; height: number; buffer: ArrayBuffer }
  | { id: number; tipo: 'griglia'; giorni: number; righe?: number }
  | { id: number; tipo: 'leggi'; griglia: Griglia; modello: ModelloOcr }
  | { id: number; tipo: 'nomi'; rettangoli: Rettangolo[] };

export type Risposta =
  | { id: number; tipo: 'progresso'; fatti: number; totale: number }
  | { id: number; tipo: 'ok'; dati: unknown }
  | { id: number; tipo: 'errore'; messaggio: string };

export type DatiGriglia = Griglia | null;
export type DatiLetto = FoglioLetto;
export type DatiNomi = ImmagineRGBA[];
