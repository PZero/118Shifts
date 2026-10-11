// Immagine del calendario mensile da condividere (PNG disegnato su canvas, sempre tema chiaro).
// Contiene solo titolo e griglia: niente nome del medico, ore, reperibilità, legenda o link.
// I cambi sono considerati definitivi: il turno ceduto non compare, il ricevuto è un turno normale.

import type { Sedi } from '../../servizi/tipi';
import { GIORNI_BREVI, etichettaCodice, nomeMese } from '../../ui/etichette';
import type { MeseVista } from './vista';

const LARGHEZZA = 1080;
const MARGINE = 48;
const FONT = "'Inter Variable', 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const COL = {
  sfondo: '#ffffff',
  testo: '#0f1b2a',
  tenue: '#5f6f83',
  bordo: '#dbe2ea',
  festivo: '#b42335',
  festivoSoft: '#fdf0f1',
  sabato: '#2f4d6e',
  sabatoSoft: '#f0f4f9',
  brand: '#14467a',
  neutroBg: '#eef2f6',
  neutroFg: '#445468',
  M: { bg: '#e2f0fb', fg: '#0a5689' },
  P: { bg: '#fff0dc', fg: '#874800' },
  N: { bg: '#ebe8fb', fg: '#3c2d9b' },
};

interface ChipDisegno {
  testo: string;
  tono: string;
  previsione: boolean;
}

function chipDelGiorno(g: MeseVista['giorni'][number], sedi: Sedi): ChipDisegno[] {
  const out: ChipDisegno[] = [];
  for (const v of g.voci) {
    if (v.stato === 'ceduto') continue;
    const e = etichettaCodice(v.info, sedi);
    if (e.breve) out.push({ testo: e.breve, tono: e.tono, previsione: false });
  }
  for (const f of g.previsione ?? []) out.push({ testo: f, tono: f, previsione: true });
  return out;
}

function rettangoloArrotondato(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Disegna il calendario del mese e restituisce il canvas. */
export async function disegnaCalendario(vista: MeseVista, sedi: Sedi): Promise<HTMLCanvasElement> {
  try {
    await document.fonts.ready;
    await Promise.all([document.fonts.load(`700 40px ${FONT}`), document.fonts.load(`500 24px ${FONT}`)]);
  } catch {
    /* font di sistema come ripiego */
  }

  const previsione = vista.tipo === 'previsione';
  const vuote = vista.giorni[0]?.colonna ?? 0;
  const righe = Math.ceil((vuote + vista.giorni.length) / 7);
  const larghezzaGriglia = LARGHEZZA - MARGINE * 2;
  const cella = larghezzaGriglia / 7;
  const altezzaCella = 150;
  const altezzaIntest = 52;
  const altezzaTitolo = previsione ? 170 : 130;
  const altezza = Math.round(altezzaTitolo + altezzaIntest + righe * altezzaCella + MARGINE);

  const scala = 1; // 1080 px di larghezza: già alta risoluzione per la condivisione
  const canvas = document.createElement('canvas');
  canvas.width = LARGHEZZA * scala;
  canvas.height = altezza * scala;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas non disponibile');

  ctx.fillStyle = COL.sfondo;
  ctx.fillRect(0, 0, LARGHEZZA, altezza);
  ctx.textBaseline = 'alphabetic';

  // Titolo
  ctx.fillStyle = COL.testo;
  ctx.textAlign = 'left';
  ctx.font = `700 64px ${FONT}`;
  ctx.fillText(nomeMese(vista.anno, vista.mese), MARGINE, MARGINE + 64);
  ctx.fillStyle = COL.brand;
  rettangoloArrotondato(ctx, MARGINE, MARGINE + 84, 72, 6, 3);
  ctx.fill();
  if (previsione) {
    ctx.fillStyle = COL.tenue;
    ctx.font = `500 30px ${FONT}`;
    ctx.fillText('Previsione', MARGINE, MARGINE + 134);
  }

  // Intestazioni dei giorni
  const yInt = altezzaTitolo;
  ctx.font = `600 24px ${FONT}`;
  ctx.textAlign = 'center';
  GIORNI_BREVI.forEach((n, i) => {
    ctx.fillStyle = i === 6 ? COL.festivo : i === 5 ? COL.sabato : COL.tenue;
    ctx.fillText(n.toUpperCase(), MARGINE + cella * i + cella / 2, yInt + 34);
  });

  // Griglia
  const yGriglia = yInt + altezzaIntest;
  const totaleCelle = righe * 7;
  for (let i = 0; i < totaleCelle; i++) {
    const col = i % 7;
    const riga = Math.floor(i / 7);
    const x = MARGINE + col * cella;
    const y = yGriglia + riga * altezzaCella;
    const g = vista.giorni[i - vuote];
    const festivo = !!g && (g.domenica || !!g.festa);
    ctx.fillStyle = !g ? '#f7f9fb' : festivo ? COL.festivoSoft : g.sabato ? COL.sabatoSoft : COL.sfondo;
    ctx.fillRect(x, y, cella, altezzaCella);
  }
  ctx.strokeStyle = COL.bordo;
  ctx.lineWidth = 2;
  for (let r = 0; r <= righe; r++) {
    ctx.beginPath();
    ctx.moveTo(MARGINE, yGriglia + r * altezzaCella);
    ctx.lineTo(MARGINE + larghezzaGriglia, yGriglia + r * altezzaCella);
    ctx.stroke();
  }
  for (let c = 0; c <= 7; c++) {
    ctx.beginPath();
    ctx.moveTo(MARGINE + c * cella, yGriglia);
    ctx.lineTo(MARGINE + c * cella, yGriglia + righe * altezzaCella);
    ctx.stroke();
  }

  // Contenuto delle celle
  for (const g of vista.giorni) {
    const i = vuote + g.giorno - 1;
    const x = MARGINE + (i % 7) * cella;
    const y = yGriglia + Math.floor(i / 7) * altezzaCella;
    const festivo = g.domenica || !!g.festa;

    ctx.textAlign = 'left';
    ctx.font = `600 28px ${FONT}`;
    ctx.fillStyle = festivo ? COL.festivo : g.sabato ? COL.sabato : COL.testo;
    ctx.fillText(String(g.giorno), x + 12, y + 38);

    const chips = chipDelGiorno(g, sedi);
    if (chips.length === 0) continue;
    const spazio = altezzaCella - 56;
    const gap = 6;
    const h = Math.min(40, (spazio - gap * (chips.length - 1)) / chips.length);
    const w = cella - 24;
    chips.forEach((c, k) => {
      const cy = y + 50 + k * (h + gap);
      const cx = x + 12;
      const colori = c.tono === 'M' || c.tono === 'P' || c.tono === 'N' ? COL[c.tono] : { bg: COL.neutroBg, fg: COL.neutroFg };
      rettangoloArrotondato(ctx, cx, cy, w, h, 8);
      if (c.previsione) {
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = colori.fg;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = COL.tenue;
      } else {
        ctx.fillStyle = colori.bg;
        ctx.fill();
        ctx.fillStyle = colori.fg;
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let corpo = Math.round(h * 0.55);
      ctx.font = `700 ${corpo}px ${FONT}`;
      while (ctx.measureText(c.testo).width > w - 10 && corpo > 12) {
        corpo -= 2;
        ctx.font = `700 ${corpo}px ${FONT}`;
      }
      ctx.fillText(c.testo, cx + w / 2, cy + h / 2 + 1);
      ctx.textBaseline = 'alphabetic';
    });
  }

  return canvas;
}

/** Genera il PNG del calendario come File pronto per la condivisione. */
export async function creaFileCalendario(vista: MeseVista, sedi: Sedi): Promise<File> {
  const canvas = await disegnaCalendario(vista, sedi);
  const blob = await new Promise<Blob>((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error('Immagine non generata'))), 'image/png'));
  return new File([blob], `turni-${vista.chiave}.png`, { type: 'image/png' });
}

function scarica(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Condivide il file (solo immagine, senza url né testo); se non supportato o rifiutato, lo scarica.
 * Va chiamata il più presto possibile dal gesto dell'utente (su iOS l'attivazione scade).
 */
export async function condividiFile(file: File): Promise<void> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      // Altri errori (es. attivazione scaduta): ripiego sul download.
    }
  }
  scarica(file);
}
