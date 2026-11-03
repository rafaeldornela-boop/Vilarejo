"use strict";

const assert = require("node:assert/strict");
const Intelligence = require("../intelligence/vilarejo_intelligence.js");

let passed = 0;
function test(name, callback) {
  try {
    callback();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}: ${error.stack || error}`);
    process.exitCode = 1;
  }
}
function record(month, metrics) { return { month, metrics: { ...metrics } }; }
function storagePair() {
  const data = new Map();
  const make = () => ({
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); }
  });
  return { data, storage: make(), sessionStorage: make() };
}

console.log("=== INTELIGÊNCIA: SUÍTE UNITÁRIA / FIXTURES SINTÉTICAS ===");

test("metadados distinguem fluxo, estoque, taxa e acumulado", () => {
  const definitions = new Map(Intelligence.METRICS.map((metric) => [metric.id, metric]));
  assert.equal(definitions.get("population").kind, "stock");
  assert.equal(definitions.get("gdpProduction").kind, "monthly-flow");
  assert.equal(definitions.get("inflationMonthly").kind, "rate");
  assert.equal(definitions.get("birthsCumulative").kind, "cumulative");
  assert.equal(definitions.has("incomeGini"), false);
});

test("tendência exige três observações e descreve fato, inclinação e limite causal", () => {
  const short = [record(1, { gdpProduction: 10 }), record(2, { gdpProduction: 11 })];
  assert.equal(Intelligence.analyzeTrends(short, 12).length, 0);
  const rows = [10, 11, 12, 16, 24, 36].map((value, index) => record(index + 1, { gdpProduction: value }));
  const trend = Intelligence.analyzeTrends(rows, 12).find((item) => item.metricId === "gdpProduction");
  assert.ok(trend);
  assert.equal(trend.direction, "crescimento");
  assert.equal(trend.observations, 6);
  assert.equal(trend.acceleration, "acelerando");
  assert.match(trend.fact, /Mês 1/);
  assert.match(trend.interpretation, /não sua causa/);
});

test("taxas são comparadas em pontos percentuais, sem confundir variação relativa", () => {
  const rows = [50, 50.5, 53, 55].map((value, index) => record(index + 1, { unemploymentRate: value }));
  const trend = Intelligence.analyzeTrends(rows, 12).find((item) => item.metricId === "unemploymentRate");
  assert.equal(trend.direction, "crescimento");
  assert.equal(trend.delta, 5);
});

test("ausência de série não produz tendência nem falso alerta", () => {
  assert.deepEqual(Intelligence.analyzeTrends([], 60), []);
  assert.deepEqual(Intelligence.analyzeAlerts([]), []);
  const emptyMetrics = [1, 2, 3, 4, 5].map((month) => record(month, {}));
  assert.deepEqual(Intelligence.analyzeAlerts(emptyMetrics), []);
});

test("um ponto de inflação acima do limiar fica apenas informativo", () => {
  const observation = { ...record(1, { inflationMonthly: 12 }), day: 30, year: 1 };
  const alerts = Intelligence.analyzeAlerts([observation]);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].severity, "informativo");
  assert.equal(alerts[0].status, "em observação");
  assert.equal(alerts[0].occurrenceDay, 30);
  assert.equal(alerts[0].occurrenceYear, 1);
});

test("inflação alta persistente dispara atenção e registra condição", () => {
  const rows = [6, 6.2, 5.5].map((value, index) => record(index + 1, { inflationMonthly: value }));
  const alert = Intelligence.analyzeAlerts(rows).find((item) => item.ruleId === "high-inflation");
  assert.equal(alert.severity, "atenção");
  assert.equal(alert.status, "ativo");
  assert.equal(alert.occurrenceMonth, 1);
  assert.match(alert.threshold, /5%/);
});

test("inflação crítica exige dois fechamentos e pode ser resolvida", () => {
  const rows = [11, 12, 2, 2, 2].map((value, index) => record(index + 1, { inflationMonthly: value }));
  const alert = Intelligence.analyzeAlerts(rows).find((item) => item.ruleId === "high-inflation");
  assert.equal(alert.severity, "crítico");
  assert.equal(alert.status, "resolvido");
  assert.equal(alert.resolvedMonth, 3);
});

test("queda do PIB exige janela de três meses e duas avaliações consecutivas", () => {
  const values = [100, 100, 100, 89, 87, 86];
  const rows = values.map((value, index) => record(index + 1, { gdpProduction: value }));
  const alert = Intelligence.analyzeAlerts(rows).find((item) => item.ruleId === "gdp-contraction");
  assert.ok(alert);
  assert.equal(alert.severity, "atenção");
  assert.equal(alert.status, "ativo");
  assert.equal(alert.occurrenceMonth, 4);
});

test("um hiato de dados não é tratado como valor zero", () => {
  const rows = [record(1, { inflationMonthly: 6 }), record(2, {}), record(3, { inflationMonthly: 6 })];
  const alerts = Intelligence.analyzeAlerts(rows);
  assert.equal(alerts.some((item) => item.ruleId === "high-inflation" && item.status === "ativo"), false);
  assert.equal(alerts.some((item) => item.metricId === "population"), false);
});

test("gravação mantém zeros observados, omite nulos e deduplica por mês", () => {
  const pair = storagePair();
  let id = 0;
  const service = Intelligence.createService({
    storage: pair.storage,
    sessionStorage: pair.sessionStorage,
    idFactory: () => `unit-${++id}`,
    now: () => "2026-01-01T00:00:00.000Z",
    currentMonth: 0,
    capture: (payload) => payload
  });
  service.recordMonthClosure({ month: 1, metrics: { population: 0, gdpProduction: null, unemploymentRate: 0 } });
  service.recordMonthClosure({ month: 1, metrics: { population: 99, gdpProduction: 10 } });
  const history = service.getRunHistory();
  assert.equal(history.length, 1);
  assert.equal(history[0].metrics.population, 99);
  assert.equal(history[0].metrics.gdpProduction, 10);
  service.recordMonthClosure({ month: 2, metrics: { population: 3 } });
  const old = service.recordMonthClosure({ month: 1, metrics: { population: 500 } });
  assert.equal(old.metrics.population, 99);
  assert.equal(service.getRunHistory().length, 2);
  assert.equal(service.getCurrentHistory()[0].population, 99);
  assert.equal(service.getCurrentHistory()[0].gdp, 10);
  const historySnapshot = service.getHistoryStoreSnapshot();
  assert.equal(historySnapshot.records.length, 2);
  assert.equal(historySnapshot.activeSessionId, service.getCurrentRunId());
  const persisted = JSON.parse(pair.storage.getItem(Intelligence.STORAGE_KEY));
  assert.ok(persisted.runs.every((run) => !Object.hasOwn(run, "records") && run.historySnapshot));
});

test("reload da mesma execução mantém histórico; mês retrocedido arquiva sem apagar", () => {
  const pair = storagePair();
  let id = 0;
  const opts = {
    storage: pair.storage,
    sessionStorage: pair.sessionStorage,
    idFactory: () => `persist-${++id}`,
    now: () => `2026-01-0${id + 1}T00:00:00.000Z`,
    capture: (payload) => payload
  };
  const first = Intelligence.createService({ ...opts, currentMonth: 0 });
  first.recordMonthClosure({ month: 1, metrics: { population: 10 } });
  first.recordMonthClosure({ month: 2, metrics: { population: 11 } });
  const firstId = first.getCurrentRunId();
  const resumed = Intelligence.createService({ ...opts, currentMonth: 2 });
  assert.equal(resumed.getCurrentRunId(), firstId);
  assert.equal(resumed.getRunHistory().length, 2);
  const reloadedFresh = Intelligence.createService({ ...opts, currentMonth: 0 });
  assert.notEqual(reloadedFresh.getCurrentRunId(), firstId);
  assert.equal(reloadedFresh.getRunHistory(firstId).length, 2);
  assert.equal(reloadedFresh.getRun(firstId).status, "archived");
});

test("formato local incompatível ou ilegível não é sobrescrito", () => {
  for (const raw of ['{"version":999,"runs":[]}', "conteúdo-corrompido"]) {
    const pair = storagePair();
    pair.storage.setItem(Intelligence.STORAGE_KEY, raw);
    const service = Intelligence.createService({
      storage: pair.storage,
      sessionStorage: pair.sessionStorage,
      idFactory: () => "memory-only-run",
      currentMonth: 0,
      capture: (payload) => payload
    });
    service.recordMonthClosure({ month: 1, metrics: { population: 12 } });
    assert.equal(pair.storage.getItem(Intelligence.STORAGE_KEY), raw);
    assert.equal(service.getSummary().persistence, "somente memória");
    assert.ok(service.getSummary().persistenceWarning);
  }
});

test("migra histórico local v1 para um History Store por execução sem perder registros", () => {
  const pair = storagePair();
  pair.storage.setItem(Intelligence.STORAGE_KEY, JSON.stringify({
    version: 1,
    runs: [{
      id: "legacy-run",
      createdAt: "2026-01-01T00:00:00.000Z",
      endedAt: "2026-01-03T00:00:00.000Z",
      startDay: 1,
      lastMonth: 2,
      status: "archived",
      endReason: "execução anterior",
      parentRunId: null,
      records: [
        { runId: "legacy-run", month: 1, day: 30, year: 1, metrics: { population: 10 }, metricQuality: { population: "observado" }, sources: { population: "Core" } },
        { runId: "legacy-run", month: 2, day: 60, year: 1, metrics: { population: 11 }, metricQuality: {}, sources: { population: "Core" } }
      ]
    }]
  }));
  const service = Intelligence.createService({
    storage: pair.storage,
    sessionStorage: pair.sessionStorage,
    idFactory: () => "new-run",
    currentMonth: 0,
    capture: (payload) => payload
  });
  const history = service.getRunHistory("legacy-run");
  assert.deepEqual(history.map((item) => item.month), [1, 2]);
  assert.equal(history[0].metrics.population, 10);
  assert.equal(history[0].metricQuality.population, "observado");
  assert.equal(history[0].sources.population, "Core");
  const migrated = JSON.parse(pair.storage.getItem(Intelligence.STORAGE_KEY));
  assert.equal(migrated.version, 2);
  const oldRun = migrated.runs.find((run) => run.id === "legacy-run");
  assert.equal(oldRun.records, undefined);
  assert.equal(oldRun.historySnapshot.records.length, 2);
  assert.equal(oldRun.historySnapshot.activeSessionId, "legacy-run");
  assert.equal(oldRun.historySnapshot.records[0].period.absoluteDay, 30);
  assert.equal(oldRun.historySnapshot.records[0].metadata.metricQuality.population, "observado");
});

test("reset separa execução e carregar checkpoint antigo cria ramo sem meses futuros", () => {
  const pair = storagePair();
  let id = 0;
  const service = Intelligence.createService({
    storage: pair.storage, sessionStorage: pair.sessionStorage,
    idFactory: () => `load-${++id}`, now: () => "2026-02-01T00:00:00.000Z", currentMonth: 0,
    capture: (payload) => payload
  });
  const originalId = service.getCurrentRunId();
  service.recordMonthClosure({ month: 1, metrics: { population: 10 } });
  service.recordMonthClosure({ month: 2, metrics: { population: 11 } });
  service.resetForNewGame({ day: 149, resetCount: 1 });
  assert.notEqual(service.getCurrentRunId(), originalId);
  assert.equal(service.getRunHistory(originalId).length, 2);
  const fork = service.activateGame({ gameId: originalId, monthNumber: 1 });
  assert.notEqual(fork.id, originalId);
  assert.equal(fork.parentRunId, originalId);
  assert.deepEqual(fork.records.map((item) => item.month), [1]);
  assert.ok(fork.records.every((item) => item.runId === fork.id));
});

console.log(`Resultado unitário Inteligência: ${passed} testes aprovados; ${process.exitCode ? "há falhas" : "0 reprovados"}.`);
