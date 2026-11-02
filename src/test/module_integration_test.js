"use strict";

const assert = require("node:assert/strict");
const { createSimulationContext } = require("./simulation_context.js");

const MODULE_IDS = [
  "core", "economia", "sociedade", "politica", "instituicoes",
  "saude", "educacao", "seguranca", "ciencia", "desenvolvimento",
  "cultura", "infraestrutura", "servicos"
];
const MONTHLY_TOPICS = [
  "economy:month-closed",
  "society:month-closed",
  "politics:month-closed",
  "institutions:month-closed",
  "services:month-closed"
];
const ORIGINAL_FAMILY_IDS = ["1", "2", "3", "4"];
const STARTING_DAY = 149;
const MIGRATION_SEED = 42;

function makeIntegratedGame(seed) {
  const context = createSimulationContext({ includeDomainModules: true });
  const app = context.window.VilarejoTest;
  const runtime = context.window.VilarejoRuntime;
  const adapters = {
    society: context.window.VilarejoSocietyRuntime,
    politics: context.window.VilarejoPoliticsRuntime,
    institutions: context.window.VilarejoInstitutionsRuntime,
    services: context.window.VilarejoServicesRuntime
  };
  assert.ok(app && typeof app.simulateMonths === "function", "o harness expõe a Economia real");
  assert.ok(runtime, "Economia criou o Runtime real");
  for (const id of MODULE_IDS) assert.equal(runtime.modules.has(id), true, `módulo ${id} registrado no VM compartilhado`);
  assert.ok(Object.values(adapters).every((adapter) => adapter && adapter.state), "os quatro adapters carregaram os módulos reais");
  app.resetWithSeed(seed);
  return { context, app, runtime, adapters };
}

function readTopicCounts(app) {
  return Object.fromEntries(MONTHLY_TOPICS.map((topic) => [topic, app.getCoreEventCount(topic)]));
}

function assertResetState(game, previousResetCount) {
  const { app, runtime, adapters } = game;
  const economy = app.stateSnapshot();
  const core = app.getCoreSnapshot();
  const population = runtime.population.getSnapshot();
  assert.equal(economy.day, STARTING_DAY, "Economia reinicia no dia inicial");
  assert.equal(economy.monthNumber, 0, "Economia reinicia no mês zero");
  assert.equal(runtime.clock.snapshot().absoluteDay, STARTING_DAY, "calendário do Core acompanha o reset");
  assert.equal(runtime.clock.snapshot().economicMonthNumber, 0, "contador mensal do Core acompanha o reset");
  assert.equal(population.lastSynchronizedDay, STARTING_DAY, "população do Core é sincronizada após o reset");
  assert.deepEqual(Array.from(population.groups, (group) => group.id).sort(), ORIGINAL_FAMILY_IDS, "reset restaura as quatro famílias da partida");
  assert.equal(population.groups.some((group) => group.migrant), false, "reset remove migrantes da partida anterior");
  assert.equal(adapters.society.state.currentMonth, 0, "Sociedade reinicia no mês zero");
  assert.equal(adapters.politics.state.currentMonth, 0, "Política reinicia no mês zero");
  assert.equal(adapters.institutions.state.currentMonth, 0, "Instituições reinicia no mês zero");
  assert.equal(adapters.services.state.currentMonth, 0, "Serviços reinicia no mês zero");
  assert.equal(adapters.society.getSnapshot().demographic.foreignBorn, 0, "Sociedade não retém imigrantes do jogo anterior");
  assert.equal(core.session.resetCount, previousResetCount + 1, "reset real do jogo incrementa o contador de sessões");
  for (const id of ["economia", "sociedade", "politica", "instituicoes", "servicos"]) {
    assert.ok(runtime.modules.get(id).snapshot, `snapshot de ${id} existe após a reinicialização`);
  }
}

function simulateAndVerifyMonths(game, horizon) {
  const { app, runtime, adapters } = game;
  const initialPopulation = runtime.population.getSnapshot();
  const originalIds = Array.from(initialPopulation.groups, (group) => group.id).filter((id) => ORIGINAL_FAMILY_IDS.includes(id));
  assert.deepEqual(originalIds.sort(), ORIGINAL_FAMILY_IDS, "partida integrada começa com as quatro famílias originais");
  const seenMigrants = new Set();
  const migrationTimeline = [];
  let lastState = null;

  for (let month = 1; month <= horizon; month += 1) {
    const countsBefore = readTopicCounts(app);
    const state = app.simulateMonths(1, false);
    const countsAfter = readTopicCounts(app);
    const expectedDay = STARTING_DAY + 30 * month;
    lastState = state;

    assert.equal(state.monthNumber, month, `Economia fecha o mês ${month} sem parada antecipada`);
    assert.equal(state.day, expectedDay, `dia econômico do fechamento ${month}`);
    assert.equal(state.gameOver, null, `partida segue ativa até o horizonte de ${horizon} meses`);
    for (const topic of MONTHLY_TOPICS) {
      assert.equal(countsAfter[topic] - countsBefore[topic], 1, `${topic} ocorre uma vez no mês ${month}`);
    }

    const calendar = runtime.clock.snapshot();
    const population = runtime.population.getSnapshot();
    const core = app.getCoreSnapshot();
    const economyModule = runtime.modules.get("economia").snapshot;
    assert.equal(calendar.absoluteDay, state.day, `calendário do Core sincronizado no mês ${month}`);
    assert.equal(calendar.economicMonthNumber, month, `mês econômico do Core sincronizado no mês ${month}`);
    assert.equal(population.lastSynchronizedDay, state.day, `snapshot populacional sincronizado no mês ${month}`);
    assert.equal(core.calendar.absoluteDay, state.day, `snapshot geral do Core sincronizado no mês ${month}`);
    assert.equal(economyModule.day, state.day, `snapshot do módulo Economia atualizado no mês ${month}`);
    assert.equal(economyModule.monthNumber, month, `snapshot do módulo Economia no mês ${month}`);
    assert.equal(JSON.stringify(economyModule.population), JSON.stringify(population.totals), `totais econômicos e populacionais do Core coincidem no mês ${month}`);
    assert.equal(population.totals.adults, state.laborStats.pit, `adultos sincronizados com a força de trabalho real no mês ${month}`);
    assert.equal(population.totals.total, population.totals.adults + population.totals.children, `total populacional consistente no mês ${month}`);
    assert.equal(population.totals.groups, population.groups.length, `quantidade de grupos consistente no mês ${month}`);
    assert.equal(population.groups.reduce((sum, group) => sum + group.population, 0), population.totals.total, `grupos somam o total populacional no mês ${month}`);

    const economyIds = Array.from(population.groups, (group) => group.id);
    assert.equal(new Set(economyIds).size, economyIds.length, `Economia/Core sem domicílios duplicados no mês ${month}`);
    for (const id of ORIGINAL_FAMILY_IDS) assert.ok(economyIds.includes(id), `família original ${id} preservada no mês ${month}`);

    const socialHouseholds = adapters.society.state.households;
    const socialIds = Array.from(socialHouseholds, (household) => String(household.id));
    assert.equal(new Set(socialIds).size, socialIds.length, `Sociedade sem domicílios duplicados no mês ${month}`);
    for (const id of economyIds) assert.ok(socialIds.includes(id), `domicílio econômico ${id} reconciliado na Sociedade no mês ${month}`);
    for (const id of ORIGINAL_FAMILY_IDS) assert.ok(socialIds.includes(id), `Sociedade preserva família original ${id} no mês ${month}`);
    const personIds = socialHouseholds.flatMap((household) => household.members.map((person) => person.id));
    assert.equal(new Set(personIds).size, personIds.length, `Sociedade sem pessoas duplicadas no mês ${month}`);

    for (const [name, adapter] of Object.entries(adapters)) {
      assert.equal(adapter.state.currentMonth, month, `${name} fecha o mês ${month}`);
      const moduleId = { society: "sociedade", politics: "politica", institutions: "instituicoes", services: "servicos" }[name];
      const registeredSnapshot = runtime.modules.get(moduleId).snapshot;
      const adapterSnapshot = adapter.getSnapshot();
      assert.ok(registeredSnapshot, `snapshot de ${moduleId} publicado no mês ${month}`);
      assert.equal(registeredSnapshot.currentMonth, month, `snapshot de ${moduleId} está no mês ${month}`);
      assert.equal(JSON.stringify(registeredSnapshot), JSON.stringify(adapterSnapshot), `snapshot registrado de ${moduleId} coincide com o adapter no mês ${month}`);
    }

    assert.equal(state.cashAudit.ok, true, `conservação de caixa da Economia no mês ${month}`);
    assert.ok(Math.abs(state.cashAudit.difference) < 0.01, `diferença de caixa dentro da tolerância no mês ${month}`);
    assert.equal(state.balanceSheets.audit.allPass, true, `nove verificações patrimoniais/SFC no mês ${month}`);
    assert.equal(state.balanceSheets.audit.intersectoralDebtCreditZeroSum, true, `saldos intersetoriais reconciliados no mês ${month}`);
    assert.equal(state.nationalAccounts.reconciliation.reconciled, true, `contas nacionais reconciliadas no mês ${month}`);
    for (const approach of ["production", "income", "expenditure"]) {
      assert.ok(Number.isFinite(state.nationalAccounts.approaches[approach]), `ótica ${approach} finita no mês ${month}`);
    }

    for (const group of population.groups.filter((entry) => entry.migrant)) {
      const household = socialHouseholds.find((entry) => String(entry.id) === group.id);
      assert.ok(household, `migrante ${group.id} presente na Sociedade no mês ${month}`);
      if (seenMigrants.has(group.id)) continue;
      seenMigrants.add(group.id);
      const migrantPerson = household.members.find((person) => person.bornHere === false && person.origin === "migração econômica");
      assert.ok(migrantPerson, `pessoa migrante ${group.id} marcada como migração econômica`);
      assert.equal(migrantPerson.arrivalMonth, month, `mês de chegada real preservado para ${group.id}`);
      assert.equal(migrantPerson.monthsInVillage, 0, `mês de chegada não contado como residência completa para ${group.id}`);
      migrationTimeline.push({ month, id: group.id, arrivalMonth: migrantPerson.arrivalMonth });
    }
  }

  const finalPopulation = runtime.population.getSnapshot();
  return {
    finalState: lastState,
    finalMonth: lastState?.monthNumber,
    groups: finalPopulation.groups.length,
    population: finalPopulation.totals.total,
    migrationTimeline
  };
}

for (const horizon of [12, 24]) {
  const game = makeIntegratedGame(MIGRATION_SEED);
  const result = simulateAndVerifyMonths(game, horizon);
  console.log(`✓ integração real Economia/Core/Sociedade/Política/Instituições/Serviços: ${horizon} meses, ${horizon} fechamentos e auditorias mensais aprovados; ${result.groups} domicílios, população ${result.population}`);
}

const migrationGame = makeIntegratedGame(MIGRATION_SEED);
const firstRun = simulateAndVerifyMonths(migrationGame, 60);
assert.ok(firstRun.migrationTimeline.length > 0, "seed 42 produz imigração pelo ciclo mensal real da Economia");
console.log(`✓ imigração endógena observada na Economia e reconciliada na Sociedade: ${firstRun.migrationTimeline.map(({ month, id }) => `${id}@${month}`).join(", ")}`);

const resetCountBefore = migrationGame.app.getCoreSnapshot().session.resetCount;
migrationGame.app.resetWithSeed(MIGRATION_SEED);
assertResetState(migrationGame, resetCountBefore);
console.log("✓ reset real via newGame: relógio, população e snapshots dos quatro módulos voltam ao estado inicial");

const replay = simulateAndVerifyMonths(migrationGame, 60);
assert.deepEqual(replay.migrationTimeline, firstRun.migrationTimeline, "mesma seed reproduz os mesmos meses e IDs de chegada após reset");
console.log("✓ cenário de imigração reproduzível: reset com a mesma seed repete IDs e meses de chegada");
console.log(`✓ integração real de 60 meses: 60 fechamentos mensais verificados em cada uma de duas execuções; ${replay.groups} domicílios, população ${replay.population}`);
