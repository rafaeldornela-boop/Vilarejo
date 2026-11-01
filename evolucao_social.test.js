"use strict";
const assert = require("node:assert/strict");
const Evolution = require("./evolucao_social");

function runTests() {
  const results = [];
  const test = (name, fn) => {
    try { fn(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, detail: error.message }); }
  };
  const base = {
    households: [
      { id: 1, adults: 2, children: 2, jobs: 2 },
      { id: 2, adults: 2, children: 2, jobs: 2 },
      { id: 3, adults: 1, children: 0, jobs: 1 },
      { id: 4, adults: 1, children: 0, jobs: 1 }
    ],
    firms: [
      { id: "farm", sector: "agriculture", status: "active" },
      { id: "commerce", sector: "retail", status: "active" },
      { id: "workshop", sector: "construction_services", status: "active" }
    ],
    housingCapacity: 12,
    urbanInfra: { congestionRatio: 0.8 },
    lastDemandUnits: 20,
    lastShortageUnits: 0,
    accounts: { treasury: 10000 }
  };
  const metricsAt = (month, overrides = {}) => Evolution.readMetrics({ ...base, monthNumber: month, ...overrides });
  const eligibleForSchool = (month) => ({
    ...metricsAt(month), population: 24, activeFirms: 4, sectorCount: 3,
    education: { schoolAgeChildren: 8, availableTeachers: 2, unmetDemandIndex: 0.3 }
  });

  test("1. Inicia na comunidade e reconhece as duas estruturas existentes", () => {
    const state = Evolution.createState();
    assert.equal(state.version, 2);
    assert.equal(state.stage, "comunidade");
    assert.deepEqual(Evolution.overview(state).operational.map((i) => i.id), ["administracao_comunitaria", "obras_infraestrutura"]);
  });

  test("2. Migra o estado v0.1 sem apagar fase, histórico ou instituições", () => {
    const old = { version: 1, stage: "vilarejo", lastUpdatedMonth: 7, history: [{ month: 1, message: "legado" }], institutions: [{ id: "escola_comunitaria", availability: "available", lifecycle: "planned" }] };
    const migrated = Evolution.migrateState(old);
    assert.equal(migrated.version, 2);
    assert.equal(migrated.stage, "vilarejo");
    assert.equal(migrated.lastUpdatedMonth, 7);
    assert.equal(migrated.institutions.find((i) => i.id === "escola_comunitaria").lifecycle, "planned");
    assert.ok(migrated.history.some((e) => e.type === "migration"));
  });

  test("3. Ausência de famílias ou firmas vira dado ausente, não zero", () => {
    const metrics = Evolution.readMetrics({});
    assert.equal(metrics.population, null);
    assert.equal(metrics.activeFirms, null);
    assert.equal(metrics.sectorCount, null);
    assert.equal(Evolution.calculateStage(metrics), null);
  });

  test("4. Não calcula taxa de desocupação sem denominador na força de trabalho", () => {
    const metrics = Evolution.readMetrics({ households: [], firms: [] });
    assert.equal(metrics.labor.unemploymentRate, null);
  });

  test("4. Lê população, firmas, setores e pressão habitacional do motor atual", () => {
    const metrics = metricsAt(0);
    assert.equal(metrics.population, 10);
    assert.equal(metrics.activeFirms, 3);
    assert.equal(metrics.sectorCount, 3);
    assert.ok(Math.abs(metrics.housing.pressure - 10 / 12) < 1e-9);
    assert.equal(metrics.dataDomains.education, false);
  });

  test("5. Fase econômica precisa de dois fechamentos consecutivos para consolidar", () => {
    let state = Evolution.createState();
    state = Evolution.advance(state, { population: 25, activeFirms: 4, sectorCount: 2 }, 1).state;
    assert.equal(state.stage, "comunidade");
    const result = Evolution.advance(state, { population: 25, activeFirms: 4, sectorCount: 2 }, 2);
    assert.equal(result.state.stage, "vilarejo");
    assert.ok(result.events.some((e) => e.type === "stage_changed"));
  });

  test("6. Um pico de um mês não promove a fase", () => {
    let state = Evolution.createState();
    state = Evolution.advance(state, { population: 25, activeFirms: 4, sectorCount: 2 }, 1).state;
    state = Evolution.advance(state, { population: 10, activeFirms: 3, sectorCount: 2 }, 2).state;
    assert.equal(state.stage, "comunidade");
    assert.equal(state.stageCandidate, null);
  });

  test("7. Fase já consolidada não regride depois de uma crise", () => {
    let state = Evolution.createState();
    state = Evolution.advance(state, { population: 55, activeFirms: 6, sectorCount: 3 }, 1).state;
    state = Evolution.advance(state, { population: 55, activeFirms: 6, sectorCount: 3 }, 2).state;
    state = Evolution.advance(state, { population: 10, activeFirms: 2, sectorCount: 1 }, 3).state;
    assert.equal(state.stage, "municipio");
  });

  test("8. Indicadores não modelados permanecem explicitamente sem dados", () => {
    const needs = Evolution.evaluateNeeds(metricsAt(0));
    assert.equal(needs.find((n) => n.id === "educacao").level, "sem_dados");
    assert.equal(needs.find((n) => n.id === "saude").level, "sem_dados");
    assert.equal(needs.find((n) => n.id === "seguranca").level, "sem_dados");
    assert.equal(needs.find((n) => n.id === "saneamento").level, "sem_dados");
  });

  test("9. Detecta pressão habitacional a partir da capacidade existente", () => {
    const need = Evolution.evaluateNeeds(metricsAt(0)).find((n) => n.id === "habitacao");
    assert.equal(need.level, "atencao");
  });

  test("10. Tendência identifica piora entre fechamentos", () => {
    let state = Evolution.createState();
    state = Evolution.advance(state, metricsAt(1, { housingCapacity: 15 }), 1).state;
    state = Evolution.advance(state, metricsAt(2, { housingCapacity: 12 }), 2).state;
    assert.equal(state.needs.find((n) => n.id === "habitacao").trend, "piorando");
  });

  test("11. Pressão persistente exige três fechamentos e gera evento uma única vez", () => {
    let state = Evolution.createState();
    for (let month = 1; month <= 3; month++) state = Evolution.advance(state, metricsAt(month), month).state;
    const housing = state.needs.find((n) => n.id === "habitacao");
    assert.equal(housing.persistent, true);
    assert.equal(housing.consecutiveMonths, 3);
    assert.equal(state.history.filter((e) => e.type === "need_persistent" && e.needId === "habitacao").length, 1);
    state = Evolution.advance(state, metricsAt(4), 4).state;
    assert.equal(state.history.filter((e) => e.type === "need_persistent" && e.needId === "habitacao").length, 1);
  });

  test("12. Pressões em meses não consecutivos não são chamadas de persistentes", () => {
    let state = Evolution.createState();
    state = Evolution.advance(state, metricsAt(1), 1).state;
    state = Evolution.advance(state, metricsAt(4), 4).state;
    const housing = state.needs.find((n) => n.id === "habitacao");
    assert.equal(housing.consecutiveMonths, 1);
    assert.equal(housing.persistent, false);
    assert.equal(housing.trend, "sem_historico");
  });

  test("12. Necessidade melhora quando o indicador retorna à faixa normal", () => {
    let state = Evolution.createState();
    state = Evolution.advance(state, metricsAt(1), 1).state;
    state = Evolution.advance(state, metricsAt(2, { housingCapacity: 20 }), 2).state;
    assert.ok(state.events.some((e) => e.type === "need_improved" && e.needId === "habitacao"));
  });

  test("13. Repetir o mesmo mês não duplica histórico nem eventos", () => {
    const first = Evolution.advance(Evolution.createState(), metricsAt(1), 1);
    const again = Evolution.advance(first.state, metricsAt(1), 1);
    assert.equal(again.unchanged, true);
    assert.equal(again.events.length, 0);
    assert.equal(again.state.metricsHistory.length, 1);
  });

  test("14. Escola não é liberada enquanto faltam indicadores de educação", () => {
    let state = Evolution.createState();
    state = Evolution.advance(state, metricsAt(1), 1).state;
    state = Evolution.advance(state, metricsAt(2), 2).state;
    const school = state.institutions.find((i) => i.id === "escola_comunitaria");
    assert.equal(school.availability, "locked");
    assert.ok(school.blocker.some((text) => text.includes("Indicador ainda não modelado")));
  });

  test("15. Escola fica disponível com fase, demanda e professor observáveis", () => {
    let state = Evolution.createState();
    state = Evolution.advance(state, eligibleForSchool(1), 1).state;
    state = Evolution.advance(state, eligibleForSchool(2), 2).state;
    const school = state.institutions.find((i) => i.id === "escola_comunitaria");
    assert.equal(school.availability, "available");
    assert.equal(school.lifecycle, "not_built");
  });

  test("16. Instituição bloqueada não pode ser planejada", () => {
    const result = Evolution.planInstitution(Evolution.createState(), "posto_saude", 1);
    assert.equal(result.ok, false);
    assert.match(result.reason, /não está disponível/);
  });

  test("17. Planejamento é uma decisão explícita e não inicia obra sozinho", () => {
    let state = Evolution.createState();
    state = Evolution.advance(state, eligibleForSchool(1), 1).state;
    state = Evolution.advance(state, eligibleForSchool(2), 2).state;
    const result = Evolution.planInstitution(state, "escola_comunitaria", 2);
    assert.equal(result.ok, true);
    assert.equal(result.state.institutions.find((i) => i.id === "escola_comunitaria").lifecycle, "planned");
  });

  test("18. Construção exige orçamento e prazo válidos", () => {
    let state = Evolution.createState();
    state = Evolution.advance(state, eligibleForSchool(1), 1).state;
    state = Evolution.advance(state, eligibleForSchool(2), 2).state;
    state = Evolution.planInstitution(state, "escola_comunitaria", 2).state;
    const fail = Evolution.startConstruction(state, "escola_comunitaria", { investmentCost: 10000, monthlyMaintenance: 500, availableBudget: 5000, constructionMonths: 3 });
    assert.equal(fail.ok, false);
    const ok = Evolution.startConstruction(state, "escola_comunitaria", { investmentCost: 10000, monthlyMaintenance: 500, availableBudget: 12000, constructionMonths: 3 });
    assert.equal(ok.ok, true);
    assert.equal(ok.state.institutions.find((i) => i.id === "escola_comunitaria").construction.remainingMonths, 3);
  });

  test("19. Obra avança uma vez por mês e só conclui no prazo", () => {
    let state = Evolution.createState();
    state = Evolution.advance(state, eligibleForSchool(1), 1).state;
    state = Evolution.advance(state, eligibleForSchool(2), 2).state;
    state = Evolution.planInstitution(state, "escola_comunitaria", 2).state;
    state = Evolution.startConstruction(state, "escola_comunitaria", { investmentCost: 10000, monthlyMaintenance: 500, availableBudget: 12000, constructionMonths: 2 }).state;
    state = Evolution.advance(state, eligibleForSchool(3), 3).state;
    assert.equal(state.institutions.find((i) => i.id === "escola_comunitaria").construction.remainingMonths, 1);
    state = Evolution.advance(state, eligibleForSchool(4), 4).state;
    assert.equal(state.institutions.find((i) => i.id === "escola_comunitaria").lifecycle, "ready_to_operate");
    assert.ok(state.events.some((e) => e.type === "construction_completed"));
  });

  test("20. Obras consideram meses transcorridos quando há fechamento acumulado", () => {
    let state = Evolution.createState();
    state = Evolution.advance(state, eligibleForSchool(1), 1).state;
    state = Evolution.advance(state, eligibleForSchool(2), 2).state;
    state = Evolution.planInstitution(state, "escola_comunitaria", 2).state;
    state = Evolution.startConstruction(state, "escola_comunitaria", { investmentCost: 10000, monthlyMaintenance: 500, availableBudget: 12000, constructionMonths: 3 }).state;
    state = Evolution.advance(state, eligibleForSchool(5), 5).state;
    assert.equal(state.institutions.find((i) => i.id === "escola_comunitaria").lifecycle, "ready_to_operate");
  });

  test("20. A mesma obra não avança duas vezes no mesmo fechamento", () => {
    let state = Evolution.createState();
    state = Evolution.advance(state, eligibleForSchool(1), 1).state;
    state = Evolution.advance(state, eligibleForSchool(2), 2).state;
    state = Evolution.planInstitution(state, "escola_comunitaria", 2).state;
    state = Evolution.startConstruction(state, "escola_comunitaria", { investmentCost: 10000, monthlyMaintenance: 500, availableBudget: 12000, constructionMonths: 2 }).state;
    state = Evolution.advance(state, eligibleForSchool(3), 3).state;
    const again = Evolution.advanceConstructions(state, 3);
    assert.equal(again.state.institutions.find((i) => i.id === "escola_comunitaria").construction.remainingMonths, 1);
  });

  test("21. Operação exige obra concluída e equipe mínima", () => {
    let state = Evolution.createState();
    state = Evolution.advance(state, eligibleForSchool(1), 1).state;
    state = Evolution.advance(state, eligibleForSchool(2), 2).state;
    state = Evolution.planInstitution(state, "escola_comunitaria", 2).state;
    state = Evolution.startConstruction(state, "escola_comunitaria", { investmentCost: 10000, monthlyMaintenance: 500, availableBudget: 12000, constructionMonths: 1 }).state;
    state = Evolution.advance(state, eligibleForSchool(3), 3).state;
    const fail = Evolution.operationalizeInstitution(state, "escola_comunitaria", { staff: 0, capacity: 20 });
    assert.equal(fail.ok, false);
    const ok = Evolution.operationalizeInstitution(state, "escola_comunitaria", { staff: 2, capacity: 40 });
    assert.equal(ok.ok, true);
    assert.equal(ok.state.institutions.find((i) => i.id === "escola_comunitaria").lifecycle, "operational");
  });

  test("22. Manutenção integral mantém o serviço regular", () => {
    let state = Evolution.createState();
    state = Evolution.advance(state, eligibleForSchool(1), 1).state;
    state = Evolution.advance(state, eligibleForSchool(2), 2).state;
    state = Evolution.planInstitution(state, "escola_comunitaria", 2).state;
    state = Evolution.startConstruction(state, "escola_comunitaria", { investmentCost: 10000, monthlyMaintenance: 500, availableBudget: 12000, constructionMonths: 1 }).state;
    state = Evolution.advance(state, eligibleForSchool(3), 3).state;
    state = Evolution.operationalizeInstitution(state, "escola_comunitaria", { staff: 2, capacity: 40 }).state;
    const paid = Evolution.settleMaintenance(state, "escola_comunitaria", 500, 4);
    assert.equal(paid.ok, true);
    assert.equal(paid.status, "regular");
    assert.equal(paid.serviceFactor, 1);
  });

  test("23. Manutenção parcial restringe a capacidade e ausência suspende", () => {
    let state = Evolution.createState();
    state = Evolution.advance(state, eligibleForSchool(1), 1).state;
    state = Evolution.advance(state, eligibleForSchool(2), 2).state;
    state = Evolution.planInstitution(state, "escola_comunitaria", 2).state;
    state = Evolution.startConstruction(state, "escola_comunitaria", { investmentCost: 10000, monthlyMaintenance: 500, availableBudget: 12000, constructionMonths: 1 }).state;
    state = Evolution.advance(state, eligibleForSchool(3), 3).state;
    state = Evolution.operationalizeInstitution(state, "escola_comunitaria", { staff: 2, capacity: 40 }).state;
    const partial = Evolution.settleMaintenance(state, "escola_comunitaria", 200, 4);
    assert.equal(partial.status, "restrito");
    assert.equal(partial.serviceFactor, 0.4);
    const suspended = Evolution.settleMaintenance(partial.state, "escola_comunitaria", 0, 5);
    assert.equal(suspended.status, "suspenso");
    assert.equal(suspended.serviceFactor, 0);
  });

  test("24. Manutenção não pode ser liquidada duas vezes no mesmo mês", () => {
    let state = Evolution.createState();
    state = Evolution.advance(state, eligibleForSchool(1), 1).state;
    state = Evolution.advance(state, eligibleForSchool(2), 2).state;
    state = Evolution.planInstitution(state, "escola_comunitaria", 2).state;
    state = Evolution.startConstruction(state, "escola_comunitaria", { investmentCost: 10000, monthlyMaintenance: 500, availableBudget: 12000, constructionMonths: 1 }).state;
    state = Evolution.advance(state, eligibleForSchool(3), 3).state;
    state = Evolution.operationalizeInstitution(state, "escola_comunitaria", { staff: 2, capacity: 40 }).state;
    const first = Evolution.settleMaintenance(state, "escola_comunitaria", 500, 4);
    const duplicate = Evolution.settleMaintenance(first.state, "escola_comunitaria", 500, 4);
    assert.equal(duplicate.ok, false);
  });

  test("25. Jornal transforma indicadores em notícia e recomendação rastreável", () => {
    let state = Evolution.createState();
    state = Evolution.advance(state, metricsAt(1), 1).state;
    const bulletin = Evolution.buildBulletin(state);
    const housing = bulletin.articles.find((a) => a.id === "habitacao");
    assert.ok(housing);
    assert.match(housing.summary, /83%/);
    assert.match(housing.recommendation, /habitacional/);
    assert.equal(bulletin.month, 1);
  });

  test("26. Jornal não inventa notícias para setores sem indicadores", () => {
    const state = Evolution.advance(Evolution.createState(), metricsAt(1), 1).state;
    const bulletin = Evolution.buildBulletin(state);
    assert.ok(bulletin.unknownAreas.includes("Educação"));
    assert.ok(!bulletin.articles.some((a) => a.category === "Educação"));
  });

  test("27. Painel agrega fase, jornal, estruturas e obras em andamento", () => {
    const state = Evolution.advance(Evolution.createState(), metricsAt(1), 1).state;
    const view = Evolution.overview(state);
    assert.equal(view.stage.id, "comunidade");
    assert.equal(view.bulletin.month, 1);
    assert.equal(view.operational.length, 2);
    assert.ok(Array.isArray(view.underDevelopment));
  });

  return { passed: results.filter((r) => r.passed).length, total: results.length, results };
}
module.exports = runTests;
