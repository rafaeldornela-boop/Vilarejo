(function initVilarejoDashboard() {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const money = (value) => "R$ " + Math.round(Number(value) || 0).toLocaleString("pt-BR");
  const number = (value, digits = 0) => (Number(value) || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
  const compact = (value) => {
    const n = Number(value) || 0;
    if (Math.abs(n) >= 1000000) return "R$ " + number(n / 1000000, 1) + " mi";
    if (Math.abs(n) >= 1000) return "R$ " + number(n / 1000, 1) + " mil";
    return money(n);
  };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));

  const MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const WEEKDAY_NAMES = [
    "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"
  ];
  const WEEKDAY_ABBR = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

  function isLeapYear(year) {
    const y = Number(year) || 2026;
    return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
  }

  function getDaysInGregorianMonth(year, month) {
    // month: 1..12
    return new Date(Date.UTC(Number(year) || 2026, Number(month) || 1, 0)).getUTCDate();
  }

  let visibleMonths = 12;
  let activeView = "overview";
  let activeGovTab = "executivo";
  let lastSnapshot = null;
  let lastChartSignature = "";
  let activeMapSector = "Visão do território";
  let decisionObserver = null;
  let lastDecisionRunId = null;

  const UNAVAILABLE = "Indisponível";

  function finiteValue(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function formatObserved(value, formatter = number) {
    const metric = finiteValue(value);
    return metric === null ? UNAVAILABLE : formatter(metric);
  }

  function getFirstWeekdayOfMonth(year, month) {
    // month: 1..12; returns 0=Segunda, 1=Terça, ..., 6=Domingo
    const day = new Date(Date.UTC(Number(year) || 2026, (Number(month) || 1) - 1, 1)).getUTCDay();
    return (day + 6) % 7;
  }

  function civilDateToSimulationDay(year, month, day) {
    const diffMs = Date.UTC(Number(year), Number(month) - 1, Number(day)) - Date.UTC(2026, 0, 1);
    return Math.round(diffMs / 86400000) + 1;
  }

  function simulationDayToCivilDate(simDay) {
    const dayNum = Math.max(1, Math.round(Number(simDay) || 1));
    const ms = Date.UTC(2026, 0, 1) + (dayNum - 1) * 86400000;
    const d = new Date(ms);
    const civilYear = d.getUTCFullYear();
    const civilMonth = d.getUTCMonth() + 1; // 1..12
    const civilDay = d.getUTCDate();
    const utcDay = d.getUTCDay(); // 0=Sun..6=Sat
    const weekdayIndex = (utcDay + 6) % 7; // 0=Seg..6=Dom
    const leap = isLeapYear(civilYear);
    const daysInMonth = getDaysInGregorianMonth(civilYear, civilMonth);
    const monthStartWeekday = getFirstWeekdayOfMonth(civilYear, civilMonth);

    // Calendário econômico de 360 dias (12 meses de 30 dias)
    const economicYear = Math.floor((dayNum - 1) / 360) + 1;
    const economicMonth = Math.floor(((dayNum - 1) % 360) / 30) + 1;
    const economicDay = ((dayNum - 1) % 30) + 1;
    const dayInYear = ((dayNum - 1) % 360) + 1;
    const isCloseDay = economicDay === 30;
    const isHarvest = dayInYear >= 150 && dayInYear <= 209;
    const daysToClose = 30 - economicDay;

    let harvestDaysRemaining = 0;
    if (isHarvest) {
      harvestDaysRemaining = 210 - dayInYear;
    }

    return {
      simDay: dayNum,
      simYear: economicYear,
      civilYear,
      civilMonth,
      civilDay,
      dayInMonth: civilDay,
      monthIndex: civilMonth - 1,
      monthName: MONTH_NAMES[civilMonth - 1],
      weekdayIndex,
      weekdayName: WEEKDAY_NAMES[weekdayIndex],
      weekdayAbbr: WEEKDAY_ABBR[weekdayIndex],
      monthStartWeekday,
      daysInMonth,
      isLeapYear: leap,
      // Calendário econômico
      economicYear,
      economicMonth,
      economicDay,
      isCloseDay,
      isHarvest,
      daysToClose,
      harvestDaysRemaining
    };
  }

  const getCivilDateInfo = simulationDayToCivilDate;
  // Estado de navegação do calendário civil
  let viewedCivilYear = 2026;
  let viewedCivilMonth = 5; // 1..12
  let isBrowsingCivilCalendar = false;

  function snapshot() {
    try {
      if (typeof window !== "undefined" && window.VilarejoTest && typeof window.VilarejoTest.stateSnapshot === "function") {
        const s = window.VilarejoTest.stateSnapshot();
        const core = typeof window.VilarejoTest.getCoreSnapshot === "function"
          ? window.VilarejoTest.getCoreSnapshot()
          : (window.VilarejoRuntime?.snapshot() || null);
        const intelligence = window.VilarejoIntelligenceRuntime?.service;
        const society = window.VilarejoSocietyRuntime?.getSnapshot?.() ||
          core?.modules?.society?.snapshot || null;
        const labor = typeof window.VilarejoTest.getLaborStats === "function"
          ? window.VilarejoTest.getLaborStats()
          : s?.laborStats;
        const societyPopulation = finiteValue(society?.demographic?.population);
        const corePopulation = finiteValue(core?.population?.totals?.total);
        const pop = societyPopulation === null ? corePopulation : societyPopulation;
        const bs = typeof window.VilarejoTest.generateBalanceSheets === "function"
          ? window.VilarejoTest.generateBalanceSheets()
          : s?.balanceSheets;
        const fiscal = typeof window.VilarejoTest.calculateFiscalReport === "function"
          ? window.VilarejoTest.calculateFiscalReport()
          : s?.fiscalReport;
        const macro = typeof window.VilarejoTest.calculateNationalAccounts === "function"
          ? window.VilarejoTest.calculateNationalAccounts()
          : s?.nationalAccounts;

        const currentSessionId = core?.session?.id || s?.sessionId || null;
        const absoluteDay = finiteValue(core?.calendar?.absoluteDay) ?? finiteValue(s?.day);
        const economicMonthNumber = finiteValue(core?.calendar?.economicMonthNumber) ?? finiteValue(s?.monthNumber);
        const currentRunId = intelligence?.getCurrentRunId?.() || currentSessionId;
        const events = core?.recentEvents || window.VilarejoRuntime?.events?.getHistory?.({ limit: 30 }) || [];

        if (absoluteDay === null) return null;

        return {
          day: absoluteDay,
          monthNumber: economicMonthNumber,
          sessionId: currentSessionId ? String(currentSessionId) : null,
          runId: currentRunId ? String(currentRunId) : null,
          gameOver: s?.gameOver || null,
          running: core?.session?.status === "running",
          history: intelligence?.getCurrentHistory?.() || [],
          events: Array.isArray(events) ? events : [],
          society,
          core,
          population: pop,
          housingCapacity: finiteValue(s?.housingCapacity),
          buildings: Array.isArray(s?.buildings) ? s.buildings.length : null,
          lots: finiteValue(s?.lotCount) ?? finiteValue(s?.lots),
          employed: finiteValue(labor?.occupied) ?? finiteValue(s?.employed),
          laborStats: labor,
          balanceSheets: bs,
          fiscalReport: fiscal,
          nationalAccounts: macro,
          urbanInfra: s?.urbanInfra && typeof s.urbanInfra === "object" ? s.urbanInfra : null,
          marketPrice: finiteValue(s?.marketPrice),
          servicePrice: finiteValue(s?.servicePrice),
          marketStock: finiteValue(s?.marketStock),
          approval: finiteValue(s?.approval),
          wage: finiteValue(s?.wage),
          raw: s
        };
      }
      return null;
    } catch (error) {
      console.warn("Não foi possível ler o retrato do Vilarejo:", error);
      return null;
    }
  }

  function recordMonthClosure(payload) {
    return window.VilarejoIntelligenceRuntime?.service?.recordMonthClosure?.(payload) || null;
  }

  function setView(name, subTab) {
    if (name === "institutions") {
      setView("government");
      setGovTab("camara");
      return;
    }
    if (name === "politics") {
      setView("government");
      setGovTab("politica");
      return;
    }

    activeView = name;
    if (typeof document === "undefined") return;
    document.querySelectorAll("[data-view-panel]").forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.viewPanel === name);
    });
    document.querySelectorAll("[data-view]").forEach((button) => {
      const selected = button.dataset.view === name;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-current", selected ? "page" : "false");
    });
    const titles = {
      overview: ["Visão geral", "O que mudou, o que merece atenção e quais decisões estão disponíveis."],
      economy: ["Economia", "Produção, preços, trabalho e atividade ao longo do tempo."],
      society: ["Sociedade", "Famílias, empresas, emprego e condições de vida."],
      politics: ["Política", "Grupos de interesse, influência, satisfação e relações com o governo."],
      institutions: ["Instituições", "Representação, bancadas, coalizões, oposição e mandatos."],
      services: ["Serviços e desenvolvimento", "Capacidade pública, bem-estar, infraestrutura e recursos estratégicos."],
      government: ["Governo", "Políticas, orçamento e patrimônio público."],
      records: ["Registros", "Decisões, acontecimentos e movimentações financeiras."]
    };
    const item = titles[name] || titles.overview;
    if ($("pageTitle")) $("pageTitle").textContent = item[0];
    if ($("pageHeading")) $("pageHeading").textContent = item[0] === "Visão geral" ? "Panorama do município" : item[0] + ".";
    if ($("pageDescription")) $("pageDescription").textContent = item[1];
    refreshDomainPanels();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setGovTab(name) {
    const allowedTabs = ["executivo", "camara", "politica"];
    activeGovTab = allowedTabs.includes(name) ? name : "executivo";
    if (typeof document === "undefined") return activeGovTab;

    document.querySelectorAll("[data-gov-tab]").forEach((button) => {
      const selected = button.dataset.govTab === activeGovTab;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
    });
    document.querySelectorAll("[data-gov-pane]").forEach((pane) => {
      pane.classList.toggle("active", pane.dataset.govPane === activeGovTab);
    });

    if (activeGovTab === "camara" && window.VilarejoInstitutions && window.VilarejoInstitutionsRuntime) {
      const host = $("institutionsDashboard");
      if (host) window.VilarejoInstitutions.renderDashboard(window.VilarejoInstitutionsRuntime.state, host);
    }
    if (activeGovTab === "politica" && window.VilarejoPolitics && window.VilarejoPoliticsRuntime) {
      const host = $("politicsDashboard");
      if (host) window.VilarejoPolitics.renderDashboard(window.VilarejoPoliticsRuntime.state, host);
    }
    return activeGovTab;
  }

  function refreshDomainPanels() {
    if (activeView === "politics" && window.VilarejoPolitics && window.VilarejoPoliticsRuntime) {
      const host = $("politicsDashboard");
      if (host) window.VilarejoPolitics.renderDashboard(window.VilarejoPoliticsRuntime.state, host);
    }
    if (activeView === "institutions" && window.VilarejoInstitutions && window.VilarejoInstitutionsRuntime) {
      const host = $("institutionsDashboard");
      if (host) window.VilarejoInstitutions.renderDashboard(window.VilarejoInstitutionsRuntime.state, host);
    }
    if (activeView === "services" && window.VilarejoServices && window.VilarejoServicesRuntime) {
      const host = $("servicesDashboard");
      if (host) {
        host.__serviceSetLever = (domainId, leverId, value) => window.VilarejoServicesRuntime.setLever(domainId, leverId, value);
        window.VilarejoServices.renderDashboard(window.VilarejoServicesRuntime.state, host);
      }
    }
  }

  function makeChart(targetId, series, history, format, emptyTitle) {
    const target = $(targetId);
    if (!target) return;
    const rows = (Array.isArray(history) ? history : []).slice(-visibleMonths);
    if (rows.length < 1) {
      target.innerHTML = '<div class="chart-empty"><span class="chart-empty-mark">⌁</span><strong>' +
        (emptyTitle || "Seu histórico está começando") +
        '</strong><span>Os pontos surgem a cada fechamento mensal. Nenhum dado anterior foi inventado.</span></div>';
      return;
    }
    const hasSeriesData = rows.some((row) => series.some((item) => finiteValue(row[item.key]) !== null));
    if (!hasSeriesData) {
      target.innerHTML = '<div class="chart-empty"><span class="chart-empty-mark">⌁</span><strong>Indicador sem histórico disponível</strong><span>Esta referência não produz uma série para este indicador; nenhum valor foi estimado.</span></div>';
      return;
    }

    const width = 760;
    const height = 248;
    const pad = { top: 16, right: 20, bottom: 36, left: 74 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const allValues = [];
    series.forEach((item) => rows.forEach((row) => {
      const value = finiteValue(row[item.key]);
      if (value !== null) allValues.push(value);
    }));
    if (!allValues.length) {
      target.innerHTML = '<div class="chart-empty"><strong>Dados ainda não disponíveis</strong><span>Este indicador será preenchido nos próximos fechamentos.</span></div>';
      return;
    }

    let min = Math.min(0, ...allValues);
    let max = Math.max(0, ...allValues);
    if (min === max) { min -= 1; max += 1; }
    const range = max - min || 1;
    const x = (index) => pad.left + (rows.length <= 1 ? plotW / 2 : (index / (rows.length - 1)) * plotW);
    const y = (value) => pad.top + ((max - value) / range) * plotH;
    const grid = Array.from({ length: 5 }, (_, index) => {
      const value = max - (range * index / 4);
      const yy = y(value);
      return '<line x1="' + pad.left + '" y1="' + yy + '" x2="' + (width - pad.right) + '" y2="' + yy + '" class="chart-grid-line"/>' +
        '<text x="' + (pad.left - 12) + '" y="' + (yy + 4) + '" text-anchor="end" class="chart-axis-label">' + format(value) + '</text>';
    }).join("");

    const paths = series.map((item) => {
      const pts = rows.map((row, index) => {
        const value = finiteValue(row[item.key]);
        return value !== null ? [x(index), y(value), value, row.label || ("M" + row.month)] : null;
      }).filter(Boolean);
      if (!pts.length) return "";
      const polyline = pts.map((point) => point[0] + "," + point[1]).join(" ");
      const dots = pts.map((point) => '<circle cx="' + point[0] + '" cy="' + point[1] + '" r="3.5" class="chart-dot ' + item.className + '"><title>' +
        point[3] + ": " + format(point[2]) + '</title></circle>').join("");
      return '<polyline points="' + polyline + '" class="chart-line ' + item.className + '"/>' + dots;
    }).join("");

    const tickIndices = [...new Set([0, Math.floor((rows.length - 1) / 3), Math.floor((rows.length - 1) * 2 / 3), rows.length - 1])];
    const labels = tickIndices.map((index) => '<text x="' + x(index) + '" y="' + (height - 10) + '" text-anchor="middle" class="chart-axis-label">' +
      (rows[index].label || ("M" + rows[index].month)) + '</text>').join("");
    const legend = series.map((item) => '<span class="chart-legend-item"><i class="' + item.className + '"></i>' + item.label + '</span>').join("");

    target.innerHTML = '<div class="chart-legend">' + legend + '</div><svg class="chart-svg" viewBox="0 0 ' + width + ' ' + height +
      '" role="img" aria-label="' + (target.dataset.label || "Gráfico") + '">' + grid + paths + labels + '</svg>';
  }

  function refreshCharts(data) {
    const history = Array.isArray(data.history) ? data.history : [];
    makeChart("chart-gdp", [
      { key: "gdp", label: "PIB mensal", className: "series-green" }
    ], history, compact, "O PIB histórico começa no primeiro fechamento");
    makeChart("chart-labor", [
      { key: "unemployment", label: "Desocupação", className: "series-amber" },
      { key: "approval", label: "Aprovação", className: "series-green" }
    ], history, (v) => number(v, 0) + "%", "O retrato do mercado de trabalho está começando");
    makeChart("chart-prices", [
      { key: "costIndex", label: "Custo de vida", className: "series-amber" },
      { key: "realWageIndex", label: "Salário real de referência", className: "series-green" }
    ], history, (v) => number(v, 0), "O índice será formado com os próximos meses");
    makeChart("chart-fiscal", [
      { key: "primaryResult", label: "Resultado primário", className: "series-blue" }
    ], history, compact, "O histórico fiscal está começando");
    makeChart("chart-inflation", [
      { key: "inflation", label: "Inflação mensal", className: "series-amber" }
    ], history, (v) => number(v, 1) + "%", "A inflação será registrada no primeiro fechamento");
    makeChart("chart-production", [
      { key: "gdp", label: "PIB", className: "series-green" },
      { key: "consumption", label: "Consumo das famílias", className: "series-blue" }
    ], history, compact, "Produção e consumo aguardam os primeiros meses");
    makeChart("chart-population", [
      { key: "population", label: "Moradores", className: "series-green" }
    ], history, (v) => number(v), "A evolução populacional começa com a simulação");
    makeChart("chart-government", [
      { key: "taxRevenue", label: "Receitas", className: "series-green" },
      { key: "primaryExpenditure", label: "Despesas primárias", className: "series-amber" }
    ], history, compact, "Receitas e despesas serão registradas mês a mês");
    makeChart("chart-debt", [
      { key: "governmentDebt", label: "Dívida do governo", className: "series-blue" }
    ], history, compact, "A trajetória da dívida será construída com os fechamentos");
    makeChart("chart-income", [
      { key: "incomeGini", label: "Índice de Gini (0 a 100)", className: "series-amber" }
    ], history, (v) => number(v, 1), "A distribuição de renda começa a ser observada agora");
  }

  function formatMetricDelta(metric, current, previous) {
    const delta = current - previous;
    if (delta === 0) return "Sem variação em relação ao fechamento anterior";
    const sign = delta > 0 ? "+" : "−";
    const absolute = Math.abs(delta);
    if (metric === "population") return `${sign}${number(absolute)} pessoas vs. fechamento anterior`;
    if (metric === "unemployment") return `${sign}${number(absolute, 1)} p.p. vs. fechamento anterior`;
    return `${sign}${compact(absolute)} vs. fechamento anterior`;
  }

  function renderOverviewPulse(data) {
    const host = $("overviewPulse");
    if (!host) return;
    if (!data) {
      host.innerHTML = '<div class="ux-observation-empty"><span class="eyebrow">PANORAMA</span><strong>Aguardando snapshot da simulação</strong><p>Os indicadores ficam indisponíveis até a inicialização do motor.</p></div>';
      return;
    }
    const rows = Array.isArray(data.history) ? data.history : [];
    if (!rows.length) {
      host.innerHTML = '<div class="ux-observation-empty"><span class="eyebrow">PANORAMA</span><strong>Ainda sem fechamento observado</strong><p>Os indicadores aparecem após o primeiro mês fechado pela simulação.</p></div>';
      return;
    }

    const current = rows[rows.length - 1];
    const previous = rows.length > 1 ? rows[rows.length - 2] : null;
    const cards = [
      { key: "population", label: "População observada", format: (value) => `${number(value)} pessoas` },
      { key: "gdp", label: "Produção no mês", format: compact },
      { key: "unemployment", label: "Desocupação", format: (value) => `${number(value, 1)}%` },
      { key: "primaryResult", label: "Resultado primário", format: compact }
    ];

    host.innerHTML = '<div class="ux-overview-pulse-heading"><div><span class="eyebrow">ÚLTIMO FECHAMENTO</span><h2>O município em números</h2></div><span class="ux-period-chip">Mês econômico ' + escapeHtml(current.month ?? UNAVAILABLE) + '</span></div>' +
      '<div class="ux-overview-metrics">' + cards.map((metric) => {
        const value = finiteValue(current[metric.key]);
        const prior = previous ? finiteValue(previous[metric.key]) : null;
        const comparison = value === null
          ? "Sem observação disponível neste fechamento"
          : prior === null
            ? "Primeiro valor observado; sem base de comparação"
            : formatMetricDelta(metric.key, value, prior);
        const formatted = value === null ? UNAVAILABLE : metric.format(value);
        return '<article class="ux-overview-metric"><span class="eyebrow">' + escapeHtml(metric.label) + '</span><strong>' +
          escapeHtml(formatted) + '</strong><small>' + escapeHtml(comparison) + '</small></article>';
      }).join("") + '</div><p class="ux-data-provenance">Fonte: snapshots mensais desta execução, registrados pela Central de Inteligência. Valores ausentes não são estimados.</p>';
  }

  function sectorMetricsFor(data, sector) {
    const raw = data.raw || {};
    const infra = data.urbanInfra || {};
    const society = data.society || {};
    const demographic = society.demographic || {};
    const metric = (label, value, formatter = number, source = "Snapshot da Economia") => ({ label, value: finiteValue(value), formatter, source });
    const overview = [
      metric("Moradores", data.population, number, society.demographic ? "Sociedade" : "Core"),
      metric("Caixa público", raw.treasuryCash, money),
      metric("Estoque do comércio", raw.marketStock, (value) => `${number(value, 1)} unidades`)
    ];
    const profiles = {
      "Visão do território": { description: "Indicadores agregados disponíveis para a execução atual.", metrics: overview },
      "Fazenda e produção": {
        description: "Valores da atividade rural expostos pelo snapshot; o desenho da lavoura é apenas ilustrativo.",
        metrics: [
          metric("Estoque da fazenda", raw.farmInventory, (value) => number(value, 1)),
          metric("Caixa da fazenda", raw.farmCash, money),
          metric("Trabalhadores ativos no setor", raw.farmWorkers, number)
        ]
      },
      "Moradias": {
        description: "Contagens demográficas da Sociedade; não há endereços ou unidades habitacionais georreferenciadas.",
        metrics: [
          metric("Moradores", demographic.population ?? data.population, number, "Sociedade/Core"),
          metric("Domicílios", demographic.households, number, "Sociedade"),
          metric("População em idade de trabalho", demographic.workingAge, number, "Sociedade")
        ]
      },
      "Centro e prefeitura": {
        description: "Leitura fiscal agregada, não vinculada a um prédio ou endereço real.",
        metrics: [
          metric("Caixa do Tesouro", raw.treasuryCash, money),
          metric("Receitas tributárias", raw.fiscalReport?.taxRevenue, money),
          metric("Resultado primário", raw.fiscalReport?.primaryResult, money)
        ]
      },
      "Comércio local": {
        description: "Indicadores de estoque e preços publicados pela Economia.",
        metrics: [
          metric("Estoque comercial", raw.marketStock, (value) => `${number(value, 1)} unidades`),
          metric("Preço de mercado", raw.marketPrice, money),
          metric("Preço de serviços locais", raw.servicePrice, money)
        ]
      },
      "Serviços": {
        description: "Infraestrutura urbana agregada. Os indicadores específicos de saúde, educação e segurança não são publicados pela referência atual.",
        metrics: [
          metric("Capacidade urbana", infra.capacity),
          metric("Demanda urbana", infra.demand),
          metric("Congestionamento", infra.congestionRatio, (value) => `${number(value, 2)}×`),
          metric("Fator de produtividade urbana", infra.tfpFactor, (value) => number(value, 2))
        ]
      }
    };
    return profiles[sector] || profiles["Visão do território"];
  }

  function selectMapSector(sector, data = lastSnapshot) {
    activeMapSector = sector || "Visão do território";
    if (typeof document !== "undefined") {
      const map = $("villageMap");
      map?.querySelectorAll("[data-district]").forEach((item) => {
        const selected = item.dataset.district === activeMapSector;
        item.classList.toggle("selected", selected);
        item.setAttribute("aria-pressed", selected ? "true" : "false");
      });
    }
    const label = $("districtLabel");
    const description = $("mapSectorDescription");
    const host = $("mapSectorMetrics");
    if (label) label.textContent = activeMapSector;
    const profile = data ? sectorMetricsFor(data, activeMapSector) : null;
    if (description) description.textContent = profile?.description || "Aguardando um snapshot da simulação.";
    if (host) {
      host.innerHTML = profile
        ? profile.metrics.map((item) => '<div class="ux-sector-metric"><div><strong>' + escapeHtml(item.label) + '</strong><small>' + escapeHtml(item.source) + '</small></div><b>' +
          escapeHtml(item.value === null ? UNAVAILABLE : item.formatter(item.value)) + '</b></div>').join("")
        : '<p>Os dados deste setor ainda não estão disponíveis.</p>';
    }
    return profile;
  }

  function refreshMap(data) {
    selectMapSector(activeMapSector, data);
  }

  function getCalendarEvents(data) {
    const events = [];
    const societyLabels = {
      birth: "Nascimento",
      death: "Falecimento",
      household_added: "Domicílio registrado",
      household_removed: "Domicílio removido",
      economy_population_adjustment: "Ajuste demográfico"
    };
    (Array.isArray(data.society?.recentEvents) ? data.society.recentEvents : []).forEach((event) => {
      if (!event || typeof event !== "object") return;
      const label = event.message || societyLabels[event.type];
      if (typeof label !== "string" || !label.trim()) return;
      events.push({
        id: event.id || `society:${event.type}:${event.month}:${label}`,
        label: label.trim(),
        source: "Sociedade",
        day: finiteValue(event.day),
        month: finiteValue(event.month ?? event.monthNumber)
      });
    });

    const technicalTopics = /^(core\.modules?$|world:|population:|game:|intelligence:|economy:month-closed$|society:month-closed$|politics:month-closed$|institutions:month-closed$)/;
    (Array.isArray(data.events) ? data.events : []).forEach((event) => {
      if (!event || typeof event !== "object" || technicalTopics.test(String(event.topic || "")) || /^core\.modules?$/i.test(String(event.source || ""))) return;
      const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
      const label = payload.title || payload.name || payload.message || event.message;
      if (typeof label !== "string" || !label.trim()) return;
      events.push({
        id: event.id || `${event.topic || "event"}:${event.day || "undated"}:${label}`,
        label: label.trim(),
        source: String(event.source || "Core"),
        day: finiteValue(event.day),
        month: finiteValue(payload.monthNumber ?? payload.month)
      });
    });

    const unique = new Map();
    events.forEach((event) => {
      const key = `${event.source}|${event.day}|${event.month}|${event.label}`;
      if (!unique.has(key)) unique.set(key, event);
    });
    return [...unique.values()].sort((a, b) => {
      if (a.day !== null && b.day !== null) return b.day - a.day;
      if (a.month !== null && b.month !== null) return b.month - a.month;
      return String(b.id).localeCompare(String(a.id));
    }).slice(0, 12);
  }

  function refreshCalendar(data) {
    const currentSimDay = Math.max(1, Math.round(Number(data.day) || 1));
    const todayInfo = simulationDayToCivilDate(currentSimDay);
    const calendarEvents = getCalendarEvents(data);
    const eventDays = new Map();
    calendarEvents.forEach((event) => {
      if (event.day === null) return;
      if (!eventDays.has(event.day)) eventDays.set(event.day, []);
      eventDays.get(event.day).push(event);
    });

    // Se o usuário não estiver folheando explicitamente, acompanha o mês da simulação
    if (!isBrowsingCivilCalendar) {
      viewedCivilYear = todayInfo.civilYear;
      viewedCivilMonth = todayInfo.civilMonth;
    }

    const isViewingCurrentMonth = (viewedCivilYear === todayInfo.civilYear && viewedCivilMonth === todayInfo.civilMonth);

    // Dados do mês visualizado
    const daysInViewedMonth = getDaysInGregorianMonth(viewedCivilYear, viewedCivilMonth);
    const startWeekdayOfViewedMonth = getFirstWeekdayOfMonth(viewedCivilYear, viewedCivilMonth);
    const viewedMonthName = MONTH_NAMES[viewedCivilMonth - 1];

    // Status da Safra e Fechamento no dia atual da simulação
    const inHarvest = todayInfo.isHarvest;
    const daysToClose = todayInfo.daysToClose;
    const closeLabel = daysToClose === 0 ? "Hoje!" : daysToClose === 1 ? "Amanhã" : "Em " + daysToClose + " dias";

    let seasonTitle;
    let seasonDetail;
    if (inHarvest) {
      const remaining = todayInfo.harvestDaysRemaining;
      seasonTitle = "Safra em andamento";
      seasonDetail = remaining === 1 ? "Último dia da colheita." : "Colheita ativa · " + remaining + " dias restantes no período.";
    } else if (((currentSimDay - 1) % 360) + 1 < 150) {
      const remaining = 150 - (((currentSimDay - 1) % 360) + 1);
      seasonTitle = remaining === 1 ? "Safra começa amanhã" : "Entressafra";
      seasonDetail = "Início da colheita em " + remaining + (remaining === 1 ? " dia." : " dias.");
    } else {
      const remaining = (360 - (((currentSimDay - 1) % 360) + 1)) + 150;
      seasonTitle = "Entressafra";
      seasonDetail = "Próxima safra em " + remaining + " dias.";
    }

    // TopBar
    if ($("topbarCivilDate")) {
      $("topbarCivilDate").textContent = `${todayInfo.weekdayName}, ${String(todayInfo.civilDay).padStart(2, "0")} de ${todayInfo.monthName} de ${todayInfo.civilYear}`;
    }
    if ($("dateLabel")) {
      $("dateLabel").textContent = `Ano Econômico ${todayInfo.economicYear} · Mês ${todayInfo.economicMonth}, Dia ${todayInfo.economicDay} · Dia ${currentSimDay} absoluto`;
    }
    if ($("topbarSeasonBadge")) {
      $("topbarSeasonBadge").textContent = inHarvest ? "Safra ativa" : "Entressafra";
      $("topbarSeasonBadge").className = "season-badge " + (inHarvest ? "is-harvest" : "is-offseason");
    }

    // Painel Principal do Calendário Civil
    if ($("calendarWeekday")) $("calendarWeekday").textContent = todayInfo.weekdayName.toUpperCase();
    if ($("calendarDayNumber")) $("calendarDayNumber").textContent = String(todayInfo.civilDay).padStart(2, "0");
    if ($("calendarMonthYear")) $("calendarMonthYear").textContent = (todayInfo.monthName + " " + todayInfo.civilYear).toUpperCase();
    if ($("calendarMonthHeading")) $("calendarMonthHeading").textContent = `${viewedMonthName} de ${viewedCivilYear}`;
    if ($("calendarSimDay")) $("calendarSimDay").textContent = `Dia ${currentSimDay} da simulação · Mês Econômico ${todayInfo.economicMonth}`;

    // Tag indicadora de navegação
    const currentTag = $("calendarCurrentTag");
    if (currentTag) {
      if (isViewingCurrentMonth) {
        currentTag.textContent = "MÊS ATUAL DA SIMULAÇÃO";
        currentTag.className = "calendar-current-tag is-current";
      } else {
        currentTag.textContent = "HISTÓRICO / FUTURO";
        currentTag.className = "calendar-current-tag is-browsing";
      }
    }

    // Grade dos Dias do Mês Gregoriano
    const cells = [];
    // Células em branco antes do primeiro dia da semana do mês (Segunda=0)
    for (let i = 0; i < startWeekdayOfViewedMonth; i += 1) {
      cells.push('<span class="calendar-blank" aria-hidden="true"></span>');
    }

    for (let d = 1; d <= daysInViewedMonth; d += 1) {
      const cellSimDay = civilDateToSimulationDay(viewedCivilYear, viewedCivilMonth, d);
      const isToday = (cellSimDay === currentSimDay);
      const isPast = (cellSimDay < currentSimDay);
      const weekdayCol = (startWeekdayOfViewedMonth + d - 1) % 7;
      const isWeekend = (weekdayCol === 5 || weekdayCol === 6);

      // Regras de Fechamento Econômico (a cada 30 dias de simulação)
      const isCloseDay = (cellSimDay >= 1 && cellSimDay % 30 === 0);
      const dayEvents = eventDays.get(cellSimDay) || [];
      const hasRecordedEvent = dayEvents.length > 0;

      // Regras de Safra (dias econômicos 150 a 209 em cada ciclo de 360 dias)
      const econDayInYear = cellSimDay >= 1 ? (((cellSimDay - 1) % 360) + 1) : 0;
      const isCellHarvest = (cellSimDay >= 1 && econDayInYear >= 150 && econDayInYear <= 209);

      const classes = [
        "calendar-day",
        isToday ? "is-today" : "",
        isPast ? "is-past" : "",
        isWeekend ? "is-weekend" : "",
        isCloseDay ? "is-close-day" : "",
        hasRecordedEvent ? "has-recorded-event" : "",
        isCellHarvest ? "is-harvest-day" : ""
      ].filter(Boolean).join(" ");

      const tooltipParts = [
        `${d} de ${viewedMonthName} de ${viewedCivilYear}`
      ];
      if (cellSimDay >= 1) {
        const cEconYear = Math.floor((cellSimDay - 1) / 360) + 1;
        const cEconMonth = Math.floor(((cellSimDay - 1) % 360) / 30) + 1;
        const cEconDay = ((cellSimDay - 1) % 30) + 1;
        tooltipParts.push(`Dia ${cellSimDay} da simulação (Ano ${cEconYear}, Mês ${cEconMonth}, Dia ${cEconDay})`);
      } else {
        tooltipParts.push("Período anterior ao início da simulação");
      }
      if (isToday) tooltipParts.push("Hoje (Dia atual da simulação)");
      if (isCloseDay) tooltipParts.push("Fechamento mensal da economia");
      if (isCellHarvest) tooltipParts.push("Período de safra agrícola");
      dayEvents.forEach((event) => tooltipParts.push(`Acontecimento (${event.source}): ${event.label}`));

      const tooltip = tooltipParts.join(" · ");

      cells.push(
        `<span class="${classes}" title="${escapeHtml(tooltip)}"` +
        (isToday ? ' aria-current="date"' : '') +
        `>${d}${isCloseDay ? '<i class="close-marker">●</i>' : ''}${hasRecordedEvent ? '<i class="event-marker" aria-hidden="true">◆</i>' : ''}</span>`
      );
    }

    if ($("calendarDays")) $("calendarDays").innerHTML = cells.join("");
    const eventList = $("calendarEventList");
    if (eventList) {
      eventList.innerHTML = calendarEvents.length
        ? calendarEvents.slice(0, 6).map((event) => {
          let dateLabel = "Data não informada";
          if (event.day !== null) {
            const eventDate = simulationDayToCivilDate(event.day);
            dateLabel = `${eventDate.civilDay} ${eventDate.monthName} ${eventDate.civilYear}`;
          } else if (event.month !== null) {
            dateLabel = `Mês econômico ${event.month} · dia civil não informado`;
          }
          return `<li><time>${escapeHtml(dateLabel)}</time><span>${escapeHtml(event.label)}</span><small>${escapeHtml(event.source)}</small></li>`;
        }).join("")
        : "<li>Sem acontecimento recente com data ou período informado pelo motor.</li>";
    }

    // Agenda: Relógio da Economia
    if ($("calendarSeason")) $("calendarSeason").textContent = seasonTitle;
    if ($("calendarSeasonDetail")) $("calendarSeasonDetail").textContent = seasonDetail;
    if ($("calendarClose")) $("calendarClose").textContent = closeLabel;
    if ($("calendarEconomicYear")) $("calendarEconomicYear").textContent = String(todayInfo.economicYear).padStart(2, "0");
    if ($("calendarEconomicMonth")) $("calendarEconomicMonth").textContent = "Mês " + String(todayInfo.economicMonth).padStart(2, "0");
    if ($("calendarEconomicDay")) $("calendarEconomicDay").textContent = "Dia " + todayInfo.economicDay + " / 30";

    const cycle = $("cycleBar");
    if (cycle) {
      const econDayInYear = ((currentSimDay - 1) % 360) + 1;
      const progress = ((econDayInYear - 1) / 360) * 100;
      cycle.innerHTML = '<div class="cycle-head"><b>Ritmo produtivo · Ano Econômico ' + todayInfo.economicYear + ' (' + todayInfo.civilYear + ')</b><span>' +
        (inHarvest ? '<span class="good">SAFRA ATIVA</span>' : 'ENTRESSAFRA') + ' · fechamento em ' + daysToClose + (daysToClose === 1 ? ' dia' : ' dias') +
        '</span></div><div class="track"><div class="harvest-zone" title="Janela de colheita (dias 150 a 209)"></div><div class="year-cursor" style="left:' + progress.toFixed(2) + '%"></div></div><div class="cycle-foot"><span>Janeiro (Dia 1)</span><span>Safra · dias 150 a 209 (Maio/Junho)</span><span>Dezembro (Dia 360)</span></div>';
    }
  }

  function renderSocietyView() {
    const host = $("societyDashboard");
    if (!host || !window.VilarejoSocietyRuntime || !window.VilarejoSociety) return;
    try {
      const sState = window.VilarejoSocietyRuntime.state;
      const snap = window.VilarejoSociety.getSnapshot(sState);
      const d = snap.demographic;
      const q = snap.qualityOfLife?.current || {};
      const m = snap.migration?.monthly || null;
      const cumM = snap.migration?.cumulative || null;
      const vital = snap.demographicEvents || null;
      const lastMonthVital = vital?.lastMonth || null;
      const culture = snap.culture || null;
      const qScore = finiteValue(q.score);
      const qLevel = q.level || (qScore === null ? UNAVAILABLE : qScore >= 70 ? "Favorável" : qScore >= 50 ? "Regular" : "Crítico");
      const measuredDimensions = finiteValue(q.measuredDimensions);
      const coverage = measuredDimensions === null ? "cobertura não informada" : `${number(measuredDimensions)}/6 dimensões`;

      const cultureNames = {
        local: "Cultura local",
        regional: "Origem regional",
        urbana: "Origem urbana",
        rural: "Origem rural"
      };

      const cultureRows = (culture?.groups || []).map((grp) => {
        const share = finiteValue(grp.share);
        const count = finiteValue(grp.count);
        const bar = share === null
          ? '<div class="society-bar-track is-unavailable" aria-label="Participação indisponível"></div>'
          : `<div class="society-bar-track"><span style="width:${Math.min(100, share)}%"></span></div>`;
        return `
          <div class="society-bar-row">
            <div class="society-bar-label"><span>${escapeHtml(cultureNames[grp.id] || grp.id)}</span><b>${count === null ? UNAVAILABLE : number(count)} hab. (${share === null ? UNAVAILABLE : number(share, 1) + "%"})</b></div>
            ${bar}
          </div>
        `;
      }).join("") || '<p class="society-muted">Nenhum grupo cultural registrado neste snapshot.</p>';

      const children = finiteValue(d.children);
      const workingAge = finiteValue(d.workingAge);
      const elderly = finiteValue(d.elderly);
      const ageTotal = children !== null && workingAge !== null && elderly !== null ? children + workingAge + elderly : null;
      const share = (value) => ageTotal !== null && ageTotal > 0 && value !== null ? value / ageTotal * 100 : null;
      const childShare = share(children);
      const activeShare = share(workingAge);
      const elderShare = share(elderly);
      const shareLabel = (value) => value === null ? UNAVAILABLE : `${number(value, 1)}%`;
      const ageBar = (value, className) => value === null
        ? `<div class="society-bar-track ${className} is-unavailable" aria-label="Proporção indisponível"></div>`
        : `<div class="society-bar-track ${className}"><span style="width:${Math.min(100, value)}%"></span></div>`;
      const cumulativeMigration = finiteValue(cumM?.net);
      const diversityIndex = finiteValue(culture?.diversityIndex);
      const integrationIndex = finiteValue(culture?.integrationIndex);
      const foreignBorn = finiteValue(d.foreignBorn);
      const foreignBornShare = finiteValue(d.foreignBornShare);

      const recentEvents = (snap.recentEvents || []).slice(-4).map((evt) => {
        const eventMonth = finiteValue(evt.month);
        const period = eventMonth === null ? "Período não informado" : `Mês econômico ${eventMonth}`;
        return `<li><small>${escapeHtml(period)}</small><span>${escapeHtml(evt.message || evt.text || evt.title || "Acontecimento social")}</span></li>`;
      }).join("") || '<li class="society-muted">Nenhum acontecimento demográfico recente registrado.</li>';

      host.innerHTML = `
        <div class="society-dashboard">
          <!-- KPIs Demográficos e de Qualidade de Vida -->
          <div class="society-kpis-grid">
            <article class="content-card society-card">
              <div class="eyebrow">POPULAÇÃO TOTAL</div>
              <strong class="society-huge">${formatObserved(d.population)}</strong>
              <span class="society-sub">moradores residentes</span>
              <div class="society-stat-meta">
                <span>Razão de dependência:</span>
                <b>${formatObserved(d.dependencyRatio, (value) => number(value, 1))} / 100 ativos</b>
              </div>
            </article>

            <article class="content-card society-card">
              <div class="eyebrow">QUALIDADE DE VIDA</div>
              <strong class="society-huge ${qScore === null ? 'is-unavailable' : qScore >= 60 ? 'good' : 'amber'}">${qScore === null ? UNAVAILABLE : number(qScore, 1)}${qScore === null ? '' : '<small>/100</small>'}</strong>
              <span class="society-sub">Nível ${escapeHtml(qLevel)} (${coverage})</span>
              <div class="society-stat-meta">
                <span>Bem-estar domiciliar:</span>
                <b>${formatObserved(q.components?.householdWellbeing, (value) => `${number(value, 0)}/100`)}</b>
              </div>
            </article>

            <article class="content-card society-card">
              <div class="eyebrow">DINÂMICA VITAL</div>
              <strong class="society-huge">${formatObserved(vital?.births)} <small class="vital-div">/</small> ${formatObserved(vital?.deaths)}</strong>
              <span class="society-sub">nascimentos / óbitos acumulados</span>
              <div class="society-stat-meta">
                <span>Último mês:</span>
                <b>${lastMonthVital ? `${formatObserved(lastMonthVital.births)} nascidos · ${formatObserved(lastMonthVital.deaths)} falecidos` : "Sem fechamento mensal observado"}</b>
              </div>
            </article>

            <article class="content-card society-card">
              <div class="eyebrow">MOBILIDADE E MIGRAÇÃO</div>
              <strong class="society-huge">${cumulativeMigration === null ? UNAVAILABLE : `${cumulativeMigration >= 0 ? "+" : ""}${number(cumulativeMigration)}`}</strong>
              <span class="society-sub">saldo migratório líquido acumulado</span>
              <div class="society-stat-meta">
                <span>Movimento no mês observado:</span>
                <b>${m ? `${formatObserved(m.incoming)} entradas · ${formatObserved(m.outgoing)} saídas` : UNAVAILABLE}</b>
              </div>
              <div class="society-stat-meta">
                <span>Moradores nascidos fora:</span>
                <b>${foreignBorn === null ? UNAVAILABLE : number(foreignBorn)} (${foreignBornShare === null ? UNAVAILABLE : `${number(foreignBornShare, 1)}%`})</b>
              </div>
            </article>
          </div>

          <!-- Composição da População e Cultura -->
          <div class="society-details-grid">
            <article class="content-card">
              <div class="section-heading compact-heading">
                <div>
                  <div class="eyebrow">COMPOSIÇÃO POR IDADE E ATIVIDADE</div>
                  <h3>Pirâmide e Capacidade de Trabalho</h3>
                  <p>Divisão da comunidade entre população dependente e força de trabalho produtiva.</p>
                </div>
              </div>
              <div class="society-bars-group">
                <div class="society-bar-row">
                  <div class="society-bar-label"><span>População em Idade Ativa (15 a 64 anos)</span><b>${formatObserved(workingAge)} hab. (${shareLabel(activeShare)})</b></div>
                  ${ageBar(activeShare, "active-track")}
                </div>
                <div class="society-bar-row">
                  <div class="society-bar-label"><span>Crianças e Jovens (0 a 14 anos)</span><b>${formatObserved(children)} hab. (${shareLabel(childShare)})</b></div>
                  ${ageBar(childShare, "child-track")}
                </div>
                <div class="society-bar-row">
                  <div class="society-bar-label"><span>Idosos (65 anos ou mais)</span><b>${formatObserved(elderly)} hab. (${shareLabel(elderShare)})</b></div>
                  ${ageBar(elderShare, "elder-track")}
                </div>
              </div>
              <div class="society-data-note">A composição por idade usa a população registrada pela Sociedade. A proporção fica indisponível quando não há denominador válido.</div>
            </article>

            <article class="content-card">
              <div class="section-heading compact-heading">
                <div>
                  <div class="eyebrow">DIVERSIDADE CULTURAL E INTEGRAÇÃO</div>
                  <h3>Origem dos Moradores</h3>
                  <p>Diversidade: <b>${formatObserved(diversityIndex, (value) => `${number(value, 1)}/100`)}</b> · Integração: <b>${integrationIndex !== null ? `${number(integrationIndex, 1)}/100` : foreignBorn === 0 ? "Sem moradores migrantes registrados" : UNAVAILABLE}</b></p>
                </div>
              </div>
              <div class="society-bars-group">${cultureRows}</div>
              <div class="society-recent-events">
                <div class="eyebrow">ACONTECIMENTOS DEMOGRÁFICOS RECENTES</div>
                <ul class="society-event-list">${recentEvents}</ul>
              </div>
            </article>
          </div>
        </div>
      `;
    } catch (e) {
      console.warn("Erro ao renderizar painel de Sociedade:", e);
    }
  }

  function renderServicesView() {
    const host = $("servicesDashboard");
    if (!host) return;
    try {
      const snap = snapshot();
      if (!snap) return;
      const s = snap.raw || {};
      const infra = snap.urbanInfra;
      const hasClosedMonth = snap.history.length > 0;
      const metricValue = (value, formatter = number) => {
        const finite = finiteValue(value);
        return finite === null ? UNAVAILABLE : formatter(finite);
      };
      const row = (label, value, formatter = number, source = "Snapshot da Economia") => {
        const finite = finiteValue(value);
        return `<div class="services-stat-row"><span>${escapeHtml(label)}<small class="ux-data-source">${escapeHtml(source)}</small></span><b class="${finite === null ? "is-unavailable" : ""}">${escapeHtml(finite === null ? UNAVAILABLE : formatter(finite))}</b></div>`;
      };
      const shortage = hasClosedMonth ? finiteValue(s.lastShortageUnits ?? s.lastShortage) : null;
      const unmet = hasClosedMonth ? finiteValue(s.lastUnmetHouseholds) : null;
      const housingCapacity = finiteValue(snap.housingCapacity);
      const lots = finiteValue(snap.lots);

      host.innerHTML = `
        <div class="services-dashboard-content">
          <div class="services-kpi-grid">
            <article class="content-card service-kpi-card">
              <div class="eyebrow">CAPACIDADE RESIDENCIAL</div>
              <strong class="${housingCapacity === null ? "is-unavailable" : ""}">${metricValue(housingCapacity)}</strong>
              <span>${housingCapacity === null ? "O snapshot atual não expõe capacidade habitacional." : "Capacidade agregada publicada pelo snapshot; sem localização individualizada."}</span>
            </article>

            <article class="content-card service-kpi-card">
              <div class="eyebrow">LOTEAMENTO</div>
              <strong class="${lots === null ? "is-unavailable" : ""}">${metricValue(lots)}</strong>
              <span>Valor agregado de lotes no snapshot; não indica localização.</span>
            </article>

            <article class="content-card service-kpi-card">
              <div class="eyebrow">CONGESTIONAMENTO URBANO</div>
              <strong class="${finiteValue(infra?.congestionRatio) === null ? "is-unavailable" : ""}">${metricValue(infra?.congestionRatio, (value) => `${number(value, 2)}×`)}</strong>
              <span>Razão publicada pela infraestrutura urbana.</span>
            </article>

            <article class="content-card service-kpi-card">
              <div class="eyebrow">FATOR URBANO</div>
              <strong class="${finiteValue(infra?.tfpFactor) === null ? "is-unavailable" : ""}">${metricValue(infra?.tfpFactor, (value) => number(value, 2))}</strong>
              <span>Fator de produtividade publicado pelo motor; sem conversão para indicador de serviço público.</span>
            </article>
          </div>

          <div class="services-details-grid">
            <article class="content-card">
              <div class="section-heading compact-heading">
                <div>
                  <div class="eyebrow">MERCADO LOCAL</div>
                  <h3>Abastecimento observado</h3>
                  <p>Estoque e preços do mercado da simulação, sem confundi-los com cobertura de serviço público.</p>
                </div>
              </div>
              <div class="services-stat-list">
                ${row("Estoque comercial", s.marketStock, (value) => `${number(value, 1)} unidades`)}
                ${row("Preço de mercado", s.marketPrice, money)}
                ${row("Preço de serviços locais", s.servicePrice, money)}
                ${row("Déficit de oferta no último fechamento", shortage, (value) => `${number(value, 1)} unidade(s)`)}
                ${row("Domicílios afetados no último fechamento", unmet, number)}
              </div>
            </article>

            <article class="content-card">
              <div class="section-heading compact-heading">
                <div>
                  <div class="eyebrow">INFRAESTRUTURA DISPONÍVEL</div>
                  <h3>Valores agregados do motor</h3>
                  <p>Dados sem geometrias públicas; não representam obras, ruas ou instalações individualizadas.</p>
                </div>
              </div>
              <div class="services-stat-list">
                ${row("Capacidade urbana", infra?.capacity)}
                ${row("Demanda urbana", infra?.demand)}
                ${row("Lotes agregados", s.lotCount, number)}
                ${row("Caixa público", s.treasuryCash, money)}
              </div>
              <div class="ux-public-services-unavailable"><strong>Indicadores de serviços públicos: indisponíveis</strong><p>Saúde, educação e segurança não têm séries próprias publicadas pela referência atual; nenhum índice é estimado.</p></div>
            </article>
          </div>
        </div>
      `;
    } catch (e) {
      console.warn("Erro ao renderizar serviços públicos:", e);
    }
  }

  function refreshStatus(data) {
    if ($("gameStatus")) {
      const status = data.gameOver ? "Partida encerrada" : data.running ? "Simulação em andamento" : "Em planejamento";
      $("gameStatus").textContent = status;
      $("gameStatus").classList.toggle("is-running", !!data.running);
      $("gameStatus").classList.toggle("is-over", !!data.gameOver);
    }
    refreshCalendar(data);
    if ($("historyCount")) $("historyCount").textContent = data.history.length + " meses registrados";
  }

  function refreshAlerts() {
    const badge = $("topbarAlertBadge");
    const countEl = $("topbarAlertCount");
    const container = $("overviewAlertsContainer");

    let alerts = [];
    if (typeof window !== "undefined" && window.VilarejoIntelligenceRuntime?.service?.getAlerts) {
      try {
        alerts = window.VilarejoIntelligenceRuntime.service.getAlerts() || [];
      } catch (e) {
        alerts = [];
      }
    }

    const activeAlerts = Array.isArray(alerts)
      ? alerts.filter((alert) => alert && alert.status === "ativo" && alert.severity !== "informativo")
      : [];
    const alertCount = activeAlerts.length;

    if (badge) {
      badge.classList.toggle("hidden", alertCount === 0);
      badge.classList.toggle("has-alerts", alertCount > 0);
      badge.title = alertCount > 0
        ? `${alertCount} alerta(s) na Central de Inteligência`
        : "Central de Inteligência — Nenhum alerta no momento";
    }
    if (countEl) {
      countEl.textContent = String(alertCount);
    }

    if (container) {
      container.classList.toggle("hidden", alertCount === 0);
      if (alertCount > 0) {
        const itemsHtml = activeAlerts.slice(0, 3).map((a) => {
          const sev = (a.severity || "").toLowerCase();
          const sevClass = sev === "critico" || sev === "grave" ? "severity-critico" : "severity-alto";
          const title = escapeHtml(a.title || a.indicator || "Alerta de sistema");
          const msg = escapeHtml(a.message || a.condition || "");
          const sevLabel = escapeHtml((a.severity || "Atenção").toUpperCase());
          return `
            <div class="overview-alert-item ${sevClass}">
              <div class="alert-item-header">
                <span class="alert-item-title">${title}</span>
                <span class="alert-item-severity">${sevLabel}</span>
              </div>
              <p class="alert-item-desc">${msg}</p>
            </div>
          `;
        }).join("");

        container.innerHTML = `
          <div class="overview-alerts-box">
            <div class="overview-alerts-header">
              <div>
                <div class="eyebrow">ALERTAS DO VILAREJO</div>
                <h4>Sinais de Risco e Tendências Observadas</h4>
              </div>
              <button type="button" class="btn-gov-shortcut" onclick="window.VilarejoDashboard && window.VilarejoDashboard.setView('intelligence')">
                Ver Central de Inteligência →
              </button>
            </div>
            <div class="overview-alerts-list">
              ${itemsHtml}
            </div>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="overview-alerts-box">
            <div class="overview-alerts-header">
              <div>
                <div class="eyebrow">ALERTAS DO VILAREJO</div>
                <h4>Situação Monitorada</h4>
              </div>
              <button type="button" class="btn-gov-shortcut" onclick="window.VilarejoDashboard && window.VilarejoDashboard.setView('intelligence')">
                Central de Inteligência →
              </button>
            </div>
            <p class="society-muted" style="margin-top:0.35rem">Nenhum alerta persistente ativo entre os indicadores observados. Dados ausentes permanecem indisponíveis e não são tratados como normais.</p>
          </div>
        `;
      }
    }
  }

  function refresh() {
    const data = snapshot();
    if (!data) return;
    lastSnapshot = data;
    syncDecisionRunLifecycle(data);
    refreshStatus(data);
    refreshAlerts();
    refreshMap(data);

    const history = data.history || [];
    const signature = (data.sessionId || "session-local") + ":" + history.length + ":" +
      (history.length ? JSON.stringify(history[history.length - 1]) : "inicio");
    if (signature !== lastChartSignature) {
      refreshCharts(data);
      lastChartSignature = signature;
    }
    
    if (activeView === 'society' && window.VilarejoSociety && window.VilarejoSocietyRuntime) {
        const host = document.querySelector('[data-view-panel="society"]');
        if (host) {
            window.VilarejoSociety.renderDashboard(window.VilarejoSocietyRuntime.state, host);
        }
    }
    refreshDomainPanels();
  }

  function captureDecisionClick(event) {
    if (!decisionObserver || !event?.target?.closest) return;
    const button = event.target.closest("#actions button, #eventOptions button[data-choice]");
    if (!button || button.disabled) return;
    const data = snapshot();
    const monthNumber = finiteValue(data?.monthNumber);
    if (!data?.runId || monthNumber === null) return;
    syncDecisionRunLifecycle(data);

    const eventChoice = Boolean(button.closest("#eventOptions"));
    const eventTitle = eventChoice ? $("eventTitle")?.textContent?.trim() : "";
    const labelText = String(button.textContent || "").replace(/\s+/g, " ").trim();
    if (!labelText) return;
    const label = eventChoice && eventTitle ? `${eventTitle}: ${labelText}` : labelText;
    const contextParts = [];
    if (eventChoice && $("eventText")?.textContent?.trim()) contextParts.push($("eventText").textContent.trim());
    if (button.title?.trim()) contextParts.push(button.title.trim());
    let token;
    try {
      token = decisionObserver.begin({
        runId: data.runId,
        source: eventChoice ? "event" : "action",
        label,
        context: contextParts.join(" ") || undefined,
        monthNumber,
        day: finiteValue(data.day) ?? undefined,
        measures: decisionMeasures(data)
      });
    } catch (error) {
      console.warn("Não foi possível registrar a escolha:", error);
      return;
    }

    window.setTimeout(() => {
      const after = snapshot();
      if (after?.runId === data.runId) decisionObserver.recordImmediate(token, decisionMeasures(after));
      refreshActiveView();
    }, 0);
  }

  let eventModalWasOpen = false;
  let previousModalFocus = null;

  function syncEventModalVisibility() {
    const modal = $("event");
    if (!modal || typeof document === "undefined") return;
    const isOpen = !modal.classList.contains("hidden");
    if (isOpen && !eventModalWasOpen) {
      previousModalFocus = document.activeElement;
      document.body?.classList.add("event-modal-open");
      eventModalWasOpen = true;
      window.setTimeout(() => {
        const choice = $("eventOptions")?.querySelector("button:not([disabled])");
        const title = $("eventTitle");
        if (choice) choice.focus();
        else if (title) {
          title.setAttribute("tabindex", "-1");
          title.focus();
        }
      }, 0);
    } else if (!isOpen && eventModalWasOpen) {
      document.body?.classList.remove("event-modal-open");
      eventModalWasOpen = false;
      if (previousModalFocus?.isConnected) previousModalFocus.focus();
      previousModalFocus = null;
    }
  }

  function trapEventModalFocus(event) {
    if (!eventModalWasOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      return;
    }
    if (event.key !== "Tab") return;
    const modal = $("event");
    const focusable = Array.from(modal?.querySelectorAll("button:not([disabled]), [tabindex='0']") || [])
      .filter((element) => element.offsetParent !== null);
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function initDecisionTracking() {
    if (typeof document === "undefined" || !window.VilarejoDecisionObserver?.createDecisionObserver) return;
    decisionObserver = window.VilarejoDecisionObserver.createDecisionObserver();
    document.addEventListener("click", captureDecisionClick, true);
  }

  function initEventModal() {
    const modal = $("event");
    if (!modal || typeof document === "undefined") return;
    if (typeof window.MutationObserver === "function") {
      const observer = new window.MutationObserver(syncEventModalVisibility);
      observer.observe(modal, { attributes: true, attributeFilter: ["class"] });
    }
    document.addEventListener("keydown", trapEventModalFocus);
    syncEventModalVisibility();
  }

  function getCalendarViewState() {
    return {
      year: viewedCivilYear,
      month: viewedCivilMonth,
      isBrowsing: isBrowsingCivilCalendar
    };
  }

  function navigateCalendarMonth(offset) {
    const delta = Number(offset);
    if (!Number.isSafeInteger(delta) || delta === 0) return getCalendarViewState();

    const monthIndex = (viewedCivilYear - 1) * 12 + viewedCivilMonth - 1 + delta;
    viewedCivilYear = Math.floor(monthIndex / 12) + 1;
    viewedCivilMonth = ((monthIndex % 12) + 12) % 12 + 1;
    isBrowsingCivilCalendar = true;
    if (lastSnapshot) refreshCalendar(lastSnapshot);
    return getCalendarViewState();
  }

  function returnCalendarToToday() {
    isBrowsingCivilCalendar = false;
    if (lastSnapshot) {
      const today = simulationDayToCivilDate(lastSnapshot.day);
      viewedCivilYear = today.civilYear;
      viewedCivilMonth = today.civilMonth;
      refreshCalendar(lastSnapshot);
    }
    return getCalendarViewState();
  }

  function initNavigation() {
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        setView(button.dataset.view);
        document.body.classList.remove("menu-open");
        refresh();
      });
    });
    document.querySelectorAll("[data-gov-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        setGovTab(button.dataset.govTab);
      });
    });
    const alertBadge = $("topbarAlertBadge");
    if (alertBadge) {
      alertBadge.addEventListener("click", () => {
        setView("intelligence");
      });
    }
    document.querySelectorAll("[data-months]").forEach((button) => {
      button.addEventListener("click", () => {
        visibleMonths = Number(button.dataset.months) || 12;
        document.querySelectorAll("[data-months]").forEach((item) => item.classList.toggle("active", item === button));
        if (lastSnapshot) refreshCharts(lastSnapshot);
      });
    });
    const prevBtn = $("calPrevMonth");
    if (prevBtn) {
      prevBtn.addEventListener("click", () => navigateCalendarMonth(-1));
    }
    const nextBtn = $("calNextMonth");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => navigateCalendarMonth(1));
    }
    const todayBtn = $("calToday");
    if (todayBtn) {
      todayBtn.addEventListener("click", returnCalendarToToday);
    }
    const mobileToggle = $("mobileMenu");
    if (mobileToggle) mobileToggle.addEventListener("click", () => document.body.classList.toggle("menu-open"));
    ["start", "pause"].forEach((id) => {
      const control = $(id);
      if (control) control.addEventListener("click", refresh);
    });
  }

  function initMapDetails() {
    const map = $("villageMap");
    if (!map) return;
    map.querySelectorAll("[data-district]").forEach((district) => {
      const selectDistrict = () => {
        selectMapSector(district.dataset.district);
      };
      district.addEventListener("click", selectDistrict);
      district.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectDistrict(); }
      });
    });
  }

  function initEventSubscriptions() {
    if (typeof window !== "undefined" && window.VilarejoRuntime && window.VilarejoRuntime.events) {
      const handleMonthClosure = () => {
        const data = snapshot();
        if (decisionObserver && data?.runId) {
          const currentRecord = data.history[data.history.length - 1];
          const monthNumber = finiteValue(currentRecord?.month) ?? finiteValue(data.monthNumber);
          if (monthNumber !== null && monthNumber > 0) {
            decisionObserver.observeMonthClose({
              runId: data.runId,
              monthNumber,
              day: finiteValue(data.day) ?? undefined,
              measures: decisionMeasures(data)
            });
          }
        }
        refreshAlerts();
        refresh();
      };
      window.VilarejoRuntime.events.on("world:synchronized", () => {
        refreshAlerts();
        refresh();
      });
      window.VilarejoRuntime.events.on("economy:month-closed", handleMonthClosure);
      window.VilarejoRuntime.events.on("intelligence:month-closed", () => {
        refreshAlerts();
        refresh();
      });
      window.VilarejoRuntime.events.on("game:initialized", () => {
        refreshAlerts();
        refresh();
      });
      window.VilarejoRuntime.events.on("game:reset", () => {
        refreshAlerts();
        refresh();
      });
      window.VilarejoRuntime.events.on("institutions:coalition-updated", () => refresh());
      window.VilarejoRuntime.events.on("politics:month-closed", () => refresh());
    }
  }

  function init() {
    initNavigation();
    initMapDetails();
    initDecisionTracking();
    initEventModal();
    initEventSubscriptions();
    refreshAlerts();
    setView(activeView);
    refresh();
  }

  if (typeof window !== "undefined") {
    window.VilarejoCalendar = {
      isLeapYear,
      getDaysInGregorianMonth,
      getFirstWeekdayOfMonth,
      civilDateToSimulationDay,
      simulationDayToCivilDate,
      getCivilDateInfo,
      MONTH_NAMES,
      WEEKDAY_NAMES,
      WEEKDAY_ABBR
    };
    window.VilarejoDashboard = {
      refresh,
      setView,
      setGovTab,
      navigateCalendarMonth,
      returnCalendarToToday,
      getCalendarViewState,
      getSnapshot: snapshot,
      selectMapSector,
      getDecisionRecords: () => decisionObserver ? decisionObserver.getRecords() : [],
      recordMonthClosure,
      refreshAlerts
    };
    if (typeof document !== "undefined") {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
      } else {
        init();
      }
    }
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      isLeapYear,
      getDaysInGregorianMonth,
      getFirstWeekdayOfMonth,
      civilDateToSimulationDay,
      simulationDayToCivilDate,
      getCivilDateInfo,
      MONTH_NAMES,
      WEEKDAY_NAMES,
      WEEKDAY_ABBR,
      navigateCalendarMonth,
      returnCalendarToToday,
      getCalendarViewState,
      refresh,
      setView,
      setGovTab,
      getSnapshot: snapshot,
      selectMapSector,
      getDecisionRecords: () => decisionObserver ? decisionObserver.getRecords() : [],
      recordMonthClosure,
      refreshAlerts
    };
  }
})();
