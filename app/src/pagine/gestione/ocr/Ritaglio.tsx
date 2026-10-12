// Ritaglio ingrandito di una parte dello screenshot (cella o cognome).
import { useEffect, useRef } from 'react';
import type { Rettangolo } from '../../../domain/ocr';

export function Ritaglio({
  sorgente,
  rect,
  margine = 0,
  larghezza = 160,
  className,
}: {
  sorgente: HTMLCanvasElement;
  rect: Rettangolo;
  margine?: number;
  larghezza?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const mx = rect.w * margine;
    const my = rect.h * margine;
    const sx = Math.max(0, rect.x - mx);
    const sy = Math.max(0, rect.y - my);
    const sw = Math.max(1, Math.min(sorgente.width - sx, rect.w + 2 * mx));
    const sh = Math.max(1, Math.min(sorgente.height - sy, rect.h + 2 * my));
    const scala = larghezza / sw;
    c.width = Math.round(sw * scala);
    c.height = Math.max(1, Math.round(sh * scala));
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sorgente, sx, sy, sw, sh, 0, 0, c.width, c.height);
    if (margine > 0) {
      // bordo della cella vera e propria
      ctx.strokeStyle = 'rgba(229,36,59,.8)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect((rect.x - sx) * scala, (rect.y - sy) * scala, rect.w * scala, rect.h * scala);
    }
  }, [sorgente, rect, margine, larghezza]);
  return <canvas ref={ref} className={className ?? 'ocr-ritaglio'} role="img" aria-label="Ritaglio dello screenshot" />;
}
