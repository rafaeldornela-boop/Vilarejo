"use strict";

const assert = require("node:assert/strict");
const Politics = require("../politics/vilarejo_politics.js");
const Institutions = require("../institutions/vilarejo_institutions.js");

let passed = 0;
const failures = [];
function test(name, callback) {
  try { callback(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (error) { failures.push({ name, error }); console.error(`  ✗ ${name}: ${error.stack || error}`); }
}

function politicsSnapshot() {
  const state = Politics.createState({ seed: 77 });
  Politics.setComposition(state, {
    population: 1000,
    source: "institution-test",
    groups: {
      workers: { count: 600, evidenceLevel: "estimated", basis: "Série sintética de teste" },
      business: { count: 90, evidenceLevel: "estimated", basis: "Série sintética de teste" },
      merchants: { count: 100, evidenceLevel: "estimated", basis: "Série sintética de teste" },
      vulnerable: { count: 250, evidenceLevel: "estimated", basis: "Série sintética de teste" }
    }
  });
  Politics.updateGroup(state, "workers", { economicPower: 35, organization: 90, cohesion: 70, mobilizationCapacity: 80, institutionalAccess: 65, satisfaction: 75 });
  Politics.updateGroup(state, "business", { economicPower: 95, organization: 80, cohesion: 75, mobilizationCapacity: 60, institutionalAccess: 80, satisfaction: 25 });
  Politics.updateGroup(state, "merchants", { economicPower: 65, organization: 65, cohesion: 60, mobilizationCapacity: 50, institutionalAccess: 55, satisfaction: 50 });
  return Politics.getSnapshot(state);
}

function createRuntime() {
  const listeners = new Map();
  const events = {
    on(topic, listener) {
      if (!listeners.has(topic)) listeners.set(topic, new Set());
      listeners.get(topic).add(listener);
      return () => listeners.get(topic)?.delete(listener);
    },
    emit(topic, payload = {}) {
      const event = { topic, payload: structuredClone(payload), source: "test" };
      for (const listener of Array.from(listeners.get(topic) || [])) listener(event);
      return event;
    }
  };
  const modules = new Map([
    ["core", { id: "core", version: "0.1.0" }],
    ["economia", { id: "economia", version: "3.0.0" }]
  ]);
  const population = { totals: { total: 100, adults: 70, children: 30 }, groups: [], lastSynchronizedDay: 1 };
  const runtime = {
    events,
    modules: {
      has: (id) => modules.has(id),
      register(descriptor) {
        if (modules.has(descriptor.id)) throw new Error(`Módulo duplicado: ${descriptor.id}`);
        modules.set(descriptor.id, { ...descriptor });
      },
      updateSnapshot(id, snapshot) {
        const record = modules.get(id);
        if (!record) throw new Error(`Módulo ausente: ${id}`);
        record.snapshot = structuredClone(snapshot);
        return record.snapshot;
      },
      get: (id) => modules.get(id) || null
    },
    population: { getSnapshot: () => structuredClone(population) },
    clock: { snapshot: () => ({ economicMonthNumber: 0 }) },
    publish(topic, payload, source) { return events.emit(topic, { ...payload, _source: source || "test" }); },
    session: { reset() { events.emit("game:reset", { day: 1 }); } }
  };
  const politics = Politics.registerWithRuntime(runtime, { seed: 77 });
  const institutions = Institutions.registerWithRuntime(runtime, { seed: 77 });
  return { runtime, politics, institutions };
}

console.log("\n=== INSTITUIÇÕES E REPRESENTAÇÃO 1.0.0 ===");

test("inicializa Estado sui generis, Executivo controlado pelo jogador e Câmara", () => {
  const state = Institutions.createState();
  const snap = Institutions.getSnapshot(state);
  assert.equal(snap.stateModel, "sui_generis_state");
  assert.equal(snap.executive.playerControlled, true);
  assert.equal(snap.legislature.totalSeats, 21);
  assert.equal(snap.legislature.name, "Câmara de Representação dos Interesses");
});

test("distribui exatamente todas as cadeiras pelo método dos maiores restos", () => {
  const snap = Institutions.getSnapshot(Institutions.createState());
  const politics = politicsSnapshot();
  const state = Institutions.createState();
  Institutions.recalculateRepresentation(state, politics);
  const result = Institutions.getSnapshot(state);
  assert.equal(result.summary.allocatedSeats, 21);
  assert.equal(result.summary.vacantSeats, 0);
  assert.equal(result.legislature.seats.length, 21);
  assert.equal(result.legislature.groups.reduce((sum, group) => sum + group.seats, 0), 21);
});

test("é reproduzível e desempata por influência e identificador", () => {
  const groups = [
    { groupId: "b", groupName: "B", influence: 50 },
    { groupId: "a", groupName: "A", influence: 50 },
    { groupId: "c", groupName: "C", influence: 0 }
  ];
  const a = Institutions.allocateSeats(groups, 7);
  const b = Institutions.allocateSeats(groups, 7);
  assert.deepEqual(a, b);
  assert.equal(a.reduce((sum, group) => sum + group.seats, 0), 7);
  assert.equal(a.find((group) => group.groupId === "a").seats, 4);
});

test("distribui igualmente quando todos os pesos políticos são zero", () => {
  const rows = Institutions.allocateSeats([
    { groupId: "a", influence: 0 }, { groupId: "b", influence: 0 }, { groupId: "c", influence: 0 }
  ], 9);
  assert.deepEqual(rows.map((row) => row.seats), [3, 3, 3]);
});

test("mantém proporções não exclusivas fora da contabilidade de cadeiras", () => {
  const state = Institutions.createState();
  const snap = politicsSnapshot();
  const sumRepresentativity = snap.groups.reduce((sum, group) => sum + (group.representativity || 0), 0);
  Institutions.recalculateRepresentation(state, snap);
  const result = Institutions.getSnapshot(state);
  assert.ok(sumRepresentativity > 100);
  assert.equal(result.summary.allocatedSeats, result.summary.totalSeats);
});

test("forma coalizão e identifica maioria absoluta sem somar bancadas duas vezes", () => {
  const state = Institutions.createState();
  Institutions.recalculateRepresentation(state, politicsSnapshot());
  const rows = Institutions.getSnapshot(state).legislature.groups;
  const support = rows.slice().sort((a, b) => b.seats - a.seats).slice(0, 3).map((row) => row.groupId);
  const coalition = Institutions.setCoalition(state, support, { month: 1 });
  const snap = Institutions.getSnapshot(state);
  assert.equal(coalition.seats, support.reduce((sum, id) => sum + rows.find((row) => row.groupId === id).seats, 0));
  assert.equal(snap.coalition.majority, snap.coalition.seats >= snap.summary.majoritySeats);
  assert.equal(new Set(snap.coalition.groupIds).size, support.length);
});

test("rejeita grupos inexistentes na formação de coalizão", () => {
  const state = Institutions.createState();
  Institutions.recalculateRepresentation(state, politicsSnapshot());
  assert.throws(() => Institutions.setCoalition(state, ["unknown"]), /inexistentes/);
});

test("dissolve coalizão e recalcula bloco de oposição", () => {
  const state = Institutions.createState();
  const snap = politicsSnapshot();
  Institutions.recalculateRepresentation(state, snap);
  const opposition = snap.groups.filter((group) => group.governmentRelation === "opposition").map((group) => group.id);
  Institutions.setCoalition(state, ["workers"]);
  Institutions.dissolveCoalition(state);
  const result = Institutions.getSnapshot(state);
  assert.equal(result.coalition.status, "not_formed");
  assert.equal(result.coalition.seats, 0);
  assert.ok(result.opposition.groupIds.every((id) => opposition.includes(id)));
});

test("atualiza dados políticos sem redistribuir cadeiras antes do fim do mandato", () => {
  const state = Institutions.createState();
  const first = politicsSnapshot();
  Institutions.recalculateRepresentation(state, first);
  const before = Institutions.getSnapshot(state).legislature.groups.map((row) => [row.groupId, row.seats]);
  const changed = structuredClone(first);
  changed.groups.find((group) => group.id === "business").influence = 100;
  Institutions.refreshGroupMetadata(state, changed);
  const after = Institutions.getSnapshot(state).legislature.groups.map((row) => [row.groupId, row.seats]);
  assert.deepEqual(after, before);
  assert.equal(Institutions.getSnapshot(state).legislature.groups.find((row) => row.groupId === "business").influence, 100);
});

test("renova mandato no mês correto e redistribui as cadeiras", () => {
  const state = Institutions.createState({ totalSeats: 21, termMonths: 2 });
  const first = politicsSnapshot();
  Institutions.recalculateRepresentation(state, first);
  const changed = structuredClone(first);
  changed.groups.find((group) => group.id === "business").influence = 100;
  const m1 = Institutions.advanceMonth(state, { month: 1, politicsSnapshot: first });
  assert.equal(m1.electionHeld, false);
  const m2 = Institutions.advanceMonth(state, { month: 2, politicsSnapshot: changed });
  assert.equal(m2.electionHeld, true);
  assert.equal(m2.snapshot.termNumber, 2);
  assert.equal(m2.snapshot.nextElectionMonth, 4);
  assert.equal(m2.snapshot.summary.allocatedSeats, 21);
  assert.equal(m2.snapshot.coalition.status, "not_formed");
});

test("é idempotente no mesmo mês e rejeita retrocesso", () => {
  const state = Institutions.createState({ termMonths: 12 });
  Institutions.recalculateRepresentation(state, politicsSnapshot());
  const first = Institutions.advanceMonth(state, { month: 1, politicsSnapshot: politicsSnapshot() });
  const before = JSON.stringify(state);
  const duplicate = Institutions.advanceMonth(state, { month: 1, politicsSnapshot: politicsSnapshot() });
  assert.equal(first.unchanged, false);
  assert.equal(duplicate.unchanged, true);
  assert.equal(JSON.stringify(state), before);
  assert.throws(() => Institutions.advanceMonth(state, { month: 0 }), RangeError);
});

test("valida e aplica mudanças de regras institucionais", () => {
  const state = Institutions.createState();
  Institutions.setInstitutionalSettings(state, { totalSeats: 31, termMonths: 36, quorumFraction: 0.6 });
  const snap = Institutions.getSnapshot(state);
  assert.equal(snap.settings.totalSeats, 31);
  assert.equal(snap.settings.termMonths, 36);
  assert.equal(snap.legislature.quorumSeats, 19);
  assert.equal(snap.summary.majoritySeats, 16);
});

test("renderiza painel institucional com escape contra HTML injetado", () => {
  const state = Institutions.createState();
  const politics = politicsSnapshot();
  politics.groups[0].name = "Grupo <script>alert(1)</script>";
  Institutions.recalculateRepresentation(state, politics);
  const host = { innerHTML: "" };
  assert.equal(Institutions.renderDashboard(state, host), true);
  assert.match(host.innerHTML, /&lt;script&gt;/);
  assert.doesNotMatch(host.innerHTML, /<script>alert/);
});

test("registra no Runtime após Política e publica a composição", () => {
  const { runtime, politics, institutions } = createRuntime();
  assert.equal(runtime.modules.has("instituicoes"), true);
  assert.equal(runtime.modules.get("instituicoes").dependencies.includes("politica"), true);
  assert.equal(institutions.getSnapshot().summary.allocatedSeats, 21);
  assert.equal(runtime.modules.get("instituicoes").snapshot.legislature.totalSeats, 21);
  institutions.dispose();
  politics.dispose();
});

test("acompanha fechamento político e publica fechamento institucional uma única vez", () => {
  const { runtime, politics, institutions } = createRuntime();
  let received = 0;
  runtime.events.on("institutions:month-closed", () => { received += 1; });
  runtime.publish("politics:month-closed", { version: "1.0.0", currentMonth: 1, groups: politics.getSnapshot().groups }, "test");
  runtime.publish("politics:month-closed", { version: "1.0.0", currentMonth: 1, groups: politics.getSnapshot().groups }, "test");
  assert.equal(institutions.state.currentMonth, 1);
  assert.equal(received, 1);
  institutions.dispose();
  politics.dispose();
});

test("reinicia a Câmara e limpa coalizão ao resetar a partida", () => {
  const { runtime, politics, institutions } = createRuntime();
  institutions.setCoalition(["workers"]);
  runtime.session.reset({ day: 1 });
  const snap = institutions.getSnapshot();
  assert.equal(snap.coalition.status, "not_formed");
  assert.equal(snap.currentMonth, 0);
  assert.equal(snap.summary.allocatedSeats, 0);
  institutions.dispose();
  politics.dispose();
});

console.log(`\nResultado Instituições: ${passed} testes aprovados; ${failures.length} reprovados.`);
if (failures.length) process.exitCode = 1;
