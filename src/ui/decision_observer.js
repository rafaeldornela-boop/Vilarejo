(function attachVilarejoDecisionObserver(root, factory) {
  "use strict";

  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.VilarejoDecisionObserver = api;
  }
})(typeof window !== "undefined" ? window : null, function createVilarejoDecisionObserverFactory() {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "vilarejo:decision-observations:v1";
  const MAX_RECORDS = 200;
  const MEASURE_KEYS = Object.freeze([
    "population",
    "treasuryCash",
    "farmCash",
    "marketStock",
    "costIndex",
    "lotCount",
    "farmInventory",
    "urbanCapacity",
    "urbanDemand",
    "urbanCongestion",
    "urbanTFP"
  ]);
  const MEASURE_KEY_SET = new Set(MEASURE_KEYS);
  const STATUS_LABELS = Object.freeze({
    "awaiting-close": "Aguardando fechamento",
    compared: "Comparação observada",
    "no-comparison": "Sem comparação"
  });

  function isPlainObject(value) {
    if (value === null || typeof value !== "object") return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function safeClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function safeRunId(value) {
    if (typeof value !== "string" || !value.trim()) {
      throw new TypeError("runId deve ser uma string não vazia.");
    }
    const cleaned = value.trim().replace(/[^A-Za-z0-9._:-]+/g, "-").slice(0, 160);
    if (!cleaned) throw new TypeError("runId inválido.");
    return cleaned;
  }

  function safeLabel(value) {
    if (typeof value !== "string" || !value.trim()) {
      throw new TypeError("label deve ser uma string não vazia.");
    }
    return value
      .trim()
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/<[^>]*>/g, "")
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 200);
  }

  function finitePeriodNumber(value, name, minimum) {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
      throw new TypeError(`${name} deve ser um inteiro válido.`);
    }
    return value;
  }

  function readMonth(input, required) {
    const value = input.monthNumber !== undefined ? input.monthNumber
      : input.economicMonth !== undefined ? input.economicMonth
        : input.month;
    if (value === undefined || value === null) {
      if (required) throw new TypeError("monthNumber é obrigatório.");
      return undefined;
    }
    return finitePeriodNumber(value, "monthNumber", 0);
  }

  function readDay(input) {
    const value = input.day !== undefined ? input.day : input.absoluteDay;
    if (value === undefined || value === null) return undefined;
    return finitePeriodNumber(value, "day", 1);
  }

  function normalizeMeasures(measures) {
    if (!isPlainObject(measures)) {
      throw new TypeError("measures deve ser um objeto simples.");
    }

    const result = {};
    for (const key of MEASURE_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(measures, key)) continue;
      const value = measures[key];
      if (typeof value === "number" && Number.isFinite(value)) result[key] = value;
    }
    return result;
  }

  function subtractMeasures(left, right) {
    const delta = {};
    for (const key of MEASURE_KEYS) {
      if (
        Object.prototype.hasOwnProperty.call(left, key) &&
        Object.prototype.hasOwnProperty.call(right, key)
      ) {
        const value = right[key] - left[key];
        if (Number.isFinite(value)) delta[key] = value;
      }
    }
    return delta;
  }

  function normalizeSource(source) {
    if (source !== "action" && source !== "event") {
      throw new TypeError('source deve ser "action" ou "event".');
    }
    return source;
  }

  function normalizeRecord(record) {
    if (!isPlainObject(record)) throw new TypeError("Registro inválido.");
    const normalized = {
      id: String(record.id),
      runId: safeRunId(record.runId),
      source: normalizeSource(record.source),
      label: safeLabel(record.label),
      monthNumber: finitePeriodNumber(record.monthNumber, "monthNumber", 0),
      status: record.status,
      before: normalizeMeasures(record.before),
      immediateDelta: normalizeMeasures(record.immediateDelta),
      createdAt: String(record.createdAt)
    };
    if (record.context !== undefined && record.context !== null && String(record.context).trim()) {
      normalized.context = safeLabel(String(record.context));
    }

    if (!["awaiting-close", "compared", "no-comparison"].includes(normalized.status)) {
      throw new TypeError("Estado de observação incompatível.");
    }
    if (record.day !== undefined) normalized.day = finitePeriodNumber(record.day, "day", 1);
    if (record.afterImmediate !== undefined) {
      normalized.afterImmediate = normalizeMeasures(record.afterImmediate);
    }
    if (record.endedReason !== undefined) normalized.endedReason = safeLabel(record.endedReason);
    if (record.closure !== undefined) {
      if (!isPlainObject(record.closure)) throw new TypeError("Fechamento inválido.");
      normalized.closure = {
        monthNumber: finitePeriodNumber(record.closure.monthNumber, "closure.monthNumber", 0),
        measures: normalizeMeasures(record.closure.measures),
        deltaFromBefore: normalizeMeasures(record.closure.deltaFromBefore),
        deltaFromImmediate: normalizeMeasures(record.closure.deltaFromImmediate)
      };
      if (record.closure.day !== undefined) {
        normalized.closure.day = finitePeriodNumber(record.closure.day, "closure.day", 1);
      }
    }
    if (typeof normalized.id !== "string" || !normalized.id) {
      throw new TypeError("ID de observação inválido.");
    }
    return normalized;
  }

  function createDecisionObserver(options = {}) {
    if (!isPlainObject(options)) throw new TypeError("options deve ser um objeto simples.");

    let storage = options.storage;
    let persistenceEnabled = true;
    let storageWarning = null;
    let records = [];
    let counter = 0;
    const now = typeof options.now === "function" ? options.now : () => new Date().toISOString();
    const idFactory = typeof options.idFactory === "function" ? options.idFactory : null;

    if (storage === undefined) {
      try {
        storage = typeof window !== "undefined" ? window.localStorage : null;
      } catch (error) {
        storage = null;
        storageWarning = "Armazenamento local indisponível; observações mantidas apenas nesta sessão.";
      }
    }

    function warn(message) {
      storageWarning = message;
      persistenceEnabled = false;
    }

    if (storage) {
      let serialized;
      try {
        serialized = storage.getItem(STORAGE_KEY);
      } catch (error) {
        warn("Não foi possível ler as observações salvas; usando memória nesta sessão.");
      }

      if (persistenceEnabled && serialized !== null && serialized !== undefined) {
        try {
          const payload = JSON.parse(serialized);
          if (
            !isPlainObject(payload) ||
            payload.version !== VERSION ||
            !Array.isArray(payload.records) ||
            payload.records.length > MAX_RECORDS
          ) {
            throw new Error("Formato/versionamento incompatível.");
          }
          const loaded = payload.records.map(normalizeRecord);
          const ids = new Set();
          for (const record of loaded) {
            if (ids.has(record.id)) throw new Error("Registro duplicado.");
            ids.add(record.id);
          }
          records = loaded;
        } catch (error) {
          records = [];
          warn("Dados de observação inválidos ou incompatíveis; conteúdo original preservado e usando memória.");
        }
      }
    }

    function persist() {
      if (!storage || !persistenceEnabled) return;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, records }));
      } catch (error) {
        warn("Não foi possível salvar observações; alterações mantidas apenas nesta sessão.");
      }
    }

    function trim() {
      if (records.length > MAX_RECORDS) records = records.slice(records.length - MAX_RECORDS);
    }

    function makeId(runId) {
      counter += 1;
      const generated = idFactory
        ? idFactory({ runId, counter, now: now() })
        : `${runId}:${String(now())}:${counter}`;
      if (typeof generated !== "string" || !generated.trim()) {
        throw new TypeError("idFactory deve retornar uma string não vazia.");
      }
      return generated.trim().slice(0, 240);
    }

    function begin(input) {
      if (!isPlainObject(input)) throw new TypeError("input deve ser um objeto simples.");
      const runId = safeRunId(input.runId);
      const source = normalizeSource(input.source);
      const label = safeLabel(input.label);
      const monthNumber = readMonth(input, true);
      const day = readDay(input);
      const before = normalizeMeasures(input.measures);
      const id = makeId(runId);
      const record = {
        id,
        runId,
        source,
        label,
        monthNumber,
        status: "awaiting-close",
        before,
        immediateDelta: {},
        createdAt: String(now())
      };
      if (input.context !== undefined && input.context !== null && String(input.context).trim()) {
        record.context = safeLabel(String(input.context));
      }
      if (day !== undefined) record.day = day;
      records.push(record);
      trim();
      persist();
      return id;
    }

    function recordImmediate(token, measures) {
      if (typeof token !== "string" || !token) throw new TypeError("token inválido.");
      const record = records.find((item) => item.id === token);
      if (!record) return false;
      if (record.status !== "awaiting-close" || record.afterImmediate !== undefined) return false;
      const after = normalizeMeasures(measures);
      record.afterImmediate = after;
      record.immediateDelta = subtractMeasures(record.before, after);
      persist();
      return true;
    }

    function observeMonthClose(input) {
      if (!isPlainObject(input)) throw new TypeError("input deve ser um objeto simples.");
      const runId = safeRunId(input.runId);
      const monthNumber = readMonth(input, true);
      const day = readDay(input);
      const measures = normalizeMeasures(input.measures);
      let observed = 0;

      for (const record of records) {
        if (
          record.runId !== runId ||
          record.status !== "awaiting-close" ||
          monthNumber <= record.monthNumber
        ) continue;

        const closure = {
          monthNumber,
          measures,
          deltaFromBefore: subtractMeasures(record.before, measures),
          deltaFromImmediate: record.afterImmediate === undefined
            ? {}
            : subtractMeasures(record.afterImmediate, measures)
        };
        if (day !== undefined) closure.day = day;
        record.closure = closure;
        record.status = "compared";
        observed += 1;
      }

      if (observed) persist();
      return observed;
    }

    function markRunEnded(runIdValue, reason) {
      const runId = safeRunId(runIdValue);
      const safeReason = reason === undefined || reason === null || !String(reason).trim()
        ? "Execução encerrada antes do fechamento posterior."
        : safeLabel(String(reason));
      let ended = 0;

      for (const record of records) {
        if (record.runId === runId && record.status === "awaiting-close") {
          record.status = "no-comparison";
          record.endedReason = safeReason;
          ended += 1;
        }
      }
      if (ended) persist();
      return ended;
    }

    function getRecords(filters = {}) {
      if (!isPlainObject(filters)) throw new TypeError("filters deve ser um objeto simples.");
      const filtered = filters.runId === undefined
        ? records
        : records.filter((record) => record.runId === safeRunId(filters.runId));
      return safeClone(filtered.map((record) => ({
        ...record,
        statusLabel: STATUS_LABELS[record.status]
      })));
    }

    function getStorageWarning() {
      return storageWarning;
    }

    return Object.freeze({
      begin,
      recordImmediate,
      observeMonthClose,
      markRunEnded,
      getRecords,
      getStorageWarning
    });
  }

  return Object.freeze({
    version: VERSION,
    storageKey: STORAGE_KEY,
    measureKeys: MEASURE_KEYS,
    createDecisionObserver
  });
});
