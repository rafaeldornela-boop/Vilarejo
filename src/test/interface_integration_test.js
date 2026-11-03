"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "../../");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const coreCode = fs.readFileSync(path.join(ROOT, "src/core/vilarejo_core.js"), "utf8");
const historyStoreCode = fs.readFileSync(path.join(ROOT, "src/shared/vilarejo_history_store.js"), "utf8");
const intelligenceCode = fs.readFileSync(path.join(ROOT, "src/intelligence/vilarejo_intelligence.js"), "utf8");
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
          const el = getElementById(`gov-tab-${tab}`);
          el.dataset.govPane = tab;
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
  vm.runInContext(intelligenceCode, context, { filename: "vilarejo_intelligence.js" });
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

test("Central usa o contrato HistoryStore por execução sem criar repositório paralelo no dashboard", () => {
  const ctx = createDOMContext();
  const storage = { value: null, getItem() { return this.value; }, setItem(_key, value) { this.value = value; } };
  const service = ctx.window.VilarejoIntelligence.createService({
    storage,
    idFactory: () => "partida-alfa",
    capture: (payload) => ({ ...payload, month: payload.monthNumber, metrics: payload.metrics })
  });
  const record = service.recordMonthClosure({ monthNumber: 1, day: 150, metrics: { population: 11 } });
  assert.equal(record.month, 1);
  assert.equal(service.getRunHistory("partida-alfa")[0].metrics.population, 11);
  assert.equal(service.getHistoryStoreSnapshot("partida-alfa").activeSessionId, "partida-alfa");
  const saved = JSON.parse(storage.value);
  assert.equal(saved.runs[0].records, undefined, "Snapshots não ficam em arrays paralelos");
  assert.equal(saved.runs[0].historySnapshot.records.length, 1);
  assert.equal(ctx.window.VilarejoSharedHistoryStore, undefined, "Dashboard não instancia segunda store");
  assert.equal(typeof ctx.window.VilarejoHistoryStore.createHistoryStore, "function");
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
  assert.equal(ctx.window.VilarejoDashboard.getSnapshot().sessionId, "session-1", "Dashboard identifica a execução pela API pública do Core");
});

test("Dashboard encaminha o fechamento à Central sem produzir um segundo snapshot", () => {
  const ctx = createDOMContext();
  const payload = { monthNumber: 5, day: 150 };
  let received = null;
  ctx.window.VilarejoIntelligenceRuntime = {
    service: { recordMonthClosure(value) { received = value; return { month: value.monthNumber }; } }
  };
  assert.equal(ctx.window.VilarejoDashboard.recordMonthClosure(payload).month, 5);
  assert.equal(received, payload);
  assert.equal(ctx.window.VilarejoSharedHistoryStore, undefined);
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

  dash.setView("government");
  dash.setGovTab("camara");
  assert.equal(ctx.document.getElementById("gov-tab-camara").classList.contains("active"), true);
  dash.setGovTab("politica");
  assert.equal(ctx.document.getElementById("gov-tab-politica").classList.contains("active"), true);

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
  assert.equal(badge0.classList.contains("hidden"), true);

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
          status: "ativo",
          occurrenceMonth: 6
        }
      ]
    }
  };

  dash.refreshAlerts();
  assert.equal(count0.textContent, "1");
  assert.equal(badge0.classList.contains("has-alerts"), true);
  assert.equal(badge0.classList.contains("hidden"), false);
  const container = ctx.document.getElementById("overviewAlertsContainer");
  assert.ok(container.innerHTML.includes("Alta persistente do desemprego"), "Título do alerta exibido");
  assert.ok(container.innerHTML.includes("severity-critico"), "Classe de severidade crítica aplicada");
});

test("Empty states seguros são exibidos quando os renderizadores de Inteligência ou Jornal não estão disponíveis", () => {
  const ctx = createDOMContext();
  const dash = ctx.window.VilarejoDashboard;

  // Sem renderer de visualização de Inteligência
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
