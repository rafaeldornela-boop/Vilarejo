(function attachVilarejoCore(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.VilarejoCore = api;
})(typeof window !== "undefined" ? window : null, function createVilarejoCoreFactory() {
  "use strict";

  const CORE_VERSION = "0.1.0";
  const DEFAULT_CALENDAR = Object.freeze({ daysPerMonth: 30, monthsPerYear: 12 });
  const VALID_STATUSES = new Set(["ready", "running", "paused", "game-over"]);

  function clone(value) {
    if (value === undefined) return undefined;
    if (value === null || typeof value !== "object") return value;
    return JSON.parse(JSON.stringify(value));
  }

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function makeEventBus(options = {}) {
    const listeners = new Map();
    const history = [];
    const topicCounts = new Map();
    const maxHistory = Math.max(0, Math.floor(finiteNumber(options.maxHistory, 500)));
    let sequence = 0;

    function on(topic, listener) {
      if (typeof topic !== "string" || !topic.trim()) throw new TypeError("O tópico do evento é obrigatório.");
      if (typeof listener !== "function") throw new TypeError("O listener precisa ser uma função.");
      if (!listeners.has(topic)) listeners.set(topic, new Set());
      listeners.get(topic).add(listener);
      return () => off(topic, listener);
    }

    function once(topic, listener) {
      let unsubscribe;
      const wrapped = (event) => {
        if (unsubscribe) unsubscribe();
        return listener(event);
      };
      unsubscribe = on(topic, wrapped);
      return unsubscribe;
    }

    function off(topic, listener) {
      const bucket = listeners.get(topic);
      if (!bucket) return false;
      const removed = bucket.delete(listener);
      if (bucket.size === 0) listeners.delete(topic);
      return removed;
    }

    function emit(topic, payload = {}, metadata = {}) {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
      const envelope = {
        id: `evt-${++sequence}`,
        schemaVersion: 1,
        topic,
        source: metadata.source || "core",
        day: Number.isFinite(metadata.day) ? metadata.day : null,
        emittedAtSequence: sequence,
        payload: clone(payload)
      };
      if (maxHistory > 0) {
        history.push(envelope);
        if (history.length > maxHistory) history.splice(0, history.length - maxHistory);
      }
      const errors = [];
      const bucket = listeners.get(topic);
      if (bucket) {
        for (const listener of Array.from(bucket)) {
          try {
            listener(clone(envelope));
          } catch (error) {
            errors.push({ message: error && error.message ? error.message : String(error) });
          }
        }
      }
      return { event: clone(envelope), delivered: bucket ? bucket.size : 0, errors };
    }

    function getHistory(filter = {}) {
      const rows = filter.topic ? history.filter((event) => event.topic === filter.topic) : history;
      const limit = Number.isFinite(filter.limit) ? Math.max(0, Math.floor(filter.limit)) : rows.length;
      const start = limit === 0 ? rows.length : Math.max(0, rows.length - limit);
      return clone(rows.slice(start));
    }

    function count(topic) {
      return topic === undefined ? sequence : (topicCounts.get(topic) || 0);
    }

    function clearHistory() {
      history.length = 0;
    }

    return { on, once, off, emit, getHistory, count, clearHistory };
  }

  function makeClock(calendar, eventBus, getDay) {
    const config = {
      daysPerMonth: Math.max(1, Math.floor(finiteNumber(calendar.daysPerMonth, DEFAULT_CALENDAR.daysPerMonth))),
      monthsPerYear: Math.max(1, Math.floor(finiteNumber(calendar.monthsPerYear, DEFAULT_CALENDAR.monthsPerYear)))
    };
    let current = null;
    let economicMonthNumber = 0;

    function fromAbsoluteDay(rawDay) {
      const absoluteDay = Math.max(1, Math.floor(finiteNumber(rawDay, 1)));
      const zeroBasedDay = absoluteDay - 1;
      const daysPerYear = config.daysPerMonth * config.monthsPerYear;
      const year = Math.floor(zeroBasedDay / daysPerYear) + 1;
      const dayOfYear = zeroBasedDay % daysPerYear;
      const month = Math.floor(dayOfYear / config.daysPerMonth) + 1;
      const day = (dayOfYear % config.daysPerMonth) + 1;
      return {
        absoluteDay,
        year,
        month,
        day,
        dayOfYear: dayOfYear + 1,
        monthIndex: (year - 1) * config.monthsPerYear + month - 1,
        daysPerMonth: config.daysPerMonth,
        monthsPerYear: config.monthsPerYear
      };
    }

    function sync(rawDay, rawEconomicMonthNumber) {
      const next = fromAbsoluteDay(rawDay);
      const previous = current;
      economicMonthNumber = Math.max(0, Math.floor(finiteNumber(rawEconomicMonthNumber, economicMonthNumber)));
      current = { ...next, economicMonthNumber };

      if (previous && next.absoluteDay !== previous.absoluteDay) {
        eventBus.emit("time:day-advanced", {
          previousDay: previous.absoluteDay,
          currentDay: next.absoluteDay,
          elapsedDays: next.absoluteDay - previous.absoluteDay,
          date: clone(current)
        }, { day: next.absoluteDay, source: "core.clock" });

        if (next.monthIndex !== previous.monthIndex) {
          eventBus.emit("time:month-started", {
            previous: { year: previous.year, month: previous.month },
            current: { year: next.year, month: next.month },
            date: clone(current)
          }, { day: next.absoluteDay, source: "core.clock" });
        }
        if (next.year !== previous.year) {
          eventBus.emit("time:year-started", {
            previousYear: previous.year,
            currentYear: next.year,
            date: clone(current)
          }, { day: next.absoluteDay, source: "core.clock" });
        }
      }
      return clone(current);
    }

    function snapshot() {
      if (!current) {
        const initialDay = typeof getDay === "function" ? getDay() : 1;
        sync(initialDay, 0);
      }
      return clone(current);
    }

    function reset(rawDay = 1, rawEconomicMonthNumber = 0) {
      current = null;
      economicMonthNumber = 0;
      return sync(rawDay, rawEconomicMonthNumber);
    }

    return { fromAbsoluteDay, sync, snapshot, reset, config: clone(config) };
  }

  function makePopulationDirectory(eventBus, getDay) {
    let groups = [];
    let lastSynchronizedDay = null;

    function snapshotFor(sourceGroups, synchronizedDay) {
      const totals = sourceGroups.reduce((result, group) => {
        result.groups += 1;
        result.adults += group.adults;
        result.children += group.children;
        result.total += group.population;
        result.employed += group.employed;
        result.weightedHappiness += group.happiness * group.population;
        return result;
      }, { groups: 0, adults: 0, children: 0, total: 0, employed: 0, weightedHappiness: 0 });
      if (![totals.adults, totals.children, totals.total].every(Number.isSafeInteger) ||
        !Number.isFinite(totals.employed) || !Number.isFinite(totals.weightedHappiness)) {
        throw new RangeError("Os totais populacionais excedem os limites numéricos seguros.");
      }
      totals.averageHappiness = totals.total > 0 ? Number((totals.weightedHappiness / totals.total).toFixed(2)) : 0;
      delete totals.weightedHappiness;
      return { totals, groups: clone(sourceGroups), lastSynchronizedDay: synchronizedDay };
    }

    function prepareSyncFromEconomy(households, day) {
      if (!Array.isArray(households)) throw new TypeError("A sincronização populacional exige uma lista de domicílios.");
      const synchronizedDay = day === undefined ? (typeof getDay === "function" ? getDay() : 1) : day;
      if (!Number.isSafeInteger(synchronizedDay) || synchronizedDay < 1) {
        throw new TypeError("O dia de sincronização deve ser um inteiro positivo.");
      }
      const incomingIds = new Set();
      const existing = new Map(groups.map((group) => [String(group.id), group]));
      const nextGroups = households.map((household) => {
        if (!household || typeof household !== "object" || Array.isArray(household)) {
          throw new TypeError("Cada domicílio deve ser um objeto válido.");
        }
        const rawId = household.id;
        if ((typeof rawId !== "string" && typeof rawId !== "number") ||
          (typeof rawId === "number" && !Number.isFinite(rawId)) || String(rawId).trim() === "") {
          throw new TypeError("Cada domicílio deve ter um identificador não vazio.");
        }
        const id = typeof rawId === "string" ? rawId.trim() : String(rawId);
        if (incomingIds.has(id)) throw new Error(`Identificador de domicílio duplicado: ${id}.`);
        incomingIds.add(id);

        function readNumber(field, fallback, min = 0, max = Infinity, integer = false) {
          const value = household[field];
          if (value === undefined) return fallback;
          if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) {
            throw new TypeError(`Campo inválido em ${id}: ${field}.`);
          }
          return value;
        }

        if (household.name !== undefined && household.name !== null && typeof household.name !== "string") {
          throw new TypeError(`Campo inválido em ${id}: name.`);
        }
        if (household.type !== undefined && household.type !== null && typeof household.type !== "string") {
          throw new TypeError(`Campo inválido em ${id}: type.`);
        }
        if (household.migrant !== undefined && typeof household.migrant !== "boolean") {
          throw new TypeError(`Campo inválido em ${id}: migrant.`);
        }

        const previous = existing.get(id) || {};
        const adults = readNumber("adults", 0, 0, Infinity, true);
        const children = readNumber("children", 0, 0, Infinity, true);
        const jobs = readNumber("jobs", 0);
        const happiness = readNumber("happiness", 0, 0, 100);
        return {
          id,
          label: household.name || `Grupo ${id}`,
          category: household.type || "household",
          adults,
          children,
          population: adults + children,
          employed: jobs,
          happiness,
          migrant: household.migrant === true,
          sourceModule: "economia",
          updatedDay: synchronizedDay,
          extensions: clone(previous.extensions || {})
        };
      });

      return { groups: nextGroups, day: synchronizedDay, snapshot: snapshotFor(nextGroups, synchronizedDay) };
    }

    function commitPreparedSync(prepared) {
      groups = prepared.groups;
      lastSynchronizedDay = prepared.day;
      const snapshot = snapshotFor(groups, lastSynchronizedDay);
      eventBus.emit("population:synchronized", snapshot, {
        day: lastSynchronizedDay,
        source: "core.population"
      });
      return snapshot;
    }

    function syncFromEconomy(households, day) {
      return commitPreparedSync(prepareSyncFromEconomy(households, day));
    }

    function getSnapshot() {
      return snapshotFor(groups, lastSynchronizedDay);
    }

    function reset() {
      groups = [];
      lastSynchronizedDay = null;
    }

    function addExtension(groupId, namespace, data) {
      if (!namespace || typeof namespace !== "string") throw new TypeError("O namespace da extensão é obrigatório.");
      const group = groups.find((item) => item.id === String(groupId));
      if (!group) return false;
      group.extensions[namespace] = clone(data);
      eventBus.emit("population:extension-updated", {
        groupId: String(groupId), namespace, data: clone(data)
      }, { day: lastSynchronizedDay, source: namespace });
      return true;
    }

    return { syncFromEconomy, prepareSyncFromEconomy, commitPreparedSync, getSnapshot, addExtension, reset };
  }

  function createRuntime(options = {}) {
    const eventBus = makeEventBus({ maxHistory: options.maxEventHistory || 500 });
    let sessionSequence = 0;
    const session = {
      id: `session-${++sessionSequence}`,
      status: "ready",
      startedAtDay: null,
      updatedAtDay: null,
      resetCount: 0
    };
    let moduleSequence = 0;
    const moduleRegistry = new Map();
    const moduleSnapshots = new Map();
    let currentDay = 1;

    const clock = makeClock(options.calendar || DEFAULT_CALENDAR, eventBus, () => currentDay);
    const population = makePopulationDirectory(eventBus, () => currentDay);

    function registerModule(descriptor) {
      if (!descriptor || typeof descriptor !== "object") throw new TypeError("O contrato do módulo é obrigatório.");
      const id = String(descriptor.id || "").trim();
      const version = String(descriptor.version || "").trim();
      if (!id || !version) throw new TypeError("Todo módulo precisa declarar id e versão.");
      if (moduleRegistry.has(id)) throw new Error(`O módulo '${id}' já está registrado.`);
      const dependencies = Array.isArray(descriptor.dependencies) ? descriptor.dependencies.map(String) : [];
      const missing = dependencies.filter((dependency) => !moduleRegistry.has(dependency));
      if (missing.length) throw new Error(`Dependências ausentes para '${id}': ${missing.join(", ")}`);
      const record = {
        id,
        version,
        name: String(descriptor.name || id),
        description: String(descriptor.description || ""),
        dependencies,
        registeredSequence: ++moduleSequence,
        status: "registered"
      };
      moduleRegistry.set(id, record);
      moduleSnapshots.set(id, {});
      eventBus.emit("module:registered", clone(record), { day: currentDay, source: "core.modules" });
      return clone(record);
    }

    function updateModuleSnapshot(moduleId, snapshot, source = moduleId) {
      if (!moduleRegistry.has(moduleId)) throw new Error(`Módulo '${moduleId}' não registrado.`);
      const safeSnapshot = clone(snapshot || {});
      moduleSnapshots.set(moduleId, safeSnapshot);
      moduleRegistry.get(moduleId).status = "active";
      eventBus.emit("module:state-updated", {
        moduleId,
        snapshot: safeSnapshot
      }, { day: currentDay, source });
      return clone(safeSnapshot);
    }

    function getModules() {
      return Array.from(moduleRegistry.values()).map((record) => ({
        ...clone(record),
        snapshot: clone(moduleSnapshots.get(record.id) || {})
      }));
    }

    function setStatus(status, details = {}) {
      if (!VALID_STATUSES.has(status)) throw new TypeError(`Status de partida inválido: ${status}`);
      if (session.status === status) return clone(session);
      const previous = session.status;
      session.status = status;
      session.updatedAtDay = currentDay;
      if (status === "running" && session.startedAtDay === null) session.startedAtDay = currentDay;
      eventBus.emit(`game:${status}`, { previousStatus: previous, status, ...clone(details) }, {
        day: currentDay,
        source: "core.session"
      });
      return clone(session);
    }

    function resetSession(resetOptions = {}) {
      sessionSequence += 1;
      session.id = `session-${sessionSequence}`;
      session.status = "ready";
      session.startedAtDay = null;
      session.updatedAtDay = null;
      session.resetCount += 1;
      currentDay = Math.max(1, Math.floor(finiteNumber(resetOptions.day, 1)));
      session.updatedAtDay = currentDay;
      clock.reset(currentDay, 0);
      population.reset();
      eventBus.clearHistory();
      for (const record of moduleRegistry.values()) record.status = "registered";
      for (const id of moduleSnapshots.keys()) moduleSnapshots.set(id, {});
      eventBus.emit("game:reset", {
        sessionId: session.id,
        resetCount: session.resetCount,
        day: currentDay
      }, { day: currentDay, source: "core.session" });
      return clone(session);
    }

    function syncFromEconomy(economicState, reason = "sync") {
      if (!economicState || typeof economicState !== "object" || Array.isArray(economicState)) {
        throw new TypeError("O estado econômico deve ser um objeto válido.");
      }
      if (!Number.isSafeInteger(economicState.day) || economicState.day < 1) {
        throw new TypeError("O dia econômico deve ser um inteiro positivo.");
      }
      if (!Number.isSafeInteger(economicState.monthNumber) || economicState.monthNumber < 0) {
        throw new TypeError("O mês econômico deve ser um inteiro não negativo.");
      }
      if (typeof reason !== "string") throw new TypeError("A razão da sincronização deve ser um texto.");

      const nextDay = economicState.day;
      const economicMonthNumber = economicState.monthNumber;
      const populationPlan = population.prepareSyncFromEconomy(economicState.households, nextDay);
      const rawAccounts = economicState.accounts === undefined || economicState.accounts === null ? {} : economicState.accounts;
      if (typeof rawAccounts !== "object" || Array.isArray(rawAccounts)) {
        throw new TypeError("As contas econômicas devem ser um objeto.");
      }
      for (const [account, balance] of Object.entries(rawAccounts)) {
        if (typeof balance !== "number" || !Number.isFinite(balance)) {
          throw new TypeError(`Saldo econômico inválido na conta '${account}'.`);
        }
      }
      if (economicState.owner !== undefined && economicState.owner !== null && typeof economicState.owner !== "string") {
        throw new TypeError("O proprietário econômico deve ser um texto ou null.");
      }
      function readOptionalFiniteNumber(field) {
        const value = economicState[field];
        if (value === undefined || value === null) return 0;
        if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`Campo econômico inválido: ${field}.`);
        return value;
      }

      const rawGameOver = economicState.gameOver;
      if (rawGameOver !== undefined && rawGameOver !== null && rawGameOver !== false && typeof rawGameOver !== "string") {
        throw new TypeError("O estado gameOver deve ser um texto, false ou null.");
      }
      const gameOver = rawGameOver ?? null;
      const calendarPreview = { ...clock.fromAbsoluteDay(nextDay), economicMonthNumber };
      const populationTotals = populationPlan.snapshot.totals;
      const moduleSnapshot = clone({
        release: "3.0.0",
        day: nextDay,
        monthNumber: economicMonthNumber,
        calendar: calendarPreview,
        population: populationTotals,
        status: gameOver ? "game-over" : "active",
        owner: economicState.owner ?? null,
        accounts: clone(rawAccounts),
        marketPrice: readOptionalFiniteNumber("marketPrice"),
        exchangeRate: readOptionalFiniteNumber("fx")
      });
      const worldPayload = clone({ reason, calendar: calendarPreview, population: populationTotals });
      const gameOverDetails = gameOver ? clone({ reason: gameOver }) : null;

      // Nada é mutado até que calendário, domicílios e todos os dados dos snapshots estejam validados.
      currentDay = nextDay;
      const calendarSnapshot = clock.sync(nextDay, economicMonthNumber);
      const populationSnapshot = population.commitPreparedSync(populationPlan);
      if (moduleRegistry.has("economia")) updateModuleSnapshot("economia", moduleSnapshot, "economia.adapter");
      if (gameOver) setStatus("game-over", gameOverDetails);
      worldPayload.calendar = calendarSnapshot;
      worldPayload.population = populationSnapshot.totals;
      eventBus.emit("world:synchronized", worldPayload, { day: currentDay, source: "core.world" });
      return getSnapshot();
    }

    function publish(topic, payload, source = "core") {
      if (!String(topic || "").trim()) throw new TypeError("O tópico publicado é obrigatório.");
      return eventBus.emit(topic, payload, { day: currentDay, source });
    }

    function getSnapshot() {
      return {
        coreVersion: CORE_VERSION,
        session: clone(session),
        calendar: clock.snapshot(),
        population: population.getSnapshot(),
        modules: getModules(),
        recentEvents: eventBus.getHistory({ limit: 30 })
      };
    }

    registerModule({
      id: "core",
      version: CORE_VERSION,
      name: "Núcleo central",
      description: "Calendário, estado da partida, população compartilhada e barramento de eventos."
    });

    return {
      version: CORE_VERSION,
      events: eventBus,
      clock,
      population: {
        syncFromEconomy: population.syncFromEconomy,
        getSnapshot: population.getSnapshot,
        addExtension: population.addExtension,
        reset: population.reset
      },
      modules: {
        register: registerModule,
        updateSnapshot: updateModuleSnapshot,
        list: getModules,
        has: (id) => moduleRegistry.has(id),
        get: (id) => {
          const record = moduleRegistry.get(id);
          return record ? { ...clone(record), snapshot: clone(moduleSnapshots.get(id) || {}) } : null;
        }
      },
      session: {
        setStatus,
        reset: resetSession,
        get: () => clone(session)
      },
      syncFromEconomy,
      publish,
      snapshot: getSnapshot
    };
  }

  return { version: CORE_VERSION, createRuntime };
});
