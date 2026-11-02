"use strict";
const assert = require("node:assert/strict");
const Services = require("../services/vilarejo_services.js");
let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log(`✓ ${name}`); }

test("cria as sete áreas públicas", () => assert.equal(Services.DOMAIN_IDS.length, 7));
test("inclui saneamento, água, eletricidade, petróleo e minerais", () => {
  const s = Services.createState(); const d = s.domains.infrastructure.indicators;
  for (const key of ["sanitation", "waterSecurity", "electricityReliability", "energyCapacity", "resourceGovernance"]) assert.ok(Number.isFinite(d[key]));
  for (const key of ["water", "electricity", "oil", "minerals"]) assert.ok(s.resources[key]);
});
test("não altera estado de outro domínio ao configurar alavanca", () => {
  const s = Services.createState(); const before = s.domains.education.indicators.learning;
  Services.setLever(s, "health", "primaryCare", 80);
  assert.equal(s.domains.education.indicators.learning, before);
});
test("rejeita alavancas desconhecidas", () => assert.throws(() => Services.setLever(Services.createState(), "health", "magic", 10)));
test("limita alavancas ao intervalo permitido", () => {
  const s = Services.createState(); Services.setLever(s, "health", "primaryCare", 500);
  assert.equal(s.domains.health.levers.primaryCare, 100);
});
test("rejeita eventos para domínios inexistentes", () => assert.throws(() => Services.applyEvent(Services.createState(), { domain: "x", indicator: "y" })));
test("rejeita indicadores que não pertencem ao domínio", () => assert.throws(() => Services.applyEvent(Services.createState(), { domain: "health", indicator: "oil" })));
test("limita o impacto de eventos", () => {
  const s = Services.createState(); const before = s.domains.health.indicators.access;
  const event = Services.applyEvent(s, { domain: "health", indicator: "access", delta: 999, reason: "teste" });
  assert.equal(event.delta, 25); assert.equal(s.domains.health.indicators.access, before + 25);
});
test("evolui mês sem valores inválidos", () => {
  const s = Services.createState(); const result = Services.advanceMonth(s, { month: 1 });
  assert.equal(result.month, 1); assert.equal(s.currentMonth, 1);
  for (const d of Object.values(s.domains)) for (const v of Object.values(d.indicators)) assert.ok(Number.isFinite(v) && v >= 0 && v <= 100);
});
test("efeito do saneamento alcança resultados de saúde", () => {
  const s = Services.createState();
  const low = Services.createState();
  Services.setLever(s, "infrastructure", "sanitation", 100);
  Services.setLever(low, "infrastructure", "sanitation", -100);
  for (let i = 0; i < 12; i++) { Services.advanceMonth(s); Services.advanceMonth(low); }
  assert.ok(s.domains.health.indicators.healthOutcomes > low.domains.health.indicators.healthOutcomes);
});
test("efeito da educação alcança talentos científicos", () => {
  const s = Services.createState(); Services.setLever(s, "education", "teacherDevelopment", 100);
  for (let i = 0; i < 12; i++) Services.advanceMonth(s);
  assert.ok(s.domains.science.indicators.talent > 38);
});
test("efeito da ciência alcança produtividade", () => {
  const s = Services.createState(); s.domains.science.indicators.innovation = 90;
  for (let i = 0; i < 12; i++) Services.advanceMonth(s);
  assert.ok(s.domains.development.indicators.productivity > 40);
});
test("energia altera confiabilidade elétrica", () => {
  const s = Services.createState(); Services.setLever(s, "infrastructure", "electricity", 100);
  for (let i = 0; i < 12; i++) Services.advanceMonth(s);
  assert.ok(s.resources.electricity.generation > 50);
});
test("petróleo não é renovável e reduz reservas com produção", () => {
  const s = Services.createState(); s.resources.oil.production = 80; const before = s.resources.oil.reserves;
  Services.updateResources(s, 1); assert.ok(s.resources.oil.reserves < before);
});
test("mineração registra pressão ambiental", () => {
  const s = Services.createState(); s.resources.minerals.extraction = 80; const before = s.resources.minerals.environmentalPressure;
  Services.updateResources(s, 1); assert.ok(s.resources.minerals.environmentalPressure > before);
});
test("governança reduz pressão ambiental relativa", () => {
  const a = Services.createState(); const b = Services.createState();
  a.resources.minerals.extraction = 80; b.resources.minerals.extraction = 80;
  a.domains.infrastructure.indicators.resourceGovernance = 90; b.domains.infrastructure.indicators.resourceGovernance = 10;
  Services.updateResources(a, 1); Services.updateResources(b, 1);
  assert.ok(a.resources.minerals.environmentalPressure < b.resources.minerals.environmentalPressure);
});
test("mantém histórico limitado", () => {
  const s = Services.createState(); for (let i = 0; i < 80; i++) Services.advanceMonth(s);
  assert.equal(s.history.length, 60); for (const d of Object.values(s.domains)) assert.equal(d.history.length, 36);
});
test("snapshot não permite mutação do estado original", () => {
  const s = Services.createState(); const snap = Services.getSnapshot(s);
  snap.domains.health.indicators.access = 0; assert.notEqual(s.domains.health.indicators.access, 0);
});
test("renderiza painel para as sete áreas e recursos", () => {
  const host = { innerHTML: "" }; Services.renderDashboard(Services.createState(), host);
  for (const name of ["Saúde", "Educação", "Segurança", "Ciência e Tecnologia", "Desenvolvimento", "Cultura", "Infraestrutura e Recursos Estratégicos", "Petróleo e gás", "Mineração"]) assert.ok(host.innerHTML.includes(name));
});
test("integra com runtime e fecha mês uma vez", () => {
  const handlers = new Map(); const modules = new Map(); let published = 0;
  const runtime = {
    modules: { has: (id) => modules.has(id), register: (m) => { for (const dep of (m.dependencies || [])) assert.ok(modules.has(dep), `dependência ${dep} ausente`); modules.set(m.id, m); }, updateSnapshot: (id, snapshot) => { assert.ok(modules.has(id)); modules.get(id).snapshot = snapshot; } },
    events: { on: (topic, fn) => { if (!handlers.has(topic)) handlers.set(topic, []); handlers.get(topic).push(fn); return () => {}; } },
    publish: (topic, payload) => { if (topic === "services:month-closed") published++; },
    clock: { snapshot: () => ({ economicMonthNumber: 1 }) }
  };
  for (const id of ["core", "economia", "sociedade"]) modules.set(id, { id });
  const adapter = Services.registerWithRuntime(runtime);
  for (const fn of handlers.get("economy:month-closed")) fn({ payload: { monthNumber: 1 } });
  assert.equal(adapter.state.currentMonth, 1); assert.equal(published, 1); assert.ok(modules.get("servicos").snapshot);
  for (const id of ["saude", "educacao", "seguranca", "ciencia", "desenvolvimento", "cultura", "infraestrutura"]) assert.ok(modules.has(id));
});
console.log(`\n${passed} testes de Serviços aprovados.`);
