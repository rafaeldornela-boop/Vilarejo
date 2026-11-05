(function attachVilarejoIntelligence(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && typeof root === "object") {
    root.VilarejoIntelligence = api;
    if (root.VilarejoRuntime && !root.VilarejoIntelligenceRuntime) {
      try {
        root.VilarejoIntelligenceRuntime = api.registerWithRuntime(root.VilarejoRuntime, { window: root });
      } catch (error) {
        if (root.console && typeof root.console.error === "function") root.console.error("Falha ao registrar o módulo de Inteligência:", error);
      }
    }
  }
})(typeof window !== "undefined" ? window : globalThis, function createVilarejoIntelligence() {
  "use strict";

  const VERSION = "1.0.0";
  const STORE_VERSION = 2;
  const LEGACY_STORE_VERSION = 1;
  const STORAGE_KEY = "vilarejo:intelligence:history:v1";
  const SESSION_KEY = "vilarejo:intelligence:run:v1";
  const MAX_MONTHS_PER_RUN = 60;

  const METRICS = Object.freeze([
    { id: "population", label: "População (Core/Economia)", unit: "habitantes", kind: "stock", source: "Diretório populacional do Core, sincronizado pela Economia", trendThreshold: 2 },
    { id: "populationSociety", label: "População cadastrada (Sociedade)", unit: "moradores", kind: "stock", source: "Snapshot demográfico da Sociedade", trendThreshold: 2 },
    { id: "gdpProduction", label: "PIB — ótica da produção", unit: "R$ nominais/mês simulado", kind: "monthly-flow", source: "Contas Nacionais da Economia: approaches.production", trendThreshold: 2 },
    { id: "vabTotal", label: "Valor adicionado bruto total", unit: "R$ nominais/mês simulado", kind: "monthly-flow", source: "Contas Nacionais da Economia: vab.totalVAB", trendThreshold: 2 },
    { id: "vabAgriculture", label: "VAB — agropecuária", unit: "R$ nominais/mês simulado", kind: "monthly-flow", source: "Contas Nacionais da Economia: vab.agriculture", trendThreshold: 2 },
    { id: "vabCommerce", label: "VAB — comércio", unit: "R$ nominais/mês simulado", kind: "monthly-flow", source: "Contas Nacionais da Economia: vab.commerce", trendThreshold: 2 },
    { id: "vabWorkshop", label: "VAB — oficina e serviços locais", unit: "R$ nominais/mês simulado", kind: "monthly-flow", source: "Contas Nacionais da Economia: vab.workshop", trendThreshold: 2 },
    { id: "gdpIncome", label: "PIB — ótica da renda", unit: "R$ nominais/mês simulado", kind: "monthly-flow", source: "Contas Nacionais da Economia: approaches.income", trendThreshold: 2 },
    { id: "employeeCompensation", label: "Remuneração total do trabalho", unit: "R$ nominais/mês simulado", kind: "monthly-flow", source: "Contas Nacionais da Economia: components.employeeCompensation", trendThreshold: 2 },
    { id: "householdConsumption", label: "Consumo das famílias", unit: "R$ nominais/mês simulado", kind: "monthly-flow", source: "Contas Nacionais da Economia: components.householdConsumption", trendThreshold: 2 },
    { id: "employmentCount", label: "Pessoas ocupadas", unit: "pessoas", kind: "stock", source: "Estatísticas do mercado de trabalho da Economia", trendThreshold: 2 },
    { id: "laborForce", label: "Força de trabalho", unit: "pessoas", kind: "stock", source: "Estatísticas do mercado de trabalho da Economia", trendThreshold: 2 },
    { id: "unemploymentRate", label: "Desocupação", unit: "% da força de trabalho", kind: "rate", source: "Economia: desocupados à procura / força de trabalho", trendThreshold: 1 },
    { id: "participationRate", label: "Participação na força de trabalho", unit: "% da população em idade de trabalho", kind: "rate", source: "Estatísticas do mercado de trabalho da Economia", trendThreshold: 1 },
    { id: "inflationMonthly", label: "Inflação mensal", unit: "% no mês simulado", kind: "rate", source: "Economia: monthlyInflation", trendThreshold: 1 },
    { id: "costIndex", label: "Índice de custo de vida", unit: "índice (base do motor = 100)", kind: "index", source: "Economia: costOfLivingIndex", trendThreshold: 2 },
    { id: "realWageIndex", label: "Índice do salário de referência real", unit: "índice calculado (referência inicial = 100)", kind: "index", source: "Salário de referência nominal dividido pelo índice de custo de vida; não é renda média familiar", trendThreshold: 2 },
    { id: "approval", label: "Aprovação modelada", unit: "% (índice do motor)", kind: "rate", source: "Economia: função approval()", trendThreshold: 1 },
    { id: "primaryResult", label: "Resultado primário", unit: "R$ nominais/mês simulado", kind: "monthly-flow", source: "Relatório fiscal da Economia: primaryResult", trendThreshold: 2 },
    { id: "taxRevenue", label: "Receita tributária", unit: "R$ nominais/mês simulado", kind: "monthly-flow", source: "Relatório fiscal da Economia: tributaryRevenue", trendThreshold: 2 },
    { id: "primaryExpenditure", label: "Despesa primária", unit: "R$ nominais/mês simulado", kind: "monthly-flow", source: "Relatório fiscal da Economia: primaryExpenditure", trendThreshold: 2 },
    { id: "governmentDebt", label: "Passivos do governo", unit: "R$ nominais (estoque)", kind: "stock", source: "Balanços setoriais da Economia: government.liabilities", trendThreshold: 2 },
    { id: "birthsMonthly", label: "Nascimentos — mensal", unit: "nascimentos/mês", kind: "monthly-flow", source: "Sociedade: demographicEvents.lastMonth.births", trendThreshold: 1 },
    { id: "deathsMonthly", label: "Óbitos — mensal", unit: "óbitos/mês", kind: "monthly-flow", source: "Sociedade: demographicEvents.lastMonth.deaths", trendThreshold: 1 },
    { id: "birthsCumulative", label: "Nascimentos — acumulado", unit: "nascimentos desde o início da execução", kind: "cumulative", source: "Sociedade: demographicEvents.births", trendThreshold: 1 },
    { id: "deathsCumulative", label: "Óbitos — acumulado", unit: "óbitos desde o início da execução", kind: "cumulative", source: "Sociedade: demographicEvents.deaths", trendThreshold: 1 },
    { id: "immigrationMonthly", label: "Imigração — mensal", unit: "pessoas/mês", kind: "monthly-flow", source: "Sociedade: migration.monthly.incoming", trendThreshold: 1 },
    { id: "emigrationMonthly", label: "Emigração — mensal", unit: "pessoas/mês", kind: "monthly-flow", source: "Sociedade: migration.monthly.outgoing", trendThreshold: 1 },
    { id: "netMigrationMonthly", label: "Migração líquida — mensal", unit: "pessoas/mês", kind: "monthly-flow", source: "Sociedade: migration.monthly.net", trendThreshold: 1 },
    { id: "immigrationCumulative", label: "Imigração — acumulado", unit: "pessoas desde o início da execução", kind: "cumulative", source: "Sociedade: migration.cumulative.incoming", trendThreshold: 1 },
    { id: "emigrationCumulative", label: "Emigração — acumulado", unit: "pessoas desde o início da execução", kind: "cumulative", source: "Sociedade: migration.cumulative.outgoing", trendThreshold: 1 },
    { id: "qualityOfLifeScore", label: "Qualidade de vida (provisória quando indicada)", unit: "índice 0–100", kind: "index", source: "Sociedade: qualityOfLife.current.score e coverage", trendThreshold: 2 },
    { id: "qualityOfLifeCoverage", label: "Cobertura da qualidade de vida", unit: "% de dimensões avaliadas", kind: "rate", source: "Sociedade: qualityOfLife.current.coverage", trendThreshold: 1 },
    { id: "mortalityRatePer1000", label: "Mortalidade mensal calculada", unit: "óbitos por mil moradores/mês", kind: "derived-rate", source: "Óbitos mensais da Sociedade / população cadastrada × 1.000", trendThreshold: 1 }
  ]);

  const RULES = Object.freeze([
    { id: "gdp-contraction", metricId: "gdpProduction", type: "decline-percent", window: 3, attention: 10, critical: 20, attentionPersistence: 2, criticalPersistence: 2, thresholdText: "queda do PIB de pelo menos 10% em 3 meses (atenção) ou 20% (crítico), confirmada em janelas mensais consecutivas", explanation: "Sinal de retração do PIB calculado pela ótica da produção. A persistência reduz alertas por oscilação isolada; não identifica a causa." },
    { id: "unemployment-rise", metricId: "unemploymentRate", type: "increase-points", window: 3, attention: 3, critical: 6, attentionPersistence: 2, criticalPersistence: 2, thresholdText: "aumento de desocupação de pelo menos 3 p.p. em 3 meses (atenção) ou 6 p.p. (crítico), em duas janelas consecutivas", explanation: "A taxa aumentou em relação à observação de três meses antes. p.p. significa pontos percentuais, não variação percentual relativa." },
    { id: "high-inflation", metricId: "inflationMonthly", type: "high-level", attention: 5, critical: 10, attentionPersistence: 3, criticalPersistence: 2, thresholdText: "inflação mensal acima de 5% por 3 fechamentos (atenção) ou acima de 10% por 2 fechamentos (crítico)", explanation: "Limites internos conservadores para monitorar inflação mensal no jogo; não são metas oficiais nem diagnóstico de economia real." },
    { id: "population-fall", metricId: "population", type: "decline-percent", window: 3, attention: 2, critical: 5, attentionPersistence: 2, criticalPersistence: 2, thresholdText: "redução populacional de pelo menos 2% em 3 meses (atenção) ou 5% (crítico), confirmada em janelas consecutivas", explanation: "Compara o estoque populacional do Core com o de três meses antes. Não projeta população nem preenche meses sem dado." },
    { id: "income-fall", metricId: "employeeCompensation", type: "decline-percent", window: 3, attention: 10, critical: 20, attentionPersistence: 2, criticalPersistence: 2, thresholdText: "queda da remuneração total do trabalho de pelo menos 10% em 3 meses (atenção) ou 20% (crítico), em janelas consecutivas", explanation: "A remuneração agregada é um fluxo nominal mensal do modelo, não renda média por morador nem renda real." },
    { id: "mortality-rise", metricId: "deathsMonthly", type: "mortality", attention: 100, critical: 200, attentionPersistence: 2, criticalPersistence: 2, thresholdText: "pelo menos 2 óbitos no mês e taxa de 100 por mil moradores (atenção) ou 200 por mil (crítico), por dois meses", explanation: "A taxa é calculada a partir do registro mensal da Sociedade e do estoque demográfico. Em comunidades pequenas, a taxa é volátil; exige repetição e não é extrapolada." },
    { id: "quality-of-life-fall", metricId: "qualityOfLifeScore", type: "decline-points", window: 3, attention: 5, critical: 10, attentionPersistence: 2, criticalPersistence: 2, thresholdText: "queda de pelo menos 5 pontos em 3 meses (atenção) ou 10 pontos (crítico), em janelas consecutivas; cobertura mínima de 50%", explanation: "O índice social pode ser provisório. O alerta só é avaliado quando a cobertura declarada pela Sociedade é de ao menos 50%." }
  ]);

  const DASHBOARD_KEYS = Object.freeze({
    gdp: "gdpProduction",
    unemployment: "unemploymentRate",
    approval: "approval",
    costIndex: "costIndex",
    realWageIndex: "realWageIndex",
    primaryResult: "primaryResult",
    inflation: "inflationMonthly",
    consumption: "householdConsumption",
    population: "population",
    taxRevenue: "taxRevenue",
    primaryExpenditure: "primaryExpenditure",
    governmentDebt: "governmentDebt"
  });

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function finiteOrNull(value) {
    if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function cleanMetrics(input) {
    const metrics = {};
    if (!input || typeof input !== "object") return metrics;
    for (const [key, raw] of Object.entries(input)) {
      const value = finiteOrNull(raw);
      if (value !== null) metrics[key] = value;
    }
    return metrics;
  }

  function monthLabel(month) {
    return `Mês ${Math.floor(Number(month) || 0)}`;
  }

  function captureSimulationRecord(payload = {}, runtime, windowRef) {
    const api = windowRef && windowRef.VilarejoTest;
    if (!api || typeof api.stateSnapshot !== "function") return null;
    const state = api.stateSnapshot();
    if (!state) return null;
    const core = runtime && typeof runtime.snapshot === "function" ? runtime.snapshot() : null;
    const clock = runtime && runtime.clock && typeof runtime.clock.snapshot === "function" ? runtime.clock.snapshot() : core?.calendar;
    const month = finiteOrNull(payload.monthNumber) ?? finiteOrNull(state.monthNumber) ?? finiteOrNull(clock?.economicMonthNumber);
    if (month === null) return null;

    const labor = typeof api.getLaborStats === "function" ? api.getLaborStats() : state.laborStats;
    const macro = typeof api.calculateNationalAccounts === "function" ? api.calculateNationalAccounts() : state.nationalAccounts;
    const fiscal = typeof api.calculateFiscalReport === "function" ? api.calculateFiscalReport() : state.fiscalReport;
    const balanceSheets = typeof api.generateBalanceSheets === "function" ? api.generateBalanceSheets() : state.balanceSheets;
    const societyRuntime = windowRef.VilarejoSocietyRuntime;
    const society = societyRuntime && typeof societyRuntime.getSnapshot === "function"
      ? societyRuntime.getSnapshot()
      : (runtime?.modules?.get?.("sociedade")?.snapshot || null);
    const societyEvents = society?.demographicEvents;
    const societyMigration = society?.migration;
    const lastDemographic = societyEvents?.lastMonth;
    const migrationMonth = societyMigration?.monthly;
    const quality = society?.qualityOfLife?.current;
    const metrics = {};
    const metricQuality = {};
    const add = (id, value, qualityLabel) => {
      const number = finiteOrNull(value);
      if (number !== null) metrics[id] = number;
      if (qualityLabel && number !== null) metricQuality[id] = String(qualityLabel);
    };

    const corePopulation = finiteOrNull(payload.population?.total) ?? finiteOrNull(core?.population?.totals?.total);
    add("population", corePopulation);
    add("populationSociety", society?.demographic?.population);

    add("gdpProduction", macro?.approaches?.production ?? macro?.gdp);
    add("vabTotal", macro?.vab?.totalVAB);
    add("vabAgriculture", macro?.vab?.agriculture);
    add("vabCommerce", macro?.vab?.commerce);
    add("vabWorkshop", macro?.vab?.workshop);
    add("gdpIncome", macro?.approaches?.income);
    add("employeeCompensation", macro?.components?.employeeCompensation);
    add("householdConsumption", macro?.components?.householdConsumption);

    add("employmentCount", labor?.occupied);
    add("laborForce", labor?.laborForce);
    add("unemploymentRate", labor?.unemploymentRate);
    add("participationRate", labor?.participationRate);
    add("inflationMonthly", state.monthlyInflation);
    add("costIndex", state.costOfLivingIndex);
    add("approval", state.approval);
    add("primaryResult", fiscal?.primaryResult);
    add("taxRevenue", fiscal?.tributaryRevenue);
    add("primaryExpenditure", fiscal?.primaryExpenditure);
    add("governmentDebt", balanceSheets?.government?.liabilities);

    const nominalReferenceWage = finiteOrNull(state.wage);
    const costIndex = finiteOrNull(state.costOfLivingIndex);
    if (nominalReferenceWage !== null && nominalReferenceWage >= 0 && costIndex !== null && costIndex > 0) {
      add("realWageIndex", (nominalReferenceWage / (costIndex / 100)) / 18);
    }

    if (lastDemographic && Number(lastDemographic.month) === Number(month)) {
      add("birthsMonthly", lastDemographic.births);
      add("deathsMonthly", lastDemographic.deaths);
    }
    add("birthsCumulative", societyEvents?.births);
    add("deathsCumulative", societyEvents?.deaths);
    if (migrationMonth && Number(migrationMonth.month) === Number(month)) {
      add("immigrationMonthly", migrationMonth.incoming);
      add("emigrationMonthly", migrationMonth.outgoing);
      add("netMigrationMonthly", migrationMonth.net);
    }
    add("immigrationCumulative", societyMigration?.cumulative?.incoming);
    add("emigrationCumulative", societyMigration?.cumulative?.outgoing);
    if (quality && Number(quality.month) === Number(month)) {
      add("qualityOfLifeScore", quality.score, quality.provisional ? "provisório: dimensões não medidas" : "cobertura integral das dimensões configuradas");
      add("qualityOfLifeCoverage", quality.coverage);
      if (finiteOrNull(quality.coverage) !== null) metricQuality.qualityOfLifeScore = `${quality.provisional ? "provisório" : "não provisório"}; cobertura ${quality.coverage}%`;
    }
    const societyPopulation = finiteOrNull(society?.demographic?.population);
    const deaths = finiteOrNull(lastDemographic && Number(lastDemographic.month) === Number(month) ? lastDemographic.deaths : null);
    if (societyPopulation !== null && societyPopulation > 0 && deaths !== null) add("mortalityRatePer1000", deaths / societyPopulation * 1000);

    const dateMonth = Math.floor(Number(month));
    return {
      month: dateMonth,
      day: finiteOrNull(payload.day) ?? finiteOrNull(state.day) ?? finiteOrNull(clock?.absoluteDay),
      year: finiteOrNull(payload.year) ?? finiteOrNull(clock?.year),
      metrics,
      metricQuality,
      sources: {
        economy: "VilarejoTest.stateSnapshot + APIs públicas de contas nacionais, trabalho, fiscal e balanços",
        population: "VilarejoRuntime.population / payload de fechamento mensal",
        society: society ? "VilarejoSocietyRuntime.getSnapshot" : null
      }
    };
  }

  function recordsFor(records, metricId, period = 12) {
    const rows = Array.isArray(records) ? records.slice().sort((a, b) => a.month - b.month) : [];
    const recent = rows.slice(-Math.max(1, Math.floor(Number(period) || 12)));
    return recent.map((record) => ({ month: Number(record.month), value: finiteOrNull(record.metrics?.[metricId]), record })).filter((point) => point.value !== null);
  }

  function regression(points) {
    if (!Array.isArray(points) || points.length < 2) return null;
    const xMean = points.reduce((sum, point) => sum + point.month, 0) / points.length;
    const yMean = points.reduce((sum, point) => sum + point.value, 0) / points.length;
    let numerator = 0;
    let denominator = 0;
    for (const point of points) {
      numerator += (point.month - xMean) * (point.value - yMean);
      denominator += (point.month - xMean) ** 2;
    }
    return { slope: denominator ? numerator / denominator : 0, intercept: yMean - (denominator ? numerator / denominator : 0) * xMean };
  }

  function analyzeTrends(records, period = 12) {
    const definitions = new Map(METRICS.map((metric) => [metric.id, metric]));
    const sorted = Array.isArray(records) ? records.slice().sort((a, b) => a.month - b.month).slice(-Math.max(1, Math.floor(Number(period) || 12))) : [];
    const results = [];
    for (const metric of METRICS) {
      const points = recordsFor(sorted, metric.id, sorted.length);
      if (points.length < 3) continue;
      const first = points[0];
      const last = points[points.length - 1];
      const delta = last.value - first.value;
      const relativeChangePct = first.value !== 0 ? delta / Math.abs(first.value) * 100 : null;
      const fit = regression(points);
      const threshold = metric.trendThreshold || 1;
      let direction = "estável";
      if (metric.kind === "rate" || metric.kind === "derived-rate") {
        if (delta >= threshold) direction = "crescimento";
        else if (delta <= -threshold) direction = "retração";
      } else if (relativeChangePct !== null) {
        if (relativeChangePct >= threshold) direction = "crescimento";
        else if (relativeChangePct <= -threshold) direction = "retração";
      } else if (Math.abs(delta) >= threshold) {
        direction = delta > 0 ? "crescimento a partir de zero" : "retração";
      }

      const recent = points.slice(-3);
      const signs = recent.length === 3 ? recent.slice(1).map((point, index) => Math.sign(point.value - recent[index].value)) : [];
      const consecutiveMonths = recent.length === 3 && recent[1].month === recent[0].month + 1 && recent[2].month === recent[1].month + 1;
      const persistent = consecutiveMonths && signs[0] !== 0 && signs[0] === signs[1];
      let acceleration = "dados insuficientes";
      let accelerationPerMonth = null;
      if (points.length >= 6) {
        const middle = Math.ceil(points.length / 2);
        const firstSlope = regression(points.slice(0, middle))?.slope ?? 0;
        const secondSlope = regression(points.slice(middle - 1))?.slope ?? 0;
        accelerationPerMonth = secondSlope - firstSlope;
        const scale = Math.max(Math.abs(firstSlope), Math.abs(secondSlope), 1e-9);
        if (Math.sign(firstSlope) === Math.sign(secondSlope) && Math.abs(secondSlope) > Math.abs(firstSlope) * 1.25) acceleration = "acelerando";
        else if (Math.sign(firstSlope) === Math.sign(secondSlope) && Math.abs(secondSlope) < Math.abs(firstSlope) * 0.75) acceleration = "desacelerando";
        else if (Math.abs(accelerationPerMonth) <= scale * 0.25) acceleration = "ritmo semelhante";
        else acceleration = "mudança de ritmo sem aceleração persistente";
      }
      results.push({
        metricId: metric.id,
        label: definitions.get(metric.id).label,
        unit: metric.unit,
        observations: points.length,
        firstMonth: first.month,
        lastMonth: last.month,
        firstValue: first.value,
        lastValue: last.value,
        delta,
        relativeChangePct,
        slopePerMonth: fit?.slope ?? null,
        direction,
        persistent,
        acceleration,
        accelerationPerMonth,
        fact: `${monthLabel(first.month)}: ${first.value}; ${monthLabel(last.month)}: ${last.value}.`,
        statisticalTrend: `${direction}; ${points.length} observações, inclinação linear ${fit?.slope?.toFixed(3) ?? "n/d"} por mês.`,
        interpretation: persistent ? `A direção é persistente nos 3 últimos meses observados; isso descreve co-movimento, não sua causa.` : "A janela ainda não confirma persistência de três meses; não atribuir causalidade."
      });
    }
    return results;
  }

  function evaluateRule(rule, records, index) {
    const row = records[index];
    const current = finiteOrNull(row?.metrics?.[rule.metricId]);
    if (current === null) return { available: false };
    if (rule.type === "high-level") {
      if (current >= rule.critical) return { available: true, level: "critical", value: current, threshold: rule.thresholdText, change: null };
      if (current >= rule.attention) return { available: true, level: "attention", value: current, threshold: rule.thresholdText, change: null };
      return { available: true, level: null, value: current };
    }
    if (rule.type === "mortality") {
      const rate = finiteOrNull(row.metrics.mortalityRatePer1000);
      if (current < 2 || rate === null) return { available: rate !== null, level: null, value: current, rate };
      if (rate >= rule.critical) return { available: true, level: "critical", value: current, rate, threshold: rule.thresholdText };
      if (rate >= rule.attention) return { available: true, level: "attention", value: current, rate, threshold: rule.thresholdText };
      return { available: true, level: null, value: current, rate };
    }
    const baseRow = records[index - rule.window];
    if (!baseRow || Number(baseRow.month) + rule.window !== Number(row.month)) return { available: false };
    const base = finiteOrNull(baseRow.metrics?.[rule.metricId]);
    if (base === null) return { available: false };
    let adverse;
    if (rule.type === "decline-percent") {
      if (base <= 0) return { available: false };
      adverse = (base - current) / Math.abs(base) * 100;
    } else {
      adverse = current - base;
    }
    if (adverse >= rule.critical) return { available: true, level: "critical", value: current, base, change: adverse, baseMonth: baseRow.month, threshold: rule.thresholdText };
    if (adverse >= rule.attention) return { available: true, level: "attention", value: current, base, change: adverse, baseMonth: baseRow.month, threshold: rule.thresholdText };
    return { available: true, level: null, value: current, base, change: adverse, baseMonth: baseRow.month };
  }

  function analyzeAlerts(records) {
    const sorted = Array.isArray(records) ? records.slice().sort((a, b) => a.month - b.month) : [];
    if (!sorted.length) return [];
    const episodes = [];
    for (const rule of RULES) {
      let candidateStart = null;
      let candidateCount = 0;
      let criticalCount = 0;
      let open = null;
      let latestSignal = null;
      let lastAvailableIndex = -1;
      const ruleEpisodes = [];
      for (let index = 0; index < sorted.length; index += 1) {
        const signal = evaluateRule(rule, sorted, index);
        if (!signal.available) {
          candidateStart = null;
          candidateCount = 0;
          criticalCount = 0;
          continue;
        }
        lastAvailableIndex = index;
        if (!signal.level) {
          candidateStart = null;
          candidateCount = 0;
          criticalCount = 0;
          latestSignal = null;
          if (open) {
            open.status = "resolvido";
            open.resolvedMonth = Number(sorted[index].month);
            open.lastObservedMonth = Number(sorted[index - 1]?.month ?? open.lastObservedMonth);
            ruleEpisodes.push(open);
            open = null;
          }
          continue;
        }
        if (candidateCount === 0) candidateStart = index;
        candidateCount += 1;
        criticalCount = signal.level === "critical" ? criticalCount + 1 : 0;
        latestSignal = signal;
        const attentionQualified = candidateCount >= rule.attentionPersistence;
        const criticalQualified = criticalCount >= rule.criticalPersistence;
        if (!open && (attentionQualified || criticalQualified)) {
          const first = sorted[candidateStart];
          open = {
            ruleId: rule.id,
            metricId: rule.metricId,
            indicator: METRICS.find((item) => item.id === rule.metricId)?.label || rule.metricId,
            severity: criticalQualified ? "crítico" : "atenção",
            status: "ativo",
            occurrenceMonth: Number(first.month),
            occurrenceDay: finiteOrNull(first.day),
            occurrenceYear: finiteOrNull(first.year),
            lastObservedMonth: Number(sorted[index].month),
            observed: signal.value,
            change: signal.change ?? null,
            threshold: rule.thresholdText,
            explanation: rule.explanation,
            evolution: `${candidateCount} fechamentos consecutivos com sinal; valor mais recente ${signal.value}.`
          };
        } else if (open) {
          if (criticalQualified) open.severity = "crítico";
          open.lastObservedMonth = Number(sorted[index].month);
          open.observed = signal.value;
          open.change = signal.change ?? open.change;
          open.evolution = `${Number(sorted[index].month) - open.occurrenceMonth + 1} meses entre o início do episódio e a observação mais recente; valor ${signal.value}.`;
        }
      }
      if (open) {
        const lastRow = sorted[sorted.length - 1];
        const lastSignal = evaluateRule(rule, sorted, sorted.length - 1);
        if (!lastSignal.available) open.status = "dados pendentes";
        ruleEpisodes.push(open);
      } else if (latestSignal && lastAvailableIndex === sorted.length - 1) {
        const lastRow = sorted[sorted.length - 1];
        ruleEpisodes.push({
          ruleId: rule.id,
          metricId: rule.metricId,
          indicator: METRICS.find((item) => item.id === rule.metricId)?.label || rule.metricId,
          severity: "informativo",
          status: "em observação",
          occurrenceMonth: Number(lastRow.month),
          occurrenceDay: finiteOrNull(lastRow.day),
          occurrenceYear: finiteOrNull(lastRow.year),
          lastObservedMonth: Number(lastRow.month),
          observed: latestSignal.value,
          change: latestSignal.change ?? null,
          threshold: rule.thresholdText,
          explanation: `${rule.explanation} O limite foi observado, mas ainda não houve persistência suficiente para classificar como atenção ou crítico.`,
          evolution: `Sinal isolado; são exigidos ${rule.attentionPersistence} fechamentos consecutivos para atenção.`
        });
      }
      episodes.push(...ruleEpisodes);
    }
    const statusOrder = { ativo: 0, "dados pendentes": 1, "em observação": 2, resolvido: 3 };
    return episodes.sort((a, b) => (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4) || b.occurrenceMonth - a.occurrenceMonth);
  }

  function createService(options = {}) {
    const windowRef = options.window || (typeof window !== "undefined" ? window : null);
    const runtime = options.runtime || windowRef?.VilarejoRuntime || null;
    let storage = options.storage;
    let sessionStorage = options.sessionStorage;
    if (storage === undefined) { try { storage = windowRef?.localStorage || null; } catch { storage = null; } }
    if (sessionStorage === undefined) { try { sessionStorage = windowRef?.sessionStorage || null; } catch { sessionStorage = null; } }
    const idFactory = options.idFactory || (() => {
      try { if (windowRef?.crypto?.randomUUID) return windowRef.crypto.randomUUID(); } catch { /* fallback below */ }
      return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    });
    const now = options.now || (() => new Date().toISOString());
    const historyStoreAPI = options.historyStoreAPI || windowRef?.VilarejoHistoryStore ||
      (typeof require === "function" ? require("../shared/vilarejo_history_store.js") : null);
    if (!historyStoreAPI || typeof historyStoreAPI.createHistoryStore !== "function") {
      throw new Error("A Central de Inteligência exige o contrato VilarejoHistoryStore.");
    }
    let persistence = storage ? "localStorage" : "somente memória";
    let persistenceWarning = "";
    let store = { version: STORE_VERSION, runs: [] };
    let activeRunId = null;
    let selectedRunId = null;
    let visibleMonths = 12;
    let selectedMetricId = "gdpProduction";
    let selectedCompareMetrics = ["gdpProduction", "unemploymentRate", "inflationMonthly"];
    let lastResetCount = null;

    function createRunHistory(runId) {
      return historyStoreAPI.createHistoryStore({ maxRecords: MAX_MONTHS_PER_RUN });
    }

    function toHistoryInput(runId, record) {
      const month = Math.floor(Number(record?.month));
      if (!Number.isSafeInteger(month) || month < 1) throw new TypeError("Mês do snapshot inválido.");
      const day = finiteOrNull(record.day);
      const year = finiteOrNull(record.year);
      const period = { monthNumber: month, label: monthLabel(month) };
      if (day !== null && Number.isSafeInteger(day) && day >= 1) period.absoluteDay = day;
      return {
        sessionId: runId,
        period,
        metrics: cleanMetrics(record.metrics),
        metadata: {
          day,
          year,
          metricQuality: record.metricQuality && typeof record.metricQuality === "object" ? clone(record.metricQuality) : {},
          sources: record.sources && typeof record.sources === "object" ? clone(record.sources) : {}
        },
        source: record.source || "economy:month-closed",
        capturedAt: record.capturedAt || null
      };
    }

    function fromHistoryRecord(record) {
      if (!record || !record.period || !Number.isFinite(Number(record.period.monthNumber))) return null;
      const metadata = record.metadata && typeof record.metadata === "object" ? record.metadata : {};
      return {
        runId: record.sessionId,
        month: Math.floor(Number(record.period.monthNumber)),
        day: finiteOrNull(metadata.day) ?? finiteOrNull(record.period.absoluteDay),
        year: finiteOrNull(metadata.year) ?? finiteOrNull(record.period.year),
        metrics: cleanMetrics(record.metrics),
        metricQuality: metadata.metricQuality && typeof metadata.metricQuality === "object" ? clone(metadata.metricQuality) : {},
        sources: metadata.sources && typeof metadata.sources === "object" ? clone(metadata.sources) : {},
        source: record.source || null,
        capturedAt: record.capturedAt || null
      };
    }

    function historyRecords(run) {
      if (!run?.historyStore) return [];
      return run.historyStore.getRecords({ sessionId: run.id }).map(fromHistoryRecord).filter(Boolean);
    }

    function hydrateRun(savedRun, savedVersion) {
      if (!savedRun || typeof savedRun.id !== "string" || !savedRun.id.trim()) {
        throw new TypeError("Execução persistida sem identificador válido.");
      }
      const runId = savedRun.id.trim();
      const history = createRunHistory(runId);
      if (savedVersion === LEGACY_STORE_VERSION) {
        if (!Array.isArray(savedRun.records)) throw new TypeError("Histórico legado da execução inválido.");
        history.setActiveSession(runId);
        const legacyRecords = savedRun.records
          .filter((record) => record && Number.isFinite(Number(record.month)) && Number(record.month) >= 1 && record.metrics && typeof record.metrics === "object")
          .slice(-MAX_MONTHS_PER_RUN)
          .map((record) => toHistoryInput(runId, record));
        history.appendMany(legacyRecords);
      } else {
        if (!savedRun.historySnapshot || typeof savedRun.historySnapshot !== "object") {
          throw new TypeError("Snapshot do History Store ausente na execução persistida.");
        }
        history.importSnapshot(savedRun.historySnapshot);
        const sessions = history.stats().sessions;
        if (sessions.some((sessionId) => sessionId !== runId) ||
            (history.stats().activeSessionId && history.stats().activeSessionId !== runId)) {
          throw new Error("O History Store da execução contém identificador de partida divergente.");
        }
        history.setActiveSession(runId);
      }
      const records = historyRecords({ id: runId, historyStore: history });
      const lastMonth = Math.max(
        0,
        Math.floor(Number(savedRun.lastMonth) || 0),
        ...records.map((record) => record.month)
      );
      return {
        id: runId,
        createdAt: String(savedRun.createdAt || ""),
        endedAt: savedRun.endedAt ? String(savedRun.endedAt) : null,
        startDay: finiteOrNull(savedRun.startDay),
        lastMonth,
        status: savedRun.status === "archived" ? "archived" : "active",
        endReason: savedRun.endReason ? String(savedRun.endReason) : null,
        parentRunId: savedRun.parentRunId ? String(savedRun.parentRunId) : null,
        historyStore: history
      };
    }

    function persistedStore() {
      return {
        version: STORE_VERSION,
        runs: store.runs.map((run) => ({
          id: run.id,
          createdAt: run.createdAt,
          endedAt: run.endedAt,
          startDay: run.startDay,
          lastMonth: run.lastMonth,
          status: run.status,
          endReason: run.endReason,
          parentRunId: run.parentRunId,
          historySnapshot: run.historyStore.exportSnapshot()
        }))
      };
    }

    function loadStore() {
      if (!storage || typeof storage.getItem !== "function") return;
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (![LEGACY_STORE_VERSION, STORE_VERSION].includes(parsed?.version) || !Array.isArray(parsed.runs)) {
          persistence = "somente memória";
          persistenceWarning = "O formato de histórico local não é compatível; o conteúdo existente não foi sobrescrito.";
          storage = null;
          return;
        }
        store = {
          version: STORE_VERSION,
          runs: parsed.runs.map((run) => hydrateRun(run, parsed.version))
        };
      } catch (error) {
        persistence = "somente memória";
        persistenceWarning = `Não foi possível ler o histórico local: ${error.message || error}`;
        storage = null;
      }
    }

    function persist() {
      try {
        if (storage && typeof storage.setItem === "function") {
          storage.setItem(STORAGE_KEY, JSON.stringify(persistedStore()));
          persistence = "localStorage";
        } else {
          persistence = "somente memória";
        }
      } catch (error) {
        persistence = "somente memória";
        persistenceWarning = `Falha ao persistir no navegador: ${error.message || error}`;
      }
      try {
        if (sessionStorage && typeof sessionStorage.setItem === "function" && activeRunId) sessionStorage.setItem(SESSION_KEY, activeRunId);
      } catch (error) {
        persistenceWarning = persistenceWarning || `Não foi possível manter a referência da execução nesta aba: ${error.message || error}`;
      }
    }

    function findRun(id) { return store.runs.find((run) => run.id === id) || null; }
    function getActiveRun() { return findRun(activeRunId); }

    function makeRun(id, details = {}) {
      const runId = String(id || idFactory()).trim();
      const history = createRunHistory(runId);
      history.setActiveSession(runId);
      if (Array.isArray(details.records) && details.records.length) {
        history.appendMany(details.records.map((record) => toHistoryInput(runId, record)));
      }
      const records = historyRecords({ id: runId, historyStore: history });
      const run = {
        id: runId,
        createdAt: now(),
        endedAt: null,
        startDay: finiteOrNull(details.startDay),
        lastMonth: 0,
        status: "active",
        endReason: null,
        parentRunId: details.parentRunId || null,
        historyStore: history
      };
      if (records.length) run.lastMonth = Math.max(...records.map((record) => record.month));
      store.runs.push(run);
      activeRunId = run.id;
      selectedRunId = run.id;
      persist();
      return run;
    }

    function archiveRun(run, reason) {
      if (!run) return;
      run.status = "archived";
      run.endedAt = now();
      run.endReason = String(reason || "execução encerrada");
    }

    function archiveAndStart(reason, details = {}) {
      archiveRun(getActiveRun(), reason);
      return makeRun(null, details);
    }

    function getRuntimeMonth() {
      try {
        const calendar = runtime?.clock?.snapshot?.();
        if (Number.isFinite(calendar?.economicMonthNumber)) return Number(calendar.economicMonthNumber);
        const state = windowRef?.VilarejoTest?.stateSnapshot?.();
        return Math.max(0, Math.floor(Number(state?.monthNumber) || 0));
      } catch { return 0; }
    }

    function bootstrap() {
      let savedId = null;
      try { savedId = sessionStorage?.getItem?.(SESSION_KEY) || null; } catch { savedId = null; }
      let run = savedId ? findRun(savedId) : null;
      const currentMonth = Math.max(0, Math.floor(Number(options.currentMonth ?? getRuntimeMonth()) || 0));
      if (run && currentMonth < run.lastMonth) {
        archiveRun(run, "A aplicação reiniciou sem restaurar o estado econômico; histórico mantido como execução arquivada.");
        run = null;
      }
      if (run) {
        run.status = "active";
        activeRunId = run.id;
        selectedRunId = run.id;
        persist();
      } else {
        makeRun(null, { startDay: options.startDay });
      }
    }

    function getMetricDefinitions() { return METRICS.map((metric) => ({ ...metric })); }

    function getRunHistory(runId = activeRunId) {
      const run = findRun(runId);
      return historyRecords(run);
    }

    function toDashboardHistory(runId = activeRunId) {
      return getRunHistory(runId).map((record) => {
        const row = { month: record.month, label: monthLabel(record.month) };
        for (const [legacyKey, metricId] of Object.entries(DASHBOARD_KEYS)) {
          const value = finiteOrNull(record.metrics?.[metricId]);
          if (value !== null) row[legacyKey] = value;
        }
        return row;
      });
    }

    function getRunList() {
      return store.runs.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map((run) => ({
        id: run.id,
        createdAt: run.createdAt,
        endedAt: run.endedAt,
        startDay: run.startDay,
        lastMonth: run.lastMonth,
        status: run.id === activeRunId ? "execução atual" : (run.status === "archived" ? "arquivada" : "outra execução"),
        endReason: run.endReason,
        parentRunId: run.parentRunId,
        recordCount: run.historyStore.stats().records
      }));
    }

    function publicRun(run) {
      if (!run) return null;
      return {
        id: run.id,
        createdAt: run.createdAt,
        endedAt: run.endedAt,
        startDay: run.startDay,
        lastMonth: run.lastMonth,
        status: run.status,
        endReason: run.endReason,
        parentRunId: run.parentRunId,
        records: historyRecords(run)
      };
    }

    function getRun(runId = activeRunId) { return publicRun(findRun(runId)); }
    function getHistoryStoreSnapshot(runId = activeRunId) {
      const run = findRun(runId);
      return run ? run.historyStore.exportSnapshot() : null;
    }

    function selectRun(runId) {
      if (!findRun(runId)) return false;
      selectedRunId = runId;
      return true;
    }

    function getSelectedRunId() { return selectedRunId || activeRunId; }
    function getCurrentRunId() { return activeRunId; }

    function recordMonthClosure(payload = {}) {
      const run = getActiveRun();
      if (!run) return null;
      let captured;
      try {
        captured = typeof options.capture === "function"
          ? options.capture(payload, runtime, windowRef)
          : captureSimulationRecord(payload, runtime, windowRef);
      } catch (error) {
        persistenceWarning = `Falha ao coletar indicadores do fechamento: ${error.message || error}`;
        return null;
      }
      if (!captured || !Number.isFinite(Number(captured.month))) return null;
      const month = Math.floor(Number(captured.month));
      if (month < 1) return null;
      const existing = historyRecords(run).find((record) => record.month === month);
      if (month < run.lastMonth) return existing ? clone(existing) : null;
      const record = {
        runId: run.id,
        month,
        day: finiteOrNull(captured.day),
        year: finiteOrNull(captured.year),
        metrics: cleanMetrics(captured.metrics),
        metricQuality: captured.metricQuality && typeof captured.metricQuality === "object" ? clone(captured.metricQuality) : {},
        sources: captured.sources && typeof captured.sources === "object" ? clone(captured.sources) : {},
        source: "economy:month-closed",
        capturedAt: now()
      };
      try {
        const result = run.historyStore.append(toHistoryInput(run.id, record));
        const savedRecord = fromHistoryRecord(result.record);
        run.lastMonth = Math.max(run.lastMonth, month);
        persist();
        return savedRecord ? clone(savedRecord) : null;
      } catch (error) {
        persistenceWarning = `Falha ao registrar snapshot mensal no History Store: ${error.message || error}`;
        return null;
      }
    }

    function resetForNewGame(details = {}) {
      const resetCount = finiteOrNull(details.resetCount);
      if (resetCount !== null && resetCount === lastResetCount) return publicRun(getActiveRun());
      lastResetCount = resetCount;
      const run = archiveAndStart("reset explícito da partida", { startDay: finiteOrNull(details.day) });
      selectedRunId = run.id;
      return publicRun(run);
    }

    function activateGame(details = {}) {
      const requestedId = String(details.gameId || details.runId || "").trim();
      const currentMonth = Math.max(0, Math.floor(Number(details.monthNumber ?? getRuntimeMonth()) || 0));
      if (!requestedId) {
        const next = archiveAndStart("troca de partida sem identificador persistente", { startDay: finiteOrNull(details.day) });
        return publicRun(next);
      }
      let target = findRun(requestedId);
      if (target && currentMonth < target.lastMonth) {
        archiveRun(target, "carregamento de um ponto anterior; execução derivada separada para evitar misturar meses futuros");
        const prefix = historyRecords(target).filter((record) => record.month <= currentMonth);
        target = makeRun(null, { startDay: finiteOrNull(details.day), parentRunId: requestedId, records: prefix });
      } else if (!target) {
        target = makeRun(requestedId, { startDay: finiteOrNull(details.day) });
      } else {
        archiveRun(getActiveRun() && getActiveRun().id !== target.id ? getActiveRun() : null, "troca para outra partida");
        target.status = "active";
        activeRunId = target.id;
        selectedRunId = target.id;
        persist();
      }
      return publicRun(target);
    }

    function getAlerts(runId = activeRunId) { return analyzeAlerts(getRunHistory(runId)); }
    function getTrends(runId = activeRunId, period = 12) { return analyzeTrends(getRunHistory(runId), period); }

    function getPersistenceStatus() {
      if (persistence === "localStorage") return "Histórico analítico salvo neste navegador. O estado da simulação não é salvo pela versão atual.";
      return `Histórico apenas em memória nesta execução; não há garantia de persistência após recarregar.${persistenceWarning ? ` ${persistenceWarning}` : ""}`;
    }

    function getSummary() {
      const run = getActiveRun();
      return {
        version: VERSION,
        runId: activeRunId,
        month: run?.lastMonth || 0,
        recordCount: run?.historyStore?.stats?.().records || 0,
        alerts: getAlerts(activeRunId).filter((alert) => alert.status === "ativo" || alert.status === "dados pendentes").length,
        persistence,
        persistenceWarning: persistenceWarning || null
      };
    }

    loadStore();
    bootstrap();

    return {
      version: VERSION,
      recordMonthClosure,
      resetForNewGame,
      activateGame,
      getRunHistory,
      getHistoryStoreSnapshot,
      getCurrentHistory: () => toDashboardHistory(activeRunId),
      getRunList,
      getRun,
      getCurrentRunId,
      getSelectedRunId,
      selectRun,
      getMetricDefinitions,
      getAlerts,
      getTrends,
      getPersistenceStatus,
      getSummary,
      setVisibleMonths(value) { visibleMonths = [12, 24, 60].includes(Number(value)) ? Number(value) : 12; return visibleMonths; },
      getVisibleMonths() { return visibleMonths; },
      setSelectedMetric(id) { if (METRICS.some((metric) => metric.id === id)) selectedMetricId = id; return selectedMetricId; },
      getSelectedMetric() { return selectedMetricId; },
      setCompareMetrics(ids) { selectedCompareMetrics = Array.isArray(ids) ? ids.filter((id) => METRICS.some((metric) => metric.id === id)).slice(0, 3) : []; return selectedCompareMetrics.slice(); },
      getCompareMetrics() { return selectedCompareMetrics.slice(); },
      getStorageKey() { return STORAGE_KEY; }
    };
  }

  function registerWithRuntime(runtime, options = {}) {
    if (!runtime || !runtime.modules || !runtime.events || typeof runtime.publish !== "function") throw new TypeError("Runtime incompleto para registrar Inteligência.");
    if (runtime.modules.has("inteligencia")) return { alreadyRegistered: true, service: null, dispose() {} };
    const dependencies = ["core", "economia", "sociedade"].filter((id) => runtime.modules.has(id));
    if (!runtime.modules.has("core") || !runtime.modules.has("economia")) throw new Error("Inteligência exige Core e Economia registrados.");
    runtime.modules.register({
      id: "inteligencia",
      version: VERSION,
      name: "Inteligência",
      dependencies,
      description: "Séries mensais, tendências e alertas calculados a partir dos snapshots reais da simulação; não altera os motores de domínio."
    });
    const windowRef = options.window || (typeof window !== "undefined" ? window : null);
    const service = createService({ ...options, runtime, window: windowRef });
    const publishSummary = (source = "inteligencia") => runtime.modules.updateSnapshot("inteligencia", service.getSummary(), source);
    const unsubscribers = [];
    unsubscribers.push(runtime.events.on("economy:month-closed", (event) => {
      const record = service.recordMonthClosure(event?.payload || {});
      if (!record) return;
      publishSummary("inteligencia.month-adapter");
      runtime.publish("intelligence:month-closed", { runId: record.runId, month: record.month, metricCount: Object.keys(record.metrics).length }, "inteligencia");
    }));
    unsubscribers.push(runtime.events.on("game:reset", (event) => {
      service.resetForNewGame(event?.payload || {});
      publishSummary("inteligencia.reset-adapter");
    }));
    const onGameContext = (event) => {
      const payload = event?.payload || {};
      if (payload.gameId || payload.runId) {
        service.activateGame({ ...payload, monthNumber: payload.monthNumber ?? runtime.clock?.snapshot?.().economicMonthNumber });
        publishSummary("inteligencia.game-context");
      }
    };
    unsubscribers.push(runtime.events.on("game:loaded", onGameContext));
    unsubscribers.push(runtime.events.on("game:switched", onGameContext));
    unsubscribers.push(runtime.events.on("game:initialized", onGameContext));
    publishSummary("inteligencia.initial-adapter");
    return {
      alreadyRegistered: false,
      service,
      getSnapshot: () => service.getSummary(),
      dispose() { unsubscribers.forEach((unsubscribe) => unsubscribe()); }
    };
  }

  function analyzeAlertsFromRuns(records) { return analyzeAlerts(records); }
  function analyzeTrendsFromRuns(records, period) { return analyzeTrends(records, period); }

  return {
    VERSION,
    MAX_MONTHS_PER_RUN,
    STORAGE_KEY,
    SESSION_KEY,
    METRICS: METRICS.map((metric) => ({ ...metric })),
    ALERT_RULES: RULES.map((rule) => ({ ...rule })),
    captureSimulationRecord,
    analyzeAlerts: analyzeAlertsFromRuns,
    analyzeTrends: analyzeTrendsFromRuns,
    createService,
    registerWithRuntime
  };
});
