(function attachVilarejoPolitics(root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.VilarejoPolitics = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createVilarejoPolitics(root) {
  "use strict";

  const VERSION = "1.0.0";
  const HISTORY_LIMIT = 36;
  const EVENT_LIMIT = 120;
  const CHANNELS = new Set([
    "economicPower",
    "organization",
    "cohesion",
    "mobilizationCapacity",
    "satisfaction"
  ]);

  // Parâmetros de cenário para iniciar a simulação. Não são dados empíricos.
  // A calibração poderá ser alterada por cenário sem mudar a lógica do módulo.
  const GROUP_DEFINITIONS = Object.freeze([
    {
      id: "workers", name: "Trabalhadores", description: "Pessoas que dependem principalmente do trabalho para obter renda.",
      economicPower: 32, organization: 48, cohesion: 62, mobilizationCapacity: 60,
      interests: ["emprego", "salários", "segurança do trabalho", "custo de vida"]
    },
    {
      id: "business", name: "Empresariado", description: "Proprietários e controladores de empresas privadas.",
      economicPower: 82, organization: 62, cohesion: 66, mobilizationCapacity: 50,
      interests: ["tributação", "crédito", "infraestrutura", "segurança jurídica"]
    },
    {
      id: "rural_producers", name: "Produtores rurais", description: "Agentes econômicos ligados à produção agropecuária.",
      economicPower: 56, organization: 48, cohesion: 58, mobilizationCapacity: 54,
      interests: ["preços agrícolas", "crédito produtivo", "logística", "recursos naturais"]
    },
    {
      id: "merchants", name: "Comerciantes", description: "Empresas e trabalhadores do comércio e da distribuição.",
      economicPower: 58, organization: 58, cohesion: 61, mobilizationCapacity: 54,
      interests: ["consumo", "segurança", "tributação", "infraestrutura"]
    },
    {
      id: "finance", name: "Setor financeiro", description: "Instituições e agentes que intermediam crédito, poupança e pagamentos.",
      economicPower: 90, organization: 72, cohesion: 76, mobilizationCapacity: 44,
      interests: ["estabilidade monetária", "crédito", "solidez fiscal", "regulação"]
    },
    {
      id: "public_servants", name: "Servidores públicos", description: "Pessoas empregadas diretamente pela administração estatal.",
      economicPower: 38, organization: 58, cohesion: 66, mobilizationCapacity: 52,
      interests: ["remuneração", "carreira", "serviços públicos", "condições de trabalho"]
    },
    {
      id: "landowners", name: "Proprietários de terras", description: "Agentes que detêm propriedades fundiárias e ativos imobiliários.",
      economicPower: 72, organization: 54, cohesion: 70, mobilizationCapacity: 40,
      interests: ["propriedade", "uso do solo", "tributação patrimonial", "infraestrutura"]
    },
    {
      id: "vulnerable", name: "População vulnerável", description: "Pessoas expostas a maior risco de pobreza e privação material.",
      economicPower: 8, organization: 22, cohesion: 42, mobilizationCapacity: 67,
      interests: ["renda", "moradia", "alimentação", "serviços essenciais"]
    },
    {
      id: "middle_class", name: "Classe média", description: "Famílias com posição intermediária na distribuição de renda e patrimônio.",
      economicPower: 55, organization: 40, cohesion: 50, mobilizationCapacity: 43,
      interests: ["poder de compra", "educação", "saúde", "tributação"]
    },
    {
      id: "environmentalists", name: "Ambientalistas", description: "Organizações e cidadãos mobilizados por objetivos ambientais.",
      economicPower: 20, organization: 48, cohesion: 67, mobilizationCapacity: 62,
      interests: ["conservação", "poluição", "uso da terra", "transição energética"]
    }
  ]);

  const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
  const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const numberOr = (value, fallback = 0) => finite(value) ? Number(value) : fallback;
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const text = (value, fallback = "") => String(value ?? fallback);
  const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;

  function createGroup(definition, custom = {}) {
    const source = { ...definition, ...custom };
    return {
      id: text(source.id).trim(),
      name: text(source.name, source.id),
      description: text(source.description),
      representedPopulation: null,
      representativity: null,
      measurement: { status: "unavailable", basis: "Aguardando dados sociais ou econômicos específicos." },
      economicPower: clamp(source.economicPower),
      organization: clamp(source.organization),
      cohesion: clamp(source.cohesion),
      mobilizationCapacity: clamp(source.mobilizationCapacity),
      satisfaction: clamp(source.satisfaction ?? 55),
      institutionalAccess: clamp(source.institutionalAccess ?? 35),
      influence: 0,
      governmentRelation: "neutral",
      interests: Array.isArray(source.interests) ? source.interests.map(String) : [],
      history: []
    };
  }

  function calculateInfluence(group) {
    const components = [
      ["economicPower", 0.25],
      ["organization", 0.25],
      ["cohesion", 0.15],
      ["mobilizationCapacity", 0.15],
      ["institutionalAccess", 0.10]
    ];
    if (finite(group.representativity)) components.push(["representativity", 0.10]);
    const weight = components.reduce((sum, [, factor]) => sum + factor, 0);
    const score = components.reduce((sum, [key, factor]) => sum + clamp(group[key]) * factor, 0) / weight;
    return round1(clamp(score));
  }

  function relationFromSatisfaction(value) {
    if (value >= 65) return "support";
    if (value <= 35) return "opposition";
    return "neutral";
  }

  function refreshGroup(group) {
    group.influence = calculateInfluence(group);
    group.governmentRelation = relationFromSatisfaction(group.satisfaction);
    return group;
  }

  function createState(options = {}) {
    const seed = Math.floor(Math.abs(numberOr(options.seed, 20261102))) >>> 0;
    const groups = GROUP_DEFINITIONS.map((definition) => refreshGroup(createGroup(definition)));
    return {
      version: VERSION,
      rngSeed: seed || 1,
      currentMonth: 0,
      lastProcessedMonth: null,
      population: { total: 0, workingAge: null, dataStatus: "unavailable" },
      groups,
      history: [],
      events: [],
      nextEventId: 1,
      compositionSource: "not_initialized"
    };
  }

  function ensureState(state) {
    if (!state || state.version !== VERSION || !Array.isArray(state.groups)) {
      throw new TypeError(`Estado político inválido. Esperado schema ${VERSION}.`);
    }
    return state;
  }

  function findGroup(state, groupId) {
    return state.groups.find((group) => group.id === String(groupId));
  }

  function pushEvent(state, event) {
    const record = { ...clone(event), id: `pol-${state.nextEventId++}` };
    state.events.push(record);
    if (state.events.length > EVENT_LIMIT) state.events.splice(0, state.events.length - EVENT_LIMIT);
    return record;
  }

  function addGroup(state, definition) {
    ensureState(state);
    if (!definition || !String(definition.id || "").trim()) throw new TypeError("O identificador do grupo é obrigatório.");
    if (findGroup(state, definition.id)) throw new Error(`O grupo '${definition.id}' já existe.`);
    const group = refreshGroup(createGroup({ id: definition.id, name: definition.name || definition.id }, definition));
    state.groups.push(group);
    pushEvent(state, { type: "group_created", month: state.currentMonth, groupId: group.id, message: `O grupo ${group.name} foi criado.` });
    return clone(group);
  }

  function removeGroup(state, groupId) {
    ensureState(state);
    const index = state.groups.findIndex((group) => group.id === String(groupId));
    if (index < 0) return false;
    const [removed] = state.groups.splice(index, 1);
    pushEvent(state, { type: "group_removed", month: state.currentMonth, groupId: removed.id, message: `O grupo ${removed.name} deixou de existir.` });
    return true;
  }

  function updateGroup(state, groupId, changes = {}) {
    ensureState(state);
    const group = findGroup(state, groupId);
    if (!group) throw new Error(`Grupo político não encontrado: ${groupId}`);
    const scalarFields = ["economicPower", "organization", "cohesion", "mobilizationCapacity", "satisfaction", "institutionalAccess"];
    for (const key of scalarFields) {
      if (finite(changes[key])) group[key] = clamp(changes[key]);
    }
    if (Array.isArray(changes.interests)) group.interests = changes.interests.map(String);
    if (changes.name !== undefined) group.name = text(changes.name, group.name);
    if (changes.description !== undefined) group.description = text(changes.description, group.description);
    refreshGroup(group);
    pushEvent(state, { type: "group_updated", month: state.currentMonth, groupId: group.id, message: `Os indicadores de ${group.name} foram atualizados.` });
    return clone(group);
  }

  function mergeGroups(state, groupIds, definition = {}) {
    ensureState(state);
    const ids = [...new Set((Array.isArray(groupIds) ? groupIds : []).map(String))];
    if (ids.length < 2) throw new TypeError("A fusão exige pelo menos dois grupos distintos.");
    if (!definition.id || findGroup(state, definition.id)) throw new Error("A fusão exige um novo identificador de grupo.");
    const sources = ids.map((id) => findGroup(state, id));
    if (sources.some((group) => !group)) throw new Error("Todos os grupos da fusão precisam existir.");
    const average = (key) => round1(sources.reduce((sum, group) => sum + group[key], 0) / sources.length);
    const interests = [...new Set(sources.flatMap((group) => group.interests))];
    const mergedCount = finite(definition.representedPopulation)
      ? Math.max(0, Math.floor(Number(definition.representedPopulation)))
      : null;
    if (mergedCount !== null && mergedCount > state.population.total) {
      throw new RangeError(`O grupo '${definition.id}' excede a população total.`);
    }
    const merged = refreshGroup(createGroup({
      id: definition.id,
      name: definition.name || sources.map((group) => group.name).join(" + "),
      description: definition.description || `Grupo formado pela fusão de ${sources.map((group) => group.name).join(", ")}.`,
      economicPower: average("economicPower"),
      organization: average("organization"),
      cohesion: average("cohesion"),
      mobilizationCapacity: average("mobilizationCapacity"),
      satisfaction: average("satisfaction"),
      institutionalAccess: average("institutionalAccess"),
      interests,
      ...definition
    }));
    state.groups = state.groups.filter((group) => !ids.includes(group.id));
    state.groups.push(merged);
    if (mergedCount !== null) {
      const count = mergedCount;
      merged.representedPopulation = count;
      merged.representativity = state.population.total > 0 ? round1((count / state.population.total) * 100) : 0;
      merged.measurement = {
        status: definition.evidenceLevel === "measured" ? "measured" : "estimated",
        basis: text(definition.basis, "Base informada explicitamente durante a fusão.")
      };
      refreshGroup(merged);
    }
    pushEvent(state, { type: "groups_merged", month: state.currentMonth, sourceGroupIds: ids, groupId: merged.id, message: `${sources.length} grupos foram fundidos em ${merged.name}.` });
    return clone(findGroup(state, merged.id));
  }

  function splitGroup(state, sourceGroupId, definitions = []) {
    ensureState(state);
    const source = findGroup(state, sourceGroupId);
    if (!source) throw new Error(`Grupo político não encontrado: ${sourceGroupId}`);
    if (!Array.isArray(definitions) || definitions.length < 2) throw new TypeError("A divisão exige pelo menos dois novos grupos.");
    const ids = definitions.map((item) => String(item?.id || "").trim());
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length || ids.some((id) => findGroup(state, id))) {
      throw new Error("Cada grupo resultante precisa de um identificador novo e exclusivo.");
    }
    const created = definitions.map((definition) => {
      const group = refreshGroup(createGroup({
        id: definition.id,
        name: definition.name || `${source.name} (${definition.id})`,
        description: definition.description || `Segmento originado da divisão de ${source.name}.`,
        economicPower: source.economicPower,
        organization: source.organization,
        cohesion: source.cohesion,
        mobilizationCapacity: source.mobilizationCapacity,
        satisfaction: source.satisfaction,
        institutionalAccess: source.institutionalAccess,
        interests: source.interests,
        ...definition
      }));
      if (finite(definition.representedPopulation)) {
        const count = Math.max(0, Math.floor(Number(definition.representedPopulation)));
        if (count > state.population.total) throw new RangeError(`O grupo '${group.id}' excede a população total.`);
        group.representedPopulation = count;
        group.representativity = state.population.total > 0 ? round1((count / state.population.total) * 100) : 0;
        group.measurement = {
          status: definition.evidenceLevel === "measured" ? "measured" : "estimated",
          basis: text(definition.basis, "Base informada explicitamente durante a divisão.")
        };
      }
      return group;
    });
    state.groups = state.groups.filter((group) => group.id !== source.id).concat(created);
    pushEvent(state, { type: "group_split", month: state.currentMonth, sourceGroupId: source.id, createdGroupIds: ids, message: `${source.name} foi dividido em ${created.length} grupos.` });
    return clone(created);
  }

  function setComposition(state, composition = {}) {
    ensureState(state);
    const total = Math.max(0, Math.floor(numberOr(composition.population, state.population.total)));
    const workingAge = finite(composition.workingAge) ? Math.max(0, Math.floor(Number(composition.workingAge))) : null;
    const memberships = composition.groups || {};
    const resolvedMemberships = new Map();
    for (const group of state.groups) {
      const item = Array.isArray(memberships)
        ? memberships.find((entry) => entry && String(entry.groupId) === group.id)
        : memberships[group.id];
      if (item && finite(item.count)) {
        const count = Math.max(0, Math.floor(Number(item.count)));
        if (count > total) throw new RangeError(`O grupo '${group.id}' não pode representar mais pessoas que a população total.`);
        resolvedMemberships.set(group.id, { ...item, count });
      }
    }

    state.population = {
      total,
      workingAge,
      dataStatus: text(composition.dataStatus, total > 0 ? "measured" : "unavailable")
    };

    for (const group of state.groups) {
      const item = resolvedMemberships.get(group.id);
      if (!item || !finite(item.count)) {
        group.representedPopulation = null;
        group.representativity = null;
        group.measurement = {
          status: "unavailable",
          basis: "Não há variável suficiente na simulação atual para identificar este segmento."
        };
      } else {
        const count = item.count;
        group.representedPopulation = count;
        group.representativity = total > 0 ? round1((count / total) * 100) : 0;
        group.measurement = {
          status: item.evidenceLevel === "measured" ? "measured" : "estimated",
          basis: text(item.basis, "Composição informada por um adaptador de dados.")
        };
      }
      refreshGroup(group);
    }
    state.compositionSource = text(composition.source, "external_adapter");
    return clone(state.population);
  }

  function deriveComposition(populationSnapshot = {}, societyState = null) {
    const totals = populationSnapshot.totals || {};
    const coreGroups = Array.isArray(populationSnapshot.groups) ? populationSnapshot.groups : [];
    const total = Math.max(0, Math.floor(numberOr(totals.total, coreGroups.reduce((sum, item) => sum + numberOr(item.population, numberOr(item.adults) + numberOr(item.children)), 0))));
    const societyHouseholds = Array.isArray(societyState?.households) ? societyState.households : null;
    let workingAge = null;
    if (societyHouseholds) {
      workingAge = societyHouseholds.reduce((sum, household) => sum + (Array.isArray(household.members)
        ? household.members.filter((person) => numberOr(person.age) >= 18 && numberOr(person.age) < 65).length
        : 0), 0);
    } else if (finite(totals.adults)) {
      workingAge = Math.max(0, Math.floor(Number(totals.adults)));
    }

    const groups = {};
    if (workingAge !== null) {
      groups.workers = {
        count: Math.min(total, workingAge),
        evidenceLevel: "estimated",
        basis: societyHouseholds
          ? "Estimativa pela população em idade ativa (18 a 64 anos); ainda não separa ocupados, desempregados e inativos."
          : "Estimativa pela quantidade de adultos informada pelo Core; a faixa etária detalhada ainda não foi fornecida."
      };
    }
    return {
      population: total,
      workingAge,
      groups,
      dataStatus: total > 0 ? "measured" : "unavailable",
      source: "core_society_adapter"
    };
  }

  function updateCompositionFromRuntime(state, runtime, societyState = null) {
    if (!runtime?.population || typeof runtime.population.getSnapshot !== "function") return null;
    return setComposition(state, deriveComposition(runtime.population.getSnapshot(), societyState));
  }

  function applyImpact(state, impact = {}) {
    ensureState(state);
    const groupId = text(impact.groupId).trim();
    const group = findGroup(state, groupId);
    if (!group) throw new Error(`Grupo político não encontrado para impacto: ${groupId}`);
    const channels = impact.channels || {};
    const changes = {};
    for (const [channel, rawDelta] of Object.entries(channels)) {
      if (!CHANNELS.has(channel)) continue;
      if (!finite(rawDelta)) continue;
      const before = group[channel];
      group[channel] = clamp(before + Number(rawDelta));
      changes[channel] = round1(group[channel] - before);
    }
    refreshGroup(group);
    const event = pushEvent(state, {
      type: "interest_impact",
      month: finite(impact.month) ? Number(impact.month) : state.currentMonth,
      source: text(impact.source, "external"),
      sourceEventId: impact.eventId ?? null,
      groupId,
      groupName: group.name,
      reason: text(impact.reason, "Impacto registrado sem descrição."),
      evidence: clone(impact.evidence || null),
      changes,
      influenceAfter: group.influence,
      relationAfter: group.governmentRelation
    });
    return { group: clone(group), event };
  }

  function recordImpacts(state, payload = {}) {
    ensureState(state);
    const impacts = Array.isArray(payload.impacts) ? payload.impacts : [];
    const results = impacts.map((impact) => applyImpact(state, {
      ...impact,
      month: finite(impact.month) ? impact.month : payload.month,
      eventId: impact.eventId ?? payload.eventId,
      source: impact.source || payload.source || payload.eventType || "external"
    }));
    return results;
  }

  function captureHistory(state, month) {
    const snapshot = {
      month,
      population: state.population.total,
      measuredGroups: state.groups.filter((group) => group.measurement.status !== "unavailable").length,
      groups: state.groups.map((group) => ({
        id: group.id,
        influence: group.influence,
        satisfaction: group.satisfaction,
        governmentRelation: group.governmentRelation,
        representedPopulation: group.representedPopulation,
        representativity: group.representativity
      }))
    };
    const previous = state.history[state.history.length - 1];
    if (previous?.month === month) state.history[state.history.length - 1] = snapshot;
    else state.history.push(snapshot);
    if (state.history.length > HISTORY_LIMIT) state.history.splice(0, state.history.length - HISTORY_LIMIT);
    return clone(snapshot);
  }

  function advanceMonth(state, options = {}) {
    ensureState(state);
    const month = finite(options.month) ? Math.floor(Number(options.month)) : state.currentMonth + 1;
    if (state.lastProcessedMonth === month) return { unchanged: true, snapshot: getSnapshot(state), influenceChanges: [] };
    if (state.lastProcessedMonth !== null && month < state.lastProcessedMonth) {
      throw new RangeError("O módulo político não pode retroceder no calendário.");
    }

    const before = new Map(state.groups.map((group) => [group.id, group.influence]));
    if (options.composition) setComposition(state, options.composition);
    else if (options.populationSnapshot) {
      setComposition(state, deriveComposition(options.populationSnapshot, options.societyState || null));
    }

    for (const impact of Array.isArray(options.impacts) ? options.impacts : []) {
      applyImpact(state, { ...impact, month });
    }
    for (const group of state.groups) refreshGroup(group);

    state.currentMonth = month;
    state.lastProcessedMonth = month;
    captureHistory(state, month);
    const influenceChanges = state.groups.map((group) => ({
      groupId: group.id,
      previous: before.has(group.id) ? before.get(group.id) : null,
      current: group.influence,
      delta: before.has(group.id) ? round1(group.influence - before.get(group.id)) : null
    })).filter((item) => item.delta !== null && Math.abs(item.delta) >= 0.1);

    pushEvent(state, {
      type: "month_closed",
      month,
      population: state.population.total,
      groupCount: state.groups.length,
      influenceChanges,
      message: `O retrato político do mês ${month} foi atualizado.`
    });
    return { unchanged: false, snapshot: getSnapshot(state), influenceChanges };
  }

  function getSnapshot(state) {
    ensureState(state);
    const groups = state.groups.map((group) => clone(refreshGroup(group))).sort((a, b) => b.influence - a.influence);
    const relations = groups.reduce((result, group) => {
      result[group.governmentRelation] = (result[group.governmentRelation] || 0) + 1;
      return result;
    }, { support: 0, neutral: 0, opposition: 0 });
    return {
      version: VERSION,
      currentMonth: state.currentMonth,
      population: clone(state.population),
      summary: {
        groupCount: groups.length,
        measuredGroups: groups.filter((group) => group.measurement.status !== "unavailable").length,
        unmeasuredGroups: groups.filter((group) => group.measurement.status === "unavailable").length,
        relations,
        mostInfluentialGroup: groups[0] ? { id: groups[0].id, name: groups[0].name, influence: groups[0].influence } : null
      },
      groups,
      history: clone(state.history),
      recentEvents: clone(state.events.slice(-12)),
      compositionSource: state.compositionSource
    };
  }

  function resetState(state, options = {}) {
    const next = createState(options);
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, next);
    return state;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function renderDashboard(state, host) {
    if (!host || !state) return false;
    const data = getSnapshot(state);
    const relationLabel = { support: "Apoia", neutral: "Neutro", opposition: "Oposição" };
    const relationClass = { support: "politics-support", neutral: "politics-neutral", opposition: "politics-opposition" };
    const formatPopulation = (value) => value === null || value === undefined ? "Não mensurado" : Math.round(value).toLocaleString("pt-BR");
    const groupCards = data.groups.map((group) => {
      const measured = group.measurement.status !== "unavailable";
      const coverageLabel = group.measurement.status === "measured" ? "Medido" : group.measurement.status === "estimated" ? "Estimado" : "Sem dados";
      return `<article class="politics-group-card">
        <div class="politics-group-head"><div><h3>${escapeHtml(group.name)}</h3><p>${escapeHtml(group.description)}</p></div><span class="politics-relation ${relationClass[group.governmentRelation]}">${relationLabel[group.governmentRelation]}</span></div>
        <div class="politics-influence"><span>Influência política</span><strong>${group.influence.toFixed(1)}/100</strong></div>
        <div class="politics-track"><span style="width:${group.influence}%"></span></div>
        <div class="politics-metrics">
          <div><span>Representatividade</span><b>${measured ? `${group.representativity.toFixed(1)}%` : "n/d"}</b></div>
          <div><span>Base representada</span><b>${formatPopulation(group.representedPopulation)}</b></div>
          <div><span>Poder econômico</span><b>${group.economicPower.toFixed(0)}/100</b></div>
          <div><span>Organização</span><b>${group.organization.toFixed(0)}/100</b></div>
          <div><span>Coesão</span><b>${group.cohesion.toFixed(0)}/100</b></div>
          <div><span>Mobilização</span><b>${group.mobilizationCapacity.toFixed(0)}/100</b></div>
          <div><span>Acesso institucional</span><b>${group.institutionalAccess.toFixed(0)}/100</b></div>
          <div><span>Satisfação</span><b>${group.satisfaction.toFixed(0)}/100</b></div>
          <div><span>Qualidade do dado</span><b>${coverageLabel}</b></div>
        </div>
        <p class="politics-measurement">${escapeHtml(group.measurement.basis)}</p>
        <div class="politics-interests">${group.interests.map((interest) => `<span>${escapeHtml(interest)}</span>`).join("")}</div>
      </article>`;
    }).join("");

    host.innerHTML = `
      <section class="politics-dashboard">
        <div class="politics-summary-grid">
          <article class="politics-summary-card"><span>Grupos ativos</span><strong>${data.summary.groupCount}</strong></article>
          <article class="politics-summary-card"><span>População observada</span><strong>${formatPopulation(data.population.total)}</strong></article>
          <article class="politics-summary-card"><span>Grupos com dados de base</span><strong>${data.summary.measuredGroups}/${data.summary.groupCount}</strong></article>
          <article class="politics-summary-card"><span>Maior influência</span><strong>${data.summary.mostInfluentialGroup ? escapeHtml(data.summary.mostInfluentialGroup.name) : "n/d"}</strong></article>
        </div>
        <div class="politics-section-heading"><div><span class="eyebrow">MAPA DE INTERESSES</span><h2>Quem tem poder e por quê.</h2><p>A influência combina poder econômico, organização, coesão, mobilização, acesso institucional e representatividade quando medida.</p></div></div>
        <div class="politics-groups-grid">${groupCards}</div>
        <p class="politics-data-note">Representatividade não é exclusiva: uma mesma pessoa pode integrar vários grupos. “Não mensurado” significa ausência de dado, não população igual a zero. Os parâmetros iniciais de poder e organização são hipóteses de balanceamento do cenário.</p>
      </section>`;
    return true;
  }

  function registerWithRuntime(runtime, options = {}) {
    if (!runtime || !runtime.modules || !runtime.population || !runtime.events || typeof runtime.publish !== "function") {
      throw new TypeError("Runtime do Vilarejo incompleto para registrar Política.");
    }
    if (!runtime.modules.has("core") || !runtime.modules.has("economia")) {
      throw new Error("Política exige os módulos Core e Economia registrados.");
    }
    if (runtime.modules.has("politica")) {
      return { alreadyRegistered: true, state: null, dispose() {} };
    }

    runtime.modules.register({
      id: "politica",
      version: VERSION,
      name: "Política",
      dependencies: ["core", "economia"],
      description: "Grupos de interesse, representatividade, organização e influência política."
    });

    const state = createState({ seed: options.seed });
    const societyState = () => {
      if (typeof options.getSocietyState === "function") {
        const supplied = options.getSocietyState();
        return supplied && Array.isArray(supplied.households) ? supplied : null;
      }
      if (options.societyState && Array.isArray(options.societyState.households)) return options.societyState;
      const adapter = root?.VilarejoSocietyRuntime;
      return adapter?.state && Array.isArray(adapter.state.households) ? adapter.state : null;
    };
    const publishSnapshot = (source = "politica") => {
      const snapshot = getSnapshot(state);
      runtime.modules.updateSnapshot("politica", snapshot, source);
      return snapshot;
    };
    const refreshComposition = () => updateCompositionFromRuntime(state, runtime, societyState());

    refreshComposition();
    publishSnapshot("politica.initial-adapter");

    const unsubscribeReset = runtime.events.on("game:reset", () => {
      resetState(state, { seed: options.seed });
      publishSnapshot("politica.reset");
    });

    const unsubscribeInitialized = runtime.events.on("game:initialized", () => {
      refreshComposition();
      publishSnapshot("politica.game-initialized");
    });

    const unsubscribeWorld = runtime.events.on("world:synchronized", () => {
      refreshComposition();
    });

    const unsubscribeSociety = runtime.events.on("society:month-closed", () => {
      refreshComposition();
    });

    const unsubscribeEconomyMonth = runtime.events.on("economy:month-closed", (event) => {
      const month = Math.max(0, Math.floor(numberOr(event?.payload?.monthNumber, runtime.clock?.snapshot?.().economicMonthNumber || state.currentMonth + 1)));
      const result = advanceMonth(state, {
        month,
        populationSnapshot: runtime.population.getSnapshot(),
        societyState: societyState()
      });
      const snapshot = publishSnapshot("politica.month-closed");
      if (!result.unchanged) {
        runtime.publish("politics:month-closed", snapshot, "politica");
        for (const change of result.influenceChanges) {
          runtime.publish("politics:influence-changed", change, "politica");
        }
      }
    });

    const unsubscribeImpact = runtime.events.on("politics:interest-impact", (event) => {
      const results = recordImpacts(state, event?.payload || {});
      const snapshot = publishSnapshot("politica.impact-adapter");
      runtime.publish("politics:group-updated", { impacts: results.map((result) => result.event), snapshot }, "politica");
    });

    return {
      alreadyRegistered: false,
      state,
      getSnapshot: () => getSnapshot(state),
      updateGroup: (groupId, changes) => {
        const result = updateGroup(state, groupId, changes);
        const snapshot = publishSnapshot("politica.group-updated");
        runtime.publish("politics:group-updated", { groupId, group: result, snapshot }, "politica");
        return result;
      },
      applyImpact: (impact) => {
        const result = applyImpact(state, impact);
        const snapshot = publishSnapshot("politica.impact-applied");
        runtime.publish("politics:group-updated", { groupId: impact.groupId, impact: result.event, snapshot }, "politica");
        return result;
      },
      refreshComposition,
      dispose() {
        unsubscribeReset();
        unsubscribeInitialized();
        unsubscribeWorld();
        unsubscribeSociety();
        unsubscribeEconomyMonth();
        unsubscribeImpact();
      }
    };
  }

  if (root?.VilarejoRuntime) {
    try {
      root.VilarejoPoliticsRuntime = registerWithRuntime(root.VilarejoRuntime);
    } catch (error) {
      if (root.console?.error) root.console.error("Falha ao registrar o módulo Política:", error);
    }
  }

  return {
    VERSION,
    GROUP_DEFINITIONS: clone(GROUP_DEFINITIONS),
    createState,
    addGroup,
    removeGroup,
    updateGroup,
    mergeGroups,
    splitGroup,
    setComposition,
    deriveComposition,
    updateCompositionFromRuntime,
    calculateInfluence,
    applyImpact,
    recordImpacts,
    advanceMonth,
    getSnapshot,
    resetState,
    renderDashboard,
    registerWithRuntime
  };
});
