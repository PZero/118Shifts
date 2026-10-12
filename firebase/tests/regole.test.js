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
  it("P8b ultimoAccesso: solo proprio uid con request.time", async () => {
    const u = doc(p(), "users/uidPrincA");
    await assertSucceeds(updateDoc(u, { ultimoAccesso: serverTimestamp() }));
    await assertFails(updateDoc(u, { ultimoAccesso: T0 }));
    await assertFails(updateDoc(u, { ultimoAccesso: serverTimestamp(), stato: "attesa" }));
    await assertFails(updateDoc(doc(p(), "users/uidSecA"), { ultimoAccesso: serverTimestamp() }));
  });
  it("P8c ultimoAccesso: anche in attesa; admin modifica un utente che lo ha gia'", async () => {
    await assertSucceeds(updateDoc(doc(db(UID.attesa), "users/uidAttesa"), { ultimoAccesso: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db(UID.admin), "users/uidAttesa"), { nome: "Altro nome" }));
    await assertSucceeds(
      updateDoc(doc(db(UID.admin), "users/uidAttesa"), { stato: "approvato", medicoId: "medD" }),
    );
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

// ---------- Quadro mensile ----------
const quadroValido = () => ({ giorni: { 1: { medA: ["M6"] } }, importId: "imp4", caricatoIl: serverTimestamp() });

describe("Quadro mensile", () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "quadro/2026-10"), { giorni: { 1: { medA: ["M6"] } }, importId: "imp1", caricatoIl: T0 });
    });
  });
  it("Q1 principale legge, anche il delegato (staff) e l'admin", async () => {
    for (const u of [UID.princA, UID.princC, UID.deleg, UID.admin]) {
      await assertSucceeds(getDoc(doc(db(u), "quadro/2026-10")));
    }
  });
  it("Q2 secondario, attesa, disabilitato, medico non attivo, anonimo: negato", async () => {
    for (const u of [UID.secA, UID.attesa, UID.disab, UID.inatt]) {
      await assertFails(getDoc(doc(db(u), "quadro/2026-10")));
    }
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "quadro/2026-10")));
  });
  it("Q3 admin e delegato scrivono e cancellano", async () => {
    await assertSucceeds(setDoc(doc(db(UID.admin), "quadro/2026-11"), quadroValido()));
    await assertSucceeds(setDoc(doc(db(UID.deleg), "quadro/2026-10"), quadroValido()));
    await assertSucceeds(deleteDoc(doc(db(UID.deleg), "quadro/2026-10")));
  });
  it("Q4 medico principale e secondario non scrivono ne' cancellano", async () => {
    for (const u of [UID.princA, UID.secA]) {
      await assertFails(setDoc(doc(db(u), "quadro/2026-11"), quadroValido()));
      await assertFails(deleteDoc(doc(db(u), "quadro/2026-10")));
    }
  });
  it("Q5 validazione: caricatoIl falso, id malformato, extra, tipi", async () => {
    const d = db(UID.admin);
    await assertFails(setDoc(doc(d, "quadro/2026-11"), { ...quadroValido(), caricatoIl: T0 }));
    await assertFails(setDoc(doc(d, "quadro/2026-13"), quadroValido()));
    await assertFails(setDoc(doc(d, "quadro/26-10"), quadroValido()));
    await assertFails(setDoc(doc(d, "quadro/2026-11"), { ...quadroValido(), extra: 1 }));
    await assertFails(setDoc(doc(d, "quadro/2026-11"), { ...quadroValido(), giorni: [] }));
    await assertFails(setDoc(doc(d, "quadro/2026-11"), { ...quadroValido(), importId: 5 }));
  });
});

// ---------- Feedback e presentazione ----------
describe("Feedback (chat medico-admin)", () => {
  const conv = (uid, over = {}) => ({
    autoreUid: uid, autoreNome: "Medico Prova", argomento: "Un problema",
    creatoIl: serverTimestamp(), aggiornatoIl: serverTimestamp(),
    ultimoTesto: "ciao", nonLettoAdmin: true, nonLettoUtente: false, ...over,
  });
  const msg = (uid, over = {}) => ({
    testo: "ciao", daAdmin: false, autoreUid: uid, convAutoreUid: uid,
    creatoIl: serverTimestamp(), ...over,
  });
  async function seed() {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const f = ctx.firestore();
      for (const u of [UID.princA, UID.secA, UID.deleg]) {
        await setDoc(doc(f, `feedback/c_${u}`), conv(u, { creatoIl: T0, aggiornatoIl: T0 }));
        await setDoc(doc(f, `feedback/c_${u}/messaggi/m1`), msg(u, { creatoIl: T0 }));
      }
      // messaggio orfano (conversazione assente)
      await setDoc(doc(f, "feedback/orfana/messaggi/m1"), msg(UID.princA, { creatoIl: T0 }));
    });
  }

  it("F1 creazione conversazione + primo messaggio in batch: principale, secondario, delegato", async () => {
    for (const u of [UID.princA, UID.secA, UID.deleg]) {
      const d = db(u);
      const b = writeBatch(d);
      b.set(doc(d, `feedback/n_${u}`), conv(u));
      b.set(doc(d, `feedback/n_${u}/messaggi/m1`), msg(u));
      await assertSucceeds(b.commit());
    }
  });
  it("F2 creazione negata: attesa, disabilitato, medico non attivo, anonimo, admin, altro uid", async () => {
    for (const u of [UID.attesa, UID.disab, UID.inatt, UID.admin]) {
      await assertFails(setDoc(doc(db(u), "feedback/x"), conv(u)));
    }
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), "feedback/x"), conv(UID.princA)));
    await assertFails(setDoc(doc(db(UID.princA), "feedback/x"), conv(UID.secA)));
  });
  it("F3 creazione: campi non validi", async () => {
    const d = db(UID.princA);
    const casi = [
      { nonLettoAdmin: false }, { nonLettoUtente: true }, { aggiornatoIl: T0 }, { creatoIl: T0 },
      { argomento: "" }, { argomento: "x".repeat(81) }, { autoreNome: "" }, { ultimoTesto: "x".repeat(121) },
      { extra: 1 }, { argomento: 5 },
    ];
    for (const [i, c] of casi.entries()) {
      await assertFails(setDoc(doc(d, `feedback/bad${i}`), conv(UID.princA, c)));
    }
  });
  it("F4 lettura: titolare (principale, secondario, delegato come medico) e admin; query del medico", async () => {
    await seed();
    for (const u of [UID.princA, UID.secA, UID.deleg]) {
      await assertSucceeds(getDoc(doc(db(u), `feedback/c_${u}`)));
      await assertSucceeds(getDocs(query(collection(db(u), "feedback"), where("autoreUid", "==", u))));
      await assertSucceeds(getDocs(collection(db(u), `feedback/c_${u}/messaggi`)));
      await assertSucceeds(getDocs(query(collection(db(u), `feedback/c_${u}/messaggi`), where("convAutoreUid", "==", u))));
    }
    await assertSucceeds(getDocs(collection(db(UID.admin), "feedback")));
    await assertSucceeds(getDocs(collection(db(UID.admin), `feedback/c_${UID.princA}/messaggi`)));
  });
  it("F5 lettura negata: delegato su chat altrui, altri medici, attesa, disabilitato, anonimo", async () => {
    await seed();
    const t = `feedback/c_${UID.princA}`;
    for (const u of [UID.deleg, UID.secA, UID.princC, UID.attesa, UID.disab, UID.inatt]) {
      await assertFails(getDoc(doc(db(u), t)));
      await assertFails(getDoc(doc(db(u), `${t}/messaggi/m1`)));
      await assertFails(getDocs(collection(db(u), "feedback")));
    }
    await assertFails(getDocs(query(collection(db(UID.deleg), "feedback"), where("autoreUid", "==", UID.princA))));
    await assertFails(getDocs(collection(db(UID.deleg), `${t}/messaggi`)));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), t)));
  });
  it("F6 account disabilitato non legge nemmeno le proprie chat", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "feedback/d1"), conv(UID.disab, { creatoIl: T0, aggiornatoIl: T0 }));
    });
    await assertFails(getDoc(doc(db(UID.disab), "feedback/d1")));
  });
  it("F7 update conversazione: titolare", async () => {
    await seed();
    const r = doc(db(UID.princA), `feedback/c_${UID.princA}`);
    await assertSucceeds(updateDoc(r, { aggiornatoIl: serverTimestamp(), ultimoTesto: "nuovo", nonLettoAdmin: true }));
    await assertFails(updateDoc(r, { nonLettoAdmin: false }));
    await assertFails(updateDoc(r, { nonLettoUtente: true }));
    await assertFails(updateDoc(r, { argomento: "altro" }));
    await assertFails(updateDoc(r, { autoreUid: UID.secA }));
    await assertFails(updateDoc(r, { autoreNome: "Z" }));
    await assertFails(updateDoc(r, { creatoIl: serverTimestamp() }));
    await assertFails(updateDoc(r, { aggiornatoIl: T0 }));
    await assertFails(updateDoc(r, { ultimoTesto: "senza data" }));
    await assertFails(updateDoc(r, { ultimoTesto: "x".repeat(121), aggiornatoIl: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(UID.secA), `feedback/c_${UID.princA}`), { nonLettoAdmin: true, aggiornatoIl: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(UID.deleg), `feedback/c_${UID.princA}`), { nonLettoAdmin: true, aggiornatoIl: serverTimestamp() }));
  });
  it("F8 update conversazione: titolare azzera il proprio flag senza toccare aggiornatoIl", async () => {
    await seed();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), `feedback/c_${UID.secA}`), { nonLettoUtente: true });
    });
    await assertSucceeds(updateDoc(doc(db(UID.secA), `feedback/c_${UID.secA}`), { nonLettoUtente: false }));
  });
  it("F9 update conversazione: admin simmetrico", async () => {
    await seed();
    const r = doc(db(UID.admin), `feedback/c_${UID.princA}`);
    await assertSucceeds(updateDoc(r, { aggiornatoIl: serverTimestamp(), ultimoTesto: "risposta", nonLettoUtente: true }));
    await assertSucceeds(updateDoc(r, { nonLettoAdmin: false }));
    await assertFails(updateDoc(r, { nonLettoUtente: false }));
    await assertFails(updateDoc(r, { nonLettoAdmin: true }));
    await assertFails(updateDoc(r, { argomento: "altro" }));
    await assertFails(updateDoc(r, { autoreUid: UID.admin }));
    await assertFails(updateDoc(r, { ultimoTesto: "senza data" }));
  });
  it("F10 messaggi: aggiunta del titolare e dell'admin su conversazione esistente (batch)", async () => {
    await seed();
    const t = `feedback/c_${UID.princA}`;
    let d = db(UID.princA);
    let b = writeBatch(d);
    b.set(doc(d, `${t}/messaggi/m2`), msg(UID.princA));
    b.update(doc(d, t), { aggiornatoIl: serverTimestamp(), ultimoTesto: "ciao", nonLettoAdmin: true });
    await assertSucceeds(b.commit());
    d = db(UID.admin);
    b = writeBatch(d);
    b.set(doc(d, `${t}/messaggi/m3`), msg(UID.admin, { daAdmin: true, convAutoreUid: UID.princA }));
    b.update(doc(d, t), { aggiornatoIl: serverTimestamp(), ultimoTesto: "r", nonLettoUtente: true });
    await assertSucceeds(b.commit());
  });
  it("F11 messaggi: spoofing e campi non validi", async () => {
    await seed();
    const t = `feedback/c_${UID.princA}`;
    const p = db(UID.princA);
    await assertFails(setDoc(doc(p, `${t}/messaggi/x1`), msg(UID.princA, { daAdmin: true })));
    await assertFails(setDoc(doc(p, `${t}/messaggi/x2`), msg(UID.secA)));
    await assertFails(setDoc(doc(p, `${t}/messaggi/x3`), msg(UID.princA, { convAutoreUid: UID.secA })));
    await assertFails(setDoc(doc(p, `${t}/messaggi/x4`), msg(UID.princA, { testo: "" })));
    await assertFails(setDoc(doc(p, `${t}/messaggi/x5`), msg(UID.princA, { testo: "x".repeat(1001) })));
    await assertFails(setDoc(doc(p, `${t}/messaggi/x6`), msg(UID.princA, { creatoIl: T0 })));
    await assertFails(setDoc(doc(p, `${t}/messaggi/x7`), msg(UID.princA, { extra: 1 })));
    await assertFails(setDoc(doc(db(UID.admin), `${t}/messaggi/x8`), msg(UID.admin, { daAdmin: false, convAutoreUid: UID.princA })));
    await assertFails(setDoc(doc(db(UID.admin), `${t}/messaggi/x9`), msg(UID.princA, { daAdmin: true, convAutoreUid: UID.princA })));
    for (const u of [UID.deleg, UID.secA, UID.attesa, UID.disab]) {
      await assertFails(setDoc(doc(db(u), `${t}/messaggi/y`), msg(u, { convAutoreUid: UID.princA })));
      await assertFails(setDoc(doc(db(u), `${t}/messaggi/y`), msg(u)));
    }
    await assertFails(setDoc(doc(p, "feedback/nulla/messaggi/z"), msg(UID.princA)));
    await assertFails(setDoc(doc(db(UID.admin), "feedback/nulla/messaggi/z"), msg(UID.admin, { daAdmin: true, convAutoreUid: UID.princA })));
  });
  it("F12 messaggi: nessun update", async () => {
    await seed();
    const t = `feedback/c_${UID.princA}/messaggi/m1`;
    await assertFails(updateDoc(doc(db(UID.princA), t), { testo: "x" }));
    await assertFails(updateDoc(doc(db(UID.admin), t), { testo: "x" }));
  });
  it("F13 cancellazione: messaggi poi conversazione; titolare e admin; orfani", async () => {
    await seed();
    const t = `feedback/c_${UID.princA}`;
    const p = db(UID.princA);
    await assertSucceeds(deleteDoc(doc(p, `${t}/messaggi/m1`)));
    await assertSucceeds(deleteDoc(doc(p, t)));
    await assertSucceeds(deleteDoc(doc(p, "feedback/orfana/messaggi/m1")));
    await assertSucceeds(deleteDoc(doc(db(UID.admin), `feedback/c_${UID.secA}/messaggi/m1`)));
    await assertSucceeds(deleteDoc(doc(db(UID.admin), `feedback/c_${UID.secA}`)));
  });
  it("F14 cancellazione negata: delegato, altro medico, disabilitato, attesa, anonimo", async () => {
    await seed();
    const t = `feedback/c_${UID.princA}`;
    for (const u of [UID.deleg, UID.secA, UID.disab, UID.attesa]) {
      await assertFails(deleteDoc(doc(db(u), t)));
      await assertFails(deleteDoc(doc(db(u), `${t}/messaggi/m1`)));
      await assertFails(deleteDoc(doc(db(u), "feedback/orfana/messaggi/m1")));
    }
    await assertFails(deleteDoc(doc(env.unauthenticatedContext().firestore(), t)));
  });
});

describe("Presentazione in attesa di approvazione", () => {
  const nuovoDoc = (over = {}) => ({
    email: `${UID.nuovo}@example.test`, nome: "Nuovo Utente", stato: "attesa",
    principale: false, delegato: false, creatoIl: serverTimestamp(), ...over,
  });
  it("PR1 creazione con presentazione ammessa", async () => {
    await assertSucceeds(setDoc(doc(db(UID.nuovo), `users/${UID.nuovo}`), nuovoDoc({ presentazione: "Sono il dott. Rossi" })));
  });
  it("PR2 creazione: presentazione troppo lunga o non stringa negata", async () => {
    await assertFails(setDoc(doc(db(UID.nuovo), `users/${UID.nuovo}`), nuovoDoc({ presentazione: "x".repeat(201) })));
    await assertFails(setDoc(doc(db(UID.nuovo), `users/${UID.nuovo}`), nuovoDoc({ presentazione: 5 })));
  });
  it("PR3 in attesa: l'utente modifica solo la presentazione", async () => {
    const r = doc(db(UID.attesa), `users/${UID.attesa}`);
    await assertSucceeds(updateDoc(r, { presentazione: "ciao" }));
    await assertSucceeds(updateDoc(r, { presentazione: "x".repeat(200) }));
    await assertFails(updateDoc(r, { presentazione: "x".repeat(201) }));
    await assertFails(updateDoc(r, { presentazione: "ok", stato: "approvato" }));
    await assertFails(updateDoc(r, { presentazione: "ok", nome: "Altro" }));
  });
  it("PR4 approvato o disabilitato: presentazione non modificabile dall'utente", async () => {
    for (const u of [UID.secA, UID.disab, UID.princA]) {
      await assertFails(updateDoc(doc(db(u), `users/${u}`), { presentazione: "ciao" }));
    }
  });
  it("PR5 admin e delegato leggono la presentazione; altri non scrivono quella altrui", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), `users/${UID.attesa}`), { presentazione: "ciao" });
    });
    await assertSucceeds(getDoc(doc(db(UID.admin), `users/${UID.attesa}`)));
    await assertSucceeds(getDoc(doc(db(UID.deleg), `users/${UID.attesa}`)));
    await assertFails(updateDoc(doc(db(UID.secA), `users/${UID.attesa}`), { presentazione: "x" }));
  });
});

// ---------- Indisponibilita del medico ----------
function meseRel(k, base = new Date()) {
  const t = base.getUTCFullYear() * 12 + base.getUTCMonth() + k;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
const indisp = (giorni = { 5: ["M", "P"], 6: ["N"] }) => ({ giorni, aggiornatoIl: serverTimestamp() });
const refInd = (u, mese, medico = "medA") => doc(db(u), `indisponibilita/${medico}/mesi/${mese}`);

describe("Indisponibilita (mesi +1..+12 senza turni pubblicati, solo principale)", () => {
  const m1 = meseRel(1);
  const m2 = meseRel(2);
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `indisponibilita/medA/mesi/${meseRel(-1)}`), { giorni: { 3: ["M"] }, aggiornatoIl: T0 });
      await setDoc(doc(ctx.firestore(), `indisponibilita/medA/mesi/${m1}`), { giorni: { 3: ["M"] }, aggiornatoIl: T0 });
    });
  });
  it("IN1 il principale crea nei mesi +1 e +3, aggiorna e cancella", async () => {
    await assertSucceeds(setDoc(refInd(UID.princA, m2), indisp()));
    await assertSucceeds(setDoc(refInd(UID.princA, meseRel(3)), indisp()));
    await assertSucceeds(setDoc(refInd(UID.princA, m1), indisp({ 1: ["M", "P", "N"] })));
    await assertSucceeds(deleteDoc(refInd(UID.princA, m1)));
    await assertSucceeds(deleteDoc(refInd(UID.princA, m2)));
    await assertSucceeds(deleteDoc(refInd(UID.princA, meseRel(3))));
  });
  it("IN2 mese corrente, passato e +13 non modificabili; +12 ok; il passato resta leggibile", async () => {
    await assertFails(setDoc(refInd(UID.princA, meseRel(0)), indisp()));
    await assertFails(setDoc(refInd(UID.princA, meseRel(13)), indisp()));
    await assertSucceeds(setDoc(refInd(UID.princA, meseRel(12)), indisp()));
    await assertFails(setDoc(refInd(UID.princA, meseRel(-1)), indisp()));
    await assertFails(deleteDoc(refInd(UID.princA, meseRel(-1))));
    await assertSucceeds(getDoc(refInd(UID.princA, meseRel(-1))));
    await assertSucceeds(getDoc(refInd(UID.princA, m1)));
  });
  it("IN2b mese con turni pubblicati per quel medico: negato (create, update, delete); altro medico non influenza", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `turni/medA/mesi/${m1}`), { giorni: {} });
      await setDoc(doc(ctx.firestore(), `turni/medA/mesi/${meseRel(4)}`), { giorni: {} });
      await setDoc(doc(ctx.firestore(), `turni/medB/mesi/${m2}`), { giorni: {} });
    });
    await assertFails(setDoc(refInd(UID.princA, m1), indisp()));
    await assertFails(deleteDoc(refInd(UID.princA, m1)));
    await assertFails(setDoc(refInd(UID.princA, meseRel(4)), indisp()));
    await assertSucceeds(setDoc(refInd(UID.princA, m2), indisp()));
    await assertSucceeds(setDoc(refInd(UID.princA, meseRel(5)), indisp()));
  });
  it("IN3 secondario, delegato, admin, altri medici, attesa e disabilitato: niente lettura ne scrittura", async () => {
    for (const u of [UID.secA, UID.deleg, UID.admin, UID.princC, UID.attesa, UID.disab]) {
      await assertFails(getDoc(refInd(u, m1)));
      await assertFails(getDocs(collection(db(u), "indisponibilita/medA/mesi")));
      await assertFails(setDoc(refInd(u, m2), indisp()));
      await assertFails(deleteDoc(refInd(u, m1)));
    }
  });
  it("IN4 il principale legge (get/list) i propri; il delegato principale del proprio medico vede i propri ma non quelli altrui", async () => {
    await assertSucceeds(getDocs(collection(db(UID.princA), "indisponibilita/medA/mesi")));
    await assertSucceeds(setDoc(refInd(UID.deleg, m2, "medB"), indisp()));
    await assertSucceeds(getDoc(refInd(UID.deleg, m2, "medB")));
    await assertFails(getDoc(refInd(UID.princA, m2, "medB")));
    await assertFails(setDoc(refInd(UID.princC, m2, "medA"), indisp()));
  });
  it("IN5 validazione: fascia X, duplicati, liste vuote o troppo lunghe, chiavi non valide", async () => {
    await assertFails(setDoc(refInd(UID.princA, m2), indisp({ 5: ["X"] })));
    await assertFails(setDoc(refInd(UID.princA, m2), indisp({ 5: ["M", "M"] })));
    await assertFails(setDoc(refInd(UID.princA, m2), indisp({ 5: [] })));
    await assertFails(setDoc(refInd(UID.princA, m2), indisp({ 5: ["M", "P", "N", "M"] })));
    await assertFails(setDoc(refInd(UID.princA, m2), indisp({ 5: "M" })));
    await assertFails(setDoc(refInd(UID.princA, m2), indisp({ 0: ["M"] })));
    await assertFails(setDoc(refInd(UID.princA, m2), indisp({ 32: ["M"] })));
    await assertFails(setDoc(refInd(UID.princA, m2), indisp({ a: ["M"] })));
    await assertFails(setDoc(refInd(UID.princA, m2), indisp({ 5: ["m"] })));
  });
  it("IN6 campi: aggiornatoIl == request.time, nessun campo extra, giorni mappa, id mese valido", async () => {
    await assertFails(setDoc(refInd(UID.princA, m2), { giorni: { 5: ["M"] }, aggiornatoIl: T0 }));
    await assertFails(setDoc(refInd(UID.princA, m2), { ...indisp(), extra: 1 }));
    await assertFails(setDoc(refInd(UID.princA, m2), { aggiornatoIl: serverTimestamp() }));
    await assertFails(setDoc(refInd(UID.princA, m2), { giorni: [1], aggiornatoIl: serverTimestamp() }));
    await assertFails(setDoc(refInd(UID.princA, "2026-13"), indisp()));
  });
});

describe("Indisponibilita con orologio fisso (mesi, transizioni, bisestili)", () => {
  let envF;
  const rulesF = (anno, mese) =>
    readFileSync(resolve(qui, "../firestore.rules"), "utf8")
      .replaceAll("request.time.year()", String(anno))
      .replaceAll("request.time.month()", String(mese));
  async function nuovoEnv(anno, mese) {
    if (envF) await envF.cleanup();
    envF = await initializeTestEnvironment({ projectId: "demo-shifts-fisso", firestore: { rules: rulesF(anno, mese) } });
    await envF.withSecurityRulesDisabled(async (ctx) => {
      const f = ctx.firestore();
      await setDoc(doc(f, "medici/medA"), medico("Medico A", true, "uidPrincA"));
      await setDoc(doc(f, "users/uidPrincA"), utente({ medicoId: "medA", principale: true }));
    });
    return envF.authenticatedContext("uidPrincA", { email: "a@example.test", email_verified: true }).firestore();
  }
  afterAll(async () => {
    await envF?.cleanup();
  });
  const r = (d, mese) => doc(d, `indisponibilita/medA/mesi/${mese}`);
  const gg = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, ["N"]]));

  it("IF1 dicembre -> gennaio: da dicembre 2026 ammessi 2027-01..2027-12, non 2026-12 ne 2028-01", async () => {
    const d = await nuovoEnv(2026, 12);
    await assertSucceeds(setDoc(r(d, "2027-01"), indisp()));
    await assertSucceeds(setDoc(r(d, "2027-03"), indisp()));
    await assertSucceeds(setDoc(r(d, "2027-12"), indisp()));
    await assertFails(setDoc(r(d, "2026-12"), indisp()));
    await assertFails(setDoc(r(d, "2028-01"), indisp()));
    await assertFails(setDoc(r(d, "2026-01"), indisp()));
  });
  it("IF2 novembre: ammessi 2026-12 .. 2027-11 (non 2027-12); gennaio: 2027-02 .. 2028-01", async () => {
    let d = await nuovoEnv(2026, 11);
    await assertSucceeds(setDoc(r(d, "2026-12"), indisp()));
    await assertSucceeds(setDoc(r(d, "2027-11"), indisp()));
    await assertFails(setDoc(r(d, "2027-12"), indisp()));
    d = await nuovoEnv(2027, 1);
    await assertSucceeds(setDoc(r(d, "2027-02"), indisp()));
    await assertSucceeds(setDoc(r(d, "2028-01"), indisp()));
    await assertFails(setDoc(r(d, "2028-02"), indisp()));
    await assertFails(setDoc(r(d, "2027-01"), indisp()));
    await assertFails(setDoc(r(d, "2026-12"), indisp()));
  });
  it("IF3 giorno 31 negato in mese da 30 giorni, ammesso in mese da 31", async () => {
    const d = await nuovoEnv(2026, 2); // marzo (31), aprile (30)
    await assertSucceeds(setDoc(r(d, "2026-03"), indisp(gg(31))));
    await assertSucceeds(setDoc(r(d, "2026-04"), indisp(gg(30))));
    await assertFails(setDoc(r(d, "2026-04"), indisp(gg(31))));
    await assertFails(setDoc(r(d, "2026-04"), indisp({ 31: ["M"] })));
  });
  it("IF4 febbraio: 28 giorni (2027), 29 (2028 bisestile), 2100 non bisestile", async () => {
    let d = await nuovoEnv(2027, 1);
    await assertSucceeds(setDoc(r(d, "2027-02"), indisp(gg(28))));
    await assertFails(setDoc(r(d, "2027-02"), indisp(gg(29))));
    d = await nuovoEnv(2028, 1);
    await assertSucceeds(setDoc(r(d, "2028-02"), indisp(gg(29))));
    await assertFails(setDoc(r(d, "2028-02"), indisp(gg(30))));
    d = await nuovoEnv(2099, 12);
    await assertSucceeds(setDoc(r(d, "2100-02"), indisp(gg(28))));
    await assertFails(setDoc(r(d, "2100-02"), indisp(gg(29))));
  });
});

// ---------- Modello OCR ----------
const ocr = (over = {}) => ({
  versione: 1,
  cellaW: 12,
  cellaH: 16,
  esempi: [{ c: "M6", v: "QUJD" }, { c: "P", v: "REVG" }],
  aggiornatoIl: serverTimestamp(),
  autoreUid: UID.admin,
  ...over,
});
const refO = (u) => doc(db(u), "ocrModello/corrente");

describe("Modello OCR (solo admin e delegati)", () => {
  it("OC1 admin scrive e legge", async () => {
    await assertSucceeds(setDoc(refO(UID.admin), ocr()));
    await assertSucceeds(getDoc(refO(UID.admin)));
  });
  it("OC2 delegato scrive (autoreUid proprio), legge e cancella", async () => {
    await assertSucceeds(setDoc(refO(UID.deleg), ocr({ autoreUid: UID.deleg })));
    await assertSucceeds(getDoc(refO(UID.deleg)));
    await assertSucceeds(deleteDoc(refO(UID.deleg)));
  });
  it("OC3 medici (principale, secondario), attesa, disabilitato e anonimo negati", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "ocrModello/corrente"), ocr({ aggiornatoIl: T0 }));
    });
    for (const u of [UID.princA, UID.secA, UID.princC, UID.attesa, UID.disab]) {
      await assertFails(getDoc(refO(u)));
      await assertFails(setDoc(refO(u), ocr({ autoreUid: u })));
      await assertFails(deleteDoc(refO(u)));
    }
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "ocrModello/corrente")));
  });
  it("OC4 validazione campi", async () => {
    const s = (o) => setDoc(refO(UID.admin), ocr(o));
    await assertFails(s({ autoreUid: UID.deleg }));
    await assertFails(s({ aggiornatoIl: T0 }));
    await assertFails(s({ cellaW: 0 }));
    await assertFails(s({ cellaW: 65 }));
    await assertFails(s({ cellaH: 0 }));
    await assertFails(s({ cellaH: 65 }));
    await assertFails(s({ cellaW: 1.5 }));
    await assertFails(s({ versione: "1" }));
    await assertFails(s({ esempi: "x" }));
    await assertFails(s({ esempi: Array.from({ length: 3001 }, () => ({ c: "M", v: "A" })) }));
    await assertFails(s({ esempi: [{ c: "", v: "A" }] }));
    await assertFails(s({ esempi: [{ c: "123456789", v: "A" }] }));
    await assertFails(s({ esempi: [{ c: "M", v: "A".repeat(2001) }] }));
    await assertFails(s({ extra: 1 }));
    await assertSucceeds(s({ esempi: [] }));
    await assertSucceeds(s({ cellaW: 64, cellaH: 1 }));
  });
  it("OC5 altri documenti in ocrModello negati", async () => {
    await assertFails(setDoc(doc(db(UID.admin), "ocrModello/altro"), ocr()));
  });
});
