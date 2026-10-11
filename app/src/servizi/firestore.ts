// Implementazione Firestore di `Servizi`. Ogni scrittura rispetta i vincoli di firebase/firestore.rules.

import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore';
import { accessoDiOggi } from '../domain/accessi';
import { scomponi } from '../domain/date';
import { costruisciQuadro, type GiorniQuadro } from '../domain/quadro';
import { fb } from './firebase';
import {
  SEDI_PREDEFINITE,
  type CambioDoc,
  type MedicoAnagrafica,
  type MeseDoc,
  type MesePubblicato,
  type Servizi,
  type Utente,
  type VoceElenco,
} from './tipi';

const LIMITE_BATCH = 450;

function data(v: unknown): Date | undefined {
  return v instanceof Timestamp ? v.toDate() : undefined;
}

export function utenteDaDoc(uid: string, d: DocumentData): Utente {
  const u: Utente = {
    uid,
    email: String(d.email ?? ''),
    nome: String(d.nome ?? ''),
    stato: d.stato === 'approvato' || d.stato === 'disabilitato' ? d.stato : 'attesa',
    principale: d.principale === true,
    delegato: d.delegato === true,
  };
  if (typeof d.medicoId === 'string') u.medicoId = d.medicoId;
  const c = data(d.creatoIl);
  if (c) u.creatoIl = c;
  const a = data(d.ultimoAccesso);
  if (a) u.ultimoAccesso = a;
  return u;
}

/** Registra l'accesso (solo `ultimoAccesso`) se manca o non è di oggi. Fire-and-forget: errori ignorati. */
export function registraAccesso(uid: string, ultimoAccesso: Date | undefined): void {
  if (accessoDiOggi(ultimoAccesso)) return;
  try {
    updateDoc(doc(fb().db, 'users', uid), { ultimoAccesso: serverTimestamp() }).catch(() => undefined);
  } catch {
    /* mai bloccare l'app */
  }
}

function medicoDaDoc(id: string, d: DocumentData): MedicoAnagrafica {
  const m: MedicoAnagrafica = {
    id,
    nome: String(d.nome ?? ''),
    alias: Array.isArray(d.alias) ? d.alias.map(String) : [],
    attivo: d.attivo === true,
    cicloManuale: d.cicloManuale === true,
    principaleUid: typeof d.principaleUid === 'string' ? d.principaleUid : null,
  };
  if (typeof d.cicloInizio === 'string') m.cicloInizio = d.cicloInizio;
  return m;
}

/** Scritture raggruppate in più batch (limite Firestore: 500 operazioni). */
class Lotti {
  private batch: WriteBatch;
  private n = 0;
  private readonly db: Firestore;
  readonly fatte: Promise<void>[] = [];
  constructor(db: Firestore) {
    this.db = db;
    this.batch = writeBatch(db);
  }
  get(): WriteBatch {
    if (this.n >= LIMITE_BATCH) this.chiudi();
    this.n++;
    return this.batch;
  }
  private chiudi() {
    this.fatte.push(this.batch.commit());
    this.batch = writeBatch(this.db);
    this.n = 0;
  }
  async commit(avanzamento?: (fatto: number, totale: number) => void) {
    if (this.n > 0) this.chiudi();
    let fatto = 0;
    const totale = this.fatte.length;
    await Promise.all(this.fatte.map((p) => p.then(() => avanzamento?.(++fatto, totale))));
  }
}

function cicloDoc(cicloInizio: string | undefined, cicloManuale: boolean): DocumentData {
  return cicloInizio ? { cicloInizio, cicloManuale } : { cicloManuale };
}

/** Una tantum (admin/delegato): copia il ciclo di tutti i medici esistenti in turni/{id}/meta/ciclo. */
export async function sincronizzaCicli(): Promise<number> {
  const { db } = fb();
  const snap = await getDocs(collection(db, 'medici'));
  const lotti = new Lotti(db);
  for (const s of snap.docs) {
    const m = medicoDaDoc(s.id, s.data());
    lotti.get().set(doc(db, 'turni', s.id, 'meta', 'ciclo'), cicloDoc(m.cicloInizio, m.cicloManuale));
  }
  await lotti.commit();
  return snap.size;
}

async function aggiornaElenco(db: Firestore): Promise<void> {
  const snap = await getDocs(collection(db, 'medici'));
  const medici: VoceElenco[] = snap.docs
    .map((s) => medicoDaDoc(s.id, s.data()))
    .filter((m) => m.attivo)
    .map((m) => ({ id: m.id, nome: m.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  await setDoc(doc(db, 'elencoMedici', 'elenco'), { medici });
}

export function creaServiziFirestore(): Servizi {
  const { db } = fb();

  return {
    async turniMedico(medicoId) {
      const snap = await getDocs(collection(db, 'turni', medicoId, 'mesi'));
      const mesi: MeseDoc[] = [];
      for (const s of snap.docs) {
        const m = /^(\d{4})-(\d{2})$/.exec(s.id);
        if (!m) continue;
        const d = s.data();
        const giorni: Record<string, string[]> = {};
        for (const [g, codici] of Object.entries((d.giorni ?? {}) as Record<string, unknown>)) {
          if (Array.isArray(codici)) giorni[g] = codici.map(String).slice(0, 2);
        }
        mesi.push({ chiave: s.id, anno: Number(m[1]), mese: Number(m[2]), giorni, importId: d.importId, caricatoIl: data(d.caricatoIl) });
      }
      return mesi.sort((a, b) => a.chiave.localeCompare(b.chiave));
    },

    async quadro(chiave) {
      const s = await getDoc(doc(db, 'quadro', chiave));
      if (!s.exists()) return null;
      const d = s.data();
      const giorni: GiorniQuadro = {};
      for (const [g, perMedico] of Object.entries((d.giorni ?? {}) as Record<string, unknown>)) {
        if (!perMedico || typeof perMedico !== 'object') continue;
        const out: Record<string, string[]> = {};
        for (const [id, codici] of Object.entries(perMedico as Record<string, unknown>)) {
          if (Array.isArray(codici)) out[id] = codici.map(String).slice(0, 2);
        }
        giorni[g] = out;
      }
      return { chiave, giorni, caricatoIl: data(d.caricatoIl) };
    },

    async cambiMedico(medicoId) {
      const snap = await getDocs(collection(db, 'cambi', medicoId, 'voci'));
      return snap.docs
        .map((s): CambioDoc | null => {
          const d = s.data();
          if (typeof d.data !== 'string') return null;
          try {
            scomponi(d.data);
          } catch {
            return null;
          }
          const c: CambioDoc = {
            id: s.id,
            data: d.data,
            slot: d.slot === 1 ? 1 : 0,
            codice: String(d.codice ?? ''),
            verso: d.verso === 'ricevuto' ? 'ricevuto' : 'ceduto',
            collegaId: String(d.collegaId ?? ''),
          };
          const creato = data(d.creatoIl);
          if (creato) c.creatoIl = creato;
          return c;
        })
        .filter((c): c is CambioDoc => c !== null)
        .sort((a, b) => a.data.localeCompare(b.data));
    },

    async aggiungiCambio(medicoId, c) {
      await addDoc(collection(db, 'cambi', medicoId, 'voci'), {
        data: c.data,
        slot: c.slot,
        codice: c.codice,
        verso: c.verso,
        collegaId: c.collegaId,
        creatoIl: serverTimestamp(),
      });
    },

    async eliminaCambio(medicoId, id) {
      await deleteDoc(doc(db, 'cambi', medicoId, 'voci', id));
    },

    async elencoMedici() {
      const s = await getDoc(doc(db, 'elencoMedici', 'elenco'));
      const medici = (s.data()?.medici ?? []) as unknown[];
      return medici
        .filter((m): m is VoceElenco => typeof m === 'object' && m !== null && 'id' in m && 'nome' in m)
        .map((m) => ({ id: String(m.id), nome: String(m.nome) }));
    },

    async sedi() {
      const s = await getDoc(doc(db, 'config', 'sedi'));
      const d = s.data() ?? {};
      const out = { ...SEDI_PREDEFINITE };
      for (const [k, v] of Object.entries(d)) if (typeof v === 'string' && v.trim()) out[k] = v;
      return out;
    },

    async cicloMedico(medicoId) {
      // Copia leggibile dal medico: turni/{id}/meta/ciclo (scritta insieme a medici/{id}).
      try {
        const c = await getDoc(doc(db, 'turni', medicoId, 'meta', 'ciclo'));
        if (c.exists()) {
          const d = c.data();
          return { cicloInizio: typeof d.cicloInizio === 'string' ? d.cicloInizio : undefined, cicloManuale: d.cicloManuale === true };
        }
      } catch {
        return null;
      }
      // Solo admin e delegati: anagrafica (medici non ancora copiati).
      try {
        const s = await getDoc(doc(db, 'medici', medicoId));
        if (!s.exists()) return null;
        const m = medicoDaDoc(s.id, s.data());
        return { cicloInizio: m.cicloInizio, cicloManuale: m.cicloManuale };
      } catch {
        return null;
      }
    },

    osservaInAttesa(cb) {
      return onSnapshot(
        query(collection(db, 'users'), where('stato', '==', 'attesa')),
        (snap) => cb(snap.size),
        () => cb(0),
      );
    },

    async utenti() {
      const snap = await getDocs(collection(db, 'users'));
      return snap.docs.map((s) => utenteDaDoc(s.id, s.data()));
    },

    async associa(utente, medicoId, principale) {
      const batch = writeBatch(db);
      const medicoSnap = await getDoc(doc(db, 'medici', medicoId));
      if (!medicoSnap.exists()) throw new Error('Medico non trovato in anagrafica.');
      const exPrincipale = medicoDaDoc(medicoId, medicoSnap.data()).principaleUid ?? null;
      const userRef = doc(db, 'users', utente.uid);

      // Se l'account era principale di un altro medico, quel medico perde il principale.
      if (utente.principale && utente.medicoId && utente.medicoId !== medicoId) {
        batch.update(doc(db, 'medici', utente.medicoId), { principaleUid: null });
      }

      if (principale) {
        batch.update(doc(db, 'medici', medicoId), { principaleUid: utente.uid });
        batch.update(userRef, { stato: 'approvato', medicoId, principale: true });
        if (exPrincipale && exPrincipale !== utente.uid) {
          // Vincolo delle regole: l'ex principale va retrocesso nella stessa batch.
          const ex = await getDoc(doc(db, 'users', exPrincipale));
          if (ex.exists()) batch.update(ex.ref, { principale: false });
        }
      } else {
        batch.update(userRef, { stato: 'approvato', medicoId, principale: false });
        if (exPrincipale === utente.uid) batch.update(doc(db, 'medici', medicoId), { principaleUid: null });
      }
      await batch.commit();
    },

    async impostaStato(utente, stato) {
      await updateDoc(doc(db, 'users', utente.uid), { stato });
    },

    async impostaDelegato(utente, delegato) {
      await updateDoc(doc(db, 'users', utente.uid), { delegato });
    },

    async medici() {
      const snap = await getDocs(collection(db, 'medici'));
      return snap.docs.map((s) => medicoDaDoc(s.id, s.data())).sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
    },

    async salvaMedico(m) {
      const ref = m.id ? doc(db, 'medici', m.id) : doc(collection(db, 'medici'));
      const dati: DocumentData = {
        nome: m.nome.trim(),
        alias: m.alias,
        attivo: m.attivo,
        cicloManuale: m.cicloManuale,
      };
      if (m.cicloInizio) dati.cicloInizio = m.cicloInizio;
      // Anagrafica e copia del ciclo (leggibile dal medico) in una sola batch atomica.
      const batch = writeBatch(db);
      if (m.id) {
        // principaleUid non si tocca da qui (si gestisce con l'approvazione degli account).
        if (!m.cicloInizio) dati.cicloInizio = deleteField();
        batch.update(ref, dati);
      } else {
        batch.set(ref, dati);
      }
      batch.set(doc(db, 'turni', ref.id, 'meta', 'ciclo'), cicloDoc(m.cicloInizio, m.cicloManuale));
      await batch.commit();
      await aggiornaElenco(db);
      return ref.id;
    },

    async salvaSedi(sedi) {
      await setDoc(doc(db, 'config', 'sedi'), sedi);
    },

    async importazioni() {
      const snap = await getDocs(collection(db, 'importazioni'));
      return snap.docs
        .map((s) => {
          const d = s.data();
          return {
            id: s.id,
            data: data(d.data),
            autoreUid: String(d.autoreUid ?? ''),
            mesi: Array.isArray(d.mesi) ? d.mesi.map(String) : [],
            numeroAvvisi: Array.isArray(d.avvisi) ? d.avvisi.length : 0,
          };
        })
        .sort((a, b) => (b.data?.getTime() ?? 0) - (a.data?.getTime() ?? 0));
    },

    async mesiPubblicati() {
      const snap = await getDocs(collection(db, 'mesiPubblicati'));
      return snap.docs
        .map((s): MesePubblicato => {
          const d = s.data();
          return {
            chiave: s.id,
            medici: Array.isArray(d.medici) ? d.medici.map(String) : [],
            caricatoIl: data(d.caricatoIl),
            importId: String(d.importId ?? ''),
          };
        })
        .sort((a, b) => a.chiave.localeCompare(b.chiave));
    },

    async pubblicaImport(piano, autoreUid, avanzamento) {
      const importRef = doc(collection(db, 'importazioni'));
      const meseDa = piano.meseDa ?? '';
      const mesi = piano.mesi.filter((m) => m >= meseDa);
      const turni = piano.turni.filter((t) => t.chiave >= meseDa);
      const ids = new Map<string, string>();
      const totale = mesi.length + 1;
      let fatto = 0;

      // 1) Anagrafica: nuovi medici (con ciclo) e alias.
      const lotti = new Lotti(db);
      for (const n of piano.nuoviMedici) {
        const ref = doc(collection(db, 'medici'));
        ids.set(n.rif, ref.id);
        lotti.get().set(ref, { nome: n.nome, alias: [], attivo: true, cicloManuale: false });
        lotti.get().set(doc(db, 'turni', ref.id, 'meta', 'ciclo'), cicloDoc(undefined, false));
      }
      for (const a of piano.alias) {
        lotti.get().update(doc(db, 'medici', a.medicoId), { alias: arrayUnion(a.alias) });
      }
      await lotti.commit();
      avanzamento?.(++fatto, totale);

      // 2) Un mese alla volta, sostituzione completa. Nella stessa batch (atomica) vanno i turni
      //    nuovi, la cancellazione dei medici assenti e l'indice. Oltre LIMITE_BATCH operazioni il
      //    mese è spezzato: l'indice provvisorio (unione) precede i dati e quello definitivo chiude,
      //    così un'interruzione non lascia turni non tracciati.
      for (const mese of mesi) {
        const idxRef = doc(db, 'mesiPubblicati', mese);
        const prec = await getDoc(idxRef);
        const precedenti: string[] = prec.exists() && Array.isArray(prec.data().medici) ? prec.data().medici.map(String) : [];
        const nuovi = new Map<string, Record<string, string[]>>();
        for (const t of turni) if (t.chiave === mese) nuovi.set(ids.get(t.medico) ?? t.medico, t.giorni);

        const ops: ((b: WriteBatch) => void)[] = [];
        for (const [medicoId, giorni] of nuovi) {
          ops.push((b) =>
            b.set(doc(db, 'turni', medicoId, 'mesi', mese), { giorni, importId: importRef.id, caricatoIl: serverTimestamp() }),
          );
        }
        // Quadro del mese (tutti i medici): set completo, sostituisce il precedente.
        const quadroGiorni = costruisciQuadro([...nuovi].map(([medicoId, giorni]) => ({ medicoId, giorni })));
        ops.push((b) => b.set(doc(db, 'quadro', mese), { giorni: quadroGiorni, importId: importRef.id, caricatoIl: serverTimestamp() }));
        for (const medicoId of precedenti) {
          if (!nuovi.has(medicoId)) ops.push((b) => b.delete(doc(db, 'turni', medicoId, 'mesi', mese)));
        }
        const indice = (medici: string[]) => (b: WriteBatch) =>
          b.set(idxRef, { medici, caricatoIl: serverTimestamp(), importId: importRef.id });
        const elenco = [...nuovi.keys()];

        if (ops.length < LIMITE_BATCH) {
          const b = writeBatch(db);
          ops.forEach((o) => o(b));
          indice(elenco)(b);
          await b.commit();
        } else {
          const unione = [...new Set([...precedenti, ...elenco])];
          for (let i = 0; i < ops.length; i += LIMITE_BATCH) {
            const b = writeBatch(db);
            if (i === 0) indice(unione)(b);
            ops.slice(i, i + LIMITE_BATCH).forEach((o) => o(b));
            await b.commit();
          }
          const b = writeBatch(db);
          indice(elenco)(b);
          await b.commit();
        }
        avanzamento?.(++fatto, totale);
      }

      await aggiornaElenco(db);
      await setDoc(importRef, {
        data: serverTimestamp(),
        autoreUid,
        mesi,
        // Limite prudente per restare lontani dal massimo di 1 MB per documento.
        avvisi: piano.avvisi.slice(0, 400),
      });
      return importRef.id;
    },
  };
}
