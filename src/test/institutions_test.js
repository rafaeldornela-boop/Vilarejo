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

test("pauta e aprova Projeto de Lei no Plenário com maioria parlamentar e sanção", () => {
  const { runtime, politics, institutions } = createRuntime();
  institutions.recalculateRepresentation();
  const bills = institutions.getBills();
  assert(bills.length >= 4, "Catálogo de PLs deve ter projetos cadastrados");
  
  // Pautar PL de Habitação Social
  const tabled = institutions.sponsorBill("pl_social_housing");
  assert.equal(tabled.status, "tabled");

  // Formar ampla coalizão para garantir quórum e votos favoráveis
  institutions.setCoalition(["workers", "vulnerable", "middle_class"]);
  
  // Votação no Plenário
  let enactedEventReceived = false;
  runtime.events.on("institutions:bill-enacted", () => { enactedEventReceived = true; });
  const result = institutions.voteBill("pl_social_housing", { lobbyImpact: 10 });

  assert(result.totalYes > 0, "Deve haver votos favoráveis");
  assert.equal(result.approved, true, "Com a coalizão dos trabalhadores o PL deve ser aprovado");
  assert.equal(enactedEventReceived, true, "Deve emitir evento de sanção da lei");

  const enactedLaws = institutions.getEnactedLaws();
  assert(enactedLaws.some((l) => l.id === "pl_social_housing"), "A lei aprovada deve constar no rol de leis sancionadas");
  institutions.dispose();
  politics.dispose();
});

test("rejeita Projeto de Lei quando a oposição e descontentes barram a maioria", () => {
  const state = Institutions.createState();
  const snap = politicsSnapshot();
  Institutions.recalculateRepresentation(state, snap);
  
  // Votar projeto elegível com lobby negativo e sem coalizão
  const result = Institutions.voteBill(state, "pl_coop_fiscal", { lobbyImpact: -50, context: { population: 20 } });
  assert.equal(result.approved, false, "Com forte oposição, o projeto deve ser rejeitado");
  assert.equal(result.totalNo > result.totalYes, true, "Votos contrários devem superar os favoráveis");
  
  const snapAfter = Institutions.getSnapshot(state);
  const bill = snapAfter.bills.find((b) => b.id === "pl_coop_fiscal");
  assert.equal(bill.status, "rejected", "PL deve figurar como rejeitado");
});

test("bloqueia tramitação de leis quando o vilarejo ainda não atingiu a evolução necessária", () => {
  const state = Institutions.createState();
  const snap = politicsSnapshot();
  Institutions.recalculateRepresentation(state, snap);

  // População inicial baixa (12 moradores) e sem leis prévias
  const lowContext = { population: 12, treasuryCash: 2000, enactedLaws: [] };
  
  // Tentar pautar PL 06 (Saúde da Família, que exige População >= 18 e PL 01 aprovado)
  assert.throws(() => {
    Institutions.sponsorBill(state, "pl_public_health_family", { context: lowContext });
  }, /bloqueado para pauta/);

  // Verificar na prévia que está bloqueado e explica os motivos
  const preview = Institutions.getBillPreview(state, "pl_public_health_family", { context: lowContext });
  assert.equal(preview.eligibility.eligible, false);
  assert(preview.eligibility.reasons.length >= 2, "Deve listar população e lei pré-requisito pendentes");
  assert.equal(preview.phase, 2);
});

test("desbloqueia leis avançadas e gera prévia de impactos após evolução da comunidade", () => {
  const state = Institutions.createState();
  const snap = politicsSnapshot();
  Institutions.recalculateRepresentation(state, snap);

  // Comunidade evoluída com 20 moradores, caixa no Tesouro e PL 01 aprovado
  const advancedContext = { population: 20, treasuryCash: 6000, enactedLaws: ["pl_social_housing"] };
  
  const preview = Institutions.getBillPreview(state, "pl_public_health_family", { context: advancedContext });
  assert.equal(preview.eligibility.eligible, true, "Comunidade evoluída desbloqueia o projeto");
  assert(preview.projectedVoting.totalSeats === 21, "Projeção legislativa deve cobrir todas as 21 cadeiras");
  assert(preview.impacts.healthAccess > 0, "Impacto de saúde deve constar na prévia");

  // Pautar e votar com sucesso
  const tabled = Institutions.sponsorBill(state, "pl_public_health_family", { context: advancedContext });
  assert.equal(tabled.status, "tabled");

  const voteRes = Institutions.voteBill(state, "pl_public_health_family", { context: advancedContext, lobbyImpact: 20 });
  assert.equal(voteRes.approved, true, "Com evolução e apoio, o PL é aprovado no Plenário");
});

test("ciclo eleitoral: convenção com plataforma, pesquisa eleitoral e apuração com renovação de mandato", () => {
  const { runtime, politics, institutions } = createRuntime();
  
  const platforms = institutions.getCampaignPlatforms();
  assert(platforms.length >= 3, "Devem existir ao menos 3 plataformas eleitorais");

  // Selecionar plataforma solidária
  const selected = institutions.selectCampaignPlatform("social_solidarity");
  assert.equal(selected.id, "social_solidarity");

  // Consultar pesquisa eleitoral
  const polling = institutions.getElectionPolling();
  assert(Array.isArray(polling) && polling.length > 0, "Pesquisa eleitoral deve retornar intenções dos grupos");
  assert(polling.some((p) => p.intent === "favor_gov" || p.govApprovalScore > 50), "Deve haver intenção de voto apurada");

  // Realizar Eleição Geral Municipal
  let electionEvent = false;
  runtime.events.on("institutions:mandate-renewed", () => { electionEvent = true; });
  const electionResult = institutions.holdElection();

  assert.equal(electionResult.termNumber, 2, "Mandato deve avançar para 2");
  assert.equal(electionEvent, true, "Deve emitir evento de renovação do mandato");
  
  const finalSnap = institutions.getSnapshot();
  assert.equal(finalSnap.termNumber, 2);
  assert.equal(finalSnap.coalition.status, "not_formed", "Nova legislatura inicia sem coalizão prévia");
  
  institutions.dispose();
  politics.dispose();
});

console.log(`\nResultado Instituições: ${passed} testes aprovados; ${failures.length} reprovados.`);
if (failures.length) process.exitCode = 1;
