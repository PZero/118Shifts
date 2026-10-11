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
import { scomponi } from '../domain/date';
import { fb } from './firebase';
import {
  SEDI_PREDEFINITE,
  type CambioDoc,
  type MedicoAnagrafica,
  type MeseDoc,
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
  return u;
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
        mesi.push({ chiave: s.id, anno: Number(m[1]), mese: Number(m[2]), giorni, importId: d.importId });
      }
      return mesi.sort((a, b) => a.chiave.localeCompare(b.chiave));
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
      // medici/{id} è leggibile solo da admin e delegati: per il medico si torna null
      // e la proiezione usa l'ancora automatica (vedi report: richiesta sulle regole).
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
      if (m.id) {
        // principaleUid non si tocca da qui (si gestisce con l'approvazione degli account).
        if (!m.cicloInizio) dati.cicloInizio = deleteField();
        await updateDoc(ref, dati);
      } else {
        await setDoc(ref, dati);
      }
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

    async pubblicaImport(piano, autoreUid, avanzamento) {
      const importRef = doc(collection(db, 'importazioni'));
      const ids = new Map<string, string>();
      const lotti = new Lotti(db);

      for (const n of piano.nuoviMedici) {
        const ref = doc(collection(db, 'medici'));
        ids.set(n.rif, ref.id);
        lotti.get().set(ref, { nome: n.nome, alias: [], attivo: true, cicloManuale: false });
      }
      for (const a of piano.alias) {
        lotti.get().update(doc(db, 'medici', a.medicoId), { alias: arrayUnion(a.alias) });
      }
      for (const t of piano.turni) {
        const medicoId = ids.get(t.medico) ?? t.medico;
        lotti.get().set(doc(db, 'turni', medicoId, 'mesi', t.chiave), { giorni: t.giorni, importId: importRef.id });
      }
      await lotti.commit(avanzamento);
      await aggiornaElenco(db);
      await setDoc(importRef, {
        data: serverTimestamp(),
        autoreUid,
        mesi: piano.mesi,
        // Limite prudente per restare lontani dal massimo di 1 MB per documento.
        avvisi: piano.avvisi.slice(0, 400),
      });
      return importRef.id;
    },
  };
}
