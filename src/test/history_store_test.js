 "use strict";

const assert = require("node:assert/strict");
const { createHistoryStore } = require("../shared/vilarejo_history_store.js");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write(`✓ ${name}\n`);
  } catch (error) {
    failed += 1;
    process.stderr.write(`✗ ${name}\n  ${error.message}\n`);
  }
}

function snapshot(monthNumber, metrics, sessionId = "partida-a") {
  return {
    sessionId,
    period: { monthNumber, year: 1, month: monthNumber + 1 },
    metrics,
    source: "test"
  };
}

test("insere snapshots em ordem cronológica", () => {
  const store = createHistoryStore();
  store.append(snapshot(2, { gdp: 120 }));
  store.append(snapshot(0, { gdp: 100 }));
  store.append(snapshot(1, { gdp: 110 }));
  assert.deepEqual(store.getRecords().map((r) => r.period.monthNumber), [0, 1, 2]);
});

test("substitui o mesmo período sem duplicar registros", () => {
  const store = createHistoryStore();
  store.append(snapshot(0, { gdp: 100 }));
  const result = store.append(snapshot(0, { gdp: 125 }));
  assert.equal(result.replaced, true);
  assert.equal(store.getRecords().length, 1);
  assert.equal(store.getLatest().metrics.gdp, 125);
});

test("pode ignorar uma duplicação deliberadamente", () => {
  const store = createHistoryStore();
  store.append(snapshot(0, { gdp: 100 }));
  const result = store.append(snapshot(0, { gdp: 999 }), { onDuplicate: "ignore" });
  assert.equal(result.ignored, true);
  assert.equal(store.getLatest().metrics.gdp, 100);
});

test("separa partidas e bloqueia mistura acidental", () => {
  const store = createHistoryStore();
  store.append(snapshot(0, { gdp: 100 }, "partida-a"));
  assert.throws(
    () => store.append(snapshot(0, { gdp: 200 }, "partida-b")),
    /Partida incompatível/
  );
});

test("retorna séries numéricas por caminho de métrica", () => {
  const store = createHistoryStore();
  store.append(snapshot(0, { economy: { gdp: 100 } }));
  store.append(snapshot(1, { economy: { gdp: 115 } }));
  store.append(snapshot(2, { economy: { gdp: null } }));
  assert.deepEqual(
    store.getSeries("economy.gdp").map((point) => point.value),
    [100, 115]
  );
});

test("preserva metadados de qualidade e proveniência fora das métricas", () => {
  const store = createHistoryStore();
  store.append({
    ...snapshot(0, { population: 10 }),
    metadata: {
      day: 150,
      metricQuality: { qualityOfLifeScore: "provisório; cobertura 25%" },
      sources: { population: "Core" }
    }
  });
  const record = store.getLatest();
  assert.equal(record.metrics.population, 10);
  assert.equal(record.metadata.day, 150);
  assert.equal(record.metadata.metricQuality.qualityOfLifeScore, "provisório; cobertura 25%");
  assert.equal(record.metadata.sources.population, "Core");
  assert.equal(store.getSeries("population")[0].value, 10);
});

test("limita histórico sem alterar a ordem", () => {
  const store = createHistoryStore({ maxRecords: 2 });
  store.appendMany([
    snapshot(0, { gdp: 100 }),
    snapshot(1, { gdp: 110 }),
    snapshot(2, { gdp: 120 })
  ]);
  assert.deepEqual(store.getRecords().map((r) => r.period.monthNumber), [1, 2]);
});

test("appendMany valida tudo antes de gravar", () => {
  const store = createHistoryStore();
  assert.throws(() => store.appendMany([
    snapshot(0, { gdp: 100 }, "partida-a"),
    snapshot(1, { gdp: 110 }, "partida-b")
  ]), /partidas diferentes/);
  assert.equal(store.getRecords().length, 0);
});

test("exporta e restaura o histórico", () => {
  const original = createHistoryStore();
  original.append(snapshot(0, { gdp: 100 }));
  original.append(snapshot(1, { gdp: 110 }));

  const restored = createHistoryStore();
  const result = restored.importSnapshot(original.exportSnapshot());

  assert.equal(result.imported, 2);
  assert.deepEqual(restored.getSeries("gdp").map((p) => p.value), [100, 110]);
});

test("rejeita importação com períodos duplicados", () => {
  const store = createHistoryStore();
  const record = snapshot(0, { gdp: 100 });
  const exported = {
    schemaVersion: 1,
    activeSessionId: "partida-a",
    records: [record, record]
  };
  assert.throws(() => store.importSnapshot(exported), /período duplicado/);
});

test("retorna cópias defensivas, não referências internas", () => {
  const store = createHistoryStore();
  store.append(snapshot(0, { gdp: 100 }));
  const exposed = store.getRecords();
  exposed[0].metrics.gdp = 999;
  assert.equal(store.getLatest().metrics.gdp, 100);
});

test("remove somente o histórico da partida solicitada", () => {
  const store = createHistoryStore();
  store.append(snapshot(0, { gdp: 100 }));
  store.removeSession("partida-a");
  assert.equal(store.getRecords().length, 0);
  assert.equal(store.stats().activeSessionId, null);
});

test("rejeita período sem identificador temporal", () => {
  const store = createHistoryStore();
  assert.throws(() => store.append({
    sessionId: "partida-a",
    period: {},
    metrics: { gdp: 100 }
  }), /Informe monthNumber/);
});

process.stdout.write(`\nResultado: ${passed} aprovados, ${failed} reprovados.\n`);
if (failed > 0) process.exitCode = 1;
