// Interfaccia a promesse verso il Web Worker dell'OCR.
import type { FoglioLetto, Griglia, ImmagineRGBA, ModelloOcr, Rettangolo } from '../../../domain/ocr';
import type { Richiesta, Risposta } from './protocollo';

type SenzaId<T> = T extends unknown ? Omit<T, 'id'> : never;

export class ClientOcr {
  private worker: Worker;
  private seq = 0;
  private attese = new Map<number, { ok: (v: unknown) => void; ko: (e: Error) => void; progresso?: (f: number, t: number) => void }>();

  constructor() {
    this.worker = new Worker(new URL('./lavoratore.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (ev: MessageEvent<Risposta>) => {
      const r = ev.data;
      const a = this.attese.get(r.id);
      if (!a) return;
      if (r.tipo === 'progresso') a.progresso?.(r.fatti, r.totale);
      else {
        this.attese.delete(r.id);
        if (r.tipo === 'ok') a.ok(r.dati);
        else a.ko(new Error(r.messaggio));
      }
    };
    this.worker.onerror = (ev) => {
      const err = new Error(ev.message || 'Errore nel processo di lettura');
      for (const a of this.attese.values()) a.ko(err);
      this.attese.clear();
    };
  }

  private invia<T>(m: SenzaId<Richiesta>, trasferibili: Transferable[] = [], progresso?: (f: number, t: number) => void): Promise<T> {
    const id = ++this.seq;
    return new Promise<T>((ok, ko) => {
      const voce: { ok: (v: unknown) => void; ko: (e: Error) => void; progresso?: (f: number, t: number) => void } = { ok: ok as (v: unknown) => void, ko };
      if (progresso) voce.progresso = progresso;
      this.attese.set(id, voce);
      this.worker.postMessage({ ...m, id }, trasferibili);
    });
  }

  /** Il buffer di `img` viene trasferito (e svuotato) nel worker. */
  carica(img: ImageData): Promise<void> {
    return this.invia<void>({ tipo: 'carica', width: img.width, height: img.height, buffer: img.data.buffer as ArrayBuffer }, [img.data.buffer]);
  }

  griglia(giorni: number, righe?: number): Promise<Griglia | null> {
    return this.invia<Griglia | null>(righe ? { tipo: 'griglia', giorni, righe } : { tipo: 'griglia', giorni });
  }

  leggi(griglia: Griglia, modello: ModelloOcr, progresso: (fatti: number, totale: number) => void): Promise<FoglioLetto> {
    return this.invia<FoglioLetto>({ tipo: 'leggi', griglia, modello }, [], progresso);
  }

  nomi(rettangoli: Rettangolo[]): Promise<ImmagineRGBA[]> {
    return this.invia<ImmagineRGBA[]>({ tipo: 'nomi', rettangoli });
  }

  termina() {
    this.worker.terminate();
    this.attese.clear();
  }
}
