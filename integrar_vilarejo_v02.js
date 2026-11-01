"use strict";
/*
 * Integração do módulo Evolução Social v0.2.
 * Execute na raiz do repositório: node integrar_vilarejo_v02.js
 * Valida todos os pontos antes de gravar e preserva backups locais.
 */
const fs = require("node:fs");
const path = require("node:path");
const ROOT = process.cwd();
const required = ["index.html", "script.js", "test_runner.js", "evolucao_social.js", "evolucao_social.test.js", "evolucao_social.integration.test.js", "village_evolution_ui.js"];
for (const file of required) if (!fs.existsSync(path.join(ROOT, file))) throw new Error("Arquivo obrigatório ausente: " + file);

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error("Ponto de integração não encontrado em " + label + ": " + before.slice(0, 100));
  if (source.indexOf(before, first + before.length) >= 0) throw new Error("Ponto duplicado em " + label + ". Aplicação cancelada.");
  return source.slice(0, first) + after + source.slice(first + before.length);
}
function backup(file, content) {
  const dir = path.join(ROOT, ".vilarejo-backup-v02");
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, file.replaceAll("/", "__") + ".bak");
  if (!fs.existsSync(target)) fs.writeFileSync(target, content, "utf8");
}

let script = fs.readFileSync(path.join(ROOT, "script.js"), "utf8");
let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
let runner = fs.readFileSync(path.join(ROOT, "test_runner.js"), "utf8");
const ui = fs.readFileSync(path.join(__dirname, "village_evolution_ui.js"), "utf8").trim();

// 1. Atualiza a camada de apresentação/sincronização, tanto em instalação limpa quanto v0.1.
const oldUiStart = script.indexOf("function syncSocialEvolution(");
if (oldUiStart >= 0) {
  const oldUiEnd = script.indexOf("function round2(", oldUiStart);
  if (oldUiEnd < 0) throw new Error("Não encontrei o fim da camada social antiga antes de function round2().");
  script = script.slice(0, oldUiStart) + ui + "\n" + script.slice(oldUiEnd);
} else {
  const anchor = 'function employed(){return S.households.reduce((n,h)=>n+h.jobs,0)}\n';
  script = replaceOnce(script, anchor, anchor + ui + "\n", "script.js (inserção da camada social)");
}

// 2. Inicializa depois do cálculo inicial de emprego e infraestrutura para registrar a fotografia correta.
const earlyV01Init = "initFirms();S.socialEvolution=window.VilarejoEvolution.createState();syncSocialEvolution(true,0);salaryCalc();updateEmploymentCapacity();";
if (script.includes(earlyV01Init)) {
  script = replaceOnce(script, earlyV01Init, "initFirms();salaryCalc();updateEmploymentCapacity();", "script.js (migração da inicialização v0.1)");
}
if (!script.includes("S.socialEvolution=window.VilarejoEvolution.createState()")) {
  const initTail = "matchLaborMarket();updateUrbanInfrastructure();syncFirmState();auditCashConservation();render()}";
  script = replaceOnce(script, initTail, "matchLaborMarket();updateUrbanInfrastructure();S.socialEvolution=window.VilarejoEvolution.createState();syncSocialEvolution(true,0);syncFirmState();auditCashConservation();render()}", "script.js (nova partida)");
}

// 3. Atualiza a camada no fechamento mensal.
if (!script.includes("syncSocialEvolution(false,S.monthNumber)")) {
  script = replaceOnce(script, "S.monthNumber++;const debt=totalWageDebt();", "S.monthNumber++;syncSocialEvolution(false,S.monthNumber);const debt=totalWageDebt();", "script.js (fechamento mensal)");
}

// 4. Atualiza a apresentação em conjunto com o painel econômico.
if (!script.includes("renderSocialEvolution()}")) {
  script = replaceOnce(script, "renderPolicies();renderExtendedDashboard()}", "renderPolicies();renderExtendedDashboard();renderSocialEvolution()}", "script.js (renderização)");
}

// 5. Expõe snapshot somente de leitura para testes/diagnóstico.
if (!script.includes("getSocialEvolution:getSocialEvolutionSnapshot")) {
  script = replaceOnce(script, "window.VilarejoTest={runStressTests,stateSnapshot,", "window.VilarejoTest={runStressTests,getSocialEvolution:getSocialEvolutionSnapshot,stateSnapshot,", "script.js (API de testes)");
}

// 6. Camada visual editorial. Não altera os componentes econômicos existentes.
const css = `
.evo2-top{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;flex-wrap:wrap;margin-bottom:10px}.evo2-kicker{font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}.evo2-phase{font-size:1.25rem;font-weight:bold;color:var(--green)}.evo2-scale{display:flex;gap:5px;align-items:baseline;font-size:.78rem;color:var(--muted)}.evo2-scale b{font-size:1rem;color:var(--ink)}.evo2-progress{display:grid;gap:3px;padding:8px 10px;background:rgba(128,128,128,.08);border:1px solid var(--line);border-radius:5px;font-size:.8rem;margin-bottom:10px}.evo2-paper{border:1px solid var(--line);background:var(--panel);padding:12px;border-radius:5px;margin:8px 0 12px}.evo2-paper-head{display:flex;justify-content:space-between;gap:8px;align-items:center;border-bottom:2px solid var(--ink);padding-bottom:6px;font-family:Georgia,serif;font-weight:bold}.evo2-paper-head span{font-size:1.08rem;letter-spacing:.02em}.evo2-paper-head small{font-size:.68rem;color:var(--muted);font-weight:normal}.evo2-headline{font-size:1.12rem;line-height:1.25;margin:10px 0 4px}.evo2-subhead{font-size:.84rem;color:var(--muted);margin:0 0 10px}.evo2-articles{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px}.evo2-article{border-top:1px solid var(--line);padding:8px 2px 2px;min-width:0}.evo2-article h3{font-size:.9rem;margin:3px 0 5px}.evo2-article p{font-size:.78rem;margin:3px 0}.evo2-category{font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}.evo2-recommendation{display:grid;gap:2px;font-size:.73rem;border-left:2px solid var(--gold);padding-left:7px;margin-top:7px}.evo2-critica h3{color:var(--red)}.evo2-atencao h3{color:var(--gold)}.evo2-quiet,.evo2-muted{font-size:.78rem;color:var(--muted)}.evo2-two-col{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.evo2-section{min-width:0}.evo2-section>h3{font-size:.88rem;border-bottom:1px solid var(--line);padding-bottom:5px}.evo2-need,.evo2-institution{padding:6px 0;border-bottom:1px dotted var(--line);font-size:.78rem}.evo2-need>div,.evo2-institution>div{display:flex;justify-content:space-between;gap:8px;align-items:baseline}.evo2-need p,.evo2-institution p{margin:3px 0 0;color:var(--muted);font-size:.72rem}.evo2-status{font-size:.68rem;padding:1px 5px;border:1px solid var(--line);border-radius:4px;white-space:nowrap}.evo2-atencao{color:var(--gold)}.evo2-critica{color:var(--red)}.evo2-normal{color:var(--green)}.evo2-sem_dados{color:var(--muted)}.evo2-data-note,.evo2-foot{font-size:.7rem;color:var(--muted);margin:8px 0 0}.evo2-chips{display:flex;gap:5px;flex-wrap:wrap}.evo2-chip{font-size:.7rem;padding:4px 6px;border:1px solid var(--line);border-radius:4px}.evo2-section h4{font-size:.76rem;margin:12px 0 3px}
`;
if (!html.includes(".evo2-paper{")) {
  html = replaceOnce(html, ".bal-row:last-child{border:0;font-weight:bold}\n", ".bal-row:last-child{border:0;font-weight:bold}\n" + css, "index.html (estilos)");
}
if (!html.includes('id="villageEvolutionPanel"')) {
  html = replaceOnce(html, '<section class="pillars" id="pillars" aria-label="Indicadores macroeconômicos"></section>\n', '<section class="pillars" id="pillars" aria-label="Indicadores macroeconômicos"></section>\n<section class="box" id="villageEvolutionPanel" aria-live="polite"><h2>Desenvolvimento do vilarejo</h2><div id="villageEvolutionContent"></div></section>\n', "index.html (painel)");
} else if (!html.includes('id="villageEvolutionContent"')) {
  throw new Error("O painel social existe, mas o contêiner villageEvolutionContent não foi encontrado.");
}
if (!html.includes('src="evolucao_social.js"')) {
  html = replaceOnce(html, '<script src="script.js"></script>', '<script src="evolucao_social.js"></script>\n<script src="script.js"></script>', "index.html (carregamento do módulo)");
}

// 7. Carrega o módulo antes do motor econômico e executa as duas suítes adicionais.
if (!runner.includes("const evolutionCode = fs.readFileSync('evolucao_social.js', 'utf8');")) {
  runner = replaceOnce(runner, "const scriptCode = fs.readFileSync('script.js', 'utf8');\n", "const scriptCode = fs.readFileSync('script.js', 'utf8');\nconst evolutionCode = fs.readFileSync('evolucao_social.js', 'utf8');\n", "test_runner.js (leitura do módulo)");
}
if (!runner.includes("win.eval(evolutionCode)")) {
  runner = replaceOnce(runner, "// Executa script.js real no contexto DOM da aplicação\nwin.eval(scriptCode);", "// O módulo social deve existir antes da inicialização do jogo.\nwin.eval(evolutionCode);\nwin.eval(scriptCode);", "test_runner.js (carregamento)");
}
if (!runner.includes("const evolutionTests = require('./evolucao_social.test')();")) {
  const block = `const evolutionTests = require('./evolucao_social.test')();
const integrationTests = require('./evolucao_social.integration.test')();
for (const [label, suite] of [['Evolução Social', evolutionTests], ['Integração Social', integrationTests]]) {
  console.log(\`\\n=== TESTES: \${label} ===\\n\`);
  suite.results.forEach(r => console.log((r.passed ? '  ✓ ' : '  ✗ ') + r.name + (r.detail ? ': ' + r.detail : '')));
  console.log(\`Resultado: \${suite.passed} / \${suite.total}\\n\`);
}
if (res.passed !== res.total || evolutionTests.passed !== evolutionTests.total || integrationTests.passed !== integrationTests.total) {
  process.exit(1);
}`;
  runner = replaceOnce(runner, "if (res.passed !== res.total) {\n  process.exit(1);\n}", block, "test_runner.js (novas suítes)");
}

// Checagens finais antes de gravar qualquer arquivo.
for (const [label, condition] of [
  ["sincronização mensal", script.includes("syncSocialEvolution(false,S.monthNumber)")],
  ["renderização social", script.includes("renderSocialEvolution()}")],
  ["snapshot social", script.includes("getSocialEvolution:getSocialEvolutionSnapshot")],
  ["script do módulo", html.includes('src="evolucao_social.js"')],
  ["painel social", html.includes('id="villageEvolutionContent"')],
  ["teste unitário", runner.includes("evolucao_social.test")],
  ["teste de integração", runner.includes("evolucao_social.integration.test")]
]) if (!condition) throw new Error("Validação final falhou: " + label);
new Function(script);
new Function(runner);

// Backups e gravação atômica dos três arquivos modificados.
const originals = {
  "script.js": fs.readFileSync(path.join(ROOT, "script.js"), "utf8"),
  "index.html": fs.readFileSync(path.join(ROOT, "index.html"), "utf8"),
  "test_runner.js": fs.readFileSync(path.join(ROOT, "test_runner.js"), "utf8")
};
for (const [file, content] of Object.entries(originals)) backup(file, content);
for (const [file, content] of Object.entries({ "script.js": script, "index.html": html, "test_runner.js": runner })) {
  const temp = path.join(ROOT, file + ".v02.tmp");
  fs.writeFileSync(temp, content, "utf8");
  fs.renameSync(temp, path.join(ROOT, file));
}
console.log("Integração Evolução Social v0.2 aplicada.");
console.log("Atualizados: script.js, index.html e test_runner.js.");
console.log("Backups originais: .vilarejo-backup-v02/");
console.log("Execute npm test antes de publicar.");
