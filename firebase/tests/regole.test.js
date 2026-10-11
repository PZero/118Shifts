// Test automatici delle regole Firestore (vedi TEST-REGOLE.md).
// Solo dati inventati. Si eseguono con: npm run test:rules
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

const qui = dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = "demo-shifts";
let env;

const T0 = Timestamp.fromDate(new Date("2026-01-01T10:00:00Z"));

function utente(over) {
  return {
    email: "x@example.test",
    nome: "Utente di prova",
    stato: "approvato",
    principale: false,
    delegato: false,
    creatoIl: T0,
    ...over,
  };
}

function medico(nome, attivo = true, principaleUid) {
  const m = { nome, alias: [], attivo, cicloManuale: false };
  if (principaleUid) m.principaleUid = principaleUid;
  return m;
}

function cambio(over = {}) {
  return {
    data: "2026-10-05",
    slot: 0,
    codice: "M6",
    verso: "ceduto",
    collegaId: "medC",
    creatoIl: serverTimestamp(),
    ...over,
  };
}

// Account inventati
const UID = {
  admin: "uidAdmin",
  deleg: "uidDeleg",
  princA: "uidPrincA",
  secA: "uidSecA",
  princC: "uidPrincC",
  attesa: "uidAttesa",
  disab: "uidDisab",
  inatt: "uidInatt",
  nuovo: "uidNuovo",
};

function db(uid, email = `${uid}@example.test`) {
  return env
    .authenticatedContext(uid, { email, email_verified: true })
    .firestore();
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(qui, "../firestore.rules"), "utf8"),
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    const s = (p, d) => setDoc(doc(f, p), d);
    await s("admins/uidAdmin", {});
    await s("medici/medA", medico("Medico A", true, "uidPrincA"));
    await s("medici/medB", medico("Medico B", true, "uidDeleg"));
    await s("medici/medC", medico("Medico C", true, "uidPrincC"));
    await s("medici/medD", medico("Medico D"));
    await s("medici/medX", medico("Medico X", false, "uidInatt"));
    await s("users/uidDeleg", utente({ medicoId: "medB", delegato: true, principale: true }));
    await s("users/uidPrincA", utente({ medicoId: "medA", principale: true }));
    await s("users/uidSecA", utente({ medicoId: "medA" }));
    await s("users/uidPrincC", utente({ medicoId: "medC", principale: true }));
    await s("users/uidAttesa", utente({ stato: "attesa" }));
    await s("users/uidDisab", utente({ stato: "disabilitato", medicoId: "medA" }));
    await s("users/uidInatt", utente({ medicoId: "medX", principale: true }));
    await s("turni/medA/mesi/2026-10", { giorni: { 1: ["M6"] }, importId: "imp1" });
    await s("turni/medB/mesi/2026-10", { giorni: { 2: ["P3"] }, importId: "imp1" });
    await s("turni/medX/mesi/2026-10", { giorni: { 3: ["N1"] }, importId: "imp1" });
    await s("turni/medA/meta/ciclo", { cicloInizio: "2026-10-05", cicloManuale: true });
    await s("turni/medB/meta/ciclo", { cicloManuale: false });
    await s("mesiPubblicati/2026-10", { medici: ["medA", "medB"], caricatoIl: T0, importId: "imp1" });
    await s("cambi/medA/voci/c1", { ...cambio(), creatoIl: T0 });
    await s("elencoMedici/elenco", { medici: [{ id: "medA", nome: "Medico A" }] });
    await s("config/sedi", { 1: "Sede 1" });
  });
});

const turnoValido = { giorni: { 4: ["M2"] }, importId: "imp2", caricatoIl: serverTimestamp() };

describe("Admin", () => {
  it("A1 legge il proprio admins/{uid}", async () => {
    await assertSucceeds(getDoc(doc(db(UID.admin), "admins/uidAdmin")));
  });
  it("A2 non legge admins di altri", async () => {
    await assertFails(getDoc(doc(db(UID.admin), "admins/uidDeleg")));
  });
  it("A3 elenca gli utenti in attesa", async () => {
    const q = query(collection(db(UID.admin), "users"), where("stato", "==", "attesa"));
    await assertSucceeds(getDocs(q));
  });
  it("A4 approva un utente associandolo a un medico", async () => {
    await assertSucceeds(
      updateDoc(doc(db(UID.admin), "users/uidAttesa"), { stato: "approvato", medicoId: "medA" }),
    );
  });
  it("A5 nomina un delegato", async () => {
    await assertSucceeds(updateDoc(doc(db(UID.admin), "users/uidPrincA"), { delegato: true }));
  });
  it("A6 non approva senza medicoId", async () => {
    await assertFails(updateDoc(doc(db(UID.admin), "users/uidAttesa"), { stato: "approvato" }));
  });
  it("A7 legge i turni di un medico", async () => {
    await assertSucceeds(getDoc(doc(db(UID.admin), "turni/medA/mesi/2026-10")));
  });
  it("A8 non crea documenti admins", async () => {
    await assertFails(setDoc(doc(db(UID.admin), "admins/uidPrincA"), {}));
  });
  it("A9 non legge i cambi (privati del medico)", async () => {
    await assertFails(getDoc(doc(db(UID.admin), "cambi/medA/voci/c1")));
  });
  it("A10 non cambia email o creatoIl di un utente", async () => {
    await assertFails(
      updateDoc(doc(db(UID.admin), "users/uidPrincA"), { email: "altro@example.test" }),
    );
  });
});

describe("Delegato", () => {
  const d = () => db(UID.deleg);
  it("D1 elenca gli utenti", async () => {
    await assertSucceeds(getDocs(collection(d(), "users")));
  });
  it("D2 approva un utente in attesa", async () => {
    await assertSucceeds(
      updateDoc(doc(d(), "users/uidAttesa"), { stato: "approvato", medicoId: "medA" }),
    );
  });
  it("D2b disabilita un account", async () => {
    await assertSucceeds(updateDoc(doc(d(), "users/uidSecA"), { stato: "disabilitato" }));
  });
  it("D3 non nomina delegati", async () => {
    await assertFails(updateDoc(doc(d(), "users/uidPrincA"), { delegato: true }));
  });
  it("D4 non modifica stato o principale del proprio account", async () => {
    await assertFails(updateDoc(doc(d(), "users/uidDeleg"), { stato: "attesa" }));
    await assertFails(updateDoc(doc(d(), "users/uidDeleg"), { principale: false }));
  });
  it("D5 non modifica un altro delegato", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), "users/uidDeleg2"), utente({ medicoId: "medC", delegato: true })),
    );
    await assertFails(updateDoc(doc(d(), "users/uidDeleg2"), { stato: "disabilitato" }));
  });
  it("D6 scrive i turni", async () => {
    await assertSucceeds(setDoc(doc(d(), "turni/medA/mesi/2026-11"), turnoValido));
  });
  it("D6b non scrive turni con mese malformato o campi extra", async () => {
    await assertFails(setDoc(doc(d(), "turni/medA/mesi/2026-13"), turnoValido));
    await assertFails(setDoc(doc(d(), "turni/medA/mesi/2026-11"), { ...turnoValido, extra: 1 }));
  });
  it("D7 scrive l'anagrafica medici", async () => {
    await assertSucceeds(setDoc(doc(d(), "medici/medA"), medico("Medico A bis", true, "uidPrincA")));
  });
  it("D7b non scrive un medico con campi non validi", async () => {
    await assertFails(setDoc(doc(d(), "medici/medA"), { ...medico("A"), attivo: "si" }));
  });
  it("D8 non legge i cambi di un altro medico", async () => {
    await assertFails(getDoc(doc(d(), "cambi/medA/voci/c1")));
  });
  it("D9 crea un'importazione solo a proprio nome", async () => {
    const imp = { data: T0, mesi: ["2026-10"], avvisi: [] };
    await assertSucceeds(setDoc(doc(d(), "importazioni/i1"), { ...imp, autoreUid: UID.deleg }));
    await assertFails(setDoc(doc(d(), "importazioni/i2"), { ...imp, autoreUid: UID.admin }));
  });
  it("D10 scrive config/sedi ed elencoMedici", async () => {
    await assertSucceeds(setDoc(doc(d(), "config/sedi"), { 1: "Sede Uno" }));
    await assertSucceeds(setDoc(doc(d(), "elencoMedici/elenco"), { medici: [] }));
  });
});

describe("Medico principale", () => {
  const p = () => db(UID.princA);
  it("P1 legge i propri turni", async () => {
    await assertSucceeds(getDoc(doc(p(), "turni/medA/mesi/2026-10")));
  });
  it("P2 non legge i turni di un altro medico", async () => {
    await assertFails(getDoc(doc(p(), "turni/medB/mesi/2026-10")));
  });
  it("P3 crea un cambio valido", async () => {
    await assertSucceeds(setDoc(doc(p(), "cambi/medA/voci/n1"), cambio()));
  });
  it("P3b modifica ed elimina un proprio cambio", async () => {
    await assertSucceeds(updateDoc(doc(p(), "cambi/medA/voci/c1"), { slot: 1 }));
    await assertSucceeds(deleteDoc(doc(p(), "cambi/medA/voci/c1")));
  });
  it("P4 non crea un cambio con sé stesso", async () => {
    await assertFails(setDoc(doc(p(), "cambi/medA/voci/n1"), cambio({ collegaId: "medA" })));
  });
  it("P5 non crea un cambio con collega inesistente", async () => {
    await assertFails(setDoc(doc(p(), "cambi/medA/voci/n1"), cambio({ collegaId: "medZ" })));
  });
  it("P6 non crea cambi con campi non validi", async () => {
    await assertFails(setDoc(doc(p(), "cambi/medA/voci/n1"), cambio({ slot: 2 })));
    await assertFails(setDoc(doc(p(), "cambi/medA/voci/n2"), cambio({ verso: "altro" })));
    await assertFails(setDoc(doc(p(), "cambi/medA/voci/n3"), cambio({ data: "05/10/2026" })));
    await assertFails(setDoc(doc(p(), "cambi/medA/voci/n4"), cambio({ extra: true })));
    await assertFails(setDoc(doc(p(), "cambi/medA/voci/n5"), cambio({ creatoIl: T0 })));
  });
  it("P7 non crea cambi di un altro medico", async () => {
    await assertFails(setDoc(doc(p(), "cambi/medB/voci/n1"), cambio()));
  });
  it("P8 modifica il proprio nome", async () => {
    await assertSucceeds(updateDoc(doc(p(), "users/uidPrincA"), { nome: "Nuovo nome" }));
  });
  it("P9 non modifica i propri campi riservati", async () => {
    const u = doc(p(), "users/uidPrincA");
    await assertFails(updateDoc(u, { stato: "attesa" }));
    await assertFails(updateDoc(u, { medicoId: "medB" }));
    await assertFails(updateDoc(u, { principale: false }));
    await assertFails(updateDoc(u, { delegato: true }));
  });
  it("P10 non scrive i turni", async () => {
    await assertFails(setDoc(doc(p(), "turni/medA/mesi/2026-10"), turnoValido));
  });
  it("P11 non elenca utenti né legge medici", async () => {
    await assertFails(getDocs(collection(p(), "users")));
    await assertFails(getDoc(doc(p(), "medici/medA")));
  });
  it("P12 legge elenco medici e sedi", async () => {
    await assertSucceeds(getDoc(doc(p(), "elencoMedici/elenco")));
    await assertSucceeds(getDoc(doc(p(), "config/sedi")));
  });
  it("P13 non scrive elenco medici e sedi", async () => {
    await assertFails(setDoc(doc(p(), "config/sedi"), { 1: "X" }));
    await assertFails(setDoc(doc(p(), "elencoMedici/elenco"), { medici: [] }));
  });
});

describe("Medico secondario", () => {
  const s = () => db(UID.secA);
  it("S1 legge i turni del proprio medico", async () => {
    await assertSucceeds(getDoc(doc(s(), "turni/medA/mesi/2026-10")));
  });
  it("S2 legge i cambi del proprio medico", async () => {
    await assertSucceeds(getDoc(doc(s(), "cambi/medA/voci/c1")));
    await assertSucceeds(getDocs(collection(s(), "cambi/medA/voci")));
  });
  it("S3 non crea, modifica o elimina cambi", async () => {
    await assertFails(setDoc(doc(s(), "cambi/medA/voci/n1"), cambio()));
    await assertFails(updateDoc(doc(s(), "cambi/medA/voci/c1"), { slot: 1 }));
    await assertFails(deleteDoc(doc(s(), "cambi/medA/voci/c1")));
  });
  it("S4 non si promuove a principale", async () => {
    await assertFails(updateDoc(doc(s(), "users/uidSecA"), { principale: true }));
  });
});

describe("Account in attesa", () => {
  const w = () => db(UID.attesa);
  it("W1 legge il proprio users", async () => {
    await assertSucceeds(getDoc(doc(w(), "users/uidAttesa")));
  });
  it("W2 non si autoapprova", async () => {
    await assertFails(updateDoc(doc(w(), "users/uidAttesa"), { stato: "approvato", medicoId: "medA" }));
  });
  it("W3 non si associa a un medico", async () => {
    await assertFails(updateDoc(doc(w(), "users/uidAttesa"), { medicoId: "medA" }));
  });
  it("W4 non legge turni, elenco medici e sedi", async () => {
    await assertFails(getDoc(doc(w(), "turni/medA/mesi/2026-10")));
    await assertFails(getDoc(doc(w(), "elencoMedici/elenco")));
    await assertFails(getDoc(doc(w(), "config/sedi")));
  });
  it("W5 non legge il users di altri", async () => {
    await assertFails(getDoc(doc(w(), "users/uidPrincA")));
  });
});

describe("Primo accesso", () => {
  const n = () => db(UID.nuovo, "nuovo@example.test");
  const nuovo = (over = {}) => ({
    email: "nuovo@example.test",
    nome: "Nuovo Utente",
    stato: "attesa",
    principale: false,
    delegato: false,
    creatoIl: serverTimestamp(),
    ...over,
  });
  it("N1 crea il proprio users in attesa", async () => {
    await assertSucceeds(setDoc(doc(n(), "users/uidNuovo"), nuovo()));
  });
  it("N2 non si crea già approvato", async () => {
    await assertFails(setDoc(doc(n(), "users/uidNuovo"), nuovo({ stato: "approvato", medicoId: "medA" })));
  });
  it("N3 non si crea delegato o principale", async () => {
    await assertFails(setDoc(doc(n(), "users/uidNuovo"), nuovo({ delegato: true })));
    await assertFails(setDoc(doc(n(), "users/uidNuovo"), nuovo({ principale: true })));
  });
  it("N4 non si crea con medicoId", async () => {
    await assertFails(setDoc(doc(n(), "users/uidNuovo"), nuovo({ medicoId: "medA" })));
  });
  it("N5 non usa un'email diversa da quella del token", async () => {
    await assertFails(setDoc(doc(n(), "users/uidNuovo"), nuovo({ email: "altro@example.test" })));
  });
  it("N6 non crea il users di un altro uid", async () => {
    await assertFails(setDoc(doc(n(), "users/altroUid"), nuovo()));
  });
  it("N7 non crea con email non verificata", async () => {
    const f = env
      .authenticatedContext(UID.nuovo, { email: "nuovo@example.test", email_verified: false })
      .firestore();
    await assertFails(setDoc(doc(f, "users/uidNuovo"), nuovo()));
  });
  it("N8 un utente esistente non si ricrea il documento", async () => {
    await assertFails(
      setDoc(doc(db(UID.attesa), "users/uidAttesa"), {
        ...nuovo(),
        email: "uidAttesa@example.test",
      }),
    );
  });
});

describe("Disabilitato e medico non attivo", () => {
  for (const [nome, uid, medicoId, escalation] of [
    ["disabilitato", UID.disab, "medA", { stato: "approvato" }],
    ["medico non attivo", UID.inatt, "medX", { medicoId: "medA" }],
  ]) {
    it(`X1 ${nome}: legge il proprio users`, async () => {
      await assertSucceeds(getDoc(doc(db(uid), `users/${uid}`)));
    });
    it(`X2 ${nome}: non legge i turni`, async () => {
      await assertFails(getDoc(doc(db(uid), `turni/${medicoId}/mesi/2026-10`)));
    });
    it(`X3 ${nome}: non legge cambi ed elenco medici`, async () => {
      await assertFails(getDoc(doc(db(uid), `cambi/${medicoId}/voci/c1`)));
      await assertFails(getDoc(doc(db(uid), "elencoMedici/elenco")));
    });
    it(`X4 ${nome}: non si riattiva`, async () => {
      await assertFails(updateDoc(doc(db(uid), `users/${uid}`), escalation));
    });
  }
  it("X5 medico non attivo: non scrive cambi anche se principale", async () => {
    await assertFails(setDoc(doc(db(UID.inatt), "cambi/medX/voci/n1"), cambio()));
  });
});

describe("Estraneo e non autenticato", () => {
  const e = () => db(UID.princC);
  it("E1 non legge i turni di un altro medico", async () => {
    await assertFails(getDoc(doc(e(), "turni/medA/mesi/2026-10")));
  });
  it("E2 non legge né scrive i cambi di un altro medico", async () => {
    await assertFails(getDoc(doc(e(), "cambi/medA/voci/c1")));
    await assertFails(getDocs(collection(e(), "cambi/medA/voci")));
    await assertFails(setDoc(doc(e(), "cambi/medA/voci/n1"), cambio({ collegaId: "medB" })));
  });
  it("E3 non legge il users di altri", async () => {
    await assertFails(getDoc(doc(e(), "users/uidPrincA")));
  });
  it("E4 non autenticato: tutto negato", async () => {
    const f = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(f, "users/uidPrincA")));
    await assertFails(getDoc(doc(f, "turni/medA/mesi/2026-10")));
    await assertFails(getDoc(doc(f, "config/sedi")));
    await assertFails(setDoc(doc(f, "users/anonimo"), { stato: "attesa" }));
  });
  it("E5 raccolta non prevista: negata anche all'admin", async () => {
    await assertFails(getDoc(doc(db(UID.admin), "prova/x")));
    await assertFails(setDoc(doc(db(UID.admin), "prova/x"), { a: 1 }));
  });
});

describe("Unico account principale per medico", () => {
  const a = () => db(UID.admin);
  const passaggio = (f) => {
    const b = writeBatch(f);
    b.update(doc(f, "medici/medA"), { principaleUid: UID.secA });
    b.update(doc(f, "users/uidSecA"), { principale: true });
    b.update(doc(f, "users/uidPrincA"), { principale: false });
    return b;
  };
  it("Q1 secondo principale sullo stesso medico: negato", async () => {
    await assertFails(updateDoc(doc(a(), "users/uidSecA"), { principale: true }));
  });
  it("Q2 passaggio di principale in batch (medico, nuovo, ex): consentito", async () => {
    await assertSucceeds(passaggio(a()).commit());
  });
  it("Q3 passaggio senza togliere il flag all'ex principale: negato", async () => {
    const f = a();
    const b = writeBatch(f);
    b.update(doc(f, "medici/medA"), { principaleUid: UID.secA });
    b.update(doc(f, "users/uidSecA"), { principale: true });
    await assertFails(b.commit());
  });
  it("Q4 principaleUid cambiato da solo: negato", async () => {
    await assertFails(updateDoc(doc(a(), "medici/medA"), { principaleUid: UID.secA }));
  });
  it("Q5 dopo il passaggio l'ex principale non scrive cambi, il nuovo sì", async () => {
    await passaggio(a()).commit();
    await assertFails(setDoc(doc(db(UID.princA), "cambi/medA/voci/n1"), cambio()));
    await assertSucceeds(setDoc(doc(db(UID.secA), "cambi/medA/voci/n2"), cambio()));
  });
  it("Q6 flag principale incoerente (scritto da console): cambi negati", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      updateDoc(doc(ctx.firestore(), "users/uidSecA"), { principale: true }),
    );
    await assertFails(setDoc(doc(db(UID.secA), "cambi/medA/voci/n1"), cambio()));
  });
  it("Q7 approvazione come principale di un medico senza principale (batch): consentita", async () => {
    const f = db(UID.deleg);
    const b = writeBatch(f);
    b.update(doc(f, "medici/medD"), { principaleUid: UID.attesa });
    b.update(doc(f, "users/uidAttesa"), { stato: "approvato", medicoId: "medD", principale: true });
    await assertSucceeds(b.commit());
  });
  it("Q8 approvazione come principale senza aggiornare il medico: negata", async () => {
    await assertFails(
      updateDoc(doc(db(UID.deleg), "users/uidAttesa"), {
        stato: "approvato",
        medicoId: "medD",
        principale: true,
      }),
    );
  });
  it("Q9 togliere il flag al principale gli toglie la scrittura dei cambi", async () => {
    await assertSucceeds(updateDoc(doc(a(), "users/uidPrincA"), { principale: false }));
    await assertFails(setDoc(doc(db(UID.princA), "cambi/medA/voci/n1"), cambio()));
  });
  it("Q10 delegato che è medico gestisce i propri cambi", async () => {
    await assertSucceeds(setDoc(doc(db(UID.deleg), "cambi/medB/voci/n1"), cambio()));
    await assertSucceeds(getDocs(collection(db(UID.deleg), "cambi/medB/voci")));
  });
});

// ---------- Import: indice mesi, caricatoIl, ciclo ----------
const indiceValido = () => ({ medici: ["medA"], caricatoIl: serverTimestamp(), importId: "imp3" });

describe("Indice mesiPubblicati", () => {
  it("I1 admin e delegato leggono e scrivono l'indice", async () => {
    await assertSucceeds(getDoc(doc(db(UID.admin), "mesiPubblicati/2026-10")));
    await assertSucceeds(setDoc(doc(db(UID.admin), "mesiPubblicati/2026-11"), indiceValido()));
    await assertSucceeds(getDoc(doc(db(UID.deleg), "mesiPubblicati/2026-10")));
    await assertSucceeds(setDoc(doc(db(UID.deleg), "mesiPubblicati/2026-10"), indiceValido()));
  });
  it("I2 principale e secondario non leggono ne' scrivono l'indice", async () => {
    for (const u of [UID.princA, UID.secA]) {
      await assertFails(getDoc(doc(db(u), "mesiPubblicati/2026-10")));
      await assertFails(getDocs(collection(db(u), "mesiPubblicati")));
      await assertFails(setDoc(doc(db(u), "mesiPubblicati/2026-11"), indiceValido()));
      await assertFails(deleteDoc(doc(db(u), "mesiPubblicati/2026-10")));
    }
  });
  it("I3 non autenticato e account in attesa: negato", async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "mesiPubblicati/2026-10")));
    await assertFails(getDoc(doc(db(UID.attesa), "mesiPubblicati/2026-10")));
  });
  it("I4 validazione campi: mese, extra, caricatoIl falso, medici non lista", async () => {
    const d = db(UID.admin);
    await assertFails(setDoc(doc(d, "mesiPubblicati/2026-13"), indiceValido()));
    await assertFails(setDoc(doc(d, "mesiPubblicati/2026-11"), { ...indiceValido(), extra: 1 }));
    await assertFails(setDoc(doc(d, "mesiPubblicati/2026-11"), { ...indiceValido(), caricatoIl: T0 }));
    await assertFails(setDoc(doc(d, "mesiPubblicati/2026-11"), { ...indiceValido(), medici: "medA" }));
    await assertFails(setDoc(doc(d, "mesiPubblicati/2026-11"), { medici: ["medA"], importId: "x" }));
  });
  it("I5 il delegato cancella un indice", async () => {
    await assertSucceeds(deleteDoc(doc(db(UID.deleg), "mesiPubblicati/2026-10")));
  });
});

describe("Sostituzione del mese e caricatoIl", () => {
  it("M1 il delegato e l'admin cancellano e sovrascrivono i mesi", async () => {
    await assertSucceeds(deleteDoc(doc(db(UID.deleg), "turni/medA/mesi/2026-10")));
    await assertSucceeds(setDoc(doc(db(UID.admin), "turni/medB/mesi/2026-10"), turnoValido));
  });
  it("M2 medico e secondario non cancellano i mesi", async () => {
    await assertFails(deleteDoc(doc(db(UID.princA), "turni/medA/mesi/2026-10")));
    await assertFails(deleteDoc(doc(db(UID.secA), "turni/medA/mesi/2026-10")));
  });
  it("M3 caricatoIl obbligatorio e uguale all'ora server", async () => {
    const d = db(UID.deleg);
    await assertFails(setDoc(doc(d, "turni/medA/mesi/2026-11"), { giorni: {}, importId: "i" }));
    await assertFails(setDoc(doc(d, "turni/medA/mesi/2026-11"), { ...turnoValido, caricatoIl: T0 }));
  });
  it("M4 il medico legge il proprio mese (con caricatoIl)", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), "turni/medA/mesi/2026-12"), { giorni: {}, importId: "i", caricatoIl: T0 }),
    );
    const s = await assertSucceeds(getDoc(doc(db(UID.princA), "turni/medA/mesi/2026-12")));
    if (!s.data().caricatoIl) throw new Error("caricatoIl mancante");
  });
  it("M5 batch atomica: mese + indice + cancellazione di un altro medico", async () => {
    const d = db(UID.admin);
    const b = writeBatch(d);
    b.set(doc(d, "turni/medA/mesi/2026-11"), turnoValido);
    b.delete(doc(d, "turni/medB/mesi/2026-10"));
    b.set(doc(d, "mesiPubblicati/2026-11"), indiceValido());
    await assertSucceeds(b.commit());
  });
});

describe("Ciclo leggibile dal medico (turni/{medico}/meta/ciclo)", () => {
  const ciclo = { cicloInizio: "2026-10-12", cicloManuale: true };
  it("C1 principale e secondario leggono il proprio ciclo", async () => {
    await assertSucceeds(getDoc(doc(db(UID.princA), "turni/medA/meta/ciclo")));
    await assertSucceeds(getDoc(doc(db(UID.secA), "turni/medA/meta/ciclo")));
  });
  it("C2 non leggono il ciclo di un altro medico", async () => {
    await assertFails(getDoc(doc(db(UID.princA), "turni/medB/meta/ciclo")));
    await assertFails(getDoc(doc(db(UID.secA), "turni/medC/meta/ciclo")));
  });
  it("C3 il medico non scrive ne' cancella il ciclo", async () => {
    await assertFails(setDoc(doc(db(UID.princA), "turni/medA/meta/ciclo"), ciclo));
    await assertFails(setDoc(doc(db(UID.secA), "turni/medA/meta/ciclo"), ciclo));
    await assertFails(deleteDoc(doc(db(UID.princA), "turni/medA/meta/ciclo")));
  });
  it("C4 admin e delegato scrivono il ciclo", async () => {
    await assertSucceeds(setDoc(doc(db(UID.admin), "turni/medA/meta/ciclo"), ciclo));
    await assertSucceeds(setDoc(doc(db(UID.deleg), "turni/medC/meta/ciclo"), { cicloManuale: false }));
  });
  it("C5 validazione: data malformata, campi extra, altro documento meta", async () => {
    const d = db(UID.admin);
    await assertFails(setDoc(doc(d, "turni/medA/meta/ciclo"), { cicloInizio: "5/10", cicloManuale: true }));
    await assertFails(setDoc(doc(d, "turni/medA/meta/ciclo"), { ...ciclo, extra: 1 }));
    await assertFails(setDoc(doc(d, "turni/medA/meta/ciclo"), { cicloInizio: "2026-10-12" }));
    await assertFails(setDoc(doc(d, "turni/medA/meta/altro"), ciclo));
  });
  it("C6 account in attesa, disabilitato e non autenticato non leggono il ciclo", async () => {
    await assertFails(getDoc(doc(db(UID.attesa), "turni/medA/meta/ciclo")));
    await assertFails(getDoc(doc(db(UID.disab), "turni/medA/meta/ciclo")));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "turni/medA/meta/ciclo")));
  });
  it("C7 batch atomica medici + ciclo", async () => {
    const d = db(UID.admin);
    const b = writeBatch(d);
    b.update(doc(d, "medici/medA"), { cicloInizio: "2026-10-12", cicloManuale: true });
    b.set(doc(d, "turni/medA/meta/ciclo"), ciclo);
    await assertSucceeds(b.commit());
  });
});
