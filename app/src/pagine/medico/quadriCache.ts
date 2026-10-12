// Cache condivisa dei quadri mensili (una lettura per mese per sessione e per istanza dei servizi).
import type { QuadroMese, Servizi } from '../../servizi/tipi';

const cache = new WeakMap<Servizi, Map<string, Promise<QuadroMese | null>>>();

/** Carica il quadro del mese (null = non pubblicato). Un errore non resta in cache: si può riprovare. */
export function caricaQuadro(servizi: Servizi, chiaveMese: string): Promise<QuadroMese | null> {
  let mappa = cache.get(servizi);
  if (!mappa) {
    mappa = new Map();
    cache.set(servizi, mappa);
  }
  let p = mappa.get(chiaveMese);
  if (!p) {
    const m = mappa;
    p = servizi.quadro(chiaveMese);
    m.set(chiaveMese, p);
    p.catch(() => m.delete(chiaveMese));
  }
  return p;
}
