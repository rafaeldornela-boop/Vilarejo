"use strict";
/*
 * Integra a camada de Sociedade v0.3 sobre a Evolução Social v0.2.
 * Execute na raiz do projeto: node integrar_vilarejo_v03.js
 * O instalador v0.2 é aplicado primeiro, caso ainda não esteja aplicado.
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const ROOT = process.cwd();
const required = [
  "index.html", "script.js", "test_runner.js", "package.json", "evolucao_social.js",
  "evolucao_social.test.js", "evolucao_social.integration.test.js",
  "village_evolution_ui.js", "integrar_vilarejo_v02.js",
  "sociedade_v03.js", "sociedade_v03.test.js", "sociedade_v03.integration.test.js"
];
for (const file of required) if (!fs.existsSync(path.join(ROOT, file))) throw new Error("Arquivo obrigatório ausente: " + file);

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error("Ponto de integração não encontrado em " + label + ": " + before.slice(0, 120));
  if (source.indexOf(before, first + before.length) >= 0) throw new Error("Ponto duplicado em " + label + ". Aplicação cancelada.");
  return source.slice(0, first) + after + source.slice(first + before.length);
}
function backup(file, content) {
  const dir = path.join(ROOT, ".vilarejo-backup-v03");
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, file.replaceAll("/", "__") + ".bak");
  if (!fs.existsSync(target)) fs.writeFileSync(target, content, "utf8");
}

// Confere a versão econômica antes de permitir que o instalador v0.2 faça qualquer alteração.
const originalScript = fs.readFileSync(path.join(ROOT, "script.js"), "utf8");
const expectedEngineAnchors = [
  "function processHarrisTodaroMigration(){",
  "S.households.splice(S.households.indexOf(candidate),1);"
];
for (const anchor of expectedEngineAnchors) {
  if (!originalScript.includes(anchor)) throw new Error("Versão incompatível do motor econômico. Ponto ausente: " + anchor.slice(0, 100) + ". A instalação foi interrompida sem aplicar a base v0.2.");
}
if (!originalScript.includes("processHarrisTodaroMigration();\n checkFirmEntryAndExit();") && !originalScript.includes("window.VilarejoSociety.advanceMonth(S,")) {
  throw new Error("Versão incompatível: não encontrei o fechamento mensal nem a integração demográfica já aplicada.");
}
if (!originalScript.includes("const id=++S.migrantCount;") && !originalScript.includes("const id=Math.max(Number(S.migrantCount)||0,...S.households.map(h=>Number(h.id)||0))+1;")) {
  throw new Error("Versão incompatível: não encontrei a geração do identificador de migrantes.");
}

// Instala a base social v0.2 se necessário. O instalador é idempotente.
const baseInstall = spawnSync(process.execPath, [path.join(ROOT, "integrar_vilarejo_v02.js")], { cwd: ROOT, encoding: "utf8" });
if (baseInstall.status !== 0) {
  process.stderr.write(baseInstall.stdout || "");
  process.stderr.write(baseInstall.stderr || "");
  throw new Error("A instalação da base v0.2 falhou. Nenhuma alteração v0.3 foi aplicada.");
}

let script = fs.readFileSync(path.join(ROOT, "script.js"), "utf8");
let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
let runner = fs.readFileSync(path.join(ROOT, "test_runner.js"), "utf8");
const packageOriginal = fs.readFileSync(path.join(ROOT, "package.json"), "utf8");
let packageJson = JSON.parse(packageOriginal);

// 1. Corrige a colisão de IDs na entrada de migrantes: o ID precisa ser maior que todos os domicílios existentes.
const oldMigrantId = "const id=++S.migrantCount;";
const newMigrantId = "const id=Math.max(Number(S.migrantCount)||0,...S.households.map(h=>Number(h.id)||0))+1;S.migrantCount=id;";
if (!script.includes(newMigrantId)) script = replaceOnce(script, oldMigrantId, newMigrantId, "script.js (ID único de migrante)");

// 2. Vincula o novo imigrante ao cadastro individual e registra sua origem cultural.
const migrantPush = "S.households.push(newH);";
const immigrantHook = 'window.VilarejoSociety.prepareImmigrant(S,newH,{month:S.monthNumber+1,reason:"atratividade econômica local"});S.households.push(newH);';
if (!script.includes(immigrantHook)) script = replaceOnce(script, migrantPush, immigrantHook, "script.js (entrada migratória)");

// 3. Registra a composição demográfica e cultural antes de remover um domicílio emigrante.
const departureHook = 'window.VilarejoSociety.recordDeparture(S,candidate,{month:S.monthNumber+1,reason:"atratividade econômica externa"});S.households.splice(S.households.indexOf(candidate),1);';
if (!script.includes(departureHook)) script = replaceOnce(script, "S.households.splice(S.households.indexOf(candidate),1);", departureHook, "script.js (saída migratória)");

// 4. Inicializa pessoas individuais sem substituir as unidades financeiras S.households.
const initAnchor = "S.socialEvolution=window.VilarejoEvolution.createState();syncSocialEvolution(true,0);";
if (!script.includes("window.VilarejoSociety.initialize(S,")) {
  script = replaceOnce(script, initAnchor, initAnchor + "window.VilarejoSociety.initialize(S,{getLaborStats,approval});", "script.js (nova partida)");
}

// 5. Avança demografia, integração cultural e IQV no fechamento mensal, depois das decisões migratórias.
const monthAnchor = "processHarrisTodaroMigration();\n checkFirmEntryAndExit();";
const monthHook = `processHarrisTodaroMigration();
 const societyResult=window.VilarejoSociety.advanceMonth(S,{month:S.monthNumber+1,random:rand,getLaborStats,approval});
 societyResult.events.forEach(event=>feed(event.message));
 checkFirmEntryAndExit();`;
if (!script.includes("window.VilarejoSociety.advanceMonth(S,")) script = replaceOnce(script, monthAnchor, monthHook, "script.js (fechamento mensal)");

// 6. Exibe o novo painel e oferece um snapshot de diagnóstico sem expor objetos mutáveis.
const renderAnchor = "renderPolicies();renderExtendedDashboard();renderSocialEvolution()}";
const renderHook = 'renderPolicies();renderExtendedDashboard();window.VilarejoSociety.renderDashboard(S,$("societyMetrics"));renderSocialEvolution()}';
if (!script.includes("renderDashboard(S,$(\"societyMetrics\"))")) script = replaceOnce(script, renderAnchor, renderHook, "script.js (painel de sociedade)");
const apiAnchor = "window.VilarejoTest={runStressTests,getSocialEvolution:getSocialEvolutionSnapshot,stateSnapshot,";
const apiHook = "window.VilarejoTest={runStressTests,getSocialEvolution:getSocialEvolutionSnapshot,getSocietySnapshot:()=>window.VilarejoSociety.overview(S),stateSnapshot,";
if (!script.includes("getSocietySnapshot:")) script = replaceOnce(script, apiAnchor, apiHook, "script.js (API de diagnóstico)");

// 7. Adiciona painel, estilos e carregamento do módulo antes do script econômico.
const css = `
/* Sociedade v0.3: demografia, cultura, migração e qualidade de vida */
.soc03-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid var(--line)}
.soc03-score{font-size:2.15rem;font-weight:bold;line-height:1.05;font-variant-numeric:tabular-nums}.soc03-score small{font-size:.9rem;color:var(--muted)}
.soc03-muted{font-size:.74rem;color:var(--muted);margin:5px 0}.soc03-top-meta{display:grid;grid-template-columns:repeat(4,minmax(72px,1fr));gap:7px}
.soc03-top-meta>div{display:grid;padding:6px 8px;border:1px solid var(--line);border-radius:5px}.soc03-top-meta b{font-size:1rem}.soc03-top-meta span{font-size:.68rem;color:var(--muted)}
.soc03-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:10px}.soc03-grid section{min-width:0}.soc03-grid h3{font-size:.88rem;border-bottom:1px solid var(--line);padding-bottom:5px;margin:4px 0 7px}
.soc03-component{display:grid;grid-template-columns:1fr auto;gap:3px 8px;padding:5px 0;font-size:.76rem}.soc03-component b{font-variant-numeric:tabular-nums}.soc03-bar{grid-column:1/-1;height:5px;background:rgba(128,128,128,.18);border-radius:5px;overflow:hidden}.soc03-bar i{display:block;height:100%;background:var(--green)}
.soc03-row{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px dotted var(--line);font-size:.75rem}.soc03-row span{color:var(--muted)}.soc03-row b{text-align:right}.soc03-foot{font-size:.69rem;color:var(--muted);margin:10px 0 0}
@media(max-width:420px){.soc03-top-meta{grid-template-columns:repeat(2,minmax(80px,1fr))}.soc03-score{font-size:1.85rem}}
`;
if (!html.includes(".soc03-top{")) html = replaceOnce(html, "</style>", css + "\n</style>", "index.html (estilos de sociedade)");
const v02Panel = '<section class="box" id="villageEvolutionPanel" aria-live="polite"><h2>Desenvolvimento do vilarejo</h2><div id="villageEvolutionContent"></div></section>';
const v03Panel = v02Panel + '\n<section class="box" id="societyMetrics" aria-live="polite"><h2>Sociedade, cultura e qualidade de vida</h2><div class="soc03-muted">Indicadores sociais atualizados a cada fechamento mensal.</div></section>';
if (!html.includes('id="societyMetrics"')) html = replaceOnce(html, v02Panel, v03Panel, "index.html (painel de sociedade)");
if (!html.includes('src="sociedade_v03.js"')) html = replaceOnce(html, '<script src="script.js"></script>', '<script src="sociedade_v03.js"></script>\n<script src="script.js"></script>', "index.html (carregamento da sociedade)");
html = html.replaceAll("v2.4", "v2.5");
html = html.replace("Versão 2.4 (Reforma Contábil e Arquitetura Empresarial)", "Versão 2.5 (Demografia, Cultura e Qualidade de Vida)");
packageJson.version = "2.5.0";
packageJson.description = "Vilarejo - Simulação econômica v2.5: demografia, cultura, migração e qualidade de vida.";

// 8. Acrescenta as suítes v0.3 ao executor oficial de testes.
if (!runner.includes("const societyCode = fs.readFileSync('sociedade_v03.js', 'utf8');")) {
  runner = replaceOnce(runner, "const evolutionCode = fs.readFileSync('evolucao_social.js', 'utf8');\n", "const evolutionCode = fs.readFileSync('evolucao_social.js', 'utf8');\nconst societyCode = fs.readFileSync('sociedade_v03.js', 'utf8');\n", "test_runner.js (leitura da sociedade)");
}
if (!runner.includes("win.eval(societyCode)")) {
  runner = replaceOnce(runner, "win.eval(evolutionCode);\nwin.eval(scriptCode);", "win.eval(evolutionCode);\nwin.eval(societyCode);\nwin.eval(scriptCode);", "test_runner.js (carregamento da sociedade)");
}
if (!runner.includes("const societyTests = require('./sociedade_v03.test')();")) {
  runner = replaceOnce(runner,
    "const integrationTests = require('./evolucao_social.integration.test')();",
    "const integrationTests = require('./evolucao_social.integration.test')();\nconst societyTests = require('./sociedade_v03.test')();\nconst societyIntegrationTests = require('./sociedade_v03.integration.test')();",
    "test_runner.js (novas suítes)");
  runner = replaceOnce(runner,
    "[['Evolução Social', evolutionTests], ['Integração Social', integrationTests]]",
    "[['Evolução Social v0.2', evolutionTests], ['Integração Social v0.2', integrationTests], ['Sociedade v0.3', societyTests], ['Integração Sociedade v0.3', societyIntegrationTests]]",
    "test_runner.js (rótulos das suítes)");
  runner = replaceOnce(runner,
    "if (res.passed !== res.total || evolutionTests.passed !== evolutionTests.total || integrationTests.passed !== integrationTests.total) {",
    "if ([res, evolutionTests, integrationTests, societyTests, societyIntegrationTests].some(suite => suite.passed !== suite.total)) {",
    "test_runner.js (critério de aprovação)");
}

// 9. Valida a integração em memória antes de escrever arquivos.
for (const [label, condition] of [
  ["ID único", script.includes(newMigrantId)],
  ["registro de imigração", script.includes("VilarejoSociety.prepareImmigrant")],
  ["registro de emigração", script.includes("VilarejoSociety.recordDeparture")],
  ["inicialização demográfica", script.includes("VilarejoSociety.initialize(S,")],
  ["ciclo demográfico mensal", script.includes("VilarejoSociety.advanceMonth(S,")],
  ["painel de qualidade de vida", script.includes('renderDashboard(S,$("societyMetrics"))')],
  ["script da sociedade", html.includes('src="sociedade_v03.js"')],
  ["painel da sociedade", html.includes('id="societyMetrics"')],
  ["teste unitário v0.3", runner.includes("sociedade_v03.test")],
  ["teste integração v0.3", runner.includes("sociedade_v03.integration.test")]
]) if (!condition) throw new Error("Validação final falhou: " + label);
new Function(script);
new Function(runner);

// 10. Backups e gravação atômica.
const packageText = JSON.stringify(packageJson, null, 2) + "\n";
for (const [file, content] of Object.entries({ "script.js": script, "index.html": html, "test_runner.js": runner })) backup(file, content);
backup("package.json", packageOriginal);
for (const [file, content] of Object.entries({ "script.js": script, "index.html": html, "test_runner.js": runner, "package.json": packageText })) {
  const temp = path.join(ROOT, file + ".v03.tmp");
  fs.writeFileSync(temp, content, "utf8");
  fs.renameSync(temp, path.join(ROOT, file));
}
console.log("Sociedade v0.3 integrada sobre a base Evolução Social v0.2.");
console.log("Atualizados: script.js, index.html, test_runner.js e package.json.");
console.log("Backups: .vilarejo-backup-v02/ e .vilarejo-backup-v03/.");
console.log("Execute npm test. Não publique se qualquer teste falhar.");
