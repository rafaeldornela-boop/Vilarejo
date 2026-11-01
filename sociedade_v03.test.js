"use strict";
const society = require("./sociedade_v03.js");

function run() {
  const results = [];
  const test = (name, fn) => {
    try {
      const detail = fn();
      results.push({ name, passed: !!detail.pass, detail });
    } catch (error) {
      results.push({ name, passed: false, error: error.message });
    }
  };
  const baseSimulation = () => ({
    monthNumber: 0,
    policy: { basketCost: 220 },
    households: [
      { id: 1, name: "Família Silva", adults: 2, children: 2, outOfLaborForce: 0, jobs: 1, sectorJobs: { farm: 1, commerce: 0, workshop: 0 }, happiness: 65, lastCashIncome: 1800, cash: 500, deposit: 0 },
      { id: 2, name: "Ana", adults: 1, children: 0, outOfLaborForce: 0, jobs: 0, sectorJobs: { farm: 0, commerce: 0, workshop: 0 }, happiness: 45, lastCashIncome: 0, cash: 50, deposit: 0 }
    ],
    housingCapacity: 10,
    urbanInfra: { congestionRatio: 1 },
    lastShortageUnits: 0,
    lastDemandUnits: 10,
    lastDemandUnits: 10,
    lastShortage: 0
  });
  const noEvents = { random: () => 0.99, birthProbability: 0, mortalityRates: { child: 0, adult: 0, elderly: 0 }, getLaborStats: () => ({ unemploymentRate: 50 }), approval: () => 55 };

  test("Inicializa pessoas individuais sem alterar a população agregada", () => {
    const sim = baseSimulation();
    society.initialize(sim);
    const members = sim.households.flatMap((h) => h.members);
    return { pass: members.length === 5 && sim.households.reduce((n, h) => n + h.adults + h.children, 0) === 5 && members.every((p) => p.id && p.age >= 0), people: members.length };
  });

  test("Não classifica trabalhadores disponíveis como fora da força de trabalho", () => {
    const sim = baseSimulation(); society.initialize(sim);
    const adults = sim.households.flatMap((h) => h.members).filter((person) => person.age >= 18 && person.age < 65);
    return { pass: adults.every((person) => person.laborForceStatus === "available"), available: adults.filter((person) => person.laborForceStatus === "available").length, total: adults.length };
  });

  test("Preserva alterações externas no status fora da força de trabalho", () => {
    const sim = baseSimulation(); society.initialize(sim);
    sim.households[1].outOfLaborForce = 1;
    society.advanceMonth(sim, noEvents);
    const h = sim.households[1];
    return { pass: h.outOfLaborForce === 1 && h.members.find((person) => person.age >= 18).laborForceStatus === "out", outOfLaborForce: h.outOfLaborForce };
  });

  test("Registra estrutura etária e razão de dependência", () => {
    const sim = baseSimulation(); society.initialize(sim);
    const d = society.getDemographicSnapshot(sim);
    return { pass: d.population === 5 && d.children === 2 && d.workingAge === 3 && d.elderly === 0 && d.dependencyRatio > 0, demographic: d };
  });

  test("Envelhecimento transforma adolescente em adulto", () => {
    const sim = baseSimulation(); society.initialize(sim);
    const person = sim.households[0].members.find((p) => p.age < 18); person.age = 17.99;
    society.advanceMonth(sim, noEvents);
    return { pass: person.age >= 18 && sim.households[0].adults === 3 && sim.households[0].children === 1, age: person.age, adults: sim.households[0].adults };
  });

  test("Aposentadoria demográfica retira pessoa da força de trabalho aos 65", () => {
    const sim = baseSimulation(); society.initialize(sim);
    const person = sim.households[0].members[0]; person.age = 64.99;
    society.advanceMonth(sim, noEvents);
    return { pass: person.age >= 65 && sim.households[0].outOfLaborForce === 1 && society.getDemographicSnapshot(sim).elderly === 1, outOfLaborForce: sim.households[0].outOfLaborForce };
  });

  test("Imigração cria pessoa, origem cultural e fluxo de entrada", () => {
    const sim = baseSimulation(); society.initialize(sim);
    const migrant = { id: 5, name: "Migrante 5", type: "single", adults: 1, children: 0, jobs: 0, sectorJobs: { farm: 0, commerce: 0, workshop: 0 }, happiness: 55, cash: 0, deposit: 0 };
    society.prepareImmigrant(sim, migrant, { month: 1, age: 29, cultureGroup: "regional" });
    sim.households.push(migrant);
    const o = society.overview(sim);
    return { pass: migrant.members.length === 1 && migrant.members[0].bornHere === false && migrant.members[0].origin === "município da região" && o.migration.monthly.incoming === 1 && o.demographic.foreignBorn === 1 && o.culture.groups.some((g) => g.id === "regional"), migration: o.migration.monthly, culture: o.culture };
  });

  test("Emigração registra saída sem apagar histórico migratório", () => {
    const sim = baseSimulation(); society.initialize(sim);
    society.recordDeparture(sim, sim.households[0], { month: 1, reason: "baixa atratividade" });
    const m = society.overview(sim).migration;
    return { pass: m.monthly.outgoing === 4 && m.monthly.net === -4 && m.cumulative.outgoing === 4, monthly: m.monthly };
  });

  test("Diversidade cultural é descritiva e normalizada entre grupos", () => {
    const sim = baseSimulation(); society.initialize(sim);
    const h = { id: 6, name: "Recém-chegado", adults: 1, children: 0, jobs: 0, happiness: 60, sectorJobs: {} };
    society.prepareImmigrant(sim, h, { month: 1, cultureGroup: "regional" }); sim.households.push(h);
    const c = society.refreshCulture(sim);
    return { pass: c.diversityIndex > 0 && c.diversityIndex <= 100 && c.groups.length === 2, diversity: c.diversityIndex, groups: c.groups.length };
  });

  test("Integração cultural melhora em ambiente com bem-estar e abastecimento", () => {
    const sim = baseSimulation(); society.initialize(sim);
    const h = { id: 7, name: "Migrante", adults: 1, children: 0, jobs: 1, happiness: 100, sectorJobs: {} };
    society.prepareImmigrant(sim, h, { month: 1, cultureGroup: "urbana" }); sim.households.push(h);
    const p = h.members[0]; const before = p.integration;
    society.advanceMonth(sim, { ...noEvents, month: 1 });
    society.advanceMonth(sim, { ...noEvents, month: 2 });
    return { pass: p.integration > before, before, after: p.integration };
  });

  test("Qualidade de vida responde à escassez alimentar", () => {
    const sim = baseSimulation(); society.initialize(sim);
    const good = society.calculateQualityOfLife(sim, { ...noEvents, getLaborStats: () => ({ unemploymentRate: 20 }) });
    sim.lastShortageUnits = 8;
    const bad = society.calculateQualityOfLife(sim, { ...noEvents, getLaborStats: () => ({ unemploymentRate: 20 }) });
    return { pass: bad.score < good.score && bad.components.foodSecurity < good.components.foodSecurity, good: good.score, bad: bad.score };
  });

  test("Qualidade de vida responde à piora do emprego", () => {
    const sim = baseSimulation(); society.initialize(sim);
    const low = society.calculateQualityOfLife(sim, { getLaborStats: () => ({ unemploymentRate: 10 }) });
    const high = society.calculateQualityOfLife(sim, { getLaborStats: () => ({ unemploymentRate: 90 }) });
    return { pass: high.score < low.score && high.components.employment < low.components.employment, low: low.score, high: high.score };
  });

  test("Qualidade de vida responde ao congestionamento urbano", () => {
    const sim = baseSimulation(); society.initialize(sim);
    const low = society.calculateQualityOfLife(sim, noEvents);
    sim.urbanInfra.congestionRatio = 2;
    const high = society.calculateQualityOfLife(sim, noEvents);
    return { pass: high.score < low.score && high.components.infrastructure === 50, low: low.score, high: high.score };
  });

  test("Nascimento conclui gestação sem alterar caixa ou balanços", () => {
    const sim = baseSimulation(); society.initialize(sim);
    const mother = sim.households[0].members.find((p) => p.sex === "F"); mother.pregnancyMonthsRemaining = 1;
    const cashBefore = sim.households.reduce((sum, h) => sum + h.cash + h.deposit, 0);
    const result = society.advanceMonth(sim, { ...noEvents, month: 1 });
    const cashAfter = sim.households.reduce((sum, h) => sum + h.cash + h.deposit, 0);
    return { pass: result.events.some((e) => e.type === "birth") && society.getDemographicSnapshot(sim).population === 6 && cashBefore === cashAfter, population: society.getDemographicSnapshot(sim).population };
  });

  test("Limite de filhos considera nascimentos concluídos no mesmo mês", () => {
    const sim = baseSimulation(); society.initialize(sim);
    const household = sim.households[0];
    const women = household.members.filter((person) => person.sex === "F" && person.age >= 20 && person.age <= 39);
    if (women.length === 0) return { pass: false, availableWomen: 0 };
    const secondWoman = { ...women[0], id: "test-second-woman", age: 30, pregnancyMonthsRemaining: null, monthsInVillage: 5 };
    household.members.push(secondWoman);
    household.adults += 1;
    household.children = 2;
    women[0].pregnancyMonthsRemaining = 1;
    society.advanceMonth(sim, { ...noEvents, random: () => 0, birthProbability: 1, month: 1 });
    return { pass: household.children === 3 && secondWoman.pregnancyMonthsRemaining === null, children: household.children, secondPregnancy: secondWoman.pregnancyMonthsRemaining };
  });

  test("Mortalidade atualiza a composição etária sem criar população negativa", () => {
    const sim = baseSimulation(); society.initialize(sim);
    const result = society.advanceMonth(sim, { random: () => 0, birthProbability: 0, mortalityRates: { child: 1, adult: 0, elderly: 0 }, getLaborStats: () => ({ unemploymentRate: 0 }), approval: () => 50, month: 1 });
    const d = society.getDemographicSnapshot(sim);
    return { pass: result.events.filter((e) => e.type === "death").length === 2 && d.population === 3 && d.children === 0, demographic: d };
  });

  test("Histórico de qualidade de vida não duplica fechamento mensal", () => {
    const sim = baseSimulation(); society.initialize(sim);
    society.advanceMonth(sim, { ...noEvents, month: 1 });
    society.advanceMonth(sim, { ...noEvents, month: 1 });
    const history = sim.society.qualityOfLife.history;
    return { pass: history.filter((item) => item.month === 1).length === 1, historyLength: history.length };
  });

  test("Histórico migratório preserva entradas e saídas por mês", () => {
    const sim = baseSimulation(); society.initialize(sim);
    const entrant = { id: 8, name: "Entrante", adults: 1, children: 0, jobs: 0, happiness: 55, sectorJobs: {} };
    society.prepareImmigrant(sim, entrant, { month: 1 }); sim.households.push(entrant);
    society.recordDeparture(sim, sim.households[0], { month: 1 });
    society.advanceMonth(sim, { ...noEvents, month: 1 });
    const month = sim.society.migration.history.find((item) => item.month === 1);
    return { pass: month && month.incoming === 1 && month.outgoing === 4 && month.net === -3, month };
  });

  test("Índice de qualidade de vida mantém escala de zero a cem", () => {
    const sim = baseSimulation(); society.initialize(sim);
    sim.lastShortageUnits = 100000; sim.lastDemandUnits = 1; sim.housingCapacity = 0; sim.urbanInfra.congestionRatio = 100;
    const q = society.calculateQualityOfLife(sim, { getLaborStats: () => ({ unemploymentRate: 100 }), approval: () => 0 });
    return { pass: q.score >= 0 && q.score <= 100 && Object.values(q.components).every((x) => x >= 0 && x <= 100), score: q.score };
  });

  test("Métricas sociais não movimentam caixa nem alteram depósitos", () => {
    const sim = baseSimulation(); society.initialize(sim);
    const before = sim.households.map((h) => [h.cash, h.deposit]);
    society.advanceMonth(sim, noEvents);
    const after = sim.households.map((h) => [h.cash, h.deposit]);
    return { pass: JSON.stringify(before) === JSON.stringify(after), before, after };
  });

  return { passed: results.filter((item) => item.passed).length, total: results.length, results };
}

if (require.main === module) {
  const result = run();
  for (const item of result.results) console.log(`${item.passed ? "✓" : "✗"} ${item.name}${item.passed ? "" : `: ${JSON.stringify(item.detail || item.error)}`}`);
  console.log(`Resultado: ${result.passed}/${result.total}`);
  if (result.passed !== result.total) process.exit(1);
}
module.exports = run;
