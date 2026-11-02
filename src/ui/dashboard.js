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

  let visibleMonths = 12;
  let activeView = "overview";
  let lastSnapshot = null;
  let lastChartSignature = "";

  function getCivilDateInfo(simDay) {
    const dayNum = Math.max(1, Number(simDay) || 1);
    const yearIndex = Math.floor((dayNum - 1) / 360);
    const civilYear = 2026 + yearIndex;
    const simYear = yearIndex + 1;
    const monthIndex = Math.floor(((dayNum - 1) % 360) / 30);
    const dayInMonth = ((dayNum - 1) % 30) + 1;
    // Calibrado para que o dia 149 inicial coincida com Sexta-feira, 29 de Maio de 2026
    const weekdayIndex = (dayNum + 3) % 7;
    const monthStartWeekday = ((weekdayIndex - ((dayInMonth - 1) % 7)) + 7) % 7;

    return {
      simDay: dayNum,
      simYear,
      civilYear,
      monthIndex,
      monthName: MONTH_NAMES[monthIndex],
      dayInMonth,
      weekdayIndex,
      weekdayName: WEEKDAY_NAMES[weekdayIndex],
      weekdayAbbr: WEEKDAY_ABBR[weekdayIndex],
      monthStartWeekday,
      daysInMonth: 30
    };
  }

  function snapshot() {
    try {
      if (window.VilarejoTest && typeof window.VilarejoTest.stateSnapshot === "function") {
        const s = window.VilarejoTest.stateSnapshot();
        const core = typeof window.VilarejoTest.getCoreSnapshot === "function"
          ? window.VilarejoTest.getCoreSnapshot()
          : (window.VilarejoRuntime?.snapshot() || null);
        const labor = typeof window.VilarejoTest.getLaborStats === "function"
          ? window.VilarejoTest.getLaborStats()
          : s?.laborStats;
        const pop = labor ? (labor.occupied + labor.unemployedSeeking + labor.outOfLaborForce) : 10;
        const bs = typeof window.VilarejoTest.generateBalanceSheets === "function"
          ? window.VilarejoTest.generateBalanceSheets()
          : s?.balanceSheets;
        const fiscal = typeof window.VilarejoTest.calculateFiscalReport === "function"
          ? window.VilarejoTest.calculateFiscalReport()
          : s?.fiscalReport;
        const macro = typeof window.VilarejoTest.calculateNationalAccounts === "function"
          ? window.VilarejoTest.calculateNationalAccounts()
          : s?.nationalAccounts;

        return {
          day: s?.day || (core?.calendar?.absoluteDay ?? 149),
          monthNumber: s?.monthNumber || (core?.calendar?.economicMonthNumber ?? 0),
          sessionId: core?.session?.startTime ? `session-${core.session.startTime}` : "session-vilarejo",
          gameOver: s?.gameOver || null,
          running: core?.session?.status === "running",
          history: window.VilarejoIntelligenceRuntime?.service?.getCurrentHistory?.() || [],
          population: pop,
          housingCapacity: s?.housingCapacity || (pop + 2),
          buildings: s?.buildings?.length || 0,
          lots: s?.lotCount ?? s?.lots ?? 10,
          employed: labor?.occupied || s?.employed || 0,
          laborStats: labor,
          balanceSheets: bs,
          fiscalReport: fiscal,
          nationalAccounts: macro,
          urbanInfra: s?.urbanInfra,
          marketPrice: s?.marketPrice,
          servicePrice: s?.servicePrice,
          marketStock: s?.marketStock,
          approval: s?.approval,
          wage: s?.wage,
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

  function setView(name) {
    activeView = name;
    document.querySelectorAll("[data-view-panel]").forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.viewPanel === name);
    });
    document.querySelectorAll("[data-view]").forEach((button) => {
      const selected = button.dataset.view === name;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-current", selected ? "page" : "false");
    });
    const titles = {
      overview: ["Visão geral", "Acompanhe o território e o pulso da comunidade."],
      economy: ["Economia", "Produção, preços, trabalho e atividade ao longo do tempo."],
      society: ["Sociedade", "Famílias, empresas, emprego e condições de vida."],
      government: ["Governo", "Câmara de representação, coalizões, grupos de poder e políticas públicas."],
      services: ["Serviços públicos", "Infraestrutura urbana, abastecimento, habitação e obras."],
      politics: ["Política", "Grupos de interesse, poder e relações com o governo."],
      institutions: ["Instituições", "Representação, Câmara, coalizões e mandatos do Estado."],
      records: ["Histórico", "Decisões, acontecimentos e movimentações financeiras."],
      intelligence: ["Central de Inteligência", "Evolução histórica, tendências e alertas da simulação."]
    };
    const item = titles[name] || titles.overview;
    if ($("pageTitle")) $("pageTitle").textContent = item[0];
    if ($("pageHeading")) $("pageHeading").textContent = item[0] === "Visão geral" ? "O vilarejo é seu." : item[0] + ".";
    if ($("pageDescription")) $("pageDescription").textContent = item[1];

    refreshActiveView();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function refreshActiveView() {
    if (activeView === "society") {
      renderSocietyView();
    }
    if (activeView === "services") {
      renderServicesView();
    }
    if (activeView === "politics" && window.VilarejoPolitics && window.VilarejoPoliticsRuntime) {
      const host = $("politicsDashboard");
      if (host) window.VilarejoPolitics.renderDashboard(window.VilarejoPoliticsRuntime.state, host);
    }
    if (activeView === "institutions" && window.VilarejoInstitutions && window.VilarejoInstitutionsRuntime) {
      const host = $("institutionsDashboard");
      if (host) window.VilarejoInstitutions.renderDashboard(window.VilarejoInstitutionsRuntime.state, host);
    }
    if (activeView === "intelligence" && window.VilarejoIntelligence?.renderDashboard) {
      const host = $("intelligenceDashboard");
      if (host) window.VilarejoIntelligence.renderDashboard(host);
    }
    if (activeView === "government") {
      if (window.VilarejoInstitutions && window.VilarejoInstitutionsRuntime) {
        const hostInst = $("institutionsDashboard");
        if (hostInst) window.VilarejoInstitutions.renderDashboard(window.VilarejoInstitutionsRuntime.state, hostInst);
      }
      if (window.VilarejoPolitics && window.VilarejoPoliticsRuntime) {
        const hostPol = $("politicsDashboard");
        if (hostPol) window.VilarejoPolitics.renderDashboard(window.VilarejoPoliticsRuntime.state, hostPol);
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
    const hasSeriesData = rows.some((row) => series.some((item) => Number.isFinite(Number(row[item.key]))));
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
      const value = Number(row[item.key]);
      if (Number.isFinite(value)) allValues.push(value);
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
        const value = Number(row[item.key]);
        return Number.isFinite(value) ? [x(index), y(value), value, row.label || ("M" + row.month)] : null;
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
    const history = data.history || [];
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

  function refreshMap(data) {
    const values = {
      "map-population": number(data.population),
      "map-housing": number(data.housingCapacity),
      "map-buildings": number(data.buildings),
      "map-lots": number(data.lots),
      "map-workers": number(data.employed)
    };
    Object.entries(values).forEach(([id, value]) => {
      const node = $(id);
      if (node) node.textContent = value;
    });
    const ratio = data.housingCapacity > 0 ? Math.min(100, (data.population / data.housingCapacity) * 100) : 0;
    const bar = $("housingFill");
    if (bar) bar.style.width = ratio.toFixed(1) + "%";
  }

  function refreshCalendar(data) {
    const info = getCivilDateInfo(data.day);
    const day = info.dayInMonth;
    const month = info.monthIndex;
    const year = info.civilYear;

    const economicDay = ((Math.max(1, Number(data.day)) - 1) % 360) + 1;
    const inHarvest = economicDay >= 150 && economicDay < 210;
    const daysToClose = 30 - ((Math.max(1, Number(data.day)) - 1) % 30);
    const closeLabel = daysToClose === 1 ? "Amanhã" : "Em " + daysToClose + " dias";

    let seasonTitle;
    let seasonDetail;
    if (inHarvest) {
      const remaining = 210 - economicDay;
      seasonTitle = "Safra em andamento";
      seasonDetail = remaining === 1 ? "Último dia da colheita." : "Colheita ativa · " + remaining + " dias restantes no período.";
    } else if (economicDay < 150) {
      const remaining = 150 - economicDay;
      seasonTitle = remaining === 1 ? "Safra começa amanhã" : "Entressafra";
      seasonDetail = "Início da colheita em " + remaining + (remaining === 1 ? " dia." : " dias.");
    } else {
      const remaining = (360 - economicDay) + 150;
      seasonTitle = "Entressafra";
      seasonDetail = "Próxima safra em " + remaining + " dias.";
    }

    // TopBar
    if ($("topbarCivilDate")) {
      $("topbarCivilDate").textContent = `${info.weekdayName}, ${String(day).padStart(2, "0")} de ${info.monthName} de ${year}`;
    }
    if ($("dateLabel")) {
      $("dateLabel").textContent = `Ano ${info.simYear} · Mês ${month + 1} · Dia ${data.day} da simulação`;
    }
    if ($("topbarSeasonBadge")) {
      $("topbarSeasonBadge").textContent = inHarvest ? "Safra ativa" : "Entressafra";
      $("topbarSeasonBadge").className = "season-badge " + (inHarvest ? "is-harvest" : "is-offseason");
    }

    // Calendário Visual Convencional (Grid de 30 dias)
    if ($("calendarWeekday")) $("calendarWeekday").textContent = info.weekdayName.toUpperCase();
    if ($("calendarDayNumber")) $("calendarDayNumber").textContent = String(day).padStart(2, "0");
    if ($("calendarMonthYear")) $("calendarMonthYear").textContent = (info.monthName + " " + year).toUpperCase();
    if ($("calendarMonthHeading")) $("calendarMonthHeading").textContent = info.monthName + " de " + year;
    if ($("calendarSimDay")) $("calendarSimDay").textContent = `Dia ${data.day} da simulação · Ano ${info.simYear}`;

    const cells = [];
    // Espaços vazios antes do dia 1 do mês
    for (let i = 0; i < info.monthStartWeekday; i += 1) {
      cells.push('<span class="calendar-blank" aria-hidden="true"></span>');
    }

    for (let d = 1; d <= 30; d += 1) {
      const isToday = d === day;
      const isPast = d < day;
      const weekdayCol = (info.monthStartWeekday + d - 1) % 7;
      const isWeekend = weekdayCol === 5 || weekdayCol === 6;
      const isCloseDay = d === 30;

      // Calcular o dia da simulação correspondente a este dia no mês
      const cellSimDay = (info.simYear - 1) * 360 + month * 30 + d;
      const cellEconomicDay = ((cellSimDay - 1) % 360) + 1;
      const isCellHarvest = cellEconomicDay >= 150 && cellEconomicDay < 210;

      const classes = [
        "calendar-day",
        isToday ? "is-today" : "",
        isPast ? "is-past" : "",
        isWeekend ? "is-weekend" : "",
        isCloseDay ? "is-close-day" : "",
        isCellHarvest ? "is-harvest-day" : ""
      ].filter(Boolean).join(" ");

      const tooltip = [
        `${d} de ${info.monthName} de ${year}`,
        isToday ? "Hoje (Dia atual)" : "",
        isCloseDay ? "Fechamento mensal" : "",
        isCellHarvest ? "Período de safra" : ""
      ].filter(Boolean).join(" · ");

      cells.push(
        `<span class="${classes}" title="${escapeHtml(tooltip)}"` +
        (isToday ? ' aria-current="date"' : '') +
        `>${d}${isCloseDay ? '<i class="close-marker">●</i>' : ''}</span>`
      );
    }

    if ($("calendarDays")) $("calendarDays").innerHTML = cells.join("");

    // Agenda e Ciclo Econômico
    if ($("calendarSeason")) $("calendarSeason").textContent = seasonTitle;
    if ($("calendarSeasonDetail")) $("calendarSeasonDetail").textContent = seasonDetail;
    if ($("calendarClose")) $("calendarClose").textContent = closeLabel;
    if ($("calendarEconomicYear")) $("calendarEconomicYear").textContent = String(info.simYear).padStart(2, "0");
    if ($("calendarEconomicDay")) $("calendarEconomicDay").textContent = "Dia " + economicDay + " de 360";

    const cycle = $("cycleBar");
    if (cycle) {
      const progress = ((economicDay - 1) / 360) * 100;
      cycle.innerHTML = '<div class="cycle-head"><b>Ritmo produtivo · Ano ' + info.simYear + ' (' + year + ')</b><span>' +
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
      const m = snap.migration?.monthly || { incoming: 0, outgoing: 0, net: 0 };
      const cumM = snap.migration?.cumulative || { incoming: 0, outgoing: 0, net: 0 };
      const vital = snap.demographicEvents || { births: 0, deaths: 0, agingTransitions: 0 };
      const lastMonthVital = vital.lastMonth || { births: 0, deaths: 0, agingTransitions: 0 };
      const culture = snap.culture || { diversityIndex: 0, groups: [] };

      const score = Number.isFinite(q.score) ? q.score.toFixed(1) : "n/d";
      const qLevel = q.level || (q.score >= 70 ? "Favorável" : q.score >= 50 ? "Regular" : "Crítico");
      const coverage = q.measuredDimensions ? `${q.measuredDimensions}/6 dimensões` : "em consolidação";

      const cultureNames = {
        local: "Cultura local",
        regional: "Origem regional",
        urbana: "Origem urbana",
        rural: "Origem rural"
      };

      const cultureRows = (culture.groups || []).map((grp) => {
        const share = grp.share ? grp.share.toFixed(1) : "0.0";
        return `
          <div class="society-bar-row">
            <div class="society-bar-label"><span>${escapeHtml(cultureNames[grp.id] || grp.id)}</span><b>${grp.count} hab. (${share}%)</b></div>
            <div class="society-bar-track"><span style="width:${Math.min(100, grp.share)}%"></span></div>
          </div>
        `;
      }).join("") || '<p class="society-muted">Sem dados culturais consolidados.</p>';

      const ageTotal = (d.children || 0) + (d.workingAge || 0) + (d.elderly || 0) || 1;
      const childShare = (((d.children || 0) / ageTotal) * 100).toFixed(1);
      const activeShare = (((d.workingAge || 0) / ageTotal) * 100).toFixed(1);
      const elderShare = (((d.elderly || 0) / ageTotal) * 100).toFixed(1);

      const recentEvents = (snap.recentEvents || []).slice(-4).map((evt) => {
        return `<li><small>Mês ${evt.month || 0}</small><span>${escapeHtml(evt.text || evt.title || "Evento social")}</span></li>`;
      }).join("") || '<li class="society-muted">Nenhum evento extraordinário registrado recentemente.</li>';

      host.innerHTML = `
        <div class="society-dashboard">
          <!-- KPIs Demográficos e de Qualidade de Vida -->
          <div class="society-kpis-grid">
            <article class="content-card society-card">
              <div class="eyebrow">POPULAÇÃO TOTAL</div>
              <strong class="society-huge">${d.population || 0}</strong>
              <span class="society-sub">moradores residentes</span>
              <div class="society-stat-meta">
                <span>Razão de dependência:</span>
                <b>${d.dependencyRatio !== null && d.dependencyRatio !== undefined ? Number(d.dependencyRatio).toFixed(1) : "n/d"} / 100 ativos</b>
              </div>
            </article>

            <article class="content-card society-card">
              <div class="eyebrow">QUALIDADE DE VIDA</div>
              <strong class="society-huge ${q.score >= 60 ? 'good' : 'amber'}">${score}<small>/100</small></strong>
              <span class="society-sub">Nível ${escapeHtml(qLevel)} (${coverage})</span>
              <div class="society-stat-meta">
                <span>Bem-estar domiciliar:</span>
                <b>${q.components?.householdWellbeing ? Number(q.components.householdWellbeing).toFixed(0) + '/100' : 'n/d'}</b>
              </div>
            </article>

            <article class="content-card society-card">
              <div class="eyebrow">DINÂMICA VITAL</div>
              <strong class="society-huge">${vital.births || 0} <small class="vital-div">/</small> ${vital.deaths || 0}</strong>
              <span class="society-sub">nascimentos / óbitos acumulados</span>
              <div class="society-stat-meta">
                <span>Último mês:</span>
                <b>${lastMonthVital.births || 0} nascidos · ${lastMonthVital.deaths || 0} falecidos</b>
              </div>
            </article>

            <article class="content-card society-card">
              <div class="eyebrow">MOBILIDADE E MIGRAÇÃO</div>
              <strong class="society-huge">${cumM.net >= 0 ? '+' : ''}${cumM.net || 0}</strong>
              <span class="society-sub">saldo migratório líquido acumulado</span>
              <div class="society-stat-meta">
                <span>Imigrantes:</span>
                <b>${d.foreignBorn || 0} (${Number(d.foreignBornShare || 0).toFixed(1)}%)</b>
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
                  <div class="society-bar-label"><span>População em Idade Ativa (15 a 64 anos)</span><b>${d.workingAge || 0} hab. (${activeShare}%)</b></div>
                  <div class="society-bar-track active-track"><span style="width:${activeShare}%"></span></div>
                </div>
                <div class="society-bar-row">
                  <div class="society-bar-label"><span>Crianças e Jovens (0 a 14 anos)</span><b>${d.children || 0} hab. (${childShare}%)</b></div>
                  <div class="society-bar-track child-track"><span style="width:${childShare}%"></span></div>
                </div>
                <div class="society-bar-row">
                  <div class="society-bar-label"><span>Idosos (65 anos ou mais)</span><b>${d.elderly || 0} hab. (${elderShare}%)</b></div>
                  <div class="society-bar-track elder-track"><span style="width:${elderShare}%"></span></div>
                </div>
              </div>
              <div class="society-data-note">A transição demográfica e a entrada na vida adulta ocorrem organicamente a cada ciclo mensal, alimentando o mercado de trabalho do vilarejo sem inflar artificialmente a economia.</div>
            </article>

            <article class="content-card">
              <div class="section-heading compact-heading">
                <div>
                  <div class="eyebrow">DIVERSIDADE CULTURAL E INTEGRAÇÃO</div>
                  <h3>Origem dos Moradores</h3>
                  <p>Diversidade: <b>${culture.diversityIndex.toFixed(1)}/100</b> · Integração: <b>${culture.integrationIndex !== null && culture.integrationIndex !== undefined ? culture.integrationIndex.toFixed(1) + '/100' : 'Sem migração externa'}</b></p>
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
      const infra = s.urbanInfra || { capacity: 20, demand: snap.population, congestionRatio: 0.8, tfpFactor: 1.0 };
      const congestion = Number(infra.congestionRatio || 1.0).toFixed(2);
      const tfp = Math.round(Number(infra.tfpFactor || 1.0) * 100);
      const lots = s.lotCount ?? s.lots ?? 10;
      const buildings = s.buildings?.length || 0;
      const housingCap = s.housingCapacity || (snap.population + 2);
      const housingRate = housingCap > 0 ? Math.min(100, (snap.population / housingCap) * 100) : 0;
      const marketStock = Number(s.marketStock || 0).toFixed(1);
      const marketPrice = money(s.marketPrice || 50);
      const servicePrice = money(s.servicePrice || 180);
      const shortage = Number(s.lastShortage || 0);
      const unmet = s.lastUnmetHouseholds || 0;
      const npvLandlord = s.lastProjectNPV?.landlord?.viable ? "Viável (" + money(s.lastProjectNPV.landlord.npv) + ")" : "Cautela / Retração";
      const npvFarm = s.lastProjectNPV?.farm?.viable ? "Viável (" + money(s.lastProjectNPV.farm.npv) + ")" : "Cautela / Retração";

      host.innerHTML = `
        <div class="services-dashboard-content">
          <div class="services-kpi-grid">
            <article class="content-card service-kpi-card">
              <div class="eyebrow">HABITAÇÃO E MORADIA</div>
              <strong>${snap.population} / ${housingCap}</strong>
              <span>moradores / capacidade residencial</span>
              <div class="capacity-track"><span style="width: ${housingRate.toFixed(1)}%"></span></div>
            </article>

            <article class="content-card service-kpi-card">
              <div class="eyebrow">TERRENOS E EXPANSÃO</div>
              <strong>${lots}</strong>
              <span>lotes públicos disponíveis para obras</span>
            </article>

            <article class="content-card service-kpi-card">
              <div class="eyebrow">MALHA URBANA E CONGESTIONAMENTO</div>
              <strong class="${congestion > 1.0 ? 'bad' : 'good'}">${congestion}x</strong>
              <span>Capacidade da malha: ${infra.capacity || 20} hab. (Demanda: ${infra.demand || snap.population})</span>
            </article>

            <article class="content-card service-kpi-card">
              <div class="eyebrow">PRODUTIVIDADE TFP URBANA</div>
              <strong class="${tfp >= 100 ? 'good' : 'amber'}">${tfp}%</strong>
              <span>Eficiência dos fatores e mobilidade local</span>
            </article>
          </div>

          <div class="services-details-grid">
            <article class="content-card">
              <div class="section-heading compact-heading">
                <div>
                  <div class="eyebrow">ABASTECIMENTO E COMÉRCIO</div>
                  <h3>Segurança Alimentar e Serviços Básicos</h3>
                  <p>Condição de abastecimento de cestas essenciais e serviços gerais.</p>
                </div>
              </div>
              <div class="services-stat-list">
                <div class="services-stat-row"><span>Estoque de alimentos no comércio local</span><b>${marketStock} unidades</b></div>
                <div class="services-stat-row"><span>Preço da cesta básica alimentar</span><b>${marketPrice}</b></div>
                <div class="services-stat-row"><span>Tarifa da oficina e serviços locais</span><b>${servicePrice}</b></div>
                <div class="services-stat-row"><span>Situação do abastecimento alimentar</span><b class="${shortage > 0 ? 'bad' : 'good'}">${shortage > 0 ? 'Escassez parcial' : 'Totalmente abastecido'}</b></div>
                <div class="services-stat-row"><span>Famílias afetadas por racionamento</span><b class="${unmet > 0 ? 'bad' : 'good'}">${unmet}</b></div>
              </div>
            </article>

            <article class="content-card">
              <div class="section-heading compact-heading">
                <div>
                  <div class="eyebrow">OBRAS E MANUTENÇÃO URBANA</div>
                  <h3>Capacidade Construtiva e Expansão</h3>
                  <p>Obras públicas em andamento e viabilidade financeira de projetos.</p>
                </div>
              </div>
              <div class="services-stat-list">
                <div class="services-stat-row"><span>Obras de moradia em construção</span><b>${buildings} obra(s)</b></div>
                <div class="services-stat-row"><span>Manutenção predial e urbana</span><b>Contratos ativos com a oficina local</b></div>
                <div class="services-stat-row"><span>Prestação de serviços mecânicos e reparos</span><b>Oficina operacional permanente</b></div>
                <div class="services-stat-row"><span>Viabilidade VPL Imobiliário (14k)</span><b class="${s.lastProjectNPV?.landlord?.viable ? 'good' : 'bad'}">${npvLandlord}</b></div>
                <div class="services-stat-row"><span>Viabilidade VPL Lote Agrícola (8k)</span><b class="${s.lastProjectNPV?.farm?.viable ? 'good' : 'bad'}">${npvFarm}</b></div>
              </div>
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

  function refresh() {
    const data = snapshot();
    if (!data) return;
    lastSnapshot = data;
    refreshStatus(data);
    refreshMap(data);

    const history = data.history || [];
    const signature = (data.sessionId || "session-local") + ":" + history.length + ":" +
      (history.length ? JSON.stringify(history[history.length - 1]) : "inicio");
    if (signature !== lastChartSignature) {
      refreshCharts(data);
      lastChartSignature = signature;
    }

    refreshActiveView();
  }

  function initNavigation() {
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        setView(button.dataset.view);
        document.body.classList.remove("menu-open");
      });
    });
    document.querySelectorAll("[data-months]").forEach((button) => {
      button.addEventListener("click", () => {
        visibleMonths = Number(button.dataset.months) || 12;
        document.querySelectorAll("[data-months]").forEach((item) => item.classList.toggle("active", item === button));
        if (lastSnapshot) refreshCharts(lastSnapshot);
      });
    });
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
        map.querySelectorAll("[data-district]").forEach((item) => item.classList.remove("selected"));
        district.classList.add("selected");
        const label = $("districtLabel");
        if (label) label.textContent = district.dataset.district;
      };
      district.addEventListener("click", selectDistrict);
      district.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectDistrict(); }
      });
    });
  }

  function initEventSubscriptions() {
    if (window.VilarejoRuntime && window.VilarejoRuntime.events) {
      window.VilarejoRuntime.events.on("world:synchronized", () => refresh());
      window.VilarejoRuntime.events.on("economy:month-closed", () => refresh());
      window.VilarejoRuntime.events.on("game:initialized", () => refresh());
      window.VilarejoRuntime.events.on("game:reset", () => refresh());
      window.VilarejoRuntime.events.on("institutions:coalition-updated", () => refresh());
      window.VilarejoRuntime.events.on("politics:month-closed", () => refresh());
    }
  }

  function init() {
    initNavigation();
    initMapDetails();
    initEventSubscriptions();
    setView(activeView);
    refresh();
  }

  window.VilarejoDashboard = { refresh, setView, recordMonthClosure };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
