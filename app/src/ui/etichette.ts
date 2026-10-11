// Etichette di presentazione dei codici (solo testo per l'interfaccia: l'interpretazione è nel dominio).

import { LEGENDA, interpretaCodice, type CodiceTurno, type Fascia } from '../domain/codici';
import { giornoSettimana, scomponi, type DataISO } from '../domain/date';
import type { Sedi } from '../servizi/tipi';

export const NOME_FASCIA: Record<Fascia, string> = { M: 'Mattino', P: 'Pomeriggio', N: 'Notte' };
/** Orari da docs/REQUISITI.md (le ore sono calcolate dal dominio). */
export const ORARIO_FASCIA: Record<Fascia, string> = { M: '08–14', P: '14–20', N: '20–08' };

export const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const GIORNI_BREVI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
export const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

export function nomeMese(anno: number, mese: number): string {
  const n = MESI[mese - 1] ?? '';
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} ${anno}`;
}

export interface EtichettaCodice {
  /** Testo breve per il calendario. */
  breve: string;
  /** Descrizione per il dettaglio. */
  lunga: string;
  /** Classe di stile: fascia o categoria neutra. */
  tono: 'M' | 'P' | 'N' | 'assenza' | 'reperibilita' | 'altro' | 'sconosciuto';
}

export function nomeSede(sedi: Sedi, sede: number | undefined): string | undefined {
  return sede === undefined ? undefined : (sedi[String(sede)] ?? `Sede ${sede}`);
}

export function etichettaCodice(codice: string | CodiceTurno | null, sedi: Sedi): EtichettaCodice {
  const c = typeof codice === 'string' ? interpretaCodice(codice) : codice;
  if (!c) return { breve: '', lunga: '', tono: 'altro' };
  if (c.categoria === 'turno' && c.fascia) {
    const extra = [c.centrale ? 'C' : '', c.attivazione ? 'att' : ''].join('');
    const parti = [`${NOME_FASCIA[c.fascia]} ${ORARIO_FASCIA[c.fascia]}`];
    const sede = nomeSede(sedi, c.sede);
    if (sede) parti.push(sede);
    if (c.centrale) parti.push('suffisso C');
    if (c.attivazione) parti.push('attivazione');
    return { breve: `${c.fascia}${c.sede ?? ''}${extra}`, lunga: parti.join(' · '), tono: c.fascia };
  }
  switch (c.categoria) {
    case 'malattia':
      // Dato sanitario: nessun dettaglio, solo "assenza".
      return { breve: 'Ass.', lunga: 'Assenza', tono: 'assenza' };
    case 'ferie':
      return { breve: 'Ferie', lunga: 'Ferie', tono: 'assenza' };
    case 'indisponibile':
      return { breve: 'Indisp.', lunga: 'Indisponibilità giustificata', tono: 'assenza' };
    case 'corso':
      return { breve: 'Corso', lunga: 'Corso di formazione', tono: 'altro' };
    case 'reperibilita':
      return { breve: c.grezzo, lunga: descrizioneReperibilita(c.grezzo), tono: 'reperibilita' };
    case 'sconosciuto':
      return { breve: c.grezzo, lunga: `Codice ${c.grezzo} (da verificare)`, tono: 'sconosciuto' };
    default: {
      const voce = LEGENDA[c.grezzo];
      const desc = voce && voce.descrizione !== '?' ? voce.descrizione : `Codice ${c.grezzo}`;
      return { breve: c.grezzo, lunga: desc, tono: 'altro' };
    }
  }
}

const REPERIBILITA: Record<string, string> = {
  RM: 'Reperibilità mattina',
  RP: 'Reperibilità pomeriggio',
  RN: 'Reperibilità notte',
  RG: 'Reperibilità giorno (mattina + pomeriggio)',
};

function descrizioneReperibilita(codice: string): string {
  return REPERIBILITA[codice] ?? `Reperibilità (${codice})`;
}

export function dataEstesa(data: DataISO): string {
  const { anno, mese, giorno } = scomponi(data);
  return `${GIORNI[giornoSettimana(data)]} ${giorno} ${MESI[mese - 1]} ${anno}`;
}

export function dataBreve(data: DataISO): string {
  const { mese, giorno } = scomponi(data);
  return `${GIORNI[giornoSettimana(data)]?.slice(0, 3)} ${giorno} ${(MESI[mese - 1] ?? '').slice(0, 3)}`;
}
