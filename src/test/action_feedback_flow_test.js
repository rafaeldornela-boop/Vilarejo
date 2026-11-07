"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createSimulationContext } = require("./simulation_context.js");

const ROOT = path.join(__dirname, "../../");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "style.css"), "utf8");

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`  ✗ ${name}: ${error.stack || error}`);
  }
}

console.log("\n=== TESTES DE INTERFACE E FLUXO DE AÇÕES (FRENTE 2) ===");

// 1. Verificação de tela inicial e modais bloqueantes
test("Modal de ação (#actionConfirmModal) inicia com hidden e display:none na página", () => {
  const match = html.match(/<div\s+id=["']actionConfirmModal["'][^>]*>/i);
  assert.ok(match, "Elemento #actionConfirmModal deve existir no index.html");
  const modalTag = match[0];
  assert.ok(
    modalTag.includes("hidden"),
    "Elemento #actionConfirmModal deve possuir o atributo 'hidden'"
  );
  assert.ok(
    /style=["'][^"']*display\s*:\s*none/i.test(modalTag),
    "Elemento #actionConfirmModal deve ter inline style display:none para evitar flash inicial"
  );
});

test("CSS garante que .hidden, [hidden] e .welcome-modal-backdrop.hidden fiquem ocultos com !important", () => {
  assert.ok(
    /\.hidden,\s*\[hidden\][^{]*\{[^}]*display\s*:\s*none\s*!important/i.test(css),
    "style.css deve ter regra .hidden, [hidden] com display:none !important"
  );
  assert.ok(
    /\.welcome-modal-backdrop\.hidden[^{]*\{[^}]*display\s*:\s*none\s*!important/i.test(css),
    "style.css deve ter regra .welcome-modal-backdrop.hidden com display:none !important"
  );
});

// 2. Auditoria e catálogo de ações
test("Catálogo de ações (ACTION_CATALOG) contém todas as diretrizes fundamentais", () => {
  const ctx = createSimulationContext();
  const api = ctx.window.VilarejoTest;
  assert.ok(api, "VilarejoTest deve estar disponível no contexto");
  const catalog = api.getActionCatalog ? api.getActionCatalog() : null;
  assert.ok(catalog, "getActionCatalog deve retornar o catálogo");

  const requiredActions = [
    "build",
    "sellLot",
    "investCredit",
    "investInfra",
    "projSocialHousing",
    "projRuralRoad",
    "projSanitation",
    "projGrainSilo",
    "sell25Stake",
    "privatizeValuation",
    "toggleConcession",
    "buildFacility_health_post",
    "buildFacility_school",
    "buildFacility_police_station",
    "govAction_action_sanitary_clean",
    "govAction_action_security_patrol"
  ];

  for (const actId of requiredActions) {
    const act = catalog[actId];
    assert.ok(act, `Ação '${actId}' deve estar presente no catálogo`);
    assert.ok(act.title, `Ação '${actId}' deve ter título legível`);
    assert.ok(act.costLabel, `Ação '${actId}' deve ter costLabel claro`);
    assert.ok(act.benefitLabel, `Ação '${actId}' deve ter benefitLabel claro`);
    assert.ok(act.impactLabel, `Ação '${actId}' deve ter impactLabel claro`);
    assert.ok(typeof act.validate === "function", `Ação '${actId}' deve ter função de validação`);
    assert.ok(typeof act.execute === "function", `Ação '${actId}' deve ter função de execução`);
  }
});

// 3. Validação com feedback explícito e recusa justificada
test("Validação da ação 'Construir Moradia': recusa por falta de caixa com explicação explícita", () => {
  const ctx = createSimulationContext();
  const api = ctx.window.VilarejoTest;
  const flow = api.getActionFlow();
  assert.ok(flow, "VilarejoActionFlow deve estar disponível");

  const S = api.getInternalState();
  S.accounts.treasury = 500; // Menor que o custo de R$ 6.000

  const validation = flow.validateAction("build");
  assert.equal(validation.canExecute, false, "Construção de moradia não deve ser permitida sem caixa suficiente");
  assert.ok(
    validation.reason && validation.reason.includes("insuficiente"),
    `Motivo da recusa deve explicar caixa insuficiente: ${validation.reason}`
  );
  assert.ok(validation.details, "Validação deve fornecer detalhes explicativos");
});

test("Validação da ação 'Construir Moradia': recusa quando lotes públicos zeram", () => {
  const ctx = createSimulationContext();
  const api = ctx.window.VilarejoTest;
  const flow = api.getActionFlow();

  const S = api.getInternalState();
  S.accounts.treasury = 50000;
  S.lots = 0; // Sem lotes

  const validation = flow.validateAction("build");
  assert.equal(validation.canExecute, false, "Construção não deve ser permitida sem lotes");
  assert.ok(
    validation.reason && (validation.reason.includes("lote") || validation.reason.includes("terreno")),
    `Motivo da recusa deve apontar ausência de lotes: ${validation.reason}`
  );
});

// 4. Execução de 'Construir Moradia' com partidas dobradas (SFC) e obra em andamento
test("Fluxo piloto 'Construir Moradia': execução deduz caixa, consome lote e cadastra obra em andamento", () => {
  const ctx = createSimulationContext();
  const api = ctx.window.VilarejoTest;
  const flow = api.getActionFlow();

  const S = api.getInternalState();
  S.accounts.treasury = 20000;
  S.lots = 5;

  const result = flow.executeAction("build");
  assert.ok(result.success, "Execução deve ser bem-sucedida com caixa e lotes válidos");
  assert.equal(S.accounts.treasury, 14000, "Caixa do Tesouro deve ter deduzido exatamente R$ 6.000");
  assert.equal(S.lots, 4, "Lote público deve ter sido consumido (-1)");

  // Verificar obra em andamento em buildings
  assert.ok(Array.isArray(S.buildings), "S.buildings deve ser uma lista");
  const construction = S.buildings.find((b) => b.type === "house");
  assert.ok(construction, "Obra residencial deve estar registrada em S.buildings");
  assert.equal(construction.due, S.day + 30, "Obra deve vencer em 30 dias");
});

// 5. Conclusão da obra após decurso de 30 dias na simulação
test("Conclusão de moradia após 30 dias: capacidade habitacional aumenta (+2) e prédio é integrado", () => {
  const ctx = createSimulationContext();
  const api = ctx.window.VilarejoTest;
  const flow = api.getActionFlow();

  const S = api.getInternalState();
  S.accounts.treasury = 25000;
  S.lots = 5;
  const initialCapacity = S.housingCapacity || 12;

  flow.executeAction("build");
  assert.equal(S.buildings.length, 1, "Uma obra em andamento em S.buildings");

  // Simular 1 mês (30 dias)
  api.simulateMonths(1, false);

  assert.equal(S.buildings.length, 0, "Obra deve ter sido concluída e removida da fila");
  assert.equal(
    S.housingCapacity,
    initialCapacity + 2,
    "Capacidade habitacional deve ter aumentado em 2 vagas após a conclusão"
  );
  assert.ok(
    S.completedProjects.some((p) => String(p).includes("bld_") || String(p).includes("residential")),
    "Prédio deve estar registrado nos projetos/edificações concluídas do vilarejo"
  );
});

// 6. Teste de ações de infraestrutura e serviços públicos
test("Ação de infraestrutura 'projRuralRoad': executa com SFC e agenda pavimentação", () => {
  const ctx = createSimulationContext();
  const api = ctx.window.VilarejoTest;
  const flow = api.getActionFlow();

  const S = api.getInternalState();
  S.accounts.treasury = 30000;

  const result = flow.executeAction("projRuralRoad");
  assert.ok(result.success, "Estrada rural deve ser iniciada com sucesso");
  assert.equal(S.accounts.treasury, 22000, "Custo de R$ 8.000 deve ser deduzido");
  assert.equal(S.ruralRoadBuilt, 1, "Estrada rural deve estar construída");
});

test("Ação governamental 'govAction_action_sanitary_clean': executa deduzindo custeio e registrando feed", () => {
  const ctx = createSimulationContext();
  const api = ctx.window.VilarejoTest;
  const flow = api.getActionFlow();

  const S = api.getInternalState();
  S.accounts.treasury = 10000;

  const result = flow.executeAction("govAction_action_sanitary_clean");
  assert.ok(result.success, "Mutirão sanitário deve ser executado");
  assert.equal(S.accounts.treasury, 9200, "Custo operacional de R$ 800 deve ser deduzido");
  assert.ok(
    S.feed.some((f) => f.includes("sanitário") || f.includes("Mutirão") || f.includes("Sanitário")),
    "Feed de eventos deve relatar o mutirão sanitário"
  );
});

// 7. Teste de concessão privada (toggleConcession)
test("Ação 'toggleConcession': alterna entre concessão privada e controle público", () => {
  const ctx = createSimulationContext();
  const api = ctx.window.VilarejoTest;
  const flow = api.getActionFlow();

  const S = api.getInternalState();
  const initialStatus = Boolean(S.concessionActive);

  const res1 = flow.executeAction("toggleConcession");
  assert.ok(res1.success);
  assert.equal(S.concessionActive, !initialStatus, "Concessão deve ter sido alternada");

  const res2 = flow.executeAction("toggleConcession");
  assert.ok(res2.success);
  assert.equal(S.concessionActive, initialStatus, "Concessão deve ter retornado ao estado original");
});

console.log(`\nResultado Frente 2: ${passed} verificações aprovadas; ${failures.length} reprovadas.`);
if (failures.length > 0) {
  process.exit(1);
}
