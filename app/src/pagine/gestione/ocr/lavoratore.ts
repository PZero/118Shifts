// Web Worker dell'OCR: griglia, lettura celle, ritagli dei cognomi. Nessuna rete.
import { leggiFoglio, preparaRitaglioNome, trovaGriglia, type ImmagineRGBA } from '../../../domain/ocr';
import type { Richiesta, Risposta } from './protocollo';

let immagine: ImmagineRGBA | null = null;

function rispondi(r: Risposta, trasferibili: Transferable[] = []) {
  (self as unknown as Worker).postMessage(r, trasferibili);
}

self.onmessage = (ev: MessageEvent<Richiesta>) => {
  const m = ev.data;
  try {
    switch (m.tipo) {
      case 'carica':
        immagine = { width: m.width, height: m.height, data: new Uint8ClampedArray(m.buffer) };
        rispondi({ id: m.id, tipo: 'ok', dati: null });
        break;
      case 'griglia': {
        if (!immagine) throw new Error('Immagine non caricata');
        const opz = m.righe ? { giorni: m.giorni, righe: m.righe } : { giorni: m.giorni };
        rispondi({ id: m.id, tipo: 'ok', dati: trovaGriglia(immagine, opz) });
        break;
      }
      case 'leggi': {
        if (!immagine) throw new Error('Immagine non caricata');
        const letto = leggiFoglio(immagine, m.griglia, m.modello, {
          onProgresso: (fatti, totale) => rispondi({ id: m.id, tipo: 'progresso', fatti, totale }),
        });
        rispondi({ id: m.id, tipo: 'ok', dati: letto });
        break;
      }
      case 'nomi': {
        if (!immagine) throw new Error('Immagine non caricata');
        const out = m.rettangoli.map((r) => preparaRitaglioNome(immagine!, r));
        rispondi({ id: m.id, tipo: 'ok', dati: out }, out.map((o) => o.data.buffer));
        break;
      }
    }
  } catch (e) {
    rispondi({ id: m.id, tipo: 'errore', messaggio: e instanceof Error ? e.message : String(e) });
  }
};
