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

  let visibleMonths = 12;
  let activeView = "overview";
  let lastSnapshot = null;
  let lastChartSignature = "";
  let calendarAnchorDate = new Date();
  let calendarAnchorDay = 149;
  let calendarSessionId = null;
  calendarAnchorDate.setHours(12, 0, 0, 0);

  function snapshot() {
    try {
      return window.VilarejoTest && typeof window.VilarejoTest.getDashboardSnapshot === "function"
        ? window.VilarejoTest.getDashboardSnapshot()
        : null;
    } catch (error) {
      console.warn("Não foi possível ler o retrato do Vilarejo:", error);
      return null;
    }
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
      government: ["Governo", "Políticas, orçamento e patrimônio público."],
      records: ["Registros", "Decisões, acontecimentos e movimentações financeiras."]
    };
    const item = titles[name] || titles.overview;
    if ($("pageTitle")) $("pageTitle").textContent = item[0];
    if ($("pageHeading")) $("pageHeading").textContent = item[0] === "Visão geral" ? "O vilarejo é seu." : item[0] + ".";
    if ($("pageDescription")) $("pageDescription").textContent = item[1];
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      '" role="img" aria-label="' + target.dataset.label + '">' + grid + paths + labels + '</svg>';
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
    const ratio = data.housingCapacity > 0 ? Math.min(100, data.population / data.housingCapacity * 100) : 0;
    const bar = $("housingFill");
    if (bar) bar.style.width = ratio + "%";
  }

  function civilDateForDay(day, sessionId) {
    // Cada partida começa na data local do computador. A partir daí, o calendário
    // avança um dia por dia simulado e respeita meses reais e anos bissextos.
    if (calendarSessionId !== sessionId) {
      calendarSessionId = sessionId;
      calendarAnchorDate = new Date();
      calendarAnchorDate.setHours(12, 0, 0, 0);
      calendarAnchorDay = Number(day) || 1;
    }
    const date = new Date(calendarAnchorDate);
    date.setDate(date.getDate() + (Math.max(1, Number(day) || 1) - calendarAnchorDay));
    return date;
  }

  function refreshCalendar(data) {
    const date = civilDateForDay(data.day, data.sessionId);
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const weekdayNames = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
    const weekday = date.getDay();
    const firstWeekday = new Date(year, month, 1).getDay();
    const mondayOffset = (firstWeekday + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];

    for (let index = 0; index < 42; index += 1) {
      const cellDay = index - mondayOffset + 1;
      if (cellDay < 1 || cellDay > daysInMonth) {
        cells.push('<span class="calendar-blank" aria-hidden="true"></span>');
        continue;
      }
      const isToday = cellDay === day;
      const cellDate = new Date(year, month, cellDay);
      const weekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;
      const classes = ["calendar-day", cellDay < day ? "is-past" : "", weekend ? "is-weekend" : "", isToday ? "is-today" : ""].filter(Boolean).join(" ");
      cells.push('<span class="' + classes + '"' + (isToday ? ' aria-current="date" aria-label="Hoje, ' + cellDay + ' de ' + monthNames[month] + ' de ' + year + '"' : ' aria-label="' + cellDay + ' de ' + monthNames[month] + '"') + '>' + cellDay + '</span>');
    }

    if ($("calendarWeekday")) $("calendarWeekday").textContent = weekdayNames[weekday].toUpperCase();
    if ($("calendarDayNumber")) $("calendarDayNumber").textContent = String(day).padStart(2, "0");
    if ($("calendarMonthYear")) $("calendarMonthYear").textContent = (monthNames[month] + " " + year).toUpperCase();
    if ($("calendarMonthHeading")) $("calendarMonthHeading").textContent = monthNames[month].replace(/^./, (letter) => letter.toUpperCase()) + " de " + year;
    if ($("calendarSimDay")) $("calendarSimDay").textContent = "Dia " + data.day + " da simulação";
    if ($("calendarDays")) $("calendarDays").innerHTML = cells.join("");

    const economicDay = ((Math.max(1, Number(data.day)) - 1) % 360) + 1;
    const economicYear = Math.floor((Math.max(1, Number(data.day)) - 1) / 360) + 1;
    const inHarvest = economicDay >= 150 && economicDay < 210;
    let seasonTitle;
    let seasonDetail;
    if (inHarvest) {
      const remaining = 210 - economicDay;
      seasonTitle = "Safra em andamento";
      seasonDetail = remaining === 1 ? "Último dia previsto da colheita." : "Colheita ativa · " + remaining + " dias até o fim do período.";
    } else if (economicDay < 150) {
      const remaining = 150 - economicDay;
      seasonTitle = remaining === 1 ? "Safra começa amanhã" : "Entressafra";
      seasonDetail = "Início da colheita em " + remaining + (remaining === 1 ? " dia." : " dias.");
    } else {
      const remaining = (360 - economicDay) + 150;
      seasonTitle = "Entressafra";
      seasonDetail = "Próxima safra em " + remaining + " dias.";
    }
    const remainder = Math.max(1, Number(data.day)) % 30;
    const daysToClose = remainder === 0 ? 30 : 30 - remainder;
    const closeLabel = daysToClose === 1 ? "Amanhã" : "Em " + daysToClose + " dias";

    if ($("calendarSeason")) $("calendarSeason").textContent = seasonTitle;
    if ($("calendarSeasonDetail")) $("calendarSeasonDetail").textContent = seasonDetail;
    if ($("calendarClose")) $("calendarClose").textContent = closeLabel;
    if ($("calendarEconomicYear")) $("calendarEconomicYear").textContent = String(economicYear).padStart(2, "0");
    if ($("calendarEconomicDay")) $("calendarEconomicDay").textContent = "Dia " + economicDay + " de 360";

    const dateLabel = weekdayNames[weekday].slice(0, 3) + ", " + String(day).padStart(2, "0") + " " + monthNames[month].slice(0, 3) + " " + year + " · Dia " + data.day;
    if ($("dateLabel")) $("dateLabel").textContent = dateLabel;

    const cycle = $("cycleBar");
    if (cycle) {
      const progress = ((economicDay - 1) / 360) * 100;
      cycle.innerHTML = '<div class="cycle-head"><b>Ritmo produtivo · Ano econômico ' + economicYear + '</b><span>' + (inHarvest ? '<span class="good">SAFRA ATIVA</span>' : 'ENTRESSAFRA') + ' · próximo fechamento em ' + daysToClose + (daysToClose === 1 ? ' dia' : ' dias') + '</span></div><div class="track"><div class="harvest-zone"></div><div class="year-cursor" style="left:' + progress.toFixed(2) + '%"></div></div><div class="cycle-foot"><span>Início do ciclo</span><span>Safra · dias 150 a 209</span><span>Dia 360</span></div>';
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

  function init() {
    initNavigation();
    initMapDetails();
    setView(activeView);
    refresh();
  }

  window.VilarejoDashboard = { refresh, setView };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
