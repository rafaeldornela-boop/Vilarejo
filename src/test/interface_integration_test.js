"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "../../");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const coreCode = fs.readFileSync(path.join(ROOT, "src/core/vilarejo_core.js"), "utf8");
const historyStoreCode = fs.readFileSync(path.join(ROOT, "src/shared/vilarejo_history_store.js"), "utf8");
const dashboardCode = fs.readFileSync(path.join(ROOT, "src/ui/dashboard.js"), "utf8");

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

function createDOMContext() {
  const elements = new Map();
  const listeners = new Map();

  function makeMockElement(id) {
    const classListSet = new Set();
    const attrs = new Map();
    const children = [];

    return {
      id,
      tagName: "DIV",
      innerHTML: "",
      textContent: "",
      dataset: {},
      style: {},
      classList: {
        add: (...cls) => cls.forEach((c) => classListSet.add(c)),
        remove: (...cls) => cls.forEach((c) => classListSet.delete(c)),
        toggle: (c, force) => {
          if (force === true) { classListSet.add(c); return true; }
          if (force === false) { classListSet.delete(c); return false; }
          if (classListSet.has(c)) { classListSet.delete(c); return false; }
          classListSet.add(c);
          return true;
        },
        contains: (c) => classListSet.has(c)
      },
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => attrs.get(k) ?? null,
      removeAttribute: (k) => attrs.delete(k),
      children,
      appendChild: (child) => children.push(child),
      addEventListener: (type, handler) => {
        if (!listeners.has(`${id}:${type}`)) listeners.set(`${id}:${type}`, []);
        listeners.get(`${id}:${type}`).push(handler);
      },
      dispatchEvent: (type) => {
        const list = listeners.get(`${id}:${type}`) || [];
        list.forEach((h) => h({ type, target: makeMockElement(id) }));
      },
      querySelector: (sel) => makeMockElement(`${id}:${sel}`),
      querySelectorAll: (sel) => []
    };
  }

  const getElementById = (id) => {
    if (!elements.has(id)) elements.set(id, makeMockElement(id));
    return elements.get(id);
  };

  const document = {
    getElementById,
    querySelector: getElementById,
    querySelectorAll: (selector) => {
      if (selector === "[data-view]") {
        return ["overview", "economy", "society", "government", "services", "intelligence", "newspaper", "records"].map((v) => {
          const el = makeMockElement(`btn-view-${v}`);
          el.dataset.view = v;
          return el;
        });
      }
      if (selector === "[data-view-panel]") {
        return ["overview", "economy", "society", "government", "services", "intelligence", "newspaper", "records"].map((v) => {
          const el = makeMockElement(`panel-${v}`);
          el.dataset.viewPanel = v;
          return el;
        });
      }
      if (selector === "[data-gov-tab]") {
        return ["executivo", "camara", "politica"].map((tab) => {
          const el = makeMockElement(`btn-tab-${tab}`);
          el.dataset.govTab = tab;
          return el;
        });
      }
      if (selector === ".gov-tab-pane") {
        return ["executivo", "camara", "politica"].map((tab) => {
          const el = makeMockElement(`gov-tab-${tab}`);
          return el;
        });
      }
      if (selector === "[data-months]") {
        return [12, 24, 60].map((m) => {
          const el = makeMockElement(`btn-months-${m}`);
          el.dataset.months = String(m);
          return el;
        });
      }
      return [];
    },
    createElement: (tag) => makeMockElement(`dyn-${tag}`),
    body: makeMockElement("body"),
    documentElement: makeMockElement("html")
  };

  const window = {
    document,
    scrollTo: () => {}
  };

  const context = {
    window,
    document,
    console,
    Math,
    Date,
    JSON,
    Number,
    String,
    Boolean,
    RegExp,
    Error,
    TypeError,
    RangeError,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: (fn) => fn(),
    clearTimeout: () => {}
  };

  vm.createContext(context);
  vm.runInContext(coreCode, context, { filename: "vilarejo_core.js" });
  vm.runInContext(historyStoreCode, context, { filename: "vilarejo_history_store.js" });
  vm.runInContext(dashboardCode, context, { filename: "dashboard.js" });

  return context;
}

console.log("\n=== TESTES DE INTEGRAÇÃO DA INTERFACE DO VILAREJO ===");

test("index.html declara exatamente as 8 áreas canônicas de navegação", () => {
  const views = [...html.matchAll(/data-view="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(views, [
    "overview", "economy", "society", "government", "services", "intelligence", "newspaper", "records"
  ]);
});

test("index.html agrupa Executivo, Câmara e Política em sub-abas de Governo", () => {
  assert.ok(html.includes('data-view-panel="government"'), "Painel de Governo presente");
  assert.ok(html.includes('data-gov-tab="executivo"'), "Sub-aba Executivo presente");
  assert.ok(html.includes('data-gov-tab="camara"'), "Sub-aba Câmara presente");
  assert.ok(html.includes('data-gov-tab="politica"'), "Sub-aba Política presente");
  assert.ok(html.includes('id="governmentSummaryCard"'), "Container de resumo governamental presente");
  assert.ok(html.includes('id="institutionsDashboard"'), "Container da Câmara presente");
  assert.ok(html.includes('id="politicsDashboard"'), "Container de Política presente");
});

test("index.html disponibiliza hosts dedicados para Inteligência e Jornal", () => {
  assert.ok(html.includes('id="intelligenceDashboard"'), "Host intelligenceDashboard presente");
  assert.ok(html.includes('id="newspaperDashboard"'), "Host newspaperDashboard presente");
  assert.ok(html.includes('id="topbarAlertBadge"'), "Badge de alertas no cabeçalho presente");
  assert.ok(html.includes('id="overviewAlertsContainer"'), "Container de alertas da visão geral presente");
});

test("index.html carrega o histórico compartilhado antes do dashboard", () => {
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map((m) => m[1]);
  const histIdx = scripts.indexOf("src/shared/vilarejo_history_store.js");
  const dashIdx = scripts.indexOf("src/ui/dashboard.js");
  assert.ok(histIdx >= 0, "vilarejo_history_store.js está referenciado");
  assert.ok(dashIdx >= 0, "dashboard.js está referenciado");
  assert.ok(histIdx < dashIdx, "Histórico compartilhado é carregado antes do dashboard");
});

test("Dashboard instancia singleton compartilhado em window.VilarejoSharedHistoryStore", () => {
  const ctx = createDOMContext();
  const store = ctx.window.VilarejoDashboard.getSharedHistoryStore();
  assert.ok(store, "Store foi instanciado com sucesso");
  assert.equal(store, ctx.window.VilarejoSharedHistoryStore, "Mesma referência global única");
  assert.equal(typeof store.append, "function", "Store possui método append");
  assert.equal(typeof store.getRecords, "function", "Store possui método getRecords");
  assert.equal(typeof store.removeSession, "function", "Store possui método removeSession");
});

test("Dashboard utiliza session.id do Core e não depende de session.startTime", () => {
  const ctx = createDOMContext();
  const Core = ctx.window.VilarejoCore;
  const runtime = Core.createRuntime({ calendar: { daysPerMonth: 30, monthsPerYear: 12 } });

  ctx.window.VilarejoRuntime = runtime;
  ctx.window.VilarejoTest = {
    stateSnapshot: () => ({ day: 149, monthNumber: 5, sessionId: runtime.snapshot().session.id }),
    getCoreSnapshot: () => runtime.snapshot(),
    getLaborStats: () => ({ occupied: 6, unemployedSeeking: 1, outOfLaborForce: 3 })
  };

  const snap = ctx.window.VilarejoTest.stateSnapshot();
  assert.equal(snap.sessionId, "session-1", "Session ID corresponde à API atual do Core (session-1)");
  assert.equal(runtime.snapshot().session.startTime, undefined, "Core não possui session.startTime");
});

test("Fechamento mensal grava histórico isolado por sessionId na store compartilhada", () => {
  const ctx = createDOMContext();
  const store = ctx.window.VilarejoDashboard.getSharedHistoryStore();

  ctx.window.VilarejoTest = {
    stateSnapshot: () => ({
      day: 150,
      monthNumber: 5,
      sessionId: "partida-alfa",
      approval: 75,
      costOfLivingIndex: 102
    }),
    getCoreSnapshot: () => ({
      session: { id: "partida-alfa" },
      calendar: { absoluteDay: 150, economicMonthNumber: 5 }
    }),
    getLaborStats: () => ({ occupied: 8, unemployedSeeking: 1, outOfLaborForce: 2, unemploymentRate: 11.1 }),
    calculateFiscalReport: () => ({ primaryResult: 450, tributaryRevenue: 1200, primaryExpenditure: 750 }),
    calculateNationalAccounts: () => ({ approaches: { production: 15000 } }),
    generateBalanceSheets: () => ({ government: { liabilities: 200 } })
  };

  ctx.window.VilarejoDashboard.recordMonthClosure({ monthNumber: 5, day: 150 });

  const recordsAlfa = store.getRecords({ sessionId: "partida-alfa" });
  assert.equal(recordsAlfa.length, 1, "Um registro adicionado para partida-alfa");
  assert.equal(recordsAlfa[0].sessionId, "partida-alfa");
  assert.equal(recordsAlfa[0].period.monthNumber, 5);
  assert.equal(recordsAlfa[0].metrics.gdp, 15000);
  assert.equal(recordsAlfa[0].metrics.approval, 75);

  // Consulta por outra sessão não retorna dados da primeira
  const recordsBeta = store.getRecords({ sessionId: "partida-beta" });
  assert.equal(recordsBeta.length, 0, "Partida beta isolada não recebe dados de partida alfa");
});

test("Navegação setView suporta as 8 telas e mapeia legados institutions e politics para Governo", () => {
  const ctx = createDOMContext();
  const dash = ctx.window.VilarejoDashboard;

  dash.setView("economy");
  assert.equal(ctx.document.getElementById("pageTitle").textContent, "Economia");

  dash.setView("intelligence");
  assert.equal(ctx.document.getElementById("pageTitle").textContent, "Central de Inteligência");

  dash.setView("newspaper");
  assert.equal(ctx.document.getElementById("pageTitle").textContent, "Jornal do Vilarejo");

  // Alias retrocompatível
  dash.setView("institutions");
  assert.equal(ctx.document.getElementById("pageTitle").textContent, "Governo");

  dash.setView("politics");
  assert.equal(ctx.document.getElementById("pageTitle").textContent, "Governo");
});

test("Central de Alertas consome serviço real e atualiza badge e painel", () => {
  const ctx = createDOMContext();
  const dash = ctx.window.VilarejoDashboard;

  // Sem serviço de inteligência
  dash.refreshAlerts();
  const badge0 = ctx.document.getElementById("topbarAlertBadge");
  const count0 = ctx.document.getElementById("topbarAlertCount");
  assert.equal(count0.textContent, "0");
  assert.equal(badge0.classList.contains("has-alerts"), false);

  // Com serviço de inteligência retornando alertas reais
  ctx.window.VilarejoIntelligenceRuntime = {
    service: {
      getAlerts: () => [
        {
          id: "alert-1",
          indicator: "Desocupação",
          title: "Alta persistente do desemprego",
          message: "Taxa observada de 18% excede o limiar de alerta.",
          severity: "critico",
          occurrenceMonth: 6
        }
      ]
    }
  };

  dash.refreshAlerts();
  assert.equal(count0.textContent, "1");
  assert.equal(badge0.classList.contains("has-alerts"), true);
  const container = ctx.document.getElementById("overviewAlertsContainer");
  assert.ok(container.innerHTML.includes("Alta persistente do desemprego"), "Título do alerta exibido");
  assert.ok(container.innerHTML.includes("severity-critico"), "Classe de severidade crítica aplicada");
});

test("Empty states seguros são exibidos quando Inteligência ou Jornal não possuem módulo", () => {
  const ctx = createDOMContext();
  const dash = ctx.window.VilarejoDashboard;

  // Intelligence view sem window.VilarejoIntelligence
  dash.setView("intelligence");
  const intelHost = ctx.document.getElementById("intelligenceDashboard");
  assert.ok(intelHost.innerHTML.includes("Central de Inteligência"), "Título do empty state presente");
  assert.ok(intelHost.innerHTML.includes("module-empty-state"), "Classe do empty state presente");

  // Newspaper view sem window.VilarejoNewspaper
  dash.setView("newspaper");
  const newsHost = ctx.document.getElementById("newspaperDashboard");
  assert.ok(newsHost.innerHTML.includes("Jornal do Vilarejo"), "Título do empty state presente");
  assert.ok(newsHost.innerHTML.includes("module-empty-state"), "Classe do empty state presente");
});

console.log(`\nResultado Integração Interface: ${passed} testes aprovados; ${failures.length} reprovados.`);
if (failures.length > 0) {
  process.exitCode = 1;
}
