"use strict";
const MONTH=30,YEAR=360,HOUSING_VALUE=150,FROST_DAILY_RISK=0.0037;
const USD_INPUT=30,USD_IMPORT=42,BASE_MARKUP=0.35,CREDIT_SPREAD=1.0;
let S,timer=null,speed=1,policiesBuilt=false;
const CORE_RUNTIME=window.VilarejoCore?window.VilarejoCore.createRuntime({calendar:{daysPerMonth:MONTH,monthsPerYear:12}}):null;
if(CORE_RUNTIME)window.VilarejoRuntime=CORE_RUNTIME;
if(CORE_RUNTIME&&!CORE_RUNTIME.modules.has("economia"))CORE_RUNTIME.modules.register({id:"economia",version:"3.0.0",name:"Economia",dependencies:["core"],description:"Produção, empresas, trabalho, preços, crédito, finanças públicas e contas nacionais."});
function syncCoreFromEconomy(reason="sync"){
 if(!CORE_RUNTIME||!S)return null;
 return CORE_RUNTIME.syncFromEconomy(S,reason);
}
function publishEconomyMonthClosed(){
 if(!CORE_RUNTIME||!S)return;
 syncCoreFromEconomy("month-closed");
 CORE_RUNTIME.publish("economy:month-closed",{
  monthNumber:S.monthNumber,day:S.day,year:CORE_RUNTIME.clock.snapshot().year,
  population:CORE_RUNTIME.population.getSnapshot().totals,
  nationalAccounts:S.lastNationalAccounts?{
   gdp:S.lastNationalAccounts.approaches?.production??null,
   reconciled:!!S.lastNationalAccounts.reconciliation?.reconciled
  }:null,
  fiscalResult:S.lastFiscalReport?.nominalResult??null,
  gameOver:S.gameOver||null
 },"economia");
}
const $=id=>document.getElementById(id);
const money=v=>"R$ "+Math.round(v).toLocaleString("pt-BR");
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const accountNames={treasury:"Tesouro público",stateFarm:"Fazenda estatal",privateFarm:"Fazenda privada",commerce:"Comércio local",workshop:"Oficina e serviços locais",landlord:"Proprietário de imóveis",bank:"Banco local",external:"Economia externa"};
const accountKey=h=>"house:"+h.id;
function householdName(id){const h=S.households.find(x=>x.id===id);return h?h.name:id.replace("house:","Morador ")}
function nameOf(id){
 const firm=(S?.firms||[]).find(f=>f.account===id||f.id===id);
 if(firm)return firm.name;
 return accountNames[id]||householdName(id);
}
function balance(id){if(id==="external")return Infinity;if(id.startsWith("house:"))return S.households.find(h=>accountKey(h)===id)?.cash||0;return S.accounts[id]||0}
function setBalance(id,v){if(id==="external")return;if(id.startsWith("house:")){const h=S.households.find(x=>accountKey(x)===id);if(h)h.cash=Math.max(0,v);return}S.accounts[id]=Math.max(0,v)}
function log(from,to,amount,reason,mandatory=false){
 amount=Math.max(0,Number(amount)||0);if(amount<0.005||from===to)return 0;
 if(from!=="external"&&balance(from)+0.0001<amount&&!mandatory)return 0;
 if(from!=="external"&&balance(from)<amount)amount=balance(from);
 if(from!=="external")setBalance(from,balance(from)-amount);
 if(to!=="external")setBalance(to,balance(to)+amount);
 const type=from==="external"?"in":to==="external"?"out":"internal";
 S.monthFlow[type]+=amount;
 if(type==="in")S.cumulativeExternalIn+=amount;
 if(type==="out")S.cumulativeExternalOut+=amount;
 S.ledger.unshift({day:S.day,from,to,amount,reason});S.ledger=S.ledger.slice(0,400);
 return amount;
}
function feed(msg){S.feed.unshift("Dia "+S.day+": "+msg);S.feed=S.feed.slice(0,18)}
function rand(){S.seed=(S.seed*1664525+1013904223)>>>0;return S.seed/4294967296}
function adults(){return S.households.reduce((n,h)=>n+h.adults,0)}
function population(){return S.households.reduce((n,h)=>n+h.adults+h.children,0)}
function employed(){return S.households.reduce((n,h)=>n+h.jobs,0)}
function round2(v){return Math.round((Number(v)||0)*100)/100}
function migrateLoan(l){
 if(!l||typeof l!=="object")return l;
 // Migração de contratos legados que utilizavam o campo unificado "arrears":
 // A separação histórica entre principal e juros é estimada, pois o formato antigo
 // não distinguia essas parcelas contábeis na origem.
 if(l.arrears!==undefined){
  const legacy=Math.max(0,Number(l.arrears)||0);
  if(l.principalArrears===undefined&&l.interestArrears===undefined){
   const p=Math.max(0,Number(l.principal)||0),r=Number(l.rate)||0.02,missedCount=Math.max(1,Number(l.missed)||1);
   const estInterest=round2(Math.min(legacy,p*r*missedCount));
   l.interestArrears=estInterest;
   l.principalArrears=round2(Math.max(0,legacy-estInterest));
  }else{
   if(l.principalArrears===undefined)l.principalArrears=0;
   if(l.interestArrears===undefined)l.interestArrears=0;
  }
  delete l.arrears;
 }else{
  if(l.principalArrears===undefined)l.principalArrears=0;
  if(l.interestArrears===undefined)l.interestArrears=0;
 }
 if(l.missed!==undefined)delete l.missed;
 l.principal=Math.max(0,round2(Number(l.principal)||0));
 l.principalArrears=Math.max(0,round2(Number(l.principalArrears)||0));
 l.interestArrears=Math.max(0,round2(Number(l.interestArrears)||0));
 return l;
}
function migrateLoans(loans){if(!Array.isArray(loans))return[];loans.forEach(migrateLoan);return loans}
function totalWageDebt(){return S.households.reduce((n,h)=>n+h.wageDebt,0)+S.migratedClaims.reduce((n,c)=>n+c.wageDebt,0)}
function firmWageDebt(firmId){
 return round2(S.households.reduce((sum,h)=>{
  const map=h.wageDebtByFirm;
  if(map&&Object.keys(map).length)return sum+Math.max(0,Number(map[firmId])||0);
  return sum+(firmId==="farm"?Math.max(0,Number(h.wageDebt)||0):0);
 },0));
}
function syncGlobalEmployerTaxDebt(){
 S.employerTaxDebt=round2((S.firms||[]).reduce((sum,f)=>sum+Math.max(0,Number(f.employerTaxDebt)||0),0));
 return S.employerTaxDebt;
}
function firmProfitTaxDebt(f){
 if(!f)return 0;
 if(f.id==="farm")return Math.max(0,Number(S.farmTaxDebt)||0);
 if(f.id==="commerce")return Math.max(0,Number(S.commerceTaxDebt)||0);
 if(f.id==="workshop")return Math.max(0,Number(S.workshopTaxDebt)||0);
 return Math.max(0,Number(f.profitTaxDebt)||0);
}
function setFirmProfitTaxDebt(f,value){
 const amount=round2(Math.max(0,Number(value)||0));
 if(f.id==="farm")S.farmTaxDebt=amount;
 else if(f.id==="commerce")S.commerceTaxDebt=amount;
 else if(f.id==="workshop")S.workshopTaxDebt=amount;
 else f.profitTaxDebt=amount;
 f.profitTaxDebt=amount;
 f.taxDebt=round2((f.employerTaxDebt||0)+amount);
 return amount;
}
function settleFirmProfitTax(f,pretaxProfit,reason){
 const taxable=Math.max(0,Number(pretaxProfit)||0);
 const due=round2(taxable*(Number(S.policy?.profitTax)||0)/100+firmProfitTaxDebt(f));
 const paid=due>0?log(f.account,"treasury",Math.min(due,balance(f.account)),reason||`Imposto sobre lucro (${f.name})`):0;
 setFirmProfitTaxDebt(f,due-paid);
 f.profitTaxPaid=round2(paid);
 f.profitBeforeTax=round2(pretaxProfit||0);
 return {due,paid,remaining:firmProfitTaxDebt(f)};
}
function totalRentDebt(){return S.households.reduce((n,h)=>n+h.rentDebt,0)+S.migratedClaims.reduce((n,c)=>n+c.rentDebt,0)}
function totalDeposits(){return S.households.reduce((n,h)=>n+h.deposit,0)}
function inventoryValue(){return round2((S.firms||[]).reduce((sum,f)=>sum+Math.max(0,Number(f.inventory?.quantity)||0)*Math.max(0,Number(f.inventory?.unitValue)||0),0));}
function totalLoans(borrower){return round2(S.bankLoans.filter(l=>!borrower||l.borrower===borrower).reduce((n,l)=>{migrateLoan(l);return n+(l.principal||0)+(l.principalArrears||0)+(l.interestArrears||0);},0))}
function getBankPortfolioStats(){
 let regularPrincipal=0,principalArrears=0,interestArrears=0;
 for(const l of S.bankLoans){
  migrateLoan(l);
  regularPrincipal=round2(regularPrincipal+(l.principal||0));
  principalArrears=round2(principalArrears+(l.principalArrears||0));
  interestArrears=round2(interestArrears+(l.interestArrears||0));
 }
 const totalArrears=round2(principalArrears+interestArrears);
 const totalPortfolio=round2(regularPrincipal+totalArrears);
 const defaultRate=totalPortfolio>0.005?round2((totalArrears/totalPortfolio)*100):0;
 return{regularPrincipal,principalArrears,interestArrears,totalArrears,totalPortfolio,defaultRate};
}
function domesticMoney(){return Object.values(S.accounts).reduce((n,v)=>n+(Number(v)||0),0)+S.households.reduce((n,h)=>n+h.cash,0)}
function auditCashConservation(){const expected=S.cumulativeExternalIn-S.cumulativeExternalOut,observed=domesticMoney();S.cashAudit={expected,observed,difference:observed-expected,ok:Math.abs(observed-expected)<0.01};return S.cashAudit}
function getLaborStats(){
 const sectorWorkers={};
 let pit=0,outOfForce=0,occupied=0;
 for(const h of S.households){
  const ad=Math.max(0,Number(h.adults)||0);
  const fft=clamp(Math.floor(Number(h.outOfLaborForce)||0),0,ad);
  pit+=ad;outOfForce+=fft;
  let householdJobs=0;
  if(h.sectorJobs&&typeof h.sectorJobs==="object"){
   for(const [firmId,raw] of Object.entries(h.sectorJobs)){
    const qty=Math.max(0,Number(raw)||0);
    if(qty>0){sectorWorkers[firmId]=(sectorWorkers[firmId]||0)+qty;householdJobs+=qty;}
   }
  }else{
   householdJobs=Math.max(0,Number(h.jobs)||0);
   if(householdJobs>0)sectorWorkers.farm=(sectorWorkers.farm||0)+householdJobs;
  }
  occupied+=Math.min(Math.max(0,ad-fft),householdJobs);
 }
 const laborForce=Math.max(0,pit-outOfForce);
 const unemployedSeeking=Math.max(0,laborForce-occupied);
 const unemploymentRate=laborForce>0?round2((unemployedSeeking/laborForce)*100):0;
 const participationRate=pit>0?round2((laborForce/pit)*100):0;
 const hist=(S.unemploymentHistory||[]).concat([unemploymentRate]).slice(-3);
 const movingAvgUnemployment=round2(hist.reduce((a,b)=>a+b,0)/Math.max(1,hist.length));
 sectorWorkers.farm=sectorWorkers.farm||0;
 sectorWorkers.commerce=sectorWorkers.commerce||0;
 sectorWorkers.workshop=sectorWorkers.workshop||0;
 return{pit,laborForce,occupied,unemployedSeeking,outOfLaborForce:outOfForce,unemploymentRate,participationRate,movingAvgUnemployment,sectorWorkers};
}
function calculateFirmValuation(firmId="farm"){
 if(firmId==="farm"||!firmId){
  const fAcc=farmAccount();
  const farmFirm=S?.firms?.find(f=>f.id==="farm");
  const fCapital=farmFirm?.capitalStock!==undefined?farmFirm.capitalStock:(Math.max(0,(S.baseJobsAvailable||8)-8)*8000+40000);
  const coffeeVal=farmFirm?.inventory?.quantity!==undefined?(farmFirm.inventory.quantity*(farmFirm.inventory.unitValue||(S.usdCoffee*S.fx))):(S.coffeeStock*(S.usdCoffee*S.fx));
  const fCash=balance(fAcc);
  const fLiabilities=totalWageDebt()+S.employerTaxDebt+S.farmTaxDebt+totalLoans(fAcc);
  const tangibleAssets=fCapital+coffeeVal+fCash;
  const nav=Math.max(1000,round2(tangibleAssets-fLiabilities));
  const estimatedMonthlyNet=Math.max(0,(monthlyContributionPerWorker()-S.wage*(1+S.policy.employerTax/100))*Math.max(1,employed()));
  const annualNet=round2(estimatedMonthlyNet*12);
  const discountRate=Math.max(0.08,round2(((S.policy.baseRate*12)/100)+0.05));
  const dcfValuation=round2(annualNet/discountRate);
  const economicValuation=round2(Math.max(nav,0.55*nav+0.45*dcfValuation));
  return{tangibleAssets,liabilities:fLiabilities,nav,annualNet,discountRate,dcfValuation,valuation:economicValuation};
 }
 const firm=S?.firms?.find(f=>f.id===firmId||f.account===firmId);
 if(!firm)return{tangibleAssets:0,liabilities:0,nav:0,annualNet:0,discountRate:0.1,dcfValuation:0,valuation:0};
 const acc=firm.account;
 const fCapital=firm.capitalStock||0;
 const invVal=firm.inventory?(firm.inventory.quantity*(firm.inventory.unitValue||0)):0;
 const fCash=balance(acc);
 const fLiabilities=(firm.wageDebt||0)+(firm.taxDebt||0)+totalLoans(acc);
 const tangibleAssets=fCapital+invVal+fCash;
 const nav=Math.max(500,round2(tangibleAssets-fLiabilities));
 const annualNet=round2(Math.max(0,firm.profit||0)*12);
 const discountRate=Math.max(0.08,round2(((S.policy.baseRate*12)/100)+0.05));
 const dcfValuation=round2(annualNet/discountRate);
 const economicValuation=round2(Math.max(nav,0.55*nav+0.45*dcfValuation));
 return{tangibleAssets,liabilities:fLiabilities,nav,annualNet,discountRate,dcfValuation,valuation:economicValuation};
}
function sellFarmStake(fraction=0.25){
 if(S.farmOwnership.treasury<=0.005)return 0;
 const frac=Math.min(fraction,S.farmOwnership.treasury);
 const val=calculateFirmValuation("farm").valuation;
 const price=round2(val*frac);
 log("external","treasury",price,`Alienação de ${(frac*100).toFixed(0)}% de participação na Fazenda (Valuation: ${money(val)})`);
 if(S.currentMonthTracking)S.currentMonthTracking.assetSales+=price;
 S.farmOwnership.treasury=round2(S.farmOwnership.treasury-frac);
 S.farmOwnership.private=round2(S.farmOwnership.private+frac);
 if(S.farmOwnership.treasury<=0.005){
  S.owner="private";
  S.farmOwnership.treasury=0;
  S.farmOwnership.private=1.0;
  const cash=balance("stateFarm");
  if(cash>0)log("stateFarm","privateFarm",cash,"Transferência de caixa na privatização total");
  S.migratedClaims.forEach(c=>{if(c.debtorAccount==="stateFarm")c.debtorAccount="privateFarm"});
  feed(`Privatização integral concluída por ${money(price)} com base no valuation de ${money(val)}.`);
 }else{
  S.owner=S.farmOwnership.treasury>=0.50?"state":"private";
  feed(`Alienação de ${(frac*100).toFixed(0)}% das ações da Fazenda por ${money(price)} (Valuation: ${money(val)}). Nova estrutura: ${(S.farmOwnership.treasury*100).toFixed(0)}% Estatal / ${(S.farmOwnership.private*100).toFixed(0)}% Privada.`);
 }
 S.firms=getFirms();
 render();
 return price;
}
function distributeFirmDividends(){
 const fAcc=farmAccount();
 const netProfit=(S.lastDRE?.farm?.netProfit)||0;
 let treasuryDiv=0,privateDiv=0;
 if(netProfit>500&&balance(fAcc)>8000){
  const payoutRatio=clamp((S.policy.dividendPayoutRatio||50)/100,0.20,0.80);
  const maxSafeDiv=Math.max(0,balance(fAcc)-6000);
  const totalDiv=round2(Math.min(maxSafeDiv,netProfit*payoutRatio));
  if(totalDiv>50){
   treasuryDiv=round2(totalDiv*(S.farmOwnership?.treasury||0));
   privateDiv=round2(totalDiv*(S.farmOwnership?.private||0));
   if(treasuryDiv>0){
    log(fAcc,"treasury",treasuryDiv,"Dividendos de participação estatal na Fazenda");
    if(S.currentMonthTracking)S.currentMonthTracking.dividendsReceived=(S.currentMonthTracking.dividendsReceived||0)+treasuryDiv;
   }
   if(privateDiv>0){
    const hCount=S.households.length;
    const perHousehold=round2(privateDiv/Math.max(1,hCount));
    for(const h of S.households){
     if(perHousehold>0){
      log(fAcc,accountKey(h),perHousehold,"Dividendos de participação acionária privada");
      h.cashIncome+=perHousehold;
     }
    }
   }
   feed(`Fazenda distribuiu ${money(totalDiv)} em dividendos (${(payoutRatio*100).toFixed(0)}% do lucro líquido): ${money(treasuryDiv)} ao Tesouro e ${money(privateDiv)} aos acionistas privados.`);
  }
 }
 S.lastDividends={treasury:treasuryDiv,private:privateDiv,total:treasuryDiv+privateDiv};
 return S.lastDividends;
}
function settleConcessionOutorga(){
 if(S.concessionActive&&balance("landlord")>=400){
  const outorga=log("landlord","treasury",400,"Outorga mensal da concessão de serviços habitacionais e urbanos");
  if(S.currentMonthTracking)S.currentMonthTracking.concessionOutorga=(S.currentMonthTracking.concessionOutorga||0)+outorga;
  return outorga;
 }
 return 0;
}
// ============================================================================
// CONTRATO GENÉRICO DE EMPRESA (Firm) E MOTOR EMPRESARIAL - ETAPA A
// ============================================================================
// CONTRATO GENÉRICO DE EMPRESA (Firm) E MOTOR EMPRESARIAL - ETAPA B
// ============================================================================

const farmBehavior = {
  plan(f, ctx = {}) {
    f.offeredWage = S.wage;
    const base = f.baseCapacity || S.baseJobsAvailable || 8;
    const housingCost = S.policy.housing === "employer" ? HOUSING_VALUE : 0;
    const fullCost = f.offeredWage * (1 + S.policy.employerTax / 100) + housingCost;
    const viability = clamp(monthlyContributionPerWorker() / Math.max(1, fullCost), 0, 1);
    f.openVacancies = Math.floor(base * viability + 1e-9);
    S.jobsAvailable = f.openVacancies;
  },

  produce(f, ctx = {}) {
    f.account = farmAccount();
    const doy = S.day % YEAR;
    if (doy < 150 || doy >= 210) return;
    const potential = (f.activeWorkers !== undefined ? f.activeWorkers : employed()) * 0.35;
    if (potential <= 0) return;
    const unitInput = USD_INPUT * S.fx * (S.eventMods?.custo || 1);
    const paid = log(f.account, "external", potential * unitInput, "Insumos agrícolas importados");
    const financedUnits = unitInput > 0 ? Math.min(potential, paid / unitInput) : potential;
    if (paid > 0) {
      S.monthFarmCosts += paid;
      if (S.currentMonthTracking) S.currentMonthTracking.farmInputs += paid;
    }
    const tfp = f.productivityFactor || S?.urbanInfra?.tfpFactor || 1.0;
    const yieldQty = financedUnits * (S.weatherFactor || 1) * tfp * (S.eventMods?.producao || 1);
    if (!f.inventory) f.inventory = { name: "Café em grão", unit: "sacas", quantity: 0, unitValue: 1500 };
    f.inventory.quantity = round2((f.inventory.quantity || 0) + yieldQty);
    f.inventory.unitValue = round2(S.usdCoffee * S.fx);
    S.coffeeStock = f.inventory.quantity;
    S.productionThisSeason += yieldQty;
    if (financedUnits + 0.001 < potential) feed("Produção limitada: faltou capital para comprar todos os insumos agrícolas.");
    return { potential, financedUnits, yieldQty };
  },

  market(f, ctx = {}) {
    f.account = farmAccount();
    const qty = f.inventory?.quantity !== undefined ? f.inventory.quantity : (S.coffeeStock || 0);
    if (qty <= 0) return 0;
    const revenue = round2(qty * S.usdCoffee * S.fx * (S.eventMods?.preco || 1));
    log("external", f.account, revenue, "Venda de café ao mercado externo");
    S.monthFarmRevenue += revenue;
    if (S.currentMonthTracking) S.currentMonthTracking.farmRevenue += revenue;
    S.coffeeSold += qty;
    if (!f.inventory) f.inventory = { name: "Café em grão", unit: "sacas", quantity: 0, unitValue: 1500 };
    f.inventory.quantity = 0;
    f.inventory.unitValue = round2(S.usdCoffee * S.fx);
    S.coffeeStock = 0;
    f.revenue = (f.revenue || 0) + revenue;
    return revenue;
  },

  settle(f, ctx = {}) {
    f.account = farmAccount();
    f.operator = S.owner;
    const fAcc = f.account;
    const interestPaid = S.lastLoanSettlement?.byBorrower?.[fAcc]?.interestPaid || 0;
    const farmCapital = f.capitalStock !== undefined ? f.capitalStock : (Math.max(0, (S.baseJobsAvailable || 8) - 8) * 8000 + 40000);
    const depr = (S.monthFarmRevenue > 0 || S.monthFarmCosts > 0) ? round2(farmCapital * (f.depreciationRate || 0.0025)) : 0;
    if (depr > 0) {
      f.capitalStock = round2(Math.max(0, f.capitalStock - depr));
    }
    const ebitda = S.monthFarmRevenue - S.monthFarmCosts;
    const ebit = ebitda - depr;
    const lair = ebit - interestPaid;
    S.lastFarmEBITDA = ebitda;
    S.lastFarmDepreciation = depr;
    S.lastFarmInterestPaid = interestPaid;
    S.lastFarmProfit = lair;
    f.revenue = S.monthFarmRevenue;
    f.intermediateInputs = round2(S.currentMonthTracking?.farmInputs||0);
    f.costs = S.monthFarmCosts + depr + interestPaid;
    f.ebitda = ebitda;
    f.depreciation = depr;
    f.interestPaid = interestPaid;
    f.profitBeforeTax = lair;

    if (f.operator === "state" || S.owner === "state") {
      S.lastProfitTax = 0;
      f.profitTaxPaid = 0;
      f.profitTaxDebt = 0;
      f.profit = round2(lair);
      S.monthFarmRevenue = 0;
      S.monthFarmCosts = 0;
      return;
    }
    const tax = settleFirmProfitTax(f,lair,"Imposto sobre lucro da fazenda");
    S.lastProfitTax = tax.paid;
    S.monthFarmRevenue = 0;
    S.monthFarmCosts = 0;
    f.profit = lair - tax.paid;
  },

  sync(f, { ls, tfp }) {
    f.account = farmAccount();
    f.operator = S.owner;
    f.ownership = { ...S.farmOwnership };
    f.name = S.farmOwnership.treasury >= 0.995 ? "Fazenda Estatal de Café" : S.farmOwnership.treasury <= 0.005 ? "Fazenda Privada de Café" : "Fazenda de Economia Mista";
    f.governanceLabel = S.farmOwnership.treasury >= 0.995 ? "Estatal" : S.farmOwnership.treasury <= 0.005 ? "Privada" : `Mista (${(S.farmOwnership.treasury * 100).toFixed(0)}% G / ${(S.farmOwnership.private * 100).toFixed(0)}% P)`;
    f.valuation = calculateFirmValuation("farm").valuation;
    if (ls && ls.sectorWorkers) f.activeWorkers = ls.sectorWorkers.farm;
    f.baseCapacity = S.baseJobsAvailable || 8;
    f.openVacancies = S.jobsAvailable || 0;
    f.offeredWage = S.wage;
    f.employerTaxDebt = round2(f.employerTaxDebt||0);
    f.taxDebt = round2(f.employerTaxDebt + S.farmTaxDebt);
    f.wageDebt = firmWageDebt("farm");
    if (!f.inventory) f.inventory = { name: "Café em grão", unit: "sacas", quantity: 0, unitValue: 1500 };
    f.inventory.quantity = S.coffeeStock;
    f.inventory.unitValue = round2(S.usdCoffee * S.fx);
  }
};

const commerceBehavior = {
  plan(f, ctx = {}) {
    const minFullCost = S.policy.minimumWage * (1 + S.policy.employerTax / 100);
    const commViable = balance(f.account) >= minFullCost * 2 && !S.marketFundingFailure ? 1 : 0;
    f.openVacancies = commViable;
    f.offeredWage = S.commerceWage || S.policy.minimumWage;
  },

  produce(f, ctx = {}) {
    const demand = ctx.demand || 0;
    const targetStock = demand * 1.1;
    const currentStock = f.inventory?.quantity !== undefined ? f.inventory.quantity : (S.marketStock || 0);
    const need = Math.max(0, targetStock - currentStock);
    const importUnitCost = USD_IMPORT * S.fx;
    const importCost = need * importUnitCost;
    if (importCost > balance(f.account)) {
      const short = importCost - balance(f.account);
      issueLoan(f.account, short, "capital de giro para importação de alimentos");
    }
    const paidImport = log(f.account, "external", importCost, "Importação de cesta básica");
    if (S.currentMonthTracking) S.currentMonthTracking.commerceImports += paidImport;
    const imported = importUnitCost > 0 ? paidImport / importUnitCost : 0;
    if (!f.inventory) f.inventory = { name: "Cesta básica", unit: "cestas", quantity: 0, unitValue: round2(S.marketPrice) };
    f.inventory.quantity = currentStock + imported;
    f.inventory.unitValue = round2(importUnitCost);
    S.marketStock = f.inventory.quantity;
    S.importedUnits = imported;
    S.marketFundingFailure = (imported + 0.001 < need);
    return { demand, targetStock, need, imported, importCost: paidImport };
  },

  market(f, ctx = {}) {
    const plans = ctx.plans || [];
    const totalAffordable = plans.reduce((n, p) => n + p.affordable, 0);
    const available = f.inventory?.quantity !== undefined ? f.inventory.quantity : (S.marketStock || 0);
    const soldTotal = Math.min(totalAffordable, available);
    for (const p of plans) {
      p.bought = totalAffordable > 0 ? soldTotal * (p.affordable / totalAffordable) : 0;
      const paid = p.bought * S.marketPrice;
      if (paid > 0) {
        log(accountKey(p.h), f.account, paid, "Compra de cesta básica (LES essencial/discricionário)");
      }
      p.h.shortageUnits = Math.max(0, p.essential - p.bought);
    }
    if (!f.inventory) f.inventory = { name: "Cesta básica", unit: "cestas", quantity: 0, unitValue: round2(S.marketPrice) };
    f.inventory.quantity = Math.max(0, available - soldTotal);
    f.inventory.unitValue = round2(S.marketPrice);
    S.marketStock = f.inventory.quantity;
    f.lastSales = soldTotal * S.marketPrice;
    f.revenue = (f.revenue || 0) + f.lastSales;
    return { soldTotal, salesRevenue: f.lastSales };
  },

  settle(f, ctx = {}) {
    const tr = S.currentMonthTracking || {};
    const commInterestPaid = S.lastLoanSettlement?.byBorrower?.[f.account]?.interestPaid || 0;
    const foodSales = round2((f.lastSales !== undefined ? f.lastSales : (S.lastFoodConsumption || 0))+(tr.commerceB2BSales||0));
    const commDepreciation = (foodSales > 0 || (tr.commerceImports || 0) > 0) ? round2((f.capitalStock || 15000) * (f.depreciationRate || 0.0025)) : 0;
    if (commDepreciation > 0) {
      f.capitalStock = round2(Math.max(0, f.capitalStock - commDepreciation));
    }
    const intermediateInputs=round2(tr.commerceImports||0);
    const payrollCosts=round2(f.payrollCosts||0);
    const commGrossMargin=round2(foodSales-intermediateInputs-payrollCosts);
    const commEBIT=round2(commGrossMargin-commDepreciation);
    const commLAIR=round2(commEBIT-commInterestPaid);
    const tax=settleFirmProfitTax(f,commLAIR,"Imposto sobre lucro do comércio");
    f.revenue=round2(foodSales);
    f.intermediateInputs=intermediateInputs;
    f.costs=round2(intermediateInputs+payrollCosts+commDepreciation+commInterestPaid+tax.paid);
    f.profit=round2(commLAIR-tax.paid);
    f.profitBeforeTax=commLAIR;
    f.ebitda=commGrossMargin;
    f.depreciation=commDepreciation;
    f.interestPaid=commInterestPaid;
    f.taxPaid=tax.paid;
  },

  sync(f, { ls, tfp }) {
    if (ls && ls.sectorWorkers) f.activeWorkers = ls.sectorWorkers.commerce || 0;
    f.openVacancies = S.sectorVacancies?.commerce ?? 1;
    f.offeredWage = S.commerceWage || S.policy.minimumWage;
    f.employerTaxDebt = round2(f.employerTaxDebt||0);
    f.taxDebt = round2(f.employerTaxDebt + (S.commerceTaxDebt||0));
    f.wageDebt = firmWageDebt("commerce");
    if (!f.inventory) f.inventory = { name: "Cesta básica", unit: "cestas", quantity: 0, unitValue: 283.5 };
    f.inventory.quantity = S.marketStock;
    f.inventory.unitValue = round2(USD_IMPORT*S.fx);
  }
};

const workshopBehavior = {
  plan(f, ctx = {}) {
    const minFullCost = S.policy.minimumWage * (1 + S.policy.employerTax / 100);
    const workViable = balance(f.account) >= minFullCost * 2 ? 1 : 0;
    f.openVacancies = workViable;
    f.offeredWage = S.workshopWage || S.policy.minimumWage;
  },

  produce(f, ctx = {}) {
    const tfp = f.productivityFactor || S?.urbanInfra?.tfpFactor || 1.0;
    const availableCapacity = Math.max(0, Number(f.activeWorkers)||0) * 3 * tfp;
    if(availableCapacity<=0){f.inventory.quantity=0;S.workshopMaterials=0;return {capacity:0,inventory:0};}
    if (!f.inventory) f.inventory = { name: "Kits de ferramentas e peças", unit: "lotes", quantity: 5, unitValue: round2(S.servicePrice || 180) };
    f.inventory.quantity = Math.round(availableCapacity);
    f.inventory.unitValue = round2(S.servicePrice || 180);
    S.workshopMaterials = f.inventory.quantity;
    return { capacity: availableCapacity, inventory: f.inventory.quantity };
  },

  market(f, ctx = {}) {
    const plans = ctx.plans || [];
    const sPrice = ctx.servicePrice || S.servicePrice || 180;
    let serviceConsumptionVal = 0;
    for (const p of plans) {
      if (p.h.shortageUnits <= 0.01 && p.desiredServiceUnits > 0.01) {
        const minReserve = p.essential * S.marketPrice * 0.5;
        const spendable = Math.max(0, p.h.cash - minReserve);
        const sCost = Math.min(spendable, p.desiredServiceUnits * sPrice);
        if (sCost >= 5) {
          const paidS = log(accountKey(p.h), f.account, sCost, "Serviços locais e reparos domiciliares (LES)");
          p.serviceBought = paidS / sPrice;
          serviceConsumptionVal += paidS;
        }
      }
    }
    f.lastServiceRevenue = round2(serviceConsumptionVal);
    return { serviceConsumptionVal };
  },

  settle(f, ctx = {}) {
    const tr=S.currentMonthTracking||{};
    const wsInterestPaid=Number(S.lastLoanSettlement?.byBorrower?.[f.account]?.interestPaid)||0;
    const householdServices=round2(f.lastServiceRevenue||0);
    const otherRevenue=round2(tr.workshopRevenue||0);
    const wsRev=round2(householdServices+otherRevenue);
    const intermediateInputs=round2(tr.workshopCosts||0);
    const payrollCosts=round2(f.payrollCosts||0);
    const wsDepreciation=wsRev>0?round2((f.capitalStock||12000)*(f.depreciationRate||0.0025)):0;
    if(wsDepreciation>0)f.capitalStock=round2(Math.max(0,f.capitalStock-wsDepreciation));
    const wsEBITDA=round2(wsRev-intermediateInputs-payrollCosts);
    const wsEBIT=round2(wsEBITDA-wsDepreciation);
    const wsLAIR=round2(wsEBIT-wsInterestPaid);
    const tax=settleFirmProfitTax(f,wsLAIR,"Imposto sobre lucro da oficina");
    f.revenue=wsRev;
    f.intermediateInputs=intermediateInputs;
    f.costs=round2(intermediateInputs+payrollCosts+wsDepreciation+wsInterestPaid+tax.paid);
    f.profit=round2(wsLAIR-tax.paid);
    f.ebitda=wsEBITDA;
    f.depreciation=wsDepreciation;
    f.interestPaid=wsInterestPaid;
    f.taxPaid=tax.paid;
    if(ctx)ctx.wsProfitTaxPaid=tax.paid;

  },

  sync(f, { ls, tfp }) {
    if (ls && ls.sectorWorkers) f.activeWorkers = ls.sectorWorkers.workshop || 0;
    f.openVacancies = S.sectorVacancies?.workshop ?? 1;
    f.offeredWage = S.workshopWage || S.policy.minimumWage;
    f.employerTaxDebt = round2(f.employerTaxDebt||0);
    f.taxDebt = round2(f.employerTaxDebt + (S.workshopTaxDebt||0));
    f.wageDebt = firmWageDebt("workshop");
    if (!f.inventory) f.inventory = { name: "Kits de ferramentas e peças", unit: "lotes", quantity: 5, unitValue: 180 };
    f.inventory.quantity = S.workshopMaterials || 5;
    f.inventory.unitValue = round2(S.servicePrice || 180);
  }
};

const bakeryBehavior = {
  plan(f, ctx = {}) {
    if (f.status === "active") {
      const minFullCost = (f.offeredWage || S.policy.minimumWage) * (1 + (S.policy.employerTax || 15) / 100);
      f.openVacancies = balance(f.account) >= minFullCost ? (f.baseCapacity || 1) : 0;
      f.offeredWage = Math.max(S.policy.minimumWage, Math.round(S.wage * 0.96));
    } else {
      f.openVacancies = 0;
    }
  },

  produce(f, ctx = {}) {
    if (f.status !== "active") return { batchYield: 0, totalStock: 0 };
    const workers = Math.max(0, Number(f.activeWorkers)||0);
    const tfp = f.productivityFactor || S?.urbanInfra?.tfpFactor || 1.0;
    const batchYield = round2(workers * 20 * tfp);
    if(workers<=0)return {batchYield:0,totalStock:f.inventory?.quantity||0};
    if (!f.inventory) f.inventory = { name: "Pães e mantimentos", unit: "unid", quantity: 20, unitValue: 80 };
    f.inventory.quantity = round2((f.inventory.quantity || 0) + batchYield);
    f.inventory.unitValue = round2(S.marketPrice * 0.35);
    return { batchYield, totalStock: f.inventory.quantity };
  },

  market(f, ctx = {}) {
    if (f.status !== "active") return { sales: 0 };
    const plans = ctx.plans || [];
    let bakerySales = 0;
    const pricePerUnit = round2((S.marketPrice || 280) * 0.35);
    const available = f.inventory?.quantity || 0;
    if (available > 0) {
      for (const p of plans) {
        if (p.h.cash >= pricePerUnit && f.inventory.quantity >= 1) {
          const buyUnits = Math.min(Math.floor(p.h.cash / (pricePerUnit * 2)), Math.floor(f.inventory.quantity));
          if (buyUnits >= 1) {
            const paid = log(accountKey(p.h), f.account, buyUnits * pricePerUnit, "Compra de pães e mantimentos artesanais");
            f.inventory.quantity -= buyUnits;
            bakerySales += paid;
            if(S.currentMonthTracking)S.currentMonthTracking.bakerySales=(S.currentMonthTracking.bakerySales||0)+paid;
            if (p.h.shortageUnits > 0) {
              p.h.shortageUnits = Math.max(0, p.h.shortageUnits - buyUnits * 0.1);
            }
          }
        }
      }
    }
    f.monthRevenue=round2((f.monthRevenue||0)+bakerySales);
    if(S.currentMonthTracking)S.currentMonthTracking.bakerySales=round2((S.currentMonthTracking.bakerySales||0)+bakerySales);
    return { sales: bakerySales };
  },

  settle(f, ctx = {}) {
    const interestPaid=Number(S.lastLoanSettlement?.byBorrower?.[f.account]?.interestPaid)||0;
    const revenue=round2(f.monthRevenue||0);
    const intermediateInputs=round2(f.intermediateInputs||0);
    const payrollCosts=round2(f.payrollCosts||0);
    const depr=revenue>0?round2((f.capitalStock||10000)*(f.depreciationRate||0.0025)):0;
    if(depr>0)f.capitalStock=round2(Math.max(0,f.capitalStock-depr));
    const ebitda=round2(revenue-intermediateInputs-payrollCosts);
    const pretax=round2(ebitda-depr-interestPaid);
    const tax=settleFirmProfitTax(f,pretax,"Imposto sobre lucro da padaria");
    f.revenue=revenue;
    f.costs=round2(intermediateInputs+payrollCosts+depr+interestPaid+tax.paid);
    f.profit=round2(pretax-tax.paid);
    f.profitBeforeTax=pretax;
    f.ebitda=ebitda;
    f.depreciation=depr;
    f.interestPaid=interestPaid;
    f.taxPaid=tax.paid;
    f.monthRevenue=0;

  },

  sync(f, { ls, tfp }) {
    f.productivityFactor = tfp;
    f.activeWorkers = S.households ? S.households.reduce((acc, h) => acc + (h.sectorJobs?.[f.id] || 0), 0) : (f.activeWorkers || 0);
    f.offeredWage = f.offeredWage || S.policy.minimumWage;
    f.taxDebt = round2(f.taxDebt || 0);
    f.wageDebt = firmWageDebt(f.id);
    if (!f.inventory) f.inventory = { name: "Pães e mantimentos", unit: "unid", quantity: 20, unitValue: 80 };
  }
};

const defaultFirmBehavior = {
  plan(f, ctx = {}) {
    if (f.status === "active") {
      const minFullCost = (f.offeredWage || S.policy.minimumWage) * (1 + (S.policy.employerTax || 15) / 100);
      f.openVacancies = balance(f.account) >= minFullCost ? (f.baseCapacity || 1) : 0;
    } else {
      f.openVacancies = 0;
    }
  },

  produce(f, ctx = {}) {},

  market(f, ctx = {}) {},

  settle(f, ctx = {}) {
    const interestPaid=Number(S.lastLoanSettlement?.byBorrower?.[f.account]?.interestPaid)||0;
    const intermediateInputs=round2(f.intermediateInputs??f.costs??0);
    const payrollCosts=round2(f.payrollCosts||0);
    const depr=round2((f.capitalStock||0)*(f.depreciationRate||0.0025));
    if(depr>0)f.capitalStock=round2(Math.max(0,f.capitalStock-depr));
    const ebitda=round2((f.revenue||0)-intermediateInputs-payrollCosts);
    const pretax=round2(ebitda-depr-interestPaid);
    const tax=settleFirmProfitTax(f,pretax,`Imposto sobre lucro (${f.name})`);
    f.intermediateInputs=intermediateInputs;
    f.costs=round2(intermediateInputs+payrollCosts+depr+interestPaid+tax.paid);
    f.ebitda=ebitda;f.depreciation=depr;f.interestPaid=interestPaid;
    f.profitBeforeTax=pretax;f.profit=round2(pretax-tax.paid);f.taxPaid=tax.paid;
  },

  sync(f, { ls, tfp }) {
    f.activeWorkers = f.activeWorkers || 0;
    f.openVacancies = f.openVacancies !== undefined ? f.openVacancies : 1;
    f.offeredWage = f.offeredWage || S.policy.minimumWage;
    f.taxDebt = round2(f.taxDebt || 0);
    f.wageDebt = round2(f.wageDebt || 0);
  }
};

function createFirm(id, name, sector, account, config = {}, behavior = {}) {
  const firm = {
    // 1. Identificação institucional e contrato
    id,
    name,
    sector,
    sectorLabel: config.sectorLabel || sector,
    account,
    ownership: config.ownership || { treasury: 0.0, private: 1.0 },
    operator: config.operator || "private",
    governanceLabel: config.governanceLabel || (config.operator === "state" ? "Estatal" : "Privada"),
    contract: config.contract || { type: "private_license", terms: "Registro municipal de atividade econômica" },

    // 2. Situação operacional e física (sem duplicação de saldos contábeis oficiais)
    status: config.status || "active",
    capitalStock: config.capitalStock !== undefined ? config.capitalStock : 0,
    depreciationRate: config.depreciationRate !== undefined ? config.depreciationRate : 0.0025,
    baseCapacity: config.baseCapacity !== undefined ? config.baseCapacity : 2,
    productivityFactor: config.productivityFactor !== undefined ? config.productivityFactor : 1.0,
    openVacancies: config.openVacancies !== undefined ? config.openVacancies : 0,
    offeredWage: config.offeredWage !== undefined ? config.offeredWage : 1500,
    activeWorkers: config.activeWorkers || 0,
    wageDebt: config.wageDebt || 0,
    employerTaxDebt: config.employerTaxDebt || 0,
    profitTaxDebt: config.profitTaxDebt || 0,
    payrollCosts: 0,
    payroll: { wagesDue: 0, wagesPaid: 0, employerTaxDue: 0, employerTaxPaid: 0, incomeTaxPaid: 0, workers: 0 },
    taxDebt: config.taxDebt || 0,
    inventory: config.inventory || { name: "Estoque", unit: "unidades", quantity: 0, unitValue: 0 },
    valuation: config.valuation || 0,

    // 3. Configuração
    config: {
      depreciationRate: 0.0025,
      baseCapacity: 2,
      ...config
    },

    // 4. Módulo de comportamento produtivo (polimórfico)
    behavior: {
      plan: () => {},
      produce: () => {},
      settle: () => {},
      sync: () => {},
      ...behavior
    },

    // 5. Getters para saldos derivados das fontes contábeis oficiais (Stock-Flow Consistent)
    get cash() { return balance(this.account); },
    set cash(v) { /* fonte de verdade é S.accounts via log/balance */ },
    get loans() { return totalLoans(this.account); },
    set loans(v) { /* fonte de verdade é S.bankLoans */ },
    get payables() { return { wages: this.wageDebt || 0, taxes: this.taxDebt || 0 }; },
    set payables(v) { if (v) { if (v.wages !== undefined) this.wageDebt = v.wages; if (v.taxes !== undefined) this.taxDebt = v.taxes; } }
  };
  return firm;
}

function initFirms(){
  const fAcc = farmAccount();
  const tfp = S?.urbanInfra?.tfpFactor || 1.0;

  const farm = createFirm("farm", "Fazenda", "agriculture", fAcc, {
    baseCapacity: S.baseJobsAvailable || 8,
    capitalStock: 40000,
    depreciationRate: 0.0025,
    ownership: { ...S.farmOwnership },
    operator: S.owner,
    contract: { type: "statutory", terms: "Operação pública direta" },
    inventory: { name: "Café em grão", unit: "sacas", quantity: S.coffeeStock || 0, unitValue: round2(S.usdCoffee * S.fx) },
    openVacancies: S.jobsAvailable || 8,
    offeredWage: S.wage || 1800,
    productivityFactor: tfp
  }, farmBehavior);

  const commerce = createFirm("commerce", "Comércio e Abastecimento Local", "retail", "commerce", {
    baseCapacity: 2,
    capitalStock: 15000,
    depreciationRate: 0.0025,
    ownership: { treasury: 0.0, private: 1.0 },
    operator: "private",
    contract: { type: "private_license", terms: "Alvará comercial privado" },
    inventory: { name: "Cesta básica", unit: "cestas", quantity: S.marketStock || 0, unitValue: round2(S.marketPrice) },
    openVacancies: S.sectorVacancies?.commerce ?? 1,
    offeredWage: S.commerceWage || 1710,
    productivityFactor: tfp
  }, commerceBehavior);

  const workshop = createFirm("workshop", "Oficina de Obras e Serviços Locais", "construction_services", "workshop", {
    baseCapacity: 2,
    capitalStock: 12000,
    depreciationRate: 0.0025,
    ownership: { treasury: 0.0, private: 1.0 },
    operator: "private",
    contract: { type: "private_license", terms: "Oficina mecânica e serviços" },
    inventory: { name: "Kits de ferramentas e peças", unit: "lotes", quantity: S.workshopMaterials || 5, unitValue: round2(S.servicePrice || 180) },
    openVacancies: S.sectorVacancies?.workshop ?? 1,
    offeredWage: S.workshopWage || 1836,
    productivityFactor: tfp
  }, workshopBehavior);

  S.firms = [farm, commerce, workshop];
  syncFirmState();
}

function syncFirmState(){
  if (!S.firms || !S.firms.length) initFirms();
  const ls = getLaborStats();
  const tfp = S?.urbanInfra?.tfpFactor || 1.0;
  for (const f of S.firms) {
    f.productivityFactor = tfp;
    if (f.behavior && typeof f.behavior.sync === "function") {
      f.behavior.sync(f, { ls, tfp });
    }
  }
}
function getFirms(){
 syncFirmState();
 return S.firms;
}
function runFirmPlanningPhase(ctx={}){
 if(!S.firms||!S.firms.length)initFirms();
 salaryCalc();
 for(const f of S.firms){
  if(f.behavior&&typeof f.behavior.plan==="function")f.behavior.plan(f,ctx);
  f.openVacancies=f.status==="active"?Math.max(0,Math.floor(Number(f.openVacancies)||0)):0;
 }
 const vacancies={};
 for(const f of S.firms)vacancies[f.id]=f.openVacancies;
 S.sectorVacancies=vacancies;
 const farm=S.firms.find(f=>f.id==="farm");
 S.jobsAvailable=farm?farm.openVacancies:0;
 S.totalJobsAvailable=S.firms.filter(f=>f.status==="active").reduce((sum,f)=>sum+f.openVacancies,0);
}

function matchCollectiveLaborMarket(ctx={}){
 if(!S.firms||!S.firms.length)initFirms();
 const activeFirms=S.firms.filter(f=>f.status==="active");
 const primaryFirms=activeFirms.filter(f=>f.config?.role==="primary"||f.id==="farm"||f.sector==="agriculture");
 const farmFirm=primaryFirms.find(f=>f.id==="farm");
 const legacyVacancyOverride=!!(farmFirm&&Number.isFinite(Number(S.jobsAvailable))&&Number(S.jobsAvailable)!==Number(farmFirm.openVacancies));
 if(legacyVacancyOverride)farmFirm.openVacancies=Math.max(0,Math.floor(Number(S.jobsAvailable)||0));
 const secondaryFirms=legacyVacancyOverride?[]:activeFirms.filter(f=>!primaryFirms.includes(f));
 const eligible=[...S.households].sort((a,b)=>{
  const eqA=Math.max(1,a.adults+a.children*0.7),eqB=Math.max(1,b.adults+b.children*0.7);
  const liqA=(a.cash+a.deposit-a.wageDebt)/eqA,liqB=(b.cash+b.deposit-b.wageDebt)/eqB;
  if(Math.abs(liqA-liqB)>1)return liqA-liqB;
  return a.id-b.id;
 });
 for(const h of S.households){
  if(h.outOfLaborForce===undefined)h.outOfLaborForce=0;
  const activeAdults=Math.max(0,Math.floor(h.adults-clamp(h.outOfLaborForce,0,h.adults)));
  h.activeAdults=activeAdults;h.jobs=0;h.unemployedSeeking=activeAdults;
  h.sectorJobs={};
  for(const f of S.firms)h.sectorJobs[f.id]=0;
  h.sectorJobs.farm=h.sectorJobs.farm||0;
  h.sectorJobs.commerce=h.sectorJobs.commerce||0;
  h.sectorJobs.workshop=h.sectorJobs.workshop||0;
 }
 // Atribui primeiro as vagas dos setores primários, respeitando a força de trabalho.
 const primaryRemaining=new Map(primaryFirms.map(f=>[f.id,f.openVacancies]));
 let progress=true;
 while(progress){
  progress=false;
  for(const h of eligible){
   if(h.jobs>=h.activeAdults)continue;
   const firm=primaryFirms.find(f=>(primaryRemaining.get(f.id)||0)>0);
   if(!firm)continue;
   h.sectorJobs[firm.id]=(h.sectorJobs[firm.id]||0)+1;
   h.jobs++;primaryRemaining.set(firm.id,primaryRemaining.get(firm.id)-1);progress=true;
  }
 }
 // Os setores secundários recebem trabalhadores realocados de famílias com mais de um emprego primário.
 // Isso preserva o total de trabalhadores e não cria mão de obra fictícia.
 for(const firm of secondaryFirms){
  let remaining=firm.openVacancies;
  const candidates=[...eligible].sort((a,b)=>{
   const aPrimary=primaryFirms.reduce((n,f)=>n+(a.sectorJobs[f.id]||0),0);
   const bPrimary=primaryFirms.reduce((n,f)=>n+(b.sectorJobs[f.id]||0),0);
   return bPrimary-aPrimary||a.id-b.id;
  });
  for(const h of candidates){
   if(remaining<=0)break;
   const source=primaryFirms.find(f=>(h.sectorJobs[f.id]||0)>0);
   if(source){
    h.sectorJobs[source.id]--;
    h.sectorJobs[firm.id]=(h.sectorJobs[firm.id]||0)+1;
    remaining--;
   }else if(h.jobs<h.activeAdults){
    h.sectorJobs[firm.id]=(h.sectorJobs[firm.id]||0)+1;
    h.jobs++;remaining--;
   }
  }
 }
 for(const h of S.households){
  h.jobs=Object.values(h.sectorJobs).reduce((sum,v)=>sum+Math.max(0,Number(v)||0),0);
  h.unemployedSeeking=Math.max(0,h.activeAdults-h.jobs);
 }
 const ls=getLaborStats();
 for(const f of S.firms)f.activeWorkers=ls.sectorWorkers[f.id]||0;
 return ls;
}

function matchLaborMarket() {
  return matchCollectiveLaborMarket();
}

function assignJobs() {
  return matchCollectiveLaborMarket();
}

function monthlyContributionPerWorker() {
  return (0.35 * 60 * (S.usdCoffee - USD_INPUT) * S.fx) / 12;
}

function updateEmploymentCapacity() {
  runFirmPlanningPhase();
}

function farmAccount() {
  return S.owner === "state" ? "stateFarm" : "privateFarm";
}

function farmLabel() {
  return S.owner === "state" ? "Fazenda estatal" : "Fazenda privada";
}

function salaryCalc() {
  const p = S.policy;
  S.reservation = Math.max(0, S.externalWage - p.migrationCost / 12);
  const ls = getLaborStats(), activeLF = Math.max(1, ls.laborForce);
  const scarcity = clamp((S.jobsAvailable - activeLF) / Math.max(1, S.jobsAvailable), 0, 1), market = S.externalWage * (1 + 0.35 * scarcity);
  if (S.owner === "state") S.wage = Math.max(p.publicWage, p.minimumWage);
  else {
    const housingCost = p.housing === "employer" ? HOUSING_VALUE : 0, sustainable = Math.max(0, monthlyContributionPerWorker() - housingCost) / Math.max(1, 1 + p.employerTax / 100);
    S.wage = Math.min(market, sustainable);
    S.wage = Math.max(p.minimumWage, S.wage);
  }
  S.commerceWage = Math.max(p.minimumWage, Math.round(S.wage * 0.95));
  S.workshopWage = Math.max(p.minimumWage, Math.round(S.wage * 1.02));
}

function settleMigratedClaims() {
  for (const c of S.migratedClaims) {
    if (c.wageDebt <= 0) continue;
    const debtor = c.debtorAccount || farmAccount(), paid = log(debtor, "external", Math.min(c.wageDebt, balance(debtor)), "Quitação de crédito salarial de ex-morador");
    c.wageDebt -= paid;
  }
}

function settleAllFirmWages(ctx={}){
 const p=S.policy||{};
 settleMigratedClaims();
 const firms=(S.firms||[]).filter(f=>f.account&&f.account!=="external");
 const farm=firms.find(f=>f.id==="farm");
 const byFirm={};
 let totalDue=0,totalPaid=0,totalEmployerDue=0,totalEmployerPaid=0,totalIncomeTaxPaid=0;

 // Migra automaticamente créditos salariais legados para a conta da fazenda.
 for(const h of S.households){
  if(!h.wageDebtByFirm||typeof h.wageDebtByFirm!=="object")h.wageDebtByFirm={};
  const mapped=Object.values(h.wageDebtByFirm).reduce((n,v)=>n+Math.max(0,Number(v)||0),0);
  const legacy=Math.max(0,(Number(h.wageDebt)||0)-mapped);
  if(legacy>0.005)h.wageDebtByFirm.farm=round2((h.wageDebtByFirm.farm||0)+legacy);
 }

 // Quita primeiro os encargos patronais já vencidos.
 for(const f of firms){
  const oldDebt=Math.max(0,Number(f.employerTaxDebt)||0);
  if(oldDebt>0.005&&balance(f.account)>0){
   const paid=log(f.account,"treasury",Math.min(oldDebt,balance(f.account)),`Quitação de encargo patronal atrasado (${f.name})`);
   f.employerTaxDebt=round2(oldDebt-paid);
   totalEmployerPaid+=paid;
  }
 }

 // Quita salários em atraso de cada empresa, preservando a origem do passivo.
 for(const f of firms){
  for(const h of S.households){
   const debt=Math.max(0,Number(h.wageDebtByFirm[f.id])||0);
   if(debt<=0.005||balance(f.account)<=0)continue;
   const paid=log(f.account,accountKey(h),Math.min(debt,balance(f.account)),`Quitação de salário atrasado (${f.name} - Mês ${S.monthNumber})`);
   h.wageDebtByFirm[f.id]=round2(debt-paid);
   h.wageDebt=Math.max(0,round2((h.wageDebt||0)-paid));
   const taxDue=round2(paid*p.incomeTax/100);
   const taxPaid=log(accountKey(h),"treasury",taxDue,`Imposto sobre salário retido na fonte (${f.name})`);
   totalIncomeTaxPaid+=taxPaid;
   if(S.currentMonthTracking)S.currentMonthTracking.wageSalaryTax=round2((S.currentMonthTracking.wageSalaryTax||0)+taxPaid);
   h.cashIncome+=Math.max(0,paid-taxPaid);
  }
 }

 // Apura e paga a folha corrente por empresa.
 for(const f of firms){
  const wage=Math.max(0,Number(f.offeredWage)||(f.id==="farm"?S.wage:p.minimumWage||0));
  let firmDue=0,firmPaid=0,firmIncomeTax=0,workers=0;
  for(const h of S.households){
   const qty=Math.max(0,Number(h.sectorJobs?.[f.id])||0);
   if(qty<=0)continue;
   workers+=qty;
   const gross=round2(qty*wage);
   firmDue=round2(firmDue+gross);
   const paid=log(f.account,accountKey(h),Math.min(gross,balance(f.account)),`Salário mensal (${f.name} - Mês ${S.monthNumber})`);
   const unpaid=round2(gross-paid);
   if(unpaid>0.005){
    h.wageDebtByFirm[f.id]=round2((h.wageDebtByFirm[f.id]||0)+unpaid);
    h.wageDebt=round2((h.wageDebt||0)+unpaid);
   }
   const taxDue=round2(paid*p.incomeTax/100);
   const taxPaid=log(accountKey(h),"treasury",taxDue,`Imposto sobre salário retido na fonte (${f.name})`);
   firmIncomeTax=round2(firmIncomeTax+taxPaid);
   h.cashIncome+=Math.max(0,paid-taxPaid);
   firmPaid=round2(firmPaid+paid);
  }
  const employerDue=round2(firmDue*p.employerTax/100);
  const employerPaid=employerDue>0?log(f.account,"treasury",employerDue,`Encargo patronal sobre folha (${f.name} - Mês ${S.monthNumber})`):0;
  f.employerTaxDebt=round2((f.employerTaxDebt||0)+(employerDue-employerPaid));
  f.payrollCosts=round2(firmDue+employerDue);
  f.payroll={wagesDue:firmDue,wagesPaid:firmPaid,employerTaxDue:employerDue,employerTaxPaid:employerPaid,incomeTaxPaid:firmIncomeTax,workers};
  byFirm[f.id]={...f.payroll};
  totalDue=round2(totalDue+firmDue);
  totalPaid=round2(totalPaid+firmPaid);
  totalEmployerDue=round2(totalEmployerDue+employerDue);
  totalEmployerPaid=round2(totalEmployerPaid+employerPaid);
  totalIncomeTaxPaid=round2(totalIncomeTaxPaid+firmIncomeTax);
  if(f.id==="farm")S.monthFarmCosts=round2((S.monthFarmCosts||0)+f.payrollCosts);
 }
 syncGlobalEmployerTaxDebt();
 for(const f of firms){
  f.wageDebt=firmWageDebt(f.id);
  const profitTaxDebt=f.id==="farm"?(S.farmTaxDebt||0):f.id==="commerce"?(S.commerceTaxDebt||0):f.id==="workshop"?(S.workshopTaxDebt||0):(f.profitTaxDebt||0);
  f.profitTaxDebt=round2(profitTaxDebt);
  f.taxDebt=round2((f.employerTaxDebt||0)+f.profitTaxDebt);
 }
 S.farmWageDebt=totalWageDebt();
 if(S.farmWageDebt>0)feed("O vilarejo acumulou "+money(S.farmWageDebt)+" em salários pendentes.");
 return{due:totalDue,paid:totalPaid,employerCharge:totalEmployerPaid,employerChargeDue:totalEmployerDue,incomeTaxPaid:totalIncomeTaxPaid,byFirm};
}

function settleWages() {
  return settleAllFirmWages();
}

function runFirmProductionPhase(ctx = {}) {
  if (!S.firms) return;
  for (const f of S.firms) {
    if (f.behavior && typeof f.behavior.produce === "function") {
      f.behavior.produce(f, ctx);
    }
  }
}

function buyInputsAndProduce() {
  runFirmProductionPhase({ day: S.day, fx: S.fx, weatherFactor: S.weatherFactor });
}

function runFirmCommercializationPhase(ctx = {}) {
  if (!S.firms) return;
  for (const f of S.firms) {
    if (f.behavior && typeof f.behavior.market === "function") {
      f.behavior.market(f, ctx);
    }
  }
}

function sellCoffee() {
  const farmF = S.firms?.find(f => f.id === "farm");
  if (farmF && farmF.behavior && typeof farmF.behavior.market === "function") {
    farmF.behavior.market(farmF, { day: S.day });
  } else {
    runFirmCommercializationPhase({ day: S.day });
  }
}

function runFirmSettlementPhase(ctx = {}) {
  if (!S.firms || !S.firms.length) initFirms();
  for (const f of S.firms) {
    if (f.behavior && typeof f.behavior.settle === "function") {
      f.behavior.settle(f, ctx);
    }
  }
}
function bankReserveFloor(){return totalDeposits()*0.2}
function availableCredit(){return Math.max(0,balance("bank")-bankReserveFloor())}
function borrowerRiskPremium(borrower){
 const existingLoans=S.bankLoans.filter(l=>l.borrower===borrower);
 if(!existingLoans.length)return 0;
 const arrears=existingLoans.reduce((n,l)=>n+(l.principalArrears||0)+(l.interestArrears||0),0);
 const totalDebt=existingLoans.reduce((n,l)=>n+(l.principal||0)+(l.principalArrears||0)+(l.interestArrears||0),0);
 const arrSpread=arrears>0.01?clamp(Math.round((arrears/Math.max(1,totalDebt))*150)/10000,0.002,0.02):0;
 const bCash=balance(borrower);
 const levSpread=totalDebt>12000&&bCash<2000?0.005:0;
 return clamp(Math.round((arrSpread+levSpread)*10000)/10000,0,0.025);
}
function issueLoan(borrower,amount,purpose){const approved=Math.min(Math.max(0,amount),availableCredit());if(approved<1)return 0;const riskPrem=borrowerRiskPremium(borrower),rate=round2((S.policy.baseRate/100+CREDIT_SPREAD/100+riskPrem)*10000)/10000;const paid=log("bank",borrower,approved,"Empréstimo: "+purpose);if(paid>0)S.bankLoans.push({id:"loan_"+(++S.loanSeq||1),borrower,principal:round2(paid),rate,riskPremium:riskPrem,term:24,principalArrears:0,interestArrears:0,purpose,openedMonth:S.monthNumber});return paid}
function withdrawDeposit(h,amount){const paid=log("bank",accountKey(h),Math.min(amount,h.deposit),"Resgate de depósito bancário");h.deposit-=paid;return paid}
function settleBankLoans(){
 let interestIncome=0,principalRecovered=0,totalAccruedInterest=0;
 const byBorrower={};
 for(const loan of S.bankLoans){
  migrateLoan(loan);
  if(loan.principal<=0.005&&loan.principalArrears<=0.005&&loan.interestArrears<=0.005)continue;
  // Juros correntes incidem sobre o principal regular e o principal vencido:
  // J = taxa * (principal regular + principal vencido). Não calcular sobre juros vencidos.
  const interestCurrent=round2(((loan.principal||0)+(loan.principalArrears||0))*loan.rate);
  totalAccruedInterest=round2(totalAccruedInterest+interestCurrent);
  const principalCurrent=loan.term>1?round2(loan.principal/loan.term):round2(loan.principal);
  const totalDue=round2(loan.interestArrears+interestCurrent+loan.principalArrears+principalCurrent);
  const canPay=Math.min(totalDue,balance(loan.borrower));
  const paid=log(loan.borrower,"bank",canPay,"Prestação de crédito: "+loan.purpose,true);
  let rem=paid;
  // 1. Juros vencidos
  const payIA=Math.min(rem,loan.interestArrears);
  loan.interestArrears=round2(loan.interestArrears-payIA);
  rem=round2(rem-payIA);
  // 2. Juros correntes
  const payIC=Math.min(rem,interestCurrent);
  const unpaidIC=round2(interestCurrent-payIC);
  loan.interestArrears=round2(loan.interestArrears+unpaidIC); // Juros não pagos permanecem registrados
  rem=round2(rem-payIC);
  const interestPaidNow=round2(payIA+payIC);
  interestIncome=round2(interestIncome+interestPaidNow);
  // 3. Principal vencido
  const payPA=Math.min(rem,loan.principalArrears);
  loan.principalArrears=round2(loan.principalArrears-payPA);
  rem=round2(rem-payPA);
  // 4. Principal corrente
  const payPC=Math.min(rem,principalCurrent);
  const unpaidPC=round2(principalCurrent-payPC);
  loan.principal=round2(Math.max(0,loan.principal-principalCurrent));
  loan.principalArrears=round2(loan.principalArrears+unpaidPC); // Principal corrente não pago migra para principal vencido
  rem=round2(rem-payPC);
  // 5. Amortização extraordinária
  let extraP=0;
  if(rem>0){
   extraP=Math.min(rem,loan.principal);
   loan.principal=round2(loan.principal-extraP);
   rem=round2(rem-extraP);
  }
  const principalPaidNow=round2(payPA+payPC+extraP);
  principalRecovered=round2(principalRecovered+principalPaidNow);
  const bRec=byBorrower[loan.borrower]||{interestPaid:0,principalPaid:0,unpaidInterest:0,unpaidPrincipal:0,accruedInterest:0};
  bRec.interestPaid=round2(bRec.interestPaid+interestPaidNow);
  bRec.principalPaid=round2(bRec.principalPaid+principalPaidNow);
  bRec.unpaidInterest=round2(bRec.unpaidInterest+loan.interestArrears);
  bRec.unpaidPrincipal=round2(bRec.unpaidPrincipal+loan.principalArrears);
  bRec.accruedInterest=round2(bRec.accruedInterest+interestCurrent);
  byBorrower[loan.borrower]=bRec;
  loan.term=Math.max(1,loan.term-1);
  if(loan.principal<0.005)loan.principal=0;
  if(loan.principalArrears<0.005)loan.principalArrears=0;
  if(loan.interestArrears<0.005)loan.interestArrears=0;
 }
 S.bankLoans=S.bankLoans.filter(l=>l.principal>0.005||l.principalArrears>0.005||l.interestArrears>0.005);
 S.bankInterestIncome=round2(interestIncome);
 S.bankAccruedInterest=round2(totalAccruedInterest);
 S.lastLoanSettlement={byBorrower,totalInterestPaid:S.bankInterestIncome,totalPrincipalPaid:principalRecovered,totalAccruedInterest};
 return S.bankInterestIncome;
}
function payDepositInterest(){const deposits=totalDeposits();if(deposits<=0||S.bankInterestIncome<=0){S.lastDepositInterest=0;S.effectiveDepositRate=0;return 0}const budget=Math.min(S.bankInterestIncome,balance("bank")),target=deposits*S.policy.baseRate/100,payout=Math.min(budget,target);if(payout<=0){S.lastDepositInterest=0;S.effectiveDepositRate=0;return 0}for(const h of S.households){const share=deposits>0?h.deposit/deposits:0,part=payout*share;if(part>0){const paid=log("bank",accountKey(h),part,"Remuneração de depósitos bancários");h.lastInterestReceived=paid;h.cashIncome+=paid}}S.lastDepositInterest=payout;S.effectiveDepositRate=payout/deposits*100;return payout}
function depositHouseholdSavings(){const savePropensity=clamp(0.45+(S.policy.baseRate-1.0)*0.05,0.30,0.65);for(const h of S.households){const eq=h.adults+h.children*0.7,essentialReserve=eq*S.policy.basketCost*0.75,excess=Math.max(0,h.cash-essentialReserve),deposit=excess*savePropensity;if(deposit>1){const paid=log(accountKey(h),"bank",deposit,"Aplicação de poupança familiar");h.deposit+=paid}}}
function updateMarketPrice(){
 const demand=S.households.reduce((n,h)=>n+(h.adults+h.children*0.7)*(S.policy.basketCost/(USD_IMPORT*5*(1+BASE_MARKUP))),0),shortRatio=clamp(S.lastShortageUnits/Math.max(0.1,demand),0,1),buffer=demand*0.25,excessRatio=clamp((S.marketStock-buffer)/Math.max(0.1,demand),0,1),pressure=clamp(1+0.25*shortRatio-0.12*excessRatio,0.85,1.5),markup=(S.baseMarkup!==undefined?S.baseMarkup:BASE_MARKUP)+S.commerceMarkupExtra,target=USD_IMPORT*S.fx*(1+markup)*pressure;
 const prevPrice=S.marketPrice||target;
 S.marketPressure=pressure;
 S.marketTargetPrice=target;
 S.marketPrice=clamp(S.marketPrice*0.6+target*0.4,target*0.85,target*1.5);
 const baseFoodPrice=USD_IMPORT*5*(1+BASE_MARKUP);
 const baseServicePrice=180;
 S.servicePrice=round2(clamp(baseServicePrice*(0.75+0.25*(S.wage/1800))*(0.85+0.15*(S.fx/5)),140,360));
 const housingEffective=S.policy.housing==="rented"?300:HOUSING_VALUE;
 const prevIndex=S.costOfLivingIndex||100;
 S.costOfLivingIndex=round2((0.65*(S.marketPrice/baseFoodPrice)+0.15*(S.servicePrice/baseServicePrice)+0.20*(housingEffective/HOUSING_VALUE))*100);
 S.monthlyInflation=round2(((S.costOfLivingIndex/Math.max(1,prevIndex))-1)*100);
}
function marketConsumption(){
 const unitNeed=S.policy.basketCost/(USD_IMPORT*5*(1+BASE_MARKUP));
 const rateDiscFactor=clamp(1-0.06*(S.policy.baseRate-1.5),0.75,1.15);
 const plans=S.households.map(h=>{
  const persons=h.adults+h.children*0.7,essential=persons*unitNeed,baselineCost=essential*S.marketPrice,surplus=Math.max(0,h.cashIncome-baselineCost);
  const discretionaryFood=Math.min(essential*0.45,(surplus/S.marketPrice)*0.30*rateDiscFactor);
  const desiredServiceUnits=surplus>150?clamp((surplus*0.10)/Math.max(1,S.servicePrice||180),0,persons*0.4):0;
  return{h,essential,desired:essential+discretionaryFood,desiredServiceUnits,affordable:0,bought:0,serviceBought:0};
 });
 const demand=plans.reduce((n,p)=>n+p.desired,0);
 const commFirm=S.firms?.find(f=>f.id==="commerce");
 if(commFirm&&commFirm.behavior&&typeof commFirm.behavior.produce==="function"){
  commFirm.behavior.produce(commFirm,{demand,plans});
 }else{
  const targetStock=demand*1.1,need=Math.max(0,targetStock-S.marketStock),importUnitCost=USD_IMPORT*S.fx,importCost=need*importUnitCost;
  if(importCost>balance("commerce")){const short=importCost-balance("commerce");issueLoan("commerce",short,"capital de giro para importação de alimentos")}
  const paidImport=log("commerce","external",importCost,"Importação de cesta básica");
  if(S.currentMonthTracking)S.currentMonthTracking.commerceImports+=paidImport;
  const imported=importUnitCost>0?paidImport/importUnitCost:0;S.marketStock+=imported;S.importedUnits=imported;S.marketFundingFailure=imported+0.001<need;
 }
 let bankLiquidity=balance("bank");
 for(const p of plans){
  const required=Math.max(0,p.desired*S.marketPrice-p.h.cash);
  if(required>0&&p.h.deposit>0&&bankLiquidity>0){
   const before=balance("bank"),withdrawn=withdrawDeposit(p.h,Math.min(required,bankLiquidity));
   bankLiquidity-=Math.max(0,before-balance("bank"));
  }
 }
 for(const p of plans)p.affordable=Math.min(p.desired,p.h.cash/S.marketPrice);
 let soldTotal=0;
 if(commFirm&&commFirm.behavior&&typeof commFirm.behavior.market==="function"){
  const mRes=commFirm.behavior.market(commFirm,{plans});
  soldTotal=mRes.soldTotal||0;
 }else{
  const totalAffordable=plans.reduce((n,p)=>n+p.affordable,0),available=S.marketStock;
  soldTotal=Math.min(totalAffordable,available);
  for(const p of plans){
   p.bought=totalAffordable>0?soldTotal*(p.affordable/totalAffordable):0;
   const paid=p.bought*S.marketPrice;
   if(paid>0){log(accountKey(p.h),"commerce",paid,"Compra de cesta básica (LES essencial/discricionário)");S.marketStock-=p.bought}
   p.h.shortageUnits=Math.max(0,p.essential-p.bought);
  }
 }
 let serviceConsumptionVal=0;
 const sPrice=S.servicePrice||180;
 const wsFirm=S.firms?.find(f=>f.id==="workshop");
 if(wsFirm&&wsFirm.behavior&&typeof wsFirm.behavior.market==="function"){
  const wsRes=wsFirm.behavior.market(wsFirm,{plans,servicePrice:sPrice});
  serviceConsumptionVal=wsRes.serviceConsumptionVal||0;
 }else{
  for(const p of plans){
   if(p.h.shortageUnits<=0.01&&p.desiredServiceUnits>0.01){
    const minReserve=p.essential*S.marketPrice*0.5;
    const spendable=Math.max(0,p.h.cash-minReserve);
    const sCost=Math.min(spendable,p.desiredServiceUnits*sPrice);
    if(sCost>=5){
     const paidS=log(accountKey(p.h),"workshop",sCost,"Serviços locais e reparos domiciliares (LES)");
     p.serviceBought=paidS/sPrice;
     serviceConsumptionVal+=paidS;
     if(S.currentMonthTracking)S.currentMonthTracking.workshopRevenue=(S.currentMonthTracking.workshopRevenue||0)+paidS;
    }
   }
  }
 }
 const bakeryFirm=S.firms?.find(f=>f.id==="bakery"&&f.status==="active");
 if(bakeryFirm&&bakeryFirm.behavior&&typeof bakeryFirm.behavior.market==="function"){
  bakeryFirm.behavior.market(bakeryFirm,{plans});
 }
 S.lastShortageUnits=plans.reduce((n,p)=>n+p.h.shortageUnits,0);
 S.lastShortage=S.lastShortageUnits*S.marketPrice;
 S.lastFoodConsumption=soldTotal*S.marketPrice;
 S.lastServiceConsumption=serviceConsumptionVal;
 S.lastConsumption=S.lastFoodConsumption+S.lastServiceConsumption;
 S.lastDemandUnits=demand;
 S.lastUnmetHouseholds=plans.filter(p=>p.h.shortageUnits>0.01).length;
 if(S.marketFundingFailure&&S.marketStock<0.1)feed("Comércio insolvente ou sem crédito: importações não cobriram a demanda.");
}
function housing(){
 const mode=S.policy.housing;
 for(const h of S.households){
  if(h.adults+h.children===0)continue;
  if(mode==="employer"&&h.jobs>0){
   const paid=log(farmAccount(),"landlord",HOUSING_VALUE,"Moradia fornecida pelo empregador");
   S.monthFarmCosts+=paid;
   if(S.currentMonthTracking){S.currentMonthTracking.farmHousing=round2((S.currentMonthTracking.farmHousing||0)+paid);S.currentMonthTracking.housingServices=round2((S.currentMonthTracking.housingServices||0)+paid);}
   h.housingBenefit=paid>=HOUSING_VALUE?HOUSING_VALUE:0;
  }else if(mode==="state"&&h.jobs>0){
   const paid=log("treasury","landlord",HOUSING_VALUE,"Moradia social");
   if(S.currentMonthTracking){S.currentMonthTracking.socialHousing=round2((S.currentMonthTracking.socialHousing||0)+paid);S.currentMonthTracking.housingServices=round2((S.currentMonthTracking.housingServices||0)+paid);}
   h.housingBenefit=paid>=HOUSING_VALUE?HOUSING_VALUE:0;
  }else if(mode==="rented"){
   const due=300+h.rentDebt,paid=log(accountKey(h),"landlord",due,"Aluguel e quitação de atraso");
   if(S.currentMonthTracking){S.currentMonthTracking.householdHousing=round2((S.currentMonthTracking.householdHousing||0)+paid);S.currentMonthTracking.housingServices=round2((S.currentMonthTracking.housingServices||0)+paid);}
   h.housingBenefit=0;h.rentDebt=due-paid;
  }else h.housingBenefit=0;
 }
}
function settleProfitTax(){
 const farmFirm=S.firms?.find(f=>f.id==="farm");
 if(farmFirm&&farmFirm.behavior&&typeof farmFirm.behavior.settle==="function"){
  farmFirm.behavior.settle(farmFirm,{policy:S.policy,monthNumber:S.monthNumber});
  return;
 }
 const fAcc=farmAccount();
 const farmInterestPaid=S.lastLoanSettlement?.byBorrower?.[fAcc]?.interestPaid||0;
 const farmCapital=farmFirm?farmFirm.capitalStock:(Math.max(0,(S.baseJobsAvailable||8)-8)*8000+40000);
 const farmDepreciation=(S.monthFarmRevenue>0||S.monthFarmCosts>0)?round2(farmCapital*(farmFirm?.depreciationRate||0.0025)):0;
 if(farmFirm&&farmDepreciation>0){
  farmFirm.capitalStock=round2(Math.max(0,farmFirm.capitalStock-farmDepreciation));
 }
 const ebitda=S.monthFarmRevenue-S.monthFarmCosts;
 const ebit=ebitda-farmDepreciation;
 const lair=ebit-farmInterestPaid;
 S.lastFarmEBITDA=ebitda;
 S.lastFarmDepreciation=farmDepreciation;
 S.lastFarmInterestPaid=farmInterestPaid;
 S.lastFarmProfit=lair;
 if(farmFirm){
  farmFirm.revenue=S.monthFarmRevenue;
  farmFirm.costs=S.monthFarmCosts+farmDepreciation+farmInterestPaid;
  farmFirm.profit=lair;
 }
 if(S.owner==="state"){S.lastProfitTax=0;S.monthFarmRevenue=0;S.monthFarmCosts=0;return}
 const due=Math.max(0,lair)*S.policy.profitTax/100+S.farmTaxDebt,paid=log(fAcc,"treasury",Math.min(due,balance(fAcc)),"Imposto sobre lucro");
 S.farmTaxDebt=due-paid;S.lastProfitTax=paid;S.monthFarmRevenue=0;S.monthFarmCosts=0;
 if(farmFirm)farmFirm.profit=lair-paid;
}
function updateApproval(){for(const h of S.households){const people=h.adults+h.children||1,perCap=(h.cashIncome+h.housingBenefit)/people,needPerCap=h.shortageUnits===undefined?S.policy.basketCost:S.policy.basketCost*(h.adults+h.children*0.7)/people;let delta=perCap>=needPerCap?1:-2;if(h.wageDebt>0)delta-=3;if(h.rentDebt>0)delta-=1;if(h.shortageUnits>0.01)delta-=4;h.happiness=clamp(h.happiness+delta,0,100);h.lastCashIncome=h.cashIncome;h.cashIncome=0;h.housingBenefit=0;h.shortageUnits=0}}
function approval(){const pop=population();return pop?S.households.reduce((n,h)=>n+h.happiness*(h.adults+h.children),0)/pop:0}
function supportStateFarm(){
 if(S.owner!=="state")return 0;
 const farm=S.firms?.find(f=>f.id==="farm");
 if(!farm)return 0;
 const workers=Math.max(0,Number(farm.activeWorkers)||0);
 const wage=Math.max(0,Number(farm.offeredWage)||Number(S.wage)||0);
 const employerRate=Math.max(0,Number(S.policy.employerTax)||0)/100;
 const wageArrears=Math.max(0,Number(firmWageDebt("farm"))||0);
 const employerArrears=Math.max(0,Number(farm.employerTaxDebt)||0);
 const payrollReserve=workers*wage*(1+employerRate)+wageArrears+employerArrears;
 const housingHouseholds=S.policy.housing==="employer"?S.households.filter(h=>h.jobs>0&&h.adults+h.children>0).length:0;
 const housingReserve=housingHouseholds*HOUSING_VALUE;
 let harvestDays=0;
 for(let offset=1;offset<=MONTH;offset++){
  const doy=(S.day+offset)%YEAR;
  if(doy>=150&&doy<210)harvestDays++;
 }
 const unitInput=USD_INPUT*Math.max(0,Number(S.fx)||0)*Math.max(0,Number(S.eventMods?.custo)||1);
 const inputReserve=workers*0.35*harvestDays*unitInput;
 const debtServiceReserve=round2((S.bankLoans||[]).filter(loan=>loan.borrower===(farm.account||"stateFarm")).reduce((sum,loan)=>{
  const principal=Math.max(0,Number(loan.principal)||0);
  const principalArrears=Math.max(0,Number(loan.principalArrears)||0);
  const interestArrears=Math.max(0,Number(loan.interestArrears)||0);
  const rate=Math.max(0,Number(loan.rate)||0);
  const principalDue=loan.term>1?round2(principal/loan.term):principal;
  const interestDue=round2((principal+principalArrears)*rate);
  return sum+principalDue+principalArrears+interestDue+interestArrears;
 },0));
 const operatingReserve=round2(payrollReserve+housingReserve+inputReserve+debtServiceReserve);
 const cashGap=Math.max(0,operatingReserve-balance(farm.account||"stateFarm"));
 const monthlyLimit=Math.max(0,Number(S.policy.monthlyStateSupport)||0);
 const support=Math.min(cashGap,monthlyLimit,Math.max(0,balance("treasury")));
 const paid=support>0?log("treasury",farm.account||"stateFarm",support,"Aporte de capital de giro calculado (folha, moradia e insumos da próxima etapa)"):0;
 if(paid>0&&S.currentMonthTracking)S.currentMonthTracking.stateSupport=round2((S.currentMonthTracking.stateSupport||0)+paid);
 S.lastWorkingCapitalPlan={payrollReserve:round2(payrollReserve),housingReserve:round2(housingReserve),inputReserve:round2(inputReserve),debtServiceReserve:round2(debtServiceReserve),target:operatingReserve,cashBefore:round2(balance(farm.account||"stateFarm")-paid),cashAfter:round2(balance(farm.account||"stateFarm")),support:round2(paid),limit:monthlyLimit};
 return paid;
}
function calculateProjectNPV(cost,landValue,physicalKValue,monthlyCF,horizon=24){
 const creditRate=(S.policy.baseRate+CREDIT_SPREAD)/100;
 const r=Math.max(0.005,creditRate);
 const depr=physicalKValue*0.0025;
 const netCF=Math.max(0,monthlyCF-depr);
 let pvCF=0;
 for(let t=1;t<=horizon;t++){
  pvCF+=netCF/Math.pow(1+r,t);
 }
 const residualVal=landValue+physicalKValue*Math.max(0,1-horizon*0.0025);
 const pvResidual=residualVal/Math.pow(1+r,horizon);
 const npv=round2(pvCF+pvResidual-cost);
 return{npv,pvCF:round2(pvCF),pvResidual:round2(pvResidual),cost,discountRate:r,viable:npv>0};
}
function autoInvestAtLowRates(){
 if(S.lots<=0)return;
 const farm=farmAccount();
 const housingCost=S.policy.housing==="employer"?HOUSING_VALUE:0;
 const farmNetMonthly=Math.max(0,monthlyContributionPerWorker()-S.wage*(1+S.policy.employerTax/100)-housingCost);
 const farmNPV=calculateProjectNPV(8000,8000,0,farmNetMonthly,24);
 const occupancy=clamp(population()/Math.max(1,S.housingCapacity),0,1);
 const landlordCF=300*occupancy;
 const landlordNPV=calculateProjectNPV(14000,8000,6000,landlordCF,24);
 S.lastProjectNPV={farm:farmNPV,landlord:landlordNPV};
 if(farmNPV.viable&&S.farmInvestmentCooldown<=0&&availableCredit()>=8000){
  const loan=issueLoan(farm,8000,"aquisição de lote produtivo");
  if(loan>=7999){
   log(farm,"treasury",8000,"Compra de lote produtivo");
   if(S.currentMonthTracking)S.currentMonthTracking.assetSales+=8000;
   S.lots--;
   S.baseJobsAvailable++;
   S.farmInvestmentCooldown=6;
   feed(`Fazenda investiu em lote produtivo (VPL: ${money(farmNPV.npv)} em H=24 a ${(farmNPV.discountRate*100).toFixed(2)}% a.m.)`);
  }
 }
 if(S.lots>0&&landlordNPV.viable&&S.landlordInvestmentCooldown<=0&&availableCredit()>=14000){
  const loan=issueLoan("landlord",14000,"aquisição de terreno e construção de moradia");
  if(loan>=13999){
   log("landlord","treasury",8000,"Compra de terreno para empreendimento imobiliário");
   if(S.currentMonthTracking)S.currentMonthTracking.assetSales+=8000;
   log("landlord","workshop",3000,"Obra: serviços e mão de obra locais");
   if(S.currentMonthTracking)S.currentMonthTracking.workshopRevenue=(S.currentMonthTracking.workshopRevenue||0)+3000;
   log("landlord","external",3000,"Obra: materiais importados");
   S.lots--;
   S.buildings.push(S.day+30);
   S.landlordInvestmentCooldown=6;
   feed(`Proprietário investiu em imóvel (VPL: ${money(landlordNPV.npv)} em H=24 a ${(landlordNPV.discountRate*100).toFixed(2)}% a.m.)`);
  }
 }
}
function calculateNationalAccounts(options={}){
 if(!options.rebuild&&S.lastNationalAccounts&&S.monthNumber>0)return S.lastNationalAccounts;
 const dre=S.lastDRE||{};
 const records=dre.firms||{};
 const tracking=S.currentMonthTracking||{};
 const vab={agriculture:0,commerce:0,workshop:0,realEstate:0,government:0};
 let totalCompensation=0,employerContributions=0,capitalConsumption=0;
 const firmDetails=[];
 for(const firm of (S.firms||[]).filter(f=>f.status!=="liquidated")){
  const record=records[firm.id]||{};
  const revenue=Number(record.revenue??firm.revenue??0)||0;
  let inputs=Number(record.intermediateInputs??firm.intermediateInputs??0)||0;
  if(firm.id==="farm")inputs=round2((tracking.farmInputs||0)+(tracking.farmHousing||0));
  if(firm.id==="commerce")inputs=round2(tracking.commerceImports||0);
  if(firm.id==="workshop")inputs=round2(tracking.workshopCosts||0);
  const valueAdded=round2(revenue-inputs);
  const sector=record.sector||firm.sector;
  if(sector==="agriculture")vab.agriculture=round2(vab.agriculture+valueAdded);
  else if(sector==="retail")vab.commerce=round2(vab.commerce+valueAdded);
  else vab.workshop=round2(vab.workshop+valueAdded);
  const payroll=record.payroll||firm.payroll||{};
  const wages=Number(payroll.wagesDue)||0;
  const employerTax=Number(payroll.employerTaxDue)||0;
  totalCompensation=round2(totalCompensation+wages+employerTax);
  employerContributions=round2(employerContributions+employerTax);
  const depreciation=Number(record.depreciation??firm.depreciation)||0;
  capitalConsumption=round2(capitalConsumption+depreciation);
  firmDetails.push({firmId:firm.id,sector,revenue,intermediateInputs:inputs,valueAdded,payroll,depreciation});
 }
 // The property account produces housing services. Employer-provided housing is an
 // intermediate input; household rent and public housing are final consumption.
 const housingOutput=round2(tracking.housingServices||0);
 const housingInputs=round2(tracking.landlordMaintenanceCosts||0);
 const housingIntermediateInputs=round2(tracking.farmHousing||0);
 vab.realEstate=round2(housingOutput-housingInputs);
 vab.totalVAB=round2(vab.agriculture+vab.commerce+vab.workshop+vab.realEstate+vab.government);
 const inventoryOpening=Number(tracking.inventoryOpeningValue)||0;
 const inventoryClosing=inventoryValue();
 const inventoryChange=round2(inventoryClosing-inventoryOpening);
 // Production includes goods produced but not yet sold. The inventory change is
 // added to output; the expenditure approach records the same change separately.
 const productTaxes=round2(Number(dre.treasury?.productTaxes)||0);
 const gdpProduction=round2(vab.totalVAB+inventoryChange+productTaxes);
 const grossOperatingSurplus=round2(gdpProduction-totalCompensation-capitalConsumption-productTaxes);
 const gdpIncome=round2(totalCompensation+capitalConsumption+grossOperatingSurplus+productTaxes);
 const householdConsumption=round2((Number(S.lastConsumption)||0)+(Number(tracking.bakerySales)||0)+(Number(tracking.householdHousing)||0));
 const governmentConsumption=round2(Number(tracking.socialHousing)||0);
 const grossCapitalFormation=round2((Number(tracking.publicWorks)||0)+(Number(tracking.privateFixedInvestment)||0));
 const exportsVal=round2(Number(dre.farm?.revenue??tracking.farmRevenue)||0);
 const importsVal=round2((Number(tracking.farmInputs)||0)+(Number(tracking.commerceImports)||0)+(Number(tracking.importedCapitalGoods)||0));
 const netExports=round2(exportsVal-importsVal);
 const gdpExpenditure=round2(householdConsumption+governmentConsumption+grossCapitalFormation+inventoryChange+netExports);
 const discrepancyProductionIncome=round2(gdpProduction-gdpIncome);
 const discrepancyProductionExpenditure=round2(gdpProduction-gdpExpenditure);
 const discrepancyPct=gdpProduction!==0?round2(Math.abs(discrepancyProductionExpenditure/gdpProduction)*100):0;
 return{
  vab,productTaxes,gdp:gdpProduction,
  approaches:{production:gdpProduction,income:gdpIncome,expenditure:gdpExpenditure},
  components:{householdConsumption,governmentConsumption,grossCapitalFormation,inventoryChange,exports:exportsVal,imports:importsVal,netExports,employeeCompensation:totalCompensation,employerSocialContributions:employerContributions,consumptionOfFixedCapital:capitalConsumption,grossOperatingSurplus,housingOutput,housingIntermediateInputs},
  firmDetails,exports:exportsVal,imports:importsVal,netExports,
  reconciliation:{productionMinusIncome:discrepancyProductionIncome,productionMinusExpenditure:discrepancyProductionExpenditure,expenditureDiscrepancyPct:discrepancyPct,reconciled:Math.abs(discrepancyProductionIncome)<=0.01&&Math.abs(discrepancyProductionExpenditure)<=0.01,inventoryOpening,inventoryClosing,inventoryChange}
 };
}

function calculateFiscalReport(options={}){
 if(!options.rebuild&&S.lastFiscalReport&&S.monthNumber>0)return S.lastFiscalReport;
 const dre=S.lastDRE?.treasury||{};
 const tributary=round2((dre.salaryTax||0)+(dre.employerTax||0)+(dre.profitTax||0));
 const nonTributary=round2((dre.dividendsReceived||0)+(dre.concessionOutorga||0));
 const capital=round2(dre.assetSales||0);
 const primaryRev=round2(tributary+nonTributary);
 const personnel=round2(dre.personnelExpenditure||0);
 const social=round2((dre.socialHousing||0)+(dre.stateFarmSupport||0));
 const investment=round2(dre.publicWorks||0);
 const primaryExp=round2(personnel+social+investment);
 const primaryResult=round2(primaryRev-primaryExp);
 const interestPaid=round2(S.lastLoanSettlement?.byBorrower?.treasury?.interestPaid||0);
 const interestReceived=round2(dre.interestReceived||0);
 const netInterestExpense=round2(interestPaid-interestReceived);
 const nominalResult=round2(primaryResult-netInterestExpense);
 return{
  tributaryRevenue:tributary,
  nonTributaryRevenue:nonTributary,
  capitalRevenue:capital,
  primaryRevenue:primaryRev,
  primaryExpenditure:primaryExp,
  personnelExpenditure:personnel,
  socialExpenditure:social,
  investmentExpenditure:investment,
  primaryResult,
  interestPaid,
  interestReceived,
  netInterestExpense,
  nominalResult,
  primaryStatus:primaryResult>=0?"Superávit Primário":"Déficit Primário",
  solvencyStatus:nominalResult>=0?"Superávit Nominal":"Déficit Nominal"
 };
}
function updateUrbanInfrastructure(){
 const cap=S.infrastructureCapacity||20;
 const firmCount=getFirms().length;
 const demand=population()+firmCount*2;
 const congestionRatio=round2(demand/Math.max(1,cap));
 let tfpFactor=1.0;
 if(congestionRatio>1.0){
  tfpFactor=clamp(1.0-0.15*(congestionRatio-1.0),0.65,1.15);
 }else{
  tfpFactor=clamp(1.0+0.05*(1.0-congestionRatio),1.0,1.10);
 }
 tfpFactor=round2(tfpFactor);
 S.urbanInfra={
  demand,
  capacity:cap,
  congestionRatio,
  tfpFactor,
  stock:S.infrastructureStock||10000
 };
 return S.urbanInfra;
}
function investInInfrastructure(){
 if(balance("treasury")<6000){
  feed("Tesouro com recursos insuficientes para obras de infraestrutura urbana.");
  return 0;
 }
 const paidWs=log("treasury","workshop",3000,"Obra pública de infraestrutura: serviços e mão de obra");
 const paidExt=log("treasury","external",3000,"Obra pública de infraestrutura: máquinas e materiais pesados");
 if(S.currentMonthTracking){
  S.currentMonthTracking.publicWorks=(S.currentMonthTracking.publicWorks||0)+6000;
  S.currentMonthTracking.workshopRevenue=(S.currentMonthTracking.workshopRevenue||0)+3000;
 }
 S.infrastructureCapacity=(S.infrastructureCapacity||20)+4;
 S.infrastructureStock=(S.infrastructureStock||10000)+6000;
 updateUrbanInfrastructure();
 feed(`Obras de infraestrutura concluídas: capacidade elevada para ${S.infrastructureCapacity} e TFP restabelecido em ${(S.urbanInfra.tfpFactor*100).toFixed(0)}%.`);
 render();
 return 6000;
}
function processHarrisTodaroMigration(){
 const p=S.policy;
 const ls=getLaborStats();
 const activeLF=Math.max(1,ls.laborForce);
 const empProb=clamp(ls.occupied/activeLF,0.10,1.0);
 const costIndex=Math.max(0.5,(S.costOfLivingIndex||100)/100);
 const wLocalNet=S.wage*(1-p.incomeTax/100);
 const realWageLocal=round2(wLocalNet/costIndex);
 const wExtNet=S.externalWage*(1-p.incomeTax/100);
 const realWageExt=round2(wExtNet);
 const housingBenefit=(p.housing==="employer"||p.housing==="state")?150:(p.housing==="rented"?-300:0);
 const infraBonus=round2(((S.urbanInfra?.tfpFactor||1.0)-1.0)*100);
 const uLocal=round2(empProb*realWageLocal+housingBenefit+infraBonus);
 const uExt=round2(0.85*realWageExt-(p.migrationCost/12));
 const deltaU=round2(uLocal-uExt);
 S.lastHarrisTodaro={uLocal,uExt,deltaU,empProb:round2(empProb),realWageLocal,realWageExt,costIndex:round2(costIndex)};

 let emigrated=null,immigrated=null;
 if(deltaU<-100){
  const candidate=S.households.find(h=>{
   const people=Math.max(1,h.adults);
   const hLocalNet=(h.jobs*wLocalNet)/people+(housingBenefit/people);
   const hReal=hLocalNet/costIndex;
   return hReal<uExt*0.85&&h.cash>=p.migrationCost;
  });
  if(candidate&&rand()<0.40){
   const costPaid=log(accountKey(candidate),"external",p.migrationCost,"Custo único de emigração");
   if(costPaid+0.001>=p.migrationCost){
    const rem=balance(accountKey(candidate));
    if(rem>0)log(accountKey(candidate),"external",rem,"Transferência de saldo na emigração");
    S.migratedClaims.push({name:candidate.name,wageDebt:candidate.wageDebt,rentDebt:candidate.rentDebt,debtorAccount:farmAccount(),day:S.day});
    feed(`${candidate.name} emigrou (ΔU: ${deltaU}). Custos, saldo e créditos foram registrados.`);
    S.households.splice(S.households.indexOf(candidate),1);
    emigrated=candidate.name;
   }
  }
 }else if(deltaU>100&&population()<S.housingCapacity&&adults()<S.jobsAvailable){
  if(rand()<0.40){
   const fAcc=farmAccount();
   const payer=balance(fAcc)>=p.migrationCost?fAcc:(balance("treasury")>=p.migrationCost?"treasury":null);
   if(payer){
    const paid=log(payer,"external",p.migrationCost,"Custo único de instalação de novo trabalhador");
    if(paid+0.001>=p.migrationCost){
     const id=++S.migrantCount;
     const newH={id,name:"Migrante "+id,type:"single",adults:1,children:0,outOfLaborForce:0,jobs:0,sectorJobs:{farm:0,commerce:0,workshop:0},cash:0,deposit:0,wageDebt:0,wageDebtByFirm:{},rentDebt:0,happiness:55,cashIncome:0,housingBenefit:0,shortageUnits:0};
     S.households.push(newH);
     feed(`Novo trabalhador migrou atraído por altos salários reais locais (ΔU: +${deltaU}).`);
     immigrated=newH.name;
    }
   }
  }
 }
 return {uLocal,uExt,deltaU,emigrated,immigrated,realWageLocal,realWageExt};
}
function checkFirmEntryAndExit(force=false){
 const hasBakery=(S.firms||[]).some(f=>f.id==="bakery");
 const sustainedShortage=S.lastShortageUnits>0.2||S.commerceEmptyMonths>0;
 const highMarkup=S.baseMarkup>=0.30;
 if(force||(!hasBakery&&(sustainedShortage||(S.monthNumber>=3&&highMarkup)))){
  const entryCapital=10000;
  S.accounts["bakery"]=0;
  log("external","bakery",entryCapital,"Capitalização inicial de nova firma: Padaria e Empório");
  const newFirm=createFirm("bakery", "Padaria e Empório do Vilarejo", "retail", "bakery", {
   sectorLabel:"Comércio Alimentar Secundário",
   ownership:{treasury:0.0,private:1.0},
   operator:"private",
   governanceLabel:"Privada",
   contract:{type:"private_license",terms:"Alvará comercial para panificação e mantimentos"},
   capitalStock:entryCapital,
   depreciationRate:0.0025,
   baseCapacity:2,
   openVacancies:1,
   activeWorkers:1,
   offeredWage:S.policy.minimumWage,
   productivityFactor:S?.urbanInfra?.tfpFactor||1.0,
   inventory:{name:"Pães e mantimentos",unit:"unid",quantity:20,unitValue:80},
   status:"active"
  }, bakeryBehavior);
  if(!S.firms)S.firms=[];
  if(!S.firms.some(f=>f.id==="bakery"))S.firms.push(newFirm);
  S.baseMarkup=0.25;
  feed("Entrada de nova firma: Padaria e Empório aberta! Concorrência reduziu o markup base de 35% para 25%.");
  return true;
 }
 return false;
}
function liquidateInsolventFirm(firmId){
 const firm=getFirms().find(f=>f.id===firmId||f.account===firmId);
 if(!firm)return null;
 const acc=firm.account;
 const loans=S.bankLoans.filter(l=>l.borrower===acc);
 const mappedWageDebt=firmWageDebt(firm.id);
 const wageDebt=Math.max(mappedWageDebt,Number(firm.wageDebt)||0);
 let laborSettled=0;
 for(const h of S.households){
  if(balance(acc)<=0)break;
  if(!h.wageDebtByFirm||typeof h.wageDebtByFirm!=="object")h.wageDebtByFirm={};
  const claim=Math.max(0,Number(h.wageDebtByFirm[firm.id])||0);
  if(claim<=0)continue;
  const paid=log(acc,accountKey(h),Math.min(claim,balance(acc)),"Liquidação concursal: crédito trabalhista privilegiado");
  h.wageDebtByFirm[firm.id]=round2(claim-paid);
  h.wageDebt=Math.max(0,round2((h.wageDebt||0)-paid));
  laborSettled=round2(laborSettled+paid);
 }
 // Legacy, untagged claims can only safely be attributed to the historical farm employer.
 if(firm.id==="farm"){
  for(const h of S.households){
   if(balance(acc)<=0)break;
   const mapped=Object.values(h.wageDebtByFirm||{}).reduce((n,v)=>n+Math.max(0,Number(v)||0),0);
   const legacy=Math.max(0,(Number(h.wageDebt)||0)-mapped);
   if(legacy<=0)continue;
   const paid=log(acc,accountKey(h),Math.min(legacy,balance(acc)),"Liquidação concursal: crédito trabalhista legado");
   h.wageDebt=Math.max(0,round2(h.wageDebt-paid));laborSettled=round2(laborSettled+paid);
  }
 }
 for(const claim of S.migratedClaims){
  if(balance(acc)<=0)break;
  if(claim.debtorAccount!==acc||claim.firmId&&claim.firmId!==firm.id||claim.wageDebt<=0)continue;
  const paid=log(acc,"external",Math.min(claim.wageDebt,balance(acc)),"Liquidação concursal: crédito trabalhista de ex-morador");
  claim.wageDebt=round2(claim.wageDebt-paid);laborSettled=round2(laborSettled+paid);
 }
 const taxDebt=round2(firm.taxDebt||((firm.employerTaxDebt||0)+firmProfitTaxDebt(firm)));
 let taxSettled=0;
 if(taxDebt>0&&balance(acc)>0){
  taxSettled=log(acc,"treasury",Math.min(balance(acc),taxDebt),"Liquidação concursal: crédito fiscal prioritário");
  let remaining=taxSettled;
  const employerPaid=Math.min(remaining,Number(firm.employerTaxDebt)||0);
  firm.employerTaxDebt=round2(Math.max(0,(firm.employerTaxDebt||0)-employerPaid));remaining-=employerPaid;
  if(remaining>0)setFirmProfitTaxDebt(firm,Math.max(0,firmProfitTaxDebt(firm)-remaining));
  firm.taxDebt=round2((firm.employerTaxDebt||0)+firmProfitTaxDebt(firm));
 }
 let bankSettled=0,loanWrittenOff=0;
 for(const loan of loans){
  migrateLoan(loan);
  const total=round2(loan.principal+loan.principalArrears+loan.interestArrears);
  const paid=balance(acc)>0?log(acc,"bank",Math.min(balance(acc),total),"Liquidação concursal: amortização bancária"):0;
  bankSettled=round2(bankSettled+paid);
  let remaining=paid;
  const interest=Math.min(remaining,loan.interestArrears);loan.interestArrears=round2(loan.interestArrears-interest);remaining-=interest;
  const arrears=Math.min(remaining,loan.principalArrears);loan.principalArrears=round2(loan.principalArrears-arrears);remaining-=arrears;
  const principal=Math.min(remaining,loan.principal);loan.principal=round2(loan.principal-principal);
  const unpaid=round2(loan.principal+loan.principalArrears+loan.interestArrears);
  if(unpaid>0){loanWrittenOff=round2(loanWrittenOff+unpaid);loan.principal=0;loan.principalArrears=0;loan.interestArrears=0;}
 }
 S.bankLoans=S.bankLoans.filter(l=>l.principal>0.005||l.principalArrears>0.005||l.interestArrears>0.005);
 if(loanWrittenOff>0){
  S.lastBankCreditLosses=round2((S.lastBankCreditLosses||0)+loanWrittenOff);
  S.cumulativeBankWriteDowns=round2((S.cumulativeBankWriteDowns||0)+loanWrittenOff);
  S.cumulativeDebtorRelief=round2((S.cumulativeDebtorRelief||0)+loanWrittenOff);
 }
 let equityResidue=0;
 if(balance(acc)>0){
  if(firm.operator==="state"||firm.ownership?.treasury>=0.99)equityResidue=log(acc,"treasury",balance(acc),"Liquidação concursal: resíduo patrimonial estatal");
  else{
   const perHousehold=round2(balance(acc)/Math.max(1,S.households.length));
   for(const h of S.households){if(balance(acc)<=0)break;equityResidue=round2(equityResidue+log(acc,accountKey(h),Math.min(balance(acc),perHousehold),"Liquidação concursal: resíduo patrimonial aos sócios"));}
   if(balance(acc)>0)equityResidue=round2(equityResidue+log(acc,"external",balance(acc),"Liquidação concursal: resíduo patrimonial investidor externo"));
  }
 }
 firm.status="liquidated";
 S.firms=(S.firms||[]).filter(f=>f.id!==firm.id);
 syncGlobalEmployerTaxDebt();
 feed(`Liquidação concursal de ${firm.name}: trabalhista ${money(laborSettled)}, fiscal ${money(taxSettled)}, bancário ${money(bankSettled)}, baixa ${money(loanWrittenOff)}.`);
 render();
 return{firmId:firm.id,wageDebt,laborSettled,taxSettled,bankSettled,loanWrittenOff,equityResidue,cashConservation:auditCashConservation().ok};
}

function writeDownLoansForBorrower(borrower,fraction){
 const f=clamp(Number(fraction)||0,0,1);
 if(!borrower||f<=0)return 0;
 let totalWrittenOff=0;
 for(const loan of S.bankLoans){
  if(loan.borrower!==borrower)continue;
  migrateLoan(loan);
  const pOff=round2(loan.principal*f),paOff=round2(loan.principalArrears*f),iaOff=round2(loan.interestArrears*f);
  const loss=round2(pOff+paOff+iaOff);
  loan.principal=round2(loan.principal-pOff);
  loan.principalArrears=round2(loan.principalArrears-paOff);
  loan.interestArrears=round2(loan.interestArrears-iaOff);
  totalWrittenOff=round2(totalWrittenOff+loss);
 }
 S.bankLoans=S.bankLoans.filter(l=>l.principal>0.005||l.principalArrears>0.005||l.interestArrears>0.005);
 S.lastBankCreditLosses=round2((S.lastBankCreditLosses||0)+totalWrittenOff);
 S.cumulativeBankWriteDowns=round2((S.cumulativeBankWriteDowns||0)+totalWrittenOff);
 S.cumulativeDebtorRelief=round2((S.cumulativeDebtorRelief||0)+totalWrittenOff);
 if(totalWrittenOff>0)feed(`Baixa contábil de crédito: ${borrower} reconheceu perda bancária de ${money(totalWrittenOff)} (${(f*100).toFixed(0)}% de deságio).`);
 return totalWrittenOff;
}
function commerceLoanWriteDown(fraction){return writeDownLoansForBorrower("commerce",fraction)}

function resolveCommerceFailure(choice){if(choice==="state"){const paid=log("treasury","commerce",10000,"Socorro estatal para recomposição do capital de giro");if(paid<9999){feed("Tesouro sem recursos suficientes para o socorro integral.");return false}feed("Tesouro recapitalizou o comércio em R$ 10.000.")}else{log("external","commerce",10000,"Entrada de novo comerciante e capitalização");commerceLoanWriteDown(0.5);S.commerceMarkupExtra=0.10;S.commerceMarkupMonths=6;feed("Novo comerciante assumiu o ponto, recebeu deságio de 50% na dívida bancária e elevou o markup em 10 p.p. por seis meses.")}S.commerceEmptyMonths=0;S.marketFundingFailure=false;S.event=null;render();return true}
const EVENT_CHOICE_LABELS={absorver:"Absorver o impacto",irrigar:"Investir em irrigação",proteger_lavoura:"Proteger a lavoura",controle_biologico:"Adotar controle biológico",estocar:"Formar estoque",recusar:"Recusar proposta",aceitar:"Aceitar proposta",renegociar:"Renegociar",aumentar_salario:"Aumentar salários",deixar_ir:"Deixar seguir",contraoferta:"Fazer contraoferta",igualar_salario:"Igualar a oferta salarial",tratar:"Tratar os trabalhadores",reparar:"Reparar a estrada",pagar:"Pagar a taxa",contestar:"Contestar a taxa",protocolos_sanitarios:"Adotar protocolos sanitários",fornecer_ao_governo:"Fornecer ao governo",renegociar_dividas:"Renegociar dívidas",neutralidade:"Manter neutralidade",apoiar_novo_governo:"Apoiar o novo governo",drenagem_emergencial:"Executar drenagem emergencial",contratar_diaristas:"Contratar diaristas",renegociar_fornecedores:"Renegociar com fornecedores",aceitar_contrato:"Aceitar contrato",entrar:"Entrar na cooperativa",ignorar:"Não patrocinar",patrocinar:"Patrocinar a festa",deixar_por_conta:"Não intervir",acolher:"Acolher migrantes",acordo_amigavel:"Buscar acordo amigável",ir_a_justica:"Levar à Justiça",contratar_vigia:"Contratar vigilância",pagar_multa:"Pagar a multa",regularizar_salarios:"Regularizar salários",aderir:"Aderir ao programa"};
const EVENT_CATEGORY_LABELS={clima:"clima",mercado:"mercado",social:"social",infra:"infraestrutura",governo:"governo",global:"cenário internacional"};
const EVENT_SEVERITY_LABELS={leve:"leve",media:"moderada",grave:"grave"};
function syncEventEngine(){
 const engine=window.EventosV3;
 if(!engine||!S.eventEngine)return null;
 return engine.sincronizarComVilarejo(S,S.eventEngine,{balance,approval,employed,log});
}
function resolveEventChoice(eventId,choiceId){
 const engine=window.EventosV3,state=S.eventEngine;
 if(!engine||!state)return false;
 syncEventEngine();
 const accepted=engine.responder(state,eventId,choiceId);
 if(!accepted){feed("Decisão não executada: caixa insuficiente ou evento já resolvido.");return false}
 engine.aplicarNoVilarejo(S,state);
 const def=engine.EVENTOS.find(item=>item.id===eventId);
 const choice=def?.escolhas?.find(item=>item.id===choiceId);
 feed(`Decisão: ${EVENT_CHOICE_LABELS[choiceId]||choiceId} · ${def?.caixa||eventId}${choice?.custo?` · custo ${money(choice.custo)}`:""}.`);
 S.event=null;
 return true;
}
function syncPendingEventPrompt(){
 if(S.event||S.gameOver||!S.eventEngine||!window.EventosV3)return;
 const engine=window.EventosV3,state=S.eventEngine;
 const active=state.ativos.find(item=>!item.respondido);
 if(!active)return;
 const def=engine.EVENTOS.find(item=>item.id===active.id);
 if(!def)return;
 const choices=Array.isArray(def.escolhas)?def.escolhas:[];
 if(!choices.length){
  active.respondido=true;
  feed(`Evento automático: ${def.caixa}. Efeito aplicado por ${active.mesesRestantes} mês(es).`);
  return syncPendingEventPrompt();
 }
 const category=EVENT_CATEGORY_LABELS[def.categoria]||def.categoria||"geral";
 const severity=EVENT_SEVERITY_LABELS[active.sev]||active.sev||"moderada";
 syncEventEngine();
 S.event={
  engineEventId:active.id,
  title:def.caixa,
  text:`Evento de ${category}, intensidade ${severity}. Os efeitos já estão ativos. Escolha como a fazenda deve responder.`,
  options:choices.map(choice=>({
   label:`${EVENT_CHOICE_LABELS[choice.id]||choice.id}${choice.custo?` (${money(choice.custo)})`:""}`,
   disabled:(Number(choice.custo)||0)>balance(farmAccount()),
   run:()=>resolveEventChoice(active.id,choice.id)
  }))
 };
}
function processMonthlyEvents(){
 const engine=window.EventosV3;
 if(!engine||!S.eventEngine)return;
 syncEventEngine();
 engine.processarMes(S.eventEngine,2,{calcularEconomia:false});
 engine.aplicarNoVilarejo(S,S.eventEngine);
 const recent=S.eventEngine.log.slice(-3);
 for(const line of recent){if(!S._eventLogSeen?.includes(line)){feed(line.replace(/^Mês \d+[: ·]\s*/,""));S._eventLogSeen=[...(S._eventLogSeen||[]),line].slice(-30)}}
 syncPendingEventPrompt();
}

function updateCommerceInsolvency(){
 const distressed=S.marketStock<0.1&&!!S.marketFundingFailure&&S.lastShortageUnits>0.1&&balance("commerce")<1000;
 S.commerceEmptyMonths=distressed?(S.commerceEmptyMonths||0)+1:0;
 if(S.commerceEmptyMonths>=2&&!S.event&&!S.gameOver){
  S.event={title:"Falência do comércio local",text:"O comércio ficou sem estoque por dois meses consecutivos e não conseguiu financiar novas importações. Escolha uma solução para restabelecer o abastecimento.",options:[{label:"Socorro estatal: injetar R$ 10.000",run:()=>resolveCommerceFailure("state")},{label:"Novo comerciante: capital externo de R$ 10.000 e reestruturação da dívida",run:()=>resolveCommerceFailure("private")}]};
  feed("Crise institucional: comércio insolvente por dois meses consecutivos.");
  S.lastBalanceSheet=generateBalanceSheets();
 }
 return {distressed,emptyMonths:S.commerceEmptyMonths,event:S.event?.title||null};
}
function closeMonth(){
 const p=S.policy;Object.assign(p,S.pending);S.pending={};
 S.usdCoffee=clamp(S.usdCoffee*(1+(rand()-.5)*.12+.04*(300-S.usdCoffee)/300),150,600);
 if(p.fxMode==="fixed")S.fx=5;
 else{const shock=(rand()-.5)*.08,meanReversion=.08*(5-S.fx)/5,rateEffect=-.008*(p.baseRate-1.5);S.fx=clamp(S.fx*(1+shock+meanReversion+rateEffect),3.5,7.5)}
 S.externalWage*=1+(rand()-.5)*.04;

 // 1. Ciclo de Planejamento Operacional e Mercado Coletivo de Trabalho
 runFirmPlanningPhase({ day: S.day, month: S.monthNumber, policy: p });
 matchCollectiveLaborMarket();

 const stateSupport=supportStateFarm();
 if(stateSupport>0)feed("Tesouro transferiu "+money(stateSupport)+" para a fazenda estatal.");

 // 2. Liquidação Salarial Centralizada
 const wage=settleAllFirmWages();
 housing();
 updateMarketPrice();

 // 3. Comercialização e Consumo
 marketConsumption();

 // 4. Liquidação Bancária, Apuração de Resultados e Tributos
 settleBankLoans();
 payDepositInterest();
 const settlementCtx={ policy: p, monthNumber: S.monthNumber };
 runFirmSettlementPhase(settlementCtx);
 distributeFirmDividends();
 settleConcessionOutorga();
 updateApproval();

 const lsNow=getLaborStats();
 S.unemploymentHistory=(S.unemploymentHistory||[]).concat([lsNow.unemploymentRate]).slice(-12);
 if(balance("landlord")>=200){const paid=log("landlord","workshop",200,"Manutenção urbana e predial");if(S.currentMonthTracking){S.currentMonthTracking.workshopRevenue=(S.currentMonthTracking.workshopRevenue||0)+paid;S.currentMonthTracking.landlordMaintenanceCosts=(S.currentMonthTracking.landlordMaintenanceCosts||0)+paid;}}
 if(balance("workshop")>=100){const paid=log("workshop","commerce",100,"Peças e insumos do comércio local");if(S.currentMonthTracking){S.currentMonthTracking.workshopCosts=(S.currentMonthTracking.workshopCosts||0)+paid;S.currentMonthTracking.commerceB2BSales=(S.currentMonthTracking.commerceB2BSales||0)+paid;}}
 const tr=S.currentMonthTracking||{};
 S.lastWage=wage;
 const bankStats=getBankPortfolioStats();
 const farmValObj=calculateFirmValuation("farm");
 const firmRecords={};
 let totalProfitTaxPaid=0;
 for(const firm of (S.firms||[])){
  const payroll=firm.payroll||{wagesDue:0,wagesPaid:0,employerTaxDue:0,employerTaxPaid:0,incomeTaxPaid:0,workers:0};
  let revenue=Number(firm.revenue)||0;
  let intermediateInputs=Number(firm.intermediateInputs)||0;
  if(firm.id==="farm"){
   revenue=round2(tr.farmRevenue||0);
   intermediateInputs=round2((tr.farmInputs||0)+(tr.farmHousing||0));
  }else if(firm.id==="commerce"){
   revenue=round2((firm.lastSales||0)+(tr.commerceB2BSales||0));
   intermediateInputs=round2(tr.commerceImports||0);
  }else if(firm.id==="workshop"){
   revenue=round2((tr.workshopRevenue||0)+(firm.lastServiceRevenue||0));
   intermediateInputs=round2(tr.workshopCosts||0);
  }else if(firm.id==="bakery"){
   revenue=round2(tr.bakerySales||firm.revenue||0);
  }
  const depreciation=round2(firm.depreciation||0);
  const interestPaid=round2(firm.interestPaid||0);
  const profitTax=round2(firm.profitTaxPaid||firm.taxPaid||0);
  totalProfitTaxPaid=round2(totalProfitTaxPaid+profitTax);
  firmRecords[firm.id]={
   firmId:firm.id,name:firm.name,sector:firm.sector,revenue,intermediateInputs,
   payroll:{...payroll},depreciation,interestPaid,profitBeforeTax:round2(firm.profitBeforeTax||0),
   profitTax,netProfit:round2(firm.profit||0),operatingProfit:round2(firm.profitBeforeTax||0)
  };
 }
 const bankAccrued=S.bankAccruedInterest||0,bankInterestInc=S.bankInterestIncome||0,bankDepInt=S.lastDepositInterest||0,bankLosses=S.lastBankCreditLosses||0;
 const farmRec=firmRecords.farm||{};
 const commerceRec=firmRecords.commerce||{};
 const workshopRec=firmRecords.workshop||{};
 const bankRecord={accruedInterest:bankAccrued,interestIncome:bankInterestInc,interestReceivable:bankStats.interestArrears,depositInterestPaid:bankDepInt,creditLosses:bankLosses,netInterestSpread:round2(bankInterestInc-bankDepInt),netProfit:round2(bankInterestInc-bankDepInt-bankLosses),defaultRate:bankStats.defaultRate};
 const employerTaxPaid=round2(wage.employerCharge||0);
 const treasuryRecord={salaryTax:round2(tr.wageSalaryTax||0),employerTax:employerTaxPaid,profitTax:totalProfitTaxPaid,dividendsReceived:round2(tr.dividendsReceived||0),concessionOutorga:round2(tr.concessionOutorga||0),totalTaxRevenue:round2((tr.wageSalaryTax||0)+employerTaxPaid+totalProfitTaxPaid),assetSales:round2(tr.assetSales||0),socialHousing:round2(tr.socialHousing||0),publicWorks:round2(tr.publicWorks||0),stateFarmSupport:round2(tr.stateSupport||0),personnelExpenditure:0,interestReceived:0};
 treasuryRecord.primaryResult=round2(treasuryRecord.totalTaxRevenue+treasuryRecord.dividendsReceived+treasuryRecord.concessionOutorga-treasuryRecord.socialHousing-treasuryRecord.publicWorks-treasuryRecord.stateFarmSupport);
 S.lastDRE={
  farm:{...farmRec,inputs:round2(tr.farmInputs||0),wagesDue:Number(farmRec.payroll?.wagesDue)||0,employerTax:Number(farmRec.payroll?.employerTaxPaid)||0,housing:round2(tr.farmHousing||0),insurance:round2(tr.farmInsurance||0),dividendsPaid:S.lastDividends?.total||0,valuation:farmValObj.valuation},
  commerce:{...commerceRec,sales:commerceRec.revenue||0,importCosts:round2(tr.commerceImports||0),grossMargin:commerceRec.ebitda||0},
  workshop:{...workshopRec,costs:round2(tr.workshopCosts||0),grossMargin:workshopRec.ebitda||0},
  landlord:{revenue:round2(tr.housingServices||0),intermediateInputs:round2(tr.landlordMaintenanceCosts||0),netProfit:round2((tr.housingServices||0)-(tr.landlordMaintenanceCosts||0))},
  bank:bankRecord,treasury:treasuryRecord,firms:firmRecords
 };

 S.lastBankCreditLosses=0;
 S.firms=getFirms();
 S.lastNationalAccounts=calculateNationalAccounts({rebuild:true});
 S.lastFiscalReport=calculateFiscalReport({rebuild:true});
 S.currentMonthTracking={farmRevenue:0,farmInputs:0,farmHousing:0,farmInsurance:0,wageSalaryTax:0,assetSales:0,socialHousing:0,publicWorks:0,stateSupport:0,commerceImports:0,commerceB2BSales:0,workshopRevenue:0,workshopCosts:0,landlordMaintenanceCosts:0,housingServices:0,householdHousing:0,dividendsReceived:0,concessionOutorga:0,importedCapitalGoods:0,privateFixedInvestment:0,bakerySales:0,inventoryOpeningValue:0};
 S.currentMonthTracking.inventoryOpeningValue=inventoryValue();
 updateUrbanInfrastructure();
 processHarrisTodaroMigration();
 checkFirmEntryAndExit();
 if(S.farmInvestmentCooldown>0)S.farmInvestmentCooldown--;if(S.landlordInvestmentCooldown>0)S.landlordInvestmentCooldown--;autoInvestAtLowRates();depositHouseholdSavings();if(S.commerceMarkupMonths>0){S.commerceMarkupMonths--;if(S.commerceMarkupMonths===0)S.commerceMarkupExtra=0}
 S.lastWage=wage;
 S.lastFlow={...S.monthFlow};S.monthFlow={in:0,internal:0,out:0};S.monthNumber++;
 processMonthlyEvents();
 const debt=totalWageDebt();
 if(debt>0&&debt>=Math.max(1,S.wage*Math.max(1,employed())*3))S.gameOver=S.owner==="state"?"Colapso fiscal: a fazenda estatal acumulou três folhas mensais de salários atrasados.":"Falência da fazenda privada: salários atrasados atingiram três folhas mensais.";
 if(approval()<15)S.gameOver="Revolta: aprovação popular abaixo de 15.";
 if(!S.households.length)S.gameOver="O vilarejo ficou vazio.";
 updateCommerceInsolvency();
 publishEconomyMonthClosed();
}
function newGame(){S={seed:42,day:149,monthNumber:0,loanSeq:0,accounts:{treasury:0,stateFarm:0,privateFarm:0,commerce:0,workshop:0,landlord:0,bank:0},households:[{id:1,name:"Família Silva",type:"family",adults:2,children:2,outOfLaborForce:0,jobs:0,sectorJobs:{farm:0,commerce:0,workshop:0},cash:0,deposit:0,wageDebt:0,wageDebtByFirm:{},rentDebt:0,happiness:55,cashIncome:0,housingBenefit:0,shortageUnits:0},{id:2,name:"Família Rocha",type:"family",adults:2,children:2,outOfLaborForce:0,jobs:0,sectorJobs:{farm:0,commerce:0,workshop:0},cash:0,deposit:0,wageDebt:0,wageDebtByFirm:{},rentDebt:0,happiness:55,cashIncome:0,housingBenefit:0,shortageUnits:0},{id:3,name:"Ana",type:"single",adults:1,children:0,outOfLaborForce:0,jobs:0,sectorJobs:{farm:0,commerce:0,workshop:0},cash:0,deposit:0,wageDebt:0,wageDebtByFirm:{},rentDebt:0,happiness:55,cashIncome:0,housingBenefit:0,shortageUnits:0},{id:4,name:"Caio",type:"single",adults:1,children:0,outOfLaborForce:0,jobs:0,sectorJobs:{farm:0,commerce:0,workshop:0},cash:0,deposit:0,wageDebt:0,wageDebtByFirm:{},rentDebt:0,happiness:55,cashIncome:0,housingBenefit:0,shortageUnits:0}],owner:"state",farmOwnership:{treasury:1.0,private:0.0},concessionActive:false,lastDividends:{treasury:0,private:0,total:0},lastProjectNPV:null,lastNationalAccounts:null,lastFiscalReport:null,lots:10,baseJobsAvailable:8,jobsAvailable:8,sectorVacancies:{farm:8,commerce:1,workshop:1},totalJobsAvailable:10,housingCapacity:12,infrastructureCapacity:20,infrastructureStock:10000,urbanInfra:null,lastHarrisTodaro:null,baseMarkup:0.35,buildings:[],coffeeStock:0,productionThisSeason:0,coffeeSold:0,usdCoffee:300,fx:5,externalWage:2200,wage:1800,commerceWage:1710,workshopWage:1836,reservation:1540,weatherFactor:1,weatherEventDone:false,weatherDecisionDone:false,weatherProtection:false,marketStock:0,marketPrice:USD_IMPORT*5*(1+BASE_MARKUP),servicePrice:180,costOfLivingIndex:100,monthlyInflation:0,marketPressure:1,marketTargetPrice:USD_IMPORT*5*(1+BASE_MARKUP),lastShortage:0,lastShortageUnits:0,lastFoodConsumption:0,lastServiceConsumption:0,lastConsumption:0,lastDemandUnits:0,lastUnmetHouseholds:0,marketFundingFailure:false,importedUnits:0,commerceEmptyMonths:0,commerceMarkupExtra:0,commerceMarkupMonths:0,bankLoans:[],bankInterestIncome:0,bankAccruedInterest:0,lastDepositInterest:0,effectiveDepositRate:0,lastBankCreditLosses:0,cumulativeBankWriteDowns:0,cumulativeDebtorRelief:0,lastLoanSettlement:{byBorrower:{},totalInterestPaid:0,totalPrincipalPaid:0,totalAccruedInterest:0},farmInvestmentCooldown:0,landlordInvestmentCooldown:0,farmWageDebt:0,migratedClaims:[],assumedLiabilities:null,nextPayrollEstimate:0,cumulativeExternalIn:0,cumulativeExternalOut:0,cashAudit:null,lastDRE:null,workshopMaterials:5,workshopTaxDebt:0,commerceTaxDebt:0,unemploymentHistory:[0],currentMonthTracking:{farmRevenue:0,farmInputs:0,farmHousing:0,farmInsurance:0,wageSalaryTax:0,assetSales:0,socialHousing:0,publicWorks:0,stateSupport:0,commerceImports:0,commerceB2BSales:0,workshopRevenue:0,workshopCosts:0,landlordMaintenanceCosts:0,housingServices:0,householdHousing:0,dividendsReceived:0,concessionOutorga:0,importedCapitalGoods:0,privateFixedInvestment:0,bakerySales:0,inventoryOpeningValue:0},employerTaxDebt:0,farmTaxDebt:0,monthFarmRevenue:0,monthFarmCosts:0,lastFarmEBITDA:0,lastFarmDepreciation:0,lastFarmInterestPaid:0,lastFarmProfit:0,lastProfitTax:0,migrantCount:0,policy:{publicWage:1800,minimumWage:1500,incomeTax:10,employerTax:15,profitTax:20,dividendPayoutRatio:50,migrationCost:3000,monthlyStateSupport:25000,housing:"employer",fxMode:"floating",basketCost:220,baseRate:1.5},pending:{},monthFlow:{in:0,internal:0,out:0},lastFlow:{in:0,internal:0,out:0},lastWage:{due:0,paid:0,employerCharge:0},ledger:[],feed:[],event:null,gameOver:null};S.externalSector={id:"external",name:"Setor Externo",account:"external",sector:"external",patrimony:{assets:0,liabilities:0,netWorth:0},flow:{revenue:0,costs:0,netProfit:0}};
 S.firms=[];
 Object.defineProperty(S, "extraFirms", {
  get() { return (S.firms||[]).filter(f => f.id !== "farm" && f.id !== "commerce" && f.id !== "workshop"); },
  set(val) {
   if(Array.isArray(val)) {
    for(const ef of val){
     if(!S.firms.some(f=>f.id===ef.id)) S.firms.push(ef);
    }
   }
  },
  configurable: true,
  enumerable: true
 });
 log("external","stateFarm",50000,"Capitalização inicial e capital de giro da fazenda estatal");log("external","commerce",20000,"Capital de giro inicial do comércio");log("external","workshop",10000,"Capital de giro inicial da oficina de obras e serviços");initFirms();if(window.EventosV3){S.eventEngine=window.EventosV3.novoEstado({semente:S.seed,modoIntegrado:true});S.eventMods={producao:1,preco:1,custo:1};S._eventLogSeen=[];}S.currentMonthTracking.inventoryOpeningValue=inventoryValue();salaryCalc();updateEmploymentCapacity();matchLaborMarket();updateUrbanInfrastructure();syncFirmState();auditCashConservation();if(CORE_RUNTIME){CORE_RUNTIME.session.reset({day:S.day});syncCoreFromEconomy("new-game");CORE_RUNTIME.publish("game:initialized",{day:S.day,population:CORE_RUNTIME.population.getSnapshot().totals},"economia")}render()}
const controls=[["publicWage","Salário público (R$/mês)",1000,4000,100,v=>money(v)],["minimumWage","Salário mínimo legal",1000,3500,100,v=>money(v)],["incomeTax","Imposto sobre salário",0,30,1,v=>v+"%"],["employerTax","Encargo patronal",0,40,1,v=>v+"%"],["profitTax","Imposto sobre lucro",0,50,1,v=>v+"%"],["dividendPayoutRatio","Taxa de dividendos societários",20,80,5,v=>v+"%"],["migrationCost","Custo único de migração (R$)",0,6000,250,v=>money(v)],["monthlyStateSupport","Teto mensal para capital de giro da fazenda estatal",0,30000,1000,v=>money(v)],["basketCost","Cesta básica de referência por adulto",100,500,10,v=>money(v)],["baseRate","Juros básicos mensais",0.5,3,0.25,v=>v.toFixed(2)+"% a.m."]];
function setPolicy(k,v,format){S.pending[k]=v;feed("Política "+k+" alterada para "+format(v)+"; vigência no próximo mês.")}
function renderPolicies(){if(!policiesBuilt){$("policies").innerHTML=controls.map(([k,label,min,max,step,fmt])=>`<div class="policy"><label for="p_${k}">${label}</label><output id="o_${k}">${fmt(S.policy[k])}</output><input type="range" id="p_${k}" min="${min}" max="${max}" step="${step}" value="${S.pending[k]??S.policy[k]}"></div>`).join("")+`<div class="policy"><label for="p_housing">Política de moradia</label><span></span><select id="p_housing"><option value="employer">Fornecida pelo empregador</option><option value="rented">Alugada</option><option value="state">Fornecida pelo Estado</option><option value="none">Sem subsídio</option></select></div><div class="policy"><label for="p_fxMode">Regime cambial</label><span></span><select id="p_fxMode"><option value="floating">Flutuante</option><option value="fixed">Fixo</option></select></div>`;controls.forEach(([k,,,,,fmt])=>{const el=$("p_"+k);el.oninput=()=>$("o_"+k).textContent=fmt(+el.value);el.onchange=()=>setPolicy(k,+el.value,fmt)});["housing","fxMode"].forEach(k=>{$("p_"+k).onchange=()=>setPolicy(k,$("p_"+k).value,v=>v)});policiesBuilt=true}controls.forEach(([k,,,,,fmt])=>{const el=$("p_"+k);if(document.activeElement!==el){el.value=S.pending[k]??S.policy[k];$("o_"+k).textContent=fmt(+el.value)}});["housing","fxMode"].forEach(k=>{const el=$("p_"+k);if(document.activeElement!==el)el.value=S.pending[k]??S.policy[k]})}
function actions(){
 const fVal=calculateFirmValuation("farm");
 const gStake=S.farmOwnership.treasury;
 let equityBtns="";
 if(gStake>0.005){
  const price25=round2(fVal.valuation*Math.min(0.25,gStake));
  const fullPrice=round2(fVal.valuation*gStake);
  if(gStake>0.25){
   equityBtns+=`<button id="sell25Stake">Alienar 25% da Fazenda (+${money(price25)})</button>`;
  }
  equityBtns+=`<button id="privatizeValuation">Privatizar ${(gStake*100).toFixed(0)}% restante (+${money(fullPrice)})</button>`;
 }else{
  equityBtns+=`<button id="reacquireStake" disabled>Fazenda 100% privada</button>`;
 }
 const concessionBtn=S.concessionActive
  ?`<button id="toggleConcession">Encerrar concessão urbana</button>`
  :`<button id="toggleConcession">Conceder serviços urbanos (+R$ 400/mês outorga)</button>`;
 $("actions").innerHTML=`<button id="sellLot">Vender lote (+R$ 8.000)</button><button id="build">Construir moradia (R$ 6.000)</button><button id="investCredit">Investir com crédito (R$ 14.000)</button><button id="investInfra">Infraestrutura urbana (R$ 6.000)</button>${equityBtns}${concessionBtn}`;
 $("sellLot").onclick=()=>{if(S.lots<=0)return;S.lots--;log("external","treasury",8000,"Venda de terreno público");if(S.currentMonthTracking)S.currentMonthTracking.assetSales+=8000;feed("Lote público vendido por R$ 8.000.");render()};
 $("build").onclick=()=>{if(S.lots<=0){feed("Não há terrenos disponíveis para construir.");render();return}if(balance("treasury")<6000){feed("Tesouro sem recursos para iniciar a obra.");render();return}log("treasury","workshop",3000,"Obra pública: serviços e mão de obra locais");log("treasury","external",3000,"Obra pública: materiais importados");if(S.currentMonthTracking){S.currentMonthTracking.publicWorks+=6000;S.currentMonthTracking.importedCapitalGoods=(S.currentMonthTracking.importedCapitalGoods||0)+3000;S.currentMonthTracking.workshopRevenue=(S.currentMonthTracking.workshopRevenue||0)+3000;}S.lots--;S.buildings.push(S.day+30);feed("Obra iniciada; metade do custo circula na oficina de serviços local. Conclusão no dia "+(S.day+30)+".");render()};
 $("investCredit").onclick=()=>{if(S.lots<=0){feed("Não há terrenos disponíveis para investimento.");render();return}const loan=issueLoan("landlord",14000,"aquisição de terreno e construção de moradia");if(loan<13999){feed("Crédito insuficiente: o banco preserva a reserva mínima dos depositantes.");render();return}log("landlord","treasury",8000,"Compra de terreno para empreendimento imobiliário");log("landlord","workshop",3000,"Obra privada: serviços e mão de obra locais");if(S.currentMonthTracking){S.currentMonthTracking.workshopRevenue=(S.currentMonthTracking.workshopRevenue||0)+3000;S.currentMonthTracking.privateFixedInvestment=(S.currentMonthTracking.privateFixedInvestment||0)+6000;S.currentMonthTracking.importedCapitalGoods=(S.currentMonthTracking.importedCapitalGoods||0)+3000;}log("landlord","external",3000,"Obra privada: materiais importados");S.lots--;S.buildings.push(S.day+30);feed("Investimento imobiliário financiado; obra injeta serviços na oficina local.");render()};
 if($("investInfra"))$("investInfra").onclick=()=>investInInfrastructure();
 if($("sell25Stake"))$("sell25Stake").onclick=()=>sellFarmStake(0.25);
 if($("privatizeValuation"))$("privatizeValuation").onclick=()=>sellFarmStake(S.farmOwnership.treasury);
 if($("toggleConcession"))$("toggleConcession").onclick=()=>{
  S.concessionActive=!S.concessionActive;
  feed(S.concessionActive?"Contrato de concessão firmado: concessionária assume a operação e recolhe outorga mensal ao Tesouro.":"Contrato de concessão encerrado.");
  render();
 };
}
function sparklineSVG(values,color="var(--gold)"){
 if(!values||values.length<2)return "";
 const lo=Math.min(...values),hi=Math.max(...values),span=Math.max(1,hi-lo),w=72,h=26;
 const pts=values.map((v,i)=>`${i/(values.length-1)*w},${h-3-(v-lo)/span*(h-7)}`).join(" ");
 return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8"/><circle cx="${w}" cy="${h-3-(values.at(-1)-lo)/span*(h-7)}" r="2.3" fill="${color}"/></svg>`;
}
function generateBalanceSheets(){
 syncFirmState();
 const hWageClaims=totalWageDebt(),hRentDebt=totalRentDebt();
 const hCash=S.households.reduce((n,h)=>n+h.cash,0),hDeposits=totalDeposits();
 const hLoans=S.bankLoans.filter(l=>l.borrower.startsWith("house:")).reduce((n,l)=>n+l.principal+l.principalArrears+l.interestArrears,0);
 const hAssets=round2(hCash+hDeposits+hWageClaims);
 const hLiabilities=round2(hRentDebt+hLoans);
 const hNetWorth=round2(hAssets-hLiabilities);

 const fCash=Object.keys(S.accounts).filter(k=>k!=="treasury"&&k!=="bank"&&k!=="external").reduce((sum,k)=>sum+balance(k),0);
 const fInventoryVal=round2(S.firms.reduce((sum,f)=>sum+((f.inventory?.quantity||0)*(f.inventory?.unitValue||0)),0));
 const fProductiveCapital=round2(S.firms.reduce((sum,f)=>sum+(f.capitalStock||0),0));
 const realEstateCapital=Math.max(0,(S.housingCapacity-12)/2)*6000+S.buildings.length*6000;
 const fRentClaims=hRentDebt;
 const fAssets=round2(fCash+fInventoryVal+fProductiveCapital+realEstateCapital+fRentClaims);
 
 const fTaxDebt=round2(S.firms.reduce((sum,f)=>sum+(f.payables?.taxes||f.taxDebt||0),0));
 const fWageDebt=hWageClaims;
 const fLoans=round2(S.bankLoans.filter(l=>!l.borrower.startsWith("house:")&&l.borrower!=="treasury").reduce((n,l)=>n+l.principal+l.principalArrears+l.interestArrears,0));
 const fLiabilities=round2(fWageDebt+fTaxDebt+fLoans);
 const fNetWorth=round2(fAssets-fLiabilities);

 const bCash=balance("bank");
 const bLoans=totalLoans();
 const bDeposits=totalDeposits();
 const bAssets=round2(bCash+bLoans);
 const bLiabilities=round2(bDeposits);
 const bNetWorth=round2(bAssets-bLiabilities);
 const bPortfolio=getBankPortfolioStats();

 const gCash=balance("treasury");
 const gLandLots=S.lots*8000;
 const gTaxReceivables=fTaxDebt;
 const gLoans=round2(S.bankLoans.filter(l=>l.borrower==="treasury").reduce((n,l)=>n+l.principal+l.principalArrears+l.interestArrears,0));
 const gAssets=round2(gCash+gLandLots+gTaxReceivables);
 const gLiabilities=round2(gLoans);
 const gNetWorth=round2(gAssets-gLiabilities);

 const xIn=S.cumulativeExternalIn,xOut=S.cumulativeExternalOut,xNetPosition=round2(xIn-xOut);
 const totalDomesticCash=round2(domesticMoney());

 // As 9 verificações automatizadas de consistência:
 // 1. Ativos = Passivos + Patrimônio Líquido por setor
 const check1_balanceSheetsPerSector=
  Math.abs(hAssets-(hLiabilities+hNetWorth))<0.01 &&
  Math.abs(fAssets-(fLiabilities+fNetWorth))<0.01 &&
  Math.abs(bAssets-(bLiabilities+bNetWorth))<0.01 &&
  Math.abs(gAssets-(gLiabilities+gNetWorth))<0.01;

 // 2. Depósitos das famílias = passivo de depósitos do banco
 const check2_depositsMatch=Math.abs(hDeposits-bDeposits)<0.01;

 // 3. Carteira de crédito do banco = obrigações de crédito dos tomadores
 const totalBorrowerLoans=round2(hLoans+fLoans+gLoans);
 const check3_creditMatch=Math.abs(bLoans-totalBorrowerLoans)<0.01;

 // 4. Créditos tributários = obrigações tributárias correspondentes
 const check4_taxesMatch=Math.abs(gTaxReceivables-fTaxDebt)<0.01;

 // 5. Salários a receber = salários a pagar
 const check5_wagesMatch=Math.abs(hWageClaims-fWageDebt)<0.01;

 // 6. Aluguéis a receber = aluguéis a pagar
 const check6_rentsMatch=Math.abs(fRentClaims-hRentDebt)<0.01;

 // 7. Baixas de crédito refletidas nos dois setores envolvidos
 const check7_writeDownsMatch=Math.abs((S.cumulativeBankWriteDowns||0)-(S.cumulativeDebtorRelief||0))<0.01;

 // 8. Conservação do caixa doméstico (Entradas - Saídas = Caixa Total)
 const check8_cashConservation=Math.abs(totalDomesticCash-xNetPosition)<0.01;

 // 9. Ausência de valores NaN, infinitos ou saldos negativos indevidos
 let check9_numericalIntegrity=true;
 const numbersToCheck=[
  hAssets,hLiabilities,hNetWorth,hCash,hDeposits,hLoans,
  fAssets,fLiabilities,fNetWorth,fCash,fLoans,
  bAssets,bLiabilities,bNetWorth,bCash,bLoans,
  gAssets,gLiabilities,gNetWorth,gCash,
  xIn,xOut,xNetPosition,totalDomesticCash
 ];
 for(const n of numbersToCheck){
  if(isNaN(n)||!isFinite(n)){check9_numericalIntegrity=false;break;}
 }
 if(totalDomesticCash<0||bCash<0||gCash<0||hCash<0||bLoans<0)check9_numericalIntegrity=false;

 const intersectoralDebtCreditZeroSum=check2_depositsMatch&&check3_creditMatch&&check4_taxesMatch&&check5_wagesMatch&&check6_rentsMatch;
 const allPass=check1_balanceSheetsPerSector&&intersectoralDebtCreditZeroSum&&check7_writeDownsMatch&&check8_cashConservation&&check9_numericalIntegrity;

 return {
  households:{assets:hAssets,liabilities:hLiabilities,netWorth:hNetWorth,details:{cash:hCash,deposits:hDeposits,wageClaims:hWageClaims,rentDebt:hRentDebt,loans:hLoans}},
  enterprises:{assets:fAssets,liabilities:fLiabilities,netWorth:fNetWorth,details:{cash:fCash,inventory:fInventoryVal,productiveCapital:fProductiveCapital,realEstate:realEstateCapital,rentReceivables:fRentClaims,wageDebt:fWageDebt,taxDebt:fTaxDebt,loans:fLoans}},
  bank:{assets:bAssets,liabilities:bLiabilities,netWorth:bNetWorth,details:{cashReserves:bCash,loanPortfolio:bLoans,regularPrincipal:bPortfolio.regularPrincipal,principalArrears:bPortfolio.principalArrears,interestArrears:bPortfolio.interestArrears,defaultRate:bPortfolio.defaultRate,deposits:bDeposits}},
  government:{assets:gAssets,liabilities:gLiabilities,netWorth:gNetWorth,details:{cash:gCash,landLots:gLandLots,taxReceivables:gTaxReceivables,loans:gLoans}},
  external:S.externalSector,
  dre:S.lastDRE||{},
  firms:getFirms(),
  labor:getLaborStats(),
  audit:{
   totalDomesticCash,
   xNetPosition,
   cashOk:check8_cashConservation,
   intersectoralDebtCreditZeroSum,
   balanceSheetOk:allPass,
   check1_balanceSheetsPerSector,
   check2_depositsMatch,
   check3_creditMatch,
   check4_taxesMatch,
   check5_wagesMatch,
   check6_rentsMatch,
   check7_writeDownsMatch,
   check8_cashConservation,
   check9_numericalIntegrity,
   allPass,
   cashAudit:{ok:check8_cashConservation,expected:xNetPosition,observed:totalDomesticCash,difference:round2(totalDomesticCash-xNetPosition)},
   depositAudit:{ok:check2_depositsMatch,householdDeposits:hDeposits,bankDeposits:bDeposits},
   creditAudit:{ok:check3_creditMatch,bankLoans:bLoans,borrowerLoans:totalBorrowerLoans},
   balanceSheetAudit:{ok:check1_balanceSheetsPerSector},
   intersectoralAudit:{ok:intersectoralDebtCreditZeroSum,writeDownsOk:check7_writeDownsMatch}
  }
 };
}
function renderExtendedDashboard(){
 const doy=S.day%YEAR,dom=S.day%MONTH,harvest=doy>=150&&doy<210;
 $("cycleBar").innerHTML=`<div class="cycle-head"><b>Dia ${S.day} · Ano ${Math.floor(S.day/YEAR)+1} · ${harvest?'<span class="good">SAFRA ATIVA</span>':'Entressafra'}</b><span>Fechamento mensal: ${MONTH-dom} dia(s)</span></div><div class="track"><div class="harvest-zone"></div><div class="year-cursor" style="left:${doy/YEAR*100}%"></div></div><div class="cycle-foot"><span>Dia 0</span><span>Início da safra · 150</span><span>Fim · 210</span><span>Dia 360</span></div>`;
 const ls=getLaborStats(),pop=population(),app=Math.round(approval());
 const farm=farmAccount(),deposits=totalDeposits(),loans=totalLoans(),bStats=getBankPortfolioStats();
 const series=(key,current)=>{const arr=(S.history&&S.history[key])||[];return arr.length?arr.concat([current]).slice(-7):[current,current]};
 const cards=[
  {name:'Tesouro e moeda',value:money(balance('treasury')),sub:[['Câmbio',S.fx.toFixed(2)+' R$/US$'],['Terrenos',S.lots+' lotes']],spark:series('treasury',balance('treasury')),color:'var(--gold)'},
  {name:farmLabel(),value:money(balance(farm)),sub:[['Margem estimada/trab.',money(monthlyContributionPerWorker()-S.wage*(1+S.policy.employerTax/100))],['Ocupados na lavoura',ls.sectorWorkers.farm+'/'+ls.laborForce]],spark:[balance(farm),balance(farm)],color:'var(--green)'},
  {name:'Custo de vida e abastecimento',value:money(S.marketPrice),sub:[['Índice Custo de Vida',(S.costOfLivingIndex||100).toFixed(1)+' ('+(S.monthlyInflation>=0?'+':'')+(S.monthlyInflation||0).toFixed(1)+'%)'],['Estoque / Serviços',S.marketStock.toFixed(1)+' cestas · '+money(S.servicePrice||180)]],spark:[S.marketTargetPrice,S.marketPrice],color:'var(--gold)'},
  {name:'Trabalho (PNAD) e bem-estar',value:app+' / 100',sub:[['Força de trabalho',`${ls.occupied} ocup. · ${ls.unemployedSeeking} proc. · ${ls.outOfLaborForce} FFT`],['Taxa de desocupação',`${ls.unemploymentRate.toFixed(1)}% (MM3m: ${ls.movingAvgUnemployment.toFixed(1)}%)`]],spark:[app,app],color:'var(--green)'},
  {name:'Banco e carteira de crédito',value:money(balance('bank')),sub:[['Depósitos / Crédito',money(deposits)+' / '+money(loans)],['Inadimplência / Spread',bStats.defaultRate.toFixed(1)+'% · '+money((S.bankInterestIncome||0)-(S.lastDepositInterest||0))]],spark:[balance('bank'),balance('bank')],color:'var(--gold)'}
 ];
 $("pillars").innerHTML=cards.map(c=>`<div class="pillar"><div class="pillar-top"><div><div class="lab">${c.name}</div><div class="val">${c.value}</div></div>${sparklineSVG(c.spark,c.color)}</div><div class="pillar-sub">${c.sub.map(([a,b])=>`<span>${a}</span><b>${b}</b>`).join('')}</div></div>`).join('');
 $("popSummary").textContent=`${S.households.length} domicílios · ${pop} moradores · PIT: ${ls.pit} (${ls.occupied} ocupados · ${ls.unemployedSeeking} procurando · ${ls.outOfLaborForce} fora da força)`;
 $("householdsList").innerHTML=S.households.map(h=>{const flags=[];if(h.wageDebt>0)flags.push('Salário atrasado');if(h.rentDebt>0)flags.push('Aluguel pendente');const activeAd=Math.max(0,h.adults-(h.outOfLaborForce||0));if(h.jobs<activeAd)flags.push('Desocupação ativa');if(h.outOfLaborForce>0)flags.push(h.outOfLaborForce+' fora da força');if(h.shortageUnits>0)flags.push('Racionamento');const sec=h.sectorJobs?` (Agro:${h.sectorJobs.farm} Com:${h.sectorJobs.commerce} Ofic:${h.sectorJobs.workshop})`:'';return `<div class="actor-card"><div class="actor-head"><b>${h.name}</b><b>${money(h.cash)}</b></div><div class="actor-meta"><span>${h.adults} adulto(s), ${h.children} criança(s) · ${h.jobs}/${activeAd} na FT ocupados${sec}</span><span>Bem-estar: ${Math.round(h.happiness)}/100</span></div><div class="actor-meta"><span>${flags.length?flags.join(' · '):'Sem pendências registradas'}</span><span>Poupança: ${money(h.deposit)}</span></div></div>`}).join('')||'<div class="small">Sem domicílios.</div>';
 $("institutionsList").innerHTML=getFirms().map(f=>`<div class="actor-card"><div class="actor-head"><b>${f.name}</b><b>${money(f.cash)}</b></div><div class="actor-meta"><span>${f.sectorLabel} · ${f.operator==='state'?'Estatal':'Privada'} · ${f.activeWorkers} trab.</span><span>Crédito: ${money(f.loans)}</span></div></div>`).join('')+`<div class="actor-card"><div class="actor-head"><b>Proprietário de imóveis</b><b>${money(balance('landlord'))}</b></div><div class="actor-meta"><span>${S.buildings.length} obra(s) em andamento</span><span>${S.lots} lotes públicos restantes</span></div></div><div class="actor-card"><div class="actor-head"><b>Banco local</b><b>${money(balance('bank'))}</b></div><div class="actor-meta"><span>Reserva mínima: ${money(bankReserveFloor())} · Crédito disp.: ${money(availableCredit())}</span><span>Inadimplência: ${bStats.defaultRate.toFixed(1)}% (Atrasos: ${money(bStats.totalArrears)})</span></div></div>`;
 const f=S.lastFlow||{in:0,out:0,internal:0},net=f.in-f.out,profit=S.lastFarmProfit||0;
 $("stockLabel").textContent=S.marketStock.toFixed(2)+' unidades';
 $("monthlyBalance").innerHTML=`<div class="bal-col"><div class="lab">1. Setor externo</div><div class="bal-row"><span>Entradas externas</span><b class="good">+${money(f.in)}</b></div><div class="bal-row"><span>Saídas externas</span><b class="bad">-${money(f.out)}</b></div><div class="bal-row"><span>Fluxos internos</span><b>${money(f.internal)}</b></div><div class="bal-row"><span>Saldo externo</span><b class="${net>=0?'good':'bad'}">${money(net)}</b></div></div><div class="bal-col"><div class="lab">2. Fazenda (DRE)</div><div class="bal-row"><span>EBITDA / Operacional</span><b>${money(S.lastFarmEBITDA||0)}</b></div><div class="bal-row"><span>Deprec. + Juros pagos</span><b class="bad">-${money((S.lastFarmDepreciation||0)+(S.lastFarmInterestPaid||0))}</b></div><div class="bal-row"><span>Lucro Antes IR (LAIR)</span><b class="${profit>=0?'good':'bad'}">${money(profit)}</b></div><div class="bal-row"><span>Imposto sobre lucro</span><b>${money(S.lastProfitTax||0)}</b></div></div><div class="bal-col"><div class="lab">3. Consumo LES e Custo de Vida</div><div class="bal-row"><span>Alimentos + Serviços</span><b>${money(S.lastFoodConsumption||0)} + ${money(S.lastServiceConsumption||0)}</b></div><div class="bal-row"><span>Demanda não atendida</span><b class="${S.lastShortage>0?'bad':'good'}">${money(S.lastShortage)}</b></div><div class="bal-row"><span>Índice Custo de Vida</span><b>${(S.costOfLivingIndex||100).toFixed(1)} (${(S.monthlyInflation||0).toFixed(1)}%)</b></div><div class="bal-row"><span>Situação</span><b class="${S.lastShortage>0?'bad':'good'}">${S.lastShortage>0?'Escassez parcial':'Abastecido'}</b></div></div>`;
 const bs=generateBalanceSheets();
 if($("sfcAuditBadge"))$("sfcAuditBadge").innerHTML=bs.audit.balanceSheetOk?'<b class="good">SFC 100% Consistente (Débitos = Créditos)</b>':'<b class="bad">Divergência patrimonial detectada</b>';
  if($("institutionalBalances"))$("institutionalBalances").innerHTML=`<div class="bal-col"><div class="lab">1. Famílias</div><div class="bal-row"><span>Ativos (Caixa+Dep.+Salários)</span><b class="good">${money(bs.households.assets)}</b></div><div class="bal-row"><span>Passivos (Aluguéis+Crédito)</span><b class="bad">${money(bs.households.liabilities)}</b></div><div class="bal-row"><span>Patrimônio Líquido</span><b>${money(bs.households.netWorth)}</b></div></div><div class="bal-col"><div class="lab">2. Empresas (Produtivas)</div><div class="bal-row"><span>Ativos (Caixa+Estoques+Imóveis)</span><b class="good">${money(bs.enterprises.assets)}</b></div><div class="bal-row"><span>Passivos (Salários+Tributos+Crédito)</span><b class="bad">${money(bs.enterprises.liabilities)}</b></div><div class="bal-row"><span>Patrimônio Líquido</span><b>${money(bs.enterprises.netWorth)}</b></div></div><div class="bal-col"><div class="lab">3. Banco Local</div><div class="bal-row"><span>Ativos (Reservas+Crédito)</span><b class="good">${money(bs.bank.assets)}</b></div><div class="bal-row"><span>Passivos (Depósitos captados)</span><b class="bad">${money(bs.bank.liabilities)}</b></div><div class="bal-row"><span>Patrimônio Líquido</span><b>${money(bs.bank.netWorth)}</b></div></div><div class="bal-col"><div class="lab">4. Governo (Tesouro)</div><div class="bal-row"><span>Ativos (Caixa+Terrenos+Tributos)</span><b class="good">${money(bs.government.assets)}</b></div><div class="bal-row"><span>Passivos (Obrigações)</span><b class="bad">${money(bs.government.liabilities)}</b></div><div class="bal-row"><span>Patrimônio Líquido</span><b>${money(bs.government.netWorth)}</b></div></div>`;
  const macro=S.lastNationalAccounts||calculateNationalAccounts(),fiscal=S.lastFiscalReport||calculateFiscalReport();
  if($("macroAuditBadge"))$("macroAuditBadge").innerHTML=`PIB: <b class="good">${money(macro.gdp)}</b> · ${macro.reconciliation.reconciled?'três óticas conciliadas':'diferença contábil: '+money(macro.reconciliation.productionMinusExpenditure)} · ${fiscal.primaryStatus}: <b class="${fiscal.primaryResult>=0?'good':'bad'}">${money(fiscal.primaryResult)}</b>`;
   if($("macroeconomicAccounts"))$("macroeconomicAccounts").innerHTML=`<div class="bal-col"><div class="lab">1. Ótica da Produção (VAB)</div><div class="bal-row"><span>Agropecuária</span><b>${money(macro.vab.agriculture)}</b></div><div class="bal-row"><span>Comércio Varejista</span><b>${money(macro.vab.commerce)}</b></div><div class="bal-row"><span>Construção & Serviços</span><b>${money(macro.vab.workshop)}</b></div><div class="bal-row"><span>Imobiliário</span><b>${money(macro.vab.realEstate)}</b></div><div class="bal-row"><span>Administração Pública (não modelada)</span><b>${money(macro.vab.government)}</b></div><div class="bal-row"><span>Variação de estoques</span><b>${money(macro.reconciliation.inventoryChange)}</b></div><div class="bal-row"><span>Impostos sobre produtos</span><b>${money(macro.productTaxes)}</b></div><div class="bal-row"><span>PIB Total (Produção)</span><b class="good">${money(macro.approaches.production)}</b></div></div><div class="bal-col"><div class="lab">2. Ótica da Renda e da Despesa</div><div class="bal-row"><span>Consumo das famílias</span><b>${money(macro.components.householdConsumption)}</b></div><div class="bal-row"><span>Consumo do governo</span><b>${money(macro.components.governmentConsumption)}</b></div><div class="bal-row"><span>Formação de capital</span><b>${money(macro.components.grossCapitalFormation)}</b></div><div class="bal-row"><span>Exportações líquidas</span><b class="${macro.netExports>=0?'good':'bad'}">${money(macro.netExports)}</b></div><div class="bal-row"><span>PIB (Despesa)</span><b class="good">${money(macro.approaches.expenditure)}</b></div><div class="bal-row"><span>Remuneração dos empregados</span><b>${money(macro.components.employeeCompensation)}</b></div><div class="bal-row"><span>Consumo de capital fixo</span><b>${money(macro.components.consumptionOfFixedCapital)}</b></div><div class="bal-row"><span>Excedente operacional bruto</span><b>${money(macro.components.grossOperatingSurplus)}</b></div><div class="bal-row"><span>PIB (Renda)</span><b class="good">${money(macro.approaches.income)}</b></div><div class="bal-row"><span>Diferença Produção − Despesa</span><b>${money(macro.reconciliation.productionMinusExpenditure)}</b></div></div><div class="bal-col"><div class="lab">3. Resultado Fiscal (RTN)</div><div class="bal-row"><span>Receita tributária</span><b>${money(fiscal.tributaryRevenue)}</b></div><div class="bal-row"><span>Receita não tributária</span><b>${money(fiscal.nonTributaryRevenue)}</b></div><div class="bal-row"><span>Receita de capital (fora do primário)</span><b>${money(fiscal.capitalRevenue)}</b></div><div class="bal-row"><span>Despesa primária total</span><b class="bad">${money(fiscal.primaryExpenditure)}</b></div><div class="bal-row"><span>Resultado primário</span><b class="${fiscal.primaryResult>=0?'good':'bad'}">${money(fiscal.primaryResult)}</b></div><div class="bal-row"><span>Juros pagos / recebidos</span><b>${money(fiscal.interestPaid)} / ${money(fiscal.interestReceived)}</b></div><div class="bal-row"><span>Resultado nominal</span><b class="${fiscal.nominalResult>=0?'good':'bad'}">${money(fiscal.nominalResult)}</b></div></div><div class="bal-col"><div class="lab">4. Investimento & VPL (H=24)</div><div class="bal-row"><span>Taxa de Desconto</span><b>${(S.policy.baseRate+CREDIT_SPREAD).toFixed(2)}% a.m.</b></div><div class="bal-row"><span>VPL Lote Agrícola (8k)</span><b class="${S.lastProjectNPV?.farm?.viable?'good':'bad'}">${money(S.lastProjectNPV?.farm?.npv||0)}</b></div><div class="bal-row"><span>VPL Imobiliário (14k)</span><b class="${S.lastProjectNPV?.landlord?.viable?'good':'bad'}">${money(S.lastProjectNPV?.landlord?.npv||0)}</b></div><div class="bal-row"><span>Decisão de Expansão</span><b class="${(S.lastProjectNPV?.farm?.viable||S.lastProjectNPV?.landlord?.viable)?'good':'bad'}">${(S.lastProjectNPV?.farm?.viable||S.lastProjectNPV?.landlord?.viable)?'Expansão Ativa':'Retração / Cautela'}</b></div></div><div class="bal-col"><div class="lab">5. Demografia & Infraestrutura</div><div class="bal-row"><span>Capacidade Urbana</span><b>${S.urbanInfra?.capacity||20} hab. (Dem: ${S.urbanInfra?.demand||population()})</b></div><div class="bal-row"><span>Congestionamento</span><b class="${(S.urbanInfra?.congestionRatio||1.0)>1.0?'bad':'good'}">${(S.urbanInfra?.congestionRatio||1.0).toFixed(2)}x</b></div><div class="bal-row"><span>Produtividade TFP (Af)</span><b class="${(S.urbanInfra?.tfpFactor||1.0)<1.0?'bad':'good'}">${((S.urbanInfra?.tfpFactor||1.0)*100).toFixed(0)}%</b></div><div class="bal-row"><span>Salário Real Local</span><b>${money(S.lastHarrisTodaro?.realWageLocal||1800)}</b></div><div class="bal-row"><span>Harris-Todaro (ΔU)</span><b class="${(S.lastHarrisTodaro?.deltaU||0)>=0?'good':'bad'}">${(S.lastHarrisTodaro?.deltaU||0)>=0?'+':''}${money(S.lastHarrisTodaro?.deltaU||0)}</b></div></div>`;
}

function render(){syncPendingEventPrompt();auditCashConservation();const ls=getLaborStats(),unemp=Math.round(ls.unemploymentRate),stats=[["Dia",S.day+" (ano "+(Math.floor(S.day/YEAR)+1)+")"],["Tesouro",money(balance("treasury"))],["Caixa da fazenda",money(balance(farmAccount()))],["Proprietário",farmLabel()],["Preço da cesta",money(S.marketPrice)],["Câmbio",S.fx.toFixed(2)+" R$/US$"],["Salário mensal",money(S.wage)],["Juros básicos",S.policy.baseRate.toFixed(2)+"% a.m."],["Aprovação",Math.round(approval())],["População",population()+" / "+S.housingCapacity],["Adultos sem Ocupação",unemp+"%"],["Estoque de café",S.coffeeStock.toFixed(1)+" sacas"]];$("stats").innerHTML=stats.map(([a,b])=>`<div class="k"><div class="lab">${a}</div><div class="val">${b}</div></div>`).join("");
 const bStats=getBankPortfolioStats();
 $("accounts").innerHTML=Object.entries(accountNames).filter(([k])=>k!=="external").map(([k,n])=>`<div>${n}: <b>${money(balance(k))}</b></div>`).join("")+`<div class="small">Dinheiro das famílias: ${money(S.households.reduce((n,h)=>n+h.cash,0))}<br>Depósitos das famílias: ${money(totalDeposits())}<br>Crédito bancário total: ${money(bStats.totalPortfolio)} (Vincendo: ${money(bStats.regularPrincipal)} · Principal vencido: ${money(bStats.principalArrears)} · Juros vencidos: ${money(bStats.interestArrears)})<br>Receita de juros do banco: ${money(S.bankInterestIncome||0)} · Juros pagos aos depositantes: ${money(S.lastDepositInterest||0)} (${S.effectiveDepositRate.toFixed(3)}% a.m.)</div>`;
 const wd=totalWageDebt(),rd=totalRentDebt(),audit=auditCashConservation();$("obligations").innerHTML=`Salários atrasados: <b class="${wd?"bad":"good"}">${money(wd)}</b><br>Aluguéis pendentes: <b>${money(rd)}</b><br>Encargos patronais pendentes: <b>${money(S.employerTaxDebt)}</b><br>Impostos sobre lucro pendentes: <b>${money(S.farmTaxDebt+(S.workshopTaxDebt||0))}</b><br>Inadimplência bancária: <b class="${bStats.totalArrears>0?"bad":"good"}">${money(bStats.totalArrears)} (${bStats.defaultRate.toFixed(1)}%)</b><br>Crédito de ex-moradores: <b>${S.migratedClaims.filter(c=>c.wageDebt>0.01||c.rentDebt>0.01).length}</b><br>Conservação do dinheiro: <b class="${audit.ok?"good":"bad"}">${audit.ok?"OK":"DIVERGÊNCIA: "+money(audit.difference)}</b>`;
 $("monthly").innerHTML=`Entradas externas: <b>${money(S.lastFlow.in)}</b><br>Circulação interna: <b>${money(S.lastFlow.internal)}</b><br>Saídas externas: <b>${money(S.lastFlow.out)}</b><br>Folha devida: <b>${money(S.lastWage.due)}</b><br>Salários pagos: <b>${money(S.lastWage.paid)}</b><br>Consumo total (Alimentos + Serviços): <b>${money(S.lastConsumption)} (${money(S.lastFoodConsumption||0)} + ${money(S.lastServiceConsumption||0)})</b><br>Demanda não atendida: <b class="${S.lastShortage?"bad":""}">${money(S.lastShortage)} (${S.lastShortageUnits.toFixed(2)} unidades)</b><br>Famílias afetadas: <b>${S.lastUnmetHouseholds}</b><br>LAIR da fazenda (após deprec. e juros): <b>${money(S.lastFarmProfit)}</b><br>Imposto sobre lucro pago: <b>${money(S.lastProfitTax)}</b>`;
 $("market").innerHTML=`Estoque alimentar: ${S.marketStock.toFixed(2)} cestas<br>Preço da cesta básica: ${money(S.marketPrice)} · Tarifa de serviços locais: ${money(S.servicePrice||180)}<br>Índice Local de Custo de Vida (Laspeyres): <b>${(S.costOfLivingIndex||100).toFixed(1)}</b> (${(S.monthlyInflation||0).toFixed(2)}% no mês)<br>Custo externo estimado: ${money(USD_IMPORT*S.fx)} por cesta<br>Pressão de estoque: ${S.marketPressure.toFixed(2)}<br>Importação do mês: ${S.importedUnits.toFixed(2)} unidades<br>Falhas de abastecimento consecutivas: ${S.commerceEmptyMonths}<br>Crédito do comércio em aberto: ${money(totalLoans("commerce"))}<br><span class="small">Consumo familiar segue Sistema Linear de Despesas (LES) entre alimentos essenciais/discricionários e serviços locais.</span>`;
 $("feed").innerHTML=S.feed.map(x=>`<li>${x}</li>`).join("");$("ledger").innerHTML=S.ledger.slice(0,60).map(x=>`<tr><td>${x.day}</td><td>${nameOf(x.from)} → ${nameOf(x.to)}</td><td>${x.reason}</td><td>${money(x.amount)}</td></tr>`).join("");const ev=$("event");if(S.event){ev.classList.remove("hidden");$("eventTitle").textContent=S.event.title;$("eventText").textContent=S.event.text;$("eventOptions").innerHTML=S.event.options.map((o,i)=>`<button data-choice="${i}" ${o.disabled?"disabled":""}>${o.label}</button>`).join("")}else ev.classList.add("hidden");$("eventOptions").onclick=e=>{const b=e.target.closest("button");if(!b||!S.event)return;const weatherDecision=S.event.title==="Proteção contra geada";S.event.options[+b.dataset.choice].run();if(weatherDecision)continueDayOperations();else{syncPendingEventPrompt();render()}};if(S.gameOver){$("eventTitle").textContent="Fim de jogo";$("eventText").textContent=S.gameOver;ev.classList.remove("hidden");$("eventOptions").innerHTML="";pause()}renderPolicies();renderExtendedDashboard()}
function continueDayOperations(){const doy=S.day%YEAR;buyInputsAndProduce();if(doy>=150&&doy<210&&!S.weatherProtection&&!S.weatherEventDone&&rand()<FROST_DAILY_RISK){S.weatherEventDone=true;S.weatherFactor=.65;feed("Geada atingiu a lavoura: produção restante reduzida em 35%.")}if(S.day%10===0)sellCoffee();S.buildings=S.buildings.filter(due=>{if(S.day>=due){S.housingCapacity+=2;feed("Moradia concluída: capacidade ampliada em duas pessoas.");return false}return true});if(S.day%MONTH===0)closeMonth();auditCashConservation();render()}
function tick(){if(S.event||S.gameOver){pause();return}S.day++;syncCoreFromEconomy("day-advanced");const doy=S.day%YEAR;if(doy===0){S.weatherFactor=1;S.weatherEventDone=false;S.weatherDecisionDone=false;S.weatherProtection=false;S.productionThisSeason=0}if(doy===150&&!S.weatherDecisionDone){S.weatherDecisionDone=true;S.event={title:"Proteção contra geada",text:"A safra está começando. A geada tem risco aproximado de 20% ao longo da colheita e pode reduzir em 35% a produção restante. A proteção custa R$ 8.000.",options:[{label:"Contratar proteção (R$ 8.000)",run:()=>{const paid=log(farmAccount(),"external",8000,"Seguro contra geada");if(paid>=8000){S.weatherProtection=true;S.monthFarmCosts+=paid;if(S.currentMonthTracking)S.currentMonthTracking.farmInsurance+=paid;feed("Proteção contra geada contratada.")}else{S.weatherProtection=false;feed("Caixa insuficiente para contratar proteção.")}S.event=null;render() }},{label:"Assumir o risco",run:()=>{S.weatherProtection=false;feed("Fazenda decidiu não contratar proteção contra geada.");S.event=null;render()}}]};render();pause();return}continueDayOperations()}
function start(){if(timer||S.gameOver||S.event)return;timer=setInterval(tick,650/speed);if(CORE_RUNTIME)CORE_RUNTIME.session.setStatus("running");$("start").textContent="Continuar";$("pause").disabled=false}
function pause(){const wasRunning=!!timer;clearInterval(timer);timer=null;if(wasRunning&&CORE_RUNTIME&&!S.gameOver)CORE_RUNTIME.session.setStatus("paused");$("pause").disabled=true}
$("start").onclick=start;$("pause").onclick=pause;$("speed").onclick=()=>{speed=speed===1?4:1;$("speed").textContent=speed===4?"Velocidade normal":"Acelerar";if(timer){pause();start()}};$("reset").onclick=()=>{pause();policiesBuilt=false;newGame();actions()};
// continueOnGameOver=true é reservado a testes de estresse; partidas normais respeitam S.gameOver.
function simulateMonths(n,continueOnGameOver=false){
 S.weatherDecisionDone=true;S.weatherProtection=true;S.event=null;
 for(let m=0;m<n;m++){
  if(S.gameOver&&!continueOnGameOver)break;
  for(let d=0;d<30;d++){
   S.day++;const doy=S.day%YEAR;
   if(doy===0){S.weatherFactor=1;S.weatherEventDone=false;S.productionThisSeason=0}
   buyInputsAndProduce();if(S.day%10===0)sellCoffee();
   S.buildings=S.buildings.filter(due=>{if(S.day>=due){S.housingCapacity+=2;return false}return true});
  }
  closeMonth();
  let guard=0;
  while(S.event?.engineEventId&&guard++<5){
   const ev=S.event;const affordable=ev.options.find(o=>!o.disabled)||ev.options[0];
   if(!affordable)break;
   affordable.run();
   S.event=null;
   syncPendingEventPrompt();
  }
  if(S.event?.engineEventId)S.event=null;
 }
 render();return stateSnapshot();
}
function stateSnapshot(){return{day:S.day,monthNumber:S.monthNumber,fx:S.fx,marketPrice:S.marketPrice,servicePrice:S.servicePrice,costOfLivingIndex:S.costOfLivingIndex,monthlyInflation:S.monthlyInflation,marketTargetPrice:S.marketTargetPrice,marketStock:S.marketStock,lastShortage:S.lastShortage,lastShortageUnits:S.lastShortageUnits,lastUnmetHouseholds:S.lastUnmetHouseholds,lastFoodConsumption:S.lastFoodConsumption,lastServiceConsumption:S.lastServiceConsumption,lastConsumption:S.lastConsumption,lastDemandUnits:S.lastDemandUnits,approval:approval(),wage:S.wage,jobsAvailable:S.jobsAvailable,employed:employed(),laborStats:getLaborStats(),bankPortfolio:getBankPortfolioStats(),cashAudit:auditCashConservation(),balanceSheets:generateBalanceSheets(),nationalAccounts:S.lastNationalAccounts||calculateNationalAccounts(),fiscalReport:S.lastFiscalReport||calculateFiscalReport(),projectNPV:S.lastProjectNPV,urbanInfra:S.urbanInfra,harrisTodaro:S.lastHarrisTodaro,extraFirms:S.extraFirms,baseMarkup:S.baseMarkup,infrastructureCapacity:S.infrastructureCapacity,bankCash:balance("bank"),deposits:totalDeposits(),loans:totalLoans(),commerceCash:balance("commerce"),workshopCash:balance("workshop"),commerceEmptyMonths:S.commerceEmptyMonths,event:S.event?.title||null,eventMonth:S.eventEngine?.mes||0,activeEvents:S.eventEngine?.ativos?.length||0,workingCapitalPlan:S.lastWorkingCapitalPlan||null,baseJobsAvailable:S.baseJobsAvailable,lotCount:S.lots,depositRate:S.effectiveDepositRate,contributionPerWorker:monthlyContributionPerWorker(),totalCash:domesticMoney(),bankInterestIncome:S.bankInterestIncome,treasuryCash:balance("treasury"),farmCash:balance(farmAccount()),farmWageDebt:firmWageDebt("farm"),farmWorkers:S.firms?.find(f=>f.id==="farm")?.activeWorkers||0,farmEmployerTaxDebt:S.firms?.find(f=>f.id==="farm")?.employerTaxDebt||0,eventModifiers:S.eventMods||null,farmLastRevenue:S.lastDRE?.farm?.revenue||0,farmLastInputs:S.lastDRE?.farm?.inputs||0,farmLastProfit:S.lastDRE?.farm?.netProfit||0,farmInventory:S.firms?.find(f=>f.id==="farm")?.inventory?.quantity||0,farmSupportThisMonth:S.lastWorkingCapitalPlan?.support||0,gameOver:S.gameOver||null}}
function runStressTests(){const results=[];const test=(name,fn)=>{try{const detail=fn();results.push({name,passed:!!detail.pass,detail})}catch(e){results.push({name,passed:false,error:String(e)})}};
 newGame();S.policy.publicWage=3000;const wage=simulateMonths(6);test("6.1 Choque salarial",()=>({pass:wage.wage>=2999&&wage.jobsAvailable<8&&wage.cashAudit.ok,wage:wage.wage,jobs:wage.jobsAvailable,baselineJobs:8,conservation:wage.cashAudit.difference}));
 newGame();const baseline6=simulateMonths(6);newGame();S.policy.incomeTax=30;S.policy.housing="rented";const tax=simulateMonths(6);test("6.2 Imposto elevado + aluguel",()=>({pass:tax.cashAudit.ok&&tax.deposits<baseline6.deposits&&tax.lastConsumption>=0,taxRate:30,consumption:tax.lastConsumption,depositsWithShock:tax.deposits,depositsBaseline:baseline6.deposits,rentDebt:totalRentDebt(),conservation:tax.cashAudit.difference}));
 newGame();log("commerce","external",balance("commerce"),"Perda de capital operacional no teste de estresse");S.accounts.bank=0;S.marketStock=0;S.households.forEach(h=>{h.cash=0;h.deposit=0});const scarcity=simulateMonths(1);test("6.3 Escassez por falta de capital e crédito",()=>({pass:scarcity.lastShortageUnits>0&&scarcity.cashAudit.ok,unmetUnits:scarcity.lastShortageUnits,affectedHouseholds:scarcity.lastUnmetHouseholds,approval:scarcity.approval,conservation:scarcity.cashAudit.difference}));
 newGame();const contributionAt5=monthlyContributionPerWorker();S.fx=7.5;for(let i=0;i<12;i++)updateMarketPrice();const fx=stateSnapshot();test("6.4/6.5 Inflação importada e desvalorização",()=>({pass:fx.marketPrice>283.5&&Math.abs(fx.marketPrice-USD_IMPORT*7.5*(1+BASE_MARKUP))<8&&Math.abs(fx.contributionPerWorker/contributionAt5-1.5)<0.001,fx:7.5,importCost:USD_IMPORT*7.5,price:fx.marketPrice,target:fx.marketTargetPrice,farmContributionBefore:contributionAt5,farmContributionAfter:fx.contributionPerWorker}));
 newGame();log("external","house:1",10000,"Saldo de teste bancário");log("house:1","bank",10000,"Depósito de teste");S.households[0].deposit=10000;S.policy.baseRate=3;S.bankInterestIncome=0;const paidInterest=payDepositInterest();test("6.6 Poupança sem tomadores não gera juros fictícios",()=>({pass:paidInterest===0&&auditCashConservation().ok,depositInterest:paidInterest,deposits:totalDeposits(),bankCash:balance("bank")}));
 newGame();log("external","house:1",40000,"Capital de teste para depósito");log("house:1","bank",40000,"Depósito de teste");S.households[0].deposit=40000;S.policy.baseRate=0.5;const before=balance("bank");autoInvestAtLowRates();const after=balance("bank");test("6.7 Expansão do crédito quando o retorno supera os juros",()=>({pass:before-after>=21999&&S.baseJobsAvailable===9&&S.lots===8&&totalLoans()>=21999&&auditCashConservation().ok,bankBefore:before,bankAfter:after,loans:totalLoans(),productiveJobs:S.baseJobsAvailable,lotsRemaining:S.lots,conservation:auditCashConservation().difference}));
 newGame();log("external","house:1",40000,"Capital de teste para depósito a juros altos");log("house:1","bank",40000,"Depósito de teste a juros altos");S.households[0].deposit=40000;S.policy.baseRate=3;autoInvestAtLowRates();test("6.7B Crédito caro bloqueia investimentos de retorno inferior",()=>({pass:totalLoans()===0&&S.baseJobsAvailable===8&&S.lots===10,baseRate:S.policy.baseRate,loans:totalLoans(),productiveJobs:S.baseJobsAvailable,lotsRemaining:S.lots}));
 newGame();log("commerce","external",balance("commerce"),"Perda integral de capital do comércio no teste de insolvência");S.accounts.bank=0;S.marketStock=0;S.marketFundingFailure=true;S.lastShortageUnits=5;S.accounts.commerce=0;S.commerceEmptyMonths=0;const distress1=updateCommerceInsolvency();const distress2=updateCommerceInsolvency();test("6.8 Falência do comércio após dois meses consecutivos sem estoque e crédito",()=>({pass:distress1.emptyMonths===1&&distress2.emptyMonths===2&&S.event?.title==="Falência do comércio local"&&auditCashConservation().ok,emptyMonths:S.commerceEmptyMonths,event:S.event?.title||null,conservation:auditCashConservation().difference}));
 newGame();log("external","treasury",10000,"Capital de teste para socorro estatal");const treasuryBefore=balance("treasury");resolveCommerceFailure("state");test("6.8A Socorro estatal contabilizado",()=>({pass:treasuryBefore-balance("treasury")===10000&&balance("commerce")===30000&&auditCashConservation().ok,treasuryAfter:balance("treasury"),commerceCash:balance("commerce"),conservation:auditCashConservation().difference}));
 newGame();log("external","house:1",10000,"Capital de teste para depósito e crédito");log("house:1","bank",10000,"Depósito de teste");S.households[0].deposit=10000;const bankLoan=issueLoan("commerce",4000,"crédito anterior à reestruturação");resolveCommerceFailure("private");test("6.8B Novo comerciante e reestruturação",()=>({pass:bankLoan===4000&&Math.abs(totalLoans("commerce")-2000)<0.01&&Math.abs(S.commerceMarkupExtra-0.10)<0.001&&S.commerceMarkupMonths===6&&auditCashConservation().ok,loanBefore:bankLoan,loanAfter:totalLoans("commerce"),markupExtra:S.commerceMarkupExtra,markupMonths:S.commerceMarkupMonths,conservation:auditCashConservation().difference}));
 newGame();simulateMonths(12);const audit=stateSnapshot();test("6.9 Integridade monetária por 12 meses",()=>({pass:audit.cashAudit.ok&&Math.abs(audit.cashAudit.difference)<0.01,externalIn:S.cumulativeExternalIn,externalOut:S.cumulativeExternalOut,domesticMoney:audit.totalCash,difference:audit.cashAudit.difference,loans:audit.loans,deposits:audit.deposits}));
 newGame();log("external","bank",20000,"Capital bancário de teste");issueLoan("house:1",8000,"Teste de estresse");S.bankLoans[0].interestArrears=200;S.bankLoans[0].principalArrears=333.33;log("house:1","bank",800,"Pagamento parcial");settleBankLoans();test("6.10 Inadimplência e Quitação de Atraso (Cascata Estrita)",()=>({pass:S.bankLoans[0].interestArrears===0&&Math.abs(S.bankLoans[0].principalArrears-0)<0.05&&Math.abs(S.bankInterestIncome-408.33)<0.05&&auditCashConservation().ok,interestArrears:S.bankLoans[0].interestArrears,principalArrears:S.bankLoans[0].principalArrears,interestIncome:S.bankInterestIncome,conservation:auditCashConservation().difference}));
 newGame();simulateMonths(3);const bsTest=generateBalanceSheets();test("6.11 Balanço Patrimonial Integrado e DRE (SFC)",()=>({pass:bsTest.audit.balanceSheetOk&&Math.abs(bsTest.households.netWorth-(bsTest.households.assets-bsTest.households.liabilities))<0.01&&Math.abs(bsTest.enterprises.netWorth-(bsTest.enterprises.assets-bsTest.enterprises.liabilities))<0.01&&Math.abs(bsTest.bank.netWorth-(bsTest.bank.assets-bsTest.bank.liabilities))<0.01&&Math.abs(bsTest.government.netWorth-(bsTest.government.assets-bsTest.government.liabilities))<0.01&&bsTest.dre.farm!==undefined&&bsTest.dre.treasury!==undefined&&bsTest.dre.bank!==undefined,sfcZeroSum:bsTest.audit.intersectoralDebtCreditZeroSum,cashConservation:bsTest.audit.cashOk,householdsNW:bsTest.households.netWorth,enterprisesNW:bsTest.enterprises.netWorth,bankNW:bsTest.bank.netWorth,governmentNW:bsTest.government.netWorth}));
 newGame();const fList=getFirms();const hasFarm=fList.some(f=>f.id==="farm"&&f.sector==="agriculture"&&typeof f.capitalStock==="number");const hasComm=fList.some(f=>f.id==="commerce"&&f.sector==="retail"&&typeof f.inventory==="object");const hasWork=fList.some(f=>f.id==="workshop"&&f.sector==="construction_services"&&f.account==="workshop");const wInit=balance("workshop");log("external","treasury",10000,"Aporte orçamentário do Tesouro para obras");log("treasury","workshop",3000,"Obra pública: serviços e mão de obra locais");if(S.currentMonthTracking)S.currentMonthTracking.workshopRevenue=(S.currentMonthTracking.workshopRevenue||0)+3000;simulateMonths(1);const bsAfter=generateBalanceSheets();test("6.12 Sistema de Empresa Genérica e Multi-Setorial",()=>({pass:hasFarm&&hasComm&&hasWork&&wInit>=10000&&balance("workshop")>wInit&&bsAfter.audit.balanceSheetOk&&S.lastDRE.firms?.workshop!==undefined,firmCount:fList.length,hasFarm,hasCommerce:hasComm,hasWorkshop:hasWork,initialCash:wInit,finalCash:balance("workshop"),sfcOk:bsAfter.audit.balanceSheetOk,workshopDRE:S.lastDRE.firms?.workshop}));
 newGame();S.owner="private";log("stateFarm","privateFarm",balance("stateFarm"),"Transferência para fazenda privada");log("external","bank",30000,"Capital bancário de teste");issueLoan("privateFarm",10000,"Empréstimo produtivo da fazenda");S.monthFarmRevenue=5000;S.monthFarmCosts=2000;settleBankLoans();settleProfitTax();const expectedInterest=round2(10000*0.025),expectedDepr=round2(40000*0.0025),expectedLAIR=5000-2000-expectedDepr-expectedInterest,expectedTax=round2(expectedLAIR*(S.policy.profitTax/100));test("6.13 Dedução de juros bancários e depreciação no lucro tributável",()=>({pass:Math.abs(S.lastFarmInterestPaid-expectedInterest)<0.05&&Math.abs(S.lastFarmDepreciation-expectedDepr)<0.05&&Math.abs(S.lastFarmProfit-expectedLAIR)<0.05&&Math.abs(S.lastProfitTax-expectedTax)<0.05&&auditCashConservation().ok,ebitda:S.lastFarmEBITDA,depreciation:S.lastFarmDepreciation,interestPaid:S.lastFarmInterestPaid,lair:S.lastFarmProfit,profitTaxPaid:S.lastProfitTax}));
 newGame();S.jobsAvailable=2;S.households[0].cash=5000;S.households[1].cash=0;S.households[2].outOfLaborForce=1;matchLaborMarket();const ls14=getLaborStats();test("6.14 Mercado de trabalho PNAD Contínua e matching sem viés de ordem",()=>({pass:ls14.pit===6&&ls14.outOfLaborForce===1&&ls14.laborForce===5&&ls14.occupied===2&&ls14.unemployedSeeking===3&&Math.abs(ls14.unemploymentRate-60)<0.1&&S.households[1].jobs>=1&&S.households[2].jobs===0,pit:ls14.pit,laborForce:ls14.laborForce,occupied:ls14.occupied,unemployedSeeking:ls14.unemployedSeeking,outOfLaborForce:ls14.outOfLaborForce,unemploymentRate:ls14.unemploymentRate,rochaJobs:S.households[1].jobs}));
 newGame();simulateMonths(2);const snap15=stateSnapshot();test("6.15 Consumo multissetorial LES (Lei de Engel) e Índice de Custo de Vida",()=>({pass:snap15.lastFoodConsumption>0&&snap15.lastServiceConsumption>0&&Math.abs(snap15.lastConsumption-(snap15.lastFoodConsumption+snap15.lastServiceConsumption))<0.01&&snap15.costOfLivingIndex>80&&snap15.cashAudit.ok,foodConsumption:snap15.lastFoodConsumption,serviceConsumption:snap15.lastServiceConsumption,totalConsumption:snap15.lastConsumption,costOfLivingIndex:snap15.costOfLivingIndex,sfcOk:snap15.balanceSheets.audit.balanceSheetOk}));
 newGame();const initVal=calculateFirmValuation("farm");const p25=sellFarmStake(0.25);const treasAfter25=balance("treasury");const pRem=sellFarmStake(0.75);const treasAfterRem=balance("treasury");test("6.16 Valuation dinâmico e alienação parcial de ações (Sociedade de Economia Mista)",()=>({pass:initVal.valuation>0&&initVal.nav>0&&p25>0&&treasAfter25===p25&&S.farmOwnership.treasury===0&&S.farmOwnership.private===1.0&&S.owner==="private"&&treasAfterRem===(p25+pRem)&&auditCashConservation().ok,nav:initVal.nav,valuation:initVal.valuation,price25:p25,priceRemaining:pRem,totalProceeds:treasAfterRem,ownership:S.farmOwnership,operator:S.owner,cashOk:auditCashConservation().ok}));
 newGame();S.farmOwnership={treasury:0.60,private:0.40};log("external",farmAccount(),25000,"Capital de teste da fazenda");S.lastDRE={farm:{netProfit:10000}};S.policy.dividendPayoutRatio=50;const hCashBefore=S.households.reduce((acc,h)=>acc+h.cash,0);const tBefore=balance("treasury");const divs=distributeFirmDividends();const hCashAfter=S.households.reduce((acc,h)=>acc+h.cash,0);const tAfter=balance("treasury");test("6.17 Distribuição de dividendos pro-rata (Tesouro e acionistas privados)",()=>({pass:divs.total===5000&&divs.treasury===3000&&divs.private===2000&&tAfter-tBefore===3000&&hCashAfter-hCashBefore===2000&&auditCashConservation().ok,totalDividends:divs.total,treasuryDividends:divs.treasury,privateDividends:divs.private,treasuryReceived:tAfter-tBefore,householdsReceived:hCashAfter-hCashBefore,cashOk:auditCashConservation().ok}));
 newGame();S.concessionActive=true;log("external","landlord",5000,"Capital do concessionário");const tPre=balance("treasury");const lPre=balance("landlord");const outorga=settleConcessionOutorga();const bs18=generateBalanceSheets();test("6.18 Contrato de concessão com outorga e conservação SFC",()=>({pass:outorga===400&&balance("treasury")-tPre===400&&lPre-balance("landlord")===400&&bs18.audit.balanceSheetOk&&bs18.audit.intersectoralDebtCreditZeroSum&&auditCashConservation().ok,outorga,treasuryBalance:balance("treasury"),landlordBalance:balance("landlord"),sfcOk:bs18.audit.balanceSheetOk,cashOk:bs18.audit.cashOk}));
 newGame();simulateMonths(3);const scn=calculateNationalAccounts();test("6.19 Sistema de Contas Nacionais: VAB setorial e PIB local pelas três óticas",()=>({pass:scn.gdp>0&&scn.vab.totalVAB>0&&scn.approaches.production===scn.gdp&&scn.productTaxes>=0&&scn.approaches.income>0&&auditCashConservation().ok,gdp:scn.gdp,vab:scn.vab,approaches:scn.approaches,productTaxes:scn.productTaxes,cashOk:auditCashConservation().ok}));
 newGame();simulateMonths(2);const rpt=calculateFiscalReport();const tBal=balance("treasury");test("6.20 Resultado Fiscal Primário e Nominal (RTN)",()=>({pass:rpt.primaryRevenue>=0&&rpt.primaryExpenditure>=0&&rpt.primaryResult===round2(rpt.primaryRevenue-rpt.primaryExpenditure)&&rpt.nominalResult===rpt.primaryResult&&tBal>=0&&auditCashConservation().ok,primaryRevenue:rpt.primaryRevenue,primaryExpenditure:rpt.primaryExpenditure,primaryResult:rpt.primaryResult,nominalResult:rpt.nominalResult,status:rpt.solvencyStatus,treasuryBalance:tBal}));
 newGame();S.policy.baseRate=0.5;const vplLow=calculateProjectNPV(8000,8000,0,142.5,24);S.policy.baseRate=3.0;const vplHigh=calculateProjectNPV(8000,8000,0,142.5,24);test("6.21 Decisão de Investimento por VPL multitemporal (Horizonte H=24)",()=>({pass:vplLow.npv>0&&vplLow.viable===true&&vplHigh.npv<0&&vplHigh.viable===false,lowRateNPV:vplLow.npv,lowRateViable:vplLow.viable,highRateNPV:vplHigh.npv,highRateViable:vplHigh.viable}));
 newGame();log("external","bank",30000,"Capital bancário de teste");const premClean=borrowerRiskPremium("house:1");const cleanLoan=issueLoan("house:1",6000,"Crédito inicial");const cleanRate=S.bankLoans[0].rate;S.bankLoans[0].principalArrears=1500;S.bankLoans[0].interestArrears=300;const premRisky=borrowerRiskPremium("house:1");const riskyLoan=issueLoan("house:1",4000,"Segundo empréstimo sob risco");const riskyRate=S.bankLoans[1].rate;test("6.22 Precificação de risco e spread bancário por tomador",()=>({pass:premClean===0&&premRisky>0&&riskyRate>cleanRate&&cleanLoan===6000&&riskyLoan===4000&&auditCashConservation().ok,cleanPremium:premClean,cleanRate,riskyPremium:premRisky,riskyRate,rateDifference:round2(riskyRate-cleanRate),cashOk:auditCashConservation().ok}));
 newGame();const htInit=processHarrisTodaroMigration();S.policy.publicWage=1000;S.policy.incomeTax=30;S.costOfLivingIndex=180;S.externalWage=3500;const htLow=processHarrisTodaroMigration();S.policy.publicWage=4000;S.policy.incomeTax=0;S.costOfLivingIndex=80;S.externalWage=1800;const htHigh=processHarrisTodaroMigration();test("6.23 Modelo Demográfico Harris-Todaro e sensibilidade a salários reais e custo de vida",()=>({pass:htInit.uLocal>0&&htLow.deltaU<0&&htHigh.deltaU>0&&htHigh.realWageLocal>htLow.realWageLocal&&auditCashConservation().ok,htInitDeltaU:htInit.deltaU,htLowDeltaU:htLow.deltaU,htHighDeltaU:htHigh.deltaU,lowRealWage:htLow.realWageLocal,highRealWage:htHigh.realWageLocal,cashOk:auditCashConservation().ok}));
 newGame();const firmsBefore=getFirms().length;const markupBefore=S.baseMarkup;S.lastShortageUnits=2.5;S.commerceEmptyMonths=1;const entryOccurred=checkFirmEntryAndExit();const firmsAfter=getFirms().length;const hasBakery=getFirms().some(f=>f.id==="bakery");const markupAfter=S.baseMarkup;const bsEntry=generateBalanceSheets();test("6.24 Entrada endógena de firma por demanda reprimida e excesso de markup",()=>({pass:entryOccurred&&firmsAfter===firmsBefore+1&&hasBakery&&markupBefore===0.35&&markupAfter===0.25&&balance("bakery")===10000&&bsEntry.audit.balanceSheetOk&&auditCashConservation().ok,entryOccurred,firmsBefore,firmsAfter,hasBakery,markupBefore,markupAfter,bakeryCash:balance("bakery"),balanceSheetOk:bsEntry.audit.balanceSheetOk,cashOk:auditCashConservation().ok}));
 newGame();checkFirmEntryAndExit(true);const efBakery=S.extraFirms.find(e=>e.id==="bakery");efBakery.wageDebt=2000;efBakery.taxDebt=1500;efBakery.employerTaxDebt=0;efBakery.profitTaxDebt=1500;log("external","bank",30000,"Capital bancário para crédito à padaria");issueLoan("bakery",8000,"Crédito de expansão da padaria");log("bakery","external",8000,"Perda operacional pré-falência");S.households[0].wageDebt=2000;S.households[0].wageDebtByFirm.bakery=2000;const liqResult=liquidateInsolventFirm("bakery");const bsLiq=generateBalanceSheets();test("6.25 Liquidação concursal ordenada com cascata de pagamentos privilegiados",()=>({pass:liqResult&&liqResult.laborSettled===2000&&liqResult.taxSettled===1500&&liqResult.bankSettled===6500&&liqResult.loanWrittenOff===1500&&totalLoans("bakery")===0&&balance("bakery")===0&&bsLiq.audit.balanceSheetOk&&bsLiq.audit.intersectoralDebtCreditZeroSum&&auditCashConservation().ok,laborSettled:liqResult.laborSettled,taxSettled:liqResult.taxSettled,bankSettled:liqResult.bankSettled,loanWrittenOff:liqResult.loanWrittenOff,bakeryLoansRemaining:totalLoans("bakery"),balanceSheetOk:bsLiq.audit.balanceSheetOk,cashOk:auditCashConservation().ok}));
 newGame();S.infrastructureCapacity=6;const infraCrowded=updateUrbanInfrastructure();const tfpCrowded=infraCrowded.tfpFactor;log("external","treasury",15000,"Aporte para teste de infraestrutura");const tPreInfra=balance("treasury");const invested=investInInfrastructure();const infraAfter=S.urbanInfra;const bsInfra=generateBalanceSheets();test("6.26 Infraestrutura urbana, custos de congestionamento e Produtividade Total dos Fatores (TFP)",()=>({pass:infraCrowded.congestionRatio>1.0&&tfpCrowded<1.0&&invested===6000&&tPreInfra-balance("treasury")===6000&&infraAfter.capacity===10&&infraAfter.tfpFactor>tfpCrowded&&bsInfra.audit.balanceSheetOk&&auditCashConservation().ok,crowdedRatio:infraCrowded.congestionRatio,tfpCrowded,invested,capacityAfter:infraAfter.capacity,tfpAfter:infraAfter.tfpFactor,balanceSheetOk:bsInfra.audit.balanceSheetOk,cashOk:auditCashConservation().ok}));
 newGame();log("external","bank",30000,"Capital bancário de teste");issueLoan("house:1",6000,"Empréstimo sem inadimplência");const l1=S.bankLoans[0],pInit1=l1.principal,quotaP1=round2(pInit1/l1.term),quotaI1=round2(pInit1*l1.rate);settleBankLoans();const l1After=S.bankLoans[0];test("7.1 Empréstimo sem inadimplência",()=>({pass:l1After&&l1After.principalArrears===0&&l1After.interestArrears===0&&Math.abs(l1After.principal-(pInit1-quotaP1))<0.05&&S.bankInterestIncome===quotaI1&&auditCashConservation().ok,principal:l1After?l1After.principal:null,principalArrears:l1After?l1After.principalArrears:null,interestArrears:l1After?l1After.interestArrears:null,interestIncome:S.bankInterestIncome,conservation:auditCashConservation().difference}));
 newGame();log("external","bank",30000,"Capital bancário de teste");issueLoan("house:2",12000,"Pagamento integral");const l2=S.bankLoans[0],pInit2=l2.principal,quotaP2=round2(pInit2/l2.term),quotaI2=round2(pInit2*l2.rate),totDue2=round2(quotaP2+quotaI2);const cashBefore2=balance("house:2");settleBankLoans();const l2After=S.bankLoans[0];test("7.2 Pagamento integral de prestação",()=>({pass:l2After&&l2After.principalArrears===0&&l2After.interestArrears===0&&Math.abs(l2After.principal-(pInit2-quotaP2))<0.05&&Math.abs((cashBefore2-balance("house:2"))-totDue2)<0.05&&S.bankInterestIncome===quotaI2&&auditCashConservation().ok,paidInstallment:round2(cashBefore2-balance("house:2")),expectedInstallment:totDue2,principalRemaining:l2After?l2After.principal:null,conservation:auditCashConservation().difference}));
 newGame();log("external","bank",30000,"Capital bancário de teste");issueLoan("house:1",6000,"Pagamento parcial");const l3=S.bankLoans[0],rate3=l3.rate,intCur3=round2(6000*rate3),pCur3=round2(6000/24);log("house:1","external",balance("house:1"),"Zerar caixa");log("external","house:1",intCur3+80,"Caixa parcial");settleBankLoans();const l3After=S.bankLoans[0];test("7.3 Pagamento parcial de prestação",()=>({pass:l3After&&l3After.interestArrears===0&&Math.abs(l3After.principalArrears-(pCur3-80))<0.05&&Math.abs(l3After.principal-(6000-pCur3))<0.05&&Math.abs(round2(l3After.principal+l3After.principalArrears)-(6000-80))<0.05&&S.bankInterestIncome===intCur3&&balance("house:1")===0&&auditCashConservation().ok,interestPaid:S.bankInterestIncome,principalArrears:l3After?l3After.principalArrears:null,principalVincendo:l3After?l3After.principal:null,totalDebt:l3After?round2(l3After.principal+l3After.principalArrears):null,expectedTotalDebt:6000-80,conservation:auditCashConservation().difference}));
 newGame();log("external","bank",30000,"Capital bancário de teste");issueLoan("house:1",5000,"Inadimplência total");const l4=S.bankLoans[0],intCur4=round2(5000*l4.rate),pCur4=round2(5000/24);log("house:1","external",balance("house:1"),"Zerar caixa");settleBankLoans();const l4After=S.bankLoans[0];test("7.4 Acúmulo de juros vencidos",()=>({pass:l4After&&Math.abs(l4After.interestArrears-intCur4)<0.05&&Math.abs(l4After.principalArrears-pCur4)<0.05&&Math.abs((l4After.principal+l4After.principalArrears)-5000)<0.05&&S.bankInterestIncome===0&&auditCashConservation().ok,interestArrears:l4After?l4After.interestArrears:null,principalArrears:l4After?l4After.principalArrears:null,totalPrincipal:l4After?round2(l4After.principal+l4After.principalArrears):null,conservation:auditCashConservation().difference}));
 newGame();log("external","bank",30000,"Capital bancário de teste");issueLoan("house:2",10000,"Conservação de principal");const l5=S.bankLoans[0];log("house:2","external",balance("house:2"),"Zerar caixa");settleBankLoans();settleBankLoans();const l5After=S.bankLoans[0];test("7.5 Acúmulo de principal vencido",()=>({pass:l5After&&Math.abs((l5After.principal+l5After.principalArrears)-10000)<0.05&&l5After.principalArrears>800&&l5After.interestArrears>0&&auditCashConservation().ok,principalArrears:l5After?l5After.principalArrears:null,principalVincendo:l5After?l5After.principal:null,conservedPrincipalSum:l5After?round2(l5After.principal+l5After.principalArrears):null,conservation:auditCashConservation().difference}));
 newGame();log("external","bank",30000,"Capital bancário de teste");issueLoan("house:1",6000,"Cascata de prioridade");const l6=S.bankLoans[0];l6.interestArrears=150;l6.principalArrears=300;const intCur6=round2(((l6.principal||0)+(l6.principalArrears||0))*l6.rate),pCur6=round2(l6.principal/l6.term);log("house:1","external",balance("house:1"),"Zerar caixa");log("external","house:1",150+intCur6+100,"Recurso parcial");settleBankLoans();const l6After=S.bankLoans[0];test("7.6 Pagamento posterior com cascata de prioridade",()=>({pass:l6After&&l6After.interestArrears===0&&Math.abs(l6After.principalArrears-(300-100+pCur6))<0.05&&S.bankInterestIncome===(150+intCur6)&&balance("house:1")===0&&auditCashConservation().ok,interestArrears:l6After?l6After.interestArrears:null,principalArrears:l6After?l6After.principalArrears:null,interestIncome:S.bankInterestIncome,conservation:auditCashConservation().difference}));
 newGame();log("external","bank",30000,"Capital bancário de teste");issueLoan("house:1",1000,"Liquidação integral");const l7=S.bankLoans[0];l7.principal=500;l7.term=1;l7.paid=0;l7.principalArrears=50;l7.interestArrears=10;log("external","house:1",2000,"Amplo caixa para liquidação");settleBankLoans();const remLoans7=S.bankLoans.filter(l=>l.id===l7.id);test("7.7 Liquidação integral de dívida",()=>({pass:remLoans7.length===0&&totalLoans("house:1")===0&&auditCashConservation().ok,remainingLoansCount:remLoans7.length,totalLoans:totalLoans("house:1"),conservation:auditCashConservation().difference}));
 newGame();log("external","bank",30000,"Capital bancário de teste");issueLoan("commerce",10000,"Dívida comercial");const l8=S.bankLoans[0];l8.principalArrears=2000;l8.interestArrears=500;commerceLoanWriteDown(0.40);const l8After=S.bankLoans[0];const bs8=generateBalanceSheets();test("7.8 Reestruturação/baixa de dívida comercial",()=>({pass:l8After&&Math.abs(l8After.principal-6000)<0.05&&Math.abs(l8After.principalArrears-1200)<0.05&&Math.abs(l8After.interestArrears-300)<0.05&&Math.abs(totalLoans("commerce")-7500)<0.05&&bs8.audit.balanceSheetOk&&auditCashConservation().ok,principalAfter:l8After?l8After.principal:null,principalArrearsAfter:l8After?l8After.principalArrears:null,interestArrearsAfter:l8After?l8After.interestArrears:null,totalCommerceDebt:totalLoans("commerce"),balanceSheetOk:bs8.audit.balanceSheetOk}));
 newGame();const legacyList=[{id:"leg1",borrower:"house:1",principal:5000,term:12,paid:2,arrears:450},{id:"leg2",borrower:"commerce",principal:8000,term:24,paid:0}];const mig=migrateLoans(legacyList);test("7.9 Migração de empréstimos legado",()=>({pass:mig.length===2&&mig[0].principal===5000&&mig[0].principalArrears===350&&mig[0].interestArrears===100&&mig[0].arrears===undefined&&mig[1].principalArrears===0&&mig[1].interestArrears===0&&mig[1].arrears===undefined,migrated0:mig[0],migrated1:mig[1]}));
 newGame();simulateMonths(6);let noNaN=true,noNegative=true;S.bankLoans.forEach(l=>{if(isNaN(l.principal)||isNaN(l.principalArrears)||isNaN(l.interestArrears))noNaN=false;if(l.principal<0||l.principalArrears<0||l.interestArrears<0)noNegative=false});const bs10=generateBalanceSheets();test("7.10 Integridade numérica e consistência SFC",()=>({pass:noNaN&&noNegative&&bs10.audit.balanceSheetOk&&bs10.audit.intersectoralDebtCreditZeroSum&&auditCashConservation().ok,noNaN,noNegative,sfcZeroSum:bs10.audit.intersectoralDebtCreditZeroSum,balanceSheetOk:bs10.audit.balanceSheetOk,cashConservation:bs10.audit.cashOk}));

 // SUÍTE 8 - REFORMA CONTÁBIL E ARQUITETURA EMPRESARIAL 2.4
 newGame();log("external","bank",30000,"Capital bancário");issueLoan("house:1",10000,"Teste Juros SFC");const l81=S.bankLoans[0];l81.principal=8000;l81.principalArrears=2000;l81.interestArrears=500;const rate81=l81.rate;const expJ81=round2((8000+2000)*rate81);log("house:1","external",balance("house:1"),"Zerar caixa");settleBankLoans();test("8.1 Juros sobre principal regular e vencido sem incidência sobre juros vencidos",()=>({pass:Math.abs(S.bankAccruedInterest-expJ81)<0.05&&Math.abs(l81.interestArrears-(500+expJ81))<0.05&&auditCashConservation().ok,accrued:S.bankAccruedInterest,expectedJ:expJ81,interestArrears:l81.interestArrears,conservation:auditCashConservation().difference}));
 newGame();log("external","bank",30000,"Capital bancário");issueLoan("house:1",6000,"Teste Cascata");const l82=S.bankLoans[0];l82.interestArrears=200;l82.principalArrears=400;const rate82=l82.rate;const intCur82=round2((6000+400)*rate82);const pCur82=round2(6000/l82.term);log("house:1","external",balance("house:1"),"Zerar");log("external","house:1",200+intCur82+150,"Recurso prioritário");settleBankLoans();test("8.2 Cascata estrita de prioridades e amortização de dívida",()=>({pass:l82.interestArrears===0&&Math.abs(l82.principalArrears-(400-150+pCur82))<0.05&&S.bankInterestIncome===(200+intCur82)&&S.lastLoanSettlement.totalPrincipalPaid===150&&auditCashConservation().ok,interestIncome:S.bankInterestIncome,principalPaid:S.lastLoanSettlement.totalPrincipalPaid,principalArrears:l82.principalArrears,conservation:auditCashConservation().difference}));
 newGame();log("external","bank",30000,"Capital bancário");issueLoan("house:2",5000,"Teste Inadimplência");const l83=S.bankLoans[0];log("house:2","external",balance("house:2"),"Zerar");settleBankLoans();const arr1=l83.interestArrears;settleBankLoans();const arr2=l83.interestArrears;l83.term=1;log("external","house:2",15000,"Caixa para quitação integral");settleBankLoans();const loansLeft83=S.bankLoans.filter(l=>l.id===l83.id);test("8.3 Inadimplência recorrente e posterior liquidação total",()=>({pass:arr2>arr1&&arr1>0&&loansLeft83.length===0&&totalLoans("house:2")===0&&auditCashConservation().ok,arrearsMonth1:arr1,arrearsMonth2:arr2,loansRemaining:loansLeft83.length,conservation:auditCashConservation().difference}));
 newGame();log("external","bank",30000,"Capital bancário");issueLoan("commerce",12000,"Crédito comercial");const l84=S.bankLoans[0];l84.principalArrears=3000;l84.interestArrears=600;const totDebtBefore84=totalLoans("commerce");const bankCashPre84=balance("bank");const commCashPre84=balance("commerce");const writtenOff84=commerceLoanWriteDown(0.50);const totDebtAfter84=totalLoans("commerce");const bs84=generateBalanceSheets();test("8.4 Baixa de crédito simétrica com absorção patrimonial e zero caixa",()=>({pass:Math.abs(writtenOff84-totDebtBefore84*0.50)<0.05&&Math.abs(totDebtAfter84-totDebtBefore84*0.50)<0.05&&balance("bank")===bankCashPre84&&balance("commerce")===commCashPre84&&S.lastBankCreditLosses===writtenOff84&&S.cumulativeBankWriteDowns===S.cumulativeDebtorRelief&&bs84.audit.balanceSheetOk&&auditCashConservation().ok,writtenOff:writtenOff84,debtBefore:totDebtBefore84,debtAfter:totDebtAfter84,bankCashChange:balance("bank")-bankCashPre84,commCashChange:balance("commerce")-commCashPre84,sfcOk:bs84.audit.balanceSheetOk}));
 newGame();const fFarmPre=S.firms.find(f=>f.id==="farm");const kBefore85=fFarmPre.capitalStock;const farmCashBefore85=balance(farmAccount());S.monthFarmRevenue=10000;S.monthFarmCosts=3000;settleProfitTax();const kAfter85=fFarmPre.capitalStock;const expectedDepr85=round2(kBefore85*0.0025);const farmCashAfter85=balance(farmAccount());test("8.5 Depreciação reduz capital contábil sem saída fictícia de caixa",()=>({pass:Math.abs(kBefore85-kAfter85-expectedDepr85)<0.05&&S.lastFarmDepreciation===expectedDepr85&&farmCashBefore85===farmCashAfter85&&auditCashConservation().ok,kInitial:kBefore85,kFinal:kAfter85,depreciation:S.lastFarmDepreciation,cashChange:farmCashAfter85-farmCashBefore85}));
 newGame();const firms86=S.firms;const farm86=firms86.find(f=>f.id==="farm");const comm86=firms86.find(f=>f.id==="commerce");const work86=firms86.find(f=>f.id==="workshop");const hasAllAttrs=(f)=>f&&f.id&&f.name&&f.sector&&f.ownership&&f.operator&&f.contract&&f.account&&typeof f.cash==="number"&&typeof f.capitalStock==="number"&&typeof f.depreciationRate==="number"&&f.inventory&&typeof f.baseCapacity==="number"&&typeof f.productivityFactor==="number"&&f.payables&&f.status==="active";const stateFarmSeparateFromTreasury=farm86.account==="stateFarm"&&farm86.account!=="treasury"&&balance("stateFarm")!==balance("treasury");test("8.6 Cadastro operacional S.firms e autonomia contábil estatal vs Tesouro",()=>({pass:firms86.length===3&&hasAllAttrs(farm86)&&hasAllAttrs(comm86)&&hasAllAttrs(work86)&&stateFarmSeparateFromTreasury,firmCount:firms86.length,farmAttrs:hasAllAttrs(farm86),commAttrs:hasAllAttrs(comm86),workAttrs:hasAllAttrs(work86),stateFarmSeparate:stateFarmSeparateFromTreasury}));
 newGame();simulateMonths(4);const bs87=generateBalanceSheets();const a87=bs87.audit;test("8.7 Auditoria patrimonial SFC integral com as 9 verificações automatizadas",()=>({pass:a87.allPass&&a87.check1_balanceSheetsPerSector&&a87.check2_depositsMatch&&a87.check3_creditMatch&&a87.check4_taxesMatch&&a87.check5_wagesMatch&&a87.check6_rentsMatch&&a87.check7_writeDownsMatch&&a87.check8_cashConservation&&a87.check9_numericalIntegrity,check1:a87.check1_balanceSheetsPerSector,check2:a87.check2_depositsMatch,check3:a87.check3_creditMatch,check4:a87.check4_taxesMatch,check5:a87.check5_wagesMatch,check6:a87.check6_rentsMatch,check7:a87.check7_writeDownsMatch,check8:a87.check8_cashConservation,check9:a87.check9_numericalIntegrity}));
 newGame();simulateMonths(12,true);const bs88=generateBalanceSheets();test("8.8 Stress test SFC de 12 meses (continuação técnica após fim de jogo)",()=>({pass:bs88.audit.allPass&&bs88.audit.cashOk&&Math.abs(bs88.audit.cashAudit.difference)<0.01,months:12,allPass:bs88.audit.allPass,difference:bs88.audit.cashAudit.difference}));
 newGame();simulateMonths(24,true);const bs89=generateBalanceSheets();test("8.9 Stress test SFC de 24 meses (continuação técnica após fim de jogo)",()=>({pass:bs89.audit.allPass&&bs89.audit.cashOk&&Math.abs(bs89.audit.cashAudit.difference)<0.01,months:24,allPass:bs89.audit.allPass,difference:bs89.audit.cashAudit.difference}));
 newGame();simulateMonths(60,true);const bs810=generateBalanceSheets();test("8.10 Stress test SFC de 60 meses (continuação técnica após fim de jogo)",()=>({pass:bs810.audit.allPass&&bs810.audit.cashOk&&Math.abs(bs810.audit.cashAudit.difference)<0.01,months:60,allPass:bs810.audit.allPass,difference:bs810.audit.cashAudit.difference}));

 // ETAPA B - CICLO OPERACIONAL COMUM E MERCADO DE TRABALHO COLETIVO
 newGame();
 const firms811=S.firms;
 const allHaveLifecycle=firms811.every(f=>f.behavior&&typeof f.behavior.plan==="function"&&typeof f.behavior.produce==="function"&&typeof f.behavior.market==="function"&&typeof f.behavior.settle==="function"&&typeof f.behavior.sync==="function");
 runFirmPlanningPhase();
 const vacanciesPlanned=S.firms.every(f=>typeof f.openVacancies==="number");
 const ls811=matchCollectiveLaborMarket();
 const workersAssigned=S.firms.every(f=>typeof f.activeWorkers==="number");
 runFirmProductionPhase({day:160,fx:5,weatherFactor:1});
 runFirmCommercializationPhase({day:160});
 const settleCtx811={policy:S.policy,monthNumber:1};
 runFirmSettlementPhase(settleCtx811);
 const bs811=generateBalanceSheets();
 test("8.11 Ciclo Operacional Comum: Planejamento, Produção, Mercado e Liquidação Centralizada (Etapa B)",()=>({pass:allHaveLifecycle&&vacanciesPlanned&&workersAssigned&&ls811.occupied>0&&bs811.audit.allPass&&auditCashConservation().ok,allHaveLifecycle,vacanciesPlanned,workersAssigned,occupied:ls811.occupied,balanceSheetOk:bs811.audit.allPass,cashOk:auditCashConservation().ok}));

 newGame();
 const dynamicFirm=createFirm("coop","Cooperativa de Artesãos","crafts","workshop",{status:"active",baseCapacity:1,openVacancies:1,offeredWage:1600,capitalStock:5000,depreciationRate:0.0025,role:"secondary"},{plan(f){f.openVacancies=1;},produce(){},market(){},settle(f){f.profit=100;},sync(f){}});
 S.firms.push(dynamicFirm);
 runFirmPlanningPhase();
 matchCollectiveLaborMarket();
 const hasDynamicWorkers=typeof dynamicFirm.activeWorkers==="number";
 const bs812=generateBalanceSheets();
 test("8.12 Mercado de Trabalho Coletivo e Dinâmico sem viés setorial (Etapa B)",()=>({pass:hasDynamicWorkers&&S.firms.length===4&&bs812.audit.allPass&&auditCashConservation().ok,firmCount:S.firms.length,dynamicWorkers:dynamicFirm.activeWorkers,balanceSheetOk:bs812.audit.allPass,cashOk:auditCashConservation().ok}));

 // ETAPA C - MIGRAÇÃO DE FAZENDA E COMÉRCIO PARA O MOTOR GENÉRICO FIRM
 newGame();
 const farmFirm813=S.firms.find(f=>f.id==="farm");
 S.day=160;
 runFirmPlanningPhase();
 matchCollectiveLaborMarket();
 const prodRes813=farmFirm813.behavior.produce(farmFirm813,{day:S.day,fx:S.fx,weatherFactor:S.weatherFactor});
 const stockAfterProduce=farmFirm813.inventory.quantity;
 const cashBeforeMarket=balance(farmFirm813.account);
 const mktRevenue813=farmFirm813.behavior.market(farmFirm813,{day:S.day});
 const cashAfterMarket=balance(farmFirm813.account);
 const settleCtx813={policy:S.policy,monthNumber:S.monthNumber};
 farmFirm813.behavior.settle(farmFirm813,settleCtx813);
 const bs813=generateBalanceSheets();
 test("8.13 Migração da Fazenda para Firm e Ciclo Produtivo/Comercial Integrado (Etapa C)",()=>({
  pass:farmFirm813&&farmFirm813.behavior&&typeof farmFirm813.behavior.produce==="function"&&
       prodRes813.yieldQty>0&&stockAfterProduce>0&&
       mktRevenue813>0&&cashAfterMarket-cashBeforeMarket===mktRevenue813&&
       farmFirm813.inventory.quantity===0&&farmFirm813.revenue===mktRevenue813&&
       bs813.audit.allPass&&auditCashConservation().ok,
  yieldQty:prodRes813.yieldQty,
  stockAfterProduce,
  mktRevenue:mktRevenue813,
  cashGained:cashAfterMarket-cashBeforeMarket,
  stockFinal:farmFirm813.inventory.quantity,
  balanceSheetOk:bs813.audit.allPass,
  cashOk:auditCashConservation().ok
 }));

 newGame();
 const commFirm814=S.firms.find(f=>f.id==="commerce");
 runFirmPlanningPhase();
 matchCollectiveLaborMarket();
 settleAllFirmWages();
 housing();
 updateMarketPrice();
 const unitNeed814=S.policy.basketCost/(USD_IMPORT*5*(1+BASE_MARKUP));
 const plans814=S.households.map(h=>({
  h,
  essential:(h.adults+h.children*0.7)*unitNeed814,
  desired:(h.adults+h.children*0.7)*unitNeed814,
  desiredServiceUnits:0,
  affordable:0,
  bought:0,
  serviceBought:0
 }));
 const demand814=plans814.reduce((n,p)=>n+p.desired,0);
 const prodRes814=commFirm814.behavior.produce(commFirm814,{demand:demand814,plans:plans814});
 const stockAfterProduce814=commFirm814.inventory.quantity;
 for(const p of plans814)p.affordable=Math.min(p.desired,p.h.cash/S.marketPrice);
 const commCashBeforeMkt=balance("commerce");
 const mktRes814=commFirm814.behavior.market(commFirm814,{plans:plans814});
 const commCashAfterMkt=balance("commerce");
 const settleCtx814={policy:S.policy,monthNumber:S.monthNumber};
 commFirm814.behavior.settle(commFirm814,settleCtx814);
 const bs814=generateBalanceSheets();
 test("8.14 Migração do Comércio para Firm e Abastecimento LES Integrado (Etapa C)",()=>({
  pass:commFirm814&&commFirm814.behavior&&typeof commFirm814.behavior.produce==="function"&&
       prodRes814.imported>0&&stockAfterProduce814>0&&
       mktRes814.soldTotal>0&&commCashAfterMkt>commCashBeforeMkt&&
       Math.abs(commFirm814.inventory.quantity-S.marketStock)<0.0001&&
       commFirm814.revenue===mktRes814.salesRevenue&&
       bs814.audit.allPass&&auditCashConservation().ok,
  imported:prodRes814.imported,
  stockAfterProduce:stockAfterProduce814,
  soldTotal:mktRes814.soldTotal,
  salesRevenue:mktRes814.salesRevenue,
  cashGained:commCashAfterMkt-commCashBeforeMkt,
  stockFinal:commFirm814.inventory.quantity,
  balanceSheetOk:bs814.audit.allPass,
  cashOk:auditCashConservation().ok
 }));

 // ETAPA D - MIGRAÇÃO DA OFICINA E INTEGRAÇÃO DEFINITIVA DA PADARIA
 newGame();
 const wsFirm815=S.firms.find(f=>f.id==="workshop");
 runFirmPlanningPhase();
 matchCollectiveLaborMarket();
 const prodRes815=wsFirm815.behavior.produce(wsFirm815);
 const plans815=S.households.map(h=>({
  h,
  essential:2,
  desired:2,
  desiredServiceUnits:0.5,
  affordable:2,
  bought:2,
  serviceBought:0
 }));
 S.households.forEach(h=>{log("external",accountKey(h),2000,"Injeção de liquidez teste serviços");});
 const mktRes815=wsFirm815.behavior.market(wsFirm815,{plans:plans815,servicePrice:180});
 const settleCtx815={policy:S.policy,monthNumber:S.monthNumber};
 wsFirm815.behavior.settle(wsFirm815,settleCtx815);
 const bs815=generateBalanceSheets();
 test("8.15 Migração da Oficina para Firm e Prestação de Serviços (Etapa D)",()=>({
  pass:wsFirm815&&wsFirm815.behavior&&typeof wsFirm815.behavior.produce==="function"&&
       prodRes815.capacity>0&&
       mktRes815.serviceConsumptionVal>0&&wsFirm815.revenue>=mktRes815.serviceConsumptionVal&&
       wsFirm815.ebitda!==undefined&&wsFirm815.profit!==undefined&&
       bs815.audit.allPass&&auditCashConservation().ok,
  capacity:prodRes815.capacity,
  serviceRevenue:mktRes815.serviceConsumptionVal,
  firmRevenue:wsFirm815.revenue,
  ebitda:wsFirm815.ebitda,
  profit:wsFirm815.profit,
  balanceSheetOk:bs815.audit.allPass,
  cashOk:auditCashConservation().ok
 }));

 newGame();
 const entryDone816=checkFirmEntryAndExit(true);
 const bakeryFirm816=S.firms.find(f=>f.id==="bakery");
 runFirmPlanningPhase();
 matchCollectiveLaborMarket();
 const prodRes816=bakeryFirm816.behavior.produce(bakeryFirm816);
 const plans816=S.households.map(h=>({
  h,
  essential:1,
  desired:1,
  desiredServiceUnits:0,
  affordable:1,
  bought:1,
  serviceBought:0
 }));
 S.households.forEach(h=>{log("external",accountKey(h),1000,"Injeção de liquidez teste panificação");});
 const mktRes816=bakeryFirm816.behavior.market(bakeryFirm816,{plans:plans816});
 const settleCtx816={policy:S.policy,monthNumber:S.monthNumber};
 bakeryFirm816.behavior.settle(bakeryFirm816,settleCtx816);
 closeMonth();
 const bs816=generateBalanceSheets();
 test("8.16 Integração da Padaria como Atividade Permanente no Motor Genérico (Etapa D)",()=>({
  pass:entryDone816&&bakeryFirm816&&bakeryFirm816.behavior&&
       prodRes816.batchYield>0&&
       mktRes816.sales>0&&bakeryFirm816.revenue>=mktRes816.sales&&
       S.firms.length===4&&
       S.lastDRE.firms.bakery!==undefined&&
       bs816.audit.allPass&&auditCashConservation().ok,
  firmCount:S.firms.length,
  batchYield:prodRes816.batchYield,
  sales:mktRes816.sales,
  revenue:bakeryFirm816.revenue,
  profit:bakeryFirm816.profit,
  balanceSheetOk:bs816.audit.allPass,
  cashOk:auditCashConservation().ok
 }));

  // TESTES DE REGRESSÃO DA ESTABILIZAÇÃO ECONÔMICA
 newGame();
 runFirmPlanningPhase();
 const laborAfterStabilization=matchCollectiveLaborMarket();
 const payrollStabilization=settleAllFirmWages();
 const firmsPayroll=S.firms.filter(f=>f.status!=="liquidated");
 const payrollTotal=round2(Object.values(payrollStabilization.byFirm).reduce((n,x)=>n+x.wagesDue,0));
 const payrollByFirmValid=firmsPayroll.every(f=>payrollStabilization.byFirm[f.id]&&payrollStabilization.byFirm[f.id].workers===f.activeWorkers);
 test("9.1 Folha salarial distribuída por empresa e setor",()=>({
  pass:firmsPayroll.length>=3&&laborAfterStabilization.occupied>0&&payrollByFirmValid&&
       Math.abs(payrollTotal-payrollStabilization.due)<0.01&&
       payrollStabilization.byFirm.farm.wagesDue>0&&
       payrollStabilization.byFirm.commerce.wagesDue>0&&
       payrollStabilization.byFirm.workshop.wagesDue>0&&auditCashConservation().ok,
  occupied:laborAfterStabilization.occupied,
  sectorWorkers:laborAfterStabilization.sectorWorkers,
  payrollDue:payrollStabilization.due,
  payrollByFirm:payrollStabilization.byFirm,
  cashOk:auditCashConservation().ok
 }));

 newGame();
 const macroSix=simulateMonths(6,false).nationalAccounts;
 test("9.2 Reconciliação do PIB pelas três óticas após seis meses",()=>({
  pass:!!macroSix&&macroSix.reconciliation?.reconciled&&
       Math.abs(macroSix.approaches.production-macroSix.approaches.income)<0.01&&
       Math.abs(macroSix.approaches.production-macroSix.approaches.expenditure)<0.01&&
       Number.isFinite(macroSix.reconciliation.inventoryChange),
  approaches:macroSix?.approaches,
  reconciliation:macroSix?.reconciliation
 }));

 newGame();
 S.lastDRE={treasury:{salaryTax:100,employerTax:50,profitTax:25,dividendsReceived:0,concessionOutorga:0,assetSales:1000,personnelExpenditure:100,socialHousing:0,stateFarmSupport:0,publicWorks:0,interestReceived:50}};
 S.lastLoanSettlement={byBorrower:{treasury:{interestPaid:250}}};
 const fiscalStabilization=calculateFiscalReport({rebuild:true});
 test("9.3 Resultado primário exclui alienação de ativos e resultado nominal incorpora juros",()=>({
  pass:fiscalStabilization.capitalRevenue===1000&&fiscalStabilization.primaryRevenue===175&&
       fiscalStabilization.primaryResult===75&&fiscalStabilization.netInterestExpense===200&&
       fiscalStabilization.nominalResult===-125,
  primaryRevenue:fiscalStabilization.primaryRevenue,
  capitalRevenue:fiscalStabilization.capitalRevenue,
  primaryResult:fiscalStabilization.primaryResult,
  netInterestExpense:fiscalStabilization.netInterestExpense,
  nominalResult:fiscalStabilization.nominalResult
 }));

 newGame();
 checkFirmEntryAndExit(true);
 log("external","bank",30000,"Capital bancário para teste de baixa genérica");
 const genericLoan=issueLoan("bakery",8000,"Crédito de teste da padaria");
 const genericDebtBefore=totalLoans("bakery");
 const genericBankLossBefore=S.lastBankCreditLosses||0;
 const genericWriteDown=writeDownLoansForBorrower("bakery",0.25);
 const genericDebtAfter=totalLoans("bakery");
 test("9.4 Baixa de crédito genérica para firma não legada",()=>({
  pass:genericLoan===8000&&Math.abs(genericWriteDown-genericDebtBefore*0.25)<0.05&&
       Math.abs(genericDebtAfter-genericDebtBefore*0.75)<0.05&&
       Math.abs((S.lastBankCreditLosses-genericBankLossBefore)-genericWriteDown)<0.05&&auditCashConservation().ok,
  loan:genericLoan,
  debtBefore:genericDebtBefore,
  writeDown:genericWriteDown,
  debtAfter:genericDebtAfter,
  cashOk:auditCashConservation().ok
 }));

 newGame();
 const cooperativeEvent=window.EventosV3?.EVENTOS.find(ev=>ev.id==="cooperativa");
 if(cooperativeEvent){
  S.eventEngine.ativos.push({id:"cooperativa",sev:"media",mesesRestantes:2,fator:1,respondido:false});
  window.EventosV3.recalcularModificadores(S.eventEngine);
  syncPendingEventPrompt();
 }
 const eventCashBefore=balance(farmAccount());
 const eventPromptReady=S.event?.engineEventId==="cooperativa";
 const eventAccepted=resolveEventChoice("cooperativa","entrar");
 const eventCashAfter=balance(farmAccount());
 test("9.5 Evento integrado: escolha altera estado, movimenta caixa e preserva SFC",()=>({
  pass:eventPromptReady&&eventAccepted&&S.eventEngine.cooperativa===true&&
       Math.abs(eventCashBefore-eventCashAfter-500)<0.01&&auditCashConservation().ok&&
       generateBalanceSheets().audit.allPass,
  prompt:eventPromptReady,accepted:eventAccepted,cooperative:S.eventEngine.cooperativa,
  cashSpent:round2(eventCashBefore-eventCashAfter),cashOk:auditCashConservation().ok
 }));

 newGame();
 log("external","treasury",50000,"Reserva fiscal para teste de capital de giro");
 log("external","bank",30000,"Liquidez bancária para teste de crédito sazonal");
 log("stateFarm","external",balance("stateFarm"),"Zerar liquidez da fazenda para testar reserva de dívida");
 const seasonalLoan=issueLoan("stateFarm",8000,"teste de financiamento operacional");
 const supportWithDebt=supportStateFarm();
 const debtReservePlan=S.lastWorkingCapitalPlan;
 test("9.6 Capital de giro inclui serviço da dívida sem romper o caixa",()=>({
  pass:seasonalLoan===8000&&debtReservePlan.debtServiceReserve>0&&
       Math.abs(debtReservePlan.target-(debtReservePlan.payrollReserve+debtReservePlan.housingReserve+debtReservePlan.inputReserve+debtReservePlan.debtServiceReserve))<0.01&&
       supportWithDebt>0&&auditCashConservation().ok&&generateBalanceSheets().audit.allPass,
  loan:seasonalLoan,debtServiceReserve:debtReservePlan.debtServiceReserve,
  workingCapitalTarget:debtReservePlan.target,support:supportWithDebt,cashOk:auditCashConservation().ok
 }));

 newGame();
 const naturalRun=simulateMonths(120,false);
 const naturalBalance=generateBalanceSheets();
 const naturalMacro=S.lastNationalAccounts||calculateNationalAccounts();
 test("9.7 Simulação natural de longo prazo com parada por regra de jogo e auditorias",()=>({
  pass:naturalRun.monthNumber>=12&&naturalRun.monthNumber<=120&&
       (!!S.gameOver||naturalRun.monthNumber===120)&&naturalBalance.audit.allPass&&
       naturalBalance.audit.cashOk&&Math.abs(naturalBalance.audit.cashAudit.difference)<0.01&&
       naturalMacro.reconciliation?.reconciled,
  months:naturalRun.monthNumber,
  gameOver:S.gameOver||null,
  sfcOk:naturalBalance.audit.allPass,
  cashDifference:naturalBalance.audit.cashAudit.difference,
  nationalAccounts:naturalMacro.approaches,
  macroReconciled:naturalMacro.reconciliation?.reconciled
 }));

 return{passed:results.filter(r=>r.passed).length,total:results.length,results};}
window.VilarejoTest={runStressTests,stateSnapshot,generateBalanceSheets,supportStateFarm,processMonthlyEvents,resolveEventChoice,getFirms,getLaborStats,getBankPortfolioStats,matchLaborMarket,matchCollectiveLaborMarket,runFirmPlanningPhase,runFirmProductionPhase,runFirmCommercializationPhase,runFirmSettlementPhase,settleAllFirmWages,migrateLoan,migrateLoans,commerceLoanWriteDown,writeDownLoansForBorrower,updateCommerceInsolvency,totalLoans,issueLoan,settleBankLoans,calculateFirmValuation,sellFarmStake,distributeFirmDividends,settleConcessionOutorga,calculateNationalAccounts,calculateFiscalReport,calculateProjectNPV,borrowerRiskPremium,updateUrbanInfrastructure,investInInfrastructure,processHarrisTodaroMigration,checkFirmEntryAndExit,liquidateInsolventFirm,round2,reset:()=>{pause();policiesBuilt=false;newGame();actions()},resetWithSeed:(seed)=>{pause();policiesBuilt=false;newGame();S.seed=Number(seed)>>>0;if(S.eventEngine)S.eventEngine.semente=S.seed;actions()},setPolicy:(k,v)=>{S.policy[k]=v},simulateMonths,availableCredit,getCoreSnapshot:()=>CORE_RUNTIME?CORE_RUNTIME.snapshot():null,getCoreHistory:topic=>CORE_RUNTIME?CORE_RUNTIME.events.getHistory(topic?{topic}:{}):[],getCoreEventCount:topic=>CORE_RUNTIME?CORE_RUNTIME.events.count(topic):0};
newGame();actions();
