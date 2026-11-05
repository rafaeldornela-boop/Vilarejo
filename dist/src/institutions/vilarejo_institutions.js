(function attachVilarejoInstitutions(root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.VilarejoInstitutions = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createVilarejoInstitutions(root) {
  "use strict";

  const VERSION = "1.0.0";
  const HISTORY_LIMIT = 36;
  const EVENT_LIMIT = 120;
  const DEFAULT_SEATS = 21;
  const DEFAULT_TERM_MONTHS = 48;

  const BILL_CATALOG = Object.freeze([
    {
      id: "pl_social_housing",
      code: "PL 01/2026",
      title: "Marco da Habitação Social e Isenção de IPTU",
      description: "Destina lotes públicos para mutirões comunitários e isenta famílias de baixa renda da taxa habitacional.",
      category: "social",
      phase: 1,
      phaseLabel: "Fase 1: Povoado Inicial",
      author: "Bancada dos Trabalhadores & População Vulnerável",
      status: "pending",
      cost: 1500,
      requirements: { description: "Livre para deliberação inicial da comunidade" },
      impacts: {
        housingCapacity: 4,
        satisfaction: { workers: 12, vulnerable: 15, business: -3 },
        summary: "+4 vagas de habitação popular; +12% satisfação de trabalhadores; +15% população vulnerável; -3% empresariado."
      },
      supportBiases: { workers: 1.0, vulnerable: 1.0, middle_class: 0.3, business: -0.4, landowners: -0.6 }
    },
    {
      id: "pl_coop_fiscal",
      code: "PL 02/2026",
      title: "Estatuto Municipal do Cooperativismo e Compras Públicas",
      description: "Estabelece preferência da merenda escolar para a agricultura familiar e confere incentivo fiscal à agroindústria cooperativa.",
      category: "cooperative",
      phase: 1,
      phaseLabel: "Fase 1: Povoado Inicial",
      author: "Bancada dos Produtores Rurais & Comerciantes",
      status: "pending",
      cost: 1000,
      requirements: { description: "Livre para deliberação inicial da comunidade" },
      impacts: {
        cooperativeTfp: 0.15,
        satisfaction: { rural_producers: 14, workers: 8, finance: -2 },
        summary: "+15% produtividade da cooperativa agroartesanal; compras da agricultura familiar; +14% apoio rural."
      },
      supportBiases: { rural_producers: 1.0, workers: 0.6, merchants: 0.4, finance: -0.3, business: 0.2 }
    },
    {
      id: "pl_business_incentive",
      code: "PL 03/2026",
      title: "Lei de Liberdade Econômica e Desoneração do Comércio Local",
      description: "Reduz tributos sobre faturamento mercantil e desburocratiza a abertura de novos estabelecimentos comerciais.",
      category: "market",
      phase: 1,
      phaseLabel: "Fase 1: Povoado Inicial",
      author: "Bancada do Empresariado & Comerciantes",
      status: "pending",
      cost: 800,
      requirements: { description: "Livre para deliberação inicial da comunidade" },
      impacts: {
        businessTfp: 0.12,
        satisfaction: { business: 16, merchants: 14, workers: -4 },
        summary: "+12% produtividade do comércio e oficina; desburocratização mercantil; +16% empresários; +14% comerciantes."
      },
      supportBiases: { business: 1.0, merchants: 1.0, finance: 0.6, landowners: 0.4, workers: -0.5, vulnerable: -0.4 }
    },
    {
      id: "pl_environmental_springs",
      code: "PL 04/2026",
      title: "Código de Preservação Hídrica e Manejo Agroflorestal",
      description: "Delimita áreas de preservação permanente ao longo dos rios do vilarejo contra assoreamento e contaminação hídrica.",
      category: "environment",
      phase: 2,
      phaseLabel: "Fase 2: Vila em Expansão",
      author: "Frente Parlamentar Ambientalista",
      status: "pending",
      cost: 1200,
      requirements: {
        minPopulation: 14,
        minTreasury: 3000,
        description: "Exige População ≥ 14 moradores e Caixa do Tesouro ≥ R$ 3.000"
      },
      impacts: {
        environmentalQuality: 20,
        satisfaction: { environmentalists: 20, middle_class: 6, landowners: -10, rural_producers: -6 },
        summary: "+20 pontos de qualidade ambiental; proteção de mananciais; -10% grandes proprietários de terra."
      },
      supportBiases: { environmentalists: 1.0, middle_class: 0.5, workers: 0.2, landowners: -0.8, rural_producers: -0.6 }
    },
    {
      id: "pl_urban_logistics",
      code: "PL 05/2026",
      title: "Fundo Especial de Pavimentação Viária e Iluminação",
      description: "Vincula receitas públicas para pavimentação de vias produtivas, iluminação urbana e saneamento básico.",
      category: "infrastructure",
      phase: 2,
      phaseLabel: "Fase 2: Vila em Expansão",
      author: "Poder Executivo",
      status: "pending",
      cost: 2500,
      requirements: {
        minPopulation: 16,
        minTreasury: 5000,
        description: "Exige População ≥ 16 moradores e Caixa do Tesouro ≥ R$ 5.000"
      },
      impacts: {
        infrastructureCapacity: 10,
        satisfaction: { merchants: 10, workers: 10, middle_class: 8, business: 8 },
        summary: "+10 de capacidade urbana e logística; vias pavimentadas; +10% comerciantes e trabalhadores; +8% classe média."
      },
      supportBiases: { merchants: 0.8, business: 0.7, workers: 0.7, middle_class: 0.7, rural_producers: 0.6, landowners: 0.5 }
    },
    {
      id: "pl_public_health_family",
      code: "PL 06/2027",
      title: "Programa Saúde da Família e Saneamento Preventivo",
      description: "Instala equipe de saúde preventiva nos bairros e rede sanitária contra doenças infecciosas e mortalidade infantil.",
      category: "social",
      phase: 2,
      phaseLabel: "Fase 2: Vila em Expansão",
      author: "Comissão de Serviços Públicos & Cidadania",
      status: "pending",
      cost: 3200,
      requirements: {
        minPopulation: 18,
        requiresLaw: "pl_social_housing",
        description: "Exige População ≥ 18 moradores e prévia aprovação do Marco da Habitação Social (PL 01)"
      },
      impacts: {
        healthAccess: 25,
        satisfaction: { vulnerable: 20, workers: 14, public_servants: 12, business: -4 },
        summary: "+25 pontos em saúde pública; atendimento domiciliar preventivo; +20% vulneráveis; +14% trabalhadores."
      },
      supportBiases: { vulnerable: 1.0, workers: 0.8, public_servants: 0.8, middle_class: 0.5, business: -0.3 }
    },
    {
      id: "pl_vocational_education",
      code: "PL 07/2027",
      title: "Escola Técnica Municipal e Qualificação Profissional",
      description: "Cria centro de formação técnica para capacitação de mão de obra em agroindústria, mecânica e comércio local.",
      category: "education",
      phase: 3,
      phaseLabel: "Fase 3: Cidade Consolidada",
      author: "Poder Executivo & Bancada do Comércio",
      status: "pending",
      cost: 3800,
      requirements: {
        minPopulation: 22,
        minTreasury: 8000,
        requiresLaw: "pl_urban_logistics",
        description: "Exige População ≥ 22 moradores, Tesouro ≥ R$ 8.000 e Fundo de Pavimentação (PL 05)"
      },
      impacts: {
        educationAccess: 20,
        laborProductivity: 0.15,
        satisfaction: { middle_class: 15, workers: 14, business: 12 },
        summary: "+20 pontos em educação; +15% de qualificação e produtividade dos trabalhadores; apoio amplo de classes."
      },
      supportBiases: { middle_class: 0.9, workers: 0.9, business: 0.8, merchants: 0.7, public_servants: 0.6 }
    },
    {
      id: "pl_industrial_park",
      code: "PL 08/2028",
      title: "Distrito Industrial Municipal e Inovação Tecnológica",
      description: "Destina gleba para atração de indústrias de transformação, armazéns logísticos e cooperativas de processamento avançado.",
      category: "market",
      phase: 3,
      phaseLabel: "Fase 3: Cidade Consolidada",
      author: "Bancada do Empresariado & Produtores Rurais",
      status: "pending",
      cost: 6000,
      requirements: {
        minPopulation: 25,
        minTreasury: 12000,
        requiresLaw: "pl_coop_fiscal",
        description: "Exige População ≥ 25 moradores, Tesouro ≥ R$ 12.000 e Estatuto do Cooperativismo (PL 02)"
      },
      impacts: {
        industrialCapacity: 20,
        businessTfp: 0.18,
        cooperativeTfp: 0.15,
        satisfaction: { business: 25, rural_producers: 18, merchants: 15, workers: 10 },
        summary: "+20 capacidade industrial; +18% TFP de empresas; +15% TFP cooperativa; +25% apoio do empresariado."
      },
      supportBiases: { business: 1.0, rural_producers: 0.8, merchants: 0.8, finance: 0.7, workers: 0.5, environmentalists: -0.5 }
    }
  ]);

  const CAMPAIGN_PLATFORMS = Object.freeze([
    {
      id: "social_solidarity",
      title: "Vilarejo Solidário e Humano",
      subtitle: "Habitação, Salários Dignos e Serviços Essenciais",
      stance: "social",
      appeal: { workers: 25, vulnerable: 30, public_servants: 15, middle_class: 5, business: -10, finance: -15 },
      slogan: "Crescer cuidando de quem mais precisa e garantindo teto e dignidade."
    },
    {
      id: "market_enterprise",
      title: "Vilarejo Empreendedor e Aberto",
      subtitle: "Desoneração, Fomento aos Negócios e Competitividade",
      stance: "market",
      appeal: { business: 30, merchants: 25, finance: 20, landowners: 15, middle_class: 10, workers: -10, vulnerable: -15 },
      slogan: "Liberdade para produzir, investir e gerar empregos."
    },
    {
      id: "cooperative_agro",
      title: "Vilarejo Cooperativo e Sustentável",
      subtitle: "Agricultura Familiar, Agroecologia e Força Comunitária",
      stance: "cooperative",
      appeal: { rural_producers: 30, environmentalists: 25, workers: 12, middle_class: 10, finance: -5, landowners: -8 },
      slogan: "União comunitária e respeito à terra, do plantio à mesa."
    }
  ]);

  const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const numberOr = (value, fallback = 0) => finite(value) ? Number(value) : fallback;
  const clampInt = (value, min, max) => Math.max(min, Math.min(max, Math.floor(numberOr(value, min))));
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const text = (value, fallback = "") => String(value ?? fallback);
  const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;

  function createState(options = {}) {
    const totalSeats = clampInt(options.totalSeats ?? DEFAULT_SEATS, 1, 500);
    const termMonths = clampInt(options.termMonths ?? DEFAULT_TERM_MONTHS, 1, 240);
    const startMonth = Math.max(0, Math.floor(numberOr(options.startMonth, 0)));
    return {
      version: VERSION,
      stateModel: "sui_generis_state",
      currentMonth: startMonth,
      lastProcessedMonth: null,
      nextElectionMonth: startMonth + termMonths,
      termNumber: 1,
      settings: {
        totalSeats,
        termMonths,
        quorumFraction: 0.5,
        majorityFraction: 0.5
      },
      executive: {
        institutionId: "executive",
        name: "Governo do Estado",
        headOfGovernment: "Jogador",
        playerControlled: true,
        status: "active"
      },
      legislature: {
        institutionId: "legislature",
        name: "Câmara de Representação dos Interesses",
        totalSeats,
        quorumSeats: Math.floor(totalSeats * 0.5) + 1,
        majoritySeats: Math.floor(totalSeats * 0.5) + 1,
        allocatedSeats: 0,
        vacantSeats: totalSeats,
        groups: [],
        seats: []
      },
      coalition: {
        groupIds: [],
        seats: 0,
        majority: false,
        status: "not_formed",
        formedMonth: null,
        leaderGroupId: null
      },
      opposition: { groupIds: [], seats: 0 },
      history: [],
      events: [],
      nextEventId: 1,
      lastPoliticsSnapshot: null,
      bills: clone(BILL_CATALOG),
      enactedLaws: [],
      campaign: {
        active: false,
        platformId: null,
        polling: []
      }
    };
  }

  function ensureState(state) {
    if (!state || state.version !== VERSION || !state.legislature || !Array.isArray(state.legislature.groups)) {
      throw new TypeError(`Estado institucional inválido. Esperado schema ${VERSION}.`);
    }
    return state;
  }

  function pushEvent(state, event) {
    const record = { ...clone(event), id: `inst-${state.nextEventId++}` };
    state.events.push(record);
    if (state.events.length > EVENT_LIMIT) state.events.splice(0, state.events.length - EVENT_LIMIT);
    return record;
  }

  function groupRowsFromPolitics(snapshot) {
    return (Array.isArray(snapshot?.groups) ? snapshot.groups : []).map((group) => ({
      groupId: text(group.id),
      groupName: text(group.name, group.id),
      influence: Math.max(0, numberOr(group.influence)),
      satisfaction: numberOr(group.satisfaction, 50),
      governmentRelation: ["support", "neutral", "opposition"].includes(group.governmentRelation)
        ? group.governmentRelation : "neutral",
      representativity: finite(group.representativity) ? numberOr(group.representativity) : null,
      measurementStatus: text(group.measurement?.status, "unavailable"),
      interests: Array.isArray(group.interests) ? group.interests.map(String) : []
    }));
  }

  // Método de maiores restos (Hamilton). Distribui todas as cadeiras sem
  // arredondamento acumulado e mantém o total exato da Câmara.
  function allocateSeats(groups, totalSeats) {
    const seats = Math.max(1, Math.floor(numberOr(totalSeats, DEFAULT_SEATS)));
    if (!groups.length) return [];
    const weights = groups.map((group) => Math.max(0, numberOr(group.influence)));
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);
    const normalized = weightTotal > 0 ? weights : groups.map(() => 1);
    const denominator = normalized.reduce((sum, value) => sum + value, 0);
    const rows = groups.map((group, index) => {
      const quota = denominator > 0 ? (seats * normalized[index]) / denominator : seats / groups.length;
      const baseSeats = Math.floor(quota);
      return { ...clone(group), seats: baseSeats, quota, remainder: quota - baseSeats };
    });
    let remaining = seats - rows.reduce((sum, row) => sum + row.seats, 0);
    const ranking = rows.map((row, index) => ({ index, remainder: row.remainder, influence: row.influence, id: row.groupId }))
      .sort((a, b) => b.remainder - a.remainder || b.influence - a.influence || a.id.localeCompare(b.id));
    for (let i = 0; i < remaining; i += 1) rows[ranking[i % ranking.length].index].seats += 1;
    return rows.map(({ quota, remainder, ...row }) => ({ ...row, share: round1(row.seats / seats * 100) }));
  }

  function buildSeatRows(groupRows, distribution) {
    const result = [];
    let index = 1;
    for (const group of distribution) {
      for (let n = 1; n <= group.seats; n += 1) {
        result.push({
          seatId: `seat-${String(index).padStart(3, "0")}`,
          number: index,
          groupId: group.groupId,
          groupName: group.groupName,
          mandateLabel: `Representação ${n}`
        });
        index += 1;
      }
    }
    return result;
  }

  function recalculateRepresentation(state, politicsSnapshot, options = {}) {
    ensureState(state);
    const sourceGroups = groupRowsFromPolitics(politicsSnapshot);
    const distribution = allocateSeats(sourceGroups, state.settings.totalSeats);
    state.legislature.groups = distribution;
    state.legislature.seats = buildSeatRows(sourceGroups, distribution);
    state.legislature.totalSeats = state.settings.totalSeats;
    state.legislature.allocatedSeats = distribution.reduce((sum, group) => sum + group.seats, 0);
    state.legislature.vacantSeats = Math.max(0, state.settings.totalSeats - state.legislature.allocatedSeats);
    state.legislature.quorumSeats = Math.floor(state.settings.totalSeats * state.settings.quorumFraction) + 1;
    state.legislature.majoritySeats = Math.floor(state.settings.totalSeats * state.settings.majorityFraction) + 1;
    state.lastPoliticsSnapshot = clone(politicsSnapshot || null);
    if (options.month !== undefined) state.currentMonth = Math.max(state.currentMonth, Math.floor(numberOr(options.month)));
    updateCoalitionAccounting(state);
    pushEvent(state, {
      type: "representation_recalculated",
      month: state.currentMonth,
      totalSeats: state.settings.totalSeats,
      groups: distribution.map((group) => ({ groupId: group.groupId, seats: group.seats })),
      reason: text(options.reason, "Composição institucional inicializada ou renovada.")
    });
    return getSnapshot(state);
  }

  function refreshGroupMetadata(state, politicsSnapshot) {
    const incoming = groupRowsFromPolitics(politicsSnapshot);
    const byId = new Map(incoming.map((group) => [group.groupId, group]));
    state.legislature.groups = state.legislature.groups.map((current) => {
      const latest = byId.get(current.groupId);
      return latest ? { ...current, ...latest, seats: current.seats, share: current.share } : current;
    });
    state.lastPoliticsSnapshot = clone(politicsSnapshot || null);
    updateCoalitionAccounting(state);
  }

  function updateCoalitionAccounting(state) {
    const groups = state.legislature.groups;
    const byId = new Map(groups.map((group) => [group.groupId, group]));
    state.coalition.groupIds = [...new Set(state.coalition.groupIds)].filter((id) => byId.has(id));
    const coalitionGroups = state.coalition.groupIds.map((id) => byId.get(id));
    state.coalition.seats = coalitionGroups.reduce((sum, group) => sum + group.seats, 0);
    state.coalition.majority = state.coalition.seats >= state.legislature.majoritySeats;
    state.coalition.status = state.coalition.groupIds.length === 0
      ? "not_formed"
      : state.coalition.majority ? "majority" : "minority";
    const leader = coalitionGroups.slice().sort((a, b) => b.seats - a.seats || b.influence - a.influence || a.groupId.localeCompare(b.groupId))[0];
    state.coalition.leaderGroupId = leader ? leader.groupId : null;

    const coalitionIds = new Set(state.coalition.groupIds);
    const oppositionGroups = groups.filter((group) => group.governmentRelation === "opposition" && !coalitionIds.has(group.groupId));
    state.opposition = {
      groupIds: oppositionGroups.map((group) => group.groupId),
      seats: oppositionGroups.reduce((sum, group) => sum + group.seats, 0)
    };
    return state.coalition;
  }

  function setCoalition(state, groupIds, options = {}) {
    ensureState(state);
    if (!Array.isArray(groupIds)) throw new TypeError("A coalizão precisa ser informada como uma lista de grupos.");
    const available = new Set(state.legislature.groups.map((group) => group.groupId));
    const selected = [...new Set(groupIds.map(String))];
    const unknown = selected.filter((id) => !available.has(id));
    if (unknown.length) throw new Error(`Grupos inexistentes na Câmara: ${unknown.join(", ")}`);
    state.coalition.groupIds = selected;
    state.coalition.formedMonth = finite(options.month) ? Number(options.month) : state.currentMonth;
    updateCoalitionAccounting(state);
    pushEvent(state, {
      type: "coalition_updated",
      month: state.coalition.formedMonth,
      groupIds: selected,
      seats: state.coalition.seats,
      majority: state.coalition.majority,
      message: selected.length ? "A base de apoio do governo foi atualizada." : "A coalizão do governo foi dissolvida."
    });
    return clone(state.coalition);
  }

  function dissolveCoalition(state, options = {}) {
    return setCoalition(state, [], options);
  }

  function setInstitutionalSettings(state, changes = {}) {
    ensureState(state);
    const totalSeats = changes.totalSeats === undefined ? state.settings.totalSeats : clampInt(changes.totalSeats, 1, 500);
    const termMonths = changes.termMonths === undefined ? state.settings.termMonths : clampInt(changes.termMonths, 1, 240);
    const quorumFraction = changes.quorumFraction === undefined ? state.settings.quorumFraction : Math.max(0.1, Math.min(1, numberOr(changes.quorumFraction, 0.5)));
    const majorityFraction = changes.majorityFraction === undefined ? state.settings.majorityFraction : Math.max(0.1, Math.min(1, numberOr(changes.majorityFraction, 0.5)));
    state.settings = { totalSeats, termMonths, quorumFraction, majorityFraction };
    state.legislature.totalSeats = totalSeats;
    state.legislature.quorumSeats = Math.floor(totalSeats * quorumFraction) + 1;
    state.legislature.majoritySeats = Math.floor(totalSeats * majorityFraction) + 1;
    state.nextElectionMonth = Math.max(state.currentMonth, state.currentMonth + termMonths);
    if (state.lastPoliticsSnapshot) recalculateRepresentation(state, state.lastPoliticsSnapshot, { reason: "Parâmetros institucionais alterados." });
    return clone(state.settings);
  }

  function captureHistory(state, month, eventType = "monthly_update") {
    const snapshot = {
      month,
      termNumber: state.termNumber,
      totalSeats: state.legislature.totalSeats,
      majoritySeats: state.legislature.majoritySeats,
      coalitionSeats: state.coalition.seats,
      coalitionStatus: state.coalition.status,
      groups: state.legislature.groups.map((group) => ({ groupId: group.groupId, seats: group.seats, influence: group.influence, governmentRelation: group.governmentRelation }))
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
    if (state.lastProcessedMonth === month) return { unchanged: true, snapshot: getSnapshot(state), electionHeld: false };
    if (state.lastProcessedMonth !== null && month < state.lastProcessedMonth) throw new RangeError("O módulo institucional não pode retroceder no calendário.");
    if (options.politicsSnapshot) refreshGroupMetadata(state, options.politicsSnapshot);
    let electionHeld = false;
    if (month >= state.nextElectionMonth) {
      state.termNumber += 1;
      state.nextElectionMonth = month + state.settings.termMonths;
      if (options.politicsSnapshot) {
        recalculateRepresentation(state, options.politicsSnapshot, { month, reason: `Renovação da composição no início do mandato ${state.termNumber}.` });
      }
      state.coalition = { groupIds: [], seats: 0, majority: false, status: "not_formed", formedMonth: null, leaderGroupId: null };
      updateCoalitionAccounting(state);
      electionHeld = true;
      pushEvent(state, {
        type: "mandate_renewed",
        month,
        termNumber: state.termNumber,
        nextElectionMonth: state.nextElectionMonth,
        message: `A composição institucional foi renovada para o mandato ${state.termNumber}.`
      });
    }
    state.currentMonth = month;
    state.lastProcessedMonth = month;
    captureHistory(state, month);
    return { unchanged: false, snapshot: getSnapshot(state), electionHeld };
  }

  function getSnapshot(state) {
    ensureState(state);
    updateCoalitionAccounting(state);
    const groups = clone(state.legislature.groups).sort((a, b) => b.seats - a.seats || b.influence - a.influence || a.groupId.localeCompare(b.groupId));
    const alignedSeats = groups.filter((group) => group.governmentRelation === "support").reduce((sum, group) => sum + group.seats, 0);
    const neutralSeats = groups.filter((group) => group.governmentRelation === "neutral").reduce((sum, group) => sum + group.seats, 0);
    const oppositionSeats = groups.filter((group) => group.governmentRelation === "opposition").reduce((sum, group) => sum + group.seats, 0);
    const coalitionGroups = groups.filter((group) => state.coalition.groupIds.includes(group.groupId));
    return {
      version: VERSION,
      stateModel: state.stateModel,
      currentMonth: state.currentMonth,
      nextElectionMonth: state.nextElectionMonth,
      termNumber: state.termNumber,
      settings: clone(state.settings),
      executive: clone(state.executive),
      legislature: {
        ...clone(state.legislature),
        groups,
        seats: clone(state.legislature.seats)
      },
      coalition: {
        ...clone(state.coalition),
        groups: coalitionGroups.map((group) => ({ groupId: group.groupId, groupName: group.groupName, seats: group.seats, relation: group.governmentRelation }))
      },
      opposition: clone(state.opposition),
      alignment: { supportSeats: alignedSeats, neutralSeats, oppositionSeats },
      summary: {
        totalSeats: state.legislature.totalSeats,
        allocatedSeats: state.legislature.allocatedSeats,
        vacantSeats: state.legislature.vacantSeats,
        quorumSeats: state.legislature.quorumSeats,
        majoritySeats: state.legislature.majoritySeats,
        coalitionSeats: state.coalition.seats,
        coalitionStatus: state.coalition.status,
        hasGovernmentMajority: state.coalition.majority,
        groupCount: groups.length
      },
      history: clone(state.history),
      recentEvents: clone(state.events.slice(-12)),
      bills: getBills(state),
      enactedLaws: clone(state.enactedLaws || []),
      campaign: clone(state.campaign || { active: false, platformId: null, polling: [] })
    };
  }

  function resetState(state, options = {}) {
    const next = createState(options);
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, next);
    return state;
  }

  function getSimulationContext(state, explicitContext = {}) {
    let pop = explicitContext.population;
    let treasury = explicitContext.treasuryCash;
    let infra = explicitContext.infrastructureCapacity;

    if (typeof window !== "undefined" && window.VilarejoTest && window.VilarejoTest.stateSnapshot) {
      try {
        const snap = window.VilarejoTest.stateSnapshot();
        if (snap) {
          if (pop === undefined) pop = snap.population;
          if (treasury === undefined) treasury = snap.treasuryCash ?? snap.accounts?.treasury;
          if (infra === undefined) infra = snap.infrastructureCapacity;
        }
      } catch (_) {}
    }
    if (pop === undefined && state?.lastPoliticsSnapshot?.population) {
      pop = state.lastPoliticsSnapshot.population;
    }
    const enactedFromState = (state.enactedLaws || []).map((l) => (typeof l === "string" ? l : l.id));
    const enactedFromContext = Array.isArray(explicitContext.enactedLaws) ? explicitContext.enactedLaws : [];
    const combinedEnacted = [...new Set([...enactedFromState, ...enactedFromContext])];

    return {
      population: Math.max(0, numberOr(pop, 13)),
      treasuryCash: Math.max(0, numberOr(treasury, 15000)),
      infrastructureCapacity: Math.max(0, numberOr(infra, 10)),
      enactedLaws: combinedEnacted
    };
  }

  function checkBillEligibility(bill, context = {}) {
    const req = bill.requirements || {};
    const reasons = [];

    if (req.minPopulation && context.population < req.minPopulation) {
      reasons.push(`População atual (${context.population}) abaixo do exigido (${req.minPopulation} moradores)`);
    }
    if (req.minTreasury && context.treasuryCash < req.minTreasury) {
      reasons.push(`Caixa do Tesouro (R$ ${Math.round(context.treasuryCash).toLocaleString("pt-BR")}) abaixo do exigido (R$ ${Math.round(req.minTreasury).toLocaleString("pt-BR")})`);
    }
    if (req.minInfrastructure && context.infrastructureCapacity < req.minInfrastructure) {
      reasons.push(`Capacidade de infraestrutura (${context.infrastructureCapacity}) abaixo do exigido (${req.minInfrastructure})`);
    }
    if (req.requiresLaw) {
      const enactedIds = new Set(context.enactedLaws || []);
      if (!enactedIds.has(req.requiresLaw)) {
        const requiredBill = BILL_CATALOG.find((b) => b.id === req.requiresLaw);
        reasons.push(`Exige aprovação prévia de: ${requiredBill ? requiredBill.code + " - " + requiredBill.title : req.requiresLaw}`);
      }
    }

    return {
      eligible: reasons.length === 0,
      reasons,
      requirementsText: req.description || (reasons.length ? reasons.join("; ") : "Livre para deliberação inicial da comunidade")
    };
  }

  function getBillPreview(state, billId, options = {}) {
    ensureState(state);
    const bill = (state.bills || []).find((b) => b.id === billId);
    if (!bill) throw new Error(`Projeto de lei inexistente: ${billId}`);

    const simContext = getSimulationContext(state, options.context);
    const eligibility = checkBillEligibility(bill, simContext);

    const groups = state.legislature.groups || [];
    const coalitionSet = new Set(state.coalition.groupIds || []);
    const oppositionSet = new Set(state.opposition?.groupIds || []);
    const lobbyImpact = numberOr(options.lobbyImpact, 0);

    const votesProjection = [];
    let projectedYes = 0;
    let projectedNo = 0;
    let projectedAbstain = 0;

    for (const group of groups) {
      const bias = numberOr(bill.supportBiases?.[group.groupId], 0);
      const satisfaction = numberOr(group.satisfaction, 50);
      const isCoalition = coalitionSet.has(group.groupId);
      const isOpposition = oppositionSet.has(group.groupId);

      const alignmentScore = (bias * 45) + ((satisfaction - 50) * 0.7) + (isCoalition ? 30 : 0) + (isOpposition ? -25 : 0) + lobbyImpact;

      let voteType = "abstain";
      let yesSeats = 0;
      let noSeats = 0;
      let abstainSeats = 0;

      if (alignmentScore >= 5) {
        voteType = "yes";
        yesSeats = group.seats;
      } else if (alignmentScore <= -5) {
        voteType = "no";
        noSeats = group.seats;
      } else {
        voteType = "abstain";
        abstainSeats = group.seats;
      }

      projectedYes += yesSeats;
      projectedNo += noSeats;
      projectedAbstain += abstainSeats;

      votesProjection.push({
        groupId: group.groupId,
        groupName: group.groupName,
        seats: group.seats,
        vote: voteType,
        score: round1(alignmentScore)
      });
    }

    const majorityNeeded = state.legislature.majoritySeats;
    const likelyApproved = projectedYes >= majorityNeeded;

    return {
      billId: bill.id,
      code: bill.code,
      title: bill.title,
      description: bill.description,
      category: bill.category,
      phase: bill.phase,
      phaseLabel: bill.phaseLabel,
      cost: bill.cost,
      author: bill.author,
      status: bill.status,
      eligibility,
      impacts: clone(bill.impacts || {}),
      projectedVoting: {
        likelyApproved,
        projectedYes,
        projectedNo,
        projectedAbstain,
        majorityNeeded,
        totalSeats: state.legislature.totalSeats,
        benches: votesProjection
      }
    };
  }

  function getBills(state, context = {}) {
    ensureState(state);
    const simContext = getSimulationContext(state, context);
    return (state.bills || BILL_CATALOG).map((b) => {
      const eligibility = checkBillEligibility(b, simContext);
      return {
        ...clone(b),
        eligible: eligibility.eligible,
        eligibilityReasons: eligibility.reasons,
        requirementsText: eligibility.requirementsText
      };
    });
  }

  function sponsorBill(state, billId, options = {}) {
    ensureState(state);
    const bill = (state.bills || []).find((b) => b.id === billId);
    if (!bill) throw new Error(`Projeto de lei inexistente: ${billId}`);
    if (bill.status === "enacted") throw new Error("Projeto de lei já aprovado e em vigor.");

    if (!options.ignoreRequirements) {
      const simContext = getSimulationContext(state, options.context);
      const eligibility = checkBillEligibility(bill, simContext);
      if (!eligibility.eligible) {
        throw new Error(`Projeto de lei bloqueado para pauta. Requisitos pendentes: ${eligibility.reasons.join("; ")}`);
      }
    }

    bill.status = "tabled";
    pushEvent(state, {
      type: "bill_tabled",
      month: state.currentMonth,
      billId: bill.id,
      title: bill.title,
      code: bill.code,
      message: `${bill.code} - ${bill.title} foi pautado para deliberação no Plenário da Câmara.`
    });
    return clone(bill);
  }

  function voteBill(state, billId, options = {}) {
    ensureState(state);
    const bill = (state.bills || []).find((b) => b.id === billId);
    if (!bill) throw new Error(`Projeto de lei inexistente: ${billId}`);
    if (bill.status === "enacted") throw new Error("Projeto de lei já aprovado anteriormente.");

    if (!options.ignoreRequirements && bill.status !== "tabled") {
      const simContext = getSimulationContext(state, options.context);
      const eligibility = checkBillEligibility(bill, simContext);
      if (!eligibility.eligible) {
        throw new Error(`Projeto de lei bloqueado para votação. Requisitos pendentes: ${eligibility.reasons.join("; ")}`);
      }
    }

    const groups = state.legislature.groups || [];
    const coalitionSet = new Set(state.coalition.groupIds || []);
    const oppositionSet = new Set(state.opposition?.groupIds || []);
    const lobbyImpact = numberOr(options.lobbyImpact, 0);

    const votesByGroup = [];
    let totalYes = 0;
    let totalNo = 0;
    let totalAbstain = 0;

    for (const group of groups) {
      const bias = numberOr(bill.supportBiases?.[group.groupId], 0);
      const satisfaction = numberOr(group.satisfaction, 50);
      const isCoalition = coalitionSet.has(group.groupId);
      const isOpposition = oppositionSet.has(group.groupId);

      const alignmentScore = (bias * 45) + ((satisfaction - 50) * 0.7) + (isCoalition ? 30 : 0) + (isOpposition ? -25 : 0) + lobbyImpact;

      let voteType = "abstain";
      let yesSeats = 0;
      let noSeats = 0;
      let abstainSeats = 0;

      if (alignmentScore >= 5) {
        voteType = "yes";
        yesSeats = group.seats;
      } else if (alignmentScore <= -5) {
        voteType = "no";
        noSeats = group.seats;
      } else {
        voteType = "abstain";
        abstainSeats = group.seats;
      }

      totalYes += yesSeats;
      totalNo += noSeats;
      totalAbstain += abstainSeats;

      votesByGroup.push({
        groupId: group.groupId,
        groupName: group.groupName,
        seats: group.seats,
        vote: voteType,
        yesSeats,
        noSeats,
        abstainSeats,
        score: round1(alignmentScore)
      });
    }

    const majorityNeeded = state.legislature.majoritySeats;
    const approved = totalYes >= majorityNeeded;

    bill.status = approved ? "enacted" : "rejected";
    bill.votedMonth = state.currentMonth;
    bill.lastVotingResult = {
      approved,
      totalYes,
      totalNo,
      totalAbstain,
      majorityNeeded,
      totalSeats: state.legislature.totalSeats
    };

    if (approved) {
      state.enactedLaws = state.enactedLaws || [];
      if (!state.enactedLaws.some((l) => l.id === bill.id)) {
        state.enactedLaws.push({
          ...clone(bill),
          enactedMonth: state.currentMonth
        });
      }
      if (bill.impacts?.satisfaction && state.lastPoliticsSnapshot) {
        for (const [gId, delta] of Object.entries(bill.impacts.satisfaction)) {
          const g = state.legislature.groups.find((x) => x.groupId === gId);
          if (g) g.satisfaction = Math.max(0, Math.min(100, g.satisfaction + delta));
        }
      }
      pushEvent(state, {
        type: "bill_enacted",
        month: state.currentMonth,
        billId: bill.id,
        code: bill.code,
        title: bill.title,
        totalYes,
        totalNo,
        majorityNeeded,
        message: `Aprovado: ${bill.code} (${totalYes} votos a favor vs ${totalNo} contra). A lei entra em vigor no município!`
      });
    } else {
      pushEvent(state, {
        type: "bill_rejected",
        month: state.currentMonth,
        billId: bill.id,
        code: bill.code,
        title: bill.title,
        totalYes,
        totalNo,
        majorityNeeded,
        message: `Rejeitado: ${bill.code} obteve ${totalYes} votos favoráveis (maioria necessária: ${majorityNeeded}). O projeto foi arquivado pela Câmara.`
      });
    }

    return {
      billId: bill.id,
      id: bill.id,
      code: bill.code,
      title: bill.title,
      cost: bill.cost,
      impacts: clone(bill.impacts || {}),
      approved,
      totalYes,
      totalNo,
      totalAbstain,
      majorityNeeded,
      totalSeats: state.legislature.totalSeats,
      votesByGroup
    };
  }

  function getEnactedLaws(state) {
    ensureState(state);
    return clone(state.enactedLaws || []);
  }

  function getCampaignPlatforms() {
    return clone(CAMPAIGN_PLATFORMS);
  }

  function selectCampaignPlatform(state, platformId) {
    ensureState(state);
    const platform = CAMPAIGN_PLATFORMS.find((p) => p.id === platformId);
    if (!platform) throw new Error(`Plataforma eleitoral inválida: ${platformId}`);
    state.campaign = state.campaign || {};
    state.campaign.platformId = platform.id;
    state.campaign.active = true;
    pushEvent(state, {
      type: "campaign_platform_selected",
      month: state.currentMonth,
      platformId: platform.id,
      title: platform.title,
      message: `Convenção Municipal: O Governo lançou a plataforma eleitoral "${platform.title}" para a renovação da Câmara!`
    });
    return clone(platform);
  }

  function getElectionPolling(state, politicsSnapshot) {
    ensureState(state);
    const groups = groupRowsFromPolitics(politicsSnapshot || state.lastPoliticsSnapshot);
    const platform = CAMPAIGN_PLATFORMS.find((p) => p.id === state.campaign?.platformId) || null;

    return groups.map((g) => {
      const baseSatisfaction = numberOr(g.satisfaction, 50);
      const platformBonus = platform ? numberOr(platform.appeal[g.groupId], 0) : 0;
      const govApprovalScore = Math.max(5, Math.min(95, baseSatisfaction + (platformBonus * 0.4)));
      const intent = govApprovalScore >= 55 ? "favor_gov" : govApprovalScore <= 42 ? "favor_opp" : "undecided";
      return {
        groupId: g.groupId,
        groupName: g.groupName,
        influence: g.influence,
        govApprovalScore: round1(govApprovalScore),
        intent,
        platformBonus
      };
    });
  }

  function holdElection(state, politicsSnapshot, options = {}) {
    ensureState(state);
    const currentMonth = state.currentMonth;
    const snap = politicsSnapshot || state.lastPoliticsSnapshot;
    if (!snap) throw new Error("Dados políticos necessários para realizar a apuração eleitoral.");

    state.termNumber += 1;
    state.nextElectionMonth = currentMonth + state.settings.termMonths;

    const platform = CAMPAIGN_PLATFORMS.find((p) => p.id === state.campaign?.platformId) || null;

    recalculateRepresentation(state, snap, {
      month: currentMonth,
      reason: `Eleição Geral Municipal: Nova composição eleita para o Mandato ${state.termNumber}.`
    });

    state.coalition = { groupIds: [], seats: 0, majority: false, status: "not_formed", formedMonth: null, leaderGroupId: null };
    updateCoalitionAccounting(state);

    if (state.campaign) {
      state.campaign.lastElection = {
        month: currentMonth,
        termNumber: state.termNumber,
        platformId: platform?.id || null,
        platformTitle: platform?.title || "Frente Ampla de Desenvolvimento"
      };
      state.campaign.active = false;
      state.campaign.platformId = null;
    }

    pushEvent(state, {
      type: "election_held",
      month: currentMonth,
      termNumber: state.termNumber,
      nextElectionMonth: state.nextElectionMonth,
      message: `Eleições Municipais concluídas! O mandato ${state.termNumber} foi instalado com ${state.legislature.allocatedSeats} vereadores eleitos na Câmara.`
    });

    return {
      termNumber: state.termNumber,
      currentMonth,
      nextElectionMonth: state.nextElectionMonth,
      legislature: clone(state.legislature),
      summary: clone(state.summary)
    };
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function renderDashboard(state, host) {
    if (!host || !state) return false;
    const data = getSnapshot(state);
    const coalitionLabel = { majority: "Maioria", minority: "Minoria", not_formed: "Não formada" }[data.coalition.status];
    const groupCards = data.legislature.groups.map((group) => {
      const relation = { support: "Apoio", neutral: "Neutro", opposition: "Oposição" }[group.governmentRelation] || "Neutro";
      return `<article class="institution-group-card">
        <div class="institution-group-top"><div><strong>${escapeHtml(group.groupName)}</strong><small>${relation} ao governo</small></div><b>${group.seats}<small> cadeira${group.seats === 1 ? "" : "s"}</small></b></div>
        <div class="institution-seat-track"><span style="width:${Math.min(100, group.share)}%"></span></div>
        <div class="institution-group-meta"><span>Influência: ${group.influence.toFixed(1)}</span><span>${group.share.toFixed(1)}% da Câmara</span></div>
      </article>`;
    }).join("") || `<p class="institution-empty">Aguardando a formação dos grupos políticos.</p>`;
    const coalitionRows = data.coalition.groups.map((group) => `<div class="institution-coalition-row"><span>${escapeHtml(group.groupName)}</span><b>${group.seats} cadeiras</b></div>`).join("") || `<p class="institution-empty">O governo ainda não formalizou uma coalizão. Grupos neutros não são considerados apoiadores automaticamente.</p>`;
    const termProgress = Math.max(0, Math.min(100, ((data.currentMonth - (data.nextElectionMonth - data.settings.termMonths)) / data.settings.termMonths) * 100));

    const billCards = (data.bills || []).map((b) => {
      const isEnacted = b.status === "enacted";
      const isRejected = b.status === "rejected";
      const isTabled = b.status === "tabled";
      const isLocked = b.eligible === false && !isEnacted;

      const badge = isEnacted
        ? '<span style="background:#dcfce7;color:#15803d;padding:2px 6px;border-radius:4px;font-weight:700;font-size:0.72rem;">Sancionada (Em vigor)</span>'
        : isLocked
        ? '<span style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:4px;font-weight:700;font-size:0.72rem;">🔒 Bloqueada (Evolua o Vilarejo)</span>'
        : isRejected
        ? '<span style="background:#fee2e2;color:#b91c1c;padding:2px 6px;border-radius:4px;font-weight:700;font-size:0.72rem;">Rejeitada no Plenário</span>'
        : isTabled
        ? '<span style="background:#fef3c7;color:#b45309;padding:2px 6px;border-radius:4px;font-weight:700;font-size:0.72rem;">Pautado para Votação</span>'
        : '<span style="background:#f0fdf4;color:#166534;padding:2px 6px;border-radius:4px;font-weight:700;font-size:0.72rem;">🔓 Pronta para Pauta</span>';

      const resultText = b.lastVotingResult
        ? `<div style="font-size:0.75rem;margin-top:0.35rem;padding:4px 6px;background:${b.lastVotingResult.approved ? '#f0fdf4' : '#fef2f2'};border-radius:4px;color:${b.lastVotingResult.approved ? '#166534' : '#991b1b'};font-weight:600;">
             Placar: <strong>${b.lastVotingResult.totalYes} Sim</strong> vs <strong>${b.lastVotingResult.totalNo} Não</strong> (Maioria necessária: ${b.lastVotingResult.majorityNeeded}) — ${b.lastVotingResult.approved ? 'Aprovado' : 'Rejeitado'}
           </div>`
        : "";

      const requirementsBox = isLocked
        ? `<div style="font-size:0.72rem;background:#fff1f2;border:1px solid #fecdd3;padding:5px 8px;border-radius:4px;color:#9f1239;margin:0.35rem 0;">
             <strong>Requisito de Evolução:</strong> ${escapeHtml(b.eligibilityReasons?.join('; ') || b.requirementsText || '')}
           </div>`
        : "";

      const costText = b.cost > 0 ? `Custo: R$ ${Math.round(b.cost).toLocaleString("pt-BR")}` : "Sem custo direto";

      return `
        <div style="background:#fff;border:1px solid ${isLocked ? '#e2e8f0' : '#cbd5e1'};opacity:${isLocked ? '0.85' : '1'};border-radius:8px;padding:0.75rem;display:flex;flex-direction:column;justify-content:space-between;gap:0.4rem;">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;margin-bottom:0.25rem;">
              <div style="display:flex;align-items:center;gap:0.4rem;">
                <span style="font-size:0.75rem;font-weight:700;color:var(--forest,#14342b);">${escapeHtml(b.code)}</span>
                <span style="font-size:0.68rem;background:#f1f5f9;color:#475569;padding:2px 5px;border-radius:3px;font-weight:600;">${escapeHtml(b.phaseLabel || 'Fase 1: Povoado')}</span>
              </div>
              ${badge}
            </div>
            <strong style="font-size:0.88rem;color:#1e293b;line-height:1.3;display:block;">${escapeHtml(b.title)}</strong>
            <p style="margin:0.3rem 0;font-size:0.78rem;color:#475569;line-height:1.35;">${escapeHtml(b.description)}</p>
            
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.72rem;color:#64748b;margin:0.25rem 0;">
              <span>Autor: ${escapeHtml(b.author)}</span>
              <strong style="color:${b.cost > 0 ? '#b45309' : '#15803d'};">${costText}</strong>
            </div>

            <div style="font-size:0.74rem;background:#f8fafc;border-left:3px solid var(--forest,#14342b);padding:4px 8px;margin:0.35rem 0;color:#334155;line-height:1.35;">
              <strong>Impactos da Lei:</strong> ${escapeHtml(b.impacts?.summary || 'Estabelece diretrizes regulatórias e institucionais na comunidade.')}
            </div>

            ${(() => {
              try {
                const preview = getBillPreview(state, b.id);
                const proj = preview?.projectedVoting || {};
                const projBenches = Array.isArray(proj.benches) ? proj.benches : [];
                return `
                  <details style="margin-top:0.35rem;font-size:0.73rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:4px 6px;">
                    <summary style="font-weight:700;color:var(--forest,#14342b);cursor:pointer;outline:none;">
                      🔍 Prévia de Impactos & Projeção do Plenário (${proj.likelyApproved ? '✓ Maioria Provável' : '⚠️ Risco de Rejeição'})
                    </summary>
                    <div style="margin-top:0.4rem;padding-top:0.35rem;border-top:1px dashed #cbd5e1;line-height:1.35;">
                      <div style="margin-bottom:0.25rem;color:#1e293b;">
                        <strong>Projeção de Voto:</strong> ${proj.projectedYes || 0} Sim vs ${proj.projectedNo || 0} Não (${proj.projectedAbstain || 0} Abst) — Maioria: ${proj.majorityNeeded || 11}
                      </div>
                      <div style="display:flex;flex-wrap:wrap;gap:3px;font-size:0.68rem;margin-top:0.25rem;">
                        ${projBenches.map((bench) => `
                          <span style="padding:1px 4px;border-radius:3px;background:${bench.vote === 'yes' ? '#dcfce7;color:#166534' : bench.vote === 'no' ? '#fee2e2;color:#991b1b' : '#f1f5f9;color:#475569'};font-weight:600;">
                            ${escapeHtml(bench.groupName)}: ${bench.vote === 'yes' ? 'Sim' : bench.vote === 'no' ? 'Não' : 'Abst'}
                          </span>
                        `).join('')}
                      </div>
                    </div>
                  </details>
                `;
              } catch (_) {
                return '';
              }
            })()}

            ${requirementsBox}
            ${resultText}
          </div>
          <div>
            ${isEnacted ? `
              <div style="font-size:0.75rem;color:#15803d;font-weight:600;margin-top:0.25rem;">✓ Dispositivos em plena vigência municipal</div>
            ` : isLocked ? `
              <button type="button" class="btn-gov-shortcut" disabled style="margin-top:0.4rem;width:100%;justify-content:center;background:#94a3b8;color:#fff;border:none;border-radius:4px;padding:6px 10px;cursor:not-allowed;font-size:0.8rem;font-weight:600;">
                🔒 Pauta Bloqueada
              </button>
            ` : `
              <button type="button" class="btn-gov-shortcut" style="margin-top:0.4rem;width:100%;justify-content:center;background:#14342b;color:#fff;border:none;border-radius:4px;padding:6px 10px;cursor:pointer;font-size:0.8rem;font-weight:600;" onclick="window.VilarejoDashboard && window.VilarejoDashboard.voteBill && window.VilarejoDashboard.voteBill('${b.id}')">
                ⚖️ Pautar e Votar no Plenário
              </button>
            `}
          </div>
        </div>
      `;
    }).join("");

    const platformCards = (CAMPAIGN_PLATFORMS || []).map((p) => {
      const isSelected = data.campaign?.platformId === p.id;
      return `
        <div style="background:#fff;border:1px solid ${isSelected ? 'var(--gold,#d97706)' : '#cbd5e1'};border-radius:8px;padding:0.75rem;display:flex;flex-direction:column;justify-content:space-between;gap:0.4rem;${isSelected ? 'box-shadow:0 0 0 2px rgba(217,119,6,0.2);' : ''}">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:0.88rem;color:#1e293b;">${escapeHtml(p.title)}</strong>
              ${isSelected ? '<span style="background:#fef3c7;color:#b45309;padding:2px 6px;border-radius:4px;font-weight:700;font-size:0.7rem;">★ Plataforma Ativa</span>' : ''}
            </div>
            <div style="font-size:0.75rem;color:#d97706;font-weight:600;margin:0.2rem 0;">${escapeHtml(p.subtitle)}</div>
            <p style="font-size:0.75rem;color:#64748b;margin:0.2rem 0 0.4rem 0;font-style:italic;">"${escapeHtml(p.slogan)}"</p>
          </div>
          <button type="button" class="btn-gov-shortcut" style="justify-content:center;padding:5px 8px;font-size:0.75rem;cursor:pointer;background:${isSelected ? '#d97706' : '#f1f5f9'};color:${isSelected ? '#fff' : '#1e293b'};border:1px solid ${isSelected ? '#d97706' : '#cbd5e1'};border-radius:4px;" onclick="window.VilarejoDashboard && window.VilarejoDashboard.selectPlatform && window.VilarejoDashboard.selectPlatform('${p.id}')">
            ${isSelected ? '✓ Plataforma Definida' : 'Adotar como Plataforma'}
          </button>
        </div>
      `;
    }).join("");

    host.innerHTML = `
      <section class="institutions-dashboard">
        <div class="institutions-kpis">
          <article class="institutions-kpi"><span>Cadeiras</span><strong>${data.summary.allocatedSeats}/${data.summary.totalSeats}</strong></article>
          <article class="institutions-kpi"><span>Maioria absoluta</span><strong>${data.summary.majoritySeats}</strong></article>
          <article class="institutions-kpi"><span>Base do governo</span><strong>${data.summary.coalitionSeats} cadeiras</strong></article>
          <article class="institutions-kpi"><span>Composição</span><strong>${escapeHtml(coalitionLabel)}</strong></article>
        </div>
        <div class="institutions-layout">
          <article class="content-card institutions-main-card">
            <div class="section-heading compact-heading"><div><span class="eyebrow">PODER LEGISLATIVO</span><h2>${escapeHtml(data.legislature.name)}</h2><p>Bancadas e bancadas parlamentares organizadas representam as forças vivas do vilarejo.</p></div></div>
            <div class="institutions-groups">${groupCards}</div>
            
            <div class="institution-bills-section" style="margin-top:1.5rem;padding-top:1.25rem;border-top:1px solid var(--border,#e2e8f0);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.5rem;">
                <div>
                  <span class="eyebrow" style="color:var(--forest,#14342b);font-weight:700;">PLENÁRIO DA CÂMARA MUNICIPAL</span>
                  <h3 style="margin:0;font-size:1.05rem;">Projetos de Lei em Deliberação</h3>
                </div>
                <span class="ux-period-chip" style="font-size:0.75rem;background:#f1f5f9;padding:3px 8px;border-radius:4px;font-weight:600;">Maioria necessária: ${data.summary.majoritySeats} votos</span>
              </div>
              <div class="institution-bills-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:0.75rem;">
                ${billCards}
              </div>
            </div>

            <div class="institution-campaign-section" style="margin-top:1.5rem;padding-top:1.25rem;border-top:1px solid var(--border,#e2e8f0);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.5rem;">
                <div>
                  <span class="eyebrow" style="color:var(--gold,#d97706);font-weight:700;">PROCESSO ELEITORAL & DEMOCRACIA</span>
                  <h3 style="margin:0;font-size:1.05rem;">Eleições Municipais & Plataforma de Mandato</h3>
                </div>
                <button type="button" class="btn-gov-shortcut" style="padding:6px 12px;font-size:0.8rem;background:var(--forest,#14342b);color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;" onclick="window.VilarejoDashboard && window.VilarejoDashboard.holdElection && window.VilarejoDashboard.holdElection()">
                  🗳️ Realizar Apuração Eleitoral Agora
                </button>
              </div>
              <p style="font-size:0.8rem;color:var(--muted,#64748b);margin-top:0;">
                Faltam <strong>${Math.max(0, data.nextElectionMonth - data.currentMonth)} meses</strong> para a renovação ordinária da Câmara. Selecione a plataforma eleitoral do governo para alinhar as bancadas:
              </p>
              <div class="institution-platforms-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.75rem;">
                ${platformCards}
              </div>
              ${data.campaign?.lastElection ? `
                <div style="margin-top:0.75rem;padding:0.6rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:0.8rem;color:#166534;">
                  ✓ Última Eleição Concluída no Mês ${data.campaign.lastElection.month}: Plataforma Vencedora "<strong>${escapeHtml(data.campaign.lastElection.platformTitle)}</strong>". Mandato ${data.campaign.lastElection.termNumber} instalado com sucesso.
                </div>
              ` : ''}
            </div>

            <div class="institution-data-note" style="margin-top:1.25rem;">Distribuição proporcional por influência política via método dos maiores restos. Projetos de lei e eleições mobilizam as forças organizadas do município.</div>
          </article>
          <aside class="content-card institutions-side-card">
            <div class="eyebrow">PODER EXECUTIVO</div><h3>${escapeHtml(data.executive.name)}</h3><p>Chefia controlada pelo jogador. O governo administra as competências do município.</p>
            <div class="institution-divider"></div>
            <div class="eyebrow">COALIZÃO DE GOVERNO</div><div class="institution-coalition-status ${data.coalition.majority ? "is-majority" : "is-minority"}">${escapeHtml(coalitionLabel)}</div>
            <div class="institution-coalition-list">${coalitionRows}</div>
            <div class="institution-stat"><span>Quórum</span><b>${data.summary.quorumSeats} de ${data.summary.totalSeats}</b></div>
            <div class="institution-stat"><span>Bloco oposicionista identificado</span><b>${data.opposition.seats} cadeiras</b></div>
            <div class="institution-divider"></div>
            <div class="eyebrow">MANDATO INSTITUCIONAL</div><div class="institution-term"><strong>${data.termNumber}</strong><span>Mandato</span></div>
            <div class="institution-term-track"><span style="width:${termProgress}%"></span></div>
            <div class="institution-stat"><span>Próxima renovação</span><b>Mês ${data.nextElectionMonth}</b></div>
          </aside>
        </div>
      </section>`;
    return true;
  }

  function registerWithRuntime(runtime, options = {}) {
    if (!runtime || !runtime.modules || !runtime.events || typeof runtime.publish !== "function") {
      throw new TypeError("Runtime do Vilarejo incompleto para registrar Instituições.");
    }
    if (!runtime.modules.has("core") || !runtime.modules.has("economia") || !runtime.modules.has("politica")) {
      throw new Error("Instituições exige Core, Economia e Política registrados.");
    }
    if (runtime.modules.has("instituicoes")) return { alreadyRegistered: true, state: null, dispose() {} };

    runtime.modules.register({
      id: "instituicoes",
      version: VERSION,
      name: "Instituições e representação",
      dependencies: ["core", "economia", "politica"],
      description: "Câmara de representação dos interesses, bancadas, coalizão de governo e mandatos."
    });

    const state = createState(options);
    const politicsSnapshot = () => runtime.modules.get("politica")?.snapshot || null;
    const publishSnapshot = (source = "instituicoes") => {
      const snapshot = getSnapshot(state);
      runtime.modules.updateSnapshot("instituicoes", snapshot, source);
      return snapshot;
    };
    const publishRepresentation = (topic = "institutions:representation-updated") => {
      const snapshot = publishSnapshot("instituicoes.representation");
      runtime.publish(topic, snapshot, "instituicoes");
      return snapshot;
    };

    const initialPolitics = politicsSnapshot();
    if (initialPolitics) recalculateRepresentation(state, initialPolitics, { month: initialPolitics.currentMonth, reason: "Composição inicial da Câmara." });
    publishSnapshot("instituicoes.initial-adapter");

    const unsubscribeReset = runtime.events.on("game:reset", () => {
      resetState(state, options);
      publishSnapshot("instituicoes.reset");
    });
    const unsubscribeInitialized = runtime.events.on("game:initialized", () => {
      const current = politicsSnapshot();
      if (current) recalculateRepresentation(state, current, { month: current.currentMonth, reason: "Nova partida iniciada." });
      publishRepresentation();
    });
    const unsubscribePoliticsMonth = runtime.events.on("politics:month-closed", (event) => {
      const snapshot = event?.payload && event.payload.version ? event.payload : politicsSnapshot();
      const month = Math.max(0, Math.floor(numberOr(snapshot?.currentMonth, state.currentMonth + 1)));
      const result = advanceMonth(state, { month, politicsSnapshot: snapshot });
      publishSnapshot("instituicoes.month-closed");
      if (!result.unchanged) {
        runtime.publish("institutions:month-closed", result.snapshot, "instituicoes");
        runtime.publish("institutions:representation-updated", result.snapshot, "instituicoes");
        if (result.electionHeld) runtime.publish("institutions:mandate-renewed", result.snapshot, "instituicoes");
      }
    });
    const unsubscribeGroupUpdate = runtime.events.on("politics:group-updated", (event) => {
      const snapshot = event?.payload?.snapshot || politicsSnapshot();
      if (snapshot) {
        refreshGroupMetadata(state, snapshot);
        publishSnapshot("instituicoes.politics-update");
      }
    });
    const unsubscribeInfluence = runtime.events.on("politics:influence-changed", () => {
      const snapshot = politicsSnapshot();
      if (snapshot) {
        refreshGroupMetadata(state, snapshot);
        publishSnapshot("instituicoes.influence-update");
      }
    });

    return {
      alreadyRegistered: false,
      state,
      getSnapshot: () => getSnapshot(state),
      setCoalition: (groupIds, settings) => {
        const coalition = setCoalition(state, groupIds, settings);
        publishRepresentation("institutions:coalition-updated");
        return coalition;
      },
      dissolveCoalition: (settings) => {
        const coalition = dissolveCoalition(state, settings);
        publishRepresentation("institutions:coalition-updated");
        return coalition;
      },
      recalculateRepresentation: (settings = {}) => {
        const current = politicsSnapshot();
        if (!current) throw new Error("Snapshot de Política indisponível.");
        const snapshot = recalculateRepresentation(state, current, settings);
        publishRepresentation();
        return snapshot;
      },
      getBills: (context) => getBills(state, context),
      checkBillEligibility: (bill, context) => checkBillEligibility(bill, getSimulationContext(state, context)),
      getBillPreview: (billId, options) => getBillPreview(state, billId, options),
      sponsorBill: (billId, options) => {
        const res = sponsorBill(state, billId, options);
        publishSnapshot("instituicoes.bill-tabled");
        return res;
      },
      voteBill: (billId, options) => {
        const res = voteBill(state, billId, options);
        publishSnapshot("instituicoes.bill-voted");
        if (res.approved) {
          runtime.publish("institutions:bill-enacted", res, "instituicoes");
        } else {
          runtime.publish("institutions:bill-rejected", res, "instituicoes");
        }
        return res;
      },
      getEnactedLaws: () => getEnactedLaws(state),
      getCampaignPlatforms,
      selectCampaignPlatform: (platformId) => {
        const res = selectCampaignPlatform(state, platformId);
        publishSnapshot("instituicoes.campaign-platform");
        return res;
      },
      getElectionPolling: () => getElectionPolling(state, politicsSnapshot()),
      holdElection: (options) => {
        const res = holdElection(state, politicsSnapshot(), options);
        publishRepresentation("institutions:election-held");
        runtime.publish("institutions:mandate-renewed", getSnapshot(state), "instituicoes");
        return res;
      },
      dispose() {
        unsubscribeReset();
        unsubscribeInitialized();
        unsubscribePoliticsMonth();
        unsubscribeGroupUpdate();
        unsubscribeInfluence();
      }
    };
  }

  if (root?.VilarejoRuntime && root?.VilarejoPoliticsRuntime) {
    try {
      root.VilarejoInstitutionsRuntime = registerWithRuntime(root.VilarejoRuntime, root.VilarejoInstitutionOptions || {});
    } catch (error) {
      if (root.console?.error) root.console.error("Falha ao registrar o módulo Instituições:", error);
    }
  }

  return {
    VERSION,
    DEFAULT_SEATS,
    DEFAULT_TERM_MONTHS,
    BILL_CATALOG,
    CAMPAIGN_PLATFORMS,
    createState,
    allocateSeats,
    recalculateRepresentation,
    refreshGroupMetadata,
    setCoalition,
    dissolveCoalition,
    setInstitutionalSettings,
    advanceMonth,
    getSnapshot,
    resetState,
    renderDashboard,
    registerWithRuntime,
    getBills,
    checkBillEligibility,
    getBillPreview,
    sponsorBill,
    voteBill,
    getEnactedLaws,
    getCampaignPlatforms,
    selectCampaignPlatform,
    getElectionPolling,
    holdElection
  };
});
