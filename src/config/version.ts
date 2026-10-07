export const APP_VERSION = "V1.0.0.0";
export const BUILD_DATE = "2026-10-07";

export interface VersionInfo {
  version: string;
  releaseDate: string;
  changelog: string[];
}

export const VERSION_HISTORY: VersionInfo[] = [
  {
    version: "V1.0.0.0",
    releaseDate: "2026-10-07",
    changelog: [
      "Lancio iniziale PWA Turni 118",
      "Autenticazione Google con approvazione accessi (Super Admin: fnicora@gmail.com)",
      "Caricamento e parsing multi-foglio Excel con supporto 2 righe per medico",
      "Visualizzazione calendario mobile-first per iPhone e PC",
      "Card dedicata festività e domeniche non lavorate",
      "Supporto turni M (8-14), P (14-20), N (20-8), Reperibilità (RG/RN), Elicottero, Ferie e Corsi",
      "Gestione aggiornamento cache Service Worker PWA istantanea"
    ]
  }
];
