# app

PWA Vite + React + TypeScript (strict). Test con Vitest.

```
npm install
npm test        # test della logica in src/domain
npm run build
```

## src/domain
Logica pura (niente React/Firebase): codici turno, parser Excel, anagrafica, ore, festività, proiezione.
I test usano solo un workbook fittizio generato in codice (`src/domain/test/workbookFittizio.ts`): mai dati reali.

## SheetJS
`xlsx` è installato dal CDN ufficiale SheetJS (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`),
non dal registro npm: lì il pacchetto è fermo alla 0.18.5, con vulnerabilità note
(CVE-2023-30533, CVE-2024-22363) corrette solo nelle versioni distribuite dal CDN.
Per aggiornare: `npm install https://cdn.sheetjs.com/xlsx-<versione>/xlsx-<versione>.tgz`.
