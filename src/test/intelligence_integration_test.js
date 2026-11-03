"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const EventosV3 = require("../events/eventos_v3.js");

const ROOT = path.join(__dirname, "../../");
const SCRIPT_PATHS = [
  "src/core/vilarejo_core.js",
  "src/events/eventos_v3.js",
  "src/economy/vilarejo_economy.js",
  "src/society/vilarejo_society.js",
  "src/politics/vilarejo_politics.js",
  "src/institutions/vilarejo_institutions.js",
  "src/shared/vilarejo_history_store.js",
  "src/intelligence/vilarejo_intelligence.js",
  "src/intelligence/intelligence_view.js",
  "src/ui/dashboard.js"
];
const source = new Map(SCRIPT_PATHS.map((file) => [file, fs.readFileSync(path.join(ROOT, file), "utf8")]));
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
function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    _values: values
  };
}
function makeElement(id) {
  return {
    id, innerHTML: "", textContent: "", value: "", disabled: false,
    onclick: null, oninput: null, onchange: null, onkeyup: null, dataset: {}, style: {}, addEventListener() {},
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() { return false; } },
    closest() { return null; }, appendChild() {}, removeChild() {}, setAttribute() {}, getAttribute() { return null; },
    querySelector(selector) { return makeElement(`${id}:${selector}`); }, querySelectorAll() { return []; }
  };
}
function createIntegratedSimulation(options = {}) {
  const elements = new Map();
  const getElementById = (id) => {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  };
  const document = {
    getElementById,
    querySelector: getElementById,
    querySelectorAll: () => [],
    createElement: (tag) => makeElement(tag),
    activeElement: null,
    body: getElementById("body"),
    documentElement: getElementById("html")
  };
  const context = {
    document,
    console,
    EventosV3,
    scrollTo() {},
    localStorage: options.localStorage || memoryStorage(),
    sessionStorage: options.sessionStorage || memoryStorage(),
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: () => 1,
    clearTimeout: () => {}
  };
  context.window = context;
  vm.createContext(context);
  for (const file of SCRIPT_PATHS) vm.runInContext(source.get(file), context, { filename: file, timeout: 30000 });
  return { context, window: context, document };
}

console.log("=== INTELIGÊNCIA: INTEGRAÇÃO REAL COM A SIMULAÇÃO ===");
const localStorage = memoryStorage();
const sessionStorage = memoryStorage();
const app = createIntegratedSimulation({ localStorage, sessionStorage });
const api = app.window.VilarejoTest;
const runtime = app.window.VilarejoRuntime;
const intelligenceRuntime = app.window.VilarejoIntelligenceRuntime;
assert.ok(api && runtime && intelligenceRuntime?.service, "Core, Economia e Inteligência devem iniciar no contexto real");
const service = intelligenceRuntime.service;

for (const horizon of [12, 24, 60]) {
  test(`${horizon} fechamentos reais: uma linha mensal por evento`, () => {
    api.reset();
    const runId = service.getCurrentRunId();
    const result = api.simulateMonths(horizon, false);
    assert.equal(result.monthNumber, horizon, `horizonte econômico esperado ${horizon}, obtido ${result.monthNumber}`);
    const history = service.getRunHistory(runId);
    assert.equal(history.length, horizon);
    assert.deepEqual(Array.from(history, (record) => record.month), Array.from({ length: horizon }, (_, index) => index + 1));
    assert.ok(history.every((record) => record.runId === runId));

    const latest = history[history.length - 1];
    const state = api.stateSnapshot();
    const macro = api.calculateNationalAccounts();
    const labor = api.getLaborStats();
    const core = runtime.snapshot();
    const society = app.window.VilarejoSocietyRuntime.getSnapshot();
    const politics = app.window.VilarejoPoliticsRuntime.getSnapshot();
    const institutions = app.window.VilarejoInstitutionsRuntime.getSnapshot();
    const storedHistory = service.getHistoryStoreSnapshot(runId);
    const civilDate = app.window.VilarejoCalendar.simulationDayToCivilDate(latest.day);
    assert.equal(latest.month, state.monthNumber);
    assert.equal(latest.day, state.day);
    assert.ok(Number.isFinite(latest.day));
    assert.equal(core.calendar.absoluteDay, latest.day);
    assert.equal(core.calendar.economicMonthNumber, latest.month);
    assert.equal(politics.currentMonth, latest.month);
    assert.equal(institutions.currentMonth, latest.month);
    assert.equal(society.demographicEvents.lastMonth.month, latest.month);
    assert.equal(storedHistory.activeSessionId, runId);
    assert.equal(storedHistory.records.length, horizon);
    assert.equal(storedHistory.records[storedHistory.records.length - 1].period.monthNumber, latest.month);
    assert.equal(storedHistory.records[storedHistory.records.length - 1].period.absoluteDay, latest.day);
    assert.equal(civilDate.simDay, latest.day);
    assert.ok(civilDate.civilYear >= 2026 && civilDate.civilMonth >= 1 && civilDate.civilMonth <= 12);
    assert.equal(latest.metrics.gdpProduction, macro.approaches.production);
    assert.equal(latest.metrics.gdpIncome, macro.approaches.income);
    assert.equal(latest.metrics.unemploymentRate, labor.unemploymentRate);
    assert.equal(latest.metrics.employmentCount, labor.occupied);
    assert.equal(latest.metrics.population, core.population.totals.total);
    assert.equal(latest.metrics.populationSociety, society.demographic.population);
    assert.equal(latest.metrics.inflationMonthly, state.monthlyInflation);
    assert.equal(latest.metrics.immigrationMonthly, society.migration.monthly.incoming);
    assert.equal(latest.metrics.emigrationMonthly, society.migration.monthly.outgoing);

    const historyBeforeReplay = service.getRunHistory(runId).length;
    // Reprocessa o payload do último fechamento já gerado pelo motor; não publica nem fabrica evento.
    service.recordMonthClosure({ monthNumber: result.monthNumber, day: result.day, population: { total: core.population.totals.total } });
    assert.equal(service.getRunHistory(runId).length, historyBeforeReplay);
    assert.equal(service.getRunHistory(runId).filter((record) => record.month === horizon).length, 1);
  });
}

test("Runtime registra Inteligência como adapter sem alterar o estado econômico", () => {
  const coreSnapshot = runtime.snapshot();
  assert.ok(coreSnapshot.modules.some((module) => module.id === "inteligencia" && module.version === "1.0.0"));
  assert.ok(coreSnapshot.modules.some((module) => module.id === "politica"));
  assert.ok(coreSnapshot.modules.some((module) => module.id === "instituicoes"));
  assert.equal(service.getRunHistory().length, 60);
  assert.equal(api.stateSnapshot().monthNumber, 60);
  assert.equal(app.window.VilarejoServicesRuntime, undefined, "a main não publica módulo de serviços históricos");
});

test("Dashboard mantém navegação Governo/Inteligência e renderiza gráficos, alertas e indisponibilidades", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(app.window.VilarejoDashboard);
  assert.match(html, /data-view="government"/);
  assert.match(html, /data-view-panel="government"/);
  app.window.VilarejoDashboard.setView("government");
  assert.equal(app.document.getElementById("pageTitle").textContent, "Governo");
  const governmentSummary = app.document.getElementById("governmentSummaryCard").innerHTML;
  const institutionSnapshot = app.window.VilarejoInstitutionsRuntime.getSnapshot();
  assert.match(governmentSummary, /Situação da Base de Governo/);
  assert.ok(governmentSummary.includes(`${institutionSnapshot.alignment.oppositionSeats} <small>/ ${institutionSnapshot.summary.totalSeats} cadeiras</small>`));
  assert.match(governmentSummary, /13º <small>mês de 48/);
  app.window.VilarejoDashboard.setView("intelligence");
  assert.equal(app.document.getElementById("pageTitle").textContent, "Central de Inteligência");
  const rendered = app.document.getElementById("intelligenceDashboard").innerHTML;
  assert.match(rendered, /class="intel-shell"/);
  assert.match(rendered, /<svg/);
  assert.match(rendered, /ALERTAS/);
  assert.match(rendered, /Série histórica indisponível/);
  const active = service.getAlerts().filter((alert) => alert.status === "ativo" && alert.severity !== "informativo");
  if (active.length === 0) assert.match(rendered, /Nenhum alerta persistente ativo/);
  else active.forEach((alert) => assert.ok(rendered.includes(alert.indicator)));
});

test("reset cria nova execução e preserva a anterior para consulta", () => {
  const priorId = service.getCurrentRunId();
  const priorHistory = service.getRunHistory(priorId);
  api.reset();
  const newId = service.getCurrentRunId();
  assert.notEqual(newId, priorId);
  assert.equal(service.getRunHistory(newId).length, 0);
  assert.equal(service.getHistoryStoreSnapshot(newId).records.length, 0);
  assert.equal(service.getRunHistory(priorId).length, priorHistory.length);
  assert.equal(service.getHistoryStoreSnapshot(priorId).records.length, priorHistory.length);
  assert.equal(service.getRun(priorId).status, "archived");
});

test("reload do app arquiva a série anterior quando o estado econômico reinicia", () => {
  const previousId = service.getCurrentRunId();
  api.simulateMonths(3, false);
  const previousRecords = service.getRunHistory(previousId);
  const reloaded = createIntegratedSimulation({ localStorage, sessionStorage });
  const reloadedService = reloaded.window.VilarejoIntelligenceRuntime.service;
  assert.notEqual(reloadedService.getCurrentRunId(), previousId);
  assert.equal(reloaded.window.VilarejoTest.stateSnapshot().monthNumber, 0);
  assert.equal(reloadedService.getRunHistory().length, 0);
  assert.equal(reloadedService.getRunHistory(previousId).length, previousRecords.length);
  assert.equal(reloadedService.getHistoryStoreSnapshot(previousId).records.length, previousRecords.length);
  assert.equal(reloadedService.getRun(previousId).status, "archived");
});

test("métricas mensais não são confundidas com acumulados e fontes ausentes não viram séries", () => {
  const definitions = new Map(app.window.VilarejoIntelligence.METRICS.map((metric) => [metric.id, metric]));
  assert.equal(definitions.get("birthsMonthly").kind, "monthly-flow");
  assert.equal(definitions.get("birthsCumulative").kind, "cumulative");
  assert.equal(definitions.get("immigrationMonthly").kind, "monthly-flow");
  assert.equal(definitions.get("immigrationCumulative").kind, "cumulative");
  assert.equal(definitions.has("incomeGini"), false);
  assert.equal([...definitions.keys()].some((id) => id.startsWith("service")), false);
  assert.equal(typeof app.window.VilarejoIntelligence.renderDashboard, "function");
});

console.log(`Resultado integração Inteligência: ${passed} cenários aprovados; ${process.exitCode ? "há falhas" : "0 reprovados"}.`);
