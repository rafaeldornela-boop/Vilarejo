(function attachVilarejoHistoryStore(root, factory) {
  "use strict";

  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.VilarejoHistoryStore = api;
  }
})(typeof window !== "undefined" ? window : null, function createVilarejoHistoryStoreFactory() {
  "use strict";

  const VERSION = "1.0.0";
  const SNAPSHOT_SCHEMA = 1;
  const DEFAULT_MAX_RECORDS = 240;

  function isPlainObject(value) {
    if (value === null || typeof value !== "object") return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function cloneSerializable(value) {
    if (value === undefined) return undefined;

    let serialized;
    try {
      serialized = JSON.stringify(value);
    } catch (error) {
      throw new TypeError("O registro precisa conter apenas dados serializáveis.");
    }

    if (serialized === undefined) {
      throw new TypeError("O registro não pode ser serializado em JSON.");
    }

    return JSON.parse(serialized);
  }

  function requireNonEmptyString(value, label) {
    if (typeof value !== "string" || !value.trim()) {
      throw new TypeError(`${label} deve ser uma string não vazia.`);
    }
    return value.trim();
  }

  function finiteInteger(value, label, minimum = 0) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < minimum) {
      throw new TypeError(`${label} deve ser um número inteiro válido.`);
    }
    return number;
  }

  function normalizePeriod(period) {
    if (!isPlainObject(period)) {
      throw new TypeError("O período do registro é obrigatório.");
    }

    const normalized = {};

    if (period.monthNumber !== undefined && period.monthNumber !== null) {
      normalized.monthNumber = finiteInteger(period.monthNumber, "period.monthNumber", 0);
    }

    if (period.absoluteDay !== undefined && period.absoluteDay !== null) {
      normalized.absoluteDay = finiteInteger(period.absoluteDay, "period.absoluteDay", 1);
    }

    if (period.year !== undefined && period.year !== null) {
      normalized.year = finiteInteger(period.year, "period.year", 1);
    }

    if (period.month !== undefined && period.month !== null) {
      normalized.month = finiteInteger(period.month, "period.month", 1);
      if (normalized.month > 12) {
        throw new RangeError("period.month deve estar entre 1 e 12.");
      }
    }

    if (
      normalized.monthNumber === undefined &&
      normalized.absoluteDay === undefined &&
      (normalized.year === undefined || normalized.month === undefined)
    ) {
      throw new TypeError(
        "Informe monthNumber, absoluteDay ou a combinação year + month."
      );
    }

    if (period.label !== undefined) {
      normalized.label = String(period.label);
    }

    return normalized;
  }

  function periodKey(sessionId, period) {
    if (period.monthNumber !== undefined) {
      return `${sessionId}:m${period.monthNumber}`;
    }

    if (period.absoluteDay !== undefined) {
      return `${sessionId}:d${period.absoluteDay}`;
    }

    return `${sessionId}:y${period.year}-m${period.month}`;
  }

  function periodOrder(period) {
    if (period.monthNumber !== undefined) return period.monthNumber;
    if (period.absoluteDay !== undefined) return period.absoluteDay;
    return ((period.year - 1) * 12) + period.month;
  }

  function getPathValue(object, path) {
    const parts = Array.isArray(path)
      ? path.map(String)
      : String(path).split(".").filter(Boolean);

    let current = object;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (!Object.prototype.hasOwnProperty.call(Object(current), part)) return undefined;
      current = current[part];
    }

    return current;
  }

  function normalizeRecord(input) {
    if (!isPlainObject(input)) {
      throw new TypeError("O snapshot precisa ser um objeto simples.");
    }

    const sessionId = requireNonEmptyString(input.sessionId, "sessionId");
    const period = normalizePeriod(input.period);

    if (!isPlainObject(input.metrics)) {
      throw new TypeError("metrics deve ser um objeto simples.");
    }

    const metrics = cloneSerializable(input.metrics);

    return {
      id: periodKey(sessionId, period),
      sessionId,
      period,
      metrics,
      source: input.source ? String(input.source) : "simulation",
      capturedAt: input.capturedAt ? String(input.capturedAt) : null,
      schemaVersion: SNAPSHOT_SCHEMA
    };
  }

  function compareRecords(left, right) {
    if (left.sessionId !== right.sessionId) {
      return left.sessionId.localeCompare(right.sessionId);
    }
    return periodOrder(left.period) - periodOrder(right.period);
  }

  function createHistoryStore(options = {}) {
    const maxRecords = options.maxRecords === undefined
      ? DEFAULT_MAX_RECORDS
      : finiteInteger(options.maxRecords, "maxRecords", 1);

    let records = [];
    let activeSessionId = null;

    function trim() {
      if (records.length > maxRecords) {
        records = records.slice(records.length - maxRecords);
      }
    }

    function setActiveSession(sessionId) {
      activeSessionId = requireNonEmptyString(sessionId, "sessionId");
      return activeSessionId;
    }

    function append(input, appendOptions = {}) {
      const record = normalizeRecord(input);

      if (activeSessionId && record.sessionId !== activeSessionId) {
        throw new Error(
          `Partida incompatível: ativa '${activeSessionId}', recebida '${record.sessionId}'.`
        );
      }

      if (!activeSessionId) activeSessionId = record.sessionId;

      const existingIndex = records.findIndex((item) => item.id === record.id);
      const replaced = existingIndex >= 0;

      if (replaced && appendOptions.onDuplicate === "ignore") {
        return {
          inserted: false,
          replaced: false,
          ignored: true,
          record: cloneSerializable(records[existingIndex])
        };
      }

      if (replaced) {
        records[existingIndex] = record;
      } else {
        records.push(record);
      }

      records.sort(compareRecords);
      trim();

      return {
        inserted: !replaced,
        replaced,
        ignored: false,
        record: cloneSerializable(record)
      };
    }

    function appendMany(items, appendOptions = {}) {
      if (!Array.isArray(items)) {
        throw new TypeError("appendMany exige uma lista de snapshots.");
      }

      // Valida todos antes de alterar o estado: evita gravação parcial.
      const normalized = items.map(normalizeRecord);
      const expectedSession = activeSessionId || (normalized[0] && normalized[0].sessionId);

      if (normalized.some((item) => item.sessionId !== expectedSession)) {
        throw new Error("appendMany não aceita snapshots de partidas diferentes.");
      }

      const next = records.map((item) => cloneSerializable(item));
      let inserted = 0;
      let replaced = 0;
      let ignored = 0;

      for (const record of normalized) {
        const index = next.findIndex((item) => item.id === record.id);

        if (index >= 0 && appendOptions.onDuplicate === "ignore") {
          ignored += 1;
        } else if (index >= 0) {
          next[index] = record;
          replaced += 1;
        } else {
          next.push(record);
          inserted += 1;
        }
      }

      next.sort(compareRecords);
      records = next;
      if (!activeSessionId && expectedSession) activeSessionId = expectedSession;
      trim();

      return { inserted, replaced, ignored, total: records.length };
    }

    function getRecords(filters = {}) {
      let result = records;

      if (filters.sessionId) {
        result = result.filter((item) => item.sessionId === filters.sessionId);
      }

      if (filters.from !== undefined) {
        const from = finiteInteger(filters.from, "from", 0);
        result = result.filter((item) => periodOrder(item.period) >= from);
      }

      if (filters.to !== undefined) {
        const to = finiteInteger(filters.to, "to", 0);
        result = result.filter((item) => periodOrder(item.period) <= to);
      }

      if (filters.limit !== undefined) {
        const limit = finiteInteger(filters.limit, "limit", 0);
        result = limit === 0 ? [] : result.slice(-limit);
      }

      return cloneSerializable(result);
    }

    function getRecord(sessionId, period) {
      const normalizedPeriod = normalizePeriod(period);
      const id = periodKey(requireNonEmptyString(sessionId, "sessionId"), normalizedPeriod);
      const found = records.find((item) => item.id === id);
      return found ? cloneSerializable(found) : null;
    }

    function getSeries(metricPath, filters = {}) {
      const path = Array.isArray(metricPath)
        ? metricPath.map(String)
        : String(metricPath).split(".").filter(Boolean);

      if (!path.length) {
        throw new TypeError("Informe o caminho da métrica.");
      }

      return getRecords(filters)
        .map((record) => {
          const value = getPathValue(record.metrics, path);
          if (typeof value !== "number" || !Number.isFinite(value)) return null;

          return {
            period: cloneSerializable(record.period),
            sessionId: record.sessionId,
            value,
            source: record.source
          };
        })
        .filter(Boolean);
    }

    function getLatest(filters = {}) {
      const result = getRecords({ ...filters, limit: 1 });
      return result.length ? result[0] : null;
    }

    function removeSession(sessionId) {
      const target = requireNonEmptyString(sessionId, "sessionId");
      const before = records.length;
      records = records.filter((item) => item.sessionId !== target);

      if (activeSessionId === target) activeSessionId = null;

      return before - records.length;
    }

    function clear() {
      records = [];
      activeSessionId = null;
    }

    function exportSnapshot() {
      return {
        storeVersion: VERSION,
        schemaVersion: SNAPSHOT_SCHEMA,
        activeSessionId,
        maxRecords,
        records: cloneSerializable(records)
      };
    }

    function importSnapshot(snapshot, importOptions = {}) {
      if (!isPlainObject(snapshot)) {
        throw new TypeError("Snapshot de importação inválido.");
      }

      if (snapshot.schemaVersion !== SNAPSHOT_SCHEMA) {
        throw new Error(
          `Versão de schema incompatível: esperada ${SNAPSHOT_SCHEMA}, recebida ${snapshot.schemaVersion}.`
        );
      }

      if (!Array.isArray(snapshot.records)) {
        throw new TypeError("snapshot.records deve ser uma lista.");
      }

      const imported = snapshot.records.map(normalizeRecord);
      const ids = new Set();

      for (const record of imported) {
        if (ids.has(record.id)) {
          throw new Error(`Snapshot contém período duplicado: ${record.id}.`);
        }
        ids.add(record.id);
      }

      const importedSessions = new Set(imported.map((item) => item.sessionId));
      if (importedSessions.size > 1) {
        throw new Error("O histórico importado mistura partidas diferentes.");
      }

      const importedSession = imported[0]?.sessionId || snapshot.activeSessionId || null;

      if (
        snapshot.activeSessionId &&
        importedSession &&
        snapshot.activeSessionId !== importedSession
      ) {
        throw new Error("activeSessionId não corresponde aos registros importados.");
      }

      if (importOptions.merge) {
        appendMany(imported, { onDuplicate: importOptions.onDuplicate || "replace" });
      } else {
        records = imported.sort(compareRecords);
        activeSessionId = importedSession;
        trim();
      }

      return {
        imported: imported.length,
        total: records.length,
        activeSessionId
      };
    }

    function stats() {
      const sessions = [...new Set(records.map((item) => item.sessionId))];
      return {
        records: records.length,
        sessions,
        activeSessionId,
        oldest: records.length ? cloneSerializable(records[0].period) : null,
        latest: records.length ? cloneSerializable(records[records.length - 1].period) : null,
        maxRecords
      };
    }

    return Object.freeze({
      version: VERSION,
      setActiveSession,
      append,
      appendMany,
      getRecords,
      getRecord,
      getSeries,
      getLatest,
      removeSession,
      clear,
      exportSnapshot,
      importSnapshot,
      stats
    });
  }

  return Object.freeze({
    version: VERSION,
    createHistoryStore
  });
});
