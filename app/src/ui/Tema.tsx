// Scelta del tema: automatico (sistema), chiaro, scuro. Salvato solo sul dispositivo.

import { useEffect, useState } from 'react';
import { Icona, type NomeIcona } from './Icona';

type Tema = 'auto' | 'chiaro' | 'scuro';

function leggi(): Tema {
  try {
    const t = localStorage.getItem('tema');
    return t === 'chiaro' || t === 'scuro' ? t : 'auto';
  } catch {
    return 'auto';
  }
}

function applica(t: Tema) {
  const r = document.documentElement;
  if (t === 'chiaro') r.dataset.theme = 'light';
  else if (t === 'scuro') r.dataset.theme = 'dark';
  else delete r.dataset.theme;
  try {
    if (t === 'auto') localStorage.removeItem('tema');
    else localStorage.setItem('tema', t);
  } catch {
    // archiviazione non disponibile: il tema vale per la sessione
  }
}

const VOCI: { t: Tema; nome: NomeIcona; etichetta: string }[] = [
  { t: 'auto', nome: 'automatico', etichetta: 'Tema automatico' },
  { t: 'chiaro', nome: 'sole', etichetta: 'Tema chiaro' },
  { t: 'scuro', nome: 'luna', etichetta: 'Tema scuro' },
];

export function SelettoreTema() {
  const [tema, setTema] = useState<Tema>(leggi);
  useEffect(() => applica(tema), [tema]);
  return (
    <div className="segmenti" role="group" aria-label="Tema">
      {VOCI.map((v) => (
        <button key={v.t} type="button" aria-pressed={tema === v.t} onClick={() => setTema(v.t)} title={v.etichetta}>
          <Icona nome={v.nome} piccola />
          <span className="sr-only">{v.etichetta}</span>
        </button>
      ))}
    </div>
  );
}
