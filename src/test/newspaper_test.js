"use strict";

const assert = require("node:assert/strict");
const VilarejoCore = require("../core/vilarejo_core.js");
const Newspaper = require("../newspaper/vilarejo_newspaper.js");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write(`✓ ${name}\n`);
  } catch (error) {
    failed += 1;
    process.stderr.write(`✗ ${name}\n  ${error && error.stack ? error.stack : error}\n`);
  }
}

function makeRuntime() {
  const runtime = VilarejoCore.createRuntime({ calendar: { daysPerMonth: 30, monthsPerYear: 12 } });
  runtime.modules.register({
    id: "economia",
    version: "3.0.0",
    name: "Economia",
    dependencies: ["core"],
    description: "stub para testes do jornal"
  });
  return runtime;
}

function monthPayload(monthNumber, overrides = {}) {
  return {
    monthNumber,
    day: 30 * monthNumber + 149,
    year: 1,
    population: { total: 10 + monthNumber, adults: 6, children: 4 + monthNumber },
    nationalAccounts: { gdp: 1000 + monthNumber * 50, reconciled: true },
    fiscalResult: monthNumber % 2 === 0 ? 120 : -80,
    gameOver: null,
    ...overrides
  };
}

console.log("=== JORNAL DO VILAREJO: SUÍTE UNITÁRIA ===\n");

test("API pública expõe os métodos do contrato", () => {
  assert.equal(typeof Newspaper.registerWithRuntime, "function");
  assert.equal(typeof Newspaper.renderDashboard, "function");
  assert.equal(typeof Newspaper.getEditions, "function");
  assert.equal(typeof Newspaper.getEdition, "function");
  assert.equal(typeof Newspaper.getIssues, "function");
  assert.equal(typeof Newspaper.getIssue, "function");
});

test("aliases getIssues/getIssue são compatíveis com getEditions/getEdition", () => {
  const service = Newspaper._createService();
  service.publishEdition(monthPayload(1));
  service.publishEdition(monthPayload(2));
  assert.deepEqual(
    service.getIssues().map((e) => e.monthNumber),
    service.getEditions().map((e) => e.monthNumber)
  );
  assert.equal(service.getIssue(1).monthNumber, service.getEdition(1).monthNumber);
  assert.equal(service.getIssue(99), null);
});

test("registro no runtime e publicação de edição mensal", () => {
  const runtime = makeRuntime();
  const registration = Newspaper.registerWithRuntime(runtime, { window: {} });
  assert.equal(registration.alreadyRegistered, false);
  assert.ok(registration.service);
  assert.equal(runtime.modules.has("jornal"), true);

  let publishedEvents = 0;
  runtime.events.on("newspaper:edition-published", () => {
    publishedEvents += 1;
  });

  runtime.publish("economy:month-closed", monthPayload(1), "economia");
  const editions = registration.service.getEditions();
  assert.equal(editions.length, 1);
  assert.equal(editions[0].monthNumber, 1);
  assert.equal(editions[0].hasSufficientData, true);
  assert.match(editions[0].headline, /Mês 1/);
  assert.equal(publishedEvents, 1);
  registration.dispose();
});

test("ausência de duplicidade para o mesmo mês e partida", () => {
  const service = Newspaper._createService();
  const first = service.publishEdition(monthPayload(3, { nationalAccounts: { gdp: 1500, reconciled: true } }));
  const second = service.publishEdition(monthPayload(3, { nationalAccounts: { gdp: 9999, reconciled: false } }));
  assert.equal(service.getEditions().length, 1);
  assert.equal(first.id, second.id);
  assert.equal(service.getEdition(3).indicators.gdp, 1500);
});

test("separação entre partidas pelo session.id", () => {
  const runtimeA = makeRuntime();
  const sessionA = runtimeA.session.get().id;
  const serviceA = Newspaper._createService({ runtime: runtimeA });
  serviceA.publishEdition(monthPayload(1));
  assert.equal(serviceA.getEditions().length, 1);
  assert.equal(serviceA.getEditions()[0].sessionId, sessionA);

  const runtimeB = makeRuntime();
  runtimeB.session.reset({ day: 1 });
  const sessionB = runtimeB.session.get().id;
  assert.notEqual(sessionA, sessionB);

  const serviceB = Newspaper._createService({ runtime: runtimeB });
  serviceB.publishEdition(monthPayload(1));
  assert.equal(serviceB.getEditions().length, 1);
  assert.equal(serviceB.getEditions()[0].sessionId, sessionB);

  assert.equal(serviceA.getEditions({ sessionId: sessionB }).length, 0);
});

test("ordenação cronológica das edições", () => {
  const service = Newspaper._createService();
  service.publishEdition(monthPayload(5));
  service.publishEdition(monthPayload(2));
  service.publishEdition(monthPayload(8));
  service.publishEdition(monthPayload(1));
  assert.deepEqual(
    service.getEditions().map((e) => e.monthNumber),
    [1, 2, 5, 8]
  );
});

test("dados ausentes ou incompletos não inventam fatos", () => {
  const service = Newspaper._createService();
  const edition = service.publishEdition({
    monthNumber: 4,
    day: 200,
    year: 1
  });
  assert.ok(edition);
  assert.equal(edition.hasSufficientData, false);
  assert.ok(edition.gaps.length > 0);
  assert.equal(edition.sections.length, 0);
  assert.match(edition.headline, /dados parciais/i);
});

test("comparações entre períodos são interpretações, não causas", () => {
  const service = Newspaper._createService();
  service.publishEdition(monthPayload(1, { nationalAccounts: { gdp: 1000, reconciled: true }, fiscalResult: 100 }));
  service.publishEdition(monthPayload(2, { nationalAccounts: { gdp: 1200, reconciled: true }, fiscalResult: -50 }));
  const edition = service.getEdition(2);
  const economy = edition.sections.find((s) => s.section === "Economia");
  assert.ok(economy);
  assert.ok(economy.facts.length >= 1);
  assert.ok(economy.interpretations.some((text) => /não estabelece causalidade/i.test(text)));
});

test("renderização em estado vazio", () => {
  const service = Newspaper._createService();
  const children = [];
  const host = {
    firstChild: null,
    replaceChildren(...nodes) {
      children.length = 0;
      children.push(...nodes);
    },
    appendChild(node) {
      children.push(node);
      return node;
    },
    removeChild() {}
  };

  const originalDocument = global.document;
  global.document = {
    createElement(tag) {
      const el = {
        tagName: tag.toUpperCase(),
        className: "",
        textContent: "",
        innerHTML: "",
        children: [],
        setAttribute() {},
        appendChild(child) {
          this.children.push(child);
          return child;
        }
      };
      return el;
    }
  };

  try {
    const root = service.renderDashboard(host);
    assert.ok(root);
    assert.equal(root.className, "vilarejo-newspaper");
    const emptyNode = root.children.find((c) => c.className === "vilarejo-newspaper__empty");
    assert.ok(emptyNode);
    assert.match(emptyNode.textContent, /Nenhuma edição/i);
  } finally {
    global.document = originalDocument;
  }
});

test("reinicialização de partida limpa edições da sessão anterior", () => {
  const runtime = makeRuntime();
  const service = Newspaper._createService({ runtime });
  service.publishEdition(monthPayload(1));
  service.publishEdition(monthPayload(2));
  assert.equal(service.getEditions().length, 2);

  const oldSession = runtime.session.get().id;
  runtime.session.reset({ day: 10 });
  const newSession = runtime.session.get().id;
  assert.notEqual(oldSession, newSession);

  service.resetForNewGame({
    sessionId: newSession,
    resetCount: runtime.session.get().resetCount,
    day: 10
  });

  assert.equal(service.getEditions().length, 0);
  service.publishEdition(monthPayload(1));
  assert.equal(service.getEditions().length, 1);
  assert.equal(service.getEditions()[0].sessionId, newSession);
});

test("falha do jornal não depende de serviços externos pagos", () => {
  const service = Newspaper._createService({ window: {} });
  const edition = service.publishEdition(monthPayload(7));
  assert.ok(edition);
  assert.equal(edition.sourceEvent, "economy:month-closed");
  assert.ok(Array.isArray(edition.sources));
});

test("registro duplicado no mesmo runtime é idempotente", () => {
  const runtime = makeRuntime();
  const first = Newspaper.registerWithRuntime(runtime, { window: {} });
  const second = Newspaper.registerWithRuntime(runtime, { window: {} });
  assert.equal(first.alreadyRegistered, false);
  assert.equal(second.alreadyRegistered, true);
  first.dispose();
});

test("game:reset via evento do runtime reinicia o jornal", () => {
  const runtime = makeRuntime();
  const registration = Newspaper.registerWithRuntime(runtime, { window: {} });
  runtime.publish("economy:month-closed", monthPayload(1), "economia");
  assert.equal(registration.service.getEditions().length, 1);

  runtime.session.reset({ day: 5 });
  runtime.publish(
    "game:reset",
    {
      sessionId: runtime.session.get().id,
      resetCount: runtime.session.get().resetCount,
      day: 5
    },
    "core.session"
  );

  assert.equal(registration.service.getEditions().length, 0);
  registration.dispose();
});

test("métodos públicos do objeto principal após registro", () => {
  const runtime = makeRuntime();
  Newspaper.registerWithRuntime(runtime, { window: {} });
  runtime.publish("economy:month-closed", monthPayload(9), "economia");
  const editions = Newspaper.getEditions();
  assert.ok(editions.length >= 1);
  assert.ok(Newspaper.getEdition(9) || Newspaper.getEditions().some((e) => e.monthNumber === 9));
  assert.equal(typeof Newspaper.getIssues, "function");
  assert.equal(typeof Newspaper.getIssue, "function");
});

test("Jornal incorpora acontecimentos do Mundo Vivo no mesmo fechamento", () => {
  const runtime = makeRuntime();
  runtime.modules.register({
    id: "mundo_vivo",
    version: "1.0.0",
    name: "Mundo Vivo",
    dependencies: ["core", "economia"],
    description: "snapshot factual auxiliar para o Jornal"
  });
  runtime.modules.updateSnapshot("mundo_vivo", {
    events: [{
      id: "fiscal_pressure:1",
      month: 1,
      title: "Pressão recorrente sobre o Tesouro",
      narrative: "O resultado fiscal ficou negativo em dois fechamentos consecutivos."
    }],
    milestones: [{
      id: "first_close",
      title: "Primeiro ciclo concluído",
      description: "A comunidade fechou seu primeiro mês econômico.",
      achieved: true,
      achievedAtMonth: 1
    }]
  });

  const registration = Newspaper.registerWithRuntime(runtime, { window: {} });
  runtime.publish("economy:month-closed", monthPayload(1), "economia");
  const edition = registration.service.getEdition(1);
  const society = edition.sections.find((section) => section.section === "Sociedade");
  assert.ok(society);
  assert.ok(society.facts.some((fact) => fact.includes("Pressão recorrente sobre o Tesouro")));
  assert.ok(society.facts.some((fact) => fact.includes("Primeiro ciclo concluído")));
  assert.ok(edition.sources.includes("runtime.modules.get('mundo_vivo').snapshot"));
});

test("Jornal incorpora registros de Eventos V3 do fechamento", () => {
  const runtime = makeRuntime();
  const registration = Newspaper.registerWithRuntime(runtime, { window: {} });
  runtime.publish("economy:month-closed", monthPayload(1, {
    eventEngine: { monthEvents: ["Mês 1: Uma enchente atingiu a região."] }
  }), "economia");
  const edition = registration.service.getEdition(1);
  const events = edition.sections.find((section) => section.section === "Acontecimentos");
  assert.ok(events);
  assert.ok(events.facts.some((fact) => fact.includes("Eventos V3 registrou: Uma enchente atingiu a região.")));
  assert.ok(edition.sources.includes("payload.eventEngine.monthEvents (Eventos V3)"));
});

console.log(`\nResultado: ${passed} aprovados; ${failed} reprovados.`);
if (failed) process.exitCode = 1;

