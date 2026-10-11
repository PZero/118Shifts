import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { aggiungiMesi, chiaveMese, confrontaMesi, scomponi, type AnnoMese } from '../../domain/date';
import { proiezioneMedico } from '../../domain/proiezione';
import { useProfilo, useServizi } from '../../sessione/contesto';
import type { CambioDoc, CicloMedico, MeseDoc, NuovoCambio, Sedi, VoceElenco } from '../../servizi/tipi';
import { messaggioErroreGenerico } from '../../ui/errori';
import { useMedia } from '../../ui/media';
import { Dialogo } from '../../ui/Dialogo';
import { Icona } from '../../ui/Icona';
import { dataEstesa, nomeMese } from '../../ui/etichette';
import { Calendario } from './Calendario';
import { DettaglioGiorno } from './DettaglioGiorno';
import { DialogoCambio, type RichiestaCambio } from './DialoghiCambio';
import { CardCambi, CardOre, CardReperibilita, CardWeekend, Legenda } from './Riepiloghi';
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
  const servizi = useServizi();
  const medicoId = profilo.medicoId!;
  const [car, setCar] = useState<Caricamento>({ stato: 'caricamento' });
  const [versione, setVersione] = useState(0);

  useEffect(() => {
    let attivo = true;
    Promise.all([
      servizi.turniMedico(medicoId),
      servizi.cambiMedico(medicoId),
      servizi.elencoMedici(),
      servizi.sedi(),
      servizi.cicloMedico(medicoId),
    ])
      .then(([mesi, cambi, elenco, sedi, ciclo]) => attivo && setCar({ stato: 'pronto', dati: { mesi, cambi, elenco, sedi, ciclo } }))
      .catch((e) => attivo && setCar({ stato: 'errore', messaggio: messaggioErroreGenerico(e) }));
    return () => {
      attivo = false;
    };
  }, [servizi, medicoId, versione]);

  const ricaricaCambi = useCallback(async () => {
    const cambi = await servizi.cambiMedico(medicoId);
    setCar((c) => (c.stato === 'pronto' ? { stato: 'pronto', dati: { ...c.dati, cambi } } : c));
  }, [servizi, medicoId]);

  if (car.stato === 'caricamento') return <ScheletroCalendario />;
  if (car.stato === 'errore') {
    return (
      <div className="pagina">
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
  return <VistaMedico dati={car.dati} medicoId={medicoId} principale={profilo.principale} onCambiModificati={ricaricaCambi} />;
}

function VistaMedico({
  dati,
  medicoId,
  principale,
  onCambiModificati,
}: {
  dati: Dati;
  medicoId: string;
  principale: boolean;
  onCambiModificati: () => Promise<void>;
}) {
  const servizi = useServizi();
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
  const nomi = useMemo(() => new Map(dati.elenco.map((m) => [m.id, m.nome])), [dati.elenco]);
  const colleghi = useMemo(() => dati.elenco.filter((m) => m.id !== medicoId), [dati.elenco, medicoId]);

  const desktop = useMedia('(min-width: 1024px)');
  const [selezionato, setSelezionato] = useState<string | null>(null);
  const [richiesta, setRichiesta] = useState<RichiestaCambio | null>(null);
  const [daAnnullare, setDaAnnullare] = useState<CambioDoc | null>(null);
  const [annullo, setAnnullo] = useState(false);

  // Giorno selezionato: oggi se nel mese, altrimenti il primo; si riallinea al cambio di mese.
  const giornoSel =
    vista.giorni.find((g) => g.data === selezionato) ?? vista.giorni.find((g) => g.oggi) ?? vista.giorni[0]!;

  const vaiA = (am: AnnoMese) => {
    setSelezionato(null);
    naviga(`/turni/${chiaveMese(am)}`);
  };
  const prec = aggiungiMesi(corrente, -1);
  const succ = aggiungiMesi(corrente, 1);
  const puoPrec = confrontaMesi(prec, limiti.primo) >= 0;
  const puoSucc = confrontaMesi(succ, limiti.ultimo) <= 0;
  const eOggi = confrontaMesi(corrente, meseOggi) === 0;

  const salvaCambio = async (c: NuovoCambio) => {
    await servizi.aggiungiCambio(medicoId, c);
    await onCambiModificati();
  };
  const annullaCambio = async () => {
    if (!daAnnullare) return;
    setAnnullo(true);
    try {
      await servizi.eliminaCambio(medicoId, daAnnullare.id);
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
      puoModificare={principale && vista.tipo !== 'previsione'}
      onCedi={(giorno, voce) => setRichiesta({ tipo: 'cedi', giorno, voce })}
      onRicevuto={(giorno) => setRichiesta({ tipo: 'ricevuto', giorno })}
      onAnnulla={setDaAnnullare}
    />
  );

  return (
    <div className="pagina pagina-medico">
      <div className="barra-mese">
        <div className="barra-mese-titolo">
          <h1 className="titolo-mese" aria-live="polite">
            {nomeMese(corrente.anno, corrente.mese)}
          </h1>
          {vista.tipo === 'previsione' && (
            <span className="etichetta etichetta-previsione">
              <Icona nome="previsione" piccola /> Previsione
            </span>
          )}
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
        </div>
      </div>

      {vista.tipo === 'previsione' && (
        <div className="avviso avviso-info">
          <Icona nome="info" />
          <span>
            Turni <strong>previsti</strong> dal ciclo Pomeriggio–Mattino–Notte–smonto–riposo
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
      {!principale && (
        <p className="nota nota-sola-lettura">
          <Icona nome="lucchetto" piccola /> Account secondario: i cambi turno si inseriscono dall’account principale.
        </p>
      )}

      <div className="layout-medico">
        <div className="colonna-calendario">
          {!desktop && (
            <div className="metriche">
              <CardOre vista={vista} />
              <CardReperibilita vista={vista} />
            </div>
          )}
          <Calendario vista={vista} sedi={dati.sedi} nomi={nomi} selezionato={giornoSel.data} onSeleziona={setSelezionato} />
          <Legenda />
          {!desktop && dettaglio}
        </div>
        <aside className="colonna-laterale" aria-label="Riepilogo del mese">
          {desktop && dettaglio}
          {desktop && (
            <div className="metriche">
              <CardOre vista={vista} />
              <CardReperibilita vista={vista} />
            </div>
          )}
          <CardWeekend vista={vista} />
          <CardCambi vista={vista} nomi={nomi} />
        </aside>
      </div>

      <DialogoCambio richiesta={richiesta} colleghi={colleghi} sedi={dati.sedi} onChiudi={() => setRichiesta(null)} onConferma={salvaCambio} />
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
