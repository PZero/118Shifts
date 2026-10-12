// Immagine dello screenshot con la griglia sovrapposta, ingrandibile e scorrevole.
// Serve sia a confermare/correggere la griglia (tocco su 2 punti) sia a scegliere una cella da rivedere.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Griglia, Punto } from '../../../domain/ocr';
import { Icona } from '../../../ui/Icona';


interface Props {
  sorgente: HTMLCanvasElement;
  griglia: Griglia | null;
  /** Punti scelti per la correzione (modalità "punti"). */
  punti?: Punto[];
  /** Se presente, i tocchi producono punti dell'immagine. */
  onPunto?: (p: Punto) => void;
  /** Se presente, i tocchi su una cella la selezionano: (riga, sottoRiga, giorno). */
  onCella?: (riga: number, sottoRiga: 0 | 1, giorno: number) => void;
  /** Celle evidenziate: chiavi "riga|sotto|giorno". */
  evidenziate?: ReadonlySet<string>;
  selezionata?: string | null;
  altezza?: number;
}

export function ImmagineGriglia({ sorgente, griglia, punti, onPunto, onCella, evidenziate, selezionata, altezza = 360 }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const contenitore = useRef<HTMLDivElement>(null);
  const [scala, setScala] = useState(0);
  const W = sorgente.width;
  const H = sorgente.height;

  const adatta = () => {
    const larg = contenitore.current?.clientWidth ?? W;
    setScala(Math.min(1, larg / W));
  };
  useEffect(adatta, [W]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    c.width = W;
    c.height = H;
    c.getContext('2d')!.drawImage(sorgente, 0, 0);
  }, [sorgente, W, H]);

  const zoom = (f: number) => setScala((s) => Math.min(4, Math.max(0.1, s * f)));

  const tocco = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = canvas.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    if (onPunto) {
      onPunto({ x, y });
      return;
    }
    if (onCella && griglia) {
      const giorno = Math.floor((x - griglia.x0) / griglia.passoX) + 1;
      const riga = Math.floor((y - griglia.y0) / griglia.passoMedico);
      const sotto = Math.floor(((y - griglia.y0) / griglia.passoMedico - riga) * 2);
      if (giorno >= 1 && giorno <= griglia.giorni && riga >= 0 && riga < griglia.righe) onCella(riga, sotto === 1 ? 1 : 0, giorno);
    }
  };

  const forme = useMemo(() => {
    if (!griglia) return null;
    const { x0, y0, passoX, passoMedico, giorni, righe } = griglia;
    const w = passoX * giorni;
    const h = passoMedico * righe;
    const celle: { k: string; x: number; y: number }[] = [];
    if (evidenziate) {
      for (const k of evidenziate) {
        const [r, s, g] = k.split('|').map(Number) as [number, number, number];
        celle.push({ k, x: x0 + passoX * (g - 1), y: y0 + passoMedico * r + (passoMedico / 2) * s });
      }
    }
    return { x0, y0, passoX, passoMedico, giorni, righe, w, h, celle };
  }, [griglia, evidenziate]);

  const sel = useMemo(() => {
    if (!griglia || !selezionata) return null;
    const [r, s, g] = selezionata.split('|').map(Number) as [number, number, number];
    return { x: griglia.x0 + griglia.passoX * (g - 1), y: griglia.y0 + griglia.passoMedico * r + (griglia.passoMedico / 2) * s };
  }, [griglia, selezionata]);

  const spessore = 1.2 / Math.max(scala, 0.1);

  return (
    <div className="ocr-immagine">
      <div className="ocr-zoom" role="group" aria-label="Ingrandimento">
        <button type="button" className="btn btn-secondario btn-piccolo" onClick={() => zoom(1 / 1.4)} aria-label="Riduci">
          −
        </button>
        <button type="button" className="btn btn-secondario btn-piccolo" onClick={adatta}>
          Adatta
        </button>
        <button type="button" className="btn btn-secondario btn-piccolo" onClick={() => setScala(1)}>
          100%
        </button>
        <button type="button" className="btn btn-secondario btn-piccolo" onClick={() => zoom(1.4)} aria-label="Ingrandisci">
          +
        </button>
      </div>
      <div ref={contenitore} className="ocr-scorrevole" style={{ maxHeight: altezza }} onClick={tocco}>
        <div className="ocr-tela" style={{ width: W * scala, height: H * scala }}>
          <canvas ref={canvas} style={{ width: '100%', height: '100%', display: 'block' }} />
          <svg className="ocr-sovrapposto" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
            {forme && (
              <g fill="none" strokeWidth={spessore}>
                <rect x={forme.x0} y={forme.y0} width={forme.w} height={forme.h} stroke="#1d82c4" />
                {Array.from({ length: forme.giorni - 1 }, (_, k) => (
                  <line key={`v${k}`} x1={forme.x0 + forme.passoX * (k + 1)} x2={forme.x0 + forme.passoX * (k + 1)} y1={forme.y0} y2={forme.y0 + forme.h} stroke="#1d82c4" strokeOpacity={0.45} />
                ))}
                {Array.from({ length: forme.righe * 2 - 1 }, (_, k) => (
                  <line key={`h${k}`} x1={forme.x0} x2={forme.x0 + forme.w} y1={forme.y0 + (forme.passoMedico / 2) * (k + 1)} y2={forme.y0 + (forme.passoMedico / 2) * (k + 1)} stroke="#1d82c4" strokeOpacity={k % 2 === 0 ? 0.25 : 0.6} />
                ))}
                {forme.celle.map((c) => (
                  <rect key={c.k} x={c.x} y={c.y} width={forme.passoX} height={forme.passoMedico / 2} fill="#f5a623" fillOpacity={0.35} stroke="#c77700" strokeWidth={spessore} />
                ))}
              </g>
            )}
            {sel && griglia && <rect x={sel.x} y={sel.y} width={griglia.passoX} height={griglia.passoMedico / 2} fill="none" stroke="#e5243b" strokeWidth={spessore * 2} />}
            {punti?.map((p, i) => (
              <g key={i} stroke="#e5243b" strokeWidth={spessore * 1.5} fill="none">
                <circle cx={p.x} cy={p.y} r={9 / Math.max(scala, 0.1)} />
                <line x1={p.x - 14 / Math.max(scala, 0.1)} x2={p.x + 14 / Math.max(scala, 0.1)} y1={p.y} y2={p.y} />
                <line y1={p.y - 14 / Math.max(scala, 0.1)} y2={p.y + 14 / Math.max(scala, 0.1)} x1={p.x} x2={p.x} />
              </g>
            ))}
          </svg>
        </div>
      </div>
      <p className="nota">
        <Icona nome="info" piccola /> Trascina per spostarti, usa + e − per ingrandire.
      </p>
    </div>
  );
}
