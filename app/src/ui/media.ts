import { useSyncExternalStore } from 'react';

/** Vero se la media query è soddisfatta (si aggiorna al ridimensionamento). */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (avvisa) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', avvisa);
      return () => mq.removeEventListener('change', avvisa);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
