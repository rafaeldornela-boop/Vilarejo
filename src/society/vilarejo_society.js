(function attachVilarejoSociety(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.VilarejoSociety = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createVilarejoSociety() {
  "use strict";

  const VERSION = "1.0.0";
  const MONTHS_PER_YEAR = 12;
  const ADULT_AGE = 18;
  const RETIREMENT_AGE = 65;
  const HISTORY_LIMIT = 36;
  const EVENT_LIMIT = 120;
  const CULTURE_GROUPS_FOR_MIGRANTS = ["regional", "urbana", "rural"];
  const DEFAULT_BIRTH_PROBABILITY = 0.006;
  const DEFAULT_MORTALITY = Object.freeze({ child: 0.00001, adult: 0.00008, elderly: 0.002 });
  const QOL_WEIGHTS = Object.freeze({
    purchasingPower: 0.22,
    foodSecurity: 0.22,
    employment: 0.16,
    housing: 0.12,
    infrastructure: 0.12,
    householdWellbeing: 0.16
  });

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;
  const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const numberOr = (value, fallback = 0) => finite(value) ? Number(value) : fallback;
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const text = (value, fallback = "") => String(value ?? fallback);

  function createState(options = {}) {
    const seed = Math.floor(Math.abs(numberOr(options.seed, 20261102))) >>> 0;
    return {
      version: VERSION,
      rngSeed: seed || 1,
      nextPersonId: 1,
      nextEventId: 1,
      nextCultureIndex: 0,
      currentMonth: 0,
      lastAdvancedMonth: null,
      households: [],
      economyBaseline: {},
      demographic: { births: 0, deaths: 0, agingTransitions: 0, lastMonth: null },
      migration: {
        monthly: { month: 0, incoming: 0, outgoing: 0, net: 0, incomingHouseholds: 0, outgoingHouseholds: 0 },
        cumulative: { incoming: 0, outgoing: 0, net: 0, incomingHouseholds: 0, outgoingHouseholds: 0 },
        history: []
      },
      qualityOfLife: { current: null, history: [] },
      culture: { diversityIndex: 0, integrationIndex: null, groups: [], population: 0, migrantResidents: 0 },
      events: []
    };
  }

  function nextRandom(state) {
    // LCG local: a demografia fica reproduzível sem consumir o RNG da Economia.
    state.rngSeed = (Math.imul(1664525, state.rngSeed >>> 0) + 1013904223) >>> 0;
    return state.rngSeed / 4294967296;
  }

  function pushEvent(state, event) {
    const record = { ...clone(event), id: `soc-${state.nextEventId++}` };
    state.events.push(record);
    if (state.events.length > EVENT_LIMIT) state.events.splice(0, state.events.length - EVENT_LIMIT);
    return record;
  }

  function personIdExists(state, id) {
    return state.households.some((household) => Array.isArray(household.members) && household.members.some((person) => person.id === id));
  }

  function nextPersonId(state) {
    let id;
    do { id = `p${state.nextPersonId++}`; } while (personIdExists(state, id));
    return id;
  }

  function createPerson(state, values = {}) {
    ensureState(state);
    const age = clamp(values.age ?? 30, 0, 110);
    const bornHere = values.bornHere !== false;
    const explicitId = values.id !== undefined && values.id !== null;
    const id = explicitId ? text(values.id) : nextPersonId(state);
    if (explicitId && personIdExists(state, id)) throw new Error(`Identificador de pessoa duplicado: ${id}.`);
    const generatedId = /^p(\d+)$/.exec(id);
    if (generatedId) state.nextPersonId = Math.max(state.nextPersonId, Number(generatedId[1]) + 1);
    return {
      id,
      age,
      sex: values.sex === "F" ? "F" : "M",
      cultureGroup: text(values.cultureGroup, "local"),
      integration: clamp(values.integration ?? 100, 0, 100),
      bornHere,
      origin: text(values.origin, bornHere ? "vilarejo" : "externo"),
      arrivalMonth: finite(values.arrivalMonth) ? Number(values.arrivalMonth) : null,
      monthsInVillage: Math.max(0, Math.floor(numberOr(values.monthsInVillage, 0))),
      pregnancyMonthsRemaining: finite(values.pregnancyMonthsRemaining) ? Math.max(0, Number(values.pregnancyMonthsRemaining)) : null,
      voluntaryOutOfLaborForce: Boolean(values.voluntaryOutOfLaborForce),
      source: text(values.source, "sociedade")
    };
  }

  function stableHash(value) {
    let hash = 2166136261;
    for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return hash >>> 0;
  }

  function seedMembers(state, householdId, adults, children) {
    const offset = stableHash(householdId) % 37;
    const members = [];
    for (let i = 0; i < adults; i += 1) {
      members.push(createPerson(state, {
        age: 25 + ((offset + i * 7) % 35),
        sex: (i + offset) % 2 ? "M" : "F",
        source: "economia-inicial"
      }));
    }
    for (let i = 0; i < children; i += 1) {
      members.push(createPerson(state, {
        age: 4 + ((offset + i * 3) % 13),
        sex: (i + offset) % 2 ? "F" : "M",
        source: "economia-inicial"
      }));
    }
    return members;
  }

  function createHouseholdFromEconomy(state, group) {
    const id = text(group.id);
    const adults = Math.max(0, Math.floor(numberOr(group.adults)));
    const children = Math.max(0, Math.floor(numberOr(group.children)));
    const category = text(group.category || group.type, "household");
    const members = seedMembers(state, id, adults, children);
    if (group.migrant === true && adults > 0) {
      for (const person of members.filter((item) => item.age >= ADULT_AGE).slice(0, adults)) {
        person.bornHere = false;
        person.origin = "migração econômica";
        person.cultureGroup = "regional";
        person.integration = 42;
        person.arrivalMonth = state.currentMonth;
        person.monthsInVillage = 0;
        person.source = "migracao-economia";
      }
    }
    return {
      id,
      name: text(group.label || group.name, `Domicílio ${id}`),
      category,
      members,
      sourcePopulation: { adults, children, employed: Math.max(0, numberOr(group.employed)), updatedDay: numberOr(group.updatedDay, null) }
    };
  }

  function ensureState(state) {
    if (!state || state.version !== VERSION || !Array.isArray(state.households)) {
      throw new TypeError(`Estado da Sociedade inválido. Esperado schema ${VERSION}.`);
    }
    return state;
  }

  function validatePopulationGroups(populationGroups) {
    if (!Array.isArray(populationGroups)) return;
    const ids = new Set();
    for (const group of populationGroups) {
      if (group?.id === undefined || group?.id === null) continue;
      const id = text(group.id);
      if (!id) throw new TypeError("Identificador de domicílio não pode ser vazio.");
      if (ids.has(id)) throw new Error(`Identificador de domicílio duplicado: ${id}.`);
      ids.add(id);
    }
  }

  function seedFromEconomy(state, populationGroups = []) {
    ensureState(state);
    const groups = Array.isArray(populationGroups) ? populationGroups : [];
    validatePopulationGroups(groups);
    state.households = [];
    state.economyBaseline = {};
    for (const group of groups) {
      if (group?.id === undefined || group?.id === null) continue;
      const household = createHouseholdFromEconomy(state, group);
      state.households.push(household);
      state.economyBaseline[household.id] = clone(household.sourcePopulation);
    }
    refreshCulture(state);
    return getSnapshot(state);
  }

  function countByAge(household, predicate) {
    return household.members.filter(predicate).length;
  }

  function addMembersForDelta(state, household, type, count) {
    const add = Math.max(0, Math.floor(count));
    for (let i = 0; i < add; i += 1) {
      const idOffset = household.members.length + i;
      const age = type === "adult"
        ? 24 + ((stableHash(household.id) + idOffset * 11) % 36)
        : 3 + ((stableHash(household.id) + idOffset * 5) % 14);
      household.members.push(createPerson(state, {
        age,
        sex: idOffset % 2 ? "F" : "M",
        source: "ajuste-economia"
      }));
    }
  }

  function removeMembersForDelta(household, type, count) {
    let remaining = Math.max(0, Math.floor(count));
    const predicate = type === "adult" ? (person) => person.age >= ADULT_AGE : (person) => person.age < ADULT_AGE;
    // Ajustes externos removem primeiro os registros mais recentes daquela faixa.
    for (let i = household.members.length - 1; i >= 0 && remaining > 0; i -= 1) {
      if (predicate(household.members[i])) {
        household.members.splice(i, 1);
        remaining -= 1;
      }
    }
  }

  function reconcileFromEconomy(state, populationGroups = [], options = {}) {
    ensureState(state);
    const groups = Array.isArray(populationGroups) ? populationGroups : [];
    validatePopulationGroups(groups);
    const currentIds = new Set();
    const adjustments = [];
    const month = finite(options.month) ? Number(options.month) : state.currentMonth;

    for (const group of groups) {
      if (group?.id === undefined || group?.id === null) continue;
      const id = text(group.id);
      currentIds.add(id);
      let household = state.households.find((item) => item.id === id);
      if (!household) {
        household = createHouseholdFromEconomy(state, group);
        state.households.push(household);
        state.economyBaseline[id] = clone(household.sourcePopulation);
        adjustments.push({ householdId: id, type: "household_added", people: household.members.length });
        recordMigration(state, "in", household.members.length, {
          month, householdId: id, householdName: household.name, household: true,
          reason: "novo domicílio registrado pela Economia"
        });
        pushEvent(state, { type: "household_added", month, householdId: id, people: household.members.length, message: `${household.name} entrou no cadastro demográfico.` });
        continue;
      }

      household.name = text(group.label || group.name, household.name);
      household.category = text(group.category || group.type, household.category);
      const previous = state.economyBaseline[id] || household.sourcePopulation || { adults: 0, children: 0, employed: 0 };
      const nextAdults = Math.max(0, Math.floor(numberOr(group.adults)));
      const nextChildren = Math.max(0, Math.floor(numberOr(group.children)));
      const adultsDelta = nextAdults - Math.floor(numberOr(previous.adults));
      const childrenDelta = nextChildren - Math.floor(numberOr(previous.children));

      if (adultsDelta > 0) addMembersForDelta(state, household, "adult", adultsDelta);
      else if (adultsDelta < 0) removeMembersForDelta(household, "adult", -adultsDelta);
      if (childrenDelta > 0) addMembersForDelta(state, household, "child", childrenDelta);
      else if (childrenDelta < 0) removeMembersForDelta(household, "child", -childrenDelta);

      household.sourcePopulation = {
        adults: nextAdults,
        children: nextChildren,
        employed: Math.max(0, numberOr(group.employed)),
        updatedDay: numberOr(group.updatedDay, null)
      };
      state.economyBaseline[id] = clone(household.sourcePopulation);
      if (adultsDelta || childrenDelta) {
        adjustments.push({ householdId: id, adultsDelta, childrenDelta });
        pushEvent(state, {
          type: "economy_population_adjustment", month, householdId: id,
          adultsDelta, childrenDelta,
          message: `A composição de ${household.name} foi sincronizada com a Economia.`
        });
      }
    }

    state.households = state.households.filter((household) => {
      if (currentIds.has(household.id)) return true;
      const people = household.members.length;
      if (people > 0) {
        recordMigration(state, "out", people, { month, householdId: household.id, householdName: household.name, household: true, reason: "domicílio removido do cadastro econômico" });
      }
      delete state.economyBaseline[household.id];
      adjustments.push({ householdId: household.id, type: "household_removed", people });
      return false;
    });

    refreshCulture(state);
    return { adjustments, snapshot: getSnapshot(state) };
  }

  function ensureMonthlyMigration(state, month) {
    if (state.migration.monthly.month !== month) {
      state.migration.monthly = { month, incoming: 0, outgoing: 0, net: 0, incomingHouseholds: 0, outgoingHouseholds: 0 };
    }
    return state.migration.monthly;
  }

  function recordMigration(state, direction, people, options = {}) {
    ensureState(state);
    if (direction !== "in" && direction !== "out") throw new TypeError("Direção migratória deve ser 'in' ou 'out'.");
    const count = Math.max(0, Math.floor(numberOr(people)));
    const month = finite(options.month) ? Number(options.month) : state.currentMonth;
    const bucket = ensureMonthlyMigration(state, month);
    const incoming = direction === "in";
    const householdCount = options.household ? 1 : Math.max(0, Math.floor(numberOr(options.households, 0)));
    if (incoming) {
      bucket.incoming += count;
      bucket.incomingHouseholds += householdCount;
      state.migration.cumulative.incoming += count;
      state.migration.cumulative.incomingHouseholds += householdCount;
    } else {
      bucket.outgoing += count;
      bucket.outgoingHouseholds += householdCount;
      state.migration.cumulative.outgoing += count;
      state.migration.cumulative.outgoingHouseholds += householdCount;
    }
    bucket.net = bucket.incoming - bucket.outgoing;
    state.migration.cumulative.net = state.migration.cumulative.incoming - state.migration.cumulative.outgoing;
    const name = text(options.householdName, options.householdId ? `Domicílio ${options.householdId}` : "domicílio");
    return pushEvent(state, {
      type: incoming ? "migration_in" : "migration_out", month, people: count,
      householdId: options.householdId ?? null,
      reason: text(options.reason, "mobilidade populacional"),
      message: incoming ? `${count} morador(es) chegaram ao vilarejo (${text(options.reason, "mobilidade populacional")}).` : `${count} morador(es) deixaram o vilarejo (${text(options.reason, "mobilidade populacional")}).`,
      householdName: name
    });
  }

  function addImmigrant(state, householdId, options = {}) {
    ensureState(state);
    const household = state.households.find((item) => item.id === text(householdId));
    if (!household) return { ok: false, reason: "Domicílio não encontrado." };
    const cultureGroup = text(options.cultureGroup, CULTURE_GROUPS_FOR_MIGRANTS[state.nextCultureIndex % CULTURE_GROUPS_FOR_MIGRANTS.length]);
    const origins = { regional: "município da região", urbana: "centro urbano", rural: "zona rural" };
    state.nextCultureIndex += 1;
    const month = finite(options.month) ? Number(options.month) : state.currentMonth;
    const person = createPerson(state, {
      age: options.age ?? 28,
      sex: options.sex,
      cultureGroup,
      integration: 42,
      bornHere: false,
      origin: options.origin || origins[cultureGroup] || "outra localidade",
      arrivalMonth: month,
      monthsInVillage: 0,
      source: "migracao"
    });
    household.members.push(person);
    recordMigration(state, "in", 1, { month, householdId: household.id, householdName: household.name, household: true, reason: options.reason || "atratividade econômica local" });
    refreshCulture(state);
    return { ok: true, person: clone(person), householdId: household.id };
  }

  function removePerson(state, householdId, personId, options = {}) {
    ensureState(state);
    const household = state.households.find((item) => item.id === text(householdId));
    if (!household) return { ok: false, reason: "Domicílio não encontrado." };
    const index = household.members.findIndex((person) => person.id === text(personId));
    if (index < 0) return { ok: false, reason: "Morador não encontrado." };
    const [person] = household.members.splice(index, 1);
    if (options.recordMigration) {
      recordMigration(state, "out", 1, { month: options.month, householdId: household.id, householdName: household.name, reason: options.reason || "saída individual" });
    }
    refreshCulture(state);
    return { ok: true, person: clone(person) };
  }

  function refreshCulture(state) {
    ensureState(state);
    const people = state.households.flatMap((household) => household.members);
    const groups = new Map();
    for (const person of people) {
      const key = text(person.cultureGroup, "local");
      groups.set(key, (groups.get(key) || 0) + 1);
    }
    const total = people.length;
    const proportions = [...groups.values()].map((count) => count / Math.max(1, total));
    const rawDiversity = 1 - proportions.reduce((sum, share) => sum + share * share, 0);
    const maximum = groups.size > 1 ? 1 - 1 / groups.size : 0;
    const migrants = people.filter((person) => person.bornHere === false);
    state.culture = {
      diversityIndex: maximum > 0 ? round1((rawDiversity / maximum) * 100) : 0,
      integrationIndex: migrants.length ? round1(migrants.reduce((sum, person) => sum + clamp(person.integration, 0, 100), 0) / migrants.length) : null,
      groups: [...groups.entries()].map(([id, count]) => ({ id, count, share: round1(count / Math.max(1, total) * 100) })).sort((a, b) => b.count - a.count),
      population: total,
      migrantResidents: migrants.length
    };
    return clone(state.culture);
  }

  function getDemographicSnapshot(state) {
    ensureState(state);
    const households = state.households;
    const people = households.flatMap((household) => household.members);
    const children = people.filter((person) => person.age < ADULT_AGE).length;
    const workingAge = people.filter((person) => person.age >= ADULT_AGE && person.age < RETIREMENT_AGE).length;
    const elderly = people.filter((person) => person.age >= RETIREMENT_AGE).length;
    const dependents = children + elderly;
    const population = people.length;
    return {
      population,
      children,
      workingAge,
      elderly,
      dependents,
      dependencyRatio: workingAge > 0 ? round1(dependents / workingAge * 100) : null,
      households: households.length,
      foreignBorn: people.filter((person) => person.bornHere === false).length,
      foreignBornShare: population ? round1(people.filter((person) => person.bornHere === false).length / population * 100) : 0
    };
  }

  function calculateQualityOfLife(metrics = {}) {
    const components = {};
    let weightedTotal = 0;
    let availableWeight = 0;
    const measured = [];
    const unmeasured = [];
    for (const [key, weight] of Object.entries(QOL_WEIGHTS)) {
      const value = metrics[key];
      if (finite(value) && Number(value) >= 0 && Number(value) <= 100) {
        components[key] = round1(Number(value));
        weightedTotal += components[key] * weight;
        availableWeight += weight;
        measured.push(key);
      } else {
        components[key] = null;
        unmeasured.push(key);
      }
    }
    const score = availableWeight > 0 ? round1(weightedTotal / availableWeight) : null;
    const level = score === null ? "Sem dados" : score >= 80 ? "Alta" : score >= 65 ? "Favorável" : score >= 50 ? "Intermediária" : score >= 35 ? "Baixa" : "Crítica";
    return {
      score,
      level,
      provisional: measured.length < Object.keys(QOL_WEIGHTS).length,
      coverage: round1(measured.length / Object.keys(QOL_WEIGHTS).length * 100),
      measuredDimensions: measured.length,
      unmeasuredDimensions: unmeasured,
      components,
      weights: clone(QOL_WEIGHTS),
      approval: finite(metrics.approval) ? round1(clamp(metrics.approval, 0, 100)) : null,
      lowestHouseholdWellbeing: finite(metrics.lowestHouseholdWellbeing) ? round1(clamp(metrics.lowestHouseholdWellbeing, 0, 100)) : null,
      highestHouseholdWellbeing: finite(metrics.highestHouseholdWellbeing) ? round1(clamp(metrics.highestHouseholdWellbeing, 0, 100)) : null
    };
  }

  function refreshQualityOfLife(state, metrics = {}, month = state.currentMonth) {
    ensureState(state);
    const current = calculateQualityOfLife(metrics);
    const previous = state.qualityOfLife.current;
    current.month = finite(month) ? Number(month) : state.currentMonth;
    current.change = previous && previous.score !== null && current.score !== null ? round1(current.score - previous.score) : null;
    current.trend = current.change === null ? "sem histórico" : current.change > 0.5 ? "melhorando" : current.change < -0.5 ? "piorando" : "estável";
    state.qualityOfLife.current = current;
    const last = state.qualityOfLife.history[state.qualityOfLife.history.length - 1];
    if (!last || last.month !== current.month) {
      state.qualityOfLife.history.push({ month: current.month, score: current.score, level: current.level, coverage: current.coverage });
      if (state.qualityOfLife.history.length > HISTORY_LIMIT) state.qualityOfLife.history.shift();
    }
    return clone(current);
  }

  function deriveRuntimeMetrics(state, populationGroups = []) {
    const demographic = getDemographicSnapshot(state);
    const total = populationGroups.reduce((sum, group) => sum + Math.max(0, numberOr(group.population, numberOr(group.adults) + numberOr(group.children))), 0);
    const wellbeing = total > 0
      ? round1(populationGroups.reduce((sum, group) => sum + clamp(group.happiness, 0, 100) * Math.max(0, numberOr(group.population, numberOr(group.adults) + numberOr(group.children))), 0) / total)
      : null;
    const employed = populationGroups.reduce((sum, group) => sum + Math.max(0, numberOr(group.employed)), 0);
    const employment = demographic.workingAge > 0 ? round1(clamp(employed / demographic.workingAge * 100, 0, 100)) : null;
    return { householdWellbeing: wellbeing, employment };
  }

  function advanceMonth(state, options = {}) {
    ensureState(state);
    const month = finite(options.month) ? Number(options.month) : state.currentMonth + 1;
    ensureMonthlyMigration(state, month);
    if (state.lastAdvancedMonth === month) {
      return { unchanged: true, events: [], snapshot: getSnapshot(state) };
    }
    if (month < state.currentMonth) throw new RangeError("A Sociedade não pode retroceder no calendário.");

    const random = typeof options.random === "function" ? options.random : () => nextRandom(state);
    const birthProbability = clamp(options.birthProbability ?? DEFAULT_BIRTH_PROBABILITY, 0, 1);
    const mortality = { ...DEFAULT_MORTALITY, ...(options.mortalityRates || {}) };
    const shortageRatio = clamp(options.shortageRatio ?? 0, 0, 1);
    const events = [];
    let births = 0;
    let deaths = 0;
    let agingTransitions = 0;

    for (const household of state.households) {
      const survivors = [];
      let birthsThisMonth = 0;
      for (const person of household.members) {
        const newlyArrived = person.arrivalMonth === month && person.monthsInVillage === 0;
        const previousAge = person.age;
        if (!newlyArrived) {
          person.age = Math.min(110, person.age + 1 / MONTHS_PER_YEAR);
          person.monthsInVillage += 1;
        }
        if ((previousAge < ADULT_AGE && person.age >= ADULT_AGE) || (previousAge < RETIREMENT_AGE && person.age >= RETIREMENT_AGE)) agingTransitions += 1;

        const group = person.age < ADULT_AGE ? "child" : person.age < RETIREMENT_AGE ? "adult" : "elderly";
        if (random() < clamp(mortality[group], 0, 1)) {
          deaths += 1;
          events.push({ type: "death", month, householdId: household.id, message: `Um morador de ${household.name} faleceu.` });
          continue;
        }

        if (person.pregnancyMonthsRemaining !== null) {
          person.pregnancyMonthsRemaining -= 1;
          if (person.pregnancyMonthsRemaining <= 0) {
            const cultureCounts = new Map();
            for (const member of household.members) {
              const key = text(member.cultureGroup, "local");
              cultureCounts.set(key, (cultureCounts.get(key) || 0) + 1);
            }
            const dominantCulture = [...cultureCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "local";
            survivors.push(createPerson(state, {
              age: 0,
              sex: random() < 0.5 ? "F" : "M",
              cultureGroup: dominantCulture,
              integration: 100,
              bornHere: true,
              origin: "nascido_no_vilarejo",
              source: "nascimento"
            }));
            births += 1;
            birthsThisMonth += 1;
            events.push({ type: "birth", month, householdId: household.id, message: `Nasceu um novo morador em ${household.name}.` });
            person.pregnancyMonthsRemaining = null;
          }
        } else if (person.sex === "F" && person.age >= 20 && person.age <= 39) {
          const pending = household.members.filter((member) => member.pregnancyMonthsRemaining !== null).length;
          const childrenNow = household.members.filter((member) => member.age < ADULT_AGE).length;
          if (childrenNow + birthsThisMonth + pending < 3 && random() < birthProbability) {
            person.pregnancyMonthsRemaining = 9;
          }
        }

        if (!newlyArrived && person.bornHere === false && person.cultureGroup !== "local") {
          const householdStress = clamp((numberOr(options.householdHappiness, 55) - 25) / 75, 0, 1);
          person.integration = clamp(person.integration + 0.85 * householdStress * (1 - shortageRatio), 0, 100);
        }
        survivors.push(person);
      }
      household.members = survivors;
    }

    state.demographic.births += births;
    state.demographic.deaths += deaths;
    state.demographic.agingTransitions += agingTransitions;
    state.demographic.lastMonth = { month, births, deaths, agingTransitions };
    state.currentMonth = month;
    state.lastAdvancedMonth = month;
    for (const event of events) pushEvent(state, event);
    refreshCulture(state);
    const bucket = state.migration.monthly;
    const lastMigration = state.migration.history[state.migration.history.length - 1];
    if (!lastMigration || lastMigration.month !== month) {
      state.migration.history.push(clone(bucket));
      if (state.migration.history.length > HISTORY_LIMIT) state.migration.history.shift();
    }
    return { unchanged: false, events: clone(events), snapshot: getSnapshot(state) };
  }

  function getEconomyProjection(state) {
    ensureState(state);
    return state.households.map((household) => {
      const adults = countByAge(household, (person) => person.age >= ADULT_AGE);
      const children = household.members.length - adults;
      const workingAge = countByAge(household, (person) => person.age >= ADULT_AGE && person.age < RETIREMENT_AGE);
      const elderly = countByAge(household, (person) => person.age >= RETIREMENT_AGE);
      const voluntaryOut = countByAge(household, (person) => person.age >= ADULT_AGE && person.age < RETIREMENT_AGE && person.voluntaryOutOfLaborForce);
      return {
        id: household.id,
        adults,
        children,
        workingAge,
        elderly,
        availableForWork: Math.max(0, workingAge - voluntaryOut)
      };
    });
  }

  function getSnapshot(state) {
    ensureState(state);
    return {
      version: VERSION,
      currentMonth: state.currentMonth,
      demographic: getDemographicSnapshot(state),
      demographicEvents: clone(state.demographic),
      migration: clone(state.migration),
      culture: clone(state.culture),
      qualityOfLife: clone(state.qualityOfLife),
      economyProjection: getEconomyProjection(state),
      recentEvents: clone(state.events.slice(-12))
    };
  }

  function overview(state) {
    return getSnapshot(state);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function renderDashboard(state, host) {
    if (!host || !state) return false;
    const data = getSnapshot(state);
    const d = data.demographic;
    const q = data.qualityOfLife.current;
    const migration = data.migration.monthly;
    const cultureNames = { local: "Cultura local", regional: "Origem regional", urbana: "Origem urbana", rural: "Origem rural" };
    const groups = data.culture.groups.length
      ? data.culture.groups.map((group) => `<div class="society-row"><span>${escapeHtml(cultureNames[group.id] || group.id)}</span><b>${group.count} (${group.share.toFixed(1)}%)</b></div>`).join("")
      : `<p class="society-muted">Sem população registrada.</p>`;
    const score = q && q.score !== null ? q.score.toFixed(1) : "n/d";
    const coverage = q ? `${q.measuredDimensions}/6 dimensões` : "sem dados";
    const integration = data.culture.integrationIndex === null ? "Sem migração registrada" : `${data.culture.integrationIndex.toFixed(1)}/100`;
    host.innerHTML = `
      <section class="society-dashboard">
        <header class="society-summary">
          <div><strong>${score}<small>/100</small></strong><span>Qualidade de vida ${q?.provisional ? "provisória" : ""}</span><small>${coverage}</small></div>
          <div class="society-kpis">
            <div><b>${d.population}</b><span>moradores</span></div>
            <div><b>${d.workingAge}</b><span>idade ativa</span></div>
            <div><b>${d.children}</b><span>crianças</span></div>
            <div><b>${d.elderly}</b><span>65 anos ou mais</span></div>
          </div>
        </header>
        <div class="society-grid">
          <section><h3>Demografia</h3>
            <div class="society-row"><span>Razão de dependência</span><b>${d.dependencyRatio === null ? "n/d" : `${d.dependencyRatio.toFixed(1)} / 100 ativos`}</b></div>
            <div class="society-row"><span>Nascimentos / óbitos no mês</span><b>${data.demographicEvents.lastMonth?.births || 0} / ${data.demographicEvents.lastMonth?.deaths || 0}</b></div>
            <div class="society-row"><span>Imigrantes residentes</span><b>${d.foreignBorn} (${d.foreignBornShare.toFixed(1)}%)</b></div>
          </section>
          <section><h3>Mobilidade</h3>
            <div class="society-row"><span>Entradas no mês</span><b>${migration.incoming}</b></div>
            <div class="society-row"><span>Saídas no mês</span><b>${migration.outgoing}</b></div>
            <div class="society-row"><span>Saldo acumulado</span><b>${data.migration.cumulative.net > 0 ? "+" : ""}${data.migration.cumulative.net}</b></div>
          </section>
          <section><h3>Cultura e integração</h3>
            <div class="society-row"><span>Diversidade cultural</span><b>${data.culture.diversityIndex.toFixed(1)}/100</b></div>
            <div class="society-row"><span>Integração de migrantes</span><b>${integration}</b></div>
            ${groups}
          </section>
        </div>
        <p class="society-muted">A qualidade de vida utiliza apenas dimensões com dados disponíveis. Dimensões ausentes não são tratadas como zero.</p>
      </section>`;
    return true;
  }

  function resetState(state, options = {}) {
    const next = createState(options);
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, next);
    return state;
  }

  function registerWithRuntime(runtime, options = {}) {
    if (!runtime || !runtime.modules || !runtime.population || !runtime.events || typeof runtime.publish !== "function") {
      throw new TypeError("Runtime do Vilarejo incompleto para registrar Sociedade.");
    }
    if (!runtime.modules.has("core") || !runtime.modules.has("economia")) {
      throw new Error("Sociedade exige os módulos Core e Economia registrados.");
    }
    if (runtime.modules.has("sociedade")) {
      return { alreadyRegistered: true, state: null, dispose() {} };
    }

    runtime.modules.register({
      id: "sociedade",
      version: VERSION,
      name: "Sociedade",
      dependencies: ["core", "economia"],
      description: "Demografia, mobilidade, cultura e qualidade de vida. Não altera contas nem empregos da Economia."
    });

    const state = createState({ seed: options.seed });
    seedFromEconomy(state, runtime.population.getSnapshot().groups);
    let waitingForResetSync = false;
    const initialGroups = runtime.population.getSnapshot().groups;
    refreshQualityOfLife(state, deriveRuntimeMetrics(state, initialGroups), state.currentMonth);

    function publishSnapshot(source = "sociedade") {
      const snapshot = getSnapshot(state);
      runtime.modules.updateSnapshot("sociedade", snapshot, source);
      return snapshot;
    }

    const unsubscribeReset = runtime.events.on("game:reset", () => {
      resetState(state, { seed: options.seed });
      waitingForResetSync = true;
    });

    const unsubscribeWorld = runtime.events.on("world:synchronized", () => {
      if (!waitingForResetSync) return;
      const groups = runtime.population.getSnapshot().groups;
      seedFromEconomy(state, groups);
      refreshQualityOfLife(state, deriveRuntimeMetrics(state, groups), state.currentMonth);
      waitingForResetSync = false;
      publishSnapshot("sociedade.reset-adapter");
    });

    const unsubscribeMonth = runtime.events.on("economy:month-closed", (event) => {
      const month = numberOr(event?.payload?.monthNumber, runtime.clock?.snapshot?.().economicMonthNumber || state.currentMonth + 1);
      if (state.lastAdvancedMonth === month) return;
      if (state.lastAdvancedMonth !== null && month < state.lastAdvancedMonth) {
        throw new RangeError("A Sociedade não pode retroceder no calendário.");
      }
      const groups = runtime.population.getSnapshot().groups;
      reconcileFromEconomy(state, groups, { month });
      advanceMonth(state, {
        month,
        shortageRatio: numberOr(options.shortageRatio, 0),
        householdHappiness: numberOr(options.householdHappiness, 55)
      });
      refreshQualityOfLife(state, deriveRuntimeMetrics(state, groups), month);
      const snapshot = publishSnapshot("sociedade.month-closed");
      runtime.publish("society:month-closed", snapshot, "sociedade");
    });

    publishSnapshot("sociedade.initial-adapter");
    return {
      alreadyRegistered: false,
      state,
      getSnapshot: () => getSnapshot(state),
      dispose() {
        unsubscribeReset();
        unsubscribeWorld();
        unsubscribeMonth();
      }
    };
  }

  if (typeof window !== "undefined" && window.VilarejoRuntime) {
    try {
      window.VilarejoSocietyRuntime = registerWithRuntime(window.VilarejoRuntime);
    } catch (error) {
      console.error("Falha ao registrar o módulo Sociedade:", error);
    }
  }

  return {
    VERSION,
    QOL_WEIGHTS: clone(QOL_WEIGHTS),
    createState,
    createPerson,
    seedFromEconomy,
    reconcileFromEconomy,
    recordMigration,
    addImmigrant,
    removePerson,
    refreshCulture,
    getDemographicSnapshot,
    calculateQualityOfLife,
    refreshQualityOfLife,
    advanceMonth,
    getEconomyProjection,
    getSnapshot,
    overview,
    renderDashboard,
    registerWithRuntime
  };
});
