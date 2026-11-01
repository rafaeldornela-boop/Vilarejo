"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

function runIntegrationTests() {
  const root = process.cwd();
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const evolutionCode = fs.readFileSync(path.join(root, "evolucao_social.js"), "utf8");
  const scriptCode = fs.readFileSync(path.join(root, "script.js"), "utf8");
  const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost:3000" });
  const win = dom.window;
  const results = [];
  const test = (name, fn) => {
    try { fn(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, detail: error.message }); }
  };

  try {
    win.eval(evolutionCode);
    win.eval(scriptCode);

    test("Integração 1: módulo social é carregado antes do motor econômico", () => {
      assert.equal(win.VilarejoEvolution.VERSION, 2);
      assert.ok(win.VilarejoTest);
    });

    test("Integração 2: o painel do jornal mensal existe e renderiza a edição inicial", () => {
      const panel = win.document.getElementById("villageEvolutionContent");
      assert.ok(panel);
      assert.match(panel.textContent, /Jornal do Vilarejo/);
      assert.match(panel.textContent, /Comunidade/);
    });

    test("Integração 3: estado inicial registra população e empresas do jogo", () => {
      const state = win.VilarejoTest.getSocialEvolution();
      assert.equal(state.version, 2);
      assert.equal(state.stage, "comunidade");
      assert.equal(state.metrics.population, 10);
      assert.equal(state.metrics.activeFirms, 3);
      assert.equal(state.metrics.dataDomains.infrastructure, true);
      assert.equal(state.lastUpdatedMonth, 0);
    });

    test("Integração 4: o fechamento mensal atualiza a memória social", () => {
      win.VilarejoTest.simulateMonths(3);
      const state = win.VilarejoTest.getSocialEvolution();
      assert.equal(state.lastUpdatedMonth, 3);
      assert.equal(state.metricsHistory.length, 4);
      assert.equal(state.metrics.population, 10);
    });

    test("Integração 5: pressão habitacional aparece no jornal com persistência", () => {
      const state = win.VilarejoTest.getSocialEvolution();
      const housing = state.needs.find((item) => item.id === "habitacao");
      assert.equal(housing.level, "atencao");
      assert.equal(housing.persistent, true);
      assert.match(win.document.getElementById("villageEvolutionContent").textContent, /Moradia/);
    });

    test("Integração 6: setores sem dados não ganham instituições fictícias", () => {
      const state = win.VilarejoTest.getSocialEvolution();
      for (const id of ["escola_comunitaria", "posto_saude", "posto_seguranca", "saneamento_basico"]) {
        assert.equal(state.institutions.find((item) => item.id === id).availability, "locked");
      }
    });
  } finally {
    dom.window.close();
  }

  return { passed: results.filter((item) => item.passed).length, total: results.length, results };
}
module.exports = runIntegrationTests;
