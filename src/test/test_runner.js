"use strict";

const fs = require("node:fs");
const path = require("node:path");
const EventosV3 = require("../events/eventos_v3.js");
const VilarejoCore = require("../core/vilarejo_core.js");
const { createSimulationContext } = require("./simulation_context.js");

const ROOT = path.join(__dirname, "../../");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const loadedScripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
const failures = [];
let passed = 0;

function report(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}${detail ? `: ${detail}` : ""}`);
  } else {
    failures.push(name);
    console.error(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
  }
}

console.log("\n=== VERIFICAÇÕES ESTRUTURAIS ===");
report("A página carrega o núcleo central exatamente uma vez", loadedScripts.filter((src) => src === "src/core/vilarejo_core.js").length === 1);
report("O núcleo central vem antes dos eventos e da economia", loadedScripts.indexOf("src/core/vilarejo_core.js") >= 0 && loadedScripts.indexOf("src/core/vilarejo_core.js") < loadedScripts.indexOf("src/events/eventos_v3.js") && loadedScripts.indexOf("src/events/eventos_v3.js") < loadedScripts.indexOf("src/economy/vilarejo_economy.js"));
report("A página carrega vilarejo_economy.js exatamente uma vez", loadedScripts.filter((src) => src === "src/economy/vilarejo_economy.js").length === 1);
const expectedScripts = [
  "src/core/vilarejo_core.js",
  "src/shared/vilarejo_history_store.js",
  "src/events/eventos_v3.js",
  "src/economy/vilarejo_economy.js",
  "src/society/vilarejo_society.js",
  "src/politics/vilarejo_politics.js",
  "src/institutions/vilarejo_institutions.js",
  "src/services/vilarejo_services.js",
  "src/world/vilarejo_world_engine.js",
  "src/newspaper/vilarejo_newspaper.js",
  "src/intelligence/vilarejo_intelligence.js",
  "src/intelligence/intelligence_view.js",
  "src/ui/decision_observer.js",
  "src/ui/dashboard.js"
];
report("Todos os scripts carregam uma única vez na ordem completa do contrato", JSON.stringify(loadedScripts) === JSON.stringify(expectedScripts));
report("A página inclui o stylesheet principal liberado explicitamente pelo servidor", /<link\b[^>]*href=["']style\.css["']/i.test(html) && /new Set\(\["index\.html",\s*"style\.css"\]\)/.test(fs.readFileSync(path.join(ROOT, "server.js"), "utf8")));
const serverSource = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
const runtimeDirectorySource = serverSource.match(/const RUNTIME_SRC_DIRS = new Set\(\[([\s\S]*?)\]\);/)?.[1] || "";
const requiredRuntimeDirectories = ["core", "economy", "events", "institutions", "intelligence", "newspaper", "politics", "services", "shared", "society", "ui", "world"];
report("O servidor permite somente módulos de runtime e assets públicos", requiredRuntimeDirectories.every((name) => runtimeDirectorySource.includes(`\"${name}\"`)) && !runtimeDirectorySource.includes("\"test\"") && /PUBLIC_ASSET_EXTENSIONS/.test(serverSource));
report("A página declara idioma português", /<html\s+lang=["']pt-BR["']/i.test(html));
report("O executor de testes não depende de jsdom", !/require\(["']jsdom["']\)/.test(fs.readFileSync(path.join(ROOT, "src/test/test_runner.js"), "utf8")));

console.log("\n=== NÚCLEO CENTRAL MODULAR ===");
try {
  const core = VilarejoCore.createRuntime({ calendar: { daysPerMonth: 30, monthsPerYear: 12 } });
  report("Núcleo registra seu próprio módulo", core.modules.has("core"));
  core.modules.register({ id: "economia", version: "3.0.0", dependencies: ["core"] });
  report("Contrato de módulo valida dependências e registra Economia", core.modules.has("economia"));
  let received = 0;
  const unsubscribe = core.events.on("test:message", (event) => { if (event.payload.value === 42) received += 1; });
  core.publish("test:message", { value: 42 }, "test");
  unsubscribe();
  core.publish("test:message", { value: 7 }, "test");
  report("Barramento entrega eventos e permite cancelar inscrição", received === 1);
  core.clock.reset(149, 0);
  core.clock.sync(150, 1);
  core.clock.sync(151, 1);
  const date = core.clock.snapshot();
  report("Calendário converte dia absoluto em ano, mês e dia", date.year === 1 && date.month === 6 && date.day === 1);
  const population = core.population.syncFromEconomy([
    { id: 1, name: "Grupo A", adults: 2, children: 1, jobs: 1, happiness: 60 },
    { id: 2, name: "Grupo B", adults: 1, children: 2, jobs: 1, happiness: 50 }
  ], 151);
  report("Diretório populacional consolida famílias sem depender de dados de interface", population.totals.total === 6 && population.totals.adults === 3 && population.totals.children === 3);
  const populationBeforeDuplicate = JSON.stringify(core.population.getSnapshot());
  let duplicateIdsRejected = false;
  try { core.population.syncFromEconomy([{ id: 7, adults: 1 }, { id: "7", adults: 2 }], 152); } catch (error) { duplicateIdsRejected = /duplicado/.test(error.message); }
  report("Diretório rejeita IDs duplicados após normalização sem mutação parcial", duplicateIdsRejected && JSON.stringify(core.population.getSnapshot()) === populationBeforeDuplicate);
  const atomicCore = VilarejoCore.createRuntime();
  atomicCore.modules.register({ id: "economia", version: "3.0.0", dependencies: ["core"] });
  const originalHouseholds = [
    { id: 1, name: "Família Original A", type: "family", adults: 2, children: 1, jobs: 1, happiness: 60 },
    { id: 2, name: "Família Original B", type: "family", adults: 1, children: 2, jobs: 1, happiness: 55 }
  ];
  const validEconomicState = { day: 149, monthNumber: 0, owner: "state", accounts: { treasury: 100 }, marketPrice: 10, fx: 5, households: originalHouseholds };
  atomicCore.syncFromEconomy(validEconomicState, "atomic-baseline");
  atomicCore.population.addExtension("1", "test", { retained: true });
  const beforeInvalidSync = JSON.stringify(atomicCore.snapshot());
  const invalidEconomicStates = [
    { ...validEconomicState, day: 180, monthNumber: 1, households: null },
    { ...validEconomicState, day: 180, monthNumber: 1, households: [originalHouseholds[0], { ...originalHouseholds[1], id: "1" }] },
    { ...validEconomicState, day: 180, monthNumber: 1, households: [{ ...originalHouseholds[0], adults: -1 }, originalHouseholds[1]] },
    { ...validEconomicState, day: 180, monthNumber: 1, accounts: { treasury: "100" } },
    { ...validEconomicState, day: 180, monthNumber: 1, fx: Infinity },
    { ...validEconomicState, day: 180.5, monthNumber: 1 },
    { ...validEconomicState, day: 180, monthNumber: "1" },
    { ...validEconomicState, day: 180, monthNumber: 1, gameOver: true }
  ];
  let rejectedEveryInvalidSync = true;
  let stateUnchangedAfterInvalidSyncs = true;
  for (const invalidState of invalidEconomicStates) {
    try { atomicCore.syncFromEconomy(invalidState, "invalid-regression"); rejectedEveryInvalidSync = false; } catch (_) {}
    if (JSON.stringify(atomicCore.snapshot()) !== beforeInvalidSync) stateUnchangedAfterInvalidSyncs = false;
  }
  report("syncFromEconomy rejeita entradas inválidas sem alterar calendário, população, eventos ou snapshots", rejectedEveryInvalidSync && stateUnchangedAfterInvalidSyncs);
  const preservedHouseholds = atomicCore.population.getSnapshot().groups;
  report("Sincronização inválida preserva os domicílios originais e extensões", preservedHouseholds.length === 2 && preservedHouseholds[0].label === "Família Original A" && preservedHouseholds[0].extensions.test.retained === true && preservedHouseholds[1].label === "Família Original B");
  report("Diretório preserva extensões de outros módulos", core.population.addExtension("1", "sociedade", { escolaridade: "média" }) && core.population.getSnapshot().groups[0].extensions.sociedade.escolaridade === "média");
  core.session.reset({ day: 40 });
  report("Reiniciar a partida limpa os dados populacionais e reinicia a sessão", core.population.getSnapshot().totals.total === 0 && core.clock.snapshot().absoluteDay === 40 && core.session.get().status === "ready");
  let listenerFailureIsolated = false;
  core.events.on("test:isolation", () => { throw new Error("falha isolada"); });
  const isolated = core.publish("test:isolation", {});
  listenerFailureIsolated = isolated.errors.length === 1;
  report("Falha de listener não interrompe o barramento", listenerFailureIsolated);
} catch (error) {
  report("Execução do núcleo central", false, error.stack || String(error));
}

console.log("\n=== SUÍTE INTERNA DO MOTOR ECONÔMICO ===");
let simulation;
try {
  simulation = createSimulationContext();
  const api = simulation.window.VilarejoTest;
  if (!api || typeof api.runStressTests !== "function") throw new Error("window.VilarejoTest não foi inicializado");

  const initialCore = api.getCoreSnapshot();
  report("Economia registra-se no núcleo central", initialCore.modules.some((module) => module.id === "economia" && module.version === "3.0.0"));
  report("Runtime compartilhado fica disponível para módulos futuros", !!simulation.window.VilarejoRuntime && simulation.window.VilarejoRuntime.modules.has("economia"));
  report("Estado inicial compartilha calendário e população", initialCore.calendar.absoluteDay === 149 && initialCore.population.totals.total === 10 && initialCore.population.totals.adults === 6);

  const result = api.runStressTests();
  for (const item of result.results) {
    report(item.name, item.passed, item.passed ? "aprovado" : JSON.stringify(item.detail || item.error));
  }
  report(`Total da suíte interna (${result.passed}/${result.total})`, result.passed === result.total);

  console.log("\n=== SIMULAÇÃO INTEGRADA DE CONTROLE ===");
  api.reset();
  const sixMonths = api.simulateMonths(6, false);
  const sixOk = sixMonths.monthNumber === 6 && sixMonths.cashAudit.ok &&
    sixMonths.balanceSheets.audit.allPass && sixMonths.nationalAccounts.reconciliation.reconciled;
  report("Seis meses: caixa, SFC e três óticas do PIB", sixOk,
    `mês=${sixMonths.monthNumber}; diferença de caixa=${sixMonths.cashAudit.difference.toFixed(8)}`);

  api.reset();
  const twelveMonths = api.simulateMonths(12, false);
  report("12 meses: caixa, SFC e três óticas do PIB", twelveMonths.monthNumber === 12 && twelveMonths.cashAudit.ok, `mês=${twelveMonths.monthNumber}; diferença de caixa=${twelveMonths.cashAudit.difference.toFixed(8)}`);

  api.reset();
  const twentyFourMonths = api.simulateMonths(24, false);
  report("24 meses: caixa, SFC e três óticas do PIB", twentyFourMonths.monthNumber === 24 && twentyFourMonths.cashAudit.ok, `mês=${twentyFourMonths.monthNumber}; diferença de caixa=${twentyFourMonths.cashAudit.difference.toFixed(8)}`);

  api.reset();
  const sixtyMonths = api.simulateMonths(60, false);
  report("60 meses: caixa, SFC e três óticas do PIB", sixtyMonths.monthNumber === 60 && sixtyMonths.cashAudit.ok, `mês=${sixtyMonths.monthNumber}; diferença de caixa=${sixtyMonths.cashAudit.difference.toFixed(8)}`);

  api.reset();
  const natural = api.simulateMonths(120, false);
  const naturalOk = natural.monthNumber >= 12 && natural.monthNumber <= 120 &&
    (Boolean(natural.gameOver) || natural.monthNumber === 120) &&
    natural.cashAudit.ok && natural.balanceSheets.audit.allPass &&
    natural.nationalAccounts.reconciliation.reconciled;
  report("Até 120 meses naturais: paradas, auditoria patrimonial e reconciliação",
    naturalOk,
    `meses concluídos=${natural.monthNumber}; encerramento=${natural.gameOver || "horizonte de 120 meses"}`);

  api.reset();
  const longRun = api.simulateMonths(240, false);
  const longRunOk = longRun.monthNumber === 240 && !longRun.gameOver && longRun.cashAudit.ok &&
    longRun.balanceSheets.audit.allPass && longRun.nationalAccounts.reconciliation.reconciled &&
    longRun.eventMonth === 240;
  report("240 meses naturais: continuidade, caixa, SFC, PIB e eventos integrados", longRunOk,
    `meses=${longRun.monthNumber}; gameOver=${longRun.gameOver || "não"}; eventos=${longRun.eventMonth}; caixa=${longRun.cashAudit.difference.toExponential(2)}`);

  const seedSweep = [1, 7, 17, 23, 42, 77, 99, 123, 256, 512, 1024, 2026,
    31337, 65535, 8675309, 123456789, 314159, 271828, 999999, 20261101,
    20261231, 86753090, 13579, 24680];
  const seedFailures = [];
  for (const seed of seedSweep) {
    api.resetWithSeed(seed);
    const scenario = api.simulateMonths(240, false);
    const scenarioOk = scenario.monthNumber === 240 && !scenario.gameOver && scenario.cashAudit.ok &&
      scenario.balanceSheets.audit.allPass && scenario.nationalAccounts.reconciliation.reconciled &&
      scenario.eventMonth === 240;
    if (!scenarioOk) seedFailures.push({ seed, month: scenario.monthNumber, gameOver: scenario.gameOver });
  }
  report("Robustez: 24 sementes × 240 meses sem colapso ou divergência", seedFailures.length === 0,
    seedFailures.length ? JSON.stringify(seedFailures) : "5.760 meses-simulação aprovados; caixa, SFC, PIB e eventos íntegros");

  api.reset();
  const eventEngine = simulation.window.EventosV3;
  const eventRun = api.simulateMonths(18, false);
  report("Eventos acompanham o calendário econômico mês a mês", eventRun.eventMonth === 18,
    `motor econômico=${eventRun.monthNumber}; motor de eventos=${eventRun.eventMonth}`);

  api.reset();
  const stress120 = api.simulateMonths(120, true);
  const stress120Ok = stress120.monthNumber === 120 && stress120.cashAudit.ok &&
    stress120.balanceSheets.audit.allPass && stress120.nationalAccounts.reconciliation.reconciled;
  report("Stress test de 120 meses após fim de jogo: SFC, caixa e PIB", stress120Ok,
    `meses simulados=${stress120.monthNumber}; crédito total=${stress120.loans.toFixed(2)}; diferença de caixa=${stress120.cashAudit.difference.toExponential(2)}`);

  api.reset();
  const coreBefore = api.getCoreEventCount("economy:month-closed");
  const coreRun = api.simulateMonths(3, false);
  const integratedCore = api.getCoreSnapshot();
  const monthEvents = api.getCoreEventCount("economy:month-closed") - coreBefore;
  report("Núcleo acompanha três fechamentos mensais da Economia", monthEvents === 3 && integratedCore.modules.some((module) => module.id === "economia"));
  report("Núcleo mantém população consistente após a simulação", integratedCore.population.totals.total === integratedCore.population.totals.adults + integratedCore.population.totals.children && integratedCore.population.totals.groups === integratedCore.population.groups.length && integratedCore.population.groups.reduce((sum, group) => sum + group.population, 0) === integratedCore.population.totals.total && integratedCore.population.totals.total >= 10);
  report("Calendário central acompanha o dia absoluto do motor econômico", integratedCore.calendar.absoluteDay === coreRun.day && integratedCore.calendar.economicMonthNumber === coreRun.monthNumber);
} catch (error) {
  report("Inicialização e execução do motor econômico", false, error.stack || String(error));
}

console.log("\n=== MOTOR DE EVENTOS V3 (MÓDULO INTEGRADO) ===");
try {
  const stateA = EventosV3.novoEstado({ semente: 2026 });
  const stateB = EventosV3.novoEstado({ semente: 2026 });
  for (let month = 0; month < 120; month += 1) {
    EventosV3.processarMes(stateA, 2, { calcularEconomia: false });
    EventosV3.processarMes(stateB, 2, { calcularEconomia: false });
  }
  const saved = EventosV3.salvarEstado(stateA);
  const restored = EventosV3.carregarEstado(saved);
  const deterministic = EventosV3.salvarEstado(stateA) === EventosV3.salvarEstado(stateB);
  report("Eventos: 120 ciclos sem erro e estado numérico válido",
    stateA.mes === 120 && Number.isFinite(stateA.caixa) && Array.isArray(stateA.log));
  report("Eventos: execução determinística com a mesma semente", deterministic);
  report("Eventos: serialização e restauração preservam o estado",
    restored.mes === stateA.mes && restored.semente === stateA.semente &&
    restored.log.length === stateA.log.length && restored.ativos.length === stateA.ativos.length);
  report("Catálogo de eventos disponível", Array.isArray(EventosV3.EVENTOS) && EventosV3.EVENTOS.length > 0,
    `${EventosV3.EVENTOS.length} eventos cadastrados`);
} catch (error) {
  report("Execução do motor de eventos V3", false, error.stack || String(error));
}

console.log(`\nResultado: ${passed} verificações aprovadas; ${failures.length} reprovadas.`);
if (failures.length) {
  console.error("Falhas:", failures.join(" | "));
  process.exitCode = 1;
}
