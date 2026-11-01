/*
 * Vilarejo | Evolução social e institucional v0.2
 * Camada de leitura social, memória de pressões, jornal mensal e ciclo institucional.
 * Não cria indicadores ausentes nem movimenta dinheiro da simulação por conta própria.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.VilarejoEvolution = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = 2;
  const HISTORY_LIMIT = 240;
  const METRIC_HISTORY_LIMIT = 18;
  const STAGE_CONFIRMATION_MONTHS = 2;
  const NEED_PERSISTENCE_MONTHS = 3;

  const STAGES = [
    { id: "comunidade", label: "Comunidade", population: 0, firms: 0, sectors: 0 },
    { id: "vilarejo", label: "Vilarejo", population: 20, firms: 4, sectors: 0 },
    { id: "municipio", label: "Município", population: 50, firms: 6, sectors: 3 },
    { id: "centro_regional", label: "Centro regional", population: 100, firms: 10, sectors: 4 }
  ];

  const CATALOG = [
    {
      id: "administracao_comunitaria", name: "Administração comunitária", area: "governanca", type: "base", initial: true,
      description: "Gestão básica do Tesouro, das propriedades públicas e das decisões da comunidade.", minimumStaff: 0
    },
    {
      id: "obras_infraestrutura", name: "Obras e infraestrutura básica", area: "infraestrutura", type: "capacidade_existente", initial: true,
      description: "Aproveita o sistema atual de infraestrutura urbana, obras e manutenção.", minimumStaff: 0
    },
    {
      id: "escola_comunitaria", name: "Escola comunitária", area: "educacao", type: "instituicao", stageAtLeast: "vilarejo",
      requirements: [
        { path: "education.schoolAgeChildren", op: "gte", value: 6, label: "pelo menos 6 crianças em idade escolar" },
        { path: "education.availableTeachers", op: "gte", value: 1, label: "ao menos 1 professor disponível" }
      ],
      description: "Oferta local de educação básica.", minimumStaff: 1
    },
    {
      id: "posto_saude", name: "Posto de saúde", area: "saude", type: "instituicao", stageAtLeast: "vilarejo",
      requirements: [
        { path: "health.unmetDemandIndex", op: "gte", value: 0.25, label: "demanda de saúde não atendida de pelo menos 25%" },
        { path: "health.availableProfessionals", op: "gte", value: 1, label: "ao menos 1 profissional de saúde disponível" }
      ],
      description: "Atendimento básico de saúde da população.", minimumStaff: 1
    },
    {
      id: "posto_seguranca", name: "Posto de segurança", area: "seguranca", type: "instituicao", stageAtLeast: "municipio",
      requirements: [
        { path: "security.incidentRate", op: "gte", value: 0.03, label: "incidência de ocorrências de pelo menos 3%" },
        { path: "security.availableAgents", op: "gte", value: 1, label: "ao menos 1 agente disponível" }
      ],
      description: "Estrutura local de prevenção e atendimento de ocorrências.", minimumStaff: 1
    },
    {
      id: "saneamento_basico", name: "Sistema de saneamento básico", area: "saneamento", type: "infraestrutura", stageAtLeast: "vilarejo",
      requirements: [
        { path: "sanitation.coverageGap", op: "gte", value: 0.25, label: "déficit de cobertura de saneamento de pelo menos 25%" },
        { path: "sanitation.technicalCapacity", op: "gte", value: 1, label: "capacidade técnica para implantação" }
      ],
      description: "Ampliação do acesso à água tratada, coleta e tratamento de esgoto.", minimumStaff: 1
    }
  ];

  const NEEDS = [
    { id: "habitacao", label: "Moradia", path: "housing.pressure", warning: 0.75, critical: 0.90, unit: "capacidade", worseWhen: "higher", recommendation: "Avaliar expansão da capacidade habitacional e oferta de moradias." },
    { id: "infraestrutura", label: "Infraestrutura", path: "infrastructure.congestionRatio", warning: 0.90, critical: 1.00, unit: "capacidade", worseWhen: "higher", recommendation: "Avaliar manutenção e ampliação da infraestrutura urbana." },
    { id: "abastecimento", label: "Abastecimento", path: "food.shortageRatio", warning: 0.05, critical: 0.15, unit: "demanda", worseWhen: "higher", recommendation: "Investigar estoque, capital de giro, importações e concorrência no comércio." },
    { id: "trabalho", label: "Trabalho", path: "labor.unemploymentRate", warning: 0.10, critical: 0.20, unit: "força de trabalho", worseWhen: "higher", recommendation: "Avaliar entrada de empresas, investimento produtivo e qualificação profissional." },
    { id: "educacao", label: "Educação", path: "education.unmetDemandIndex", warning: 0.10, critical: 0.25, unit: "demanda educacional", worseWhen: "higher", recommendation: "Avaliar vagas escolares, disponibilidade de professores e acesso das crianças." },
    { id: "saude", label: "Saúde", path: "health.unmetDemandIndex", warning: 0.10, critical: 0.25, unit: "demanda de saúde", worseWhen: "higher", recommendation: "Avaliar capacidade de atendimento, profissionais e acesso aos serviços de saúde." },
    { id: "seguranca", label: "Segurança", path: "security.incidentRate", warning: 0.02, critical: 0.05, unit: "população", worseWhen: "higher", recommendation: "Avaliar prevenção, iluminação, presença institucional e capacidade de resposta." },
    { id: "saneamento", label: "Saneamento", path: "sanitation.coverageGap", warning: 0.15, critical: 0.30, unit: "população sem cobertura", worseWhen: "higher", recommendation: "Avaliar acesso à água tratada, coleta e tratamento de esgoto." }
  ];

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const numberOrNull = (value) => finite(value) ? value : null;
  const getPath = (obj, path) => path.split(".").reduce((value, key) => value == null ? undefined : value[key], obj);
  const stageIndex = (id) => Math.max(0, STAGES.findIndex((stage) => stage.id === id));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const round = (value, digits = 2) => Number(value.toFixed(digits));

  function calculateStage(metrics = {}) {
    const required = ["population", "activeFirms", "sectorCount"];
    if (required.some((key) => !finite(metrics[key]) || metrics[key] < 0)) return null;
    let selected = STAGES[0];
    for (const stage of STAGES) {
      if (metrics.population >= stage.population && metrics.activeFirms >= stage.firms && metrics.sectorCount >= stage.sectors) selected = stage;
    }
    return clone(selected);
  }

  function readMetrics(simulation = {}) {
    const hasHouseholds = Array.isArray(simulation.households);
    const hasFirms = Array.isArray(simulation.firms);
    const households = hasHouseholds ? simulation.households : [];
    const firms = hasFirms ? simulation.firms : [];
    const population = hasHouseholds ? households.reduce((sum, h) => sum + Math.max(0, Number(h.adults) || 0) + Math.max(0, Number(h.children) || 0), 0) : null;
    const dependentChildren = hasHouseholds ? households.reduce((sum, h) => sum + Math.max(0, Number(h.children) || 0), 0) : null;
    const adults = hasHouseholds ? households.reduce((sum, h) => sum + Math.max(0, Number(h.adults) || 0), 0) : null;
    const outOfLaborForce = hasHouseholds ? households.reduce((sum, h) => sum + Math.max(0, Number(h.outOfLaborForce) || 0), 0) : null;
    const occupied = hasHouseholds ? households.reduce((sum, h) => sum + Math.max(0, Number(h.jobs) || 0), 0) : null;
    const laborForce = adults == null ? null : Math.max(0, adults - outOfLaborForce);
    const unemploymentRate = laborForce > 0 ? Math.max(0, (laborForce - occupied) / laborForce) : null;
    const activeFirms = hasFirms ? firms.filter((f) => f && f.status !== "liquidated" && f.status !== "closed").length : null;
    const sectorCount = hasFirms ? new Set(firms.filter((f) => f && f.status !== "liquidated" && f.status !== "closed").map((f) => f.sector).filter(Boolean)).size : null;
    const housingCapacity = numberOrNull(simulation.housingCapacity);
    const housingPressure = population != null && housingCapacity > 0 ? population / housingCapacity : null;
    const infrastructureCongestion = numberOrNull(simulation.urbanInfra && simulation.urbanInfra.congestionRatio);
    const demand = numberOrNull(simulation.lastDemandUnits);
    const shortage = numberOrNull(simulation.lastShortageUnits);
    const foodShortageRatio = demand > 0 && shortage != null ? clamp(shortage / demand, 0, 1) : null;

    const social = simulation.socialIndicators || {};
    const readDomain = (source, fields) => {
      if (!source || typeof source !== "object") return null;
      const result = {};
      for (const field of fields) result[field] = numberOrNull(source[field]);
      return Object.values(result).some((v) => v != null) ? result : null;
    };
    const education = readDomain(simulation.education || social.education, ["schoolAgeChildren", "availableTeachers", "unmetDemandIndex"]);
    const health = readDomain(simulation.health || social.health, ["unmetDemandIndex", "availableProfessionals"]);
    const security = readDomain(simulation.security || social.security, ["incidentRate", "availableAgents"]);
    const sanitation = readDomain(simulation.sanitation || social.sanitation, ["coverageGap", "technicalCapacity"]);

    return {
      month: numberOrNull(simulation.monthNumber),
      population, dependentChildren, adults,
      activeFirms, sectorCount,
      housing: { capacity: housingCapacity, pressure: numberOrNull(housingPressure) },
      infrastructure: { congestionRatio: infrastructureCongestion },
      food: { shortageRatio: numberOrNull(foodShortageRatio), demandUnits: demand, unmetUnits: shortage },
      labor: { unemploymentRate: numberOrNull(unemploymentRate), laborForce, occupied, outOfLaborForce },
      government: { treasuryCash: numberOrNull(simulation.accounts && simulation.accounts.treasury) },
      ...(education ? { education } : {}),
      ...(health ? { health } : {}),
      ...(security ? { security } : {}),
      ...(sanitation ? { sanitation } : {}),
      dataDomains: {
        demography: population != null,
        economy: activeFirms != null,
        housing: housingCapacity != null && housingPressure != null,
        infrastructure: infrastructureCongestion != null,
        food: foodShortageRatio != null,
        labor: unemploymentRate != null,
        education: Boolean(education), health: Boolean(health),
        security: Boolean(security), sanitation: Boolean(sanitation)
      }
    };
  }

  function evaluateNeeds(metrics = {}) {
    return NEEDS.map((definition) => {
      const value = numberOrNull(getPath(metrics, definition.path));
      let level = "sem_dados";
      if (value != null) level = value >= definition.critical ? "critica" : value >= definition.warning ? "atencao" : "normal";
      return { ...clone(definition), value, level, consecutiveMonths: 0, persistent: false, trend: "sem_historico", delta: null };
    });
  }

  function createState() {
    const institutions = CATALOG.map((definition) => ({
      id: definition.id, name: definition.name, area: definition.area, type: definition.type,
      availability: definition.initial ? "available" : "locked",
      lifecycle: definition.initial ? "operational" : "not_built",
      unlockMonth: definition.initial ? 0 : null, plannedMonth: null,
      construction: null, operations: definition.initial ? { staff: 0, capacity: 1, monthlyMaintenance: 0, status: "regular", serviceFactor: 1, lastPaidMonth: 0 } : null,
      blocker: null
    }));
    return {
      version: VERSION, stage: "comunidade", stageCandidate: null,
      lastUpdatedMonth: null, institutions, needs: [], metrics: null,
      metricsHistory: [], events: [],
      history: [{ month: 0, type: "initialization", message: "A comunidade iniciou sua trajetória." }]
    };
  }

  function migrateState(state) {
    if (!state || typeof state !== "object") return createState();
    if (state.version === VERSION) return clone(state);
    if (state.version !== 1) return createState();
    const next = createState();
    next.stage = STAGES.some((s) => s.id === state.stage) ? state.stage : "comunidade";
    next.lastUpdatedMonth = finite(state.lastUpdatedMonth) ? state.lastUpdatedMonth : null;
    next.metrics = clone(state.metrics || null);
    next.needs = Array.isArray(state.needs) ? state.needs.map((need) => ({ ...need, consecutiveMonths: 0, persistent: false, trend: "sem_historico", delta: null })) : [];
    next.history = Array.isArray(state.history) ? clone(state.history).slice(-HISTORY_LIMIT) : next.history;
    next.events = [];
    const oldInstitutions = new Map((state.institutions || []).map((item) => [item.id, item]));
    next.institutions = next.institutions.map((item) => {
      const old = oldInstitutions.get(item.id);
      return old ? { ...item, ...clone(old), operations: old.operations || item.operations } : item;
    });
    next.history.push({ month: next.lastUpdatedMonth ?? 0, type: "migration", message: "Registro social atualizado para a versão 0.2; histórico anterior preservado." });
    return next;
  }

  function checkRequirement(metrics, requirement) {
    const actual = numberOrNull(getPath(metrics, requirement.path));
    if (actual == null) return { pass: false, missing: true, reason: `Indicador ainda não modelado: ${requirement.label}.` };
    const pass = requirement.op === "lte" ? actual <= requirement.value : requirement.op === "eq" ? actual === requirement.value : actual >= requirement.value;
    return { pass, missing: false, reason: pass ? null : `Ainda falta: ${requirement.label}.` };
  }

  function evaluateInstitution(definition, metrics, stage) {
    const blockers = [];
    if (definition.stageAtLeast && (!stage || stageIndex(stage.id) < stageIndex(definition.stageAtLeast))) {
      const needed = STAGES.find((item) => item.id === definition.stageAtLeast);
      blockers.push(`O vilarejo precisa alcançar a fase ${needed ? needed.label : definition.stageAtLeast}.`);
    }
    for (const requirement of definition.requirements || []) {
      const result = checkRequirement(metrics, requirement);
      if (!result.pass) blockers.push(result.reason);
    }
    return { ready: blockers.length === 0, blockers };
  }

  function addEvent(state, events, event) {
    events.push(event);
    state.history.push(event);
  }

  function withNeedHistory(needs, metricsHistory) {
    return needs.map((need) => {
      if (need.value == null || !metricsHistory.length) return need;
      let consecutiveMonths = 0;
      let expectedMonth = metricsHistory[metricsHistory.length - 1].month;
      for (let i = metricsHistory.length - 1; i >= 0; i--) {
        const entry = metricsHistory[i];
        if (entry.month !== expectedMonth) break;
        const value = numberOrNull(getPath(entry.metrics, need.path));
        if (value == null || value < need.warning) break;
        consecutiveMonths++;
        expectedMonth--;
      }
      const current = metricsHistory[metricsHistory.length - 1];
      const previousEntry = metricsHistory.length >= 2 ? metricsHistory[metricsHistory.length - 2] : null;
      const hasConsecutivePrevious = previousEntry && previousEntry.month === current.month - 1;
      const previous = hasConsecutivePrevious ? numberOrNull(getPath(previousEntry.metrics, need.path)) : null;
      let trend = "sem_historico", delta = null;
      if (previous != null) {
        delta = round(need.value - previous, 4);
        if (Math.abs(delta) < 0.005) trend = "estavel";
        else trend = need.worseWhen === "higher" ? (delta > 0 ? "piorando" : "melhorando") : (delta < 0 ? "piorando" : "melhorando");
      }
      return { ...need, consecutiveMonths, persistent: consecutiveMonths >= NEED_PERSISTENCE_MONTHS, trend, delta };
    });
  }

  function advance(state, metrics = {}, month = null) {
    const next = migrateState(state);
    const currentMonth = finite(month) ? month : (numberOrNull(metrics.month) ?? 0);
    if (finite(next.lastUpdatedMonth) && currentMonth <= next.lastUpdatedMonth) return { state: next, events: [], unchanged: true };

    const events = [];
    const calculatedStage = calculateStage(metrics);
    const oldStage = STAGES.find((stage) => stage.id === next.stage) || STAGES[0];
    let newStage = oldStage;

    if (calculatedStage && stageIndex(calculatedStage.id) > stageIndex(oldStage.id)) {
      if (next.stageCandidate && next.stageCandidate.id === calculatedStage.id && next.stageCandidate.lastMonth === currentMonth - 1) {
        next.stageCandidate.count++;
      } else {
        next.stageCandidate = { id: calculatedStage.id, count: 1, firstMonth: currentMonth, lastMonth: currentMonth };
      }
      next.stageCandidate.lastMonth = currentMonth;
      if (next.stageCandidate.count >= STAGE_CONFIRMATION_MONTHS) {
        newStage = calculatedStage;
        next.stage = newStage.id;
        next.stageCandidate = null;
        addEvent(next, events, { type: "stage_changed", month: currentMonth, from: oldStage.id, to: newStage.id, message: `O vilarejo consolidou a fase ${newStage.label}.` });
      }
    } else {
      next.stageCandidate = null;
    }

    const snapshot = clone(metrics);
    next.metricsHistory.push({ month: currentMonth, metrics: snapshot });
    next.metricsHistory = next.metricsHistory.slice(-METRIC_HISTORY_LIMIT);
    const previousNeeds = new Map((next.needs || []).map((item) => [item.id, item]));
    next.needs = withNeedHistory(evaluateNeeds(metrics), next.metricsHistory);

    for (const need of next.needs) {
      const previous = previousNeeds.get(need.id);
      if (!previous || previous.level === "sem_dados" || need.level === "sem_dados") continue;
      if (previous.level !== need.level && (need.level === "atencao" || need.level === "critica")) {
        addEvent(next, events, { type: "need_worsened", month: currentMonth, needId: need.id, level: need.level, message: `${need.label} passou para ${need.level === "critica" ? "nível crítico" : "nível de atenção"}.` });
      } else if ((previous.level === "atencao" || previous.level === "critica") && need.level === "normal") {
        addEvent(next, events, { type: "need_improved", month: currentMonth, needId: need.id, level: "normal", message: `${need.label} voltou à faixa normal.` });
      }
      if (need.persistent && !(previous.persistent || false)) {
        addEvent(next, events, { type: "need_persistent", month: currentMonth, needId: need.id, level: need.level, message: `${need.label} permanece sob pressão há pelo menos ${NEED_PERSISTENCE_MONTHS} fechamentos mensais.` });
      }
    }

    const registry = new Map(next.institutions.map((institution) => [institution.id, institution]));
    for (const definition of CATALOG) {
      const institution = registry.get(definition.id);
      if (!institution || definition.initial || institution.availability === "available") continue;
      const evaluation = evaluateInstitution(definition, metrics, newStage);
      institution.blocker = evaluation.blockers;
      if (evaluation.ready) {
        institution.availability = "available";
        institution.unlockMonth = currentMonth;
        institution.blocker = null;
        addEvent(next, events, { type: "institution_available", month: currentMonth, institutionId: definition.id, message: `${definition.name} está disponível para avaliação do governo.` });
      }
    }

    // Avança obras já contratadas, uma vez por fechamento mensal.
    const elapsedMonths = finite(next.lastUpdatedMonth) ? Math.max(1, currentMonth - next.lastUpdatedMonth) : 1;
    const constructionResult = advanceConstructions(next, currentMonth, elapsedMonths);
    constructionResult.events.forEach((event) => addEvent(next, events, event));

    next.lastUpdatedMonth = currentMonth;
    next.events = events.slice();
    next.history = next.history.slice(-HISTORY_LIMIT);
    return { state: next, events };
  }

  function planInstitution(state, institutionId, month = 0) {
    const next = migrateState(state);
    const institution = next.institutions.find((item) => item.id === institutionId);
    if (!institution) return { ok: false, state: next, reason: "Instituição não encontrada." };
    if (institution.availability !== "available") return { ok: false, state: next, reason: "A instituição ainda não está disponível." };
    if (institution.lifecycle === "operational") return { ok: false, state: next, reason: "A instituição já está operacional." };
    if (institution.lifecycle === "under_construction" || institution.lifecycle === "ready_to_operate") return { ok: false, state: next, reason: "A construção já foi iniciada." };
    institution.lifecycle = "planned";
    institution.plannedMonth = finite(month) ? month : 0;
    return { ok: true, state: next, reason: null };
  }

  function startConstruction(state, institutionId, finance = {}) {
    const next = migrateState(state);
    const institution = next.institutions.find((item) => item.id === institutionId);
    if (!institution) return { ok: false, state: next, reason: "Instituição não encontrada." };
    if (institution.lifecycle !== "planned") return { ok: false, state: next, reason: "A instituição precisa estar planejada antes da obra." };
    const investmentCost = numberOrNull(finance.investmentCost);
    const monthlyMaintenance = numberOrNull(finance.monthlyMaintenance);
    const availableBudget = numberOrNull(finance.availableBudget);
    const constructionMonths = finite(finance.constructionMonths) ? Math.floor(finance.constructionMonths) : 1;
    if (investmentCost == null || investmentCost <= 0 || monthlyMaintenance == null || monthlyMaintenance < 0 || availableBudget == null || constructionMonths < 1) {
      return { ok: false, state: next, reason: "Informe custo de implantação, manutenção mensal, prazo e orçamento disponível." };
    }
    if (availableBudget < investmentCost) return { ok: false, state: next, reason: "Orçamento insuficiente para iniciar a construção." };
    institution.lifecycle = "under_construction";
    institution.construction = { investmentCost, monthlyMaintenance, totalMonths: constructionMonths, remainingMonths: constructionMonths, startedMonth: finite(finance.month) ? finance.month : null };
    return { ok: true, state: next, reason: null, investmentCost, constructionMonths };
  }

  function advanceConstructions(state, month, elapsedMonths = 1) {
    const next = state && state.version === VERSION ? state : migrateState(state);
    const events = [];
    const elapsed = finite(elapsedMonths) ? Math.max(1, Math.floor(elapsedMonths)) : 1;
    for (const institution of next.institutions) {
      if (institution.lifecycle !== "under_construction" || !institution.construction) continue;
      const construction = institution.construction;
      if (construction.lastProgressMonth === month) continue;
      construction.lastProgressMonth = month;
      construction.remainingMonths = Math.max(0, construction.remainingMonths - elapsed);
      if (construction.remainingMonths === 0) {
        institution.lifecycle = "ready_to_operate";
        events.push({ type: "construction_completed", month, institutionId: institution.id, message: `${institution.name} teve sua construção concluída e aguarda equipe para iniciar o atendimento.` });
      }
    }
    return { state: next, events };
  }

  function operationalizeInstitution(state, institutionId, resources = {}) {
    const next = migrateState(state);
    const institution = next.institutions.find((item) => item.id === institutionId);
    if (!institution) return { ok: false, state: next, reason: "Instituição não encontrada." };
    if (institution.lifecycle !== "ready_to_operate") return { ok: false, state: next, reason: "A obra precisa estar concluída antes do início do atendimento." };
    const definition = CATALOG.find((item) => item.id === institutionId);
    const staff = numberOrNull(resources.staff);
    const capacity = numberOrNull(resources.capacity);
    if (staff == null || capacity == null || capacity <= 0 || staff < (definition.minimumStaff || 0)) {
      return { ok: false, state: next, reason: "A instituição precisa de equipe e capacidade operacional mínimas." };
    }
    institution.lifecycle = "operational";
    institution.operations = {
      staff, capacity,
      monthlyMaintenance: institution.construction.monthlyMaintenance,
      status: "regular", serviceFactor: 1,
      lastPaidMonth: null, lastPayment: 0
    };
    return { ok: true, state: next, reason: null };
  }

  function settleMaintenance(state, institutionId, paidAmount, month) {
    const next = migrateState(state);
    const institution = next.institutions.find((item) => item.id === institutionId);
    if (!institution || institution.lifecycle !== "operational" || !institution.operations) return { ok: false, state: next, reason: "Instituição não está operacional." };
    const amount = numberOrNull(paidAmount);
    if (amount == null || amount < 0 || !finite(month)) return { ok: false, state: next, reason: "Pagamento ou mês inválido." };
    if (institution.operations.lastPaidMonth === month) return { ok: false, state: next, reason: "A manutenção deste mês já foi liquidada." };
    const due = institution.operations.monthlyMaintenance;
    const paid = Math.min(due, amount);
    const factor = due > 0 ? clamp(paid / due, 0, 1) : 1;
    institution.operations.lastPaidMonth = month;
    institution.operations.lastPayment = paid;
    institution.operations.serviceFactor = factor;
    institution.operations.status = factor >= 0.999 ? "regular" : factor > 0 ? "restrito" : "suspenso";
    return { ok: true, state: next, due, paid, serviceFactor: factor, status: institution.operations.status };
  }

  function buildBulletin(state) {
    const current = state || createState();
    const metrics = current.metrics || {};
    const needs = (current.needs || []).filter((need) => need.level === "atencao" || need.level === "critica").sort((a, b) => (a.level === "critica" ? 0 : 1) - (b.level === "critica" ? 0 : 1) || (b.value || 0) - (a.value || 0));
    const recentEvents = (current.events || []).filter((event) => ["stage_changed", "institution_available", "need_persistent", "need_worsened", "construction_completed"].includes(event.type));
    const articles = [];
    for (const need of needs) {
      const value = need.value;
      let evidence = "Indicador observado, sem valor numérico disponível.";
      if (need.id === "habitacao") evidence = `${Math.round(value * 100)}% da capacidade habitacional está ocupada.`;
      else if (need.id === "infraestrutura") evidence = `${Math.round(value * 100)}% da capacidade atual está sendo demandada.`;
      else if (need.id === "abastecimento") evidence = `${(value * 100).toFixed(1)}% da demanda estimada não foi atendida.`;
      else if (need.id === "trabalho") evidence = `${(value * 100).toFixed(1)}% da força de trabalho está sem ocupação.`;
      else if (need.id === "seguranca") evidence = `${(value * 100).toFixed(1)}% de incidência no indicador de ocorrências.`;
      else evidence = `${(value * 100).toFixed(1)}% no indicador de pressão do setor.`;
      articles.push({
        id: need.id, category: need.label, severity: need.level,
        title: `${need.label}: ${need.level === "critica" ? "pressão crítica" : "ponto de atenção"}`,
        summary: evidence,
        persistence: need.persistent ? `Pressão observada por ${need.consecutiveMonths} meses consecutivos.` : `Tendência: ${need.trend === "sem_historico" ? "histórico em formação" : need.trend.replace("_", " ")}.`,
        recommendation: need.recommendation,
        evidence: { value, metric: need.path },
        priority: value / Math.max(0.0001, need.warning)
      });
    }
    articles.sort((a, b) => (a.severity === "critica" ? 0 : 1) - (b.severity === "critica" ? 0 : 1) || (b.priority || 0) - (a.priority || 0));

    for (const event of recentEvents.slice(-4)) {
      if (event.type === "stage_changed") articles.unshift({ id: `stage-${event.month}`, category: "Desenvolvimento", severity: "informativo", title: `Nova etapa: ${STAGES.find((s) => s.id === event.to)?.label || event.to}`, summary: event.message, recommendation: "Reavalie as prioridades públicas à luz da nova escala populacional e econômica." });
      if (event.type === "institution_available") articles.unshift({ id: `institution-${event.institutionId}`, category: "Instituições", severity: "informativo", title: "Nova possibilidade institucional", summary: event.message, recommendation: "Avalie custo, equipe, capacidade e sustentabilidade antes de autorizar a implantação." });
      if (event.type === "construction_completed") articles.unshift({ id: `construction-${event.institutionId}`, category: "Obras públicas", severity: "informativo", title: "Obra concluída", summary: event.message, recommendation: "Providencie equipe e orçamento de manutenção antes de iniciar o serviço." });
    }

    const unknownAreas = NEEDS.filter((definition) => {
      const need = (current.needs || []).find((item) => item.id === definition.id);
      return !need || need.level === "sem_dados";
    }).map((item) => item.label);
    const headline = articles.length
      ? articles[0].title
      : unknownAreas.length === NEEDS.length
        ? "O jornal aguarda os primeiros indicadores sociais"
        : "Sem pressão relevante nos indicadores monitorados";
    const subhead = articles.length
      ? articles[0].summary
      : unknownAreas.length
        ? `Ainda faltam dados para avaliar: ${unknownAreas.join(", ")}.`
        : "Os dados deste fechamento não apontam pressões acima dos limites de atenção.";

    return { month: finite(current.lastUpdatedMonth) ? current.lastUpdatedMonth : 0, headline, subhead, articles: articles.slice(0, 8), unknownAreas };
  }

  function overview(state) {
    const current = state || createState();
    const stage = STAGES.find((item) => item.id === current.stage) || STAGES[0];
    const nextStage = STAGES[stageIndex(stage.id) + 1] || null;
    const institutions = (current.institutions || []).map((institution) => {
      const definition = CATALOG.find((item) => item.id === institution.id);
      return { ...institution, description: definition ? definition.description : "", blockers: institution.blocker || [] };
    });
    return {
      stage: clone(stage), nextStage: clone(nextStage), needs: clone(current.needs || []), metrics: clone(current.metrics || {}),
      operational: institutions.filter((item) => item.lifecycle === "operational"),
      available: institutions.filter((item) => item.availability === "available" && item.lifecycle !== "operational"),
      underDevelopment: institutions.filter((item) => ["planned", "under_construction", "ready_to_operate"].includes(item.lifecycle)),
      institutions: clone(institutions), bulletin: buildBulletin(current)
    };
  }

  function catalog() { return clone(CATALOG); }

  return {
    VERSION, STAGES: clone(STAGES), NEEDS: clone(NEEDS),
    createState, migrateState, readMetrics, calculateStage, evaluateNeeds, advance,
    planInstitution, startConstruction, advanceConstructions, operationalizeInstitution,
    settleMaintenance, buildBulletin, overview, catalog
  };
});
