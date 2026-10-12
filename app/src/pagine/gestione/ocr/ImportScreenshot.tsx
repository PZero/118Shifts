// Import dei turni da screenshot: immagine -> griglia -> lettura (Web Worker) -> cognomi (tesseract.js)
// -> controllo delle celle incerte -> stesso risultato dell'import Excel (anteprima e pubblicazione).
// L'immagine non lascia mai il browser: si pubblicano solo i codici confermati.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnnoMese } from '../../../domain/date';
import { giorniNelMese } from '../../../domain/date';
import type { RisultatoImport } from '../../../domain/excel';
import {
  abbinaCognome,
  aFoglioMese,
  deserializzaModello,
  grigliaDaPunti,
  serializzaModello,
  type FoglioLetto,
  type Griglia,
  type ModelloOcr,
  type Punto,
} from '../../../domain/ocr';
import { useProfilo, useServizi, useSessione } from '../../../sessione/contesto';
import type { MedicoAnagrafica } from '../../../servizi/tipi';
import { messaggioErroreGenerico } from '../../../ui/errori';
import { MESI, nomeMese } from '../../../ui/etichette';
import { Icona } from '../../../ui/Icona';
import { ClientOcr } from './clientOcr';
import { ImmagineGriglia } from './ImmagineGriglia';
import { Ritaglio } from './Ritaglio';
import { RevisioneCelle, type StatoCelle } from './RevisioneCelle';

const MAX_BYTE_IMMAGINE = 25 * 1024 * 1024;
const MAX_PIXEL = 40_000_000;

export interface EsitoScreenshot {
  risultato: RisultatoImport;
  etichetta: string;
  mese: AnnoMese;
  /** Modello aggiornato da salvare alla pubblicazione; null se non è cambiato nulla. */
  modello: ModelloOcr | null;
}

type StatoModello = { tipo: 'caricamento' } | { tipo: 'ok' } | { tipo: 'assente'; motivo?: string };
type Fase = 'scelta' | 'griglia' | 'lettura' | 'revisione';

export function ImportScreenshot({ onPronto, meseIniziale }: { onPronto: (e: EsitoScreenshot) => void; meseIniziale: AnnoMese }) {
  const servizi = useServizi();
  const profilo = useProfilo();
  const { demo } = useSessione();
  const campoImmagine = useRef<HTMLInputElement>(null);
  const campoModello = useRef<HTMLInputElement>(null);
  const client = useRef<ClientOcr | null>(null);

  const [mese, setMese] = useState<AnnoMese>(meseIniziale);
  const [statoModello, setStatoModello] = useState<StatoModello>({ tipo: 'caricamento' });
  const [modello, setModello] = useState<ModelloOcr | null>(null);
  const [modelloIniziale, setModelloIniziale] = useState<ModelloOcr | null>(null);
  const [medici, setMedici] = useState<MedicoAnagrafica[]>([]);
  const [errore, setErrore] = useState<string>();
  const [occupato, setOccupato] = useState<string>();
  const [fase, setFase] = useState<Fase>('scelta');
  const [sorgente, setSorgente] = useState<HTMLCanvasElement | null>(null);
  const [griglia, setGriglia] = useState<Griglia | null>(null);
  const [correggi, setCorreggi] = useState(false);
  const [punti, setPunti] = useState<Punto[]>([]);
  const [righe, setRighe] = useState(10);
  const [corretta, setCorretta] = useState(false);
  const [avanzamento, setAvanzamento] = useState<{ fase: string; fatti: number; totale: number } | null>(null);
  const [letto, setLetto] = useState<FoglioLetto | null>(null);
  const [testiNomi, setTestiNomi] = useState<string[]>([]);
  const [avvisoNomi, setAvvisoNomi] = useState<string>();
  const [scelteMedico, setScelteMedico] = useState<string[]>([]);
  const [stato, setStato] = useState<StatoCelle>({ valori: [], confermate: [] });

  const giorni = giorniNelMese(mese.anno, mese.mese);

  useEffect(() => {
    let attivo = true;
    Promise.all([servizi.ocrModello(), servizi.medici()])
      .then(([doc, m]) => {
        if (!attivo) return;
        setMedici(m);
        const mod = doc ? deserializzaModello(doc) : null;
        if (mod && mod.esempi.length > 0) {
          setModelloIniziale(mod);
          setModello(mod);
          setStatoModello({ tipo: 'ok' });
        } else {
          setStatoModello({ tipo: 'assente', ...(doc ? { motivo: 'Il modello salvato non è nel formato atteso.' } : {}) });
        }
      })
      .catch((e) => {
        if (!attivo) return;
        setStatoModello({ tipo: 'assente', motivo: `Impossibile leggere il modello: ${messaggioErroreGenerico(e)}` });
        servizi.medici().then((m) => attivo && setMedici(m)).catch(() => undefined);
      });
    return () => {
      attivo = false;
    };
  }, [servizi]);

  useEffect(
    () => () => {
      client.current?.termina();
      client.current = null;
    },
    [],
  );

  const caricaModelloIniziale = async (file: File) => {
    setErrore(undefined);
    setOccupato('Salvataggio del modello…');
    try {
      const mod = deserializzaModello(JSON.parse(await file.text()));
      if (!mod || mod.esempi.length === 0) throw new Error('il file non è un modello OCR valido (versione, dimensioni o esempi non riconosciuti)');
      await servizi.salvaOcrModello(serializzaModello(mod), profilo.uid);
      setModelloIniziale(mod);
      setModello(mod);
      setStatoModello({ tipo: 'ok' });
    } catch (e) {
      setErrore(`Modello non caricato: ${messaggioErroreGenerico(e)}`);
    } finally {
      setOccupato(undefined);
      if (campoModello.current) campoModello.current.value = '';
    }
  };

  /** Dal canvas già disegnato: lo passa al worker e cerca la griglia. */
  const avviaDaCanvas = async (canvas: HTMLCanvasElement, giorniMese: number) => {
    if (canvas.width * canvas.height > MAX_PIXEL) throw new Error('l’immagine è troppo grande (oltre 40 megapixel)');
    client.current?.termina();
    client.current = new ClientOcr();
    const dati = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height);
    await client.current.carica(dati);
    const g = await client.current.griglia(giorniMese);
    setSorgente(canvas);
    setGriglia(g);
    setRighe(g?.righe ?? 10);
    setPunti([]);
    setCorretta(false);
    setCorreggi(g === null || g.affidabilita < 0.5);
    setFase('griglia');
  };

  const sceltaImmagine = async (file: File) => {
    setErrore(undefined);
    if (!file.type.startsWith('image/')) {
      setErrore('Seleziona un’immagine (PNG o JPEG).');
      return;
    }
    if (file.size > MAX_BYTE_IMMAGINE) {
      setErrore('L’immagine è troppo pesante (massimo 25 MB).');
      return;
    }
    setOccupato('Ricerca della griglia…');
    try {
      const bmp = await createImageBitmap(file);
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      c.getContext('2d')!.drawImage(bmp, 0, 0);
      bmp.close();
      await avviaDaCanvas(c, giorni);
    } catch (e) {
      setErrore(`Impossibile leggere l’immagine: ${messaggioErroreGenerico(e)}`);
    } finally {
      setOccupato(undefined);
      if (campoImmagine.current) campoImmagine.current.value = '';
    }
  };

  /** Solo demo: immagine sintetica con dati inventati e modello addestrato su una parte. */
  const usaProva = async () => {
    setErrore(undefined);
    setOccupato('Preparazione dell’immagine di prova…');
    try {
      const { generaProva, modelloProva } = await import('./sintetico');
      const p = generaProva(mese.anno, mese.mese, giorni);
      const m = modelloProva(p);
      setModelloIniziale(m);
      setModello(m);
      setStatoModello({ tipo: 'ok' });
      await avviaDaCanvas(p.canvas, giorni);
    } catch (e) {
      setErrore(`Prova non riuscita: ${messaggioErroreGenerico(e)}`);
    } finally {
      setOccupato(undefined);
    }
  };

  // --- correzione della griglia ---
  const ricalcola = (p: Punto[], nRighe: number) => {
    if (p.length === 2) {
      const a = { x: Math.min(p[0]!.x, p[1]!.x), y: Math.min(p[0]!.y, p[1]!.y) };
      const b = { x: Math.max(p[0]!.x, p[1]!.x), y: Math.max(p[0]!.y, p[1]!.y) };
      if (b.x - a.x > 10 && b.y - a.y > 10) {
        setGriglia(grigliaDaPunti(a, b, giorni, nRighe));
        setCorretta(true);
      }
    }
  };
  const tocca = (p: Punto) => {
    const nuovi = punti.length >= 2 ? [p] : [...punti, p];
    setPunti(nuovi);
    ricalcola(nuovi, righe);
  };
  const cambiaRighe = (n: number) => {
    const v = Math.min(80, Math.max(1, n));
    setRighe(v);
    if (punti.length === 2) ricalcola(punti, v);
    else if (griglia) setGriglia({ ...griglia, righe: v });
  };

  const rifaiGriglia = async (nuoviGiorni: number) => {
    if (!client.current) return;
    setOccupato('Ricerca della griglia…');
    try {
      const g = await client.current.griglia(nuoviGiorni);
      setGriglia(g);
      setRighe(g?.righe ?? righe);
      setPunti([]);
      setCorretta(false);
      setCorreggi(g === null || g.affidabilita < 0.5);
    } finally {
      setOccupato(undefined);
    }
  };

  const richiestaCorrezione = griglia === null || (griglia.affidabilita < 0.5 && !corretta);
  const grigliaPronta = griglia !== null && !(richiestaCorrezione);

  // --- lettura ---
  const leggi = async () => {
    if (!client.current || !griglia || !modello || !sorgente) return;
    const g: Griglia = { ...griglia, giorni };
    setErrore(undefined);
    setFase('lettura');
    setAvanzamento({ fase: 'Lettura delle celle', fatti: 0, totale: g.righe });
    try {
      const l = await client.current.leggi(g, modello, (fatti, totale) => setAvanzamento({ fase: 'Lettura delle celle', fatti, totale }));
      // Cognomi: se tesseract fallisce si prosegue con l'abbinamento manuale.
      let testi: string[] = l.nomi.map(() => '');
      setAvvisoNomi(undefined);
      try {
        setAvanzamento({ fase: 'Lettura dei cognomi (prima volta: qualche secondo in più)', fatti: 0, totale: l.nomi.length });
        const ritagli = await client.current.nomi(l.nomi.map((n) => n.rect));
        const { leggiCognomi } = await import('./cognomi');
        testi = await leggiCognomi(ritagli, (fatti, totale) => setAvanzamento({ fase: 'Lettura dei cognomi', fatti, totale }));
      } catch (e) {
        setAvvisoNomi(`Lettura automatica dei cognomi non riuscita (${messaggioErroreGenerico(e)}): scegli i medici a mano.`);
      }
      const usati = new Set<string>();
      const scelte = testi.map((t) => {
        // Prima l'intero testo, poi la parola più lunga (un cognome letto con rumore attorno).
        const parole = t.split(' ').sort((a, b) => b.length - a.length);
        let esito = abbinaCognome(t, medici);
        if (esito.tipo === 'nessuno' && parole[0]) esito = abbinaCognome(parole[0], medici);
        const id = esito.tipo === 'nessuno' ? '' : esito.medico.id;
        if (id === '' || usati.has(id)) return '';
        usati.add(id);
        return id;
      });
      setTestiNomi(testi);
      setScelteMedico(scelte);
      setLetto(l);
      setStato({ valori: l.celle.map((c) => c.codice), confermate: l.celle.map(() => false) });
      setFase('revisione');
    } catch (e) {
      setErrore(`Lettura non riuscita: ${messaggioErroreGenerico(e)}`);
      setFase('griglia');
    } finally {
      setAvanzamento(null);
    }
  };

  // --- revisione ---
  const attive = useMemo(() => scelteMedico.map((s) => s !== ''), [scelteMedico]);
  const etichette = useMemo(
    () => (letto?.nomi ?? []).map((n) => medici.find((m) => m.id === scelteMedico[n.riga])?.nome ?? `Riga ${n.riga + 1}`),
    [letto, medici, scelteMedico],
  );
  const doppi = useMemo(() => {
    const visti = new Set<string>();
    const d = new Set<string>();
    for (const s of scelteMedico) {
      if (!s) continue;
      if (visti.has(s)) d.add(s);
      visti.add(s);
    }
    return d;
  }, [scelteMedico]);
  const nIncerte = useMemo(
    () => (letto ? letto.celle.filter((c, i) => c.incerto && !stato.confermate[i] && attive[c.riga]).length : 0),
    [letto, stato.confermate, attive],
  );
  const nAttive = attive.filter(Boolean).length;
  const pronto = nIncerte === 0 && nAttive > 0 && doppi.size === 0;
  const modelloCambiato = modello !== null && modello !== modelloIniziale;

  const procedi = () => {
    if (!letto) return;
    const confermato: FoglioLetto = {
      ...letto,
      celle: letto.celle.map((c, i) => ({ ...c, codice: stato.valori[i] ?? c.codice, incerto: false })),
    };
    const nomi = scelteMedico.map((id) => medici.find((m) => m.id === id)?.nome ?? '');
    const etichetta = `Screenshot ${nomeMese(mese.anno, mese.mese)}`;
    const risultato = aFoglioMese(confermato, { nomi, anno: mese.anno, mese: mese.mese, nomeFoglio: etichetta });
    onPronto({ risultato, etichetta, mese, modello: modelloCambiato ? modello : null });
  };

  const anni = Array.from({ length: 5 }, (_, i) => mese.anno - 2 + i);
  const inElaborazione = occupato !== undefined;

  return (
    <>
      <p className="avviso avviso-warn">
        <Icona nome="attenzione" />
        <span>
          La lettura da immagine può contenere errori: <strong>controlla sempre le celle evidenziate</strong> prima di pubblicare. Usa screenshot nitidi e
          ingranditi (zoom del foglio, senza bordi inutili): più è grande il testo, più la lettura è precisa. L’immagine resta in questo browser.
        </span>
      </p>

      {errore && (
        <p className="avviso avviso-danger" role="alert">
          <Icona nome="attenzione" /> {errore}
        </p>
      )}

      {fase === 'scelta' && (
        <>
          <section className="card import-blocco" aria-labelledby="titolo-mese-shot">
            <div className="card-corpo">
              <h2 id="titolo-mese-shot" className="card-titolo">
                Mese dello screenshot
              </h2>
              <div className="import-mese-da">
                <label className="campo">
                  <span className="etichetta-campo">Mese</span>
                  <select className="select" value={mese.mese} disabled={inElaborazione} onChange={(e) => setMese({ ...mese, mese: Number(e.target.value) })}>
                    {MESI.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m.charAt(0).toUpperCase() + m.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="campo">
                  <span className="etichetta-campo">Anno</span>
                  <select className="select" value={mese.anno} disabled={inElaborazione} onChange={(e) => setMese({ ...mese, anno: Number(e.target.value) })}>
                    {anni.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="nota">{giorni} giorni. Il mese già pubblicato sarà sostituito completamente.</p>
            </div>
          </section>

          {statoModello.tipo === 'caricamento' && <div className="scheletro" style={{ height: 64, marginTop: 14 }} />}

          {statoModello.tipo === 'assente' && (
            <div className="card card-corpo import-scelta">
              <span className="stato-icona stato-icona-info">
                <Icona nome="attenzione" />
              </span>
              <h2>Manca il modello di lettura</h2>
              <p className="testo-tenue">
                {statoModello.motivo ?? 'Nessun modello è ancora stato caricato.'} Scegli il file locale <code>modello-ocr.json</code>: sarà salvato
                e migliorerà a ogni correzione.
              </p>
              <input
                ref={campoModello}
                type="file"
                className="sr-only"
                accept=".json,application/json"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void caricaModelloIniziale(f);
                }}
              />
              <button type="button" className="btn btn-primario" disabled={inElaborazione} onClick={() => campoModello.current?.click()}>
                <Icona nome="carica" /> {inElaborazione ? occupato : 'Carica modello iniziale (.json)'}
              </button>
              {demo && (
                <button type="button" className="btn btn-secondario" disabled={inElaborazione} onClick={() => void usaProva()}>
                  Usa immagine di prova (dati inventati)
                </button>
              )}
            </div>
          )}

          {statoModello.tipo === 'ok' && (
            <div className="card card-corpo import-scelta">
              <span className="stato-icona stato-icona-info">
                <Icona nome="file" />
              </span>
              <h2>Scegli lo screenshot dei turni</h2>
              <p className="testo-tenue">
                Un’immagine del foglio del mese con i medici in riga e i giorni in colonna. Modello di lettura: {modello?.esempi.length ?? 0} esempi.
              </p>
              <input
                ref={campoImmagine}
                type="file"
                className="sr-only"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void sceltaImmagine(f);
                }}
              />
              <button type="button" className="btn btn-primario btn-grande" disabled={inElaborazione} onClick={() => campoImmagine.current?.click()}>
                <Icona nome="carica" /> {inElaborazione ? occupato : 'Scegli immagine'}
              </button>
              {demo && (
                <button type="button" className="btn btn-secondario" disabled={inElaborazione} onClick={() => void usaProva()}>
                  Usa immagine di prova (dati inventati)
                </button>
              )}
            </div>
          )}
        </>
      )}

      {fase === 'griglia' && sorgente && (
        <section className="card import-blocco" aria-labelledby="titolo-griglia">
          <div className="card-corpo">
            <h2 id="titolo-griglia" className="card-titolo">
              Controlla la griglia
            </h2>
            {griglia === null ? (
              <p className="avviso avviso-danger" role="alert">
                <Icona nome="attenzione" /> Griglia non trovata: indicala toccando due punti sull’immagine.
              </p>
            ) : griglia.affidabilita < 0.5 && !corretta ? (
              <p className="avviso avviso-warn" role="alert">
                <Icona nome="attenzione" /> Griglia poco affidabile: la correzione è richiesta. Tocca due punti sull’immagine.
              </p>
            ) : (
              <p className="testo-tenue">
                Le linee blu devono coincidere con le celle: {griglia.righe} righe di medici, {giorni} giorni. Se sono spostate, correggile.
              </p>
            )}
            <ImmagineGriglia sorgente={sorgente} griglia={griglia} punti={correggi ? punti : []} {...(correggi ? { onPunto: tocca } : {})} altezza={380} />
            {correggi && (
              <p className="nota">
                Tocca prima l’<strong>angolo in alto a sinistra</strong> della cella del giorno 1 del primo medico, poi l’
                <strong>angolo in basso a destra</strong> dell’ultima cella (ultimo giorno, ultimo medico). Ripeti per ricominciare.
              </p>
            )}
            <div className="ocr-rapidi">
              <label className="campo ocr-righe">
                <span>Medici (righe)</span>
                <span className="ocr-stepper">
                  <button type="button" className="btn btn-secondario btn-piccolo" onClick={() => cambiaRighe(righe - 1)} aria-label="Meno righe">
                    −
                  </button>
                  <input className="input num" type="number" min={1} max={80} value={righe} onChange={(e) => cambiaRighe(Number(e.target.value) || 1)} />
                  <button type="button" className="btn btn-secondario btn-piccolo" onClick={() => cambiaRighe(righe + 1)} aria-label="Più righe">
                    +
                  </button>
                </span>
              </label>
              <button
                type="button"
                className="btn btn-secondario"
                onClick={() => {
                  setCorreggi((v) => !v);
                  setPunti([]);
                }}
              >
                {correggi ? 'Annulla correzione' : 'Correggi la griglia'}
              </button>
              <button type="button" className="btn btn-fantasma" disabled={inElaborazione} onClick={() => void rifaiGriglia(giorni)}>
                Cerca di nuovo
              </button>
            </div>
            <div className="ocr-rapidi">
              <button
                type="button"
                className="btn btn-fantasma"
                onClick={() => {
                  client.current?.termina();
                  client.current = null;
                  setSorgente(null);
                  setFase('scelta');
                }}
              >
                Cambia immagine
              </button>
              <button type="button" className="btn btn-primario" disabled={!grigliaPronta || inElaborazione} onClick={() => void leggi()}>
                <Icona nome="spunta" /> Conferma e leggi
              </button>
            </div>
          </div>
        </section>
      )}

      {fase === 'lettura' && avanzamento && (
        <div className="card card-corpo import-scelta">
          <h2>{avanzamento.fase}…</h2>
          <div
            className="avanzamento"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={avanzamento.totale}
            aria-valuenow={avanzamento.fatti}
            aria-label="Avanzamento della lettura"
            style={{ width: '100%' }}
          >
            <span className="testo-tenue num">
              {avanzamento.fatti} / {avanzamento.totale}
            </span>
            <div className="avanzamento-barra">
              <div style={{ width: `${Math.round((avanzamento.fatti / Math.max(avanzamento.totale, 1)) * 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      {fase === 'revisione' && letto && sorgente && (
        <>
          <section className="card import-blocco" aria-labelledby="titolo-righe-medici">
            <div className="card-corpo">
              <h2 id="titolo-righe-medici" className="card-titolo">
                Righe e medici
              </h2>
              <p className="testo-tenue">
                Verifica a quale medico corrisponde ogni riga. Le righe lasciate vuote sono ignorate.
                {nAttive > 0 && <> {nAttive} su {letto.nomi.length} assegnate.</>}
              </p>
              {avvisoNomi && (
                <p className="avviso avviso-warn">
                  <Icona nome="attenzione" /> {avvisoNomi}
                </p>
              )}
              <ul className="elenco-righe" role="list">
                {letto.nomi.map((n) => {
                  const scelto = scelteMedico[n.riga] ?? '';
                  const usatiAltrove = new Set(scelteMedico.filter((s, i) => s && i !== n.riga));
                  return (
                    <li key={n.riga} className="riga-elenco ocr-riga-nome">
                      <Ritaglio sorgente={sorgente} rect={n.rect} larghezza={150} />
                      <div className="ocr-riga-nome-scelta">
                        <span className="nota">
                          Riga {n.riga + 1}
                          {testiNomi[n.riga] ? ` · letto “${testiNomi[n.riga]}”` : ''}
                        </span>
                        <select
                          className="select"
                          aria-label={`Medico della riga ${n.riga + 1}`}
                          value={scelto}
                          onChange={(e) => setScelteMedico((v) => v.map((x, i) => (i === n.riga ? e.target.value : x)))}
                        >
                          <option value="">— ignora la riga —</option>
                          {medici.map((m) => (
                            <option key={m.id} value={m.id} disabled={usatiAltrove.has(m.id)}>
                              {m.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          <RevisioneCelle
            sorgente={sorgente}
            letto={letto}
            etichette={etichette}
            attive={attive}
            stato={stato}
            onStato={setStato}
            modello={modello!}
            onModello={setModello}
          />

          <div className={pronto ? 'barra-pubblica' : 'barra-pubblica barra-ferma'}>
            <div>
              {nIncerte > 0 ? (
                <span className="testo-pericolo">
                  <Icona nome="attenzione" piccola /> {nIncerte} {nIncerte === 1 ? 'cella da controllare' : 'celle da controllare'}
                </span>
              ) : nAttive === 0 ? (
                <span className="testo-pericolo">Assegna almeno una riga a un medico</span>
              ) : (
                <span className="testo-tenue">Celle controllate: puoi vedere l’anteprima.</span>
              )}
            </div>
            <button type="button" className="btn btn-primario" disabled={!pronto} onClick={procedi}>
              <Icona nome="spunta" /> Vai all’anteprima
            </button>
          </div>
        </>
      )}
    </>
  );
}
