// Sessione reale: Firebase Auth (Google) + profilo users/{uid} + ruolo admin (admins/{uid}).

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { cancellaCacheLocale, fb, messaggioErrore } from '../servizi/firebase';
import { creaServiziFirestore, registraAccesso, utenteDaDoc } from '../servizi/firestore';
import { SessioneCtx, type ContestoSessione, type Sessione } from './contesto';

/** PWA installata su iOS (o qualunque app standalone): il popup non torna all'app, si usa il redirect. */
function preferisciRedirect(): boolean {
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return standalone && ios;
}

function nomeDa(user: User): string {
  const n = (user.displayName ?? '').trim() || (user.email ?? '').split('@')[0] || 'Utente';
  return n.slice(0, 100);
}

export function SessioneFirebase({ children }: { children: ReactNode }) {
  const [sessione, setSessione] = useState<Sessione>({ tipo: 'caricamento' });
  const [erroreAccesso, setErroreAccesso] = useState<string>();
  const servizi = useMemo(() => {
    try {
      return creaServiziFirestore();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let auth;
    try {
      auth = fb().auth;
    } catch (e) {
      setSessione({ tipo: 'errore', messaggio: messaggioErrore(e) });
      return;
    }
    const { db } = fb();
    getRedirectResult(auth).catch((e) => setErroreAccesso(messaggioErrore(e)));

    let smettiProfilo: (() => void) | undefined;
    const smettiAuth = onAuthStateChanged(auth, async (user) => {
      smettiProfilo?.();
      smettiProfilo = undefined;
      if (!user) {
        setSessione({ tipo: 'anonimo' });
        return;
      }
      setSessione({ tipo: 'caricamento' });
      try {
        const admin = (await getDoc(doc(db, 'admins', user.uid))).exists();
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (admin) {
          // Anche l'admin ha un profilo in users: puo' associarsi a un medico (es. come secondario di un familiare).
          if (!snap.exists()) {
            await setDoc(ref, {
              email: user.email ?? '',
              nome: nomeDa(user),
              stato: 'attesa',
              principale: false,
              delegato: false,
              creatoIl: serverTimestamp(),
            });
          }
          const base = { uid: user.uid, email: user.email ?? '', nome: nomeDa(user), admin: true, delegato: false, principale: false };
          // La sessione parte solo dopo aver letto il profilo: cosi' la pagina iniziale e' gia' "/turni" se collegato.
          smettiProfilo = onSnapshot(
            ref,
            (s) => {
              if (!s.exists()) return setSessione({ tipo: 'attivo', profilo: base });
              const u = utenteDaDoc(s.id, s.data());
              const collegato = u.stato === 'approvato' && u.medicoId;
              setSessione({
                tipo: 'attivo',
                profilo: collegato ? { ...base, nome: u.nome, principale: u.principale, medicoId: u.medicoId } : base,
              });
            },
            () => setSessione({ tipo: 'attivo', profilo: base }),
          );
          return;
        }
        if (!snap.exists()) {
          // Primo accesso: solo i campi ammessi dalle regole, in attesa di approvazione.
          await setDoc(ref, {
            email: user.email ?? '',
            nome: nomeDa(user),
            stato: 'attesa',
            principale: false,
            delegato: false,
            creatoIl: serverTimestamp(),
          });
        }
        // Profilo osservato in tempo reale: l'approvazione si vede senza ricaricare.
        let accessoRegistrato = false;
        smettiProfilo = onSnapshot(
          ref,
          (s) => {
            if (!s.exists()) return;
            const u = utenteDaDoc(s.id, s.data());
            if (u.stato === 'attesa') setSessione({ tipo: 'attesa', utente: u });
            else if (u.stato === 'disabilitato') setSessione({ tipo: 'disabilitato', utente: u });
            else {
              if (!accessoRegistrato) {
                accessoRegistrato = true;
                registraAccesso(u.uid, u.ultimoAccesso);
              }
              const profilo = { uid: u.uid, email: u.email, nome: u.nome, admin: false, delegato: u.delegato, principale: u.principale };
              setSessione({ tipo: 'attivo', profilo: u.medicoId ? { ...profilo, medicoId: u.medicoId } : profilo });
            }
          },
          (e) => setSessione({ tipo: 'errore', messaggio: messaggioErrore(e) }),
        );
      } catch (e) {
        setSessione({ tipo: 'errore', messaggio: messaggioErrore(e) });
      }
    });
    return () => {
      smettiProfilo?.();
      smettiAuth();
    };
  }, []);

  const accedi = useCallback(async () => {
    setErroreAccesso(undefined);
    const { auth } = fb();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    if (preferisciRedirect()) {
      await signInWithRedirect(auth, provider);
      return;
    }
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      const codice = (e as { code?: string }).code;
      if (codice === 'auth/popup-blocked' || codice === 'auth/operation-not-supported-in-environment') {
        await signInWithRedirect(auth, provider);
        return;
      }
      if (codice !== 'auth/popup-closed-by-user' && codice !== 'auth/cancelled-popup-request') {
        setErroreAccesso(messaggioErrore(e));
      }
    }
  }, []);

  const esci = useCallback(async () => {
    await signOut(fb().auth);
    await cancellaCacheLocale();
    window.location.replace('/');
  }, []);

  const valore = useMemo<ContestoSessione>(
    () => ({ sessione, servizi, accedi, esci, erroreAccesso }),
    [sessione, servizi, accedi, esci, erroreAccesso],
  );
  return <SessioneCtx.Provider value={valore}>{children}</SessioneCtx.Provider>;
}
