import { conta } from '../../servizi/statistiche';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useParams } from 'wouter';
import { meseAccettaIndisponibilita } from '../../domain/indisponibilita-mesi';
import { aggiungiMesi, chiaveMese, confrontaMesi, scomponi, type AnnoMese } from '../../domain/date';
import { uguali, type GiorniIndisponibili } from '../../domain/indisponibilita';
import { proiezioneMedico } from '../../domain/proiezione';
import { isStaff, useProfilo, useServizi } from '../../sessione/contesto';
import { sincronizzaSiri } from '../../servizi/siri';
import type { CambioDoc, CicloMedico, MeseDoc, NuovoCambio, Sedi, VoceElenco } from '../../servizi/tipi';
import { messaggioErroreGenerico } from '../../ui/errori';
import { useMedia } from '../../ui/media';
import { Dialogo } from '../../ui/Dialogo';
import { Icona } from '../../ui/Icona';
import { dataEstesa, dataNumerica, nomeMese } from '../../ui/etichette';
import { Calendario } from './Calendario';
import { CardIndisponibilita, DialogoIndisponibilita } from './Indisponibilita';
import { costruisciSegni, leggiPreferenzaMostra, salvaPreferenzaMostra, type IndispPerMese } from './indisponibilitaVista';
import { CardSiri } from './CardSiri';
import { caricaQuadro } from './quadriCache';
import { CardChiConMe, CardCollega, CardOggiDomani } from './CardOggiDomani';
import { DettaglioGiorno } from './DettaglioGiorno';
import { DialogoCambio, type RichiestaCambio } from './DialoghiCambio';
import { CardCambi, CardOre, CardReperibilita, CardWeekend, Legenda } from './Riepiloghi';
import { condividiFile, creaFileCalendario } from './immagineCalendario';
import { costruisciMese, limitiNavigazione, meseDaChiave, oggiISO } from './vista';

interface Dati {
  mesi: MeseDoc[];
  cambi: CambioDoc[];
  elenco: VoceElenco[];
  sedi: Sedi;
  ciclo: CicloMedico | null;
}

type Caricamento = { stato: 'caricamento' } | { stato: 'errore'; messaggio: string } | { stato: 'pronto'; dati: Dati };

export function AreaMedico() {
  const profilo = useProfilo();
  return <CalendarioMedico medicoId={profilo.medicoId!} principale={profilo.principale} base="/turni" />;
}

interface ProprietaCalendario {
  medicoId: string;
  principale: boolean;
  /** Percorso base per la navigazione dei mesi (senza barra finale). */
  base: string;
  /** Vista dello staff: niente cambi turno (privati del medico), nessuna modifica. */
  soloLettura?: boolean;
  /** Intestazione opzionale sopra il calendario (titolo e link di ritorno). */
  intestazione?: ReactNode;
}

/** Calendario mensile di un medico: usato dal medico stesso e, in sola lettura, dallo staff. */
export function CalendarioMedico({ medicoId, principale, base, soloLettura = false, intestazione }: ProprietaCalendario) {
  const servizi = useServizi();
  const [car, setCar] = useState<Caricamento>({ stato: 'caricamento' });
  const [versione, setVersione] = useState(0);

  useEffect(() => {
    let attivo = true;
    Promise.all([
      servizi.turniMedico(medicoId),
      soloLettura ? Promise.resolve([] as CambioDoc[]) : servizi.cambiMedico(medicoId),
      soloLettura ? servizi.medici().then((l) => l.map((m) => ({ id: m.id, nome: m.nome }))) : servizi.elencoMedici(),
      servizi.sedi(),
      servizi.cicloMedico(medicoId),
    ])
      .then(([mesi, cambi, elenco, sedi, ciclo]) => attivo && setCar({ stato: 'pronto', dati: { mesi, cambi, elenco, sedi, ciclo } }))
      .catch((e) => attivo && setCar({ stato: 'errore', messaggio: messaggioErroreGenerico(e) }));
    return () => {
      attivo = false;
    };
  }, [servizi, medicoId, soloLettura, versione]);

  const ricaricaCambi = useCallback(async () => {
    const cambi = await servizi.cambiMedico(medicoId);
    setCar((c) => (c.stato === 'pronto' ? { stato: 'pronto', dati: { ...c.dati, cambi } } : c));
  }, [servizi, medicoId]);

  if (car.stato === 'caricamento') return <ScheletroCalendario />;
  if (car.stato === 'errore') {
    return (
      <div className="pagina">
        {intestazione}
        <div className="avviso avviso-danger" role="alert">
          <Icona nome="attenzione" />
          <div>
            <strong>Impossibile caricare i turni.</strong>
            <p>{car.messaggio}</p>
            <button type="button" className="btn btn-secondario btn-piccolo" style={{ marginTop: 10 }} onClick={() => setVersione((v) => v + 1)}>
              Riprova
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <VistaMedico
      dati={car.dati}
      medicoId={medicoId}
      principale={principale}
      base={base}
      soloLettura={soloLettura}
      intestazione={intestazione}
      onCambiModificati={ricaricaCambi}
    />
  );
}

function VistaMedico({
  dati,
  medicoId,
  principale,
  base,
  soloLettura,
  intestazione,
  onCambiModificati,
}: {
  dati: Dati;
  medicoId: string;
  principale: boolean;
  base: string;
  soloLettura: boolean;
  intestazione?: ReactNode;
  onCambiModificati: () => Promise<void>;
}) {
  const servizi = useServizi();
  const profilo = useProfilo();
  // Le card basate sul quadro (tutti i medici) sono per gli account principali e per lo staff, anche se secondario.
  const vedeQuadro = principale || isStaff(profilo);
  const params = useParams<{ mese?: string }>();
  const [, naviga] = useLocation();
  const oggi = oggiISO();
  const meseOggi = useMemo<AnnoMese>(() => {
    const { anno, mese } = scomponi(oggi);
    return { anno, mese };
  }, [oggi]);
  const corrente = meseDaChiave(params.mese) ?? meseOggi;

  const proiezione = useMemo(
    () =>
      proiezioneMedico({
        mesi: dati.mesi.map((m) => ({ anno: m.anno, mese: m.mese, giorni: m.giorni })),
        cicloInizio: dati.ciclo?.cicloInizio,
        cicloManuale: dati.ciclo?.cicloManuale,
      }),
    [dati.mesi, dati.ciclo],
  );
  const limiti = useMemo(() => limitiNavigazione(dati.mesi, proiezione, meseOggi), [dati.mesi, proiezione, meseOggi]);
  const vista = useMemo(() => costruisciMese(corrente, dati.mesi, dati.cambi, proiezione, oggi), [corrente, dati, proiezione, oggi]);
  const meseDoc = dati.mesi.find((m) => m.chiave === vista.chiave);
  const nomi = useMemo(() => new Map(dati.elenco.map((m) => [m.id, m.nome])), [dati.elenco]);
  const colleghi = useMemo(() => dati.elenco.filter((m) => m.id !== medicoId), [dati.elenco, medicoId]);

  // Siri: frasi aggiornate all'apertura e dopo ogni cambio, solo se cambiate (errori ignorati).
  useEffect(() => {
    if (soloLettura) return;
    void sincronizzaSiri(servizi, {
      medicoId,
      mesi: dati.mesi,
      cambi: dati.cambi,
      elenco: dati.elenco,
      sedi: dati.sedi,
      oggi,
      caricaQuadro: (k) => caricaQuadro(servizi, k),
    }).catch(() => undefined);
  }, [servizi, medicoId, soloLettura, dati.mesi, dati.cambi, dati.elenco, dati.sedi, oggi]);

  // Indisponibilità: solo account principale, mai nella vista dello staff.
  const gestisceIndisp = principale && !soloLettura;
  const [indisp, setIndisp] = useState<IndispPerMese>({});
  const salvate = useRef<IndispPerMese>({});
  const [mostraIndisp, setMostraIndisp] = useState(leggiPreferenzaMostra);
  const [modificaIndisp, setModificaIndisp] = useState(false);
  const [giornoIndisp, setGiornoIndisp] = useState<string | null>(null);
  const [erroreIndisp, setErroreIndisp] = useState<string | null>(null);
  useEffect(() => {
    if (!gestisceIndisp) return;
    let attivo = true;
    servizi
      .indisponibilita(medicoId)
      .then((r) => {
        if (!attivo) return;
        salvate.current = r;
        setIndisp(r);
      })
      .catch(() => undefined);
    return () => {
      attivo = false;
    };
  }, [servizi, medicoId, gestisceIndisp]);
  // I mesi del medico sono già caricati a questo punto: "non pubblicato" = assente da dati.mesi.
  const indispModificabile =
    gestisceIndisp &&
    meseAccettaIndisponibilita(
      corrente,
      meseOggi,
      dati.mesi.map((m) => m.chiave),
    );
  const inModifica = indispModificabile && modificaIndisp;
  const segni = useMemo(() => (gestisceIndisp && mostraIndisp ? costruisciSegni(indisp, dati.mesi) : undefined), [gestisceIndisp, mostraIndisp, indisp, dati.mesi]);
  const giorniIndispMese: GiorniIndisponibili = indisp[vista.chiave] ?? {};
  const ufficialiMese = meseDoc?.giorni ?? {};
  const salvaIndispMese = async () => {
    const k = vista.chiave;
    const nuovi = indisp[k] ?? {};
    if (uguali(nuovi, salvate.current[k] ?? {})) return;
    try {
      await servizi.salvaIndisponibilita(medicoId, k, nuovi);
      conta('salvaIndisponibilita');
      salvate.current = { ...salvate.current, [k]: nuovi };
      setErroreIndisp(null);
    } catch (e) {
      setErroreIndisp(`Indisponibilità non salvate. ${messaggioErroreGenerico(e)}`);
    }
  };
  const cambiaIndispMese = (nuovi: GiorniIndisponibili) => {
    const k = vista.chiave;
    setIndisp((r) => {
      const { [k]: _v, ...resto } = r;
      return Object.keys(nuovi).length > 0 ? { ...resto, [k]: nuovi } : resto;
    });
  };
  const chiudiIndisp = () => {
    setGiornoIndisp(null);
    void salvaIndispMese();
  };

  const desktop = useMedia('(min-width: 1024px)');
  const [selezionato, setSelezionato] = useState<string | null>(null);
  const [richiesta, setRichiesta] = useState<RichiestaCambio | null>(null);
  const [daAnnullare, setDaAnnullare] = useState<CambioDoc | null>(null);
  const [annullo, setAnnullo] = useState(false);

  // Giorno selezionato: oggi se nel mese, altrimenti il primo; si riallinea al cambio di mese.
  const giornoSel =
    vista.giorni.find((g) => g.data === selezionato) ?? vista.giorni.find((g) => g.oggi) ?? vista.giorni[0]!;

  // Per la card colleghi: giorno selezionato esplicitamente; senza selezione (avvio, cambio mese) è oggi.
  const selEsplicito = selezionato ? vista.giorni.find((g) => g.data === selezionato) : undefined;
  const vistaOggi = useMemo(
    () => (selEsplicito ? null : costruisciMese(meseOggi, dati.mesi, dati.cambi, proiezione, oggi, false)),
    [selEsplicito, meseOggi, dati.mesi, dati.cambi, proiezione, oggi],
  );
  const giornoCard = selEsplicito ?? vistaOggi!.giorni[scomponi(oggi).giorno - 1]!;
  const pubblicatoCard = selEsplicito ? vista.tipo === 'reale' : vistaOggi!.tipo === 'reale';

  const vaiA = (am: AnnoMese) => {
    conta('cambioMese');
    setSelezionato(null);
    naviga(`${base}/${chiaveMese(am)}`);
  };
  // Tocco su un giorno dei mesi adiacenti: si passa a quel mese con il giorno selezionato.
  const seleziona = (data: string) => {
    if (inModifica) {
      const { anno, mese } = scomponi(data);
      if (anno === corrente.anno && mese === corrente.mese) {
        setSelezionato(data);
        setGiornoIndisp(data);
      }
      return;
    }
    conta('dettaglioGiorno');
    const { anno, mese } = scomponi(data);
    if (anno === corrente.anno && mese === corrente.mese) return setSelezionato(data);
    const am = { anno, mese };
    if (confrontaMesi(am, limiti.primo) < 0 || confrontaMesi(am, limiti.ultimo) > 0) return;
    setSelezionato(data);
    naviga(`${base}/${chiaveMese(am)}`);
  };
  const prec = aggiungiMesi(corrente, -1);
  const succ = aggiungiMesi(corrente, 1);
  const puoPrec = confrontaMesi(prec, limiti.primo) >= 0;
  const puoSucc = confrontaMesi(succ, limiti.ultimo) <= 0;
  const eOggi = confrontaMesi(corrente, meseOggi) === 0;

  // Immagine da condividere: pre-generata a ogni cambio di vista, così il click chiama share()
  // subito, senza attese asincrone che su iOS farebbero perdere l'attivazione dell'utente.
  const [pronta, setPronta] = useState<{ vista: typeof vista; file: File } | null>(null);
  const immagine = pronta?.vista === vista ? pronta.file : null;
  const sediImm = dati.sedi;
  useEffect(() => {
    if (soloLettura || vista.tipo === 'vuoto') return;
    let attivo = true;
    creaFileCalendario(vista, sediImm)
      .then((file) => attivo && setPronta({ vista, file }))
      .catch(() => undefined);
    return () => {
      attivo = false;
    };
  }, [vista, sediImm, soloLettura]);
  const condividi = () => {
    conta('condividiPng');
    if (immagine) {
      void condividiFile(immagine);
      return;
    }
    // Non ancora pronta: ripiego (su iOS può ricadere nel download).
    void creaFileCalendario(vista, dati.sedi).then(condividiFile);
  };

  const salvaCambio = async (c: NuovoCambio) => {
    await servizi.aggiungiCambio(medicoId, c);
    conta('registraCambio');
    await onCambiModificati();
  };
  const annullaCambio = async () => {
    if (!daAnnullare) return;
    setAnnullo(true);
    try {
      await servizi.eliminaCambio(medicoId, daAnnullare.id);
      conta('annullaCambio');
      await onCambiModificati();
      setDaAnnullare(null);
    } finally {
      setAnnullo(false);
    }
  };

  const dettaglio = (
    <DettaglioGiorno
      giorno={giornoSel}
      sedi={dati.sedi}
      nomi={nomi}
      puoModificare={!soloLettura && principale && vista.tipo !== 'previsione'}
      onCedi={(giorno, voce) => {
        conta('chiediCambio');
        setRichiesta({ tipo: 'cedi', giorno, voce });
      }}
      onRicevuto={(giorno) => {
        conta('chiediCambio');
        setRichiesta({ tipo: 'ricevuto', giorno });
      }}
      onAnnulla={setDaAnnullare}
    />
  );

  return (
    <div className="pagina pagina-medico">
      {intestazione}
      {!soloLettura && (
        <div className="card-riepilogo-alto">
          <CardOggiDomani oggi={oggi} mesi={dati.mesi} cambi={dati.cambi} proiezione={proiezione} sedi={dati.sedi} nomi={nomi} medicoId={medicoId} />
          {vedeQuadro && (
            <CardChiConMe oggi={oggi} giorno={giornoCard} pubblicato={pubblicatoCard} sedi={dati.sedi} nomi={nomi} medicoId={medicoId} />
          )}
        </div>
      )}
      <div className="barra-mese">
        <div className="barra-mese-titolo">
          <h1 className="titolo-mese" aria-live="polite">
            {nomeMese(corrente.anno, corrente.mese)}
          </h1>
        </div>
        <div className="barra-mese-comandi">
          {!eOggi && (
            <button type="button" className="btn btn-fantasma btn-piccolo" onClick={() => vaiA(meseOggi)}>
              Oggi
            </button>
          )}
          <button type="button" className="btn btn-secondario btn-icona" onClick={() => vaiA(prec)} disabled={!puoPrec} aria-label="Mese precedente">
            <Icona nome="indietro" />
          </button>
          <button type="button" className="btn btn-secondario btn-icona" onClick={() => vaiA(succ)} disabled={!puoSucc} aria-label="Mese successivo">
            <Icona nome="avanti" />
          </button>
          {!soloLettura && (
            <button
              type="button"
              className="btn btn-secondario btn-icona"
              onClick={condividi}
              disabled={vista.tipo === 'vuoto'}
              aria-label="Condividi il calendario del mese"
              title="Condividi il calendario del mese"
            >
              <Icona nome="condividi" />
            </button>
          )}
        </div>
      </div>

      <p className="nota nota-caricamento">
        <Icona nome={vista.tipo === 'previsione' ? 'previsione' : 'info'} piccola />{' '}
        {vista.tipo === 'previsione'
          ? 'Previsione'
          : vista.tipo === 'vuoto'
            ? 'Nessun turno pubblicato'
            : meseDoc?.caricatoIl
              ? `Turni caricati il ${dataNumerica(meseDoc.caricatoIl)}`
              : 'Turni pubblicati'}
      </p>

      {vista.tipo === 'previsione' && (
        <div className="avviso avviso-info">
          <Icona nome="info" />
          <span>
            Turni <strong>previsti</strong> dal ciclo Mattino+Pomeriggio–Notte–smonto–riposo–riposo
            {proiezione.ancora ? `, a partire da ${dataEstesa(proiezione.ancora)}` : ''}. Sono indicativi: i turni definitivi saranno
            diversi.
          </span>
        </div>
      )}
      {vista.tipo === 'vuoto' && (
        <div className="avviso">
          <Icona nome="info" />
          <span>Nessun turno pubblicato per questo mese.</span>
        </div>
      )}
      {soloLettura && (
        <p className="nota nota-sola-lettura">
          <Icona nome="lucchetto" piccola /> I cambi turno sono privati del medico e non sono visibili qui.
        </p>
      )}
      {!soloLettura && !principale && (
        <p className="nota nota-sola-lettura">
          <Icona nome="lucchetto" piccola /> Account secondario: i cambi turno si inseriscono dall’account principale.
        </p>
      )}

      <div className="layout-medico">
        <div className="colonna-calendario">
          {gestisceIndisp && (
            <CardIndisponibilita
              anno={vista.anno}
              mese={vista.mese}
              giorni={giorniIndispMese}
              ufficiali={ufficialiMese}
              modificabile={indispModificabile}
              modifica={inModifica}
              onModifica={(v) => {
                setModificaIndisp(v);
                if (!v) void salvaIndispMese();
              }}
              mostra={mostraIndisp}
              onMostra={(v) => {
                setMostraIndisp(v);
                salvaPreferenzaMostra(v);
              }}
              nomeMedico={nomi.get(medicoId) ?? ''}
              errore={erroreIndisp}
            />
          )}
          <Calendario vista={vista} sedi={dati.sedi} nomi={nomi} selezionato={giornoSel.data} onSeleziona={seleziona} segni={segni} inModifica={inModifica} />
          {!desktop && dettaglio}
          {!soloLettura && vedeQuadro && <CardCollega oggi={oggi} sedi={dati.sedi} colleghi={colleghi} />}
          <Legenda />
        </div>
        {/* Mobile: calendario, weekend e festività, poi i conteggi. */}
        <aside className="colonna-laterale" aria-label="Riepilogo del mese">
          {desktop && dettaglio}
          <CardWeekend vista={vista} />
          <div className="metriche">
            <CardOre vista={vista} senzaCambi={soloLettura} />
            <CardReperibilita vista={vista} />
          </div>
          {!soloLettura && <CardCambi vista={vista} nomi={nomi} />}
          {!soloLettura && <CardSiri medicoId={medicoId} oggi={oggi} mesi={dati.mesi} cambi={dati.cambi} elenco={dati.elenco} sedi={dati.sedi} />}
        </aside>
      </div>

      <DialogoIndisponibilita data={giornoIndisp} giorni={giorniIndispMese} ufficiali={ufficialiMese} onCambia={cambiaIndispMese} onChiudi={chiudiIndisp} />
      <DialogoCambio richiesta={richiesta} principale={principale} colleghi={colleghi} sedi={dati.sedi} onChiudi={() => setRichiesta(null)} onConferma={salvaCambio} />
      <Dialogo
        aperto={daAnnullare !== null}
        titolo="Annullare il cambio?"
        onChiudi={() => setDaAnnullare(null)}
        descrizione={
          daAnnullare
            ? `${daAnnullare.verso === 'ceduto' ? 'Turno ceduto' : 'Turno ricevuto'} ${daAnnullare.codice} del ${dataEstesa(daAnnullare.data)}${
                nomi.get(daAnnullare.collegaId) ? `, ${daAnnullare.verso === 'ceduto' ? 'a' : 'da'} ${nomi.get(daAnnullare.collegaId)}` : ''
              }.`
            : undefined
        }
        piede={
          <>
            <button type="button" className="btn btn-secondario" onClick={() => setDaAnnullare(null)}>
              Mantieni
            </button>
            <button type="button" className="btn btn-pericolo" onClick={() => void annullaCambio()} disabled={annullo}>
              <Icona nome="cestino" /> {annullo ? 'Annullamento…' : 'Annulla il cambio'}
            </button>
          </>
        }
      >
        <p className="testo-tenue">Il turno tornerà come pubblicato nell’Excel. L’operazione è visibile a tutti i tuoi account.</p>
      </Dialogo>
    </div>
  );
}

function ScheletroCalendario() {
  return (
    <div className="pagina" aria-busy="true" aria-label="Caricamento dei turni">
      <div className="scheletro" style={{ height: 44, width: 220, marginBottom: 16 }} />
      <div className="layout-medico">
        <div className="scheletro" style={{ height: 480 }} />
        <div className="colonna-laterale">
          <div className="scheletro" style={{ height: 160 }} />
          <div className="scheletro" style={{ height: 220 }} />
        </div>
      </div>
    </div>
  );
}
