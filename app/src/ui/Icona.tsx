// Set di icone a tratto (24×24, stroke 2), disegnate per l'app. Decorative per default.

const PERCORSI = {
  indietro: 'M15 18l-6-6 6-6',
  avanti: 'M9 18l6-6-6-6',
  giu: 'M6 9l6 6 6-6',
  calendario: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  utenti: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  utente: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  medici: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1M12 14v4M10 16h4',
  carica: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  sede: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01',
  esci: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  sole: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
  luna: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  automatico: 'M12 3a9 9 0 1 0 0 18V3z M12 3a9 9 0 0 1 0 18',
  scambio: 'M17 3l4 4-4 4M21 7H8M7 21l-4-4 4-4M3 17h13',
  ricevuto: 'M7 7l-4 4 4 4M3 11h12a6 6 0 0 1 6 6v1',
  chiudi: 'M18 6 6 18M6 6l12 12',
  piu: 'M12 5v14M5 12h14',
  spunta: 'M20 6 9 17l-5-5',
  attenzione: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  orologio: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  scudo: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  lucchetto: 'M5 11h14v10H5zM8 11V7a4 4 0 1 1 8 0v4',
  telefono: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
  cestino: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
  matita: 'M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z',
  stella: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z',
  attesa: 'M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2',
  blocco: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM4.93 4.93l14.14 14.14',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
  aggiorna: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  previsione: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  cerca: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  condividi: 'M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13',
  oggi: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  messaggio: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  invia: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
} as const;

export type NomeIcona = keyof typeof PERCORSI;

export function Icona({ nome, piccola, titolo }: { nome: NomeIcona; piccola?: boolean; titolo?: string }) {
  return (
    <svg
      className={piccola ? 'icona-s' : 'icona'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={titolo ? undefined : true}
      role={titolo ? 'img' : undefined}
      aria-label={titolo}
      focusable="false"
    >
      <path d={PERCORSI[nome]} />
    </svg>
  );
}

/** Logo "G" di Google (multicolore, come da linee guida per il pulsante di accesso). */
export function LogoGoogle() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** Marchio dell'app (stesso disegno dell'icona PWA, in piccolo). */
export function Marchio({ lato = 32 }: { lato?: number }) {
  return (
    <svg width={lato} height={lato} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="marchio-sfondo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14467A" />
          <stop offset="1" stopColor="#0B2C4F" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#marchio-sfondo)" />
      <rect x="104" y="134" width="304" height="270" rx="34" fill="#fff" />
      <path d="M138 134h236a34 34 0 0 1 34 34v36H104v-36a34 34 0 0 1 34-34z" fill="#D63447" />
      <rect x="168" y="104" width="30" height="64" rx="15" fill="#fff" stroke="#0B2C4F" strokeWidth="10" />
      <rect x="314" y="104" width="30" height="64" rx="15" fill="#fff" stroke="#0B2C4F" strokeWidth="10" />
      <path d="M247 146h18v14h14v18h-14v14h-18v-14h-14v-18h14z" fill="#fff" />
      <polyline points="132,312 196,312 220,272 248,364 280,240 304,312 380,312" fill="none" stroke="#14467A" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
