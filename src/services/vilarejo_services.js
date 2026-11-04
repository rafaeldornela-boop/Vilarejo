(function attachVilarejoServices(root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.VilarejoServices = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createVilarejoServices(root) {
  "use strict";

  const VERSION = "1.0.0";
  const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, Number(v) || 0));
  const finite = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
  const numberOr = (v, fallback = 0) => finite(v) ? Number(v) : fallback;
  const round1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
  const clone = (v) => JSON.parse(JSON.stringify(v));

  // Valores iniciais são parâmetros de cenário, não estatísticas reais.
  // Cada indicador tem uma dimensão causal explícita e evolui gradualmente.
  const DOMAIN_DEFINITIONS = Object.freeze({
    health: {
      id: "health", name: "Saúde", description: "Acesso, capacidade assistencial, prevenção e saúde coletiva.", icon: "✚",
      indicators: { access: 48, capacity: 42, prevention: 38, healthOutcomes: 52, workforce: 40, mentalHealth: 44 },
      priorities: ["atenção primária", "hospitais", "vacinação", "saúde mental", "vigilância epidemiológica"],
      dependencies: ["sanitation", "education", "energy", "income"],
      levers: { primaryCare: 0, hospitalCapacity: 0, prevention: 0, mentalHealth: 0 }
    },
    education: {
      id: "education", name: "Educação", description: "Acesso, permanência, aprendizagem e formação profissional.", icon: "▤",
      indicators: { access: 55, attendance: 58, learning: 46, infrastructure: 44, qualification: 40 },
      priorities: ["educação infantil", "ensino básico", "ensino técnico", "formação docente", "ensino superior"],
      dependencies: ["health", "energy", "income", "science"],
      levers: { earlyYears: 0, basicEducation: 0, technicalTraining: 0, teacherDevelopment: 0 }
    },
    security: {
      id: "security", name: "Segurança", description: "Prevenção, investigação, resposta, justiça e proteção civil.", icon: "⬡",
      indicators: { prevention: 40, response: 48, investigation: 36, justiceCapacity: 42, publicTrust: 50 },
      priorities: ["policiamento preventivo", "investigação", "justiça", "proteção civil", "reinserção"],
      dependencies: ["education", "development", "health", "institutions"],
      levers: { prevention: 0, investigation: 0, civilProtection: 0, reintegration: 0 }
    },
    science: {
      id: "science", name: "Ciência e Tecnologia", description: "Pesquisa, inovação, difusão tecnológica e produtividade.", icon: "⌘",
      indicators: { research: 28, innovation: 30, technologyDiffusion: 32, talent: 38, appliedResearch: 26 },
      priorities: ["pesquisa básica", "pesquisa aplicada", "universidades", "inovação empresarial", "infraestrutura digital"],
      dependencies: ["education", "energy", "development"],
      levers: { basicResearch: 0, appliedResearch: 0, innovation: 0, digitalInfrastructure: 0 }
    },
    development: {
      id: "development", name: "Desenvolvimento", description: "Infraestrutura, produtividade, habitação, logística e diversificação produtiva.", icon: "⌂",
      indicators: { infrastructure: 42, logistics: 38, housing: 45, productivity: 40, regionalBalance: 44 },
      priorities: ["transportes", "habitação", "infraestrutura urbana", "indústria", "desenvolvimento regional"],
      dependencies: ["energy", "mining", "oil", "education", "science"],
      levers: { transport: 0, housing: 0, industry: 0, regionalInvestment: 0 }
    },
    culture: {
      id: "culture", name: "Cultura", description: "Acesso cultural, patrimônio, diversidade, produção e economia criativa.", icon: "♫",
      indicators: { access: 38, heritage: 52, creativeEconomy: 34, participation: 36, diversity: 55 },
      priorities: ["bibliotecas", "patrimônio", "artes", "economia criativa", "acesso territorial"],
      dependencies: ["education", "development", "income"],
      levers: { access: 0, heritage: 0, creativeEconomy: 0, localCulture: 0 }
    },
    infrastructure: {
      id: "infrastructure", name: "Infraestrutura e Recursos Estratégicos", description: "Saneamento, água, energia, petróleo, minerais e redes essenciais.", icon: "⚙",
      indicators: { sanitation: 35, waterSecurity: 52, electricityReliability: 58, energyCapacity: 48, resourceGovernance: 42, transportNetwork: 40 },
      priorities: ["água e esgoto", "energia elétrica", "petróleo e gás", "mineração", "transportes e comunicações"],
      dependencies: ["health", "development", "science", "environment"],
      levers: { sanitation: 0, electricity: 0, energyTransition: 0, oilAndGas: 0, miningProduction: 0, miningGovernance: 0, waterSecurity: 0 }
    }
  });

  const DOMAIN_IDS = Object.freeze(Object.keys(DOMAIN_DEFINITIONS));
  const CROSS_EFFECTS = Object.freeze([
    { from: "infrastructure.sanitation", to: "health.healthOutcomes", factor: 0.12, note: "Saneamento reduz exposição a doenças e melhora saúde coletiva." },
    { from: "infrastructure.waterSecurity", to: "health.prevention", factor: 0.05, note: "Segurança hídrica fortalece prevenção e resposta sanitária." },
    { from: "infrastructure.electricityReliability", to: "health.capacity", factor: 0.07, note: "Energia confiável sustenta hospitais, vacinas e equipamentos." },
    { from: "education.learning", to: "science.talent", factor: 0.10, note: "Aprendizagem amplia a formação de talentos científicos." },
    { from: "education.qualification", to: "development.productivity", factor: 0.08, note: "Qualificação eleva produtividade e capacidade produtiva." },
    { from: "science.innovation", to: "development.productivity", factor: 0.10, note: "Inovação difunde tecnologias e melhora produtividade." },
    { from: "development.infrastructure", to: "education.access", factor: 0.04, note: "Infraestrutura aproxima escolas e comunidades." },
    { from: "security.publicTrust", to: "development.productivity", factor: 0.04, note: "Confiança e segurança favorecem atividade econômica." },
    { from: "culture.participation", to: "education.attendance", factor: 0.025, note: "Participação cultural fortalece vínculos e permanência escolar." },
    { from: "health.healthOutcomes", to: "education.attendance", factor: 0.04, note: "Saúde melhora frequência e aprendizagem." }
  ]);

  const GOVERNANCE_ACTIONS = Object.freeze({
    action_sanitary_clean: {
      id: "action_sanitary_clean",
      name: "Mutirão Sanitário e Limpeza Urbana",
      domain: "infrastructure",
      cost: 350,
      description: "Desobstrução de valas de esgoto, coleta de resíduos e eliminação de focos de contaminação hídrica.",
      impacts: { sanitationDelta: 8, sanitaryRiskReduction: 35, preventionDelta: 6, civicPressureReduction: 12 }
    },
    action_health_campaign: {
      id: "action_health_campaign",
      name: "Campanha Comunitária de Vacinação e ESF",
      domain: "health",
      cost: 450,
      description: "Mobilização de agentes comunitários de saúde, vacinação em massa e distribuição de sais e remédios básicos.",
      impacts: { preventionDelta: 14, healthAccessDelta: 10, capacityDelta: 12, civicPressureReduction: 15 }
    },
    action_education_shift: {
      id: "action_education_shift",
      name: "Turno Escolar Suplementar e Vagas Emergenciais",
      domain: "education",
      cost: 400,
      description: "Locação temporária de sala comunitária e contratação de monitor para acolher crianças fora da escola.",
      impacts: { educationAccessDelta: 12, attendanceDelta: 10, extraCapacity: 4, civicPressureReduction: 15 }
    },
    action_security_patrol: {
      id: "action_security_patrol",
      name: "Ronda Preventiva e Iluminação Noturna",
      domain: "security",
      cost: 350,
      description: "Vigilância comunitária nos corredores de comércio e instalação emergencial de luminárias públicas.",
      impacts: { preventionDelta: 15, publicTrustDelta: 12, civicPressureReduction: 12 }
    },
    action_civic_hearing: {
      id: "action_civic_hearing",
      name: "Audiência Pública & Conselho Comunitário",
      domain: "governance",
      cost: 150,
      description: "Sessão aberta de diálogo com líderes comunitários, acolhendo queixas e pactuando prioridades com a cidadania.",
      impacts: { civicPressureReduction: 25, publicTrustDelta: 8 }
    }
  });

  function createDomain(definition, custom = {}) {
    const indicators = {};
    for (const [key, value] of Object.entries(definition.indicators)) indicators[key] = clamp(custom.indicators?.[key] ?? value);
    const levers = {};
    for (const key of Object.keys(definition.levers)) levers[key] = clamp(custom.levers?.[key] ?? 0, -100, 100);
    return {
      id: definition.id, name: definition.name, description: definition.description, icon: definition.icon,
      indicators, levers, priorities: [...definition.priorities], dependencies: [...definition.dependencies],
      satisfaction: 50, investmentIndex: 0, capacityPressure: 0, lastChange: {}, history: [],
      status: "active", dataQuality: "scenario-baseline"
    };
  }

  function createState(options = {}) {
    const domains = {};
    for (const id of DOMAIN_IDS) domains[id] = createDomain(DOMAIN_DEFINITIONS[id], options.domains?.[id]);
    const state = {
      version: VERSION, currentMonth: 0, domains,
      resources: {
        water: { reserves: 55, extraction: 0, renewableRecharge: 0, quality: 55 },
        electricity: { generation: 50, demand: 45, reliability: 58, renewableShare: 18 },
        oil: { reserves: 65, production: 35, refining: 28, strategicStock: 45 },
        minerals: { reserves: 60, extraction: 25, processing: 18, governance: 42, environmentalPressure: 22 }
      },
      publicCapacity: { fiscalSpace: null, workforce: 45, execution: 40 },
      governance: {
        demands: {
          health: { demand: 13, capacity: 15, coverage: 100, deficit: 0, pressure: 0 },
          education: { demand: 2, capacity: 4, coverage: 100, deficit: 0, pressure: 0 },
          sanitation: { demand: 5, coverage: 35, sanitaryRisk: 40, pressure: 44 },
          security: { risk: 25, safetyIndex: 75, pressure: 22 }
        },
        civicPressure: 15,
        civicStatus: "Estabilidade Cívica & Apoio Comunitário",
        activeOutbreak: null,
        activeSecurityIncident: null,
        actionHistory: []
      },
      events: [], history: [],
      assumptions: { baseline: "Parâmetros iniciais de cenário; calibrar com o balanceamento do jogo.", budgetLinked: false }
    };
    if (state.governance?.sanitaryReliefMonths > 0) state.governance.sanitaryReliefMonths -= 1;
    if (state.governance?.securityReliefMonths > 0) state.governance.securityReliefMonths -= 1;
    updateDemandsAndGovernance(state, options.demographics || null);
    return state;
  }

  function getPath(state, path) {
    const [domain, key] = String(path).split(".");
    return state.domains?.[domain]?.indicators?.[key];
  }

  function setPath(state, path, value) {
    const [domain, key] = String(path).split(".");
    if (!state.domains?.[domain] || !Object.prototype.hasOwnProperty.call(state.domains[domain].indicators, key)) return false;
    state.domains[domain].indicators[key] = clamp(value);
    return true;
  }

  function setLever(state, domainId, leverId, value) {
    const domain = state.domains[domainId];
    if (!domain || !Object.prototype.hasOwnProperty.call(domain.levers, leverId)) throw new Error("Alavanca de política inexistente.");
    domain.levers[leverId] = clamp(value, -100, 100);
    return clone(domain.levers[leverId]);
  }

  function applyEvent(state, event = {}) {
    const domain = state.domains[event.domain];
    if (!domain) throw new Error("Área de política pública inexistente.");
    const indicator = String(event.indicator || "");
    if (!Object.prototype.hasOwnProperty.call(domain.indicators, indicator)) throw new Error("Indicador não pertence à área informada.");
    const delta = Math.max(-25, Math.min(25, numberOr(event.delta, 0)));
    const before = domain.indicators[indicator];
    domain.indicators[indicator] = clamp(before + delta);
    const record = { month: state.currentMonth, domain: event.domain, indicator, delta: round1(domain.indicators[indicator] - before), reason: String(event.reason || "Evento de política pública") };
    state.events.push(record);
    if (state.events.length > 120) state.events.shift();
    return clone(record);
  }

  function updateResources(state, month) {
    const infra = state.domains.infrastructure;
    const l = infra.levers;
    const r = state.resources;
    r.water.renewableRecharge = round1(2 + (infra.indicators.waterSecurity - 50) * 0.025 + l.waterSecurity * 0.02);
    r.water.extraction = round1(Math.max(0, 2.5 - l.waterSecurity * 0.012));
    r.water.reserves = clamp(r.water.reserves + r.water.renewableRecharge - r.water.extraction, 0, 100);
    r.water.quality = clamp(r.water.quality + (infra.indicators.sanitation - 50) * 0.018);

    const electricityInvestment = l.electricity * 0.025 + l.energyTransition * 0.018;
    r.electricity.generation = clamp(r.electricity.generation + electricityInvestment - 0.15);
    r.electricity.demand = clamp(45 + state.domains.development.productivity * 0.08 + state.domains.science.technologyDiffusion * 0.04, 0, 100);
    r.electricity.reliability = clamp(45 + (r.electricity.generation - r.electricity.demand) * 0.7 + infra.indicators.electricityReliability * 0.25);
    r.electricity.renewableShare = clamp(r.electricity.renewableShare + l.energyTransition * 0.02);

    r.oil.production = clamp(r.oil.production + l.oilAndGas * 0.025 - 0.08);
    r.oil.refining = clamp(r.oil.refining + l.oilAndGas * 0.012 - 0.05);
    r.oil.reserves = clamp(r.oil.reserves - Math.max(0, r.oil.production - 20) * 0.006, 0, 100);
    r.oil.strategicStock = clamp(r.oil.strategicStock + (r.oil.production - r.oil.refining) * 0.02 - 0.05);

    r.minerals.extraction = clamp(r.minerals.extraction + l.miningProduction * 0.018 - 0.05);
    r.minerals.processing = clamp(r.minerals.processing + l.miningProduction * 0.012 - 0.04);
    r.minerals.reserves = clamp(r.minerals.reserves - Math.max(0, r.minerals.extraction - 15) * 0.004, 0, 100);
    r.minerals.governance = clamp(r.minerals.governance + l.miningGovernance * 0.015);
    r.minerals.environmentalPressure = clamp(r.minerals.environmentalPressure + Math.max(0, r.minerals.extraction - 20) * 0.025 - infra.indicators.resourceGovernance * 0.008);
    infra.indicators.energyCapacity = clamp((r.electricity.generation + r.oil.production) / 1.3);
    infra.indicators.electricityReliability = clamp(r.electricity.reliability);
    infra.indicators.waterSecurity = clamp(r.water.reserves);
    infra.indicators.resourceGovernance = clamp((r.minerals.governance + 100 - r.minerals.environmentalPressure) / 2);
    infra.lastResourceMonth = month;
  }

  function applyLevers(state) {
    const h = state.domains.health;
    h.indicators.access = clamp(h.indicators.access + h.levers.primaryCare * 0.018);
    h.indicators.capacity = clamp(h.indicators.capacity + h.levers.hospitalCapacity * 0.016);
    h.indicators.prevention = clamp(h.indicators.prevention + h.levers.prevention * 0.02);
    h.indicators.healthOutcomes = clamp(h.indicators.healthOutcomes + (h.indicators.prevention - 50) * 0.012 + (h.indicators.access - 50) * 0.008);
    h.indicators.mentalHealth = clamp(h.indicators.mentalHealth + h.levers.mentalHealth * 0.016);
    h.indicators.healthOutcomes = clamp(h.indicators.healthOutcomes + (h.indicators.mentalHealth - 50) * 0.004);

    const e = state.domains.education;
    e.indicators.access = clamp(e.indicators.access + e.levers.earlyYears * 0.012);
    e.indicators.attendance = clamp(e.indicators.attendance + (e.indicators.access - 50) * 0.01 + (h.indicators.healthOutcomes - 50) * 0.008);
    e.indicators.learning = clamp(e.indicators.learning + e.levers.teacherDevelopment * 0.018 + (e.indicators.infrastructure - 50) * 0.006);
    e.indicators.qualification = clamp(e.indicators.qualification + e.levers.technicalTraining * 0.016 + (e.indicators.learning - 50) * 0.006);
    e.indicators.infrastructure = clamp(e.indicators.infrastructure + e.levers.basicEducation * 0.014);

    const s = state.domains.security;
    s.indicators.prevention = clamp(s.indicators.prevention + s.levers.prevention * 0.018 + (e.indicators.attendance - 50) * 0.004);
    s.indicators.response = clamp(s.indicators.response + s.levers.civilProtection * 0.014);
    s.indicators.investigation = clamp(s.indicators.investigation + s.levers.investigation * 0.016);
    s.indicators.justiceCapacity = clamp(s.indicators.justiceCapacity + s.levers.investigation * 0.006);
    s.indicators.publicTrust = clamp(s.indicators.publicTrust + (s.indicators.prevention - 50) * 0.006 - Math.max(0, 45 - s.indicators.justiceCapacity) * 0.008 + s.levers.reintegration * 0.008);

    const c = state.domains.science;
    c.indicators.research = clamp(c.indicators.research + c.levers.basicResearch * 0.018);
    c.indicators.appliedResearch = clamp(c.indicators.appliedResearch + c.levers.appliedResearch * 0.02);
    c.indicators.innovation = clamp(c.indicators.innovation + c.levers.innovation * 0.018 + (c.indicators.appliedResearch - 50) * 0.006);
    c.indicators.technologyDiffusion = clamp(c.indicators.technologyDiffusion + c.levers.digitalInfrastructure * 0.018 + (c.indicators.innovation - 50) * 0.006);
    c.indicators.talent = clamp(c.indicators.talent + (e.indicators.qualification - 50) * 0.01);

    const d = state.domains.development;
    d.indicators.infrastructure = clamp(d.indicators.infrastructure + d.levers.transport * 0.016);
    d.indicators.logistics = clamp(d.indicators.logistics + d.levers.transport * 0.018);
    d.indicators.housing = clamp(d.indicators.housing + d.levers.housing * 0.015);
    d.indicators.productivity = clamp(d.indicators.productivity + d.levers.industry * 0.012 + (c.indicators.innovation - 50) * 0.006 + (e.indicators.qualification - 50) * 0.004);
    d.indicators.regionalBalance = clamp(d.indicators.regionalBalance + d.levers.regionalInvestment * 0.014);

    const k = state.domains.culture;
    k.indicators.access = clamp(k.indicators.access + k.levers.access * 0.016);
    k.indicators.heritage = clamp(k.indicators.heritage + k.levers.heritage * 0.014);
    k.indicators.creativeEconomy = clamp(k.indicators.creativeEconomy + k.levers.creativeEconomy * 0.016 + (d.indicators.productivity - 50) * 0.003);
    k.indicators.participation = clamp(k.indicators.participation + k.levers.localCulture * 0.018 + (k.indicators.access - 50) * 0.006);

    const i = state.domains.infrastructure;
    i.indicators.sanitation = clamp(i.indicators.sanitation + i.levers.sanitation * 0.018);
    i.indicators.waterSecurity = clamp(i.indicators.waterSecurity + i.levers.waterSecurity * 0.014);
    i.indicators.electricityReliability = clamp(i.indicators.electricityReliability + i.levers.electricity * 0.014);
    i.indicators.resourceGovernance = clamp(i.indicators.resourceGovernance + i.levers.miningGovernance * 0.012);
    i.indicators.energyCapacity = clamp(i.indicators.energyCapacity + i.levers.oilAndGas * 0.008 + i.levers.electricity * 0.006);
  }

  function applyCrossEffects(state) {
    const deltas = {};
    for (const effect of CROSS_EFFECTS) {
      const source = getPath(state, effect.from);
      const target = getPath(state, effect.to);
      if (!finite(source) || !finite(target)) continue;
      const delta = (source - 50) * effect.factor;
      deltas[effect.to] = (deltas[effect.to] || 0) + delta;
    }
    for (const [path, delta] of Object.entries(deltas)) setPath(state, path, getPath(state, path) + delta);
    return deltas;
  }

  function calculateSatisfaction(domain) {
    const values = Object.values(domain.indicators);
    return round1(values.reduce((a, b) => a + b, 0) / Math.max(1, values.length));
  }

  function updateDemandsAndGovernance(state, demographics = null) {
    if (!state.governance) {
      state.governance = {
        demands: {},
        civicPressure: 0,
        civicStatus: "Estabilidade Cívica & Apoio Comunitário",
        activeOutbreak: null,
        activeSecurityIncident: null,
        actionHistory: []
      };
    }
    const pop = Math.max(1, numberOr(demographics?.population, 13));
    const children = Math.max(0, numberOr(demographics?.children, 2));
    const elderly = Math.max(0, numberOr(demographics?.elderly, 2));
    const households = Math.max(1, numberOr(demographics?.households, 5));

    // 1. Saúde: Demanda e Capacidade
    const healthDemand = Math.round(pop * 0.9 + children * 0.4 + elderly * 0.8);
    const healthCapIndicator = state.domains?.health?.indicators?.capacity || 40;
    const healthAccessIndicator = state.domains?.health?.indicators?.access || 45;
    const healthCapacity = Math.max(1, Math.round((healthCapIndicator / 100) * (pop * 1.4) + healthAccessIndicator * 0.08));
    const healthCoverage = clamp(round1((healthCapacity / healthDemand) * 100), 0, 100);
    const healthDeficit = Math.max(0, healthDemand - healthCapacity);
    const healthPressure = clamp(round1(Math.max(0, 100 - healthCoverage)), 0, 100);

    // 2. Educação: Vagas e Demanda de Crianças
    const eduDemand = Math.max(1, children);
    const eduAccess = state.domains?.education?.indicators?.access || 50;
    const eduInfra = state.domains?.education?.indicators?.infrastructure || 40;
    const eduCapacity = Math.max(1, Math.round((eduAccess / 100) * (children * 1.5) + eduInfra * 0.05));
    const eduCoverage = clamp(round1((eduCapacity / eduDemand) * 100), 0, 100);
    const eduDeficit = Math.max(0, eduDemand - eduCapacity);
    const eduPressure = clamp(round1(Math.max(0, 100 - eduCoverage)), 0, 100);

    // 3. Saneamento e Doenças
    const sanDemand = households;
    const sanCoverage = round1(state.domains?.infrastructure?.indicators?.sanitation || 35);
    const prevHealth = state.domains?.health?.indicators?.prevention || 38;
    const sanitaryRisk = clamp(round1(Math.max(0, 65 - sanCoverage) * 1.6 + Math.max(0, 50 - prevHealth) * 0.6), 0, 100);
    const sanPressure = clamp(round1(sanitaryRisk * 1.1), 0, 100);

    // Gatilho de Surtos Epidemiológicos
    const relief = Number(state.governance.sanitaryReliefMonths) || 0;
    if (sanitaryRisk >= 48 && !state.governance.activeOutbreak && relief <= 0) {
      state.governance.activeOutbreak = {
        month: state.currentMonth,
        name: "Surto de Gastroenterite e Arbovirose",
        severity: sanitaryRisk >= 70 ? "Grave" : "Moderado",
        absenteeism: sanitaryRisk >= 70 ? 0.22 : 0.12,
        emergencyCost: sanitaryRisk >= 70 ? 450 : 250,
        description: "Contaminação de mananciais e esgoto a céu aberto provocam aumento de casos de diarreia infantil e febres."
      };
      if (Array.isArray(state.events)) {
        state.events.push({
          month: state.currentMonth,
          domain: "health",
          indicator: "healthOutcomes",
          delta: -10,
          reason: "Surto epidemiológico decorrente de carência de saneamento"
        });
      }
    } else if ((sanitaryRisk < 35 || relief > 0) && state.governance.activeOutbreak) {
      state.governance.activeOutbreak = null;
      if (Array.isArray(state.events)) {
        state.events.push({
          month: state.currentMonth,
          domain: "health",
          indicator: "healthOutcomes",
          delta: +6,
          reason: "Surto debelado com melhoria das condições sanitárias e vacinação"
        });
      }
    }

    // 4. Segurança e Ordem Pública
    const secPrev = state.domains?.security?.indicators?.prevention || 40;
    const secResp = state.domains?.security?.indicators?.response || 40;
    const secRisk = clamp(round1(Math.max(0, 65 - secPrev) * 0.8 + Math.max(0, 60 - secResp) * 0.4), 0, 100);
    const safetyIndex = clamp(round1(100 - secRisk), 0, 100);
    const secPressure = clamp(round1(secRisk * 0.9), 0, 100);

    if (safetyIndex < 35 && !state.governance.activeSecurityIncident) {
      state.governance.activeSecurityIncident = {
        month: state.currentMonth,
        description: "Ocorrências de Furtos Noturnos e Desordem",
        commercialLoss: 0.08
      };
    } else if (safetyIndex >= 50 && state.governance.activeSecurityIncident) {
      state.governance.activeSecurityIncident = null;
    }

    // 5. Cidadania e Mobilização Social
    const civicPressure = clamp(round1(healthPressure * 0.3 + eduPressure * 0.25 + sanPressure * 0.25 + secPressure * 0.2), 0, 100);
    let civicStatus = "Estabilidade Cívica & Apoio Comunitário";
    if (civicPressure >= 80) civicStatus = "Piquete & Mobilização Social Ativa";
    else if (civicPressure >= 60) civicStatus = "Tensão Popular & Risco de Protesto";
    else if (civicPressure >= 30) civicStatus = "Cobrança Democrática & Demandas Protocoladas";

    state.governance.demands = {
      health: { demand: healthDemand, capacity: healthCapacity, coverage: healthCoverage, deficit: healthDeficit, pressure: healthPressure },
      education: { demand: eduDemand, capacity: eduCapacity, coverage: eduCoverage, deficit: eduDeficit, pressure: eduPressure },
      sanitation: { demand: sanDemand, coverage: sanCoverage, sanitaryRisk, pressure: sanPressure },
      security: { risk: secRisk, safetyIndex, pressure: secPressure }
    };
    state.governance.civicPressure = civicPressure;
    state.governance.civicStatus = civicStatus;

    return state.governance;
  }

  function executeGovernanceAction(state, actionId, context = {}) {
    const action = GOVERNANCE_ACTIONS[actionId];
    if (!action) throw new Error(`Ação de governabilidade inexistente: ${actionId}`);
    if (!state.governance) updateDemandsAndGovernance(state);

    const imp = action.impacts;
    if (imp.sanitationDelta && state.domains.infrastructure) {
      state.domains.infrastructure.indicators.sanitation = clamp(state.domains.infrastructure.indicators.sanitation + imp.sanitationDelta);
    }
    if (imp.preventionDelta) {
      if (state.domains.health) state.domains.health.indicators.prevention = clamp(state.domains.health.indicators.prevention + imp.preventionDelta);
      if (state.domains.security) state.domains.security.indicators.prevention = clamp(state.domains.security.indicators.prevention + imp.preventionDelta * 0.5);
    }
    if (imp.healthAccessDelta && state.domains.health) {
      state.domains.health.indicators.access = clamp(state.domains.health.indicators.access + imp.healthAccessDelta);
    }
    if (imp.capacityDelta && state.domains.health) {
      state.domains.health.indicators.capacity = clamp(state.domains.health.indicators.capacity + imp.capacityDelta);
    }
    if (imp.educationAccessDelta && state.domains.education) {
      state.domains.education.indicators.access = clamp(state.domains.education.indicators.access + imp.educationAccessDelta);
    }
    if (imp.attendanceDelta && state.domains.education) {
      state.domains.education.indicators.attendance = clamp(state.domains.education.indicators.attendance + imp.attendanceDelta);
    }
    if (imp.publicTrustDelta && state.domains.security) {
      state.domains.security.indicators.publicTrust = clamp(state.domains.security.indicators.publicTrust + imp.publicTrustDelta);
    }
    if (imp.civicPressureReduction) {
      state.governance.civicPressure = clamp(state.governance.civicPressure - imp.civicPressureReduction);
    }

    if (actionId === "action_sanitary_clean" || actionId === "action_health_campaign") {
      state.governance.activeOutbreak = null;
      state.governance.sanitaryReliefMonths = 2;
    }
    if (state.governance.activeSecurityIncident && actionId === "action_security_patrol") {
      state.governance.activeSecurityIncident = null;
      state.governance.securityReliefMonths = 2;
    }

    const record = {
      id: action.id,
      name: action.name,
      month: state.currentMonth,
      cost: action.cost,
      description: action.description,
      executedAt: Date.now()
    };
    state.governance.actionHistory.push(record);
    if (state.governance.actionHistory.length > 30) state.governance.actionHistory.shift();

    updateDemandsAndGovernance(state, context.demographics);

    return {
      success: true,
      action: record,
      governance: clone(state.governance)
    };
  }

  function advanceMonth(state, options = {}) {
    const month = Math.max(state.currentMonth + 1, Math.floor(numberOr(options.month, state.currentMonth + 1)));
    const before = {};
    for (const id of DOMAIN_IDS) before[id] = clone(state.domains[id].indicators);
    applyLevers(state);
    updateResources(state, month);
    const crossEffects = applyCrossEffects(state);
    state.currentMonth = month;
    for (const id of DOMAIN_IDS) {
      const domain = state.domains[id];
      domain.satisfaction = calculateSatisfaction(domain);
      domain.lastChange = {};
      for (const [key, value] of Object.entries(domain.indicators)) domain.lastChange[key] = round1(value - before[id][key]);
      domain.history.push({ month, satisfaction: domain.satisfaction, indicators: clone(domain.indicators) });
      if (domain.history.length > 36) domain.history.shift();
    }
    if (state.governance?.sanitaryReliefMonths > 0) state.governance.sanitaryReliefMonths -= 1;
    if (state.governance?.securityReliefMonths > 0) state.governance.securityReliefMonths -= 1;
    updateDemandsAndGovernance(state, options.demographics || null);
    const summary = {
      month,
      crossEffects: clone(crossEffects),
      satisfaction: Object.fromEntries(DOMAIN_IDS.map((id) => [id, state.domains[id].satisfaction])),
      governance: clone(state.governance)
    };
    state.history.push(summary);
    if (state.history.length > 60) state.history.shift();
    return clone(summary);
  }

  function resetState(state, options = {}) {
    const next = createState(options);
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, next);
    return state;
  }

  function getSnapshot(state) {
    return clone({
      version: VERSION,
      currentMonth: state.currentMonth,
      domains: state.domains,
      resources: state.resources,
      publicCapacity: state.publicCapacity,
      governance: state.governance,
      events: state.events.slice(-20),
      history: state.history.slice(-24),
      assumptions: state.assumptions
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function renderDashboard(state, host) {
    if (!host) return false;
    const snapshot = getSnapshot(state);
    const labels = {
      health: ["Acesso", "Capacidade", "Prevenção", "Resultados", "Força de trabalho", "Saúde mental"],
      education: ["Acesso", "Frequência", "Aprendizagem", "Infraestrutura", "Qualificação"],
      security: ["Prevenção", "Resposta", "Investigação", "Justiça", "Confiança"],
      science: ["Pesquisa", "Inovação", "Difusão tecnológica", "Talentos", "Pesquisa aplicada"],
      development: ["Infraestrutura", "Logística", "Habitação", "Produtividade", "Equilíbrio regional"],
      culture: ["Acesso", "Patrimônio", "Economia criativa", "Participação", "Diversidade"],
      infrastructure: ["Saneamento", "Segurança hídrica", "Confiabilidade elétrica", "Capacidade energética", "Governança de recursos"]
    };
    const leverLabels = {
      primaryCare: "Atenção primária", hospitalCapacity: "Capacidade hospitalar", prevention: "Prevenção", mentalHealth: "Saúde mental",
      earlyYears: "Educação infantil", basicEducation: "Educação básica", technicalTraining: "Formação técnica", teacherDevelopment: "Formação docente",
      investigation: "Investigação", civilProtection: "Proteção civil", reintegration: "Reinserção social",
      basicResearch: "Pesquisa básica", appliedResearch: "Pesquisa aplicada", innovation: "Inovação", digitalInfrastructure: "Infraestrutura digital",
      transport: "Transportes", housing: "Habitação", industry: "Indústria", regionalInvestment: "Investimento regional",
      access: "Acesso cultural", heritage: "Patrimônio", creativeEconomy: "Economia criativa", localCulture: "Cultura local",
      sanitation: "Saneamento", electricity: "Energia elétrica", energyTransition: "Transição energética", oilAndGas: "Petróleo e gás", miningProduction: "Produção mineral", miningGovernance: "Governança mineral", waterSecurity: "Segurança hídrica"
    };
    const cards = DOMAIN_IDS.map((id) => {
      const d = snapshot.domains[id];
      const metrics = Object.entries(d.indicators).map(([key, value], index) => `<div class="service-metric"><span>${escapeHtml(labels[id][index] || key)}</span><b>${round1(value).toFixed(1)}</b></div>`).join("");
      const leverRows = Object.entries(d.levers).map(([key, value]) => `<label class="service-lever-control"><span>${escapeHtml(leverLabels[key] || key)}</span><b data-lever-value>${round1(value).toFixed(0)}</b><input type="range" min="-100" max="100" step="5" value="${round1(value)}" data-service-lever="${escapeHtml(key)}" data-service-domain="${escapeHtml(id)}" aria-label="Intensidade de ${escapeHtml(key)} em ${escapeHtml(d.name)}"></label>`).join("");
      return `<article class="service-card service-${id}"><div class="service-card-head"><span class="service-icon">${escapeHtml(d.icon)}</span><div><h3>${escapeHtml(d.name)}</h3><p>${escapeHtml(d.description)}</p></div></div><div class="service-score"><strong>${d.satisfaction.toFixed(1)}</strong><span>índice médio da área</span></div><div class="service-metrics">${metrics}</div><details class="service-details"><summary>Prioridades e instrumentos</summary><div class="service-priorities">${d.priorities.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div><div class="service-levers">${leverRows}</div></details></article>`;
    }).join("");
    const r = snapshot.resources;
    host.innerHTML = `<div class="services-dashboard"><div class="services-intro-note"><strong>Visão integrada do Estado</strong><span>Os índices são parâmetros de cenário. Ajuste a intensidade das políticas para orientar a evolução de cada área. Os efeitos aparecem gradualmente e atravessam os demais setores. O custo fiscal, a contratação de pessoal e a execução física das obras serão conectados ao orçamento na próxima integração.</span></div><div class="services-grid">${cards}</div><section class="service-resource-panel"><div class="eyebrow">BASE MATERIAL DO ESTADO</div><h2>Recursos e infraestrutura estratégica</h2><div class="service-resource-grid"><div><span>Água e reservas</span><b>${r.water.reserves.toFixed(1)}</b><small>Qualidade ${r.water.quality.toFixed(1)}</small></div><div><span>Energia elétrica</span><b>${r.electricity.reliability.toFixed(1)}</b><small>Geração ${r.electricity.generation.toFixed(1)} · Demanda ${r.electricity.demand.toFixed(1)}</small></div><div><span>Petróleo e gás</span><b>${r.oil.reserves.toFixed(1)}</b><small>Produção ${r.oil.production.toFixed(1)} · Refino ${r.oil.refining.toFixed(1)}</small></div><div><span>Mineração</span><b>${r.minerals.reserves.toFixed(1)}</b><small>Governança ${r.minerals.governance.toFixed(1)} · Pressão ambiental ${r.minerals.environmentalPressure.toFixed(1)}</small></div></div></section></div>`;
    host.querySelectorAll?.("[data-service-lever]").forEach((input) => {
      input.addEventListener("change", () => {
        const domainId = input.dataset.serviceDomain;
        const leverId = input.dataset.serviceLever;
        const value = Number(input.value);
        if (typeof host.__serviceSetLever === "function") host.__serviceSetLever(domainId, leverId, value);
        else setLever(state, domainId, leverId, value);
        renderDashboard(state, host);
      });
    });
    return true;
  }

  function registerWithRuntime(runtime, options = {}) {
    if (!runtime || !runtime.modules || !runtime.events || typeof runtime.publish !== "function") throw new TypeError("Runtime incompleto para Serviços Públicos.");
    if (!runtime.modules.has("core") || !runtime.modules.has("economia") || !runtime.modules.has("sociedade")) throw new Error("Serviços Públicos exige Core, Economia e Sociedade.");
    if (runtime.modules.has("servicos")) return { alreadyRegistered: true, state: null, dispose() {} };
    const moduleNames = { health: "saude", education: "educacao", security: "seguranca", science: "ciencia", development: "desenvolvimento", culture: "cultura", infrastructure: "infraestrutura" };
    const moduleTitles = { health: "Saúde", education: "Educação", security: "Segurança", science: "Ciência e Tecnologia", development: "Desenvolvimento", culture: "Cultura", infrastructure: "Infraestrutura e Recursos Estratégicos" };
    for (const id of DOMAIN_IDS) runtime.modules.register({ id: moduleNames[id], version: VERSION, name: moduleTitles[id], dependencies: ["core", "economia", "sociedade"], description: DOMAIN_DEFINITIONS[id].description });
    runtime.modules.register({ id: "servicos", version: VERSION, name: "Serviços e desenvolvimento", dependencies: DOMAIN_IDS.map((id) => moduleNames[id]), description: "Painel integrado de políticas públicas, demandas da cidadania e recursos estratégicos." });
    
    let latestDemographics = null;
    if (runtime.population && typeof runtime.population.getSnapshot === "function") {
      const snap = runtime.population.getSnapshot();
      if (snap?.totals) {
        latestDemographics = {
          population: snap.totals.population || 13,
          households: snap.totals.households || 5
        };
      }
    }

    const state = createState({ ...options, demographics: latestDemographics });
    const publishSnapshot = (source = "servicos") => {
      const snapshot = getSnapshot(state);
      runtime.modules.updateSnapshot("servicos", snapshot, source);
      for (const id of DOMAIN_IDS) runtime.modules.updateSnapshot(moduleNames[id], clone(snapshot.domains[id]), source);
      return snapshot;
    };
    publishSnapshot("servicos.initial");
    const unsubs = [];
    unsubs.push(runtime.events.on("game:reset", () => { resetState(state, options); publishSnapshot("servicos.reset"); }));

    unsubs.push(runtime.events.on("society:month-closed", (event) => {
      const payload = event?.payload;
      if (payload?.demographic) {
        latestDemographics = {
          population: payload.demographic.population,
          children: payload.demographic.children,
          workingAge: payload.demographic.workingAge,
          elderly: payload.demographic.elderly,
          households: payload.economyProjection?.length || 5
        };
      }
    }));

    unsubs.push(runtime.events.on("economy:month-closed", (event) => {
      const month = Math.max(state.currentMonth + 1, Math.floor(numberOr(event?.payload?.monthNumber, runtime.clock?.snapshot?.().economicMonthNumber || state.currentMonth + 1)));
      const result = advanceMonth(state, { month, demographics: latestDemographics });
      const snapshot = publishSnapshot("servicos.month-closed");
      runtime.publish("services:month-closed", { ...result, snapshot }, "servicos");

      if (snapshot.governance?.activeOutbreak) {
        runtime.publish("services:sanitary-outbreak", snapshot.governance.activeOutbreak, "servicos");
      }
      if (snapshot.governance?.activeSecurityIncident) {
        runtime.publish("services:security-incident", snapshot.governance.activeSecurityIncident, "servicos");
      }
    }));

    unsubs.push(runtime.events.on("services:policy-impact", (event) => {
      const result = applyEvent(state, event?.payload || {});
      const snapshot = publishSnapshot("servicos.policy-impact");
      runtime.publish("services:indicator-updated", { ...result, snapshot }, "servicos");
    }));

    unsubs.push(runtime.events.on("services:governance-action", (event) => {
      const actionId = event?.payload?.actionId;
      if (actionId) {
        const result = executeGovernanceAction(state, actionId, { demographics: latestDemographics });
        const snapshot = publishSnapshot("servicos.governance-action");
        runtime.publish("services:governance-updated", { ...result, snapshot }, "servicos");
      }
    }));

    return {
      alreadyRegistered: false, state, getSnapshot: () => getSnapshot(state),
      setLever: (domainId, leverId, value) => { const result = setLever(state, domainId, leverId, value); publishSnapshot("servicos.lever-updated"); runtime.publish("services:policy-updated", { domainId, leverId, value: result }, "servicos"); return result; },
      applyEvent: (event) => { const result = applyEvent(state, event); publishSnapshot("servicos.event"); runtime.publish("services:indicator-updated", result, "servicos"); return result; },
      executeGovernanceAction: (actionId) => {
        const result = executeGovernanceAction(state, actionId, { demographics: latestDemographics });
        publishSnapshot("servicos.governance-action");
        runtime.publish("services:governance-updated", result, "servicos");
        return result;
      },
      dispose() { unsubs.forEach((unsubscribe) => unsubscribe()); }
    };
  }

  if (root?.VilarejoRuntime) {
    try { root.VilarejoServicesRuntime = registerWithRuntime(root.VilarejoRuntime); }
    catch (error) { if (root.console?.error) root.console.error("Falha ao registrar Serviços Públicos:", error); }
  }

  return {
    VERSION,
    DOMAIN_DEFINITIONS: clone(DOMAIN_DEFINITIONS),
    DOMAIN_IDS: [...DOMAIN_IDS],
    CROSS_EFFECTS: clone(CROSS_EFFECTS),
    GOVERNANCE_ACTIONS: clone(GOVERNANCE_ACTIONS),
    createState,
    setLever,
    applyEvent,
    updateResources,
    applyLevers,
    applyCrossEffects,
    updateDemandsAndGovernance,
    executeGovernanceAction,
    advanceMonth,
    getSnapshot,
    renderDashboard,
    registerWithRuntime
  };
});
