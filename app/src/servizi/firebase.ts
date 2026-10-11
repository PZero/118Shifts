// Inizializzazione pigra di Firebase: la configurazione arriva da app/.env (escluso da git).
// Nulla viene inizializzato finché non serve (la pagina demo di sviluppo non usa Firebase).

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import {
  clearIndexedDbPersistence,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  type Firestore,
} from 'firebase/firestore';

interface Istanza {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let istanza: Istanza | null = null;

export function configurazionePresente(): boolean {
  return Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID);
}

export function fb(): Istanza {
  if (istanza) return istanza;
  if (!configurazionePresente()) {
    throw new Error('Configurazione Firebase mancante: copiare .env.example in app/.env e compilarlo.');
  }
  const app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  });
  const auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  auth.languageCode = 'it';
  // Cache locale: i turni restano consultabili anche offline. Si cancella all'uscita.
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  istanza = { app, auth, db };
  return istanza;
}

/** Chiude Firestore e cancella la cache locale (dati dei turni) dal dispositivo. */
export async function cancellaCacheLocale(): Promise<void> {
  if (!istanza) return;
  try {
    await terminate(istanza.db);
    await clearIndexedDbPersistence(istanza.db);
  } catch {
    // Altre schede aperte possono impedire la cancellazione: la cache resta protetta dal login.
  }
}

export { messaggioErroreGenerico as messaggioErrore } from '../ui/errori';
