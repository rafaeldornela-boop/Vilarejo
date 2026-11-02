"use strict";

const assert = require("node:assert/strict");
const Society = require("../society/vilarejo_society.js");

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

function baseGroups() {
  return [
    { id: "1", label: "Família Silva", category: "family", adults: 2, children: 1, employed: 1, happiness: 60, population: 3 },
    { id: "2", label: "Ana", category: "single", adults: 1, children: 0, employed: 1, happiness: 70, population: 1 }
  ];
}

console.log("\n=== SOCIEDADE 1.0.0 ===");

test("inicializa pessoas sem alterar os domicílios da Economia", () => {
  const groups = baseGroups();
  const before = JSON.stringify(groups);
  const state = Society.createState({ seed: 10 });
  const snapshot = Society.seedFromEconomy(state, groups);
  assert.equal(snapshot.demographic.population, 4);
  assert.equal(snapshot.demographic.households, 2);
  assert.equal(JSON.stringify(groups), before);
});

test("mantém a identidade das pessoas ao reconciliar uma sincronização sem mudanças", () => {
  const state = Society.createState({ seed: 11 });
  Society.seedFromEconomy(state, baseGroups());
  const personIds = state.households[0].members.map((person) => person.id);
  const oldAges = state.households[0].members.map((person) => person.age);
  Society.reconcileFromEconomy(state, baseGroups(), { month: 1 });
  assert.deepEqual(state.households[0].members.map((person) => person.id), personIds);
  assert.deepEqual(state.households[0].members.map((person) => person.age), oldAges);
});

test("reconcilia variações econômicas sem sobrescrever o histórico demográfico", () => {
  const groups = baseGroups();
  const state = Society.createState({ seed: 12 });
  Society.seedFromEconomy(state, groups);
  const originalAdultIds = state.households[0].members.filter((person) => person.age >= 18).map((person) => person.id);
  const originalChildId = state.households[0].members.find((person) => person.age < 18).id;
  const nextGroups = [
    { ...groups[0], adults: 3, children: 0, population: 3 },
    groups[1]
  ];
  const result = Society.reconcileFromEconomy(state, nextGroups, { month: 1 });
  const firstHousehold = state.households[0];
  assert.equal(firstHousehold.members.length, 3);
  assert.equal(firstHousehold.members.filter((person) => person.age >= 18).length, 3);
  assert.ok(originalAdultIds.every((id) => firstHousehold.members.some((person) => person.id === id)));
  assert.equal(firstHousehold.members.some((person) => person.id === originalChildId), false);
  assert.equal(result.adjustments.length, 1);
});

test("avança idade e identifica transições para vida adulta e terceira idade", () => {
  const state = Society.createState({ seed: 13 });
  Society.seedFromEconomy(state, [{ id: "x", adults: 0, children: 0 }]);
  state.households[0].members = [
    Society.createPerson(state, { id: "teen", age: 17.95 }),
    Society.createPerson(state, { id: "senior", age: 64.95 })
  ];
  Society.advanceMonth(state, { month: 1, birthProbability: 0, mortalityRates: { child: 0, adult: 0, elderly: 0 }, random: () => 0.99 });
  const people = state.households[0].members;
  assert.ok(people.find((person) => person.id === "teen").age >= 18);
  assert.ok(people.find((person) => person.id === "senior").age >= 65);
  assert.equal(state.demographic.lastMonth.agingTransitions, 2);
});

test("não processa o mesmo fechamento mensal duas vezes", () => {
  const state = Society.createState({ seed: 14 });
  Society.seedFromEconomy(state, [{ id: "x", adults: 2, children: 1 }]);
  const first = Society.advanceMonth(state, { month: 1, birthProbability: 0, random: () => 0.99 });
  const afterFirst = JSON.stringify(state);
  const second = Society.advanceMonth(state, { month: 1, birthProbability: 0, random: () => 0 });
  assert.equal(first.unchanged, false);
  assert.equal(second.unchanged, true);
  assert.equal(JSON.stringify(state), afterFirst);
});

test("usa gerador aleatório próprio e produz resultados reproduzíveis", () => {
  const a = Society.createState({ seed: 2026 });
  const b = Society.createState({ seed: 2026 });
  const groups = baseGroups();
  Society.seedFromEconomy(a, groups);
  Society.seedFromEconomy(b, groups);
  for (let month = 1; month <= 24; month += 1) {
    Society.advanceMonth(a, { month });
    Society.advanceMonth(b, { month });
  }
  assert.equal(JSON.stringify(Society.getSnapshot(a)), JSON.stringify(Society.getSnapshot(b)));
});

test("registra imigração, diversidade e integração sem mexer na Economia", () => {
  const groups = baseGroups();
  const before = JSON.stringify(groups);
  const state = Society.createState({ seed: 15 });
  Society.seedFromEconomy(state, groups);
  const result = Society.addImmigrant(state, "1", { month: 1, cultureGroup: "regional", age: 30 });
  assert.equal(result.ok, true);
  assert.equal(Society.getDemographicSnapshot(state).foreignBorn, 1);
  assert.ok(Society.refreshCulture(state).diversityIndex > 0);
  assert.equal(JSON.stringify(groups), before);
});

test("registra saída individual apenas quando explicitamente solicitado", () => {
  const state = Society.createState({ seed: 16 });
  Society.seedFromEconomy(state, [{ id: "1", adults: 1, children: 0 }]);
  const person = state.households[0].members[0];
  const result = Society.removePerson(state, "1", person.id, { recordMigration: true, month: 1, reason: "mudança" });
  assert.equal(result.ok, true);
  assert.equal(Society.getDemographicSnapshot(state).population, 0);
  assert.equal(state.migration.monthly.outgoing, 1);
});

test("qualidade de vida parcial informa cobertura e não inventa dimensões ausentes", () => {
  const result = Society.calculateQualityOfLife({ householdWellbeing: 70, employment: 80 });
  assert.equal(result.score, 75);
  assert.equal(result.measuredDimensions, 2);
  assert.equal(result.coverage, 33.3);
  assert.equal(result.provisional, true);
  assert.equal(result.components.foodSecurity, null);
});

test("projeção demográfica não sobrescreve empregos, salários ou dados econômicos", () => {
  const groups = [{ id: "1", adults: 2, children: 1, jobs: 1.5, wage: 1800, sectorJobs: { farm: 1.5 } }];
  const before = JSON.stringify(groups);
  const state = Society.createState({ seed: 17 });
  Society.seedFromEconomy(state, groups);
  Society.advanceMonth(state, { month: 1, birthProbability: 0, mortalityRates: { child: 0, adult: 0, elderly: 0 }, random: () => 0.99 });
  Society.getEconomyProjection(state);
  assert.equal(JSON.stringify(groups), before);
});


test("preserva a interface de painel sem depender do objeto econômico", () => {
  const state = Society.createState({ seed: 19 });
  Society.seedFromEconomy(state, [{ id: "1", label: "Família", adults: 2, children: 1 }]);
  const host = { innerHTML: "" };
  assert.equal(Society.renderDashboard(state, host), true);
  assert.match(host.innerHTML, /moradores/);
  assert.match(host.innerHTML, /Demografia/);
});

test("integra-se ao Runtime, publica o fechamento social e reinicializa após reset", () => {
  const listeners = new Map();
  const modules = new Map([["core", {}], ["economia", {}]]);
  let groups = [];
  const runtime = {
    modules: {
      has: (id) => modules.has(id),
      register: (record) => { modules.set(record.id, { ...record, snapshot: {} }); },
      updateSnapshot: (id, snapshot) => { modules.get(id).snapshot = snapshot; },
      get: (id) => modules.get(id)
    },
    population: { getSnapshot: () => ({ groups: JSON.parse(JSON.stringify(groups)) }) },
    events: {
      on(topic, callback) {
        if (!listeners.has(topic)) listeners.set(topic, new Set());
        listeners.get(topic).add(callback);
        return () => listeners.get(topic)?.delete(callback);
      }
    },
    publish(topic, payload, source) {
      const event = { topic, source, payload: JSON.parse(JSON.stringify(payload)) };
      for (const callback of Array.from(listeners.get(topic) || [])) callback(event);
    },
    clock: { snapshot: () => ({ economicMonthNumber: 1 }) },
    session: { reset() { for (const callback of Array.from(listeners.get("game:reset") || [])) callback({ topic: "game:reset", payload: {} }); } },
    syncFromEconomy(economy) {
      groups = economy.households.map((h) => ({ id: String(h.id), label: h.name, category: h.type, adults: h.adults, children: h.children, employed: h.jobs, happiness: h.happiness, population: h.adults + h.children }));
      for (const callback of Array.from(listeners.get("world:synchronized") || [])) callback({ topic: "world:synchronized", payload: {} });
    }
  };
  runtime.syncFromEconomy({ households: [{ id: 1, name: "Família", type: "family", adults: 2, children: 1, jobs: 1, happiness: 60 }] });
  const integration = Society.registerWithRuntime(runtime, { seed: 18 });
  assert.equal(runtime.modules.has("sociedade"), true);
  assert.equal(integration.getSnapshot().demographic.population, 3);
  let closed = 0;
  runtime.events.on("society:month-closed", () => { closed += 1; });
  runtime.syncFromEconomy({ households: [{ id: 1, name: "Família", type: "family", adults: 2, children: 1, jobs: 1, happiness: 60 }] });
  runtime.publish("economy:month-closed", { monthNumber: 1 }, "economia");
  assert.equal(closed, 1);
  assert.equal(integration.getSnapshot().currentMonth, 1);
  runtime.session.reset({ day: 1 });
  runtime.syncFromEconomy({ households: [{ id: 2, name: "Novo grupo", type: "family", adults: 1, children: 0, jobs: 0, happiness: 55 }] });
  assert.equal(integration.getSnapshot().demographic.population, 1);
  integration.dispose();
});

console.log(`\nResultado: ${passed} testes aprovados; ${failures.length} reprovados.`);
if (failures.length) process.exitCode = 1;
