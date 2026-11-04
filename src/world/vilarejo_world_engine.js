(function attachVilarejoWorld(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.VilarejoWorld = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createVilarejoWorld() {
  "use strict";

  const VERSION = "1.0.0";
  const MODULE_ID = "mundo_vivo";
  const HISTORY_LIMIT = 36;
  const EVENT_LIMIT = 120;
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const numberOr = (value, fallback = null) => finite(value) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;
  const text = (value, fallback = "") => String(value ?? fallback);

  const EVENT_RULES = Object.freeze({
    fiscal_pressure: { cooldown: 4, severity: "high" },
    quality_decline: { cooldown: 3, severity: "high" },
    community_outflow: { cooldown: 3, severity: "medium" },
    community_arrival: { cooldown: 3, severity: "positive" },
    quality_recovery: { cooldown: 4, severity: "positive" },
    fiscal_recovery: { cooldown: 6, severity: "positive" },
    coalition_fragility: { cooldown: 6, severity: "medium" },
    services_pressure: { cooldown: 4, severity: "high" }
  });

  const MILESTONE_DEFINITIONS = Object.freeze([
    { id: "first_close", title: "Primeiro ciclo concluído", description: "A comunidade fechou seu primeiro mês econômico.", goal: 1, metric: "months" },
    { id: "first_year", title: "Um ano de história", description: "Doze fechamentos mensais foram concluídos.", goal: 12, metric: "months" },
    { id: "institutions_active", title: "Instituições em funcionamento", description: "Política, representação e serviços já participaram de um fechamento mensal.", goal: 1, metric: "institutionMonths" },
    { id: "social_coverage", title: "Bem-estar acompanhado", description: "A qualidade de vida possui ao menos três dimensões medidas.", goal: 3, metric: "qolCoverage" },
    { id: "fiscal_stability", title: "Estabilidade fiscal", description: "Três meses consecutivos sem resultado fiscal negativo.", goal: 3, metric: "stableFiscalMonths" },
    { id: "population_growth", title: "Comunidade em expansão", description: "A população cresceu pelo menos 5% em relação ao início da partida.", goal: 5, metric: "populationGrowthPercent" },
    { id: "community_integration", title: "Novos moradores integrados", description: "Ao menos cinco chegadas foram registradas e a integração cultural foi medida em 60 pontos ou mais.", goal: 5, metric: "incomingResidents" }
  ]);

  function createState(options = {}) {
    const baseline = numberOr(options.baselinePopulation);
    return {
      version: VERSION,
      sessionId: text(options.sessionId, "session-unknown"),
      currentMonth: 0,
      baselinePopulation: baseline !== null && baseline >= 0 ? baseline : null,
      previous: null,
      trends: {
        deficitMonths: 0,
        stableFiscalMonths: 0,
        qolDropMonths: 0,
        qolRecoveryMonths: 0,
        previousFiscalResult: null,
        weakCoalitionMonths: 0,
        servicePressureMonths: 0
      },
      milestones: {},
      cooldowns: {},
      knownSourceEvents: [],
      events: [],
      history: [],
      lastSnapshot: null
    };
  }

  function normalizeMetrics(payload = {}, snapshots = {}) {
    const society = snapshots.sociedade || {};
    const demographic = society.demographic || {};
    const migration = society.migration || {};
    const monthlyMigration = migration.monthly || {};
    const cumulativeMigration = migration.cumulative || {};
    const qol = society.qualityOfLife?.current || {};
    const economicPopulation = payload.population || {};
    const gdp = numberOr(payload.nationalAccounts?.gdp);
    const population = numberOr(demographic.population, numberOr(economicPopulation.total));
    const migrationNet = numberOr(monthlyMigration.net,
      finite(monthlyMigration.incoming) || finite(monthlyMigration.outgoing)
        ? numberOr(monthlyMigration.incoming, 0) - numberOr(monthlyMigration.outgoing, 0)
        : null);
    const fiscalResult = numberOr(payload.fiscalResult);
    const qolScore = numberOr(qol.score);
    const measuredDimensions = numberOr(qol.measuredDimensions);
    const qolChange = numberOr(qol.change);
    const integrationIndex = numberOr(society.culture?.integrationIndex);
    const incomingResidents = numberOr(cumulativeMigration.incoming);
    const monthNumber = Math.floor(numberOr(payload.monthNumber, 0));
    const politics = snapshots.politica || {};
    const institutions = snapshots.instituicoes || {};
    const services = snapshots.servicos || {};
    const coalitionStatus = text(institutions.coalition?.status, "");
    const serviceRows = Object.values(services.domains || {})
      .map((domain) => ({ id: text(domain.id), name: text(domain.name, domain.id), satisfaction: numberOr(domain.satisfaction) }))
      .filter((domain) => domain.satisfaction !== null);
    const serviceAverage = serviceRows.length >= 3
      ? serviceRows.reduce((sum, domain) => sum + domain.satisfaction, 0) / serviceRows.length
      : null;
    const lowestService = serviceRows.sort((a, b) => a.satisfaction - b.satisfaction)[0] || null;
    const institutionsReady = ["politica", "instituicoes", "servicos"]
      .every((id) => Number(snapshots[id]?.currentMonth) === monthNumber);
    const engineEvents = Array.isArray(payload.eventEngine?.monthEvents) ? payload.eventEngine.monthEvents : [];
    return {
      monthNumber,
      day: numberOr(payload.day),
      population,
      gdp,
      fiscalResult,
      migrationNet,
      migrationIncoming: numberOr(monthlyMigration.incoming),
      migrationOutgoing: numberOr(monthlyMigration.outgoing),
      incomingResidents,
      integrationIndex,
      qolScore,
      qolChange,
      qolCoverage: measuredDimensions,
      workingAge: numberOr(demographic.workingAge),
      children: numberOr(demographic.children),
      elderly: numberOr(demographic.elderly),
      dependencyRatio: numberOr(demographic.dependencyRatio),
      institutionsReady,
      politicalRelations: clone(politics.summary?.relations || null),
      politicalMeasuredGroups: numberOr(politics.summary?.measuredGroups),
      coalitionStatus: coalitionStatus || null,
      coalitionSeats: numberOr(institutions.summary?.coalitionSeats ?? institutions.coalition?.seats),
      majoritySeats: numberOr(institutions.summary?.majoritySeats ?? institutions.legislature?.majoritySeats),
      serviceAverage,
      lowestService,
      serviceCoverage: serviceRows.length,
      engineEvents: engineEvents.filter((item) => typeof item === "string" && item.trim()).slice(0, 12),
      sourceEvents: Array.isArray(society.recentEvents) ? society.recentEvents : []
    };
  }

  function pushEvent(state, event) {
    const rule = EVENT_RULES[event.ruleId] || { cooldown: 0 };
    const previousMonth = numberOr(state.cooldowns[event.ruleId], -Infinity);
    if (event.ruleId && event.month - previousMonth < rule.cooldown) return null;
    const duplicate = state.events.some((item) => item.id === event.id && item.month === event.month);
    if (duplicate) return null;
    const record = {
      id: event.id,
      ruleId: event.ruleId || null,
      month: event.month,
      category: event.category || "comunidade",
      severity: event.severity || rule.severity || "info",
      title: text(event.title, "Acontecimento registrado"),
      narrative: text(event.narrative),
      evidence: clone(event.evidence || {}),
      source: event.source || "indicadores_observados"
    };
    state.events.push(record);
    if (event.ruleId) state.cooldowns[event.ruleId] = event.month;
    if (state.events.length > EVENT_LIMIT) state.events.splice(0, state.events.length - EVENT_LIMIT);
    return record;
  }

  function ingestSocietyEvents(state, metrics) {
    for (const sourceEvent of metrics.sourceEvents) {
      if (numberOr(sourceEvent.month) !== metrics.monthNumber) continue;
      const sourceKey = text(sourceEvent.id,
        `${sourceEvent.type || "social"}:${metrics.monthNumber}:${sourceEvent.message || sourceEvent.text || "evento"}`);
      if (state.knownSourceEvents.includes(sourceKey)) continue;
      state.knownSourceEvents.push(sourceKey);
      if (state.knownSourceEvents.length > EVENT_LIMIT * 2) state.knownSourceEvents.shift();
      pushEvent(state, {
        id: `society:${sourceKey}`,
        month: metrics.monthNumber,
        category: "sociedade",
        severity: "info",
        title: sourceEvent.type === "birth" ? "Novo nascimento" : sourceEvent.type === "death" ? "Luto na comunidade" : "Movimento na comunidade",
        narrative: text(sourceEvent.message, sourceEvent.text || "A Sociedade registrou um acontecimento."),
        evidence: { sourceType: text(sourceEvent.type, "social") },
        source: "society:month-closed"
      });
    }
  }

  function ingestEconomyEvents(state, metrics) {
    metrics.engineEvents.forEach((line, index) => {
      const narrative = text(line).replace(/^Mês \d+[: ·]\s*/, "");
      if (!narrative) return;
      pushEvent(state, {
        id: `eventos_v3:${metrics.monthNumber}:${index}:${narrative.slice(0, 48)}`,
        month: metrics.monthNumber,
        category: "Eventos V3",
        severity: "info",
        title: "Acontecimento do calendário",
        narrative,
        evidence: { monthNumber: metrics.monthNumber, logIndex: index },
        source: "eventos_v3"
      });
    });
  }

  function evaluateSignals(state, metrics) {
    const trends = state.trends;
    const month = metrics.monthNumber;

    if (metrics.fiscalResult !== null) {
      trends.deficitMonths = metrics.fiscalResult < 0 ? trends.deficitMonths + 1 : 0;
      trends.stableFiscalMonths = metrics.fiscalResult >= 0 ? trends.stableFiscalMonths + 1 : 0;
      if (trends.deficitMonths === 2) {
        pushEvent(state, {
          id: `fiscal_pressure:${month}`, ruleId: "fiscal_pressure", month, category: "finanças públicas", severity: "high",
          title: "Pressão recorrente sobre o Tesouro",
          narrative: "O resultado fiscal ficou negativo em dois fechamentos consecutivos. O desequilíbrio merece atenção antes de ampliar compromissos permanentes.",
          evidence: { consecutiveDeficitMonths: trends.deficitMonths, currentFiscalResult: metrics.fiscalResult }
        });
      }
      if (trends.previousFiscalResult !== null && trends.previousFiscalResult < 0 && metrics.fiscalResult >= 0) {
        pushEvent(state, {
          id: `fiscal_recovery:${month}`, ruleId: "fiscal_recovery", month, category: "finanças públicas", severity: "positive",
          title: "O resultado fiscal voltou ao campo positivo",
          narrative: "O último fechamento registrou resultado fiscal não negativo após um mês de déficit.",
          evidence: { previousFiscalResult: trends.previousFiscalResult, currentFiscalResult: metrics.fiscalResult }
        });
      }
      trends.previousFiscalResult = metrics.fiscalResult;
    }

    if (metrics.qolChange !== null) {
      trends.qolDropMonths = metrics.qolChange <= -2 ? trends.qolDropMonths + 1 : 0;
      trends.qolRecoveryMonths = metrics.qolChange >= 2 ? trends.qolRecoveryMonths + 1 : 0;
      if (trends.qolDropMonths >= 2) {
        pushEvent(state, {
          id: `quality_decline:${month}`, ruleId: "quality_decline", month, category: "bem-estar", severity: "high",
          title: "A qualidade de vida perdeu força",
          narrative: "A qualidade de vida recuou em dois fechamentos seguidos. Os indicadores disponíveis mostram uma tendência que merece investigação.",
          evidence: { consecutiveDeclines: trends.qolDropMonths, currentScore: metrics.qolScore, latestChange: metrics.qolChange, measuredDimensions: metrics.qolCoverage }
        });
      }
      if (trends.qolRecoveryMonths >= 2) {
        pushEvent(state, {
          id: `quality_recovery:${month}`, ruleId: "quality_recovery", month, category: "bem-estar", severity: "positive",
          title: "Melhora sustentada no bem-estar",
          narrative: "A qualidade de vida avançou em dois fechamentos consecutivos, segundo as dimensões efetivamente medidas.",
          evidence: { consecutiveImprovements: trends.qolRecoveryMonths, currentScore: metrics.qolScore, latestChange: metrics.qolChange, measuredDimensions: metrics.qolCoverage }
        });
      }
    } else {
      trends.qolDropMonths = 0;
      trends.qolRecoveryMonths = 0;
    }

    if (metrics.migrationNet !== null && metrics.migrationNet <= -2) {
      pushEvent(state, {
        id: `community_outflow:${month}`, ruleId: "community_outflow", month, category: "demografia", severity: "medium",
        title: "Saída líquida de moradores",
        narrative: "O número de saídas superou o de chegadas neste mês. O dado identifica o movimento, mas não determina sozinho sua causa.",
        evidence: { incoming: metrics.migrationIncoming, outgoing: metrics.migrationOutgoing, net: metrics.migrationNet }
      });
    } else if (metrics.migrationNet !== null && metrics.migrationNet >= 2) {
      pushEvent(state, {
        id: `community_arrival:${month}`, ruleId: "community_arrival", month, category: "demografia", severity: "positive",
        title: "Chegada líquida de moradores",
        narrative: "O número de chegadas superou o de saídas neste mês. A capacidade de acolhimento e integração passa a merecer acompanhamento.",
        evidence: { incoming: metrics.migrationIncoming, outgoing: metrics.migrationOutgoing, net: metrics.migrationNet }
      });
    }

    if (metrics.coalitionStatus !== null) {
      const fragile = metrics.coalitionStatus === "minority" || metrics.coalitionStatus === "not_formed";
      trends.weakCoalitionMonths = fragile ? trends.weakCoalitionMonths + 1 : 0;
      if (trends.weakCoalitionMonths === 2) {
        pushEvent(state, {
          id: `coalition_fragility:${month}`, ruleId: "coalition_fragility", month, category: "governabilidade", severity: "medium",
          title: metrics.coalitionStatus === "not_formed" ? "Governo sem coalizão formal" : "Base governista sem maioria",
          narrative: "A representação institucional passou dois fechamentos sem uma coalizão majoritária. Negociação e formação de apoio podem reduzir a dificuldade de governar.",
          evidence: { status: metrics.coalitionStatus, coalitionSeats: metrics.coalitionSeats, majoritySeats: metrics.majoritySeats, politicalRelations: metrics.politicalRelations }
        });
      }
    }

    if (metrics.serviceAverage !== null) {
      trends.servicePressureMonths = metrics.serviceAverage < 38 ? trends.servicePressureMonths + 1 : 0;
      if (trends.servicePressureMonths === 2) {
        pushEvent(state, {
          id: `services_pressure:${month}`, ruleId: "services_pressure", month, category: "serviços públicos", severity: "high",
          title: "Serviços públicos sob pressão",
          narrative: "A média dos índices de satisfação das áreas públicas ficou abaixo de 38 em dois fechamentos consecutivos. O indicador é uma referência de cenário, não uma medida de gasto executado.",
          evidence: { serviceAverage: round1(metrics.serviceAverage), serviceCoverage: metrics.serviceCoverage, lowestService: metrics.lowestService }
        });
      }
    }
  }

  function milestoneProgress(id, state, metrics) {
    switch (id) {
      case "first_close": return { value: Math.min(state.currentMonth, 1), available: true };
      case "first_year": return { value: Math.min(state.currentMonth, 12), available: true };
      case "institutions_active": return { value: state.currentMonth >= 1 && metrics.institutionsReady ? 1 : 0, available: metrics.institutionsReady };
      case "social_coverage": return { value: metrics.qolCoverage === null ? null : Math.min(metrics.qolCoverage, 3), available: metrics.qolCoverage !== null };
      case "fiscal_stability": return { value: metrics.fiscalResult === null ? null : Math.min(state.trends.stableFiscalMonths, 3), available: metrics.fiscalResult !== null };
      case "population_growth": {
        if (state.baselinePopulation === null || metrics.population === null || state.baselinePopulation <= 0) return { value: null, available: false };
        return { value: Math.max(0, ((metrics.population / state.baselinePopulation) - 1) * 100), available: true };
      }
      case "community_integration": return {
        value: metrics.incomingResidents === null || metrics.integrationIndex === null
          ? null
          : Math.min(5, metrics.incomingResidents, (metrics.integrationIndex / 60) * 5),
        available: metrics.incomingResidents !== null && metrics.integrationIndex !== null
      };
      default: return { value: null, available: false };
    }
  }

  function updateMilestones(state, metrics) {
    const output = [];
    for (const definition of MILESTONE_DEFINITIONS) {
      const progress = milestoneProgress(definition.id, state, metrics);
      const achievedNow = progress.available && progress.value !== null && progress.value >= definition.goal;
      const previous = state.milestones[definition.id];
      const achieved = Boolean(previous?.achieved || achievedNow);
      const record = {
        id: definition.id,
        title: definition.title,
        description: definition.description,
        goal: definition.goal,
        progress: progress.value === null ? null : round1(progress.value),
        available: progress.available,
        achieved,
        achievedAtMonth: previous?.achievedAtMonth ?? (achievedNow ? state.currentMonth : null),
        unit: definition.metric === "populationGrowthPercent" ? "%" : definition.metric === "qolCoverage" ? "dimensões" : ""
      };
      state.milestones[definition.id] = record;
      output.push(record);
    }
    return output;
  }

  function buildRecommendations(metrics, state, milestones) {
    const items = [];
    if (state.trends.deficitMonths >= 2) items.push({
      id: "review_public_accounts", priority: "high", area: "government", title: "Revisar as contas públicas",
      reason: "O resultado fiscal permaneceu negativo por dois fechamentos consecutivos.",
      nextStep: "Examine receitas, despesas e obrigações antes de assumir novos gastos permanentes.",
      evidence: { consecutiveDeficitMonths: state.trends.deficitMonths, fiscalResult: metrics.fiscalResult }
    });
    if (state.trends.qolDropMonths >= 2 || (metrics.qolScore !== null && metrics.qolScore < 40 && metrics.qolCoverage >= 3)) items.push({
      id: "investigate_wellbeing", priority: "high", area: "society", title: "Investigar a queda no bem-estar",
      reason: "As dimensões disponíveis indicam deterioração ou nível baixo de qualidade de vida.",
      nextStep: "Confira renda, emprego, moradia e as dimensões sociais que possuem dados observados.",
      evidence: { score: metrics.qolScore, latestChange: metrics.qolChange, measuredDimensions: metrics.qolCoverage }
    });
    if (metrics.migrationNet !== null && metrics.migrationNet <= -2) items.push({
      id: "investigate_outflow", priority: "medium", area: "society", title: "Entender por que moradores estão saindo",
      reason: "Houve saída líquida de moradores neste mês.",
      nextStep: "Compare emprego, remuneração, moradia e qualidade de vida. O saldo migratório, sozinho, não prova a causa.",
      evidence: { incoming: metrics.migrationIncoming, outgoing: metrics.migrationOutgoing, net: metrics.migrationNet }
    });
    if (state.trends.weakCoalitionMonths >= 2) items.push({
      id: "build_government_majority", priority: "medium", area: "government", title: "Fortalecer a base de governo",
      reason: "A coalizão está ausente ou não alcança maioria há dois fechamentos.",
      nextStep: "Examine a composição da Câmara, os grupos de apoio e as condições para negociar uma coalizão.",
      evidence: { coalitionStatus: metrics.coalitionStatus, coalitionSeats: metrics.coalitionSeats, majoritySeats: metrics.majoritySeats }
    });
    if (state.trends.servicePressureMonths >= 2) items.push({
      id: "review_public_services", priority: "high", area: "services", title: "Revisar os serviços públicos",
      reason: "A média dos índices de satisfação das áreas públicas permaneceu abaixo de 38.",
      nextStep: "Identifique as áreas com menor satisfação e examine suas alavancas e dependências. Os índices não representam despesas executadas.",
      evidence: { serviceAverage: metrics.serviceAverage, serviceCoverage: metrics.serviceCoverage, lowestService: metrics.lowestService }
    });
    if (metrics.qolScore === null || metrics.qolCoverage === null || metrics.qolCoverage < 3) items.push({
      id: "improve_social_measurement", priority: "low", area: "society", title: "Ampliar a leitura social",
      reason: "Ainda não há cobertura suficiente para avaliar a qualidade de vida com segurança.",
      nextStep: "Acompanhe os dados de emprego, renda, moradia e bem-estar das famílias.",
      evidence: { score: metrics.qolScore, measuredDimensions: metrics.qolCoverage }
    });
    const priorityRank = { high: 0, medium: 1, low: 2 };
    return items.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]).slice(0, 4);
  }

  function createSnapshot(state, metrics = null) {
    const current = metrics || state.previous || {};
    const milestones = MILESTONE_DEFINITIONS.map((definition) => state.milestones[definition.id]).filter(Boolean);
    return {
      version: VERSION,
      sessionId: state.sessionId,
      currentMonth: state.currentMonth,
      indicators: clone(current),
      trends: clone(state.trends),
      events: clone(state.events.slice(-12)),
      milestones,
      recommendations: current.monthNumber ? buildRecommendations(current, state, milestones) : [],
      history: clone(state.history.slice(-HISTORY_LIMIT)),
      coverage: {
        population: current.population !== null && current.population !== undefined,
        fiscal: current.fiscalResult !== null && current.fiscalResult !== undefined,
        qualityOfLife: current.qolScore !== null && current.qolCoverage !== null,
        migration: current.migrationNet !== null && current.migrationNet !== undefined
      },
      limitations: [
        "Esta camada observa os módulos existentes. Ela não altera caixa, preços, emprego ou serviços públicos.",
        "Recomendações orientam a análise do jogador; ainda não são ações executáveis.",
        "Ausência de indicador significa dado indisponível, não resultado igual a zero."
      ]
    };
  }

  function createEngine(options = {}) {
    let state = createState(options);

    function setBaseline(population) {
      const value = numberOr(population);
      if (state.currentMonth === 0 && state.baselinePopulation === null && value !== null && value >= 0) state.baselinePopulation = value;
      return state.baselinePopulation;
    }

    function processMonth(payload = {}, snapshots = {}) {
      const metrics = normalizeMetrics(payload, snapshots);
      if (!Number.isSafeInteger(metrics.monthNumber) || metrics.monthNumber < 1) throw new TypeError("O fechamento precisa informar monthNumber inteiro e positivo.");
      if (metrics.monthNumber <= state.currentMonth) return { unchanged: true, snapshot: getSnapshot() };
      if (state.currentMonth > 0 && metrics.monthNumber !== state.currentMonth + 1) {
        throw new RangeError(`Fechamento fora de sequência: esperado ${state.currentMonth + 1}, recebido ${metrics.monthNumber}.`);
      }
      if (state.baselinePopulation === null && metrics.population !== null) state.baselinePopulation = metrics.population;
      state.currentMonth = metrics.monthNumber;
      ingestEconomyEvents(state, metrics);
      ingestSocietyEvents(state, metrics);
      evaluateSignals(state, metrics);
      const milestones = updateMilestones(state, metrics);
      state.previous = clone(metrics);
      state.history.push({
        monthNumber: metrics.monthNumber,
        day: metrics.day,
        population: metrics.population,
        gdp: metrics.gdp,
        fiscalResult: metrics.fiscalResult,
        migrationNet: metrics.migrationNet,
        qolScore: metrics.qolScore,
        qolChange: metrics.qolChange,
        measuredDimensions: metrics.qolCoverage
      });
      if (state.history.length > HISTORY_LIMIT) state.history.shift();
      const snapshot = createSnapshot(state, metrics);
      state.lastSnapshot = snapshot;
      return { unchanged: false, events: clone(state.events.filter((event) => event.month === metrics.monthNumber)), milestones, snapshot };
    }

    function reset(resetOptions = {}) {
      state = createState({ ...options, ...resetOptions });
      return getSnapshot();
    }

    function serialize() {
      return JSON.stringify({ schema: VERSION, state });
    }

    function restore(serialized) {
      const parsed = typeof serialized === "string" ? JSON.parse(serialized) : clone(serialized);
      if (!parsed || parsed.schema !== VERSION || !parsed.state || parsed.state.version !== VERSION) {
        throw new TypeError("Arquivo do Mundo Vivo incompatível.");
      }
      const candidate = parsed.state;
      if (
        !Number.isSafeInteger(candidate.currentMonth) || candidate.currentMonth < 0 ||
        !Array.isArray(candidate.events) || candidate.events.length > EVENT_LIMIT ||
        !Array.isArray(candidate.history) || candidate.history.length > HISTORY_LIMIT ||
        !candidate.trends || typeof candidate.trends !== "object" || Array.isArray(candidate.trends) ||
        !candidate.milestones || typeof candidate.milestones !== "object" || Array.isArray(candidate.milestones) ||
        !candidate.cooldowns || typeof candidate.cooldowns !== "object" || Array.isArray(candidate.cooldowns) ||
        !Array.isArray(candidate.knownSourceEvents) || candidate.knownSourceEvents.length > EVENT_LIMIT * 2
      ) {
        throw new TypeError("Estado do Mundo Vivo inválido.");
      }
      state = clone(candidate);
      return getSnapshot();
    }

    function getSnapshot() {
      return createSnapshot(state);
    }

    return Object.freeze({
      processMonth,
      setBaseline,
      reset,
      serialize,
      restore,
      getSnapshot
    });
  }

  function readModuleSnapshots(runtime) {
    const read = (id) => runtime.modules.get(id)?.snapshot || null;
    return {
      sociedade: read("sociedade"),
      politica: read("politica"),
      instituicoes: read("instituicoes"),
      servicos: read("servicos")
    };
  }

  function registerWithRuntime(runtime, options = {}) {
    if (!runtime?.modules || !runtime?.events || typeof runtime.publish !== "function") {
      throw new TypeError("Runtime incompleto para registrar o Mundo Vivo.");
    }
    if (!runtime.modules.has("core") || !runtime.modules.has("economia")) {
      throw new Error("Mundo Vivo exige Core e Economia.");
    }
    if (runtime.modules.has(MODULE_ID)) return { alreadyRegistered: true, engine: null, dispose() {} };

    const dependencies = ["core", "economia", "sociedade", "politica", "instituicoes", "servicos"]
      .filter((id) => runtime.modules.has(id));
    runtime.modules.register({
      id: MODULE_ID,
      version: VERSION,
      name: "Mundo Vivo",
      dependencies,
      description: "Leitura causal de tendências, acontecimentos, marcos e recomendações a partir dos snapshots publicados pelos módulos."
    });

    const sessionId = runtime.session?.get?.().id || "session-unknown";
    const initialSociety = runtime.modules.get("sociedade")?.snapshot || {};
    const initialPopulation = initialSociety.demographic?.population ?? runtime.population?.getSnapshot?.().totals?.total ?? null;
    const engine = createEngine({ sessionId, baselinePopulation: initialPopulation });
    const rootWindow = options.window || (typeof window !== "undefined" ? window : null);
    const getHost = () => options.host || rootWindow?.document?.getElementById?.("worldDashboard") || null;
    const publish = (source) => {
      const snapshot = engine.getSnapshot();
      runtime.modules.updateSnapshot(MODULE_ID, snapshot, source);
      if (getHost()) renderDashboard(snapshot, getHost(), rootWindow);
      return snapshot;
    };

    const unsubs = [];
    unsubs.push(runtime.events.on("game:reset", (event) => {
      const nextSessionId = event?.payload?.sessionId || runtime.session?.get?.().id || "session-unknown";
      engine.reset({ sessionId: nextSessionId, baselinePopulation: null });
      publish("mundo_vivo.reset");
    }));
    unsubs.push(runtime.events.on("world:synchronized", () => {
      const society = runtime.modules.get("sociedade")?.snapshot || {};
      engine.setBaseline(society.demographic?.population ?? runtime.population?.getSnapshot?.().totals?.total);
      publish("mundo_vivo.baseline");
    }));
    unsubs.push(runtime.events.on("economy:month-closed", (event) => {
      const payload = event?.payload || {};
      const snapshots = readModuleSnapshots(runtime);
      const result = engine.processMonth(payload, snapshots);
      if (result.unchanged) return;
      const snapshot = publish("mundo_vivo.month-closed");
      runtime.publish("world:month-closed", {
        monthNumber: snapshot.currentMonth,
        eventCount: result.events.length,
        milestonesAchieved: result.milestones.filter((milestone) => milestone.achieved && milestone.achievedAtMonth === snapshot.currentMonth).map((milestone) => milestone.id),
        snapshot
      }, "mundo_vivo");
    }));

    publish("mundo_vivo.initial");
    return {
      alreadyRegistered: false,
      engine,
      getSnapshot: () => engine.getSnapshot(),
      dispose() { unsubs.forEach((unsubscribe) => unsubscribe()); }
    };
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function formatMetric(value, suffix = "") {
    if (!finite(value)) return "Sem dados";
    return `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${suffix}`;
  }

  function renderDashboard(snapshot, host, windowRef = null) {
    if (!snapshot || !host) return false;
    const metrics = snapshot.indicators || {};
    const events = [...(snapshot.events || [])].slice(-4).reverse();
    const milestones = snapshot.milestones || [];
    const recommendations = snapshot.recommendations || [];
    const achievedCount = milestones.filter((item) => item.achieved).length;
    const coalitionLabels = { majority: "Maioria", minority: "Minoria", not_formed: "Não formada" };
    const metricCards = [
      ["Moradores", formatMetric(metrics.population)],
      ["Qualidade de vida", formatMetric(metrics.qolScore, "/100")],
      ["Saldo migratório", formatMetric(metrics.migrationNet)],
      ["Resultado fiscal", finite(metrics.fiscalResult) ? `R$ ${Math.round(metrics.fiscalResult).toLocaleString("pt-BR")}` : "Sem dados"],
      ["Coalizão", coalitionLabels[metrics.coalitionStatus] || "Sem dados"],
      ["Serviços públicos", formatMetric(metrics.serviceAverage, "/100")]
    ].map(([label, value]) => `<div class="world-live-metric"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join("");

    const eventRows = events.length ? events.map((event) => `
      <li class="world-live-event world-severity-${escapeHtml(event.severity)}">
        <div><span class="world-live-period">MÊS ${event.month} · ${escapeHtml(event.category)}</span><strong>${escapeHtml(event.title)}</strong></div>
        <p>${escapeHtml(event.narrative)}</p>
        <small>Base: ${escapeHtml(event.source)}</small>
      </li>`).join("") : '<li class="world-live-empty">Nenhum sinal novo foi identificado. O motor aguarda os próximos fechamentos.</li>';

    const milestoneRows = milestones.map((item) => {
      const status = item.achieved ? "Conquistado" : item.available ? "Em acompanhamento" : "Aguardando dados";
      const pct = item.progress === null ? null : clamp(item.progress / item.goal * 100, 0, 100);
      return `<li class="world-live-milestone ${item.achieved ? "is-achieved" : ""}">
        <div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(status)}</span></div>
        <p>${escapeHtml(item.description)}</p>
        <div class="world-live-progress" aria-label="${escapeHtml(status)}"><i${pct === null ? " class=\"is-unknown\"" : ` style="width:${pct.toFixed(1)}%"`}></i></div>
      </li>`;
    }).join("");

    const recommendationRows = recommendations.length ? recommendations.map((item) => `
      <article class="world-live-recommendation world-priority-${escapeHtml(item.priority)}">
        <div><span>${escapeHtml(item.area.toUpperCase())} · ${escapeHtml(item.priority.toUpperCase())}</span><strong>${escapeHtml(item.title)}</strong></div>
        <p>${escapeHtml(item.reason)}</p><small>${escapeHtml(item.nextStep)}</small>
        <button type="button" data-world-target="${escapeHtml(item.area)}">Abrir ${item.area === "government" ? "Governo" : item.area === "society" ? "Sociedade" : item.area === "services" ? "Serviços" : "Economia"}</button>
      </article>`).join("") : '<p class="world-live-empty">Nenhuma prioridade automática neste fechamento. Continue acompanhando os indicadores.</p>';

    host.innerHTML = `
      <section class="world-live-dashboard" aria-label="Mundo vivo e desenvolvimento da comunidade">
        <header class="world-live-header"><div><div class="eyebrow">LEITURA DO MUNDO</div><h2>O mundo está reagindo às decisões.</h2><p>Fechamento ${snapshot.currentMonth || 0} · sinais observados nos módulos existentes, sem alterar a Economia.</p></div><div class="world-live-achievement-count"><strong>${achievedCount}/${milestones.length}</strong><span>marcos conquistados</span></div></header>
        <div class="world-live-metrics">${metricCards}</div>
        <div class="world-live-columns">
          <section class="world-live-block"><h3>Acontecimentos e tendências</h3><ul class="world-live-events">${eventRows}</ul></section>
          <section class="world-live-block"><h3>Marcos de desenvolvimento</h3><ul class="world-live-milestones">${milestoneRows}</ul></section>
        </div>
        <section class="world-live-block world-live-decisions"><div><h3>Decisões que merecem atenção</h3><p>São recomendações de análise, não comandos automáticos.</p></div><div class="world-live-recommendations">${recommendationRows}</div></section>
        <p class="world-live-footnote">${escapeHtml(snapshot.limitations?.[0] || "Indicadores indisponíveis não são tratados como zero.")}</p>
      </section>`;

    host.querySelectorAll?.("[data-world-target]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.worldTarget;
        if (windowRef?.VilarejoDashboard?.setView) windowRef.VilarejoDashboard.setView(target);
      });
    });
    return true;
  }

  return Object.freeze({
    VERSION,
    MODULE_ID,
    EVENT_RULES: clone(EVENT_RULES),
    MILESTONE_DEFINITIONS: clone(MILESTONE_DEFINITIONS),
    createState,
    createEngine,
    registerWithRuntime,
    renderDashboard
  });
});

if (typeof window !== "undefined" && window.VilarejoRuntime && window.VilarejoWorld) {
  try {
    window.VilarejoWorldRuntime = window.VilarejoWorld.registerWithRuntime(window.VilarejoRuntime, { window });
  } catch (error) {
    window.console?.error?.("Falha ao registrar Mundo Vivo:", error);
  }
}
