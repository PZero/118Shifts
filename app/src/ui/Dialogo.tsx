// Dialogo modale basato su <dialog> nativo: focus intrappolato, Esc per chiudere, sfondo inerte.
// Su schermi stretti diventa un pannello dal basso.

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icona } from './Icona';

interface Props {
  aperto: boolean;
  titolo: string;
  onChiudi: () => void;
  children: ReactNode;
  piede?: ReactNode;
  descrizione?: string;
}

export function Dialogo({ aperto, titolo, onChiudi, children, piede, descrizione }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitolo = useId();
  const idDesc = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aperto && !d.open) d.showModal();
    if (!aperto && d.open) d.close();
  }, [aperto]);

  return (
    <dialog
      ref={ref}
      className="dialogo"
      aria-labelledby={idTitolo}
      aria-describedby={descrizione ? idDesc : undefined}
      onClose={onChiudi}
      onCancel={(e) => {
        e.preventDefault();
        onChiudi();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onChiudi();
      }}
    >
      {aperto && (
        <>
          <div className="dialogo-testa">
            <h2 id={idTitolo}>{titolo}</h2>
            <button type="button" className="btn btn-fantasma btn-icona" onClick={onChiudi} aria-label="Chiudi">
              <Icona nome="chiudi" />
            </button>
          </div>
          <div className="dialogo-corpo">
            {descrizione && (
              <p id={idDesc} style={{ color: 'var(--text-2)' }}>
                {descrizione}
              </p>
            )}
            {children}
          </div>
          {piede && <div className="dialogo-piede">{piede}</div>}
        </>
      )}
    </dialog>
  );
}
