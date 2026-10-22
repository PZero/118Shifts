// Scheda "Utilizzo" (solo admin): contatori anonimi delle funzioni usate, per mese.

import { useEffect, useMemo, useState } from 'react';
import { useServizi } from '../../sessione/contesto';
import { EVENTI, meseCorrente } from '../../servizi/statistiche';
import { messaggioErroreGenerico } from '../../ui/errori';
import { Icona } from '../../ui/Icona';

const NOMI_MESE = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

function ultimiMesi(n: number): string[] {
  const oggi = new Date();
  return Array.from({ length: n + 1 }, (_, i) => meseCorrente(new Date(oggi.getFullYear(), oggi.getMonth() - i, 1)));
}

function etichettaMese(chiave: string): string {
  const [a, m] = chiave.split('-').map(Number);
  return `${NOMI_MESE[(m ?? 1) - 1]} ${a}`;
}

interface Riga {
  nome: string;
  etichetta: string;
  n: number;
  prima: number | undefined;
}

function Gruppo({ titolo, righe, haPrecedente }: { titolo: string; righe: Riga[]; haPrecedente: boolean }) {
  if (righe.length === 0) return null;
  const max = Math.max(...righe.map((r) => r.n), 1);
  return (
    <section className="card" aria-label={titolo}>
      <div className="card-corpo">
        <h2 className="card-titolo">{titolo}</h2>
        <ul className="uso-elenco" role="list">
          {righe.map((r) => {
            const diff = r.prima === undefined ? undefined : r.n - r.prima;
            return (
              <li key={r.nome} className="uso-riga">
                <div className="uso-testa">
                  <span className="uso-nome">{r.etichetta}</span>
                  <span className="uso-valore">
                    <b>{r.n}</b>
                    {haPrecedente && diff !== undefined && (
                      <span className={`uso-diff ${diff > 0 ? 'su' : diff < 0 ? 'giu' : ''}`} title="Differenza rispetto al mese precedente">
                        {diff > 0 ? '↑' : diff < 0 ? '↓' : '='} {diff === 0 ? '' : Math.abs(diff)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="uso-barra" aria-hidden="true">
                  <span style={{ width: `${Math.max(2, (r.n / max) * 100)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function Utilizzo() {
  const servizi = useServizi();
  const mesi = useMemo(() => ultimiMesi(6), []);
  const [dati, setDati] = useState<Record<string, Record<string, number>> | null>(null);
  const [errore, setErrore] = useState<string>();
  const [mese, setMese] = useState(mesi[0]!);

  useEffect(() => {
    let attivo = true;
    servizi
      .statistiche(mesi)
      .then((d) => attivo && setDati(d))
      .catch((e) => attivo && setErrore(messaggioErroreGenerico(e)));
    return () => {
      attivo = false;
    };
  }, [servizi, mesi]);

  const corrente = dati?.[mese];
  const precedente = dati?.[mesi[mesi.indexOf(mese) + 1] ?? ''];
  const righe = useMemo(() => {
    const out: Riga[] = [];
    for (const [nome, n] of Object.entries(corrente ?? {})) {
      const def = (EVENTI as Record<string, { etichetta: string; gruppo: string }>)[nome];
      out.push({ nome, etichetta: def?.etichetta ?? nome, n, prima: precedente ? (precedente[nome] ?? 0) : undefined });
    }
    return out.sort((a, b) => b.n - a.n);
  }, [corrente, precedente]);
  const gruppoDi = (nome: string) => (EVENTI as Record<string, { gruppo: string }>)[nome]?.gruppo;

  return (
    <div className="colonna-gestione">
      <div className="card">
        <div className="card-corpo">
          <label className="campo">
            <span>Mese</span>
            <select className="select" value={mese} onChange={(e) => setMese(e.target.value)}>
              {mesi.map((m) => (
                <option key={m} value={m}>
                  {etichettaMese(m)}
                </option>
              ))}
            </select>
          </label>
          <p className="nota">
            <Icona nome="info" piccola /> Contatori anonimi: ogni funzione conta al massimo una volta per sessione, senza alcun dato personale.
          </p>
        </div>
      </div>
      {errore && (
        <p className="avviso avviso-danger" role="alert">
          <Icona nome="attenzione" /> <span>{errore}</span>
        </p>
      )}
      {!errore && dati === null && <p className="testo-tenue">Caricamento…</p>}
      {!errore && dati !== null && righe.length === 0 && (
        <p className="vuoto">Nessun dato per {etichettaMese(mese)}: i contatori si riempiono man mano che l’app viene usata.</p>
      )}
      <Gruppo titolo="Card" righe={righe.filter((r) => gruppoDi(r.nome) === 'card')} haPrecedente={!!precedente} />
      <Gruppo titolo="Azioni" righe={righe.filter((r) => gruppoDi(r.nome) !== 'card')} haPrecedente={!!precedente} />
    </div>
  );
}
