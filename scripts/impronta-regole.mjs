// Impronta SHA-256 delle regole Firestore, per accorgersi di regole non pubblicate.
// Uso: node scripts/impronta-regole.mjs scrivi | verifica
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const radice = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fileRegole = resolve(radice, "firebase", "firestore.rules");
const fileImpronta = resolve(radice, "firebase", "regole-pubblicate.sha256");

function impronta() {
  const testo = readFileSync(fileRegole, "utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(testo).digest("hex");
}

const modo = process.argv[2];
if (modo === "scrivi") {
  writeFileSync(fileImpronta, impronta() + "\n");
  console.log("Impronta delle regole pubblicate salvata.");
} else if (modo === "verifica") {
  if (!existsSync(fileImpronta)) {
    console.error("Regole da pubblicare: impronta mancante. Esegui `npm run deploy:regole` in firebase/.");
    process.exit(1);
  }
  if (readFileSync(fileImpronta, "utf8").trim() !== impronta()) {
    console.error("Regole da pubblicare: firestore.rules e' cambiato dopo l'ultimo deploy. Esegui `npm run deploy:regole` in firebase/.");
    process.exit(1);
  }
  console.log("Regole pubblicate: impronta corrispondente.");
} else {
  console.error("Uso: node scripts/impronta-regole.mjs scrivi|verifica");
  process.exit(2);
}
