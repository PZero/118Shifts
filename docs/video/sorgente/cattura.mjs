import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const c = await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true,colorScheme:'light'});
await c.addInitScript(()=>{const st=document.createElement('style');st.textContent='.etichetta-warn{display:none!important} nav.tab-basso a[href*="gestione"]{display:none!important}';document.addEventListener('DOMContentLoaded',()=>document.head.appendChild(st));});
const p = await c.newPage();
const tap = {};
const box = async (loc) => { const r = await loc.boundingBox(); return [r.x + r.width/2, r.y + r.height/2]; };
const shot = async (n, opt={}) => { await p.waitForTimeout(800); await p.screenshot({path:`asset/${n}.png`, ...opt}); };
const L = 'http://localhost:5173';

await p.goto(L + '/'); await p.waitForTimeout(2500);
tap.login = await box(p.getByRole('button',{name:/Accedi con Google/}).first());
await shot('login');

await p.goto(L + '/demo/turni'); await p.waitForTimeout(2000);
await shot('home');
// barre fisse: misure
const fisse = await p.evaluate(() => [...document.querySelectorAll('body *')].filter(e => ['fixed','sticky'].includes(getComputedStyle(e).position)).map(e => { const r = e.getBoundingClientRect(); return { tag: e.tagName, cls: e.className, top: r.top, h: r.height }; }));
console.log(JSON.stringify(fisse));
tap.oggi = await box(p.getByText('OGGI E DOMANI').first());
await p.getByText('OGGI E DOMANI').first().click(); await shot('oggi');
tap.chi = await box(p.getByText('CHI È DI TURNO CON ME').first());
await p.getByText('OGGI E DOMANI').first().click(); await p.waitForTimeout(400);
tap.chi = await box(p.getByText('CHI È DI TURNO CON ME').first());
await p.getByText('CHI È DI TURNO CON ME').first().click(); await shot('chi');

// pagina intera senza barre fisse (per lo scorrimento)
await p.goto(L + '/demo/turni'); await p.waitForTimeout(2000);
await p.addStyleTag({content: '*{scroll-behavior:auto!important}'});
const alto = await p.evaluate(() => { for (const e of document.querySelectorAll('body *')) { const s = getComputedStyle(e).position; if (s==='fixed'||s==='sticky') e.style.visibility='hidden'; } return document.documentElement.scrollHeight; });
await shot('intera', {fullPage:true});
// posizioni di riferimento nella pagina intera
const pos = await p.evaluate(() => { const y = (t) => { const el=[...document.querySelectorAll('h2,h3,div,span')].find(e=>e.textContent.trim().toUpperCase().startsWith(t)); return el ? el.getBoundingClientRect().top + scrollY : null; }; return { calendario: y('OTTOBRE 2026'), weekend: y('WEEKEND E FESTIVIT'), ore: y('ORE DEL MESE') }; });
console.log('pos', JSON.stringify(pos), alto);

// cedi
await p.goto(L + '/demo/turni'); await p.waitForTimeout(2000);
await p.locator('[data-giorno="2026-10-14"]').scrollIntoViewIfNeeded();
await p.evaluate(() => window.scrollBy(0, 220)); await p.waitForTimeout(400);
await shot('giorno');
tap.cedi = await box(p.getByRole('button',{name:'Cedi'}).first());
await p.getByRole('button',{name:'Cedi'}).first().click(); await shot('cedi');
tap.bianchi = await box(p.getByRole('button',{name:'Bianchi Demo',exact:true}));
await p.getByRole('button',{name:'Bianchi Demo',exact:true}).click(); await shot('chiedi');
tap.condividi = await box(p.getByRole('button',{name:'Condividi',exact:true}));

// futuro
await p.goto(L + '/demo/turni'); await p.waitForTimeout(2000);
await p.evaluate(() => window.scrollTo(0, 380)); await p.waitForTimeout(300);
await shot('ottobre-cal');
tap.avanti = await box(p.locator('button[aria-label*="successiv" i]').first());
for (let i=0;i<3;i++){ await p.locator('button[aria-label*="successiv" i]').first().click(); await p.waitForTimeout(400); }
await p.evaluate(() => window.scrollTo(0, 178));
await shot('futuro');

writeFileSync('asset/dati.json', JSON.stringify({ tap, pos, alto }, null, 1));
await b.close();
