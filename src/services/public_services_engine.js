'use strict';

/**
 * Public Services Operations Engine
 *
 * Complementa VilarejoServices com instalações físicas, capacidade,
 * pessoal, custos, demanda, cobertura, consequências e save/load.
 *
 * Os valores são parâmetros de balanceamento do jogo, não dados normativos.
 */
(function attach(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.VilarejoPublicServices = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createEngine() {
  const VERSION = "1.0.0";
  const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Number(n) || 0));
  const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
  const clone = value => JSON.parse(JSON.stringify(value));

  const FACILITIES = Object.freeze({
    health_post: {
      id: "health_post", domain: "health", name: "Unidade Básica de Saúde",
      capacityPerWorker: 18, maxWorkers: 8, constructionCost: 9000,
      monthlyFixedCost: 180, wage: 1450, minimumWorkers: 2,
      effects: { prevention: 2.2, access: 2.8, healthOutcomes: 0.8 }
    },
    hospital: {
      id: "hospital", domain: "health", name: "Hospital Municipal",
      capacityPerWorker: 10, maxWorkers: 20, constructionCost: 30000,
      monthlyFixedCost: 650, wage: 1900, minimumWorkers: 5,
      effects: { capacity: 4.2, access: 1.5, healthOutcomes: 1.4 }
    },
    school: {
      id: "school", domain: "education", name: "Escola Básica",
      capacityPerWorker: 14, maxWorkers: 16, constructionCost: 12000,
      monthlyFixedCost: 220, wage: 1650, minimumWorkers: 3,
      effects: { access: 3.2, attendance: 1.8, learning: 1.0 }
    },
    technical_school: {
      id: "technical_school", domain: "education", name: "Escola Técnica",
      capacityPerWorker: 10, maxWorkers: 14, constructionCost: 18000,
      monthlyFixedCost: 320, wage: 1850, minimumWorkers: 3,
      effects: { qualification: 3.0, learning: 1.4, access: 0.8 }
    },
    police_station: {
      id: "police_station", domain: "security", name: "Posto Policial",
      capacityPerWorker: 35, maxWorkers: 10, constructionCost: 10000,
      monthlyFixedCost: 260, wage: 1750, minimumWorkers: 3,
      effects: { prevention: 3.2, response: 1.5, publicTrust: 1.0 }
    },
    fire_station: {
      id: "fire_station", domain: "security", name: "Base de Proteção Civil",
      capacityPerWorker: 45, maxWorkers: 8, constructionCost: 14000,
      monthlyFixedCost: 300, wage: 1750, minimumWorkers: 3,
      effects: { response: 3.5, prevention: 1.2, publicTrust: 0.8 }
    }
  });

  const DOMAINS = Object.freeze(["health", "education", "security"]);

  function emptyState() {
    return {
      version: VERSION, month: 0, nextFacilityId: 1, facilities: [],
      workforce: { health: 0, education: 0, security: 0, total: 0 },
      lastReport: null, history: [], pendingBudget: [],
      outcomes: { mortalityRisk: 0, schoolDropoutRisk: 0, crimeRisk: 0, emergencyRisk: 0 }
    };
  }

  function createState(seed = {}) {
    const state = emptyState();
    if (seed && typeof seed === "object") {
      state.month = Number(seed.month) || 0;
      state.nextFacilityId = Number(seed.nextFacilityId) || 1;
      state.facilities = Array.isArray(seed.facilities) ? clone(seed.facilities) : [];
      state.outcomes = { ...state.outcomes, ...(seed.outcomes || {}) };
      state.pendingBudget = clone(seed.pendingBudget || []);
      state.history = clone(seed.history || []);
      state.lastReport = clone(seed.lastReport || null);
      rebuildWorkforce(state);
    }
    return state;
  }

  function rebuildWorkforce(state) {
    const workforce = { health: 0, education: 0, security: 0, total: 0 };
    for (const facility of state.facilities) {
      const workers = Math.max(0, Number(facility.workers) || 0);
      if (workforce[facility.domain] !== undefined) workforce[facility.domain] += workers;
      workforce.total += workers;
    }
    state.workforce = workforce;
    return workforce;
  }

  function catalog(type) {
    const spec = FACILITIES[type];
    if (!spec) throw new Error("Tipo de instalação pública inexistente: " + type);
    return spec;
  }

  function buildFacility(state, type, options = {}) {
    const spec = catalog(type);
    const workers = Math.min(
      spec.maxWorkers,
      Math.max(0, Number(options.workers) || spec.minimumWorkers)
    );
    if (workers < spec.minimumWorkers) {
      return { ok: false, reason: "minimum_staff", required: spec.minimumWorkers };
    }

    const facility = {
      id: "facility-" + state.nextFacilityId++,
      type: spec.id,
      domain: spec.domain,
      name: options.name || spec.name,
      workers,
      condition: clamp(options.condition ?? 100),
      operational: true,
      builtMonth: state.month
    };

    state.facilities.push(facility);
    rebuildWorkforce(state);

    const budgetRequest = {
      kind: "construction",
      facilityId: facility.id,
      amount: spec.constructionCost,
      month: state.month,
      reason: "Construção de " + spec.name
    };
    state.pendingBudget.push(budgetRequest);

    return { ok: true, facility: clone(facility), budgetRequest: clone(budgetRequest) };
  }

  function hire(state, facilityId, count = 1) {
    const facility = state.facilities.find(f => f.id === facilityId);
    if (!facility) return { ok: false, reason: "facility_not_found" };

    const spec = catalog(facility.type);
    const requested = Math.max(0, Math.floor(Number(count) || 0));
    const hired = Math.min(requested, spec.maxWorkers - facility.workers);

    facility.workers += hired;
    rebuildWorkforce(state);

    return {
      ok: hired > 0,
      hired,
      wageBillIncrease: round2(hired * spec.wage),
      facility: clone(facility)
    };
  }

  function setCondition(state, facilityId, condition) {
    const facility = state.facilities.find(f => f.id === facilityId);
    if (!facility) return false;
    facility.condition = clamp(condition);
    facility.operational = facility.condition > 0;
    return true;
  }

  function demandFor(domain, demographics = {}) {
    const population = Math.max(0, Number(demographics.population) || 0);
    const children = Math.max(0, Number(demographics.children) || 0);
    const workingAge = Math.max(0, Number(demographics.workingAge) || 0);
    const elderly = Math.max(0, Number(demographics.elderly) || 0);

    if (domain === "health") return round2(population * 0.65 + elderly * 1.5);
    if (domain === "education") return round2(children);
    if (domain === "security") return round2(population * 0.45 + workingAge * 0.12);
    return 0;
  }

  function aggregate(state, demographics = {}) {
    const byDomain = {};

    for (const domain of DOMAINS) {
      const facilities = state.facilities.filter(
        f => f.domain === domain && f.operational
      );

      let capacity = 0;
      let staff = 0;
      let qualityAccumulator = 0;

      for (const facility of facilities) {
        const spec = catalog(facility.type);
        const conditionFactor = clamp(facility.condition) / 100;
        capacity += facility.workers * spec.capacityPerWorker * conditionFactor;
        staff += facility.workers;
        qualityAccumulator +=
          conditionFactor *
          Math.min(1, facility.workers / Math.max(1, spec.minimumWorkers));
      }

      const demand = demandFor(domain, demographics);
      const coverage = demand > 0 ? clamp((capacity / demand) * 100) : 100;

      byDomain[domain] = {
        demand: round2(demand),
        capacity: round2(capacity),
        staff,
        coverage: round2(coverage),
        deficit: round2(Math.max(0, demand - capacity)),
        quality: round2(
          facilities.length ? (qualityAccumulator / facilities.length) * 100 : 0
        ),
        facilities: facilities.length
      };
    }

    return byDomain;
  }

  function monthlyCost(state) {
    const byDomain = { health: 0, education: 0, security: 0 };
    let total = 0;

    for (const facility of state.facilities) {
      const spec = catalog(facility.type);
      const cost = spec.monthlyFixedCost + facility.workers * spec.wage;
      total += cost;
      byDomain[facility.domain] += cost;
    }

    return { total: round2(total), byDomain: clone(byDomain) };
  }

  function calculateOutcomes(data) {
    const health = data.health.coverage;
    const education = data.education.coverage;
    const security = data.security.coverage;

    return {
      mortalityRisk: round2(clamp(100 - health)),
      schoolDropoutRisk: round2(clamp(100 - education)),
      crimeRisk: round2(clamp(100 - security)),
      emergencyRisk: round2(clamp(100 - ((health + security) / 2)))
    };
  }

  function advanceMonth(state, demographics = {}) {
    state.month += 1;

    const data = aggregate(state, demographics);
    const operatingCost = monthlyCost(state);
    const outcomes = calculateOutcomes(data);

    state.outcomes = outcomes;

    const report = {
      month: state.month,
      demand: clone(data),
      operatingCost,
      outcomes: clone(outcomes),
      budgetRequests: state.pendingBudget.splice(0),
      workforce: clone(state.workforce)
    };

    state.lastReport = report;
    state.history.push(clone(report));
    if (state.history.length > 60) state.history.shift();

    for (const facility of state.facilities) {
      facility.condition = clamp(facility.condition - (facility.workers > 0 ? 0.15 : 0.35));
    }

    return clone(report);
  }

  function snapshot(state) {
    return {
      version: VERSION,
      month: state.month,
      facilities: clone(state.facilities),
      workforce: clone(state.workforce),
      lastReport: clone(state.lastReport),
      outcomes: clone(state.outcomes),
      monthlyCost: monthlyCost(state),
      aggregate: state.lastReport?.demand || null
    };
  }

  function serialize(state) {
    return JSON.stringify(state);
  }

  function restore(serialized) {
    return createState(
      typeof serialized === "string" ? JSON.parse(serialized) : serialized
    );
  }

  function integrateWithServices(servicesState, engineState, demographics = {}) {
    if (!servicesState?.domains) {
      throw new TypeError("Estado de Serviços Públicos inválido.");
    }

    const data = aggregate(engineState, demographics);

    for (const domain of DOMAINS) {
      const target = servicesState.domains[domain];
      if (!target) continue;

      target.capacityPressure = round2(data[domain].deficit);
      target.satisfaction = clamp(
        data[domain].coverage * 0.55 + data[domain].quality * 0.45
      );
      target.lastOperational = clone(data[domain]);
    }

    return servicesState;
  }

  return {
    VERSION,
    FACILITIES,
    DOMAINS,
    createState,
    buildFacility,
    hire,
    setCondition,
    demandFor,
    aggregate,
    monthlyCost,
    calculateOutcomes,
    advanceMonth,
    snapshot,
    serialize,
    restore,
    integrateWithServices,
    catalog
  };
});
