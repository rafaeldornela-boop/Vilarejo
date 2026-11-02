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

    function syncFromEconomy(households, day) {
      if (!Array.isArray(households)) throw new TypeError("A sincronização populacional exige uma lista de domicílios.");
      const existing = new Map(groups.map((group) => [String(group.id), group]));
      groups = households.map((household) => {
        const id = String(household.id);
        const previous = existing.get(id) || {};
        const adults = Math.max(0, Math.floor(finiteNumber(household.adults)));
        const children = Math.max(0, Math.floor(finiteNumber(household.children)));
        const jobs = Math.max(0, finiteNumber(household.jobs));
        return {
          id,
          label: String(household.name || `Grupo ${id}`),
          category: String(household.type || "household"),
          adults,
          children,
          population: adults + children,
          employed: jobs,
          happiness: Math.max(0, Math.min(100, finiteNumber(household.happiness, 0))),
          sourceModule: "economia",
          updatedDay: Math.max(1, Math.floor(finiteNumber(day, getDay ? getDay() : 1))),
          extensions: clone(previous.extensions || {})
        };
      });
      lastSynchronizedDay = Math.max(1, Math.floor(finiteNumber(day, getDay ? getDay() : 1)));
      const snapshot = getSnapshot();
      eventBus.emit("population:synchronized", snapshot, {
        day: lastSynchronizedDay,
        source: "core.population"
      });
      return snapshot;
    }

    function getSnapshot() {
      const totals = groups.reduce((result, group) => {
        result.groups += 1;
        result.adults += group.adults;
        result.children += group.children;
        result.total += group.population;
        result.employed += group.employed;
        result.weightedHappiness += group.happiness * group.population;
        return result;
      }, { groups: 0, adults: 0, children: 0, total: 0, employed: 0, weightedHappiness: 0 });
      totals.averageHappiness = totals.total > 0 ? Number((totals.weightedHappiness / totals.total).toFixed(2)) : 0;
      delete totals.weightedHappiness;
      return {
        totals,
        groups: clone(groups),
        lastSynchronizedDay
      };
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

    return { syncFromEconomy, getSnapshot, addExtension, reset };
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
      if (!economicState || typeof economicState !== "object") throw new TypeError("O estado econômico é obrigatório.");
      currentDay = Math.max(1, Math.floor(finiteNumber(economicState.day, currentDay)));
      const economicMonthNumber = Math.max(0, Math.floor(finiteNumber(economicState.monthNumber, 0)));
      const calendarSnapshot = clock.sync(currentDay, economicMonthNumber);
      const populationSnapshot = population.syncFromEconomy(economicState.households || [], currentDay);
      if (moduleRegistry.has("economia")) {
        updateModuleSnapshot("economia", {
          release: "3.0.0",
          day: currentDay,
          monthNumber: economicMonthNumber,
          calendar: calendarSnapshot,
          population: populationSnapshot.totals,
          status: economicState.gameOver ? "game-over" : "active",
          owner: economicState.owner || null,
          accounts: clone(economicState.accounts || {}),
          marketPrice: finiteNumber(economicState.marketPrice),
          exchangeRate: finiteNumber(economicState.fx)
        }, "economia.adapter");
      }
      if (economicState.gameOver) setStatus("game-over", { reason: economicState.gameOver });
      eventBus.emit("world:synchronized", {
        reason,
        calendar: calendarSnapshot,
        population: populationSnapshot.totals
      }, { day: currentDay, source: "core.world" });
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
      population,
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
