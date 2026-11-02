#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const destinationArg = process.argv[2];

if (!destinationArg) {
  console.error("Uso: node scripts/install.js /caminho/para/Vilarejo");
  process.exit(1);
}

const repoRoot = path.resolve(destinationArg);
const economyFile = path.join(repoRoot, "src/economy/script.js");
if (!fs.existsSync(economyFile) || !fs.existsSync(path.join(repoRoot, "src/core/vilarejo_core.js"))) {
  console.error("A pasta informada não parece ser a raiz do repositório Vilarejo.");
  process.exit(1);
}

let economy = fs.readFileSync(economyFile, "utf8");
function replaceOnce(source, search, replacement, description) {
  const first = source.indexOf(search);
  if (first < 0 || source.indexOf(search, first + search.length) >= 0) {
    throw new Error("Não foi possível aplicar a integração com segurança: marcador ausente ou duplicado (" + description + "). Nenhum arquivo foi alterado.");
  }
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

function replaceRegexOnce(source, pattern, replacement, description) {
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g"))];
  if (matches.length !== 1) {
    throw new Error("Não foi possível aplicar a integração com segurança: marcador ausente ou duplicado (" + description + "). Nenhum arquivo foi alterado.");
  }
  return source.replace(pattern, replacement);
}

const adapter = String.raw`
function recordDashboardHistory(){
 if(!Array.isArray(S.dashboardHistory))S.dashboardHistory=[];
 const labor=getLaborStats();
 const macro=S.lastNationalAccounts||calculateNationalAccounts();
 const fiscal=S.lastFiscalReport||calculateFiscalReport();
 const minimumWage=Math.max(1,Number(S.policy?.minimumWage)||1500);
 const costIndex=Math.max(1,Number(S.costOfLivingIndex)||100);
 const incomes=[];
 (S.households||[]).forEach(h=>{
  const people=Math.max(0,(Number(h.adults)||0)+(Number(h.children)||0));
  if(people===0)return;
  const perCapita=Math.max(0,Number(h.lastCashIncome??h.cashIncome)||0)/people;
  for(let i=0;i<people;i++)incomes.push(perCapita);
 });
 incomes.sort((a,b)=>a-b);
 const incomeTotal=incomes.reduce((sum,value)=>sum+value,0);
 const weightedIncome=incomes.reduce((sum,value,index)=>sum+(index+1)*value,0);
 const incomeGini=incomeTotal>0&&incomes.length>0?Math.max(0,(2*weightedIncome/(incomes.length*incomeTotal))-((incomes.length+1)/incomes.length))*100:0;
 S.dashboardHistory.push({
  month:S.monthNumber,label:"M"+S.monthNumber,
  gdp:Number(macro.approaches?.production??macro.gdp)||0,
  inflation:Number(S.monthlyInflation)||0,
  unemployment:Number(labor.unemploymentRate)||0,
  approval:Number(approval())||0,
  population:population(),consumption:Number(S.lastConsumption)||0,
  costIndex,
  realWageIndex:(Number(S.wage)||0)/minimumWage/(costIndex/100)*100,
  primaryResult:Number(fiscal.primaryResult)||0,
  taxRevenue:(Number(fiscal.tributaryRevenue)||0)+(Number(fiscal.nonTributaryRevenue)||0),
  primaryExpenditure:Number(fiscal.primaryExpenditure)||0,
  governmentDebt:totalLoans("treasury"),incomeGini
 });
 if(S.dashboardHistory.length>60)S.dashboardHistory=S.dashboardHistory.slice(-60);
}

function getDashboardSnapshot(){
 const labor=getLaborStats();
 const macro=S.lastNationalAccounts||calculateNationalAccounts();
 const fiscal=S.lastFiscalReport||calculateFiscalReport();
 const bank=getBankPortfolioStats();
 return {
  day:S.day,monthNumber:S.monthNumber,year:Math.floor(S.day/YEAR)+1,
  sessionId:CORE_RUNTIME?CORE_RUNTIME.session.get().id:"session-local",
  running:!!timer,gameOver:S.gameOver||null,
  population:population(),employed:Number(labor.occupied)||0,
  unemployment:Number(labor.unemploymentRate)||0,approval:Number(approval())||0,
  housingCapacity:Number(S.housingCapacity)||0,buildings:(S.buildings||[]).length,lots:Number(S.lots)||0,
  treasury:balance("treasury"),inflation:Number(S.monthlyInflation)||0,
  gdp:Number(macro.approaches?.production??macro.gdp)||0,
  marketPrice:Number(S.marketPrice)||0,costIndex:Number(S.costOfLivingIndex)||100,
  wage:Number(S.wage)||0,primaryResult:Number(fiscal.primaryResult)||0,
  defaultRate:Number(bank.defaultRate)||0,bankCash:balance("bank"),
  deposits:totalDeposits(),loans:totalLoans(),marketStock:Number(S.marketStock)||0,
  shortage:Number(S.lastShortageUnits)||0,
  history:(S.dashboardHistory||[]).map(point=>({...point}))
 };
}

`;

economy = replaceOnce(
  economy,
  "unemploymentHistory:[0],currentMonthTracking",
  "unemploymentHistory:[0],dashboardHistory:[],currentMonthTracking",
  "inicialização do histórico"
);
economy = replaceOnce(
  economy,
  "function closeMonth(){",
  adapter + "function closeMonth(){",
  "ponto de inserção do adaptador"
);
economy = replaceRegexOnce(
  economy,
  /([ \t]*updateCommerceInsolvency\(\);[ \t]*\r?\n[ \t]*publishEconomyMonthClosed\(\);)/,
  (match) => match.replace(/publishEconomyMonthClosed\(\);/, "recordDashboardHistory();\n  publishEconomyMonthClosed();"),
  "captura mensal"
);
economy = replaceOnce(
  economy,
  "renderPolicies();renderExtendedDashboard()}",
  "renderPolicies();renderExtendedDashboard();if(window.VilarejoDashboard&&typeof window.VilarejoDashboard.refresh===\"function\")window.VilarejoDashboard.refresh()}",
  "atualização visual"
);
economy = replaceOnce(
  economy,
  "\nnewGame();actions();",
  "\nwindow.VilarejoTest.getDashboardSnapshot=getDashboardSnapshot;\nnewGame();actions();",
  "exposição do retrato de dados"
);

const copies = [
  ["index.html", "index.html"],
  ["style.css", "style.css"],
  ["src/ui/dashboard.js", "src/ui/dashboard.js"]
];
for (const [source, destination] of copies) {
  const from = path.join(packageRoot, source);
  const to = path.join(repoRoot, destination);
  if (!fs.existsSync(from)) throw new Error("Arquivo do pacote ausente: " + source);
  fs.mkdirSync(path.dirname(to), { recursive: true });
}

// Backup fora do repositório para facilitar a reversão sem poluir o Git.
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(path.dirname(repoRoot), "Vilarejo-backup-redesign-" + stamp);
fs.mkdirSync(backupRoot, { recursive: true });
const backupTargets = ["index.html", "style.css", "src/economy/script.js"];
for (const relative of backupTargets) {
  const source = path.join(repoRoot, relative);
  if (fs.existsSync(source)) {
    const target = path.join(backupRoot, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}

for (const [source, destination] of copies) {
  fs.copyFileSync(path.join(packageRoot, source), path.join(repoRoot, destination));
}
fs.writeFileSync(economyFile, economy, "utf8");

console.log("Redesign instalado com sucesso.");
console.log("Arquivos atualizados: index.html, style.css, src/ui/dashboard.js, src/economy/script.js");
console.log("Backup criado em: " + backupRoot);
console.log("O motor econômico foi preservado. A integração apenas registra snapshots mensais e os fornece à interface.");
console.log("Execute: npm run build && npm test");
