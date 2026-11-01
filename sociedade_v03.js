(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.VilarejoSociety = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = 3;
  const MONTHS_PER_YEAR = 12;
  const ADULT_AGE = 18;
  const RETIREMENT_AGE = 65;
  const HISTORY_LIMIT = 36;
  const CULTURE_GROUPS_FOR_MIGRANTS = ["regional", "urbana", "rural"];
  const DEFAULT_BIRTH_PROBABILITY = 0.006;
  const DEFAULT_MORTALITY = { child: 0.00001, adult: 0.00008, elderly: 0.002 };
  const QOL_WEIGHTS = {
    purchasingPower: 0.22,
    foodSecurity: 0.22,
    employment: 0.16,
    housing: 0.12,
    infrastructure: 0.12,
    householdWellbeing: 0.16
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const safeNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function createState() {
    return {
      version: VERSION,
      nextPersonId: 1,
      nextCultureIndex: 0,
      currentMonth: 0,
      lastAdvancedMonth: null,
      demographic: { births: 0, deaths: 0, agingTransitions: 0 },
      migration: {
        monthly: { month: 0, incoming: 0, outgoing: 0, net: 0, incomingHouseholds: 0, outgoingHouseholds: 0 },
        cumulative: { incoming: 0, outgoing: 0, net: 0, incomingHouseholds: 0, outgoingHouseholds: 0 },
        history: []
      },
      qualityOfLife: { current: null, history: [] },
      culture: { diversityIndex: 0, integrationIndex: null, groups: [] },
      events: []
    };
  }

  function pushEvent(state, event) {
    state.events.push({ ...event, id: `${event.month || state.currentMonth || 0}-${state.events.length + 1}` });
    if (state.events.length > 120) state.events.splice(0, state.events.length - 120);
  }

  function nextPersonId(state) {
    const id = `p${state.nextPersonId}`;
    state.nextPersonId += 1;
    return id;
  }

  function createPerson(state, values = {}) {
    return {
      id: values.id || nextPersonId(state),
      age: clamp(values.age ?? 30, 0, 110),
      sex: values.sex === "F" ? "F" : "M",
      cultureGroup: values.cultureGroup || "local",
      integration: clamp(values.integration ?? 100, 0, 100),
      bornHere: values.bornHere !== false,
      origin: values.origin || (values.bornHere === false ? "externo" : "vilarejo"),
      arrivalMonth: Number.isFinite(values.arrivalMonth) ? values.arrivalMonth : null,
      monthsInVillage: Math.max(0, Math.floor(safeNumber(values.monthsInVillage, 0))),
      pregnancyMonthsRemaining: Number.isFinite(values.pregnancyMonthsRemaining) ? values.pregnancyMonthsRemaining : null,
      laborForceStatus: values.laborForceStatus === "out" ? "out" : "available"
    };
  }

  function defaultAges(household) {
    const profiles = {
      1: { adults: [34, 32], children: [9, 6], sexes: ["F", "M", "F", "M"] },
      2: { adults: [38, 35], children: [12, 9], sexes: ["F", "M", "M", "F"] },
      3: { adults: [28], children: [], sexes: ["F"] },
      4: { adults: [32], children: [], sexes: ["M"] }
    };
    const profile = profiles[household.id];
    if (profile) {
      return [
        ...profile.adults.slice(0, household.adults).map((age, i) => ({ age, sex: profile.sexes[i] || (i % 2 ? "M" : "F") })),
        ...profile.children.slice(0, household.children).map((age, i) => ({ age, sex: profile.sexes[profile.adults.length + i] || (i % 2 ? "M" : "F") }))
      ];
    }
    const adults = Math.max(0, Math.floor(safeNumber(household.adults)));
    const children = Math.max(0, Math.floor(safeNumber(household.children)));
    const adultProfiles = Array.from({ length: adults }, (_, i) => ({ age: 25 + (i * 7) % 20, sex: i % 2 ? "M" : "F" }));
    const childProfiles = Array.from({ length: children }, (_, i) => ({ age: 5 + (i * 3) % 10, sex: i % 2 ? "F" : "M" }));
    return [...adultProfiles, ...childProfiles];
  }

  function ensureHousehold(simulation, household, options = {}) {
    const state = simulation.society;
    if (!Array.isArray(household.members)) {
      household.members = defaultAges(household).map((profile, index) => createPerson(state, {
        ...profile,
        cultureGroup: options.cultureGroup || "local",
        integration: options.integration ?? 100,
        bornHere: options.bornHere !== false,
        origin: options.origin || (options.bornHere === false ? "externo" : "vilarejo"),
        arrivalMonth: options.arrivalMonth ?? null,
        laborForceStatus: profile.age >= ADULT_AGE && index >= Math.max(0, household.adults - (household.outOfLaborForce || 0)) ? "out" : "available"
      }));
    }
    return household.members;
  }

  function updateHouseholdCounts(household) {
    const oldAdults = Math.max(0, Math.floor(safeNumber(household.adults)));
    const members = Array.isArray(household.members) ? household.members : [];
    const adults = members.filter((person) => person.age >= ADULT_AGE);
    const children = members.length - adults.length;
    const retiredPeople = adults.filter((person) => person.age >= RETIREMENT_AGE);
    const workingAgePeople = adults.filter((person) => person.age < RETIREMENT_AGE);
    const currentOutOfForce = Math.max(0, Math.floor(safeNumber(household.outOfLaborForce)));
    if (Number.isFinite(household.lastDemographicOutOfLaborForce) && currentOutOfForce !== household.lastDemographicOutOfLaborForce) {
      household.voluntaryOutOfLaborForce = Math.max(0, currentOutOfForce - retiredPeople.length);
    }
    const voluntaryOut = Math.max(0, Math.floor(safeNumber(household.voluntaryOutOfLaborForce, currentOutOfForce)));
    const voluntaryOutCount = Math.min(workingAgePeople.length, voluntaryOut);
    const available = Math.max(0, workingAgePeople.length - voluntaryOutCount);
    members.forEach((person) => {
      if (person.age < ADULT_AGE) person.laborForceStatus = "child";
      else if (person.age >= RETIREMENT_AGE) person.laborForceStatus = "retired";
      else person.laborForceStatus = "available";
    });
    if (voluntaryOutCount > 0) workingAgePeople.slice(-voluntaryOutCount).forEach((person) => { person.laborForceStatus = "out"; });
    household.adults = adults.length;
    household.children = children;
    household.outOfLaborForce = voluntaryOutCount + retiredPeople.length;
    household.lastDemographicOutOfLaborForce = household.outOfLaborForce;
    if (Number.isFinite(household.jobs) && household.jobs > available) {
      const oldJobs = household.jobs;
      household.jobs = available;
      if (household.sectorJobs && oldJobs > 0) {
        const ratio = available / oldJobs;
        for (const key of Object.keys(household.sectorJobs)) household.sectorJobs[key] = round1((household.sectorJobs[key] || 0) * ratio);
      }
    }
    household.demographicWorkingAge = workingAgePeople.length;
    household.demographicElderly = retiredPeople.length;
    return { oldAdults, adults: adults.length, children, retired: retiredPeople.length, available };
  }

  function ensureMonthlyMigration(state, month) {
    if (state.migration.monthly.month !== month) {
      state.migration.monthly = { month, incoming: 0, outgoing: 0, net: 0, incomingHouseholds: 0, outgoingHouseholds: 0 };
    }
    return state.migration.monthly;
  }

  function initialize(simulation, helpers = {}) {
    if (!simulation || typeof simulation !== "object" || !Array.isArray(simulation.households)) {
      throw new TypeError("A simulação precisa conter a lista de domicílios.");
    }
    const previous = simulation.society;
    simulation.society = previous && previous.version === VERSION ? previous : createState();
    const state = simulation.society;
    for (const household of simulation.households) {
      household.voluntaryOutOfLaborForce = Math.max(0, Math.floor(safeNumber(household.outOfLaborForce)));
      ensureHousehold(simulation, household);
      updateHouseholdCounts(household);
    }
    state.currentMonth = safeNumber(simulation.monthNumber, 0);
    state.migration.monthly.month = state.currentMonth;
    refreshCulture(simulation);
    state.qualityOfLife.current = calculateQualityOfLife(simulation, helpers);
    return state;
  }

  function recordMigration(simulation, direction, household, reason, month) {
    if (!simulation.society) initialize(simulation);
    const state = simulation.society;
    const currentMonth = Number.isFinite(month) ? month : safeNumber(simulation.monthNumber, 0) + 1;
    const bucket = ensureMonthlyMigration(state, currentMonth);
    const people = Array.isArray(household.members) ? household.members.length : Math.max(1, (household.adults || 0) + (household.children || 0));
    if (direction === "in") {
      bucket.incoming += people;
      bucket.incomingHouseholds += 1;
      state.migration.cumulative.incoming += people;
      state.migration.cumulative.incomingHouseholds += 1;
    } else {
      bucket.outgoing += people;
      bucket.outgoingHouseholds += 1;
      state.migration.cumulative.outgoing += people;
      state.migration.cumulative.outgoingHouseholds += 1;
    }
    bucket.net = bucket.incoming - bucket.outgoing;
    state.migration.cumulative.net = state.migration.cumulative.incoming - state.migration.cumulative.outgoing;
    pushEvent(state, {
      type: direction === "in" ? "migration_in" : "migration_out",
      month: currentMonth,
      people,
      household: household.name || "Domicílio",
      reason: reason || "migração econômica",
      message: direction === "in"
        ? `${people} morador(es) chegaram ao vilarejo (${reason || "migração econômica"}).`
        : `${people} morador(es) deixaram o vilarejo (${reason || "migração econômica"}).`
    });
  }

  function prepareImmigrant(simulation, household, options = {}) {
    if (!simulation.society) initialize(simulation);
    const state = simulation.society;
    const cultureGroup = options.cultureGroup || CULTURE_GROUPS_FOR_MIGRANTS[state.nextCultureIndex % CULTURE_GROUPS_FOR_MIGRANTS.length];
    const originByCulture = { regional: "município da região", urbana: "centro urbano", rural: "zona rural" };
    state.nextCultureIndex += 1;
    household.voluntaryOutOfLaborForce = 0;
    household.members = [createPerson(state, {
      age: options.age ?? 28,
      sex: options.sex || (state.nextCultureIndex % 2 ? "F" : "M"),
      cultureGroup,
      integration: 42,
      bornHere: false,
      origin: options.origin || originByCulture[cultureGroup] || "outra localidade",
      arrivalMonth: options.month ?? safeNumber(simulation.monthNumber, 0) + 1,
      monthsInVillage: 0
    })];
    updateHouseholdCounts(household);
    recordMigration(simulation, "in", household, options.reason || "atratividade econômica local", options.month);
    refreshCulture(simulation);
    return household;
  }

  function recordDeparture(simulation, household, options = {}) {
    if (!simulation.society) initialize(simulation);
    ensureHousehold(simulation, household);
    recordMigration(simulation, "out", household, options.reason || "atratividade econômica externa", options.month);
  }

  function refreshCulture(simulation) {
    const state = simulation.society;
    const people = simulation.households.flatMap((household) => household.members || []);
    const groups = new Map();
    for (const person of people) groups.set(person.cultureGroup || "local", (groups.get(person.cultureGroup || "local") || 0) + 1);
    const total = people.length;
    const proportions = [...groups.values()].map((count) => count / Math.max(1, total));
    const rawDiversity = 1 - proportions.reduce((sum, proportion) => sum + proportion * proportion, 0);
    const maximum = groups.size > 1 ? 1 - (1 / groups.size) : 0;
    const diversityIndex = maximum > 0 ? round1((rawDiversity / maximum) * 100) : 0;
    const migrants = people.filter((person) => person.bornHere === false);
    const integrationIndex = migrants.length
      ? round1(migrants.reduce((sum, person) => sum + clamp(person.integration, 0, 100), 0) / migrants.length)
      : null;
    state.culture = {
      diversityIndex,
      integrationIndex,
      groups: [...groups.entries()].map(([id, count]) => ({ id, count, share: round1((count / Math.max(1, total)) * 100) })).sort((a, b) => b.count - a.count),
      population: total,
      migrantResidents: migrants.length
    };
    return state.culture;
  }

  function getDemographicSnapshot(simulation) {
    const people = (simulation.households || []).flatMap((household) => household.members || []);
    const children = people.filter((person) => person.age < ADULT_AGE).length;
    const workingAge = people.filter((person) => person.age >= ADULT_AGE && person.age < RETIREMENT_AGE).length;
    const elderly = people.filter((person) => person.age >= RETIREMENT_AGE).length;
    const population = people.length;
    const dependents = children + elderly;
    return {
      population,
      children,
      workingAge,
      elderly,
      dependents,
      dependencyRatio: workingAge > 0 ? round1((dependents / workingAge) * 100) : null,
      households: (simulation.households || []).filter((household) => people.some((person) => person && (household.members || []).includes(person))).length,
      foreignBorn: people.filter((person) => person.bornHere === false).length,
      foreignBornShare: population ? round1((people.filter((person) => person.bornHere === false).length / population) * 100) : 0
    };
  }

  function calculateQualityOfLife(simulation, helpers = {}) {
    const households = simulation.households || [];
    const people = households.reduce((sum, household) => sum + (household.adults || 0) + (household.children || 0), 0);
    const basketCost = Math.max(1, safeNumber(simulation.policy && simulation.policy.basketCost, 220));
    let totalHouseholdWeight = 0;
    let weightedAffordability = 0;
    const householdWellbeing = [];
    for (const household of households) {
      const size = Math.max(0, (household.adults || 0) + (household.children || 0));
      if (!size) continue;
      const equivalentPeople = Math.max(1, (household.adults || 0) + (household.children || 0) * 0.7);
      const monthlyIncome = Math.max(0, safeNumber(household.lastCashIncome, safeNumber(household.cashIncome)));
      const affordabilityRatio = monthlyIncome / (basketCost * equivalentPeople);
      const affordabilityScore = clamp((affordabilityRatio / 1.5) * 100, 0, 100);
      weightedAffordability += affordabilityScore * size;
      totalHouseholdWeight += size;
      householdWellbeing.push({ score: clamp(household.happiness, 0, 100), weight: size });
    }
    const purchasingPower = totalHouseholdWeight ? round1(weightedAffordability / totalHouseholdWeight) : 0;
    const demandUnits = Math.max(1, safeNumber(simulation.lastDemandUnits, 1));
    const shortageUnits = Math.max(0, safeNumber(simulation.lastShortageUnits, 0));
    const foodSecurity = round1(100 * (1 - clamp(shortageUnits / demandUnits, 0, 1)));
    const labor = typeof helpers.getLaborStats === "function" ? helpers.getLaborStats() : {
      laborForce: households.reduce((sum, household) => sum + Math.max(0, (household.adults || 0) - (household.outOfLaborForce || 0)), 0),
      occupied: households.reduce((sum, household) => sum + Math.max(0, household.jobs || 0), 0)
    };
    const fallbackUnemployment = labor.laborForce > 0 ? 100 * Math.max(0, labor.laborForce - labor.occupied) / labor.laborForce : 0;
    const unemploymentRate = safeNumber(labor.unemploymentRate, fallbackUnemployment);
    const employment = round1(100 - clamp(unemploymentRate, 0, 100));
    const housingCapacity = Math.max(0, safeNumber(simulation.housingCapacity));
    const housing = people > 0 ? round1(100 * clamp(housingCapacity / people, 0, 1)) : 0;
    const congestion = Math.max(1, safeNumber(simulation.urbanInfra && simulation.urbanInfra.congestionRatio, 1));
    const infrastructure = round1(100 * clamp(1 / congestion, 0, 1));
    const wellbeing = householdWellbeing.length
      ? round1(householdWellbeing.reduce((sum, item) => sum + item.score * item.weight, 0) / householdWellbeing.reduce((sum, item) => sum + item.weight, 0))
      : 0;
    const components = { purchasingPower, foodSecurity, employment, housing, infrastructure, householdWellbeing: wellbeing };
    const score = round1(Object.entries(QOL_WEIGHTS).reduce((sum, [key, weight]) => sum + components[key] * weight, 0));
    const approval = typeof helpers.approval === "function" ? round1(helpers.approval()) : wellbeing;
    const householdsWellbeing = householdWellbeing.map((item) => item.score);
    const lowestHouseholdWellbeing = householdsWellbeing.length ? round1(Math.min(...householdsWellbeing)) : null;
    const highestHouseholdWellbeing = householdsWellbeing.length ? round1(Math.max(...householdsWellbeing)) : null;
    return {
      score,
      level: score >= 80 ? "Alta" : score >= 65 ? "Favorável" : score >= 50 ? "Intermediária" : score >= 35 ? "Baixa" : "Crítica",
      components,
      weights: { ...QOL_WEIGHTS },
      approval,
      lowestHouseholdWellbeing,
      highestHouseholdWellbeing,
      wellbeingGap: lowestHouseholdWellbeing === null ? null : round1(highestHouseholdWellbeing - lowestHouseholdWellbeing),
      measuredDimensions: 6,
      unmeasuredDimensions: ["saúde", "educação", "segurança", "saneamento", "meio ambiente", "cultura e lazer"],
      month: Number.isFinite(helpers.month) ? helpers.month : safeNumber(simulation.monthNumber, 0)
    };
  }

  function refreshQualityOfLife(simulation, helpers = {}) {
    const state = simulation.society;
    const current = calculateQualityOfLife(simulation, helpers);
    const previous = state.qualityOfLife.current;
    current.change = previous ? round1(current.score - previous.score) : null;
    current.trend = current.change === null ? "sem histórico" : current.change > 0.5 ? "melhorando" : current.change < -0.5 ? "piorando" : "estável";
    state.qualityOfLife.current = current;
    if (!state.qualityOfLife.history.length || state.qualityOfLife.history[state.qualityOfLife.history.length - 1].month !== current.month) {
      state.qualityOfLife.history.push({ month: current.month, score: current.score, level: current.level });
      if (state.qualityOfLife.history.length > HISTORY_LIMIT) state.qualityOfLife.history.shift();
    }
    return current;
  }

  function ageAndDevelop(simulation, state, options = {}) {
    const random = typeof options.random === "function" ? options.random : Math.random;
    const birthProbability = clamp(options.birthProbability ?? DEFAULT_BIRTH_PROBABILITY, 0, 1);
    const mortality = { ...DEFAULT_MORTALITY, ...(options.mortalityRates || {}) };
    const month = Number.isFinite(options.month) ? options.month : safeNumber(simulation.monthNumber, 0) + 1;
    const events = [];
    let births = 0;
    let deaths = 0;
    let agingTransitions = 0;
    for (const household of simulation.households || []) {
      ensureHousehold(simulation, household);
      const previousChildren = household.children || 0;
      const survivors = [];
      let birthsThisHousehold = 0;
      for (const person of household.members) {
        const newlyArrived = person.arrivalMonth === month && person.monthsInVillage === 0;
        const previousAge = person.age;
        if (!newlyArrived) {
          person.age = Math.min(110, person.age + 1 / MONTHS_PER_YEAR);
          person.monthsInVillage = (person.monthsInVillage || 0) + 1;
        }
        if ((previousAge < ADULT_AGE && person.age >= ADULT_AGE) || (previousAge < RETIREMENT_AGE && person.age >= RETIREMENT_AGE)) agingTransitions += 1;
        const group = person.age < ADULT_AGE ? "child" : person.age < RETIREMENT_AGE ? "adult" : "elderly";
        if (random() < clamp(safeNumber(mortality[group], 0), 0, 1)) {
          deaths += 1;
          events.push({ type: "death", month, message: `Um morador de ${household.name || "um domicílio"} faleceu.` });
          continue;
        }
        if (person.pregnancyMonthsRemaining !== null) {
          person.pregnancyMonthsRemaining -= 1;
          if (person.pregnancyMonthsRemaining <= 0) {
            const inherited = household.members.reduce((counts, member) => {
              const key = member.cultureGroup || "local";
              counts[key] = (counts[key] || 0) + 1;
              return counts;
            }, {});
            const dominantCulture = Object.entries(inherited).sort((a, b) => b[1] - a[1])[0]?.[0] || "local";
            const baby = createPerson(state, { age: 0, sex: random() < 0.5 ? "F" : "M", cultureGroup: dominantCulture, integration: 100, bornHere: true, origin: "nascido_no_vilarejo" });
            survivors.push(baby);
            births += 1;
            birthsThisHousehold += 1;
            events.push({ type: "birth", month, message: `Nasceu um novo morador em ${household.name || "um domicílio"}.` });
            person.pregnancyMonthsRemaining = null;
          }
        } else if (person.sex === "F" && person.age >= 20 && person.age <= 39) {
          const pendingPregnancies = household.members.filter((member) => member.pregnancyMonthsRemaining !== null).length;
          if (household.children + birthsThisHousehold + pendingPregnancies < 3 && random() < birthProbability) person.pregnancyMonthsRemaining = 9;
        }
        if (!newlyArrived && person.bornHere === false && person.cultureGroup !== "local") {
          const shortageRatio = clamp(safeNumber(simulation.lastShortageUnits) / Math.max(1, safeNumber(simulation.lastDemandUnits, 1)), 0, 1);
          const householdStress = clamp((safeNumber(household.happiness, 50) - 25) / 75, 0, 1);
          const gain = 0.85 * householdStress * (1 - shortageRatio);
          person.integration = clamp(person.integration + gain, 0, 100);
        }
        survivors.push(person);
      }
      household.members = survivors;
      const composition = updateHouseholdCounts(household);
      if (previousChildren > 0 && composition.children < previousChildren) {
        const matured = Math.min(previousChildren - composition.children, composition.adults - composition.oldAdults);
        if (matured > 0) events.push({ type: "coming_of_age", month, message: `${matured} morador(es) de ${household.name || "um domicílio"} atingiram a vida adulta.` });
      }
    }
    state.demographic.births += births;
    state.demographic.deaths += deaths;
    state.demographic.agingTransitions += agingTransitions;
    state.demographic.lastMonth = { month, births, deaths, agingTransitions };
    for (const event of events) pushEvent(state, event);
    return events;
  }

  function advanceMonth(simulation, helpers = {}) {
    if (!simulation.society) initialize(simulation);
    const state = simulation.society;
    const month = Number.isFinite(helpers.month) ? helpers.month : safeNumber(simulation.monthNumber, 0) + 1;
    ensureMonthlyMigration(state, month);
    if (state.lastAdvancedMonth === month) {
      return { state, events: [], demographic: getDemographicSnapshot(simulation), culture: state.culture, migration: state.migration.monthly, qualityOfLife: state.qualityOfLife.current };
    }
    state.currentMonth = month;
    const events = ageAndDevelop(simulation, state, { ...helpers, month });
    refreshCulture(simulation);
    const qol = refreshQualityOfLife(simulation, { ...helpers, month });
    state.lastAdvancedMonth = month;
    const bucket = state.migration.monthly;
    if (!state.migration.history.length || state.migration.history[state.migration.history.length - 1].month !== month) {
      state.migration.history.push({ ...bucket });
      if (state.migration.history.length > HISTORY_LIMIT) state.migration.history.shift();
    }
    return { state, events, demographic: getDemographicSnapshot(simulation), culture: state.culture, migration: bucket, qualityOfLife: qol };
  }

  function overview(simulation) {
    const state = simulation.society || initialize(simulation);
    refreshCulture(simulation);
    return {
      demographic: getDemographicSnapshot(simulation),
      migration: clone(state.migration),
      culture: clone(state.culture),
      qualityOfLife: clone(state.qualityOfLife),
      demographicEvents: clone(state.demographic),
      recentEvents: clone(state.events.slice(-8))
    };
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function renderDashboard(simulation, host) {
    if (!host || !simulation || !simulation.society) return;
    const data = overview(simulation);
    const d = data.demographic;
    const c = data.culture;
    const m = data.migration;
    const q = data.qualityOfLife.current || calculateQualityOfLife(simulation);
    const previous = data.qualityOfLife.history.length > 1 ? data.qualityOfLife.history[data.qualityOfLife.history.length - 2].score : null;
    const trend = q.change === null || q.change === undefined ? "histórico em formação" : `${q.change > 0 ? "+" : ""}${q.change.toFixed(1)} ponto(s) no mês`;
    const componentLabels = {
      purchasingPower: "Poder de compra",
      foodSecurity: "Segurança alimentar",
      employment: "Emprego",
      housing: "Capacidade habitacional",
      infrastructure: "Infraestrutura",
      householdWellbeing: "Bem-estar declarado"
    };
    const componentRows = Object.entries(q.components).map(([key, value]) => `<div class="soc03-component"><span>${componentLabels[key]}</span><b>${value.toFixed(1)}</b><div class="soc03-bar"><i style="width:${clamp(value, 0, 100)}%"></i></div></div>`).join("");
    const cultureLabels = { local: "Cultura local", regional: "Origem regional", urbana: "Origem urbana", rural: "Origem rural" };
    const groups = c.groups.length ? c.groups.map((group) => `<div class="soc03-row"><span>${escapeHtml(cultureLabels[group.id] || group.id)}</span><b>${group.count} (${group.share.toFixed(1)}%)</b></div>`).join("") : `<p class="soc03-muted">Sem população registrada.</p>`;
    const integration = c.integrationIndex === null ? "Ainda não houve migração" : `${c.integrationIndex.toFixed(1)}/100`;
    const currentMigration = m.monthly;
    const qualityDelta = q.change === null || q.change === undefined ? "sem comparação" : `${q.change > 0 ? "+" : ""}${q.change.toFixed(1)}`;
    host.innerHTML = `
      <div class="soc03-top">
        <div><div class="soc03-score">${q.score.toFixed(1)}<small>/100</small></div><b>Qualidade de vida: ${escapeHtml(q.level)}</b><div class="soc03-muted">${escapeHtml(trend)} · indicador provisório</div></div>
        <div class="soc03-top-meta"><div><b>${d.population}</b><span>moradores</span></div><div><b>${d.workingAge}</b><span>idade ativa</span></div><div><b>${d.children}</b><span>crianças e adolescentes</span></div><div><b>${d.elderly}</b><span>65 anos ou mais</span></div></div>
      </div>
      <div class="soc03-grid">
        <section><h3>O que sustenta a qualidade de vida</h3>${componentRows}<div class="soc03-muted">Bem-estar médio das famílias: ${q.approval.toFixed(1)}/100${q.wellbeingGap === null ? "" : ` · diferença entre domicílios: ${q.wellbeingGap.toFixed(1)} pontos`}</div></section>
        <section><h3>Demografia e mobilidade</h3>
          <div class="soc03-row"><span>Razão de dependência</span><b>${d.dependencyRatio === null ? "n/a" : `${d.dependencyRatio.toFixed(1)} dependentes/100 ativos`}</b></div>
          <div class="soc03-row"><span>Imigrantes residentes</span><b>${d.foreignBorn} (${d.foreignBornShare.toFixed(1)}%)</b></div>
          <div class="soc03-row"><span>Entradas neste mês</span><b>${currentMigration.incoming}</b></div>
          <div class="soc03-row"><span>Saídas neste mês</span><b>${currentMigration.outgoing}</b></div>
          <div class="soc03-row"><span>Saldo migratório</span><b>${currentMigration.net > 0 ? "+" : ""}${currentMigration.net}</b></div>
          <div class="soc03-row"><span>Saldo migratório acumulado</span><b>${m.cumulative.net > 0 ? "+" : ""}${m.cumulative.net}</b></div>
          <div class="soc03-row"><span>Nascimentos / óbitos no mês</span><b>${data.demographicEvents.lastMonth?.births || 0} / ${data.demographicEvents.lastMonth?.deaths || 0}</b></div>
        </section>
        <section><h3>Cultura e integração</h3>
          <div class="soc03-row"><span>Diversidade cultural</span><b>${c.diversityIndex.toFixed(1)}/100</b></div>
          <div class="soc03-row"><span>Integração dos migrantes</span><b>${integration}</b></div>
          ${groups}
          <p class="soc03-muted">Diversidade descreve a composição cultural. Não é tratada como problema nem como bônus automático.</p>
        </section>
      </div>
      <p class="soc03-foot">IQV v0.3: poder de compra, segurança alimentar, emprego, moradia, infraestrutura e bem-estar declarado. Saúde, educação, segurança pública, saneamento, meio ambiente e cultura/lazer ainda não entram no índice porque o motor não mede esses serviços.</p>`;
  }

  return {
    VERSION, QOL_WEIGHTS, createState, initialize, ensureHousehold, prepareImmigrant,
    recordDeparture, recordMigration, advanceMonth, overview, getDemographicSnapshot,
    calculateQualityOfLife, refreshCulture, refreshQualityOfLife, renderDashboard
  };
});
