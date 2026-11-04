"use strict";

const assert = require("node:assert/strict");
const Politics = require("../politics/vilarejo_politics.js");

let passed = 0;
const failures = [];

function test(name, callback) {
  try {
    callback();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`  ✗ ${name}: ${error.stack || error}`);
  }
}

function samplePopulation() {
  return [
    { id: "h1", label: "Família A", category: "family", adults: 2, children: 1, employed: 1, happiness: 60 },
    { id: "h2", label: "Pessoa B", category: "single", adults: 1, children: 0, employed: 1, happiness: 65 }
  ];
}

function makeEventBus() {
  const listeners = new Map();
  return {
    on(topic, listener) {
      if (!listeners.has(topic)) listeners.set(topic, new Set());
      listeners.get(topic).add(listener);
      return () => listeners.get(topic)?.delete(listener);
    },
    emit(topic, payload = {}) {
      const event = { topic, payload: JSON.parse(JSON.stringify(payload)), source: "test" };
      for (const listener of Array.from(listeners.get(topic) || [])) listener(event);
      return event;
    }
  };
}

function createIntegratedRuntime() {
  const events = makeEventBus();
  const moduleMap = new Map([
    ["core", { id: "core", version: "0.1.0" }],
    ["economia", { id: "economia", version: "3.0.0" }]
  ]);
  let population = { totals: { groups: 0, adults: 0, children: 0, total: 0, employed: 0 }, groups: [], lastSynchronizedDay: null };
  let monthNumber = 0;
  const runtime = {
    events,
    modules: {
      has: (id) => moduleMap.has(id),
      register(descriptor) {
        if (moduleMap.has(descriptor.id)) throw new Error(`Módulo duplicado: ${descriptor.id}`);
        moduleMap.set(descriptor.id, { ...descriptor });
      },
      updateSnapshot(id, snapshot) {
        const record = moduleMap.get(id);
        if (!record) throw new Error(`Módulo ausente: ${id}`);
        record.snapshot = JSON.parse(JSON.stringify(snapshot));
        return record.snapshot;
      },
      get: (id) => moduleMap.get(id) || null
    },
    population: { getSnapshot: () => JSON.parse(JSON.stringify(population)) },
    clock: { snapshot: () => ({ economicMonthNumber: monthNumber }) },
    publish(topic, payload, source) { return events.emit(topic, { ...payload, _source: source || "test" }); },
    syncFromEconomy(economicState) {
      monthNumber = Number(economicState.monthNumber) || 0;
      const groups = economicState.households.map((household) => ({
        id: String(household.id),
        label: household.name || household.label,
        category: household.type || household.category,
        adults: Number(household.adults) || 0,
        children: Number(household.children) || 0,
        employed: Number(household.employed) || 0,
        happiness: Number(household.happiness) || 0,
        population: (Number(household.adults) || 0) + (Number(household.children) || 0)
      }));
      const totals = groups.reduce((result, group) => {
        result.groups += 1;
        result.adults += group.adults;
        result.children += group.children;
        result.total += group.population;
        result.employed += group.employed;
        return result;
      }, { groups: 0, adults: 0, children: 0, total: 0, employed: 0 });
      population = { totals, groups, lastSynchronizedDay: Number(economicState.day) || 1 };
      events.emit("world:synchronized", { population: totals });
      return population;
    },
    session: {
      reset() {
        monthNumber = 0;
        population = { totals: { groups: 0, adults: 0, children: 0, total: 0, employed: 0 }, groups: [], lastSynchronizedDay: null };
        events.emit("game:reset", { day: 1 });
      }
    }
  };
  runtime.syncFromEconomy({ day: 1, monthNumber: 0, households: samplePopulation() });
  const societyState = {
    households: [
      { id: "h1", members: [{ age: 32 }, { age: 35 }, { age: 8 }] },
      { id: "h2", members: [{ age: 41 }] }
    ]
  };
  const society = { state: societyState, dispose() {} };
  const politics = Politics.registerWithRuntime(runtime, { seed: 202, getSocietyState: () => society.state });
  return { runtime, society, politics };
}

console.log("\n=== POLÍTICA 1.0.0 ===");

test("inicializa os dez grupos de interesse previstos", () => {
  const state = Politics.createState({ seed: 1 });
  assert.equal(state.groups.length, 10);
  assert.ok(state.groups.some((group) => group.id === "workers"));
  assert.ok(state.groups.some((group) => group.id === "environmentalists"));
});

test("não inventa representatividade quando a base de dados não existe", () => {
  const snapshot = Politics.getSnapshot(Politics.createState());
  const finance = snapshot.groups.find((group) => group.id === "finance");
  assert.equal(finance.representedPopulation, null);
  assert.equal(finance.representativity, null);
  assert.equal(finance.measurement.status, "unavailable");
});

test("permite sobreposição de grupos sem somar duas vezes a população", () => {
  const state = Politics.createState();
  Politics.setComposition(state, {
    population: 100,
    source: "test-overlap",
    groups: {
      workers: { count: 60, evidenceLevel: "measured", basis: "Cadastro de teste" },
      middle_class: { count: 45, evidenceLevel: "estimated", basis: "Estimativa de teste" },
      vulnerable: { count: 20, evidenceLevel: "estimated", basis: "Estimativa de teste" }
    }
  });
  const snapshot = Politics.getSnapshot(state);
  assert.equal(snapshot.population.total, 100);
  assert.equal(snapshot.groups.find((group) => group.id === "workers").representativity, 60);
  assert.equal(snapshot.groups.find((group) => group.id === "middle_class").representativity, 45);
  assert.equal(snapshot.groups.find((group) => group.id === "vulnerable").representativity, 20);
  assert.equal(snapshot.groups.reduce((sum, group) => sum + (group.representativity || 0), 0), 125);
});

test("rejeita grupo representando mais pessoas que a população total", () => {
  const state = Politics.createState();
  assert.throws(() => Politics.setComposition(state, {
    population: 10,
    groups: { workers: { count: 11 } }
  }), RangeError);
});

test("não deixa uma composição inválida alterar parcialmente o estado", () => {
  const state = Politics.createState();
  Politics.setComposition(state, { population: 10, groups: { workers: { count: 4 } } });
  const before = JSON.stringify(state);
  assert.throws(() => Politics.setComposition(state, {
    population: 10,
    groups: { workers: { count: 5 }, finance: { count: 11 } }
  }), RangeError);
  assert.equal(JSON.stringify(state), before);
});

test("distingue poder econômico, organização e representatividade", () => {
  const state = Politics.createState();
  Politics.setComposition(state, { population: 100, groups: { workers: { count: 80 } } });
  const workers = state.groups.find((group) => group.id === "workers");
  const before = workers.influence;
  Politics.updateGroup(state, "workers", { organization: 90 });
  assert.ok(workers.influence > before);
  assert.equal(workers.representativity, 80);
  assert.equal(workers.economicPower, 32);
});

test("deriva somente uma estimativa transparente de população em idade ativa", () => {
  const corePopulation = {
    totals: { total: 5, adults: 3, children: 2 },
    groups: samplePopulation().map((group) => ({ ...group, population: group.adults + group.children }))
  };
  const societyState = {
    households: [
      { members: [{ age: 17 }, { age: 25 }, { age: 40 }, { age: 66 }] },
      { members: [{ age: 34 }] }
    ]
  };
  const derived = Politics.deriveComposition(corePopulation, societyState);
  assert.equal(derived.population, 5);
  assert.equal(derived.workingAge, 3);
  assert.equal(derived.groups.workers.count, 3);
  assert.match(derived.groups.workers.basis, /não separa ocupados/);
  assert.equal(derived.groups.business, undefined);
});

test("calibra a influência em escala limitada de zero a cem", () => {
  const state = Politics.createState();
  const group = state.groups.find((item) => item.id === "business");
  Politics.updateGroup(state, "business", {
    economicPower: 100, organization: 100, cohesion: 100,
    mobilizationCapacity: 100, institutionalAccess: 100
  });
  assert.equal(group.influence, 100);
  Politics.updateGroup(state, "business", {
    economicPower: 0, organization: 0, cohesion: 0,
    mobilizationCapacity: 0, institutionalAccess: 0
  });
  assert.equal(group.influence, 0);
});

test("registra impactos com evidência e atualiza relação com o governo", () => {
  const state = Politics.createState();
  const result = Politics.applyImpact(state, {
    groupId: "workers",
    month: 1,
    eventId: "state-enterprise-layoffs-1",
    source: "state-enterprise",
    reason: "Demissões após reestruturação da empresa estatal.",
    evidence: { jobsDelta: -12, enterpriseId: "energy-company" },
    channels: { satisfaction: -30, mobilizationCapacity: 8 }
  });
  assert.equal(result.group.satisfaction, 25);
  assert.equal(result.group.governmentRelation, "opposition");
  assert.equal(result.event.sourceEventId, "state-enterprise-layoffs-1");
  assert.equal(result.event.evidence.jobsDelta, -12);
});

test("limita impactos e ignora canais não reconhecidos", () => {
  const state = Politics.createState();
  const result = Politics.applyImpact(state, {
    groupId: "workers",
    channels: { satisfaction: -500, inventedMetric: 100 }
  });
  assert.equal(result.group.satisfaction, 0);
  assert.equal(Object.hasOwn(result.event.changes, "inventedMetric"), false);
});

test("aceita atualização de grupos e impede identificadores duplicados", () => {
  const state = Politics.createState();
  Politics.addGroup(state, { id: "transport_workers", name: "Trabalhadores do transporte", organization: 40 });
  assert.equal(state.groups.length, 11);
  assert.throws(() => Politics.addGroup(state, { id: "workers" }), /já existe/);
  assert.equal(Politics.removeGroup(state, "transport_workers"), true);
  assert.equal(Politics.removeGroup(state, "missing"), false);
});

test("permite fundir grupos sem somar automaticamente bases que podem se sobrepor", () => {
  const state = Politics.createState();
  Politics.setComposition(state, {
    population: 100,
    groups: {
      workers: { count: 60, evidenceLevel: "measured" },
      middle_class: { count: 40, evidenceLevel: "estimated" },
      vulnerable: { count: 20, evidenceLevel: "estimated" }
    }
  });
  const merged = Politics.mergeGroups(state, ["workers", "middle_class"], {
    id: "urban_workers",
    name: "Trabalhadores urbanos"
  });
  assert.equal(state.groups.some((group) => group.id === "workers"), false);
  assert.equal(state.groups.some((group) => group.id === "middle_class"), false);
  assert.equal(state.groups.find((group) => group.id === "vulnerable").representativity, 20);
  assert.equal(merged.representativity, null);
  assert.match(merged.description, /fusão/);
});

test("permite dividir um grupo com novas bases explicitamente informadas", () => {
  const state = Politics.createState();
  Politics.setComposition(state, { population: 100, groups: { business: { count: 20 } } });
  const split = Politics.splitGroup(state, "business", [
    { id: "small_business", name: "Pequenos empresários", representedPopulation: 14, basis: "Cadastro de teste" },
    { id: "large_business", name: "Grandes empresários", representedPopulation: 6, basis: "Cadastro de teste" }
  ]);
  assert.equal(split.length, 2);
  assert.equal(state.groups.some((group) => group.id === "business"), false);
  assert.equal(state.groups.find((group) => group.id === "small_business").representativity, 14);
  assert.equal(state.groups.find((group) => group.id === "large_business").representativity, 6);
});

test("fecha 60 meses sem extrapolar os limites dos indicadores", () => {
  const state = Politics.createState({ seed: 6060 });
  for (let month = 1; month <= 60; month += 1) {
    Politics.advanceMonth(state, {
      month,
      composition: {
        population: 100 + month,
        groups: {
          workers: { count: Math.min(100 + month, 60 + month / 2), evidenceLevel: "estimated", basis: "Série sintética de teste" }
        }
      }
    });
  }
  assert.equal(state.currentMonth, 60);
  assert.equal(state.history.length, 36);
  for (const group of state.groups) {
    for (const field of ["economicPower", "organization", "cohesion", "mobilizationCapacity", "satisfaction", "influence"]) {
      assert.ok(group[field] >= 0 && group[field] <= 100, `${group.id}.${field} fora da escala`);
    }
  }
});

test("fecha o mês uma única vez e rejeita retrocesso de calendário", () => {
  const state = Politics.createState();
  const first = Politics.advanceMonth(state, { month: 1, composition: { population: 50, groups: { workers: { count: 30 } } } });
  const saved = JSON.stringify(state);
  const second = Politics.advanceMonth(state, { month: 1, impacts: [{ groupId: "workers", channels: { satisfaction: -40 } }] });
  assert.equal(first.unchanged, false);
  assert.equal(second.unchanged, true);
  assert.equal(JSON.stringify(state), saved);
  assert.throws(() => Politics.advanceMonth(state, { month: 0 }), RangeError);
});

test("reproduz o mesmo resultado com a mesma semente e as mesmas entradas", () => {
  const a = Politics.createState({ seed: 55 });
  const b = Politics.createState({ seed: 55 });
  const options = {
    month: 1,
    composition: {
      population: 100,
      groups: { workers: { count: 60 }, business: { count: 8 } }
    },
    impacts: [{ groupId: "workers", channels: { satisfaction: -7, organization: 3 }, reason: "Acordo coletivo" }]
  };
  Politics.advanceMonth(a, options);
  Politics.advanceMonth(b, options);
  assert.equal(JSON.stringify(Politics.getSnapshot(a)), JSON.stringify(Politics.getSnapshot(b)));
});

test("renderiza painel sem inserir HTML não escapado", () => {
  const state = Politics.createState();
  Politics.updateGroup(state, "workers", { name: "Trabalhadores <script>alert(1)</script>" });
  const host = { innerHTML: "" };
  assert.equal(Politics.renderDashboard(state, host), true);
  assert.match(host.innerHTML, /&lt;script&gt;/);
  assert.doesNotMatch(host.innerHTML, /<script>alert/);
});

test("integra pelo contrato do Runtime sem alterar dados de entrada dos outros módulos", () => {
  const { runtime, society, politics } = createIntegratedRuntime();
  const populationBefore = runtime.population.getSnapshot().totals.total;
  const societyBefore = society.state.households.reduce((sum, household) => sum + household.members.length, 0);
  assert.equal(runtime.modules.has("politica"), true);
  assert.equal(politics.state.groups.length, 10);
  assert.equal(runtime.modules.get("politica").dependencies.includes("core"), true);
  assert.equal(runtime.population.getSnapshot().totals.total, populationBefore);
  assert.equal(society.state.households.reduce((sum, household) => sum + household.members.length, 0), societyBefore);
  politics.dispose();
  society.dispose();
});

test("processa um fechamento econômico e publica um fechamento político", () => {
  const { runtime, society, politics } = createIntegratedRuntime();
  let closed = 0;
  runtime.events.on("politics:month-closed", () => { closed += 1; });
  runtime.syncFromEconomy({ day: 31, monthNumber: 1, households: samplePopulation() }, "test-month");
  runtime.publish("economy:month-closed", { monthNumber: 1, day: 31 }, "test");
  assert.equal(politics.state.currentMonth, 1);
  assert.equal(closed, 1);
  assert.equal(politics.state.history.length, 1);
  politics.dispose();
  society.dispose();
});

test("consome impactos de estatais pelo contrato de evento sem editar a Economia", () => {
  const { runtime, society, politics } = createIntegratedRuntime();
  const before = runtime.population.getSnapshot().totals.total;
  runtime.publish("politics:interest-impact", {
    eventId: "tariff-increase-1",
    eventType: "state-enterprise-impact",
    month: 1,
    impacts: [{
      groupId: "merchants",
      channels: { satisfaction: -12, economicPower: -4 },
      reason: "Aumento tarifário elevou custos operacionais.",
      evidence: { tariffChangePercent: 15 }
    }]
  }, "test");
  const merchant = politics.state.groups.find((group) => group.id === "merchants");
  assert.equal(merchant.satisfaction, 43);
  assert.equal(merchant.governmentRelation, "neutral");
  assert.equal(runtime.population.getSnapshot().totals.total, before);
  assert.ok(politics.state.events.some((event) => event.sourceEventId === "tariff-increase-1"));
  politics.dispose();
  society.dispose();
});

test("reinicia com a partida e volta a sincronizar a composição", () => {
  const { runtime, society, politics } = createIntegratedRuntime();
  Politics.applyImpact(politics.state, { groupId: "workers", channels: { satisfaction: -35 } });
  runtime.session.reset({ day: 1 });
  assert.equal(politics.state.currentMonth, 0);
  assert.equal(politics.state.groups.find((group) => group.id === "workers").satisfaction, 55);
  runtime.syncFromEconomy({ day: 1, monthNumber: 0, households: samplePopulation() }, "test-restart");
  runtime.publish("game:initialized", { day: 1 }, "test");
  assert.equal(politics.state.population.total, 4);
  assert.equal(politics.state.lastProcessedMonth, null);
  politics.dispose();
  society.dispose();
});

test("catálogo de grupos de interesse: 10 grupos, 50 personagens, bônus e detecção de conflitos", () => {
  const catalog = Politics.getCharactersCatalog();
  assert.equal(catalog.grupos.length, 10, "Devem existir 10 grupos de interesse");
  assert.equal(catalog.personagens.length, 50, "Devem existir 50 personagens");

  const trab01 = Politics.getCharacterById("trab01");
  assert.equal(trab01.nome, "Vicente Almeida");
  assert.equal(trab01.grupo, "trabalhadores");
  assert.equal(trab01.custoContratacao, 5200);

  const workers = Politics.getCharactersByGroup("trabalhadores");
  assert.ok(workers.length > 0);
  assert.ok(workers.some(c => c.id === "trab01"));

  // Bônus calculados
  const bonuses = Politics.calculateActiveBonuses({
    trabalhadores: "trab01",
    "proprietarios-rurais": "rur03"
  });
  assert.equal(bonuses.protecaoSocialDividas, 10);
  assert.equal(bonuses.aprovacaoPopular, 2);
  assert.equal(bonuses.produtividadeAgricola, 11);

  // Conflito entre trab01 e rur03
  const conflicts = Politics.calculateConflicts({
    trabalhadores: "trab01",
    "proprietarios-rurais": "rur03"
  });
  assert.equal(conflicts.length, 1);
  assert.ok(conflicts[0].pair.includes("trab01"));
  assert.ok(conflicts[0].pair.includes("rur03"));
  assert.equal(conflicts[0].penalty, -4);

  // Render do painel de gabinete
  const host = { innerHTML: "" };
  const state = Politics.createState();
  const rendered = Politics.renderDashboard(state, host, {
    activeCharacters: { trabalhadores: "trab01" },
    treasuryBalance: 15000
  });
  assert.equal(rendered, true);
  assert.ok(host.innerHTML.includes("politics-cabinet-panel"));
  assert.ok(host.innerHTML.includes("Vicente Almeida"));
});

console.log(`\nResultado Política: ${passed} testes aprovados; ${failures.length} reprovados.`);
if (failures.length) process.exitCode = 1;
