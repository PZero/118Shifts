// Caricamento dell'Excel dei turni: lettura nel browser, anteprima per mese e medico,
// avvisi di import, abbinamento dei nomi all'anagrafica e pubblicazione su Firestore.
// Il file non lascia mai il dispositivo: si pubblicano solo i codici normalizzati.

import { useMemo, useRef, useState } from 'react';
import { abbinaNome, conAlias, normalizzaNome, pulisciNome, type EsitoAbbinamento } from '../../domain/anagrafica';
import { chiaveMese, dataISO, giorniNelMese, giornoSettimana } from '../../domain/date';
import type { AvvisoImport, CategoriaAvviso, FoglioMese, RisultatoImport } from '../../domain/excel';
import { useProfilo, useServizi } from '../../sessione/contesto';
import { SEDI_PREDEFINITE, type AvvisoSalvato, type MedicoAnagrafica, type PianoImport } from '../../servizi/tipi';
import { Dialogo } from '../../ui/Dialogo';
import { messaggioErroreGenerico } from '../../ui/errori';
import { etichettaCodice, nomeMese } from '../../ui/etichette';
import { Icona } from '../../ui/Icona';

const MAX_BYTE = 15 * 1024 * 1024;

const TITOLO_CATEGORIA: Record<CategoriaAvviso, string> = {
  codici: 'Codici da controllare',
  'senza-nome': 'Righe senza nome',
  'mese-precedente': 'Incoerenze con il mese precedente',
  anagrafica: 'Nomi da abbinare',
  formato: 'Formato del file',
};
const ORDINE_CATEGORIE: CategoriaAvviso[] = ['codici', 'anagrafica', 'senza-nome', 'mese-precedente', 'formato'];

type Scelta = { tipo: 'auto' | 'abbina'; medicoId: string } | { tipo: 'nuovo' } | { tipo: 'ignora' };

interface NomeFile {
  chiave: string;
  nome: string;
  fogli: string[];
  esito: EsitoAbbinamento;
}

interface Letto {
  nomeFile: string;
  risultato: RisultatoImport;
  anagrafica: MedicoAnagrafica[];
  nomi: NomeFile[];
  avvisi: AvvisoImport[];
  gruppi: Record<CategoriaAvviso, AvvisoImport[]>;
}

type Fase = { fase: 'vuoto' } | { fase: 'lettura' } | { fase: 'pronto'; letto: Letto } | { fase: 'fatto'; mesi: string[]; avvisi: number };

function sceltaIniziale(e: EsitoAbbinamento): Scelta | undefined {
  if (e.tipo === 'nome' || e.tipo === 'alias') return { tipo: 'auto', medicoId: e.medico.id };
  // Senza somiglianze si propone un nuovo medico; con suggerimenti o ambiguità serve una scelta esplicita.
  if (e.tipo === 'nessuno' && e.suggerimenti.length === 0) return { tipo: 'nuovo' };
  return undefined;
}

function costruisciPiano(letto: Letto, scelte: Record<string, Scelta | undefined>) {
  const nuovi = new Map<string, { rif: string; nome: string }>();
  const alias = new Map<string, { medicoId: string; alias: string }>();
  const turni = new Map<string, { medico: string; chiave: string; giorni: Record<string, string[]> }>();
  const conflitti: string[] = [];
  const mesi: string[] = [];
  let daRisolvere = 0;

  for (const n of letto.nomi) {
    const s = scelte[n.chiave];
    if (!s) daRisolvere++;
    else if (s.tipo === 'nuovo') nuovi.set(n.chiave, { rif: `nuovo:${n.chiave}`, nome: n.nome });
    else if (s.tipo === 'abbina') {
      const m = letto.anagrafica.find((x) => x.id === s.medicoId);
      if (m && conAlias(m, n.nome) !== m) alias.set(`${m.id}|${n.chiave}`, { medicoId: m.id, alias: n.nome });
    }
  }

  for (const f of letto.risultato.mesi) {
    const k = chiaveMese(f);
    mesi.push(k);
    for (const m of f.medici) {
      const chiave = normalizzaNome(m.nome);
      const s = scelte[chiave];
      if (!s || s.tipo === 'ignora') continue;
      const bersaglio = s.tipo === 'nuovo' ? `nuovo:${chiave}` : s.medicoId;
      const id = `${bersaglio}|${k}`;
      if (turni.has(id)) {
        conflitti.push(`${nomeMese(f.anno, f.mese)}: "${m.nome}" è associato a un medico che ha già una riga in questo mese.`);
        continue;
      }
      turni.set(id, { medico: bersaglio, chiave: k, giorni: m.giorni });
    }
  }

  const avvisi: AvvisoSalvato[] = letto.avvisi.map((a) => {
    const v: AvvisoSalvato = { tipo: a.tipo, foglio: a.foglio, messaggio: a.messaggio.slice(0, 300) };
    if (a.cella) v.cella = a.cella;
    return v;
  });
  const piano: PianoImport = { nuoviMedici: [...nuovi.values()], alias: [...alias.values()], turni: [...turni.values()], mesi, avvisi };
  return { piano, daRisolvere, conflitti };
}

export function Import() {
  const servizi = useServizi();
  const profilo = useProfilo();
  const campoFile = useRef<HTMLInputElement>(null);
  const [fase, setFase] = useState<Fase>({ fase: 'vuoto' });
  const [errore, setErrore] = useState<string>();
  const [scelte, setScelte] = useState<Record<string, Scelta | undefined>>({});
  const [conferma, setConferma] = useState(false);
  const [avanzamento, setAvanzamento] = useState<{ fatto: number; totale: number } | null>(null);

  const letto = fase.fase === 'pronto' ? fase.letto : null;
  const calcolo = useMemo(() => (letto ? costruisciPiano(letto, scelte) : null), [letto, scelte]);

  const leggi = async (file: File) => {
    setErrore(undefined);
    if (!/\.xlsx$/i.test(file.name)) {
      setErrore('Seleziona un file Excel con estensione .xlsx.');
      return;
    }
    if (file.size > MAX_BYTE) {
      setErrore('Il file è troppo grande (massimo 15 MB).');
      return;
    }
    setFase({ fase: 'lettura' });
    try {
      // Il parser (e la libreria xlsx) si caricano solo quando serve.
      const [excel, anagrafica, buffer] = await Promise.all([import('../../domain/excel'), servizi.medici(), file.arrayBuffer()]);
      const risultato = excel.leggiExcel(buffer);
      if (risultato.mesi.length === 0) {
        setErrore('Nel file non è stato trovato nessun foglio-mese riconoscibile (es. "OTTOBRE 26").');
        setFase({ fase: 'vuoto' });
        return;
      }
      const avvisi = [...risultato.avvisi, ...excel.avvisiAbbinamento(risultato, anagrafica)];
      const nomi = new Map<string, NomeFile>();
      for (const f of risultato.mesi) {
        for (const m of f.medici) {
          const chiave = normalizzaNome(m.nome);
          const gia = nomi.get(chiave);
          if (gia) gia.fogli.push(f.foglio);
          else nomi.set(chiave, { chiave, nome: m.nome, fogli: [f.foglio], esito: abbinaNome(m.nome, anagrafica) });
        }
      }
      const elenco = [...nomi.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
      setScelte(Object.fromEntries(elenco.map((n) => [n.chiave, sceltaIniziale(n.esito)])));
      setFase({
        fase: 'pronto',
        letto: { nomeFile: file.name, risultato, anagrafica, nomi: elenco, avvisi, gruppi: excel.raggruppaAvvisi(avvisi) },
      });
    } catch (e) {
      setErrore(`Impossibile leggere il file: ${messaggioErroreGenerico(e)}`);
      setFase({ fase: 'vuoto' });
    }
  };

  const reset = () => {
    setFase({ fase: 'vuoto' });
    setScelte({});
    setErrore(undefined);
    setAvanzamento(null);
    if (campoFile.current) campoFile.current.value = '';
  };

  const pubblica = async () => {
    if (!calcolo) return;
    setConferma(false);
    setErrore(undefined);
    setAvanzamento({ fatto: 0, totale: 1 });
    try {
      await servizi.pubblicaImport(calcolo.piano, profilo.uid, (fatto, totale) => setAvanzamento({ fatto, totale }));
      setFase({ fase: 'fatto', mesi: calcolo.piano.mesi, avvisi: calcolo.piano.avvisi.length });
    } catch (e) {
      setErrore(`Pubblicazione non riuscita: ${messaggioErroreGenerico(e)}`);
    } finally {
      setAvanzamento(null);
    }
  };

  const pubblicando = avanzamento !== null;

  return (
    <section aria-labelledby="titolo-import">
      <div className="intestazione-sezione">
        <div>
          <h1 id="titolo-import">Carica Excel</h1>
          <p className="testo-tenue">Il file viene letto in questo browser: prima della pubblicazione vedi un’anteprima e gli eventuali avvisi.</p>
        </div>
      </div>

      {errore && (
        <p className="avviso avviso-danger" role="alert">
          <Icona nome="attenzione" /> {errore}
        </p>
      )}

      {(fase.fase === 'vuoto' || fase.fase === 'lettura') && (
        <div className="card card-corpo import-scelta">
          <span className="stato-icona stato-icona-info">
            <Icona nome="file" />
          </span>
          <h2>Scegli il file dei turni</h2>
          <p className="testo-tenue">Un file .xlsx con un foglio per mese (es. “OTTOBRE 26”). I mesi già presenti saranno sostituiti.</p>
          <input
            ref={campoFile}
            id="file-excel"
            type="file"
            className="sr-only"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void leggi(f);
            }}
          />
          <button type="button" className="btn btn-primario btn-grande" disabled={fase.fase === 'lettura'} onClick={() => campoFile.current?.click()}>
            <Icona nome="carica" /> {fase.fase === 'lettura' ? 'Lettura in corso…' : 'Scegli file .xlsx'}
          </button>
        </div>
      )}

      {fase.fase === 'fatto' && (
        <div className="card card-corpo import-scelta">
          <span className="stato-icona stato-icona-ok">
            <Icona nome="spunta" />
          </span>
          <h2>Turni pubblicati</h2>
          <p>
            Mesi caricati: <strong>{fase.mesi.map((m) => nomeMeseDaChiave(m)).join(', ')}</strong>
            {fase.avvisi > 0 ? ` · ${fase.avvisi} avvisi registrati nell’importazione.` : '.'}
          </p>
          <button type="button" className="btn btn-secondario" onClick={reset}>
            Carica un altro file
          </button>
        </div>
      )}

      {letto && calcolo && (
        <>
          <div className="card card-corpo import-riepilogo">
            <div className="import-file">
              <Icona nome="file" />
              <strong>{letto.nomeFile}</strong>
              <button type="button" className="btn btn-fantasma btn-piccolo" onClick={reset} disabled={pubblicando}>
                Cambia file
              </button>
            </div>
            <dl className="import-numeri num">
              <div>
                <dt>Mesi</dt>
                <dd>{letto.risultato.mesi.length}</dd>
              </div>
              <div>
                <dt>Medici nel file</dt>
                <dd>{letto.nomi.length}</dd>
              </div>
              <div>
                <dt>Nuovi medici</dt>
                <dd>{calcolo.piano.nuoviMedici.length}</dd>
              </div>
              <div>
                <dt>Avvisi</dt>
                <dd>{letto.avvisi.length}</dd>
              </div>
            </dl>
          </div>

          <Abbinamenti letto={letto} scelte={scelte} onScelta={(chiave, s) => setScelte((v) => ({ ...v, [chiave]: s }))} />
          <AvvisiImport gruppi={letto.gruppi} />
          <AnteprimaMesi mesi={letto.risultato.mesi} scelte={scelte} anagrafica={letto.anagrafica} />

          {calcolo.conflitti.length > 0 && (
            <div className="avviso avviso-danger" role="alert">
              <Icona nome="attenzione" />
              <div>
                <strong>Abbinamenti in conflitto</strong>
                <ul className="elenco-semplice">
                  {calcolo.conflitti.slice(0, 5).map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="barra-pubblica">
            <div>
              {calcolo.daRisolvere > 0 ? (
                <span className="testo-pericolo">
                  <Icona nome="attenzione" piccola /> {calcolo.daRisolvere} {calcolo.daRisolvere === 1 ? 'nome da abbinare' : 'nomi da abbinare'}
                </span>
              ) : (
                <span className="testo-tenue">
                  {calcolo.piano.turni.length} {calcolo.piano.turni.length === 1 ? 'riga' : 'righe'} medico-mese da pubblicare
                </span>
              )}
              {pubblicando && <span className="testo-tenue"> · scrittura in corso…</span>}
            </div>
            <button
              type="button"
              className="btn btn-primario"
              disabled={pubblicando || calcolo.daRisolvere > 0 || calcolo.conflitti.length > 0 || calcolo.piano.turni.length === 0}
              onClick={() => setConferma(true)}
            >
              <Icona nome="carica" /> {pubblicando ? 'Pubblicazione…' : 'Pubblica'}
            </button>
          </div>

          <Dialogo
            aperto={conferma}
            titolo="Pubblicare i turni?"
            onChiudi={() => setConferma(false)}
            descrizione={`Saranno scritti ${calcolo.piano.mesi.length} mesi per ${calcolo.piano.turni.length} righe medico-mese. I mesi già pubblicati degli stessi medici verranno sostituiti.`}
            piede={
              <>
                <button type="button" className="btn btn-secondario" onClick={() => setConferma(false)}>
                  Annulla
                </button>
                <button type="button" className="btn btn-primario" onClick={() => void pubblica()}>
                  Pubblica
                </button>
              </>
            }
          >
            <ul className="elenco-semplice">
              <li>{calcolo.piano.nuoviMedici.length} nuovi medici in anagrafica</li>
              <li>{calcolo.piano.alias.length} nuovi alias</li>
              <li>{letto.avvisi.length} avvisi saranno registrati con l’importazione</li>
            </ul>
          </Dialogo>
        </>
      )}
    </section>
  );
}

function nomeMeseDaChiave(k: string): string {
  const [a, m] = k.split('-').map(Number);
  return a && m ? nomeMese(a, m) : k;
}

function Abbinamenti({ letto, scelte, onScelta }: { letto: Letto; scelte: Record<string, Scelta | undefined>; onScelta: (chiave: string, s: Scelta | undefined) => void }) {
  const daSistemare = letto.nomi.filter((n) => n.esito.tipo === 'ambiguo' || n.esito.tipo === 'nessuno');
  const automatici = letto.nomi.length - daSistemare.length;
  const valore = (s: Scelta | undefined) => (!s ? '' : s.tipo === 'nuovo' ? '__nuovo' : s.tipo === 'ignora' ? '__ignora' : s.medicoId);

  return (
    <section className="card import-blocco" aria-labelledby="titolo-abbinamenti">
      <div className="card-corpo">
        <h2 id="titolo-abbinamenti" className="card-titolo">
          Nomi e anagrafica
        </h2>
        <p className="testo-tenue">
          {automatici} {automatici === 1 ? 'nome abbinato' : 'nomi abbinati'} automaticamente
          {daSistemare.length > 0 ? `; ${daSistemare.length} da verificare.` : '.'}
        </p>
        {daSistemare.length > 0 && (
          <ul className="elenco-righe" role="list">
            {daSistemare.map((n) => {
              const suggeriti = n.esito.tipo === 'ambiguo' ? n.esito.candidati : n.esito.tipo === 'nessuno' ? n.esito.suggerimenti : [];
              const idSuggeriti = new Set(suggeriti.map((m) => m.id));
              const altri = letto.anagrafica.filter((m) => !idSuggeriti.has(m.id));
              const s = scelte[n.chiave];
              return (
                <li key={n.chiave} className="riga-elenco riga-abbina">
                  <div className="riga-elenco-principale">
                    <div className="riga-elenco-nome">
                      <strong>{n.nome}</strong>
                      <span className={`etichetta ${n.esito.tipo === 'ambiguo' ? 'etichetta-danger' : 'etichetta-warn'}`}>
                        {n.esito.tipo === 'ambiguo' ? 'Ambiguo' : suggeriti.length ? 'Simile a un medico' : 'Non in anagrafica'}
                      </span>
                      {s?.tipo === 'nuovo' && <span className="etichetta etichetta-info">Nuovo medico</span>}
                    </div>
                    <span className="nota">Fogli: {n.fogli.join(', ')}</span>
                  </div>
                  <label className="campo">
                    <span className="sr-only">Abbinamento per {n.nome}</span>
                    <select
                      className="select"
                      value={valore(s)}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '') onScelta(n.chiave, undefined);
                        else if (v === '__nuovo') onScelta(n.chiave, { tipo: 'nuovo' });
                        else if (v === '__ignora') onScelta(n.chiave, { tipo: 'ignora' });
                        else onScelta(n.chiave, { tipo: 'abbina', medicoId: v });
                      }}
                    >
                      <option value="">Scegli…</option>
                      {n.esito.tipo !== 'ambiguo' && <option value="__nuovo">Crea nuovo medico “{n.nome}”</option>}
                      <option value="__ignora">Ignora questo nome</option>
                      {suggeriti.length > 0 && (
                        <optgroup label="Suggeriti (diventa alias)">
                          {suggeriti.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.nome}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {n.esito.tipo !== 'ambiguo' && altri.length > 0 && (
                        <optgroup label="Altri medici (diventa alias)">
                          {altri.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.nome}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function AvvisiImport({ gruppi }: { gruppi: Record<CategoriaAvviso, AvvisoImport[]> }) {
  const presenti = ORDINE_CATEGORIE.filter((c) => gruppi[c].length > 0);
  if (presenti.length === 0) {
    return (
      <p className="avviso avviso-ok">
        <Icona nome="spunta" /> Nessun avviso: il file è stato letto senza anomalie.
      </p>
    );
  }
  return (
    <section className="card import-blocco" aria-labelledby="titolo-avvisi">
      <div className="card-corpo">
        <h2 id="titolo-avvisi" className="card-titolo">
          Avvisi di import
        </h2>
        <div className="import-gruppi">
          {presenti.map((c) => (
            <details key={c} className="import-gruppo" open={c === 'codici'}>
              <summary>
                <span>{TITOLO_CATEGORIA[c]}</span>
                <span className={`etichetta ${c === 'codici' || c === 'senza-nome' ? 'etichetta-warn' : ''}`}>{gruppi[c].length}</span>
              </summary>
              <ul className="elenco-semplice">
                {gruppi[c].slice(0, 60).map((a, i) => (
                  <li key={i}>
                    <span className="testo-tenue num">
                      {a.foglio}
                      {a.cella ? ` · ${a.cella}` : ''}
                    </span>
                    <br />
                    {a.messaggio}
                  </li>
                ))}
                {gruppi[c].length > 60 && <li className="testo-tenue">… e altri {gruppi[c].length - 60}.</li>}
              </ul>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function AnteprimaMesi({ mesi, scelte, anagrafica }: { mesi: FoglioMese[]; scelte: Record<string, Scelta | undefined>; anagrafica: MedicoAnagrafica[] }) {
  const [indice, setIndice] = useState(0);
  const [aperto, setAperto] = useState<number | null>(null);
  const foglio = mesi[Math.min(indice, mesi.length - 1)]!;
  const n = giorniNelMese(foglio.anno, foglio.mese);

  const descrizione = (nome: string): { testo: string; tono: string } => {
    const s = scelte[normalizzaNome(nome)];
    if (!s) return { testo: 'Da abbinare', tono: 'etichetta-warn' };
    if (s.tipo === 'nuovo') return { testo: 'Nuovo medico', tono: 'etichetta-info' };
    if (s.tipo === 'ignora') return { testo: 'Ignorato', tono: '' };
    const m = anagrafica.find((x) => x.id === s.medicoId);
    return { testo: m && normalizzaNome(m.nome) !== normalizzaNome(nome) ? `→ ${m.nome}` : 'In anagrafica', tono: 'etichetta-ok' };
  };

  return (
    <section className="card import-blocco" aria-labelledby="titolo-anteprima">
      <div className="card-corpo">
        <h2 id="titolo-anteprima" className="card-titolo">
          Anteprima
        </h2>
        <div className="segmenti segmenti-scorrevoli" role="group" aria-label="Mese">
          {mesi.map((f, i) => (
            <button
              key={f.foglio}
              type="button"
              aria-pressed={i === indice}
              onClick={() => {
                setIndice(i);
                setAperto(null);
              }}
            >
              {nomeMese(f.anno, f.mese)}
            </button>
          ))}
        </div>
        <p className="nota">
          {foglio.medici.length} medici · foglio “{foglio.foglio}” · {foglio.giorniTrovati}/{n} giorni trovati
        </p>
        <ul className="elenco-righe" role="list">
          {foglio.medici.map((m, i) => {
            const d = descrizione(m.nome);
            const lavorati = Object.keys(m.giorni).length;
            const idGriglia = `imp-${indice}-${i}`;
            return (
              <li key={`${m.riga}-${m.nome}`} className="riga-elenco riga-anteprima">
                <button type="button" className="riga-anteprima-testa" aria-expanded={aperto === i} aria-controls={idGriglia} onClick={() => setAperto(aperto === i ? null : i)}>
                  <strong>{pulisciNome(m.nome)}</strong>
                  <span className={`etichetta ${d.tono}`}>{d.testo}</span>
                  <span className="testo-tenue num">{lavorati} gg</span>
                  <Icona nome="giu" piccola />
                </button>
                {aperto === i && (
                  <div id={idGriglia} className="imp-giorni" role="group" aria-label={`Giorni di ${m.nome}`}>
                    {Array.from({ length: n }, (_, k) => k + 1).map((g) => {
                      const dow = giornoSettimana(dataISO(foglio.anno, foglio.mese, g));
                      const codici = m.giorni[String(g)] ?? [];
                      return (
                        <div key={g} className={`imp-giorno ${dow === 6 ? 'sabato' : ''} ${dow === 0 ? 'festivo' : ''}`}>
                          <span className="cal-num num">{g}</span>
                          {codici.map((c, j) => {
                            const e = etichettaCodice(c, SEDI_PREDEFINITE);
                            return (
                              <span key={j} className={`chip chip-${e.tono}`} title={e.lunga}>
                                <b>{e.breve}</b>
                              </span>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
