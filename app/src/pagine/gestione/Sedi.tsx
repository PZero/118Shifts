// Tabella delle sedi (config/sedi): numero del codice turno → nome mostrato.

import { useEffect, useState } from 'react';
import { useServizi } from '../../sessione/contesto';
import { SEDI_PREDEFINITE, type Sedi } from '../../servizi/tipi';
import { messaggioErroreGenerico } from '../../ui/errori';
import { Icona } from '../../ui/Icona';

export function SediPagina() {
  const servizi = useServizi();
  const [sedi, setSedi] = useState<Sedi | null>(null);
  const [stato, setStato] = useState<{ tono: 'ok' | 'danger'; testo: string }>();
  const [invio, setInvio] = useState(false);

  useEffect(() => {
    servizi
      .sedi()
      .then(setSedi)
      .catch((e) => setStato({ tono: 'danger', testo: messaggioErroreGenerico(e) }));
  }, [servizi]);

  const salva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sedi) return;
    setInvio(true);
    try {
      const pulite = Object.fromEntries(Object.entries(sedi).map(([k, v]) => [k, v.trim() || (SEDI_PREDEFINITE[k] ?? `Sede ${k}`)]));
      await servizi.salvaSedi(pulite);
      setSedi(pulite);
      setStato({ tono: 'ok', testo: 'Nomi delle sedi salvati.' });
    } catch (err) {
      setStato({ tono: 'danger', testo: messaggioErroreGenerico(err) });
    } finally {
      setInvio(false);
    }
  };

  return (
    <section aria-labelledby="titolo-sedi">
      <div className="intestazione-sezione">
        <div>
          <h1 id="titolo-sedi">Sedi</h1>
          <p className="testo-tenue">Il numero dopo la lettera del turno indica la sede (es. M6 = Mattino in sede 6).</p>
        </div>
      </div>
      {sedi === null ? (
        <div className="scheletro" style={{ height: 320 }} />
      ) : (
        <form className="card card-corpo modulo modulo-sedi" onSubmit={salva}>
          <div className="griglia-sedi">
            {Object.keys(SEDI_PREDEFINITE).map((k) => (
              <label key={k} className="campo campo-sede">
                <span className="numero-sede num" aria-hidden="true">
                  {k}
                </span>
                <span className="sr-only">Nome della sede {k}</span>
                <input className="input" value={sedi[k] ?? ''} maxLength={60} onChange={(e) => setSedi({ ...sedi, [k]: e.target.value })} />
              </label>
            ))}
          </div>
          {stato && (
            <p className={`avviso avviso-${stato.tono}`} role="status">
              <Icona nome={stato.tono === 'ok' ? 'spunta' : 'attenzione'} /> {stato.testo}
            </p>
          )}
          <div>
            <button type="submit" className="btn btn-primario" disabled={invio}>
              {invio ? 'Salvataggio…' : 'Salva sedi'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
