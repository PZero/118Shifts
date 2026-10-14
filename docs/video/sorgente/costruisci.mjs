// Uso: node costruisci.mjs [anteprima t1,t2,...]
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import { pathToFileURL } from 'node:url';

const durata = (f) => { let o=''; try { execFileSync(ffmpeg, ['-i', f], { stdio: 'pipe' }); } catch (e) { o = e.stderr.toString(); }
  const m = o.match(/Duration: (\d+):(\d+):([\d.]+)/); return +m[1]*3600 + +m[2]*60 + +m[3]; };
const voci = Array.from({ length: 9 }, (_, i) => durata(`voce/v${i}.mp3`));
const inizi = [], durate = [], voceA = [];
let c = 0;
voci.forEach((v, i) => {
  const pre = i === 0 ? .9 : i === 8 ? .6 : .3, post = i === 0 ? .5 : i === 8 ? 2.8 : .55;
  inizi.push(c); voceA.push(c + pre); durate.push(pre + v + post); c += pre + v + post;
});
const totale = +c.toFixed(3);
writeFileSync('tempi.js', `window.TEMPI=${JSON.stringify({ inizi, durate, totale })};window.DATI=${readFileSync('asset/dati.json','utf8')};`);
writeFileSync('asset/qr.js', `window.QR=${JSON.stringify(readFileSync('asset/qr.svg','utf8'))};`);
writeFileSync('voceA.json', JSON.stringify({ voceA, totale }));
console.log('totale', totale.toFixed(2), 's');

const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await p.goto(pathToFileURL(process.cwd() + '/regia.html').href);
await p.evaluate(() => window.pronto());
const frame = async (t) => { await p.evaluate((t) => window.render(t), t); await p.evaluate(() => window.attesa()); return p.screenshot({ type: 'jpeg', quality: 94 }); };

if (process.argv[2] === 'anteprima') {
  mkdirSync('anteprima', { recursive: true });
  for (const t of process.argv[3].split(',').map(Number)) writeFileSync(`anteprima/t${t}.jpg`, await frame(t));
} else {
  const FPS = 30, n = Math.ceil(totale * FPS);
  const ff = spawn(ffmpeg, ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), 'muto.mp4'], { stdio: ['pipe', 'ignore', 'inherit'] });
  for (let i = 0; i < n; i++) {
    const buf = await frame(i / FPS);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`${i}/${n}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
}
await b.close();
