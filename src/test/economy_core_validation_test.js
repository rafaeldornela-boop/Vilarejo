"use strict";

const assert = require("node:assert");
const vm = require("node:vm");
const { createSimulationContext } = require("./simulation_context.js");

console.log("\n========================================================");
console.log("=== SUÍTE DE VALIDAÇÃO ECONÔMICA ESTRUTURAL (6 EIXOS) ===");
console.log("========================================================\n");

const ctx = createSimulationContext();
const api = ctx.window.VilarejoTest;
const getS = () => vm.runInContext("S", ctx);
const run = (code) => vm.runInContext(code, ctx);

let totalTests = 0;
let passedTests = 0;

function test(title, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ [EIXO ${totalTests}] ${title}`);
  } catch (err) {
    console.error(`  ✗ [EIXO ${totalTests}] ${title}`);
    console.error(`    Erro: ${err.message}`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 1. JUROS SOBRE PRINCIPAL VENCIDO (SEM ANATOCISMO E CASCATA ESTRITA)
// ---------------------------------------------------------------------------
test("1.1 Juros correntes incidem sobre principal regular + vencido, sem anatocismo", () => {
  api.reset();
  const S = getS();
  run("log('external', 'bank', 50000, 'Capital bancário de teste')");
  
  // Empréstimo inicial de R$ 10.000 para a oficina
  const loanAmount = api.issueLoan("workshop", 10000, "Crédito estrutural de teste");
  assert.strictEqual(loanAmount, 10000);
  const loan = S.bankLoans.find(l => l.borrower === "workshop");
  assert(loan, "Empréstimo deve existir");
  
  // Forçar principal vencido e juros vencidos simulando inadimplência anterior
  loan.principal = 6000;
  loan.principalArrears = 4000;
  loan.interestArrears = 500; // Juros vencidos acumulados
  loan.rate = 0.025; // 2,5% a.m.
  
  // Base de cálculo esperada para juros correntes: principal (6000) + principalArrears (4000) = 10000
  // Juros correntes esperados: 10000 * 0.025 = 250.
  // SE houvesse anatocismo, incidiria sobre (6000 + 4000 + 500) = 10500 * 0.025 = 262.50.
  // Zera caixa da oficina para não pagar nada neste mês e observar o cálculo de juros correntes
  run("log('workshop', 'external', balance('workshop'), 'Esvazia caixa para inadimplência total')");
  
  api.settleBankLoans();
  
  // Os juros correntes apurados devem ser exatamente R$ 250,00
  assert.strictEqual(S.bankAccruedInterest, 250, "Juros correntes devem incidir estritamente sobre principal regular + vencido");
  // O saldo de juros vencidos deve agora ser 500 + 250 = 750
  assert.strictEqual(loan.interestArrears, 750, "Juros correntes não pagos devem se acumular em interestArrears sem capitalização antecipada");
  assert(run("auditCashConservation().ok"), "Conservação de caixa deve permanecer íntegra");
});

test("1.2 Cascata estrita de quitação: 1º Juros Vencidos, 2º Juros Correntes, 3º Principal Vencido, 4º Principal Corrente", () => {
  api.reset();
  const S = getS();
  run("log('external', 'bank', 50000, 'Capital bancário de teste')");
  api.issueLoan("workshop", 10000, "Crédito cascata");
  const loan = S.bankLoans.find(l => l.borrower === "workshop");
  
  loan.principal = 5000;
  loan.principalArrears = 3000;
  loan.interestArrears = 200;
  loan.rate = 0.02; // 2% -> juros correntes = (5000 + 3000) * 0.02 = 160
  loan.term = 10; // parcela corrente de principal = 5000 / 10 = 500
  
  // Zera o caixa e fornece exatamente R$ 300 para teste do 1º e 2º degraus
  run("log('workshop', 'external', balance('workshop'), 'Limpa caixa')");
  run("log('external', 'workshop', 300, 'Injeta R$ 300')");
  
  // Total devido: 200 (IA) + 160 (IC) + 3000 (PA) + 500 (PC) = 3860
  // Com R$ 300:
  // - 1º: paga 200 de interestArrears -> resta R$ 100 de caixa, interestArrears fica 0
  // - 2º: paga 100 de interestCurrent (dos 160 devidos) -> resta R$ 0 de caixa, juros não pagos = 60 migram para interestArrears
  // - 3º e 4º: principalArrears (3000) e principalCurrent (500) não recebem pagamento; 500 corrente migra para principalArrears (3500)
  api.settleBankLoans();
  
  assert.strictEqual(loan.interestArrears, 60, "interestArrears deve conter exatamente o saldo remanescente de juros correntes não pagos");
  assert.strictEqual(loan.principalArrears, 3500, "principalArrears deve incorporar a parcela de principal corrente não paga");
  assert.strictEqual(loan.principal, 4500, "principal regular deve abater a parcela corrente transferida para atraso");
  assert.strictEqual(run("balance('workshop')"), 0, "Caixa disponível deve ter sido integralmente consumido na ordem da cascata");
  assert(run("auditCashConservation().ok"), "Conservação de caixa íntegra");
});

// ---------------------------------------------------------------------------
// 2. INADIMPLÊNCIA E PERDAS BANCÁRIAS EXPLÍCITAS
// ---------------------------------------------------------------------------
test("2.1 Registro contábil de perdas, provisões e alívio de dívida sem movimentação de caixa", () => {
  api.reset();
  const S = getS();
  run("log('external', 'bank', 50000, 'Capital bancário de teste')");
  api.issueLoan("commerce", 12000, "Crédito comércio");
  const loan = S.bankLoans.find(l => l.borrower === "commerce");
  loan.principal = 8000;
  loan.principalArrears = 3000;
  loan.interestArrears = 1000; // Dívida total = 12.000
  
  const bankCashBefore = run("balance('bank')");
  const commCashBefore = run("balance('commerce')");
  const debtBefore = api.totalLoans("commerce");
  assert.strictEqual(debtBefore, 12000);
  
  // Baixa contábil de 50%
  const writtenOff = api.writeDownLoansForBorrower("commerce", 0.50);
  assert.strictEqual(writtenOff, 6000, "Perda reconhecida deve ser exatamente 50% da carteira (R$ 6.000)");
  assert.strictEqual(api.totalLoans("commerce"), 6000, "Dívida remanescente deve ser R$ 6.000");
  
  // Verificação de ausência de movimentação de caixa
  assert.strictEqual(run("balance('bank')"), bankCashBefore, "Banco não deve movimentar caixa na baixa de crédito");
  assert.strictEqual(run("balance('commerce')"), commCashBefore, "Tomador não deve movimentar caixa na baixa de crédito");
  
  // Verificação de simetria Stock-Flow Consistent
  assert.strictEqual(S.lastBankCreditLosses, 6000, "Perda bancária do período deve registrar R$ 6.000");
  assert.strictEqual(S.cumulativeBankWriteDowns, S.cumulativeDebtorRelief, "Write-downs acumulados do banco devem igualar o alívio do devedor");
  
  // Balanço patrimonial expõe os dados
  const bs = api.generateBalanceSheets();
  assert.strictEqual(bs.bank.details.creditLosses, 6000, "Balanço do banco deve expor perdas por crédito");
  assert.strictEqual(bs.bank.details.cumulativeWriteDowns, 6000, "Balanço do banco deve expor write-downs acumulados");
  assert.strictEqual(bs.bank.details.provisions, (3000 * 0.5) + (1000 * 0.5), "Provisões devem refletir a inadimplência restante");
  assert(bs.audit.check7_writeDownsMatch, "Checagem 7 SFC de baixas contábeis deve passar");
  assert(bs.audit.cashOk, "Conservação de caixa deve passar");
});

// ---------------------------------------------------------------------------
// 3. DEPRECIAÇÃO E PATRIMÔNIO DAS FIRMAS
// ---------------------------------------------------------------------------
test("3.1 Depreciação dedutível no LAIR, sem saída monetária, reduzindo capital imobilizado", () => {
  api.reset();
  const S = getS();
  
  // Modelo privado para testar dedução no LAIR e incidência de IRPJ
  S.owner = "private";
  run("log('stateFarm', 'privateFarm', balance('stateFarm'), 'Transfere caixa para fazenda privada')");
  run("log('external', 'privateFarm', 20000, 'Caixa operacional da fazenda privada')");
  
  const farm = S.firms.find(f => f.id === "farm");
  assert(farm, "Firma farm deve existir");
  farm.account = "privateFarm";
  farm.operator = "private";
  
  const initialCapital = farm.capitalStock; // 40.000
  const initialCash = farm.cash;
  const deprRate = farm.depreciationRate; // 0.0025
  const expectedDepr = run(`round2(${initialCapital} * ${deprRate})`); // 100
  
  // Simular receita e custos operacionais
  S.monthFarmRevenue = 10000;
  S.monthFarmCosts = 4000;
  
  run("settleProfitTax()");
  
  assert.strictEqual(S.lastFarmDepreciation, expectedDepr, "Depreciação deve ser calculada pela taxa sobre o capital");
  assert.strictEqual(farm.capitalStock, initialCapital - expectedDepr, "Capital imobilizado deve ser reduzido pelo valor da depreciação");
  
  // LAIR = EBITDA (10000 - 4000 = 6000) - Depreciação (100) - Juros (0) = 5900
  assert.strictEqual(S.lastFarmProfit, 5900, "LAIR deve deduzir a depreciação do EBITDA");
  
  // IRPJ = 20% de 5900 = 1180
  const expectedTax = run(`round2(5900 * (${S.policy.profitTax} / 100))`);
  assert.strictEqual(S.lastProfitTax, expectedTax, "IRPJ deve incidir sobre o lucro após depreciação");
  
  // Getters patrimoniais da firma
  assert(typeof farm.inventoryValue === "number", "Getter inventoryValue deve existir e ser numérico");
  assert(typeof farm.assets === "number", "Getter assets deve existir e ser numérico");
  assert(typeof farm.liabilities === "number", "Getter liabilities deve existir e ser numérico");
  assert(typeof farm.netWorth === "number", "Getter netWorth deve existir e ser numérico");
  assert.strictEqual(farm.netWorth, run(`round2(${farm.assets} - ${farm.liabilities})`), "netWorth deve ser assets - liabilities");
});

// ---------------------------------------------------------------------------
// 4. RECONCILIAÇÃO DOS BALANÇOS SETORIAIS (SFC)
// ---------------------------------------------------------------------------
test("4.1 Reconciliação dos 5 setores e Teorema da Riqueza Real SFC", () => {
  api.reset();
  
  // Simula 3 meses para gerar fluxos entre todos os setores
  api.simulateMonths(3);
  
  const bs = api.generateBalanceSheets();
  const audit = bs.audit;
  
  // 1. Todas as 10 checagens automatizadas devem ser estritamente satisfeitas
  assert(audit.check1_balanceSheetsPerSector, "1. Balanços setoriais (Ativos = Passivos + PL)");
  assert(audit.check2_depositsMatch, "2. Depósitos famílias == passivo bancário");
  assert(audit.check3_creditMatch, "3. Carteira do banco == dívidas dos tomadores");
  assert(audit.check4_taxesMatch, "4. Créditos tributários == dívidas fiscais");
  assert(audit.check5_wagesMatch, "5. Salários a receber == salários a pagar");
  assert(audit.check6_rentsMatch, "6. Aluguéis a receber == aluguéis a pagar");
  assert(audit.check7_writeDownsMatch, "7. Baixas de crédito simétricas");
  assert(audit.check8_cashConservation, "8. Conservação estrita da moeda (Entradas - Saídas = Caixa)");
  assert(audit.check9_numericalIntegrity, "9. Integridade numérica (sem NaN, Infinito ou negativos indevidos)");
  
  // 2. Identidade macroeconômica da riqueza real (Stock-Flow Consistency)
  // Patrimônio Líquido Doméstico Total - Posição Externa Líquida = Ativos Físicos Totais
  assert(audit.check10_macroWealthConservation, "10. Teorema da Riqueza Real SFC");
  assert(Math.abs(audit.macroWealthAudit.difference) < 0.05, "Diferença da riqueza real deve ser desprezível (< R$ 0,05)");
  assert(audit.allPass, "Auditoria consolidada allPass deve ser true");
});

// ---------------------------------------------------------------------------
// 5. ESTRUTURA OPERACIONAL DE S.firms
// ---------------------------------------------------------------------------
test("5.1 Cadastro de S.firms, autonomia contábil estatal vs Tesouro e contratos", () => {
  api.reset();
  const S = getS();
  const firms = S.firms;
  assert(Array.isArray(firms) && firms.length >= 3, "S.firms deve conter as firmas base");
  
  const farm = firms.find(f => f.id === "farm");
  const comm = firms.find(f => f.id === "commerce");
  const work = firms.find(f => f.id === "workshop");
  
  assert(farm && comm && work, "Firma agrícola, comercial e de serviços devem estar cadastradas");
  
  // Autonomia entre fazenda estatal e Tesouro público
  assert.strictEqual(farm.account, "stateFarm", "Conta da fazenda deve ser stateFarm");
  assert.notStrictEqual(farm.account, "treasury", "Conta da fazenda não pode ser a conta geral do Tesouro");
  
  // Atributos obrigatórios do contrato canônico de firma
  for (const f of firms) {
    assert(f.id, "Firma deve ter id");
    assert(f.name, "Firma deve ter name");
    assert(f.sector, "Firma deve ter sector");
    assert(f.account, "Firma deve ter account");
    assert(f.contract && f.contract.type, "Firma deve ter contrato formal");
    assert(typeof f.capitalStock === "number", "Firma deve ter capitalStock");
    assert(typeof f.depreciationRate === "number", "Firma deve ter depreciationRate");
    assert(f.inventory && typeof f.inventory.quantity === "number", "Firma deve ter estoque formal");
    assert(typeof f.productivityFactor === "number", "Firma deve ter TFP");
    assert(typeof f.cash === "number", "Firma deve ter getter cash");
    assert(typeof f.loans === "number", "Firma deve ter getter loans");
    assert(typeof f.netWorth === "number", "Firma deve ter getter netWorth");
    assert(f.behavior && typeof f.behavior.plan === "function", "Firma deve implementar behavior.plan");
    assert(f.behavior && typeof f.behavior.produce === "function", "Firma deve implementar behavior.produce");
  }
});

// ---------------------------------------------------------------------------
// 6. PRODUÇÃO, TRABALHO E FORMAÇÃO DE PREÇOS
// ---------------------------------------------------------------------------
test("6.1 Mercado de trabalho coletivo sem viés e formação dinâmica de preços", () => {
  api.reset();
  const S = getS();
  
  // 1. Alocação de mão de obra coletiva
  const laborBefore = api.getLaborStats();
  assert(laborBefore.pit > 0, "População em idade ativa deve ser positiva");
  
  api.matchCollectiveLaborMarket();
  const laborAfter = api.getLaborStats();
  assert(laborAfter.occupied > 0, "Deve haver trabalhadores alocados após matching");
  assert(laborAfter.occupied <= laborAfter.pit, "Ocupados não podem exceder a população em idade ativa");
  
  // 2. Preço de mercado: sensibilidade ao câmbio e pressão de oferta
  const initialPrice = S.marketPrice;
  S.fx = 7.0; // Desvalorização cambial
  S.lastShortageUnits = 10; // Choque de escassez
  api.updateMarketPrice();
  
  assert(S.marketPrice > initialPrice, "Preço de mercado deve subir com desvalorização cambial e escassez");
  assert(S.marketPressure >= 1.0, "Pressão de mercado deve ser >= 1.0 sob escassez");
  assert(S.costOfLivingIndex > 100, "Índice de custo de vida deve refletir a inflação de alimentos");
  
  // 3. Consumo familiar via LES (Linear Expenditure System)
  run("log('external', 'house:1', 5000, 'Injeção de renda familiar para teste LES')");
  api.runFirmCommercializationPhase();
  assert(typeof S.lastFoodConsumption === "number", "Consumo de alimentos deve ser registrado");
  assert(typeof S.lastServiceConsumption === "number", "Consumo de serviços deve ser registrado");
  assert(run("auditCashConservation().ok"), "Conservação de caixa íntegra após fases produtivas e de consumo");
});

// ---------------------------------------------------------------------------
// 7. FRENTE 1: MIGRAÇÃO FAMILIAR E DÉFICIT HABITACIONAL
// ---------------------------------------------------------------------------
test("7.1 Migração demográfica realista com famílias, crianças e cálculo de déficit habitacional", () => {
  api.reset();
  const S = getS();
  
  // Salário atrativo e vagas abertas no Vilarejo
  S.wage = 2800;
  S.externalWage = 1500;
  S.lots = 5;
  S.housingCapacity = 8; // Capacidade deliberadamente restrita para testar déficit
  
  // Forçar vagas para induzir atratividade Harris-Todaro
  const farm = S.firms.find(f => f.id === "farm");
  farm.openVacancies = 6;
  farm.activeWorkers = 2;
  
  const popBefore = run("population()");
  const migResult = api.processHarrisTodaroMigration();
  
  // Estatísticas de migração
  const stats = api.getMigrationStats();
  assert(stats !== undefined, "Estatísticas de migração devem ser expostas");
  assert(typeof stats.cumulativeIn === "number", "cumulativeIn deve ser numérico");
  assert(typeof stats.net === "number", "net deve ser numérico");
  
  // Verificar cálculo de déficit habitacional
  const currentPop = run("population()");
  const expectedDeficit = Math.max(0, currentPop - (S.housingCapacity || 12));
  assert.strictEqual(S.housingDeficit, expectedDeficit, "housingDeficit deve mensurar a população excedente à capacidade instalada");
  
  // Verificar tipologias dos domicílios presentes
  const households = S.households;
  const hasAdults = households.every(h => h.adults >= 1);
  assert(hasAdults, "Todos os domicílios devem possuir ao menos 1 adulto");
  assert(run("auditCashConservation().ok"), "Conservação monetária íntegra após dinâmica migratória");
  assert(api.generateBalanceSheets().audit.allPass, "Balanços patrimoniais consistentes");
});

// ---------------------------------------------------------------------------
// 8. FRENTE 1: CADEIAS PRODUTIVAS E ABASTECIMENTO AGROALIMENTAR LOCAL
// ---------------------------------------------------------------------------
test("8.1 Cadeia produtiva local: Comércio adquire excedente alimentar da lavoura com desconto", () => {
  api.reset();
  const S = getS();
  const farm = S.firms.find(f => f.id === "farm");
  const comm = S.firms.find(f => f.id === "commerce");
  
  // Simular período de safra para gerar excedente de alimentos
  S.day = 160; // Dia de colheita
  run("log('external', 'stateFarm', 20000, 'Capital para insumos agrícolas')");
  farm.activeWorkers = 4;
  farm.behavior.produce(farm, { day: 160, fx: 5, weatherFactor: 1 });
  
  assert(farm.localFoodStock > 0, "Fazenda deve produzir alimentos locais como co-produto da safra");
  assert.strictEqual(S.farmLocalFoodStock, farm.localFoodStock, "S.farmLocalFoodStock deve sincronizar com o estoque da fazenda");
  
  const initialLocalStock = farm.localFoodStock;
  const commCashBefore = run("balance('commerce')");
  const farmCashBefore = run("balance(farmAccount())");
  
  // Comércio planeja abastecimento com demanda de 10 unidades
  run("log('external', 'commerce', 15000, 'Liquidez comercial')");
  const prodRes = comm.behavior.produce(comm, { demand: 10 });
  
  assert(prodRes.localFoodPurchased > 0, "Comércio deve adquirir prioritariamente alimentos da lavoura local");
  assert(farm.localFoodStock < initialLocalStock, "Estoque de alimentos da fazenda deve ser abatido pela venda ao comércio");
  
  // Autonomia alimentar local calculada
  const supplyStats = api.getSupplyChainStats();
  assert(supplyStats.localFoodAutonomy > 0, "Índice de autonomia alimentar local deve ser positivo");
  
  // Conservação de caixa estrita: dinheiro saiu do comércio e entrou na fazenda
  assert(run("auditCashConservation().ok"), "Conservação de caixa íntegra na transação intersetorial B2B");
  assert(api.generateBalanceSheets().audit.allPass, "SFC preservada após comércio inter-firmas");
});

// ---------------------------------------------------------------------------
// 9. FRENTE 1: OBRAS ESTRUTURANTES E CATÁLOGO DE INFRAESTRUTURA
// ---------------------------------------------------------------------------
test("9.1 Catálogo de infraestrutura estruturante: execução e impacto na produtividade e capacidade", () => {
  api.reset();
  const S = getS();
  
  const projects = api.getInfrastructureProjects();
  assert(projects.rural_road, "Projeto rural_road deve existir no catálogo");
  assert(projects.social_housing, "Projeto social_housing deve existir no catálogo");
  assert(projects.sanitation_health, "Projeto sanitation_health deve existir no catálogo");
  
  // Capitalizar Tesouro para investimentos públicos
  run("log('external', 'treasury', 50000, 'Recursos fiscais para investimentos em infraestrutura')");
  
  const farm = S.firms.find(f => f.id === "farm");
  const initialTFP = farm.productivityFactor || 1.0;
  
  // 1. Pavimentação de Estrada Vicinal (R$ 8.000 -> +5% TFP permanente na lavoura)
  const initialFarmTFP = farm.productivityFactor;
  const roadExec = api.executeInfrastructureProject("rural_road");
  assert.strictEqual(roadExec, 8000, "Obra de estrada rural deve custar R$ 8.000");
  assert.strictEqual(farm.productivityFactor, api.round2(initialFarmTFP + 0.05), "TFP da fazenda deve incorporar bônus de 5% (+0.05) da estrada vicinal");
  
  // 2. Habitação de Interesse Social (R$ 6.000 -> +4 capacidade habitacional, consome 1 lote)
  const initialCap = S.housingCapacity || 12;
  const initialLots = S.lots;
  const houseExec = api.executeInfrastructureProject("social_housing");
  assert.strictEqual(houseExec, 6000, "Obra de habitação social deve custar R$ 6.000");
  assert.strictEqual(S.housingCapacity, initialCap + 4, "Capacidade habitacional deve aumentar em +4");
  assert.strictEqual(S.lots, initialLots - 1, "Construção de moradias sociais deve consumir 1 lote público");
  
  // 3. Auditoria SFC e conservação de caixa
  assert(run("auditCashConservation().ok"), "Conservação de moeda íntegra após obras públicas");
  const bs = api.generateBalanceSheets();
  assert(bs.audit.allPass, "Todos os balanços patrimoniais íntegros");
});

// ---------------------------------------------------------------------------
// 10. FRENTE 2: INTERFACE, JORNAL E PLANO DE METAS (PPA)
// ---------------------------------------------------------------------------
test("10.1 Integração da Frente 2: Jornal, Mundo Vivo e Dashboard com o Plano de Metas", () => {
  api.reset();
  const S = getS();
  
  // Executar obra de estrada vicinal e simular colheita com abastecimento local
  run("log('external', 'treasury', 50000, 'Caixa do Tesouro para obras')");
  api.executeInfrastructureProject("rural_road");
  
  // Fechar o mês econômico
  run("closeMonth()");
  
  // Snapshot expõe os novos dados para o Dashboard
  const snap = api.stateSnapshot();
  assert(snap.housingCapacity >= 12, "housingCapacity deve estar no snapshot");
  assert(typeof snap.housingDeficit === "number", "housingDeficit deve estar no snapshot");
  assert(Array.isArray(snap.completedProjects), "completedProjects deve ser array no snapshot");
  assert(snap.completedProjects.some(p => p.id === "rural_road"), "Estrada rural deve constar nas obras concluídas");
  
  // Balanço patrimonial e conservação íntegros
  assert(run("auditCashConservation().ok"), "Conservação de caixa íntegra");
  assert(api.generateBalanceSheets().audit.allPass, "SFC íntegra");
});

console.log(`\n========================================================`);
console.log(`=== TODOS OS ${passedTests}/${totalTests} TESTES ESTRUTURAIS APROVADOS COM SUCESSO! ===`);
console.log(`========================================================\n`);
