"use strict";

const assert = require("node:assert/strict");
const World = require("../world/vilarejo_world_engine.js");

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  process.stdout.write(`✓ ${name}\n`);
}

function makeRuntime() {
  const records = new Map([[
    "core", { id: "core", version: "0.1.0", name: "Core", dependencies: [], snapshot: {} }
  ]]);
  const listeners = new Map();
  const history = [];
  const eventBus = {
    on(topic, callback) {
      if (!listeners.has(topic)) listeners.set(topic, new Set());
      listeners.get(topic).add(callback);
      return () => listeners.get(topic)?.delete(callback);
    },
    emit(topic, payload = {}, metadata = {}) {
      const event = { topic, payload, ...metadata };
      history.push(event);
      for (const callback of Array.from(listeners.get(topic) || [])) callback(event);
      return event;
    },
    getHistory() { return history.slice(); }
  };
  return {
    events: eventBus,
    modules: {
      has: (id) => records.has(id),
      register(descriptor) {
        for (const dependency of descriptor.dependencies || []) {
          if (!records.has(dependency)) throw new Error(`Dependência ausente: ${dependency}`);
        }
        if (records.has(descriptor.id)) throw new Error(`Módulo duplicado: ${descriptor.id}`);
        records.set(descriptor.id, { ...descriptor, snapshot: {} });
      },
      get(id) { return records.get(id) || null; },
      updateSnapshot(id, snapshot) {
        if (!records.has(id)) throw new Error(`Módulo não registrado: ${id}`);
        records.get(id).snapshot = JSON.parse(JSON.stringify(snapshot || {}));
        return records.get(id).snapshot;
      }
    },
    session: { get: () => ({ id: "test-session" }) },
    population: { getSnapshot: () => ({ totals: { total: 100 } }) },
    publish(topic, payload, source) { return eventBus.emit(topic, payload, { source }); }
  };
}

function makePayload(monthNumber, fiscalResult = 100) {
  return {
    monthNumber,
    day: 149 + monthNumber * 30,
    population: { total: 100 + monthNumber },
    nationalAccounts: { gdp: 10000 + monthNumber * 100 },
    fiscalResult,
    gameOver: null
  };
}

function makeSnapshots(month, overrides = {}) {
  return {
    sociedade: {
      demographic: { population: 100 + month, workingAge: 65, children: 22, elderly: 13, dependencyRatio: 53.8 },
      migration: {
        monthly: { incoming: 3, outgoing: 1, net: 2 },
        cumulative: { incoming: month * 3, outgoing: month, net: month * 2 }
      },
      culture: { integrationIndex: 70 },
      qualityOfLife: { current: { score: 62, change: 2, measuredDimensions: 4 } },
      recentEvents: []
    },
    politica: { currentMonth: month },
    instituicoes: { currentMonth: month },
    servicos: { currentMonth: month },
    ...overrides
  };
}

console.log("=== MUNDO VIVO: TESTES ===\n");
test("API pública oferece engine e integração com Runtime", () => {
  assert.equal(typeof World.createEngine, "function");
  assert.equal(typeof World.registerWithRuntime, "function");
  assert.equal(World.MODULE_ID, "mundo_vivo");
});

test("primeiro fechamento registra mês e marcos sem alterar o payload econômico", () => {
  const engine = World.createEngine({ sessionId: "test-session", baselinePopulation: 100 });
  const payload = makePayload(1);
  const before = JSON.stringify(payload);
  const result = engine.processMonth(payload, makeSnapshots(1));
  assert.equal(result.unchanged, false);
  assert.equal(result.snapshot.currentMonth, 1);
  assert.equal(result.snapshot.milestones.find((m) => m.id === "first_close").achieved, true);
  assert.equal(JSON.stringify(payload), before);
});

test("reinício de partida descarta a linha de base demográfica anterior", () => {
  const engine = World.createEngine({ baselinePopulation: 100 });
  engine.processMonth(makePayload(1), makeSnapshots(1));
  engine.reset({ sessionId: "new-session", baselinePopulation: null });
  engine.processMonth(makePayload(1), makeSnapshots(1, { sociedade: { demographic: { population: 200 } } }));
  const second = engine.processMonth(makePayload(2), makeSnapshots(2, { sociedade: { demographic: { population: 211 } } }));
  assert.equal(second.snapshot.milestones.find((item) => item.id === "population_growth").achieved, true);
  assert.equal(second.snapshot.sessionId, "new-session");
});

test("fechamento repetido é idempotente", () => {
  const engine = World.createEngine({ baselinePopulation: 100 });
  engine.processMonth(makePayload(1), makeSnapshots(1));
  const repeated = engine.processMonth(makePayload(1), makeSnapshots(1));
  assert.equal(repeated.unchanged, true);
  assert.equal(engine.getSnapshot().history.length, 1);
});

test("marco institucional exige snapshots dos módulos no mesmo mês", () => {
  const engine = World.createEngine({ baselinePopulation: 100 });
  const stale = makeSnapshots(1);
  stale.instituicoes.currentMonth = 0;
  const result = engine.processMonth(makePayload(1), stale);
  const milestone = result.snapshot.milestones.find((item) => item.id === "institutions_active");
  assert.equal(milestone.achieved, false);
  assert.equal(milestone.available, false);
});

test("dois déficits seguidos criam alerta fiscal baseado em evidência", () => {
  const engine = World.createEngine({ baselinePopulation: 100 });
  engine.processMonth(makePayload(1, -100), makeSnapshots(1));
  const month2 = engine.processMonth(makePayload(2, -250), makeSnapshots(2));
  const alert = month2.snapshot.events.find((event) => event.ruleId === "fiscal_pressure");
  assert.ok(alert);
  assert.equal(alert.evidence.consecutiveDeficitMonths, 2);
  assert.equal(month2.snapshot.recommendations.some((item) => item.id === "review_public_accounts"), true);
});

test("queda social persistente gera alerta, enquanto dado ausente não vira zero", () => {
  const engine = World.createEngine({ baselinePopulation: 100 });
  engine.processMonth(makePayload(1), makeSnapshots(1, { sociedade: { qualityOfLife: { current: { score: 60, change: -3, measuredDimensions: 4 } } } }));
  const second = engine.processMonth(makePayload(2), makeSnapshots(2, { sociedade: { qualityOfLife: { current: { score: 56, change: -4, measuredDimensions: 4 } } } }));
  assert.ok(second.snapshot.events.some((event) => event.ruleId === "quality_decline"));

  const sparse = World.createEngine();
  const result = sparse.processMonth(makePayload(1, null), {});
  assert.equal(result.snapshot.indicators.fiscalResult, null);
  assert.equal(result.snapshot.indicators.qolScore, null);
  assert.equal(result.snapshot.coverage.fiscal, false);
  assert.equal(result.snapshot.coverage.qualityOfLife, false);
});

test("fluxo migratório produz um registro descritivo sem alegar causa", () => {
  const engine = World.createEngine({ baselinePopulation: 100 });
  const result = engine.processMonth(makePayload(1), makeSnapshots(1, {
    sociedade: {
      demographic: { population: 100 },
      migration: { monthly: { incoming: 0, outgoing: 3, net: -3 }, cumulative: { incoming: 0, outgoing: 3, net: -3 } },
      qualityOfLife: { current: { score: 55, change: null, measuredDimensions: 2 } }
    }
  }));
  const alert = result.snapshot.events.find((event) => event.ruleId === "community_outflow");
  assert.ok(alert);
  assert.match(alert.narrative, /não determina sozinho sua causa/);
  assert.ok(result.snapshot.recommendations.some((item) => item.id === "investigate_outflow"));
});

test("marcos de um ano, estabilidade fiscal e crescimento usam critérios observáveis", () => {
  const engine = World.createEngine({ baselinePopulation: 100 });
  let result;
  for (let month = 1; month <= 12; month += 1) {
    result = engine.processMonth(makePayload(month, 10), makeSnapshots(month));
  }
  assert.equal(result.snapshot.milestones.find((m) => m.id === "first_year").achieved, true);
  assert.equal(result.snapshot.milestones.find((m) => m.id === "fiscal_stability").achieved, true);
  assert.equal(result.snapshot.milestones.find((m) => m.id === "population_growth").achieved, true);
  assert.equal(result.snapshot.milestones.find((m) => m.id === "community_integration").achieved, true);
});

test("fragilidade da coalizão e baixa satisfação dos serviços geram alertas após persistência", () => {
  const engine = World.createEngine({ baselinePopulation: 100 });
  const snapshot = (month) => makeSnapshots(month, {
    politica: { currentMonth: month, summary: { measuredGroups: 8, relations: { support: 3, neutral: 4, opposition: 3 } } },
    instituicoes: { currentMonth: month, coalition: { status: "minority", majority: false, seats: 7 }, summary: { coalitionSeats: 7, majoritySeats: 11 } },
    servicos: { currentMonth: month, domains: {
      health: { id: "health", name: "Saúde", satisfaction: 32 },
      education: { id: "education", name: "Educação", satisfaction: 35 },
      security: { id: "security", name: "Segurança", satisfaction: 34 }
    } }
  });
  engine.processMonth(makePayload(1), snapshot(1));
  const result = engine.processMonth(makePayload(2), snapshot(2));
  assert.ok(result.snapshot.events.some((event) => event.ruleId === "coalition_fragility"));
  assert.ok(result.snapshot.events.some((event) => event.ruleId === "services_pressure"));
  assert.ok(result.snapshot.recommendations.some((item) => item.id === "build_government_majority"));
  assert.ok(result.snapshot.recommendations.some((item) => item.id === "review_public_services"));
});

test("marco de integração exige chegadas e indicador cultural suficientes", () => {
  const engine = World.createEngine({ baselinePopulation: 100 });
  const lowIntegration = makeSnapshots(1, {
    sociedade: {
      demographic: { population: 101 },
      migration: { cumulative: { incoming: 8 } },
      culture: { integrationIndex: 50 },
      qualityOfLife: { current: { score: 60, change: null, measuredDimensions: 4 } }
    }
  });
  const first = engine.processMonth(makePayload(1), lowIntegration);
  const incomplete = first.snapshot.milestones.find((item) => item.id === "community_integration");
  assert.equal(incomplete.achieved, false);
  assert.ok(incomplete.progress < incomplete.goal);
});

test("registros estruturados do Eventos V3 entram na linha do tempo com a fonte preservada", () => {
  const engine = World.createEngine({ baselinePopulation: 100 });
  const result = engine.processMonth({
    ...makePayload(1),
    eventEngine: { monthEvents: ["Mês 1: Uma enchente atingiu a região.", "Mês 1 · AVISO: O rio está subindo."] }
  }, makeSnapshots(1));
  const imported = result.snapshot.events.filter((event) => event.source === "eventos_v3");
  assert.equal(imported.length, 2);
  assert.ok(imported.some((event) => event.narrative.includes("enchente")));
});

test("eventos demográficos reais são incorporados uma única vez", () => {
  const engine = World.createEngine({ baselinePopulation: 100 });
  const snapshots = makeSnapshots(1, { sociedade: { recentEvents: [{ id: "soc-1", month: 1, type: "birth", message: "Nasceu uma criança em uma família." }] } });
  engine.processMonth(makePayload(1), snapshots);
  const result = engine.getSnapshot();
  assert.equal(result.events.filter((event) => event.id === "society:soc-1").length, 1);
});

test("estado do Mundo Vivo pode ser exportado e restaurado com validação de versão", () => {
  const engine = World.createEngine({ baselinePopulation: 100 });
  engine.processMonth(makePayload(1), makeSnapshots(1));
  const serialized = engine.serialize();
  const restored = World.createEngine();
  restored.restore(serialized);
  assert.deepEqual(restored.getSnapshot(), engine.getSnapshot());
  assert.throws(() => restored.restore({ schema: "999", state: {} }), /incompatível/);
});

test("Runtime recebe snapshots e publica world:month-closed uma vez por mês", () => {
  const runtime = makeRuntime();
  runtime.modules.register({ id: "economia", version: "3.0.0", name: "Economia", dependencies: ["core"] });
  runtime.modules.register({ id: "sociedade", version: "1.0.0", name: "Sociedade", dependencies: ["core", "economia"] });
  runtime.modules.register({ id: "politica", version: "1.0.0", name: "Política", dependencies: ["core"] });
  runtime.modules.register({ id: "instituicoes", version: "1.0.0", name: "Instituições", dependencies: ["core"] });
  runtime.modules.register({ id: "servicos", version: "1.0.0", name: "Serviços", dependencies: ["core"] });
  const registration = World.registerWithRuntime(runtime, { window: {} });
  let published = 0;
  runtime.events.on("world:month-closed", () => { published += 1; });
  runtime.modules.updateSnapshot("sociedade", makeSnapshots(1).sociedade);
  runtime.modules.updateSnapshot("politica", makeSnapshots(1).politica);
  runtime.modules.updateSnapshot("instituicoes", makeSnapshots(1).instituicoes);
  runtime.modules.updateSnapshot("servicos", makeSnapshots(1).servicos);
  runtime.publish("economy:month-closed", makePayload(1), "economia");
  runtime.publish("economy:month-closed", makePayload(1), "economia");
  assert.equal(published, 1);
  assert.equal(runtime.modules.get("mundo_vivo").snapshot.currentMonth, 1);
  registration.dispose();
});

console.log(`\n${passed} testes aprovados.`);
