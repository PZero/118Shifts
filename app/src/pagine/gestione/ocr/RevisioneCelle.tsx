// Revisione delle celle lette dall'OCR: coda delle incerte con ritaglio ingrandito, correzione di
// qualsiasi cella (dall'immagine o da una tabella per medico). Ogni conferma insegna qualcosa al modello.
import { useMemo, useState } from 'react';
import { interpretaCodice } from '../../../domain/codici';
import { apprendi, codiceCanonico, type CellaLetta, type FoglioLetto, type ModelloOcr } from '../../../domain/ocr';
import { SEDI_PREDEFINITE } from '../../../servizi/tipi';
import { etichettaCodice } from '../../../ui/etichette';
import { Icona } from '../../../ui/Icona';
import { chiaveCella } from './chiaveCella';
import { ImmagineGriglia } from './ImmagineGriglia';
import { Ritaglio } from './Ritaglio';

export interface StatoCelle {
  /** Codice corrente per indice di cella. */
  valori: string[];
  /** Cella verificata dall'utente (non più incerta). */
  confermate: boolean[];
}

interface Props {
  sorgente: HTMLCanvasElement;
  letto: FoglioLetto;
  /** Etichetta di ogni riga (nome del medico scelto, o "Riga N"). */
  etichette: string[];
  /** Righe assegnate a un medico: solo queste contano per le celle da controllare. */
  attive: boolean[];
  stato: StatoCelle;
  onStato: (s: StatoCelle) => void;
  modello: ModelloOcr;
  onModello: (m: ModelloOcr) => void;
}

// Le celle sono in ordine riga -> sotto-riga -> giorno (come produce leggiFoglio).
const indiceCella = (letto: FoglioLetto, riga: number, sotto: number, giorno: number) => riga * letto.giorni * 2 + sotto * letto.giorni + (giorno - 1);

export function RevisioneCelle({ sorgente, letto, etichette, attive, stato, onStato, modello, onModello }: Props) {
  const [selezionata, setSelezionata] = useState<number | null>(null);
  const [vista, setVista] = useState<'coda' | 'immagine' | 'tabella'>('coda');
  const [rigaTabella, setRigaTabella] = useState(() => Math.max(0, attive.indexOf(true)));
  const [testo, setTesto] = useState('');

  const celle = letto.celle;
  const incerte = useMemo(
    () => celle.map((c, i) => (c.incerto && !stato.confermate[i] && attive[c.riga] ? i : -1)).filter((i) => i >= 0),
    [celle, stato.confermate, attive],
  );

  const frequenti = useMemo(() => {
    const n = new Map<string, number>();
    stato.valori.forEach((v, i) => {
      if (v && attive[celle[i]!.riga]) n.set(v, (n.get(v) ?? 0) + 1);
    });
    return [...n.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([c]) => c);
  }, [stato.valori, celle, attive]);

  const apri = (i: number | null) => {
    setSelezionata(i);
    setTesto(i === null ? '' : (stato.valori[i] ?? ''));
  };

  const prossima = (da: number, escludi: number): number | null => {
    const rest = incerte.filter((i) => i !== escludi);
    if (rest.length === 0) return null;
    return rest.find((i) => i > da) ?? rest[0]!;
  };

  const applica = (i: number, codice: string) => {
    const c = celle[i]!;
    const canonico = codice.trim() === '' ? '' : codiceCanonico(codice.trim());
    const valori = stato.valori.slice();
    const confermate = stato.confermate.slice();
    valori[i] = canonico;
    confermate[i] = true;
    onStato({ valori, confermate });
    if (canonico !== '') onModello(apprendi(modello, c.vettore, canonico));
    // Dalla coda si passa all'incerta successiva; altrove si chiude l'editor.
    if (vista === 'coda') {
      const n = prossima(i, i);
      setSelezionata(n);
      setTesto(n === null ? '' : (stato.valori[n] ?? ''));
    } else apri(null);
  };

  const cellaInfo = (c: CellaLetta) =>
    `${etichette[c.riga] ?? `Riga ${c.riga + 1}`} · giorno ${c.giorno} · ${c.sottoRiga === 0 ? 'riga alta' : 'riga bassa'}`;

  const editor = (i: number) => {
    const c = celle[i]!;
    const corrente = stato.valori[i] ?? '';
    const valido = testo.trim() === '' || interpretaCodice(testo.trim())?.categoria !== 'sconosciuto';
    return (
      <div className="ocr-editor card">
        <div className="card-corpo">
          <p className="nota">{cellaInfo(c)}</p>
          <Ritaglio sorgente={sorgente} rect={c.rect} margine={0.6} larghezza={300} className="ocr-ritaglio ocr-ritaglio-grande" />
          <p className="ocr-lettura">
            Letto: <strong className="num">{corrente || 'vuoto'}</strong>
            {c.secondo && c.secondo !== corrente && (
              <>
                {' '}
                · alternativa: <strong className="num">{c.secondo}</strong>
              </>
            )}
            <span className="testo-tenue"> · somiglianza {Math.round(c.sim * 100)}%</span>
          </p>
          <div className="ocr-rapidi">
            {corrente && (
              <button type="button" className="btn btn-primario" onClick={() => applica(i, corrente)}>
                <Icona nome="spunta" piccola /> Conferma {corrente}
              </button>
            )}
            {c.secondo && c.secondo !== corrente && (
              <button type="button" className="btn btn-secondario" onClick={() => applica(i, c.secondo!)}>
                È {c.secondo}
              </button>
            )}
            <button type="button" className="btn btn-secondario" onClick={() => applica(i, '')}>
              Cella vuota
            </button>
          </div>
          <div className="ocr-rapidi" aria-label="Codici frequenti">
            {frequenti
              .filter((f) => f !== corrente && f !== c.secondo)
              .map((f) => (
                <button key={f} type="button" className="btn btn-fantasma btn-piccolo ocr-codice" onClick={() => applica(i, f)}>
                  {f}
                </button>
              ))}
          </div>
          <form
            className="ocr-scrivi"
            onSubmit={(e) => {
              e.preventDefault();
              applica(i, testo);
            }}
          >
            <label className="campo">
              <span>Scrivi il codice corretto</span>
              <input
                className="input num"
                value={testo}
                maxLength={8}
                autoCapitalize="characters"
                autoComplete="off"
                onChange={(e) => setTesto(e.target.value)}
                placeholder="es. M1, N3, F"
              />
            </label>
            <button type="submit" className="btn btn-primario" disabled={!valido}>
              Applica
            </button>
          </form>
          {!valido && <p className="nota testo-pericolo">Codice non riconosciuto.</p>}
          <div className="ocr-rapidi">
            {incerte.length > 0 && (
              <button type="button" className="btn btn-secondario btn-piccolo" onClick={() => apri(prossima(i, i))}>
                Salta alla prossima
              </button>
            )}
            <button type="button" className="btn btn-fantasma btn-piccolo" onClick={() => apri(null)}>
              Chiudi
            </button>
          </div>
        </div>
      </div>
    );
  };

  const evidenziate = useMemo(
    () => new Set(incerte.map((i) => chiaveCella(celle[i]!.riga, celle[i]!.sottoRiga, celle[i]!.giorno))),
    [incerte, celle],
  );
  const selChiave = selezionata !== null ? chiaveCella(celle[selezionata]!.riga, celle[selezionata]!.sottoRiga, celle[selezionata]!.giorno) : null;
  const righeAttive = letto.nomi.filter((n) => attive[n.riga]);

  const cambiaVista = (v: 'coda' | 'immagine' | 'tabella') => {
    setVista(v);
    apri(v === 'coda' ? (incerte[0] ?? null) : null);
  };

  return (
    <section className="card import-blocco" aria-labelledby="titolo-revisione">
      <div className="card-corpo">
        <h2 id="titolo-revisione" className="card-titolo">
          Controllo delle celle
        </h2>
        <p className={incerte.length > 0 ? 'avviso avviso-warn' : 'avviso avviso-ok'} role="status">
          <Icona nome={incerte.length > 0 ? 'attenzione' : 'spunta'} />
          <span>
            {incerte.length > 0 ? (
              <>
                <strong>{incerte.length}</strong> {incerte.length === 1 ? 'cella da controllare' : 'celle da controllare'}
              </>
            ) : (
              'Tutte le celle evidenziate sono state controllate.'
            )}
          </span>
        </p>
        <div className="segmenti" role="group" aria-label="Modo di controllo">
          <button type="button" aria-pressed={vista === 'coda'} onClick={() => cambiaVista('coda')}>
            Da controllare
          </button>
          <button type="button" aria-pressed={vista === 'immagine'} onClick={() => cambiaVista('immagine')}>
            Sull’immagine
          </button>
          <button type="button" aria-pressed={vista === 'tabella'} onClick={() => cambiaVista('tabella')}>
            Per medico
          </button>
        </div>

        {vista === 'coda' && (
          <div className="ocr-vista">
            {selezionata === null ? (
              incerte.length > 0 ? (
                <button type="button" className="btn btn-primario" onClick={() => apri(incerte[0]!)}>
                  Inizia dalla prima
                </button>
              ) : (
                <p className="testo-tenue">Niente da controllare. Per rivedere una cella usa “Sull’immagine” o “Per medico”.</p>
              )
            ) : (
              editor(selezionata)
            )}
          </div>
        )}

        {vista === 'immagine' && (
          <div className="ocr-vista">
            <p className="testo-tenue">Le celle in arancione sono da controllare. Tocca una cella per vederla e correggerla.</p>
            <ImmagineGriglia
              sorgente={sorgente}
              griglia={letto.griglia}
              evidenziate={evidenziate}
              selezionata={selChiave}
              altezza={300}
              onCella={(r, s, g) => apri(indiceCella(letto, r, s, g))}
            />
            {selezionata !== null && editor(selezionata)}
          </div>
        )}

        {vista === 'tabella' && (
          <div className="ocr-vista">
            {righeAttive.length === 0 ? (
              <p className="testo-tenue">Assegna prima almeno una riga a un medico.</p>
            ) : (
              <>
                <label className="campo">
                  <span>Medico</span>
                  <select
                    className="select"
                    value={rigaTabella}
                    onChange={(e) => {
                      setRigaTabella(Number(e.target.value));
                      apri(null);
                    }}
                  >
                    {righeAttive.map((n) => (
                      <option key={n.riga} value={n.riga}>
                        {etichette[n.riga]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="imp-giorni">
                  {Array.from({ length: letto.giorni }, (_, k) => k + 1).map((g) => (
                    <div key={g} className="imp-giorno">
                      <span className="cal-num num">{g}</span>
                      {[0, 1].map((s) => {
                        const i = indiceCella(letto, rigaTabella, s, g);
                        const v = stato.valori[i] ?? '';
                        const da = celle[i]!.incerto && !stato.confermate[i];
                        const e = v ? etichettaCodice(v, SEDI_PREDEFINITE) : null;
                        return (
                          <button
                            key={s}
                            type="button"
                            className={`chip ocr-chip ${e ? `chip-${e.tono}` : 'ocr-chip-vuoto'} ${da ? 'ocr-chip-incerto' : ''} ${selezionata === i ? 'ocr-chip-sel' : ''}`}
                            aria-label={`Giorno ${g}, riga ${s + 1}: ${v || 'vuoto'}${da ? ', da controllare' : ''}`}
                            onClick={() => apri(i)}
                          >
                            <b>{e ? e.breve : '·'}</b>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {selezionata !== null && celle[selezionata]!.riga === rigaTabella && editor(selezionata)}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
