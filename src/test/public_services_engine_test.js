'use strict';

const assert = require("node:assert/strict");
const Engine = require("../services/public_services_engine.js");

function test(name, fn) {
  fn();
  console.log("✓ " + name);
}

test("cria estado operacional vazio", () => {
  const state = Engine.createState();
  assert.equal(state.facilities.length, 0);
  assert.equal(state.workforce.total, 0);
});

test("constrói UBS e gera pedido orçamentário", () => {
  const state = Engine.createState();
  const result = Engine.buildFacility(state, "health_post");

  assert.equal(result.ok, true);
  assert.equal(state.facilities.length, 1);
  assert.equal(result.budgetRequest.amount, 9000);
});

test("impede instalação sem equipe mínima", () => {
  const state = Engine.createState();
  const result = Engine.buildFacility(state, "hospital", { workers: 2 });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "minimum_staff");
});

test("contrata pessoal respeitando o limite da unidade", () => {
  const state = Engine.createState();
  const facility = Engine.buildFacility(state, "school", { workers: 3 }).facility;
  const result = Engine.hire(state, facility.id, 30);

  assert.equal(result.hired, 13);
  assert.equal(state.workforce.education, 16);
});

test("demanda educacional acompanha crianças", () => {
  assert.equal(
    Engine.demandFor("education", { population: 20, children: 6 }),
    6
  );
});

test("capacidade instalada reduz déficit", () => {
  const state = Engine.createState();
  Engine.buildFacility(state, "health_post", { workers: 8 });

  const health = Engine.aggregate(state, {
    population: 20,
    elderly: 2
  }).health;

  assert.ok(health.capacity > 0);
  assert.ok(health.coverage > 0);
  assert.ok(health.deficit < health.demand);
});

test("custos incluem folha e manutenção", () => {
  const state = Engine.createState();
  Engine.buildFacility(state, "police_station", { workers: 3 });

  const cost = Engine.monthlyCost(state);

  assert.equal(cost.total, 5510);
  assert.equal(cost.byDomain.security, 5510);
});

test("fechamento mensal produz relatório e consequências", () => {
  const state = Engine.createState();
  Engine.buildFacility(state, "health_post", { workers: 4 });

  const report = Engine.advanceMonth(state, {
    population: 20,
    elderly: 2
  });

  assert.equal(report.month, 1);
  assert.ok(Number.isFinite(report.operatingCost.total));
  assert.ok(Number.isFinite(report.outcomes.mortalityRisk));
  assert.equal(state.history.length, 1);
});

test("save/load preserva instalações e mês", () => {
  const state = Engine.createState();
  Engine.buildFacility(state, "school", { workers: 4 });
  Engine.advanceMonth(state, { population: 20, children: 6 });

  const restored = Engine.restore(Engine.serialize(state));

  assert.equal(restored.month, 1);
  assert.equal(restored.facilities.length, 1);
  assert.equal(restored.workforce.education, 4);
});

test("integra dados operacionais ao estado legado de Serviços", () => {
  const Services = require("../services/vilarejo_services.js");
  const servicesState = Services.createState();

  const operationalState = Engine.createState();
  Engine.buildFacility(operationalState, "health_post", { workers: 4 });
  Engine.advanceMonth(operationalState, {
    population: 20,
    elderly: 2
  });

  Engine.integrateWithServices(
    servicesState,
    operationalState,
    { population: 20, elderly: 2 }
  );

  assert.ok(Number.isFinite(servicesState.domains.health.capacityPressure));
  assert.ok(Number.isFinite(servicesState.domains.health.satisfaction));
});

console.log("10 testes de Serviços Públicos Operacionais concluídos.");
