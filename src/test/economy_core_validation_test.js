"use strict";

const assert = require("node:assert");
const vm = require("node:vm");
const { createSimulationContext } = require("./simulation_context.js");

console.log("\n========================================================");
console.log("=== SUÍTE DE VALIDAÇÃO ECONÔMICA ESTRUTURAL (EIXOS 1 A 20) ===");
console.log("========================================================\n");

const ctx = createSimulationContext({ includeDomainModules: true });
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

// ---------------------------------------------------------------------------
// 11. COOPERATIVA AGROARTESANAL E AGROINDÚSTRIA LOCAL
// ---------------------------------------------------------------------------
test("11.1 Cooperativa Agroartesanal: fundação, processamento B2B, agregação de valor e distribuição de sobras", () => {
  api.reset();
  const S = getS();
  
  // 1. Fundação da Cooperativa pelo Tesouro Municipal
  run("log('external', 'treasury', 20000, 'Aporte no Tesouro')");
  const initialCoopCash = 3000;
  const coopFirm = api.foundCooperative(initialCoopCash, "treasury");
  
  assert(coopFirm && coopFirm.id === "cooperative", "Firma da cooperativa deve ser registrada em S.firms");
  assert(run("balance('cooperative')") === initialCoopCash, "Conta 'cooperative' deve ter saldo inicial transferido");
  assert(S.cooperativeActive === true, "cooperativeActive deve ser true após fundação");
  
  // 2. Simular mês com safra para validar compra B2B da fazenda e agregação de valor
  run("log('external', 'stateFarm', 5000, 'Capital para lavoura')");
  run("closeMonth()");
  
  const snap = api.stateSnapshot();
  assert(snap.cooperativeActive === true, "Snapshot deve expor cooperativeActive");
  assert(snap.accounts.cooperative >= 0, "Caixa da cooperativa deve ser positivo ou nulo");
  
  // 3. Distribuição de sobras líquidas cooperativas aos cooperados (famílias)
  run("log('external', 'cooperative', 4000, 'Resultado líquido do ciclo')");
  const surplusResult = api.distributeCooperativeSurplus();
  assert(surplusResult.distributed > 0, "Sobras cooperativas devem ser distribuídas aos cooperados");
  assert(surplusResult.householdCount > 0, "Famílias associadas devem ser beneficiadas");
  
  // 4. Auditoria SFC e conservação de caixa
  assert(run("auditCashConservation().ok"), "Conservação de moeda estrita na operação cooperativa");
  const bs = api.generateBalanceSheets();
  assert(bs.audit.allPass, "Balanços patrimoniais consistentes com a Cooperativa");
});

// ---------------------------------------------------------------------------
// 12. MICROCRÉDITO COMUNITÁRIO E INCLUSÃO PRODUTIVA
// ---------------------------------------------------------------------------
test("12.1 Microcrédito Comunitário: concessão, inclusão produtiva familiar e amortização regular no Banco Local", () => {
  api.reset();
  const S = getS();
  
  // 1. Injetar liquidez no banco para carteira de microcrédito
  run("log('external', 'bank', 30000, 'Liquidez bancária para microcrédito')");
  
  // 2. Concessão de microcrédito produtivo para domicílio
  const borrowerId = "house:1";
  const initialHouseCash = run("balance(accountKey(S.households[0]))");
  const microLoan = api.issueMicrocredit(borrowerId, 1500, "fomento à confecção artesanal");
  
  assert(microLoan && microLoan.isMicrocredit === true, "Empréstimo deve ser marcado como microcrédito");
  assert(microLoan.interestRate <= 0.01, "Taxa de juros do microcrédito deve ser favorecida (<= 1% a.m.)");
  assert(run("balance(accountKey(S.households[0]))") === initialHouseCash + 1500, "Caixa da família deve receber o crédito integral");
  
  // 3. Verificar estatísticas da carteira no Banco Local
  const portfolio = api.getBankPortfolioStats();
  assert(portfolio.microcredit && portfolio.microcredit.count >= 1, "Carteira deve registrar ao menos 1 contrato ativo");
  assert(portfolio.microcredit.principal >= 1500, "Volume de microcrédito deve ser refletido na carteira bancária");
  
  // 4. Fechamento mensal com amortização da cascata bancária
  run("closeMonth()");
  
  // 5. Auditoria de conservação e SFC
  assert(run("auditCashConservation().ok"), "Conservação de caixa íntegra após concessão de microcrédito");
  assert(api.generateBalanceSheets().audit.allPass, "SFC íntegra com carteira de microcrédito");
});

// ---------------------------------------------------------------------------
// 13. DILEMAS DO GABINETE EXECUTIVO E CRISES POLÍTICAS
// ---------------------------------------------------------------------------
test("13.1 Dilemas do Gabinete Executivo: gatilho, deliberação, trade-off orçamentário e sustentação parlamentar", () => {
  api.reset();
  const S = getS();
  
  // 1. Catálogo e acionamento de dilema
  const dilemmas = api.getCabinetDilemmas();
  assert(Array.isArray(dilemmas) && dilemmas.length >= 4, "Catálogo de dilemas do Gabinete deve ter ao menos 4 cenários");
  
  const dilemma = api.triggerCabinetDilemma("housing_migration_surge");
  assert(dilemma && dilemma.id === "housing_migration_surge", "Dilema de habitação deve ser acionado");
  assert(S.pendingCabinetDilemma && S.pendingCabinetDilemma.id === "housing_migration_surge", "Dilema deve constar como pendente no estado");
  
  // 2. Deliberar opção com impacto fiscal e parlamentar
  const initialSupport = api.getCouncilSupport();
  run("log('external', 'treasury', 15000, 'Caixa para contingências')");
  
  // Escolher construir moradias de emergência (cost: 3500, councilImpact: +10, approvalImpact: +12)
  const resolution = api.resolveCabinetDilemma("housing_migration_surge", "emergency_housing");
  assert(resolution.success === true, "Deliberação do Gabinete deve ser concluída com sucesso");
  assert(S.pendingCabinetDilemma === null, "Dilema pendente deve ser desimpedido");
  assert(S.resolvedDilemmas.some(d => d.id === "housing_migration_surge"), "Dilema deve figurar no histórico de resolvidos");
  assert(S.lastResolvedDilemma.choiceId === "emergency_housing", "Última deliberação deve registrar a opção escolhida");
  assert(api.getCouncilSupport() === initialSupport + 10, "Apoio na Câmara deve aumentar conforme o impacto parlamentar");
  
  // 3. Fechamento mensal com evento propagado
  run("closeMonth()");
  
  // 4. Auditoria de conservação e SFC
  assert(run("auditCashConservation().ok"), "Conservação estrita de caixa após deliberação de crise do Gabinete");
  assert(api.generateBalanceSheets().audit.allPass, "SFC íntegra");
});

// ---------------------------------------------------------------------------
// 14. LEGISLAÇÃO MUNICIPAL E IMPACTOS ESTRUTURAIS REAIS
// ---------------------------------------------------------------------------
test("14.1 Legislação Municipal e Impactos Reais: sanção, custeio do Tesouro, expansão de capacidades e conservação SFC", () => {
  api.reset();
  const S = getS();
  
  // 1. Injetar liquidez no Tesouro
  run("log('external', 'treasury', 25000, 'Caixa para execução de políticas públicas')");
  const initialHousing = S.housingCapacity || 12;
  const initialInfra = S.infrastructureCapacity || 10;
  const initialTreasury = run("balance('treasury')");

  // 2. Promulgar e sancionar PL 01 (Habitação Social) com custo de 1500 e +4 moradias
  const bill1 = {
    id: "pl_social_housing",
    code: "PL 01/2026",
    title: "Marco da Habitação Social",
    cost: 1500,
    impacts: { housingCapacity: 4 }
  };
  const res1 = api.enactLegislation(bill1);
  assert(res1.success === true, "Lei de habitação deve ser sancionada com sucesso");
  assert.equal(S.housingCapacity, initialHousing + 4, "Capacidade habitacional deve ser ampliada");
  assert(run("balance('treasury')") === initialTreasury - 1500, "Custo da lei deve ser debitado do Tesouro");

  // 3. Promulgar e sancionar PL 05 (Pavimentação e Logística) com custo de 2500 e +10 infraestrutura
  const bill2 = {
    id: "pl_urban_logistics",
    code: "PL 05/2026",
    title: "Fundo Especial de Pavimentação",
    cost: 2500,
    impacts: { infrastructureCapacity: 10 }
  };
  const res2 = api.enactLegislation(bill2);
  assert(res2.success === true, "Lei de infraestrutura deve ser sancionada");
  assert.equal(S.infrastructureCapacity, initialInfra + 10, "Capacidade de infraestrutura deve aumentar");

  // 4. Fechamento mensal e integridade SFC
  run("closeMonth()");
  assert(run("auditCashConservation().ok"), "Conservação estrita de caixa após execução orçamentária de leis");
  assert(api.generateBalanceSheets().audit.allPass, "SFC íntegra com projetos de lei promulgados");
});

// ---------------------------------------------------------------------------
// 15. SERVIÇOS PÚBLICOS, SANEAMENTO, EPIDEMIAS E GOVERNABILIDADE CÍVICA
// ---------------------------------------------------------------------------
test("15.1 Serviços Públicos, Saneamento, Epidemias e Governabilidade Cívica", () => {
  api.reset();
  run("log('external', 'treasury', 10000, 'Caixa para execução de serviços públicos')");
  const initialTreasury = run("balance('treasury')");

  // 1. Executa Ação de Governabilidade: Mutirão Sanitário (Custo R$ 350)
  const actionClean = {
    id: "action_sanitary_clean",
    name: "Mutirão Sanitário e Limpeza Urbana",
    cost: 350,
    impacts: { sanitationDelta: 8, sanitaryRiskReduction: 35 }
  };
  const resAction = api.executeGovernanceAction(actionClean);
  assert(resAction.success === true, "Ação de mutirão sanitário deve ser executada com sucesso");
  assert.equal(resAction.cost, 350, "Custo de 350 deve ser contabilizado");
  assert.equal(run("balance('treasury')"), initialTreasury - 350, "Caixa do Tesouro deve debitar R$ 350");

  // 2. Executa Campanha de Vacinação e Saúde (Custo R$ 450)
  const actionHealth = {
    id: "action_health_campaign",
    name: "Campanha Comunitária de Vacinação",
    cost: 450,
    impacts: { preventionDelta: 14, capacityDelta: 12 }
  };
  const resHealth = api.executeGovernanceAction(actionHealth);
  assert(resHealth.success === true, "Campanha de vacinação deve ser executada");
  assert.equal(run("balance('treasury')"), initialTreasury - 350 - 450, "Caixa do Tesouro deve debitar R$ 800 acumulados");

  // 3. Simula fechamento e auditoria SFC
  run("closeMonth()");
  assert(run("auditCashConservation().ok"), "Caixa do Tesouro e balanço bancário devem manter conservação estrita após ações de governabilidade");
  assert(api.generateBalanceSheets().audit.allPass, "Stock-Flow Consistency 100% íntegra após custeio de serviços e saúde pública");
});

// ---------------------------------------------------------------------------
// 16. GRUPOS DE INTERESSE: NOMEAÇÃO, APORTE EXTERNO, ATRITO E CONSERVAÇÃO SFC
// ---------------------------------------------------------------------------
test("16.1 Grupos de Interesse: nomeação de lideranças, bônus setoriais, injeção de capital externo, atritos políticos e conservação estrita SFC", () => {
  api.reset();
  const S = getS();
  run("log('external', 'treasury', 25000, 'Caixa do Tesouro para articulação política')");
  const initialTreasury = run("balance('treasury')");

  // 1. Estado inicial sem lideranças
  assert.deepStrictEqual(api.getActivePoliticalCharacters(), [], "Nenhuma liderança ativa inicialmente");
  assert.strictEqual(api.getPoliticalConflicts().length, 0, "Nenhum conflito inicial");

  // 2. Nomear trab01 (Vicente Almeida, R$ 5.200)
  const hireRes1 = api.hirePoliticalCharacter("trab01");
  assert.strictEqual(hireRes1.ok, true, "Nomeação de trab01 deve ter sucesso");
  assert.strictEqual(hireRes1.cost, 5200, "Custo de R$ 5.200 deve ser debitado");
  assert.strictEqual(run("balance('treasury')"), initialTreasury - 5200, "Caixa do Tesouro deve refletir débito");
  assert.strictEqual(S.activeCharacters["trabalhadores"], "trab01");
  assert(api.getActivePoliticalCharacters().some(c => c.id === "trab01"));
  assert(run("auditCashConservation().ok"), "Conservação estrita de caixa após contratação de trab01");

  // 3. Nomear fin04 (Helena Drummond, R$ 6.100, bônus investimentoExterno R$ 9.000)
  const hireRes2 = api.hirePoliticalCharacter("fin04");
  assert.strictEqual(hireRes2.ok, true, "Nomeação de fin04 deve ter sucesso");
  assert.strictEqual(hireRes2.cost, 6100, "Custo de R$ 6.100 deve ser debitado");
  assert.strictEqual(hireRes2.externalInvestment, 9000, "Aporte externo de R$ 9.000 deve ser injetado");
  assert.strictEqual(run("balance('treasury')"), initialTreasury - 2300, "Caixa do Tesouro após taxa e aporte externo");
  assert.strictEqual(S.activeCharacters["financeiro"], "fin04");
  assert(run("auditCashConservation().ok"), "Conservação estrita de caixa após injeção de capital externo");

  // 4. Nomear rur03 (Wellington Dutra, R$ 6.400, rival de trab01)
  const hireRes3 = api.hirePoliticalCharacter("rur03");
  assert.strictEqual(hireRes3.ok, true, "Nomeação de rur03 deve ter sucesso");
  const conflicts = api.getPoliticalConflicts();
  assert.strictEqual(conflicts.length, 1, "Deve haver 1 conflito político ativo entre trab01 e rur03");
  assert(conflicts[0].groups.includes("trabalhadores"), "Conflito deve envolver trabalhadores");
  assert(conflicts[0].groups.includes("proprietarios-rurais"), "Conflito deve envolver proprietarios-rurais");
  assert.strictEqual(conflicts[0].penalty, -4, "Penalidade deve ser -4 na aprovação");

  // 5. Substituir representante de trabalhadores por trab02 (Rosa Ferreira, R$ 2.800)
  const currentTreasury = run("balance('treasury')");
  const hireRes4 = api.hirePoliticalCharacter("trab02");
  assert.strictEqual(hireRes4.ok, true, "Substituição por trab02 deve ter sucesso");
  assert.strictEqual(S.activeCharacters["trabalhadores"], "trab02");
  assert.strictEqual(run("balance('treasury')"), currentTreasury - 2800, "Custo de substituição debitado");
  assert.strictEqual(api.getPoliticalConflicts().length, 0, "Conflito trab01 <-> rur03 deve cessar após substituição");

  // 6. Dispensa voluntária de fin04 sem custo
  const preDismissTreasury = run("balance('treasury')");
  const dismissRes = api.dismissPoliticalCharacter("financeiro");
  assert.strictEqual(dismissRes.ok, true, "Dispensa de fin04 deve ter sucesso");
  assert.strictEqual(S.activeCharacters["financeiro"], undefined);
  assert.strictEqual(run("balance('treasury')"), preDismissTreasury, "Dispensa não cobra taxa adicional do Tesouro");

  // 7. Fechamento mensal e integridade Stock-Flow Consistency (SFC)
  run("closeMonth()");
  assert(run("auditCashConservation().ok"), "Caixa do Tesouro e balanços preservados após ciclo mensal completo");
  assert(api.generateBalanceSheets().audit.allPass, "SFC íntegra com grupos de interesse ativos");
});

// ---------------------------------------------------------------------------
// 18. GESTÃO ORÇAMENTÁRIA POR SECRETARIAS & CICLO ANUAL LOA/LDO
// ---------------------------------------------------------------------------
test("17.1 Gestão Orçamentária LOA/LDO: dotações setoriais, empenho prévio, suplementação e liquidação SFC", () => {
  api.reset();
  const S = getS();
  run("log('external', 'treasury', 60000, 'Aporte orçamentário inicial')");

  // 1. Promulgação da LOA anual com dotações proporcionais por secretaria
  const loa = api.initAnnualBudget(1);
  assert.ok(loa, "LOA do exercício deve ser gerada");
  assert.strictEqual(loa.year, 1);
  assert.ok(loa.allocations.health.initial > 10000, "Saúde recebe dotação proporcional");
  assert.ok(loa.allocations.infrastructure.initial > 10000, "Infraestrutura recebe dotação proporcional");

  // 2. Empenho prévio de despesa na pasta de Saúde
  const initialHealthAvail = loa.allocations.health.available;
  const commitRes = api.commitDepartmentBudget("health", 6000, "Aquisição de insumos médico-hospitalares");
  assert.strictEqual(commitRes.ok, true, "Empenho deve ser aprovado com dotação suficiente");
  assert.strictEqual(loa.allocations.health.committed, 6000);
  assert.strictEqual(loa.allocations.health.available, initialHealthAvail - 6000);

  // 3. Bloqueio estrito de gasto sem dotação orçamentária
  const rejectRes = api.commitDepartmentBudget("health", 999999, "Gasto não autorizado na LOA");
  assert.strictEqual(rejectRes.ok, false, "Empenho que excede a dotação deve ser bloqueado");

  // 4. Abertura de crédito suplementar por remanejamento
  const preInfraAvail = loa.allocations.infrastructure.available;
  const supRes = api.supplementDepartmentBudget("health", 5000, "infrastructure", "Remanejamento para emergência sanitária");
  assert.strictEqual(supRes.ok, true, "Suplementação orçamentária deve ser aprovada");
  assert.strictEqual(loa.allocations.infrastructure.available, preInfraAvail - 5000);

  // 5. Liquidação e pagamento financeiro com conservação SFC
  const preTreasury = run("balance('treasury')");
  const payRes = api.liquidateAndPayDepartmentBudget(commitRes.commitment.id, "workshop");
  assert.strictEqual(payRes.ok, true, "Liquidação e pagamento financeiro devem ter sucesso");
  assert.strictEqual(payRes.paid, 6000);
  assert.strictEqual(run("balance('treasury')"), preTreasury - 6000, "Débito financeiro exato no Tesouro");
  assert.strictEqual(loa.allocations.health.paid, 6000);
  assert.strictEqual(loa.allocations.health.committed, 0);

  // 6. Auditoria de conservação contábil
  assert(run("auditCashConservation().ok"), "Conservação monetária estrita mantida no ciclo LOA");
});

// ---------------------------------------------------------------------------
// 19. CADEIAS PRODUTIVAS EXPANDIDAS (INDÚSTRIA, TRANSFORMAÇÃO & INSUMO-PRODUTO)
// ---------------------------------------------------------------------------
test("18.1 Cadeias Produtivas Expandidas: moinho, olaria, insumo-produto intersetorial e agregação de valor", () => {
  api.reset();
  const S = getS();
  run("log('external', 'treasury', 50000, 'Capitalização para expansão fabril')");

  // 1. Fundação e capitalização inicial do Moinho e da Olaria
  const mill = api.foundMill(5000, "treasury");
  assert.ok(mill, "Moinho deve ser fundado com sucesso");
  assert.strictEqual(mill.id, "mill");
  assert.strictEqual(run("balance('mill')"), 5000);

  const brick = api.foundBrickyard(6000, "treasury");
  assert.ok(brick, "Olaria comunitária deve ser fundada com sucesso");
  assert.strictEqual(brick.id, "brickyard");
  assert.strictEqual(run("balance('brickyard')"), 6000);

  // 2. Matriz Insumo-Produto: Moinho adquire grãos da lavoura e Olaria produz materiais
  S.farmLocalFoodStock = 20;
  run("runFirmProductionPhase({ day: 160 })");
  assert.ok(mill.inventory.quantity > 0, "Moinho deve processar grãos em fardos de farinha e café torrado");
  assert.ok(brick.inventory.quantity > 0, "Olaria deve fabricar tijolos e madeiras estruturais");

  // 3. Comercialização intersetorial e abastecimento do Comércio
  run("log('external', 'commerce', 2000, 'Giro comercial')");
  run("runFirmCommercializationPhase({ day: 160 })");

  // 4. Fechamento mensal e apuração de resultados com as novas indústrias
  run("closeMonth()");
  assert(run("auditCashConservation().ok"), "Conservação monetária mantida com as indústrias ativas");
  const bs = api.generateBalanceSheets();
  assert(bs.audit.allPass, "Reconciliação dos balanços setoriais SFC íntegra com novas manufaturas");
});

// ---------------------------------------------------------------------------
// 20. PLANO DE OBRAS COM LICITAÇÃO E CRONOGRAMA FÍSICO-FINANCEIRO MULTITEMPORAL
// ---------------------------------------------------------------------------
test("19.1 Plano de Obras com Licitação: canteiro multitemporal, medições mensais e entrega de infraestrutura", () => {
  api.reset();
  const S = getS();
  run("log('external', 'treasury', 40000, 'Dotação para obras públicas estruturantes')");

  // 1. Licitação e abertura de canteiro ativo para a Ponte e Anel Viário (3 meses)
  const work = api.startStructuredPublicWork("bridge");
  assert.ok(work, "Licitação da ponte deve ser homologada");
  assert.strictEqual(work.type, "bridge");
  assert.strictEqual(work.durationMonths, 3);
  assert.strictEqual(work.status, "in_progress");
  assert.strictEqual(work.progressPercent, 0);

  const initialUrbanCap = S.infrastructureCapacity || 20;

  // 2. 1º Mês de Obra: 1ª medição física e financeira
  run("closeMonth()");
  assert.strictEqual(work.elapsedMonths, 1);
  assert.strictEqual(work.progressPercent, 33);
  assert.strictEqual(work.status, "in_progress");
  assert(run("auditCashConservation().ok"), "SFC preservada após 1ª medição");

  // 3. 2º Mês de Obra: 2ª medição física e avanço dos operários
  run("closeMonth()");
  assert.strictEqual(work.elapsedMonths, 2);
  assert.strictEqual(work.progressPercent, 67);
  assert.strictEqual(work.status, "in_progress");

  // 4. 3º Mês de Obra: Conclusão, comissionamento e inauguração oficial
  run("closeMonth()");
  assert.strictEqual(work.status, "completed");
  assert.strictEqual(work.progressPercent, 100);
  assert.ok(S.infrastructureCapacity > initialUrbanCap, "Capacidade urbana expandida após entrega da obra");
  assert.ok((S.completedProjects || []).some(p => p.type === "bridge"), "Obra registrada no rol de projetos concluídos");

  // 5. Auditoria patrimonial SFC e Teorema da Riqueza Real
  assert(run("auditCashConservation().ok"), "Conservação estrita de caixa preservada durante e após a obra");
  const finalBS = api.generateBalanceSheets();
  assert(finalBS.audit.allPass, "Balanços setoriais reconciliados com capital público agregado");
});

console.log(`\n========================================================`);
console.log(`=== TODOS OS ${passedTests}/${totalTests} TESTES ESTRUTURAIS APROVADOS COM SUCESSO! ===`);
console.log(`========================================================\n`);
