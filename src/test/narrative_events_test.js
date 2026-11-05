"use strict";
const assert = require("node:assert/strict");
const EventosV3 = require("../events/eventos_v3.js");

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

console.log("\n=== TESTES DO SISTEMA DE EVENTOS E NARRATIVA EMERGENTE ===");

// 1. Causalidade Econômica
test("Causalidade Econômica: 'desemprego_elevado' só dispara quando desemprego > 12% no mês >= 2", () => {
  const ev = EventosV3.EVENTOS.find(e => e.id === "desemprego_elevado");
  assert.ok(ev, "Evento desemprego_elevado deve existir");

  const sBaixo = EventosV3.novoEstado({ semente: 100 });
  sBaixo.desemprego = 6;
  sBaixo.mes = 3;
  assert.equal(ev.condicoes(sBaixo), false, "Não deve disparar com desemprego baixo (6%)");

  const sAlto = EventosV3.novoEstado({ semente: 101 });
  sAlto.desemprego = 14;
  sAlto.mes = 3;
  assert.equal(ev.condicoes(sAlto), true, "Deve disparar quando desemprego atinge 14%");
});

test("Causalidade Econômica: 'carestia_alimentos' dispara apenas sob escassez alimentar ou cesta cara", () => {
  const ev = EventosV3.EVENTOS.find(e => e.id === "carestia_alimentos");
  assert.ok(ev);

  const sNormal = EventosV3.novoEstado({ semente: 102 });
  sNormal.escassezMercado = 0;
  sNormal.precoCesta = 25;
  sNormal.mes = 3;
  assert.equal(ev.condicoes(sNormal), false);

  const sEscassez = EventosV3.novoEstado({ semente: 103 });
  sEscassez.escassezMercado = 0.6;
  sEscassez.mes = 3;
  assert.equal(ev.condicoes(sEscassez), true);

  const sCestaCara = EventosV3.novoEstado({ semente: 104 });
  sCestaCara.precoCesta = 38;
  sCestaCara.mes = 3;
  assert.equal(ev.condicoes(sCestaCara), true);
});

test("Causalidade Econômica: 'queda_arrecadacao' dispara sob déficit fiscal severo e caixa reduzido", () => {
  const ev = EventosV3.EVENTOS.find(e => e.id === "queda_arrecadacao");
  assert.ok(ev);

  const sPositivo = EventosV3.novoEstado({ semente: 105 });
  sPositivo.caixaTesouro = 12000;
  sPositivo.resultadoFiscal = 800;
  sPositivo.mes = 4;
  assert.equal(ev.condicoes(sPositivo), false);

  const sDeficit = EventosV3.novoEstado({ semente: 106 });
  sDeficit.caixaTesouro = 2200;
  sDeficit.resultadoFiscal = -1500;
  sDeficit.mes = 4;
  assert.equal(ev.condicoes(sDeficit), true);
});

// 2. Causalidade Social
test("Causalidade Social: 'sobrecarga_saude' dispara com saúde baixa e população expressiva", () => {
  const ev = EventosV3.EVENTOS.find(e => e.id === "sobrecarga_saude");
  assert.ok(ev);

  const sBoaSaude = EventosV3.novoEstado({ semente: 107 });
  sBoaSaude.qualidadeSaude = 70;
  sBoaSaude.populacao = 25;
  sBoaSaude.mes = 3;
  assert.equal(ev.condicoes(sBoaSaude), false);

  const sSobrecarga = EventosV3.novoEstado({ semente: 108 });
  sSobrecarga.qualidadeSaude = 30;
  sSobrecarga.populacao = 24;
  sSobrecarga.mes = 3;
  assert.equal(ev.condicoes(sSobrecarga), true);
});

test("Causalidade Social: 'deficit_habitacional_critico' dispara quando população atinge ou supera capacidade", () => {
  const ev = EventosV3.EVENTOS.find(e => e.id === "deficit_habitacional_critico");
  assert.ok(ev);

  const sComVagas = EventosV3.novoEstado({ semente: 109 });
  sComVagas.populacao = 18;
  sComVagas.capacidadeMoradia = 24;
  sComVagas.mes = 4;
  assert.equal(ev.condicoes(sComVagas), false);

  const sLotado = EventosV3.novoEstado({ semente: 110 });
  sLotado.populacao = 25;
  sLotado.capacidadeMoradia = 24;
  sLotado.mes = 4;
  assert.equal(ev.condicoes(sLotado), true);
});

test("Causalidade Social: 'desigualdade_social' dispara sob alto índice Gini no mês >= 4", () => {
  const ev = EventosV3.EVENTOS.find(e => e.id === "desigualdade_social");
  assert.ok(ev);

  const sEquilibrado = EventosV3.novoEstado({ semente: 111 });
  sEquilibrado.indiceGini = 35;
  sEquilibrado.mes = 4;
  assert.equal(ev.condicoes(sEquilibrado), false);

  const sDesigual = EventosV3.novoEstado({ semente: 112 });
  sDesigual.indiceGini = 52;
  sDesigual.mes = 4;
  assert.equal(ev.condicoes(sDesigual), true);
});

// 3. Causalidade Política
test("Causalidade Política: 'baixa_popularidade' e 'impasse_camara' reagem a seus respectivos limiares", () => {
  const evPop = EventosV3.EVENTOS.find(e => e.id === "baixa_popularidade");
  const evCam = EventosV3.EVENTOS.find(e => e.id === "impasse_camara");
  assert.ok(evPop);
  assert.ok(evCam);

  const sAprovado = EventosV3.novoEstado({ semente: 113 });
  sAprovado.moral = 68;
  sAprovado.apoioCamara = 75;
  sAprovado.mes = 4;
  assert.equal(evPop.condicoes(sAprovado), false);
  assert.equal(evCam.condicoes(sAprovado), false);

  const sCrise = EventosV3.novoEstado({ semente: 114 });
  sCrise.moral = 28;
  sCrise.apoioCamara = 32;
  sCrise.mes = 4;
  assert.equal(evPop.condicoes(sCrise), true);
  assert.equal(evCam.condicoes(sCrise), true);
});

// 4. Causalidade Positiva
test("Causalidade Positiva: 'superavit_recorde' e 'pleno_emprego' comemoram conquistas reais", () => {
  const evSup = EventosV3.EVENTOS.find(e => e.id === "superavit_recorde");
  const evEmp = EventosV3.EVENTOS.find(e => e.id === "pleno_emprego");
  assert.ok(evSup);
  assert.ok(evEmp);

  const sNormal = EventosV3.novoEstado({ semente: 115 });
  sNormal.resultadoFiscal = 200;
  sNormal.caixaTesouro = 8000;
  sNormal.desemprego = 7.5;
  sNormal.mes = 4;
  assert.equal(evSup.condicoes(sNormal), false);
  assert.equal(evEmp.condicoes(sNormal), false);

  const sProspero = EventosV3.novoEstado({ semente: 116 });
  sProspero.resultadoFiscal = 1200;
  sProspero.caixaTesouro = 18000;
  sProspero.desemprego = 3.2;
  sProspero.pib = 45000;
  sProspero.mes = 4;
  assert.equal(evSup.condicoes(sProspero), true);
  assert.equal(evEmp.condicoes(sProspero), true);
});

// 5. Encadeamento de Eventos e Quebra de Cadeia
test("Encadeamento de Eventos: ação proativa quebra a cadeia de desdobramentos adversos", () => {
  const s = EventosV3.novoEstado({ semente: 200 });
  s.desemprego = 15;
  s.mes = 2;
  s.caixaTesouro = 15000;

  const ev = EventosV3.EVENTOS.find(e => e.id === "desemprego_elevado");
  s.ativos.push({ id: ev.id, sev: "grave", mesesRestantes: ev.duracao, respondido: false });

  EventosV3.agendarEvento(s, "retracao_consumo", 2);
  assert.equal(s.agendados.length, 1, "Deve agendar retração do consumo");
  assert.equal(s.agendados[0].id, "retracao_consumo");

  const res = EventosV3.responder(s, "desemprego_elevado", "frente_trabalho");
  assert.equal(res, true, "Escolha deve ser aceita com caixa suficiente");
  assert.equal(s.agendados.length, 0, "A cadeia deve ter sido quebrada com o cancelamento do agendado");
  assert.ok(s.decisoesTomadas.length >= 1, "Deve registrar a decisão tomada");
  assert.equal(s.decisoesTomadas[0].idEscolha, "frente_trabalho");
  assert.equal(s.decisoesTomadas[0].escolhaId, "frente_trabalho");
});

test("Encadeamento de Eventos: inação ('aguardar_mercado') mantém a cadeia agendada para os próximos meses", () => {
  const s = EventosV3.novoEstado({ semente: 201 });
  s.desemprego = 15;
  s.mes = 2;

  const ev = EventosV3.EVENTOS.find(e => e.id === "desemprego_elevado");
  s.ativos.push({ id: ev.id, sev: "grave", mesesRestantes: ev.duracao, respondido: false });
  EventosV3.agendarEvento(s, "retracao_consumo", 2);

  const res = EventosV3.responder(s, "desemprego_elevado", "aguardar_mercado");
  assert.equal(res, true);
  assert.equal(s.agendados.length, 1, "O evento encadeado deve permanecer agendado");
});

// 6. Resolução de Decisão e Débito no Tesouro
test("Resolução de Decisão: débito correto na conta do Tesouro Municipal e rejeição em caso de falta de fundos", () => {
  const s = EventosV3.novoEstado({ semente: 202 });
  s.caixaTesouro = 1000;

  const ev = EventosV3.EVENTOS.find(e => e.id === "desemprego_elevado");
  s.ativos.push({ id: ev.id, sev: "grave", mesesRestantes: ev.duracao, respondido: false });

  const falha = EventosV3.responder(s, "desemprego_elevado", "frente_trabalho");
  assert.equal(falha, false, "Deve rejeitar decisão com custo superior ao caixa disponível");

  s.caixaTesouro = 5000;
  const sucesso = EventosV3.responder(s, "desemprego_elevado", "frente_trabalho");
  assert.equal(sucesso, true, "Deve aceitar quando há caixa suficiente no Tesouro");
  assert.equal(s.caixaTesouro, 2500, "Caixa do Tesouro deve ter debitado exatamente R$ 2.500");
});

// 7. Encerramento Antecipado (condicoesEncerramento)
test("Encerramento Antecipado: evento cessa quando sua condição causal se normaliza", () => {
  const s = EventosV3.novoEstado({ semente: 203 });
  s.populacao = 25;
  s.capacidadeMoradia = 20;
  s.mes = 3;

  const ev = EventosV3.EVENTOS.find(e => e.id === "deficit_habitacional_critico");
  assert.equal(ev.condicoes(s), true);

  s.ativos.push({ id: ev.id, sev: "grave", mesesRestantes: 5, respondido: true });

  s.capacidadeMoradia = 30;
  assert.equal(ev.condicoesEncerramento(s), true, "Condição de encerramento deve ser verdadeira");

  EventosV3.processarMes(s, 0, { calcularEconomia: false });
  const ativoAinda = s.ativos.some(a => a.id === "deficit_habitacional_critico");
  assert.equal(ativoAinda, false, "Evento deve ter sido encerrado antecipadamente pela normalização causal");
});

// 8. Persistência de Estado
test("Persistência de Estado: salvar e carregar preserva decisões tomadas e histórico de narrativa", () => {
  const s = EventosV3.novoEstado({ semente: 204 });
  s.caixaTesouro = 8000;
  s.decisoesTomadas.push({
    eventoId: "desemprego_elevado",
    escolhaId: "frente_trabalho",
    custo: 2500,
    mes: 5,
    detalhe: "Frente de Trabalho Municipal (custo Tesouro R$ 2500)"
  });

  const salvo = EventosV3.salvarEstado(s);
  assert.ok(typeof salvo === "string" && salvo.length > 50);

  const restaurado = EventosV3.carregarEstado(salvo);
  assert.equal(restaurado.caixaTesouro, 8000);
  assert.equal(restaurado.decisoesTomadas.length, 1);
  assert.equal(restaurado.decisoesTomadas[0].eventoId, "desemprego_elevado");
  assert.equal(restaurado.decisoesTomadas[0].detalhe, "Frente de Trabalho Municipal (custo Tesouro R$ 2500)");
});

console.log(`\nFinalizado: ${passed} passaram, ${failures.length} falharam.`);
if (failures.length > 0) {
  process.exit(1);
} else {
  console.log("Todos os testes de eventos narrativos emergentes foram concluídos com sucesso!\n");
}
