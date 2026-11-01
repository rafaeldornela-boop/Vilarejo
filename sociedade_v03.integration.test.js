"use strict";
const fs = require("node:fs");
const { JSDOM } = require("jsdom");

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

  const html = fs.readFileSync("index.html", "utf8");
  const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost:3000" });
  const win = dom.window;
  win.eval(fs.readFileSync("evolucao_social.js", "utf8"));
  win.eval(fs.readFileSync("sociedade_v03.js", "utf8"));
  win.eval(fs.readFileSync("script.js", "utf8"));

  const api = win.VilarejoTest;
  test("Módulo de sociedade inicia junto com a partida", () => {
    const social = api.getSocietySnapshot();
    return {
      pass: !!win.VilarejoSociety && win.VilarejoSociety.VERSION === 3 && social.demographic.population === 10,
      version: win.VilarejoSociety && win.VilarejoSociety.VERSION,
      population: social.demographic.population
    };
  });

  test("Painel de qualidade de vida e cultura está ligado à interface", () => {
    const panel = win.document.getElementById("societyMetrics");
    return {
      pass: !!panel && panel.textContent.includes("Qualidade de vida") && panel.textContent.includes("Cultura e integração"),
      panelExists: !!panel,
      hasQualityLabel: !!panel && panel.textContent.includes("Qualidade de vida"),
      hasCultureLabel: !!panel && panel.textContent.includes("Cultura e integração")
    };
  });

  test("Fechamento mensal atualiza idade, bem-estar e histórico do IQV", () => {
    const before = api.getSocietySnapshot();
    api.simulateMonths(2, true);
    const after = api.getSocietySnapshot();
    return {
      pass: after.qualityOfLife.history.length >= 2 && after.demographic.population >= 1 && after.qualityOfLife.current && after.qualityOfLife.current.score >= 0 && after.qualityOfLife.current.score <= 100,
      beforeMonth: before.qualityOfLife.current && before.qualityOfLife.current.month,
      historyMonths: after.qualityOfLife.history.map((x) => x.month),
      population: after.demographic.population,
      qualityOfLife: after.qualityOfLife.current && after.qualityOfLife.current.score
    };
  });

  test("Integração cultural e migração permanecem disponíveis após simular", () => {
    const social = api.getSocietySnapshot();
    return {
      pass: Array.isArray(social.culture.groups) && social.culture.groups.length >= 1 && social.migration.monthly && Number.isFinite(social.migration.cumulative.net),
      cultureGroups: social.culture.groups,
      migration: social.migration.cumulative
    };
  });

  test("Auditoria monetária continua íntegra após a camada social", () => {
    const snapshot = api.stateSnapshot();
    return {
      pass: snapshot.cashAudit && snapshot.cashAudit.ok && snapshot.balanceSheets && snapshot.balanceSheets.audit && snapshot.balanceSheets.audit.allPass,
      cashAudit: snapshot.cashAudit,
      balanceSheetAudit: snapshot.balanceSheets && snapshot.balanceSheets.audit
    };
  });

  dom.window.close();
  return { passed: results.filter((item) => item.passed).length, total: results.length, results };
}

if (require.main === module) {
  const result = run();
  for (const item of result.results) console.log(`${item.passed ? "✓" : "✗"} ${item.name}${item.passed ? "" : `: ${JSON.stringify(item.detail || item.error)}`}`);
  console.log(`Resultado: ${result.passed}/${result.total}`);
  if (result.passed !== result.total) process.exit(1);
}
module.exports = run;
