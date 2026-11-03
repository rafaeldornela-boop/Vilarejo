"use strict";

const assert = require("node:assert/strict");
const {
  createDecisionObserver,
  storageKey
} = require("../ui/decision_observer.js");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write(`✓ ${name}\n`);
  } catch (error) {
    failed += 1;
    process.stderr.write(`✗ ${name}\n  ${error.stack || error}\n`);
  }
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    values
  };
}

function input(overrides = {}) {
  return {
    runId: "run-a",
    source: "action",
    label: "Expandir cultivo",
    monthNumber: 2,
    day: 61,
    measures: { population: 100, farmCash: 25 },
    ...overrides
  };
}

let nextId = 0;
function makeObserver(options = {}) {
  return createDecisionObserver({
    idFactory: () => `decision-${++nextId}`,
    now: () => "2026-11-02T00:00:00.000Z",
    ...options
  });
}

test("cria observação validada com medidas whitelistadas e estado aguardando fechamento", () => {
  const observer = makeObserver();
  const token = observer.begin(input({
    label: "<b>Plantio</b>\n estratégico",
    context: "Evento: risco informado de geada; custo exibido pelo motor.",
    measures: { population: 100, ignoredMetric: 44, costIndex: Infinity }
  }));
  assert.equal(token, "decision-1");
  const [record] = observer.getRecords();
  assert.equal(record.status, "awaiting-close");
  assert.equal(record.statusLabel, "Aguardando fechamento");
  assert.equal(record.label, "Plantio estratégico");
  assert.equal(record.context, "Evento: risco informado de geada; custo exibido pelo motor.");
  assert.deepEqual(record.before, { population: 100 });
  assert.throws(() => observer.begin(input({ measures: Object.create({ population: 1 }) })), /objeto simples/);
  assert.throws(() => observer.begin(input({ source: "other" })), /source/);
});

test("persiste e recarrega observações sem alterar ou compartilhar referências", () => {
  const storage = memoryStorage();
  const first = makeObserver({ storage });
  const token = first.begin(input({ context: "Custo indicado na alternativa: R$ 10.000.", measures: { population: 120, treasuryCash: 30 } }));
  first.recordImmediate(token, { population: 121, treasuryCash: 28, surprise: 9 });
  const stored = JSON.parse(storage.getItem(storageKey));
  assert.equal(stored.version, 1);
  assert.deepEqual(Object.keys(stored.records[0].before), ["population", "treasuryCash"]);

  const restored = makeObserver({ storage });
  const records = restored.getRecords();
  assert.equal(records.length, 1);
  assert.equal(records[0].id, token);
  assert.equal(records[0].context, "Custo indicado na alternativa: R$ 10.000.");
  assert.deepEqual(records[0].immediateDelta, { population: 1, treasuryCash: -2 });
  records[0].before.population = 999;
  assert.equal(restored.getRecords()[0].before.population, 120);
});

test("filtra registros por runId", () => {
  const observer = makeObserver();
  observer.begin(input());
  observer.begin(input({ runId: "run-b", source: "event", label: "Seca" }));
  assert.equal(observer.getRecords({ runId: "run-a" }).length, 1);
  assert.equal(observer.getRecords({ runId: "run-b" })[0].label, "Seca");
  assert.equal(observer.getRecords().length, 2);
});

test("compara somente no primeiro fechamento posterior da mesma execução", () => {
  const observer = makeObserver();
  const token = observer.begin(input());
  observer.recordImmediate(token, { population: 102, farmCash: 20 });

  assert.equal(observer.observeMonthClose({ runId: "run-b", monthNumber: 3, measures: { population: 200 } }), 0);
  assert.equal(observer.observeMonthClose({ runId: "run-a", monthNumber: 2, measures: { population: 101 } }), 0);
  assert.equal(observer.getRecords()[0].status, "awaiting-close");
  assert.equal(observer.observeMonthClose({ runId: "run-a", monthNumber: 3, day: 90, measures: { population: 110, farmCash: 24 } }), 1);

  const record = observer.getRecords()[0];
  assert.equal(record.status, "compared");
  assert.equal(record.statusLabel, "Comparação observada");
  assert.deepEqual(record.closure, {
    monthNumber: 3,
    day: 90,
    measures: { population: 110, farmCash: 24 },
    deltaFromBefore: { population: 10, farmCash: -1 },
    deltaFromImmediate: { population: 8, farmCash: 4 }
  });
  assert.equal(observer.observeMonthClose({ runId: "run-a", monthNumber: 4, measures: { population: 999 } }), 0);
  assert.equal(observer.getRecords()[0].closure.monthNumber, 3);
});

test("mantém ausências como ausências em valores e deltas", () => {
  const observer = makeObserver();
  const token = observer.begin(input({ measures: { population: 10, farmCash: 0 } }));
  observer.recordImmediate(token, { population: 12 });
  observer.observeMonthClose({ runId: "run-a", monthNumber: 3, measures: { farmCash: 5, marketStock: 8 } });
  const record = observer.getRecords()[0];
  assert.deepEqual(record.before, { population: 10, farmCash: 0 });
  assert.deepEqual(record.afterImmediate, { population: 12 });
  assert.deepEqual(record.immediateDelta, { population: 2 });
  assert.deepEqual(record.closure.measures, { farmCash: 5, marketStock: 8 });
  assert.deepEqual(record.closure.deltaFromBefore, { farmCash: 5 });
  assert.deepEqual(record.closure.deltaFromImmediate, {});
  assert.equal(Object.hasOwn(record.closure.measures, "population"), false);
});

test("não processa duas vezes o mesmo mês/decisão", () => {
  const observer = makeObserver();
  observer.begin(input());
  assert.equal(observer.observeMonthClose({ runId: "run-a", monthNumber: 3, measures: { population: 105 } }), 1);
  assert.equal(observer.observeMonthClose({ runId: "run-a", monthNumber: 3, measures: { population: 999 } }), 0);
  assert.equal(observer.getRecords()[0].closure.measures.population, 105);
});

test("marca pendências da execução encerrada sem fabricar comparação", () => {
  const observer = makeObserver();
  observer.begin(input());
  observer.begin(input({ runId: "run-b", source: "event", label: "Festival" }));
  assert.equal(observer.markRunEnded("run-a", "reiniciada"), 1);
  const record = observer.getRecords({ runId: "run-a" })[0];
  assert.equal(record.status, "no-comparison");
  assert.equal(record.statusLabel, "Sem comparação");
  assert.equal(record.endedReason, "reiniciada");
  assert.equal(Object.hasOwn(record, "closure"), false);
  assert.equal(observer.markRunEnded("run-a", "reiniciada"), 0);
  assert.equal(observer.getRecords({ runId: "run-b" })[0].status, "awaiting-close");
});

test("JSON incompatível ou corrompido fica preservado e usa memória com aviso", () => {
  for (const original of ["{corrompido", JSON.stringify({ version: 99, records: [] })]) {
    const storage = memoryStorage({ [storageKey]: original });
    const observer = makeObserver({ storage });
    assert.match(observer.getStorageWarning(), /inválidos ou incompatíveis/);
    observer.begin(input());
    assert.equal(storage.getItem(storageKey), original);
    assert.equal(observer.getRecords().length, 1);
  }
});

test("rejeita payload de versão atual estruturalmente inválido sem sobrescrever", () => {
  const original = JSON.stringify({ version: 1, records: [{ id: "x", status: "unknown" }] });
  const storage = memoryStorage({ [storageKey]: original });
  const observer = makeObserver({ storage });
  assert.match(observer.getStorageWarning(), /inválidos ou incompatíveis/);
  assert.deepEqual(observer.getRecords(), []);
  observer.begin(input());
  assert.equal(storage.getItem(storageKey), original);
});

process.stdout.write(`\nResultado: ${passed} aprovados, ${failed} reprovados.\n`);
if (failed > 0) process.exitCode = 1;
