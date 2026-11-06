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
  let worldRendererHandle = null;

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

  function getCalendarViewState() {
    return { year: viewedCivilYear, month: viewedCivilMonth, isBrowsing: isBrowsingCivilCalendar };
  }

  function navigateCalendarMonth(offset) {
    const delta = Number(offset);
    if (!Number.isSafeInteger(delta) || delta === 0) return getCalendarViewState();

    const monthIndex = (viewedCivilYear - 1) * 12 + viewedCivilMonth - 1 + delta;
    const nextYear = Math.floor(monthIndex / 12) + 1;
    if (nextYear < 1) return getCalendarViewState();
    viewedCivilYear = nextYear;
    viewedCivilMonth = ((monthIndex % 12) + 12) % 12 + 1;
    isBrowsingCivilCalendar = true;
    if (lastSnapshot) refreshCalendar(lastSnapshot);
    return getCalendarViewState();
  }

  function returnCalendarToToday(rawDay) {
    const currentDay = finiteValue(rawDay) ?? finiteValue(lastSnapshot?.day);
    isBrowsingCivilCalendar = false;
    if (currentDay !== null) {
      const today = simulationDayToCivilDate(currentDay);
      viewedCivilYear = today.civilYear;
      viewedCivilMonth = today.civilMonth;
    }
    if (lastSnapshot) refreshCalendar(lastSnapshot);
    return getCalendarViewState();
  }

  function resetCalendarNavigation(rawDay) {
    return returnCalendarToToday(rawDay);
  }

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
    const topHomeBtn = $("btnTopHome");
    if (topHomeBtn) {
      topHomeBtn.addEventListener("click", () => setView("overview"));
    }
    const breadHome = $("breadHome");
    if (breadHome) {
      breadHome.addEventListener("click", () => setView("overview"));
    }
    document.querySelectorAll("[data-view]").forEach((button) => {
      const selected = button.dataset.view === name;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-current", selected ? "page" : "false");
    });
    const titles = {
      overview: ["Visão geral", "O que mudou, o que merece atenção e quais decisões estão disponíveis."],
      economy: ["Economia", "Produção, preços, trabalho e atividade ao longo do tempo."],
      society: ["Sociedade", "Famílias, empresas, emprego e condições de vida."],
      government: ["Governo", "Câmara de representação, coalizões, grupos de poder e políticas públicas."],
      services: ["Serviços", "Infraestrutura urbana e indicadores que o motor realmente publica."],
      politics: ["Política", "Grupos de interesse, poder e relações com o governo."],
      institutions: ["Instituições", "Representação, Câmara, coalizões e mandatos do Estado."],
      intelligence: ["Central de Inteligência", "Tendências, alertas e séries históricas observadas na simulação."],
      newspaper: ["Jornal do Vilarejo", "Notícias, crônicas e fatos da comunidade a cada mês."],
      records: ["Histórico", "Decisões, acontecimentos e movimentações registrados por execução."]
    };
    const item = titles[name] || titles.overview;
    if ($("pageTitle")) $("pageTitle").textContent = item[0];
    if ($("pageHeading")) $("pageHeading").textContent = item[0] === "Visão geral" ? "Panorama do município" : item[0] + ".";
    if ($("pageDescription")) $("pageDescription").textContent = item[1];

    if (name === "overview") {
      initWorldRenderer();
      if (worldRendererHandle && typeof worldRendererHandle.refresh === "function") {
        worldRendererHandle.refresh();
      }
    }

    if (subTab && name === "government") {
      setGovTab(subTab);
    } else {
      refreshActiveView();
    }
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setGovTab(tabName) {
    activeGovTab = tabName || "executivo";
    if (typeof document === "undefined") return;
    document.querySelectorAll("[data-gov-tab]").forEach((btn) => {
      const isSelected = btn.dataset.govTab === activeGovTab;
      btn.classList.toggle("active", isSelected);
      btn.setAttribute("aria-selected", isSelected ? "true" : "false");
    });
    document.querySelectorAll(".gov-tab-pane").forEach((pane) => {
      pane.classList.toggle("active", pane.dataset.govPane === activeGovTab || pane.id === `gov-tab-${activeGovTab}`);
    });
    renderGovernmentSubView();
  }

  function renderGovernmentSubView() {
    if (activeGovTab === "executivo") {
      renderGovernmentOverview();
    } else if (activeGovTab === "camara") {
      const host = $("institutionsDashboard");
      if (host) {
        if (typeof window !== "undefined" && window.VilarejoInstitutions && window.VilarejoInstitutionsRuntime) {
          window.VilarejoInstitutions.renderDashboard(window.VilarejoInstitutionsRuntime.state, host);
        } else if (!host.children.length) {
          host.innerHTML = '<div class="module-empty-state"><div class="module-empty-icon">▥</div><h3>Câmara Municipal</h3><p>A representação parlamentar e formação de coalizão estarão disponíveis com a sincronização institucional.</p></div>';
        }
      }
    } else if (activeGovTab === "politica") {
      const host = $("politicsDashboard");
      if (host) {
        if (typeof window !== "undefined" && window.VilarejoPolitics && window.VilarejoPoliticsRuntime) {
          window.VilarejoPolitics.renderDashboard(window.VilarejoPoliticsRuntime.state, host);
        } else if (!host.children.length) {
          host.innerHTML = '<div class="module-empty-state"><div class="module-empty-icon">⚖</div><h3>Grupos de Interesse</h3><p>A correlação de forças e influência dos grupos de poder será carregada a cada ciclo político.</p></div>';
        }
      }
    }
  }

  function renderGovernmentOverview() {
    const host = $("governmentSummaryCard");
    if (!host || typeof window === "undefined") return;
    try {
      const instRuntime = window.VilarejoInstitutionsRuntime;
      const instState = instRuntime?.getSnapshot?.() || instRuntime?.state || {};
      const legislature = instState.legislature || {};
      const coalitionData = instState.coalition || {};
      const summary = instState.summary || {};
      const totalSeats = Number(legislature.totalSeats || summary.totalSeats || instState.settings?.totalSeats || 21);
      const neededMajority = Number(legislature.majoritySeats || summary.quorumSeats || Math.floor(totalSeats / 2) + 1);
      const coalitionIds = Array.isArray(coalitionData.groupIds) ? coalitionData.groupIds : [];
      const coalitionGroups = Array.isArray(coalitionData.groups) ? coalitionData.groups : [];
      const coalitionCount = coalitionIds.length || coalitionGroups.length;
      const coalitionSeats = Number(coalitionData.seats ?? summary.coalitionSeats ?? 0);
      const status = coalitionData.status || summary.coalitionStatus || "not_formed";
      const termMonths = Number(instState.settings?.termMonths || 48);
      const currentMonth = Number(instState.currentMonth || 0);
      const nextElectionMonth = Number(instState.nextElectionMonth || currentMonth + termMonths);
      const monthInTerm = Math.max(1, currentMonth - (nextElectionMonth - termMonths) + 1);
      const remainingMonths = Math.max(0, nextElectionMonth - currentMonth);
      const oppositionSeats = Number(
        instState.alignment?.oppositionSeats ?? instState.opposition?.seats ?? Math.max(0, totalSeats - coalitionSeats)
      );

      const statusBadge = status === "majority"
        ? '<span class="gov-badge is-majority">Maioria absoluta</span>'
        : status === "minority"
        ? '<span class="gov-badge is-minority">Governo de minoria</span>'
        : '<span class="gov-badge is-not-formed">Sem coalizão formada</span>';

      host.innerHTML = `
        <div class="gov-summary-content">
          <div class="gov-summary-header">
            <div>
              <div class="eyebrow">PODER EXECUTIVO E PARLAMENTAR</div>
              <h3>Situação da Base de Governo</h3>
            </div>
            ${statusBadge}
          </div>
          <div class="gov-kpi-row">
            <div class="gov-kpi-item">
              <small>BASE DO GOVERNO</small>
              <strong>${coalitionSeats} <small>/ ${totalSeats} cadeiras</small></strong>
              <span>${coalitionCount > 0 ? coalitionCount + ' grupo(s) na coalizão' : 'Nenhum grupo coligado'}</span>
            </div>
            <div class="gov-kpi-item">
              <small>OPOSIÇÃO / INDEPENDENTES</small>
              <strong>${oppositionSeats} <small>/ ${totalSeats} cadeiras</small></strong>
              <span>Maioria necessária: ${neededMajority}</span>
            </div>
            <div class="gov-kpi-item">
              <small>MANDATO DA CÂMARA</small>
              <strong>${monthInTerm}º <small>mês de ${termMonths}</small></strong>
              <span>${remainingMonths} meses até renovação</span>
            </div>
          </div>
          <div class="gov-actions-row">
            <button type="button" class="btn-gov-shortcut" onclick="window.VilarejoDashboard && window.VilarejoDashboard.setGovTab('camara')">
              <span>▥</span> Coalizão e Cadeiras da Câmara
            </button>
            <button type="button" class="btn-gov-shortcut" onclick="window.VilarejoDashboard && window.VilarejoDashboard.setGovTab('camara')">
              <span>📜</span> Votação de Leis & Eleições
            </button>
            <button type="button" class="btn-gov-shortcut" onclick="window.VilarejoDashboard && window.VilarejoDashboard.setGovTab('politica')">
              <span>⚖</span> Influência dos Grupos Políticos
            </button>
          </div>
          ${renderCabinetDilemmaHtml()}
          ${renderCooperativeAndMicrocreditHtml()}
          <div class="gov-ppa-section" style="margin-top:1.25rem;padding-top:1rem;border-top:1px solid var(--border,#e2e8f0);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
              <span class="eyebrow" style="font-weight:700;color:var(--gold,#d97706);">PLANO PLURIANUAL DE METAS (PPA)</span>
              <small style="color:var(--muted,#64748b);">Metas Estratégicas de Desenvolvimento</small>
            </div>
            <div class="gov-milestones-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.75rem;">
              ${renderPpaMilestonesHtml()}
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      console.warn("Erro ao renderizar resumo governamental:", e);
    }
  }

  function renderPpaMilestonesHtml() {
    try {
      const worldSnap = window.VilarejoRuntime?.modules?.get?.("mundo_vivo")?.snapshot || window.VilarejoWorld?.snapshot;
      const milestones = Array.isArray(worldSnap?.milestones) ? worldSnap.milestones : [];
      if (!milestones.length) {
        return '<p class="ux-observation-empty" style="grid-column:1/-1;margin:0;padding:0.5rem;font-size:0.85rem;">Metas em acompanhamento pelo Mundo Vivo; aguardando primeiro fechamento mensal.</p>';
      }
      return milestones.slice(0, 6).map(m => {
        const achieved = m.achieved;
        const progressPct = m.goal > 0 ? Math.min(100, Math.round(((m.progress || 0) / m.goal) * 100)) : (achieved ? 100 : 0);
        const badge = achieved
          ? '<span style="color:#16a34a;font-weight:700;font-size:0.75rem;background:#dcfce7;padding:2px 6px;border-radius:4px;">Atingida</span>'
          : '<span style="color:#d97706;font-weight:600;font-size:0.75rem;background:#fef3c7;padding:2px 6px;border-radius:4px;">Em andamento</span>';
        return `
          <div style="background:var(--surface,#f8fafc);border:1px solid var(--border,#e2e8f0);border-radius:6px;padding:0.6rem 0.75rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.25rem;">
              <strong style="font-size:0.85rem;color:var(--text,#1e293b);">${escapeHtml(m.title)}</strong>
              ${badge}
            </div>
            <p style="font-size:0.75rem;color:var(--muted,#64748b);margin:0 0 0.5rem 0;line-height:1.3;">${escapeHtml(m.description)}</p>
            <div style="background:#e2e8f0;border-radius:4px;height:6px;overflow:hidden;">
              <div style="background:${achieved ? '#16a34a' : 'var(--gold,#d97706)'};width:${progressPct}%;height:100%;transition:width 0.3s ease;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:0.25rem;font-size:0.7rem;color:var(--muted,#64748b);">
              <span>Progresso: ${m.progress !== null ? m.progress : 0} / ${m.goal} ${escapeHtml(m.unit || '')}</span>
              <span>${progressPct}%</span>
            </div>
          </div>
        `;
      }).join("");
    } catch (_) {
      return '<p style="font-size:0.8rem;color:var(--muted,#64748b);">Plano de metas em monitoramento.</p>';
    }
  }

  function renderCabinetDilemmaHtml() {
    try {
      const testApi = window.VilarejoTest;
      const snap = testApi?.stateSnapshot ? testApi.stateSnapshot() : null;
      const councilSupport = snap?.councilSupport ?? 65;
      const pending = snap?.pendingCabinetDilemma;
      const last = snap?.lastResolvedDilemma;

      let councilBadge = councilSupport >= 60
        ? '<span style="color:#16a34a;background:#dcfce7;padding:3px 8px;border-radius:6px;font-weight:700;font-size:0.75rem;">Sustentação Estável</span>'
        : councilSupport >= 45
        ? '<span style="color:#d97706;background:#fef3c7;padding:3px 8px;border-radius:6px;font-weight:700;font-size:0.75rem;">Apoio Moderado</span>'
        : '<span style="color:#dc2626;background:#fee2e2;padding:3px 8px;border-radius:6px;font-weight:700;font-size:0.75rem;">Tensão Parlamentar</span>';

      if (pending) {
        const choicesHtml = (pending.choices || []).map((c) => {
          const title = c.title || c.label || "";
          const desc = c.description || c.text || "";
          const costText = c.cost > 0 ? `Custo: R$ ${c.cost.toLocaleString("pt-BR")}` : 'Sem custo direto';
          const councilVal = c.impacts?.councilSupport ?? c.councilImpact ?? 0;
          const approvalVal = c.impacts?.approval ?? c.approvalImpact ?? 0;
          const councilDelta = (councilVal >= 0 ? '+' : '') + councilVal + '% na Câmara';
          const approvalDelta = (approvalVal >= 0 ? '+' : '') + approvalVal + '% aprovação';
          return `
            <div style="background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:0.75rem;display:flex;flex-direction:column;justify-content:space-between;gap:0.5rem;">
              <div>
                <strong style="color:var(--forest,#14342b);font-size:0.9rem;">${escapeHtml(title)}</strong>
                <p style="margin:0.25rem 0 0.5rem;font-size:0.8rem;color:#475569;line-height:1.35;">${escapeHtml(desc)}</p>
                <div style="display:flex;flex-wrap:wrap;gap:0.4rem;font-size:0.72rem;">
                  <span style="background:#f1f5f9;color:#334155;padding:2px 6px;border-radius:4px;font-weight:600;">${costText}</span>
                  <span style="background:#f0fdf4;color:#166534;padding:2px 6px;border-radius:4px;font-weight:600;">${councilDelta}</span>
                  <span style="background:#eff6ff;color:#1e40af;padding:2px 6px;border-radius:4px;font-weight:600;">${approvalDelta}</span>
                </div>
              </div>
              <button type="button" class="btn-gov-shortcut" style="margin-top:0.4rem;justify-content:center;background:#14342b;color:#fff;border:none;cursor:pointer;" onclick="window.VilarejoDashboard && window.VilarejoDashboard.resolveCabinetDilemma('${c.id}')">
                Deliberar esta decisão
              </button>
            </div>
          `;
        }).join("");

        return `
          <div style="background:#fffbeb;border:2px solid #f59e0b;border-radius:10px;padding:1rem;margin-top:1rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
              <span style="background:#f59e0b;color:#fff;font-size:0.7rem;font-weight:800;padding:2px 8px;border-radius:4px;letter-spacing:0.5px;">CRISE DO GABINETE · DELIBERAÇÃO URGENTE</span>
              <span style="font-size:0.8rem;font-weight:700;color:#92400e;">Apoio na Câmara: ${councilSupport}%</span>
            </div>
            <h4 style="margin:0 0 0.4rem;font-size:1.05rem;color:#78350f;">${escapeHtml(pending.title)}</h4>
            <p style="margin:0 0 0.85rem;font-size:0.85rem;color:#92400e;line-height:1.4;">${escapeHtml(pending.description)}</p>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0.75rem;">
              ${choicesHtml}
            </div>
          </div>
        `;
      }

      const lastDelib = last
        ? `<div style="font-size:0.78rem;color:#64748b;margin-top:0.4rem;">Última deliberação: <strong style="color:#334155;">${escapeHtml(last.title)}</strong> &mdash; <em>${escapeHtml(last.choiceTitle || last.choiceLabel || '')}</em></div>`
        : '';

      return `
        <div style="background:var(--surface,#f8fafc);border:1px solid var(--border,#e2e8f0);border-radius:8px;padding:0.9rem;margin-top:1rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
            <div>
              <span class="eyebrow" style="font-weight:700;color:var(--forest,#14342b);">GABINETE EXECUTIVO & RELAÇÃO PARLAMENTAR</span>
              <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.25rem;">
                <strong style="font-size:1.05rem;color:var(--forest,#14342b);">Apoio na Câmara: ${councilSupport}%</strong>
                ${councilBadge}
              </div>
              ${lastDelib}
            </div>
            <div>
              <button type="button" class="btn-gov-shortcut" style="cursor:pointer;" onclick="window.VilarejoDashboard && window.VilarejoDashboard.triggerRandomCabinetDilemma()">
                <span>⚡</span> Despachar cenário de crise no Gabinete
              </button>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      return '';
    }
  }

  function renderCooperativeAndMicrocreditHtml() {
    try {
      const testApi = window.VilarejoTest;
      const snap = testApi?.stateSnapshot ? testApi.stateSnapshot() : null;
      const coopActive = Boolean(snap?.cooperativeActive);
      const coopCash = Number(snap?.accounts?.cooperative ?? 0);
      const coopTfp = Number(snap?.cooperativeTfp ?? 1.0);
      const portfolio = testApi?.getBankPortfolioStats ? testApi.getBankPortfolioStats() : null;
      const micro = portfolio?.microcredit || { count: snap?.microcreditCount || 0, principal: 0, arrears: 0 };

      const coopCard = coopActive
        ? `
          <div style="background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:0.85rem;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong style="color:var(--forest,#14342b);font-size:0.9rem;">Cooperativa Agroartesanal</strong>
                <span style="color:#16a34a;background:#dcfce7;padding:2px 6px;border-radius:4px;font-weight:700;font-size:0.72rem;">Operando</span>
              </div>
              <p style="font-size:0.78rem;color:#475569;margin:0.35rem 0 0.6rem;line-height:1.35;">Processamento local de café e manufatura artesanal com agregação de valor e retenção de excedente na comunidade.</p>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;font-size:0.75rem;margin-bottom:0.6rem;">
                <div style="background:#f8fafc;padding:0.4rem;border-radius:4px;">
                  <span style="color:#64748b;display:block;font-size:0.7rem;">Caixa Cooperativo:</span>
                  <strong style="color:#0f172a;">R$ ${coopCash.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                </div>
                <div style="background:#f8fafc;padding:0.4rem;border-radius:4px;">
                  <span style="color:#64748b;display:block;font-size:0.7rem;">Produtividade TFP:</span>
                  <strong style="color:#0f172a;">${(coopTfp * 100).toFixed(0)}%</strong>
                </div>
              </div>
            </div>
            <button type="button" class="btn-gov-shortcut" style="width:100%;justify-content:center;cursor:pointer;" onclick="window.VilarejoDashboard && window.VilarejoDashboard.distributeCooperativeSurplus()">
              <span>💰</span> Distribuir Sobras Líquidas aos Associados
            </button>
          </div>
        `
        : `
          <div style="background:#fff;border:1px dashed #cbd5e1;border-radius:8px;padding:0.85rem;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong style="color:var(--forest,#14342b);font-size:0.9rem;">Cooperativa Agroartesanal</strong>
                <span style="color:#64748b;background:#f1f5f9;padding:2px 6px;border-radius:4px;font-weight:600;font-size:0.72rem;">Não constituída</span>
              </div>
              <p style="font-size:0.78rem;color:#475569;margin:0.35rem 0 0.6rem;line-height:1.35;">Sem processamento local, a produção agropecuária é exportada in natura com baixa agregação de valor.</p>
            </div>
            <button type="button" class="btn-gov-shortcut" style="width:100%;justify-content:center;background:#14342b;color:#fff;border:none;cursor:pointer;" onclick="window.VilarejoDashboard && window.VilarejoDashboard.foundCooperative()">
              <span>🏛</span> Fundar Cooperativa (Investimento: R$ 3.000)
            </button>
          </div>
        `;

      const microCard = `
        <div style="background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:0.85rem;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="color:var(--forest,#14342b);font-size:0.9rem;">Microcrédito Comunitário</strong>
              <span style="color:#0284c7;background:#e0f2fe;padding:2px 6px;border-radius:4px;font-weight:700;font-size:0.72rem;">Banco Local</span>
            </div>
            <p style="font-size:0.78rem;color:#475569;margin:0.35rem 0 0.6rem;line-height:1.35;">Crédito produtivo orientado para oficinas artesanais, hortas familiares e pequenos serviços com taxa favorecida de 0,5% a.m.</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;font-size:0.75rem;margin-bottom:0.6rem;">
              <div style="background:#f8fafc;padding:0.4rem;border-radius:4px;">
                <span style="color:#64748b;display:block;font-size:0.7rem;">Contratos Ativos:</span>
                <strong style="color:#0f172a;">${micro.count} contratos</strong>
              </div>
              <div style="background:#f8fafc;padding:0.4rem;border-radius:4px;">
                <span style="color:#64748b;display:block;font-size:0.7rem;">Volume em Carteira:</span>
                <strong style="color:#0f172a;">R$ ${(micro.principal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>
          </div>
          <button type="button" class="btn-gov-shortcut" style="width:100%;justify-content:center;cursor:pointer;" onclick="window.VilarejoDashboard && window.VilarejoDashboard.issueMicrocredit(1000)">
            <span>🌱</span> Conceder Microcrédito Produtivo (R$ 1.000)
          </button>
        </div>
      `;

      return `
        <div class="gov-coop-section" style="margin-top:1.25rem;padding-top:1rem;border-top:1px solid var(--border,#e2e8f0);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
            <span class="eyebrow" style="font-weight:700;color:var(--forest,#14342b);">DESENVOLVIMENTO ECONÔMICO & CRÉDITO COMUNITÁRIO</span>
            <small style="color:var(--muted,#64748b);">Fomento Produtivo & Inclusão</small>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:0.75rem;">
            ${coopCard}
            ${microCard}
          </div>
          ${renderPrivateEconomyHtml()}
        </div>
      `;
    } catch (e) {
      return '';
    }
  }

  function renderPrivateEconomyHtml() {
    try {
      const testApi = window.VilarejoTest;
      const stats = testApi?.getPrivateEconomyStats ? testApi.getPrivateEconomyStats() : null;
      if (!stats || !stats.firms || !stats.firms.length) return "";
      const ind = stats.indicators || {};

      const statusLabels = {
        expansao: { text: "Em Expansão", color: "#15803d", bg: "#dcfce7" },
        saudavel: { text: "Saudável", color: "#0369a1", bg: "#e0f2fe" },
        deficitaria: { text: "Deficitária", color: "#b45309", bg: "#fef3c7" },
        critica: { text: "Crise / Risco", color: "#b91c1c", bg: "#fee2e2" },
        fechada: { text: "Inativa", color: "#64748b", bg: "#f1f5f9" }
      };

      const actionBadges = {
        contratacao: '<span style="color:#15803d;font-weight:700;font-size:0.7rem;">▲ Contratando</span>',
        abertura: '<span style="color:#15803d;font-weight:700;font-size:0.7rem;">★ Nova empresa</span>',
        demissao: '<span style="color:#b91c1c;font-weight:700;font-size:0.7rem;">▼ Demitindo</span>',
        fechamento: '<span style="color:#b91c1c;font-weight:700;font-size:0.7rem;">✖ Fechamento</span>',
        estavel: '<span style="color:#64748b;font-size:0.7rem;">● Estável</span>'
      };

      const sectorCards = stats.firms.map((f) => {
        const st = statusLabels[f.financialStatus] || statusLabels.saudavel;
        const act = actionBadges[f.lastAction] || actionBadges.estavel;
        return `
          <div style="background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:0.75rem;display:flex;flex-direction:column;gap:0.4rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="color:var(--forest,#14342b);font-size:0.84rem;">${escapeHtml(f.name)}</strong>
              <span style="color:${st.color};background:${st.bg};padding:2px 6px;border-radius:4px;font-weight:700;font-size:0.68rem;">${st.text}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.74rem;color:#475569;">
              <span>Empresas: <b>${f.firmCount}</b> (${escapeHtml(f.size)})</span>
              <span>Empregados: <b>${f.employees}</b></span>
              ${act}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.35rem;font-size:0.7rem;background:#f8fafc;padding:0.35rem;border-radius:4px;">
              <div><span style="color:#64748b;display:block;">Caixa</span><b>${money(f.cash || 0)}</b></div>
              <div><span style="color:#64748b;display:block;">Dívida Banc.</span><b style="color:${(f.loans || 0) > 0 ? '#b45309' : '#334155'};">${money(f.loans || 0)}</b></div>
              <div><span style="color:#64748b;display:block;">Lucro Líq.</span><b style="color:${f.profit >= 0 ? '#15803d' : '#b91c1c'};">${money(f.profit)}</b></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.68rem;color:#64748b;">
              <span>Receita: <b>${money(f.revenue)}</b></span>
              <span>Salários: <b>${money(f.wages)}</b></span>
              <span>Invest.: <b>${money(f.investment || 0)}</b></span>
            </div>
          </div>
        `;
      }).join("");

      const diagList = (ind.diagnostics || []).map((d) => `<li style="margin-bottom:0.2rem;">${escapeHtml(d)}</li>`).join("");

      return `
        <div class="private-economy-panel" style="margin-top:1rem;padding-top:0.9rem;border-top:1px dashed #cbd5e1;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.65rem;">
            <div>
              <span class="eyebrow" style="font-weight:700;color:var(--forest,#14342b);">ATIVIDADE EMPRESARIAL E MERCADO PRIVADO</span>
              <h4 style="margin:0.15rem 0 0;font-size:0.95rem;color:#0f172a;">Termômetro da Economia Privada (${ind.totalFirms || 0} empresas · ${ind.privateJobs || 0} empregos privados)</h4>
            </div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;font-size:0.75rem;">
              <span style="background:#f1f5f9;padding:3px 8px;border-radius:4px;">Massa Salarial: <b>${money(ind.totalWageBill || 0)}</b></span>
              <span style="background:#f1f5f9;padding:3px 8px;border-radius:4px;">Investimento: <b>${money(ind.privateInvestment || 0)}</b></span>
              <span style="background:#f1f5f9;padding:3px 8px;border-radius:4px;">Produtividade: <b>${((ind.averageProductivity || 1) * 100).toFixed(0)}%</b></span>
            </div>
          </div>
          ${diagList ? `<ul style="margin:0 0 0.75rem;padding-left:1.1rem;font-size:0.78rem;color:#334155;background:#f8fafc;padding:0.5rem 0.75rem 0.5rem 1.6rem;border-radius:6px;border-left:3px solid #0284c7;">${diagList}</ul>` : ""}
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0.6rem;">
            ${sectorCards}
          </div>
        </div>
      `;
    } catch (e) {
      return "";
    }
  }

  function decisionMeasures(data) {
    const raw = data?.raw || {};
    const urban = data?.urbanInfra || {};
    const candidates = {
      population: data?.population,
      treasuryCash: raw.treasuryCash,
      farmCash: raw.farmCash,
      marketStock: raw.marketStock,
      costIndex: raw.costOfLivingIndex,
      lotCount: raw.lotCount,
      farmInventory: raw.farmInventory,
      urbanCapacity: urban.capacity,
      urbanDemand: urban.demand,
      urbanCongestion: urban.congestionRatio,
      urbanTFP: urban.tfpFactor
    };
    return Object.fromEntries(Object.entries(candidates).filter(([, value]) => finiteValue(value) !== null));
  }

  function syncDecisionRunLifecycle(data) {
    const runId = data?.runId;
    if (!decisionObserver || !runId) return;
    if (lastDecisionRunId && lastDecisionRunId !== runId) {
      decisionObserver.markRunEnded(lastDecisionRunId, "A execução anterior foi reiniciada antes da próxima comparação.");
    }

    const service = window.VilarejoIntelligenceRuntime?.service;
    const runStatuses = service?.getRunList?.() || [];
    const statusesById = new Map(runStatuses.map((run) => [String(run.id), run.status]));
    decisionObserver.getRecords().forEach((record) => {
      if (record.runId !== runId && record.status === "awaiting-close" && statusesById.get(record.runId) === "arquivada") {
        decisionObserver.markRunEnded(record.runId, "Execução arquivada antes do fechamento posterior.");
      }
    });
    lastDecisionRunId = runId;
  }

  const DECISION_MEASURE_LABELS = Object.freeze({
    population: ["População", "count"],
    treasuryCash: ["Caixa do Tesouro", "money"],
    farmCash: ["Caixa da fazenda", "money"],
    marketStock: ["Estoque comercial", "units"],
    costIndex: ["Custo de vida", "index"],
    lotCount: ["Lotes agregados", "count"],
    farmInventory: ["Estoque da fazenda", "units"],
    urbanCapacity: ["Capacidade urbana", "count"],
    urbanDemand: ["Demanda urbana", "count"],
    urbanCongestion: ["Congestionamento urbano", "index"],
    urbanTFP: ["Fator urbano", "index"]
  });

  function formatDecisionDelta(key, value) {
    const definition = DECISION_MEASURE_LABELS[key];
    if (!definition) return UNAVAILABLE;
    const [, unit] = definition;
    const amount = Math.abs(value);
    if (unit === "money") return money(amount);
    if (unit === "units") return `${number(amount, 1)} unidades`;
    if (unit === "index") return number(amount, 2);
    return number(amount);
  }

  function renderDecisionDelta(delta, title) {
    const entries = delta && typeof delta === "object" ? Object.entries(delta) : [];
    if (!entries.length) return `<div class="ux-decision-delta"><strong>${escapeHtml(title)}</strong><p>Não há métricas comuns disponíveis para esta comparação.</p></div>`;
    return `<div class="ux-decision-delta"><strong>${escapeHtml(title)}</strong><ul>${entries.map(([key, value]) => {
      const definition = DECISION_MEASURE_LABELS[key];
      if (!definition || finiteValue(value) === null) return "";
      const sign = value > 0 ? "+" : value < 0 ? "−" : "";
      return `<li><span>${escapeHtml(definition[0])}</span><b>${sign}${escapeHtml(formatDecisionDelta(key, value))}</b></li>`;
    }).join("")}</ul></div>`;
  }

  function renderDecisionSummary(data = lastSnapshot) {
    const host = $("decisionSummary");
    if (!host) return;
    const runId = data?.runId;
    const records = decisionObserver && runId ? decisionObserver.getRecords({ runId }) : [];
    const awaiting = records.filter((record) => record.status === "awaiting-close").length;
    const compared = records.filter((record) => record.status === "compared").length;
    const noComparison = records.filter((record) => record.status === "no-comparison").length;
    const latest = records.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    const warning = decisionObserver?.getStorageWarning?.();
    host.innerHTML = `<div class="ux-decision-summary-grid"><div><strong>${number(awaiting)}</strong><span>Aguardando fechamento</span></div><div><strong>${number(compared)}</strong><span>Com comparação observada</span></div><div><strong>${number(noComparison)}</strong><span>Encerradas sem comparação</span></div></div>` +
      (latest ? `<p class="ux-last-decision"><span>Última escolha:</span> <b>${escapeHtml(latest.label)}</b> · ${escapeHtml(latest.statusLabel)}</p>` : `<p class="ux-last-decision">Nenhuma decisão registrada nesta execução.</p>`) +
      (warning ? `<p class="ux-storage-warning" role="status">${escapeHtml(warning)}</p>` : "");
  }

  function renderDecisionHistory() {
    const host = $("decisionHistory");
    if (!host || !decisionObserver) return;
    const warningNode = $("decisionStorageWarning");
    const warning = decisionObserver.getStorageWarning?.();
    if (warningNode) {
      warningNode.textContent = warning || "";
      warningNode.classList.toggle("hidden", !warning);
    }
    const records = decisionObserver.getRecords().slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (!records.length) {
      host.innerHTML = "<p>Sem decisões registradas. Escolhas futuras serão associadas à execução ativa.</p>";
      return;
    }
    host.innerHTML = records.map((record) => {
      const source = record.source === "event" ? "Evento" : "Ação";
      const previousClosures = record.monthNumber === 1
        ? "1 fechamento anterior"
        : `${number(record.monthNumber)} fechamentos anteriores`;
      const executionPeriod = record.day === undefined
        ? previousClosures
        : `Dia absoluto ${record.day} · ${previousClosures}`;
      const immediate = record.afterImmediate !== undefined
        ? renderDecisionDelta(record.immediateDelta, "Variação imediatamente após a escolha")
        : '<div class="ux-decision-delta"><strong>Variação imediata</strong><p>Snapshot imediato não disponível.</p></div>';
      let followUp;
      if (record.status === "compared" && record.closure) {
        const closurePeriod = record.closure.day === undefined
          ? "fechamento posterior"
          : `fechamento posterior no dia absoluto ${record.closure.day}`;
        followUp = renderDecisionDelta(record.closure.deltaFromBefore, `Variação até o ${closurePeriod}`);
        if (Object.keys(record.closure.deltaFromImmediate || {}).length) {
          followUp += renderDecisionDelta(record.closure.deltaFromImmediate, "Variação entre o snapshot imediato e o fechamento");
        }
      } else if (record.status === "no-comparison") {
        followUp = `<div class="ux-decision-delta"><strong>Sem comparação posterior</strong><p>${escapeHtml(record.endedReason || "A execução terminou antes do fechamento seguinte.")}</p></div>`;
      } else {
        followUp = '<div class="ux-decision-delta"><strong>Aguardando fechamento</strong><p>A comparação aparecerá após o próximo fechamento mensal desta execução.</p></div>';
      }
      const context = record.context ? `<p class="ux-decision-context">${escapeHtml(record.context)}</p>` : '<p class="ux-decision-context">O motor não publicou contexto textual adicional para esta escolha.</p>';
      return `<details class="ux-decision-record"><summary><span class="ux-decision-source">${escapeHtml(source)}</span><strong>${escapeHtml(record.label)}</strong><span class="ux-decision-status status-${escapeHtml(record.status)}">${escapeHtml(record.statusLabel)}</span><small>${escapeHtml(executionPeriod)} · execução ${escapeHtml(record.runId)}</small></summary><div class="ux-decision-record-body">${context}${immediate}${followUp}<p class="ux-causality-note">Variações observadas no estado do jogo; não estabelecem causalidade.</p></div></details>`;
    }).join("");
  }

  function refreshActiveView() {
    if (activeView === "overview") {
      renderOverviewPulse(lastSnapshot || snapshot());
      renderDecisionSummary(lastSnapshot || snapshot());
    } else if (activeView === "records") {
      renderDecisionHistory();
    } else if (activeView === "society") {
      renderSocietyView();
    } else if (activeView === "services") {
      renderServicesView();
    } else if (activeView === "government") {
      renderGovernmentSubView();
    } else if (activeView === "intelligence") {
      renderIntelligenceDashboard();
    } else if (activeView === "newspaper") {
      renderNewspaperDashboard();
    }
  }

  function renderIntelligenceDashboard() {
    const host = $("intelligenceDashboard");
    if (!host) return;
    if (typeof window !== "undefined" && window.VilarejoIntelligence && typeof window.VilarejoIntelligence.renderDashboard === "function") {
      window.VilarejoIntelligence.renderDashboard(host);
    } else {
      host.innerHTML = `
        <div class="module-empty-state">
          <div class="module-empty-icon">💡</div>
          <h3>Central de Inteligência</h3>
          <p>O módulo de análise preditiva e inteligência executiva será carregado aqui conforme o fechamento dos primeiros meses de simulação.</p>
        </div>
      `;
    }
  }

  let selectedNewspaperEditionIndex = null;

  function renderNewspaperDashboard() {
    const host = $("newspaperDashboard");
    if (!host) return;

    if (typeof window === "undefined" || !window.VilarejoNewspaper) {
      host.innerHTML = `
        <div class="module-empty-state">
          <div class="module-empty-icon">📰</div>
          <h3>Jornal do Vilarejo</h3>
          <p>A redação do Vilarejo está preparando as próximas edições mensais. As crônicas e notícias da comunidade serão publicadas aqui.</p>
        </div>
      `;
      return;
    }

    if (typeof window.VilarejoNewspaper.renderDashboard === "function") {
      try {
        window.VilarejoNewspaper.renderDashboard(host);
        return;
      } catch (err) {
        console.warn("Erro ao invocar VilarejoNewspaper.renderDashboard:", err);
      }
    }

    const newspaper = window.VilarejoNewspaper;
    let editions = [];
    if (typeof newspaper.getEditions === "function") {
      try { editions = newspaper.getEditions() || []; } catch (e) { editions = []; }
    } else if (Array.isArray(newspaper.editions)) {
      editions = newspaper.editions;
    } else if (typeof newspaper.getState === "function") {
      try {
        const ns = newspaper.getState();
        editions = ns?.editions || [];
      } catch (e) { editions = []; }
    } else if (newspaper.currentEdition || newspaper.latestEdition) {
      editions = [newspaper.currentEdition || newspaper.latestEdition];
    }

    if (!Array.isArray(editions) || editions.length === 0) {
      host.innerHTML = `
        <div class="module-empty-state">
          <div class="module-empty-icon">📰</div>
          <h3>Jornal do Vilarejo</h3>
          <p>A redação do Vilarejo está preparando as próximas edições mensais. As crônicas e notícias da comunidade serão publicadas aqui.</p>
        </div>
      `;
      return;
    }

    if (selectedNewspaperEditionIndex === null || selectedNewspaperEditionIndex >= editions.length || selectedNewspaperEditionIndex < 0) {
      selectedNewspaperEditionIndex = editions.length - 1;
    }

    const currentEdition = editions[selectedNewspaperEditionIndex] || editions[editions.length - 1];
    const editionNumber = currentEdition.number || currentEdition.id || (selectedNewspaperEditionIndex + 1);
    const editionDate = currentEdition.date || currentEdition.civilDate || (currentEdition.month ? `Mês econômico ${currentEdition.month}` : "Edição regular");
    const headline = currentEdition.headline || currentEdition.title || "Crônicas do Vilarejo";
    const leadKicker = currentEdition.kicker || currentEdition.category || "MANCHETE PRINCIPAL";
    const leadText = currentEdition.lead || currentEdition.summary || currentEdition.text || "";
    const sections = Array.isArray(currentEdition.sections) ? currentEdition.sections : [];
    const highlights = currentEdition.highlights || currentEdition.metrics || null;

    const editionNavHtml = editions.length > 1
      ? `<div class="newspaper-nav-bar" role="tablist" aria-label="Edições publicadas do Jornal">
          <span class="newspaper-nav-label">Edições disponíveis:</span>
          ${editions.map((ed, idx) => {
            const isSelected = idx === selectedNewspaperEditionIndex;
            const label = ed.number ? `Edição #${ed.number}` : `Mês ${ed.month || idx + 1}`;
            return `<button type="button" class="newspaper-edition-pill ${isSelected ? "active" : ""}" data-newspaper-edition="${idx}" aria-selected="${isSelected ? "true" : "false"}">${escapeHtml(label)}</button>`;
          }).join("")}
        </div>`
      : "";

    let metricsHtml = "";
    if (highlights && typeof highlights === "object") {
      const items = Array.isArray(highlights)
        ? highlights
        : Object.entries(highlights).map(([k, v]) => ({ label: k, value: v }));
      if (items.length > 0) {
        metricsHtml = `
          <aside class="newspaper-highlights-box">
            <div class="newspaper-highlights-title">INDICADORES DO MÊS EM DESTAQUE</div>
            <div class="newspaper-highlights-grid">
              ${items.map((item) => `
                <div class="newspaper-highlight-item">
                  <small>${escapeHtml(item.label || item.name || "")}</small>
                  <strong>${escapeHtml(String(item.value ?? item.formatted ?? ""))}</strong>
                  ${item.note ? `<span>${escapeHtml(item.note)}</span>` : ""}
                </div>
              `).join("")}
            </div>
          </aside>
        `;
      }
    }

    const sectionsHtml = sections.length > 0
      ? `<div class="newspaper-sections-grid">
          ${sections.map((sec) => `
            <article class="newspaper-section-card">
              <div class="newspaper-section-badge">${escapeHtml(sec.name || sec.title || "Caderno")}</div>
              <h4>${escapeHtml(sec.headline || sec.title || "")}</h4>
              <p>${escapeHtml(sec.text || sec.body || sec.content || "")}</p>
            </article>
          `).join("")}
        </div>`
      : "";

    host.innerHTML = `
      <div class="newspaper-shell">
        ${editionNavHtml}
        <header class="newspaper-masthead">
          <div class="newspaper-masthead-top">
            <span>PERIÓDICO INDEPENDENTE DO MUNICÍPIO</span>
            <span>CIRCULAÇÃO MENSAL</span>
          </div>
          <h2 class="newspaper-brand-title">${escapeHtml(newspaper.name || "O Vilarejense")}</h2>
          <div class="newspaper-masthead-meta">
            <span>Edição nº <b>${escapeHtml(String(editionNumber))}</b></span>
            <span>·</span>
            <span>${escapeHtml(String(editionDate))}</span>
            <span>·</span>
            <span>Vilarejo em Desenvolvimento</span>
          </div>
        </header>

        <div class="newspaper-frontpage">
          <article class="newspaper-lead-story">
            <div class="newspaper-kicker">${escapeHtml(leadKicker)}</div>
            <h3 class="newspaper-headline">${escapeHtml(headline)}</h3>
            <p class="newspaper-lead-text">${escapeHtml(leadText)}</p>
            ${currentEdition.body ? `<div class="newspaper-body-copy">${escapeHtml(currentEdition.body)}</div>` : ""}
          </article>

          ${metricsHtml}
        </div>

        ${sectionsHtml}

        <footer class="newspaper-footer">
          <p>As notícias e colunas do Jornal refletem exclusivamente os fatos, fechamentos contábeis e acontecimentos registrados pela simulação.</p>
        </footer>
      </div>
    `;

    host.querySelectorAll("[data-newspaper-edition]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedNewspaperEditionIndex = Number(btn.dataset.newspaperEdition) || 0;
        renderNewspaperDashboard();
      });
    });
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
      }).join("") + '</div><p class="ux-data-provenance">Indicadores consolidados no último fechamento da comunidade (valores ausentes não são estimados).</p>';
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
      "Visão do território": { description: "Indicadores gerais de desenvolvimento do município.", metrics: overview },
      "Fazenda e produção": {
        description: "Produção agrícola, estoques de grãos e mão de obra rural do município.",
        metrics: [
          metric("Estoque da fazenda", raw.farmInventory, (value) => number(value, 1)),
          metric("Estoque alimentar local", raw.farmLocalFoodStock, (value) => `${number(value, 1)} cestas`),
          metric("Autonomia alimentar", raw.localFoodAutonomy, (value) => `${number(value, 1)}%`),
          metric("Caixa da fazenda", raw.farmCash, money),
          metric("Trabalhadores ativos no setor", raw.farmWorkers, number)
        ]
      },
      "Moradias": {
        description: "Contagens demográficas da Sociedade e capacidade habitacional instalada.",
        metrics: [
          metric("Moradores", demographic.population ?? data.population, number, "Sociedade/Core"),
          metric("Domicílios", demographic.households, number, "Sociedade"),
          metric("Capacidade habitacional", raw.housingCapacity, number, "Economia"),
          metric("Déficit habitacional", raw.housingDeficit, number, "Economia")
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
        description: "Infraestrutura urbana agregada e obras estruturantes do município.",
        metrics: [
          metric("Capacidade urbana", infra.capacity),
          metric("Demanda urbana", infra.demand),
          metric("Congestionamento", infra.congestionRatio, (value) => `${number(value, 2)}×`),
          metric("Fator de produtividade urbana", infra.tfpFactor, (value) => number(value, 2)),
          metric("Obras estruturantes concluídas", Array.isArray(raw.completedProjects) ? raw.completedProjects.length : 0, number)
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
        `${WEEKDAY_NAMES[weekdayCol]}, ${d} de ${viewedMonthName} de ${viewedCivilYear}`
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
        `<span role="listitem" class="${classes}" title="${escapeHtml(tooltip)}" aria-label="${escapeHtml(tooltip)}"` +
        (isToday ? ' aria-current="date"' : '') +
        `>${d}${isCloseDay ? '<i class="close-marker">●</i>' : ''}${hasRecordedEvent ? '<i class="event-marker" aria-hidden="true">◆</i>' : ''}</span>`
      );
    }

    const daysContainer = $("calendarDays");
    if (daysContainer) {
      daysContainer.setAttribute("role", "list");
      daysContainer.setAttribute("aria-label", `Dias de ${viewedMonthName} de ${viewedCivilYear}`);
      daysContainer.innerHTML = cells.join("");
    }
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

      // Snapshot integrado de Serviços Públicos & Governabilidade
      const servicesSnap = typeof window !== "undefined" && window.VilarejoServicesRuntime?.getSnapshot ? window.VilarejoServicesRuntime.getSnapshot() : null;
      const gov = servicesSnap?.governance || {
        demands: {
          health: { demand: 13, capacity: 15, coverage: 100, deficit: 0, pressure: 0 },
          education: { demand: 2, capacity: 4, coverage: 100, deficit: 0, pressure: 0 },
          sanitation: { demand: 5, coverage: 35, sanitaryRisk: 40, pressure: 44 },
          security: { risk: 25, safetyIndex: 75, pressure: 22 }
        },
        civicPressure: 15,
        civicStatus: "Estabilidade Cívica & Apoio Comunitário",
        activeOutbreak: null,
        activeSecurityIncident: null
      };

      const d = gov.demands;
      const civicPressure = Math.round(gov.civicPressure || 0);
      const civicStatus = gov.civicStatus || "Estabilidade Cívica & Apoio Comunitário";
      let statusColor = "#16a34a";
      if (civicPressure >= 80) statusColor = "#dc2626";
      else if (civicPressure >= 60) statusColor = "#ea580c";
      else if (civicPressure >= 30) statusColor = "#ca8a04";

      // Alertas Críticos de Governabilidade
      let alertBannerHtml = "";
      if (gov.activeOutbreak) {
        alertBannerHtml += `
          <div style="background:#fef2f2;border:1.5px solid #dc2626;border-radius:8px;padding:0.75rem 1rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;">
            <div>
              <strong style="color:#991b1b;font-size:0.95rem;">⚠️ ALERTA SANITÁRIO: ${escapeHtml(gov.activeOutbreak.name)}</strong>
              <p style="margin:0.2rem 0 0 0;font-size:0.82rem;color:#7f1d1d;">${escapeHtml(gov.activeOutbreak.description)} (Absenteísmo de ${Math.round((gov.activeOutbreak.absenteeism || 0.15) * 100)}% na mão de obra local).</p>
            </div>
            <button class="btn btn-sm btn-danger" onclick="window.VilarejoDashboard.executeGovernanceAction('action_sanitary_clean')" style="white-space:nowrap;padding:0.4rem 0.8rem;background:#dc2626;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;">
              🧹 Mutirão Sanitário Urgente (R$ 350)
            </button>
          </div>
        `;
      }
      if (gov.activeSecurityIncident) {
        alertBannerHtml += `
          <div style="background:#fff7ed;border:1.5px solid #ea580c;border-radius:8px;padding:0.75rem 1rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;">
            <div>
              <strong style="color:#9a3412;font-size:0.95rem;">🚨 ALERTA DE SEGURANÇA: ${escapeHtml(gov.activeSecurityIncident.description)}</strong>
              <p style="margin:0.2rem 0 0 0;font-size:0.82rem;color:#7c2d12;">Prejuízo nas margens do comércio noturno e quebra da tranquilidade pública.</p>
            </div>
            <button class="btn btn-sm" onclick="window.VilarejoDashboard.executeGovernanceAction('action_security_patrol')" style="white-space:nowrap;padding:0.4rem 0.8rem;background:#ea580c;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;">
              🛡️ Ronda Preventiva (R$ 350)
            </button>
          </div>
        `;
      }

      host.innerHTML = `
        <div class="services-dashboard-content">
          ${alertBannerHtml}

          <!-- Termômetro da Cidadania & Mobilização Social -->
          <article class="content-card" style="margin-bottom:1.2rem;border-left:5px solid ${statusColor};">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.75rem;">
              <div>
                <div class="eyebrow">GOVERNABILIDADE & CIDADANIA ATIVA</div>
                <h3 style="margin:0.2rem 0;">Termômetro da Cidadania Municipal</h3>
                <p style="margin:0;color:#64748b;font-size:0.85rem;">Mede a pressão social e o descontentamento popular acumulado com as demandas essenciais.</p>
              </div>
              <div style="text-align:right;">
                <span style="display:inline-block;padding:0.25rem 0.65rem;border-radius:999px;font-size:0.82rem;font-weight:700;background:${statusColor}15;color:${statusColor};border:1px solid ${statusColor}40;">
                  ${escapeHtml(civicStatus)}
                </span>
                <div style="font-size:1.15rem;font-weight:800;color:${statusColor};margin-top:0.25rem;">
                  ${civicPressure}% de Pressão Social
                </div>
              </div>
            </div>
            <div style="background:#e2e8f0;border-radius:999px;height:10px;margin-top:0.75rem;overflow:hidden;">
              <div style="background:${statusColor};height:100%;width:${Math.min(100, civicPressure)}%;transition:width 0.4s ease;"></div>
            </div>
          </article>

          <!-- 4 Cards de Demandas Públicas -->
          <div class="services-kpi-grid" style="margin-bottom:1.2rem;">
            <article class="content-card service-kpi-card">
              <div class="eyebrow">✚ SAÚDE DA FAMÍLIA (ESF)</div>
              <strong style="color:${d.health.coverage < 80 ? '#dc2626' : '#16a34a'};">${d.health.coverage}%</strong>
              <span>Demanda: <b>${d.health.demand}</b> atendimentos/mês · Capacidade: <b>${d.health.capacity}</b>. ${d.health.deficit > 0 ? `<small style="color:#dc2626;">Déficit de ${d.health.deficit} atendimentos.</small>` : '<small style="color:#16a34a;">Cobertura integral.</small>'}</span>
            </article>

            <article class="content-card service-kpi-card">
              <div class="eyebrow">▤ EDUCAÇÃO & VAGAS ESCOLARES</div>
              <strong style="color:${d.education.coverage < 80 ? '#ea580c' : '#16a34a'};">${d.education.coverage}%</strong>
              <span>Vagas: <b>${d.education.capacity}</b> abertas para <b>${d.education.demand}</b> criança(s). ${d.education.deficit > 0 ? `<small style="color:#dc2626;">Déficit de ${d.education.deficit} vaga(s).</small>` : '<small style="color:#16a34a;">Sem crianças desassistidas.</small>'}</span>
            </article>

            <article class="content-card service-kpi-card">
              <div class="eyebrow">⚙ SANEAMENTO & ÁGUA TRATADA</div>
              <strong style="color:${d.sanitation.coverage < 60 ? '#dc2626' : '#16a34a'};">${d.sanitation.coverage}%</strong>
              <span>${d.sanitation.demand} domicílios · Risco Sanitário: <b style="color:${d.sanitation.sanitaryRisk >= 48 ? '#dc2626' : '#16a34a'};">${d.sanitation.sanitaryRisk}%</b>. ${d.sanitation.sanitaryRisk >= 48 ? '<small style="color:#dc2626;">Risco iminente de contaminação.</small>' : '<small style="color:#16a34a;">Nível epidemiológico estável.</small>'}</span>
            </article>

            <article class="content-card service-kpi-card">
              <div class="eyebrow">⬡ SEGURANÇA & ORDEM PÚBLICA</div>
              <strong style="color:${d.security.safetyIndex < 50 ? '#dc2626' : '#16a34a'};">${d.security.safetyIndex}/100</strong>
              <span>Índice de segurança pública. ${d.security.safetyIndex < 45 ? '<small style="color:#dc2626;">Ocorrências de furtos noturnos.</small>' : '<small style="color:#16a34a;">Ruas seguras e comércio tranquilo.</small>'}</span>
            </article>
          </div>

          <!-- Painel de Ações Rápidas de Governabilidade -->
          <article class="content-card" style="margin-bottom:1.2rem;">
            <div class="section-heading compact-heading">
              <div>
                <div class="eyebrow">PODER EXECUTIVO EM AÇÃO</div>
                <h3 style="margin:0.2rem 0;">Ações Rápidas de Governabilidade e Resposta Cidadã</h3>
                <p style="margin:0;color:#64748b;font-size:0.85rem;">Intervenções imediatas com custeio do Tesouro para solucionar crises e atender demandas da comunidade.</p>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0.75rem;margin-top:0.75rem;">
              <div style="border:1px solid #cbd5e1;border-radius:6px;padding:0.75rem;background:#f8fafc;display:flex;flex-direction:column;justify-content:space-between;">
                <div>
                  <strong style="color:#1e293b;font-size:0.9rem;">🧹 Mutirão Sanitário e Limpeza</strong>
                  <p style="font-size:0.8rem;color:#64748b;margin:0.25rem 0 0.5rem 0;">Limpa valas de esgoto, remove focos e debela surtos epidemiológicos imediatos.</p>
                </div>
                <button onclick="window.VilarejoDashboard.executeGovernanceAction('action_sanitary_clean')" style="padding:0.4rem 0.6rem;background:#0f766e;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;font-size:0.82rem;">
                  Executar Mutirão (R$ 350)
                </button>
              </div>

              <div style="border:1px solid #cbd5e1;border-radius:6px;padding:0.75rem;background:#f8fafc;display:flex;flex-direction:column;justify-content:space-between;">
                <div>
                  <strong style="color:#1e293b;font-size:0.9rem;">💉 Campanha Comunitária de Saúde</strong>
                  <p style="font-size:0.8rem;color:#64748b;margin:0.25rem 0 0.5rem 0;">Mobiliza agentes de saúde, vacinação infantil e amplia consultas preventivas.</p>
                </div>
                <button onclick="window.VilarejoDashboard.executeGovernanceAction('action_health_campaign')" style="padding:0.4rem 0.6rem;background:#0f766e;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;font-size:0.82rem;">
                  Lançar Campanha (R$ 450)
                </button>
              </div>

              <div style="border:1px solid #cbd5e1;border-radius:6px;padding:0.75rem;background:#f8fafc;display:flex;flex-direction:column;justify-content:space-between;">
                <div>
                  <strong style="color:#1e293b;font-size:0.9rem;">📚 Turno Escolar Suplementar</strong>
                  <p style="font-size:0.8rem;color:#64748b;margin:0.25rem 0 0.5rem 0;">Aluga sala comunitária para acolher crianças fora da escola (+4 vagas imediatas).</p>
                </div>
                <button onclick="window.VilarejoDashboard.executeGovernanceAction('action_education_shift')" style="padding:0.4rem 0.6rem;background:#0f766e;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;font-size:0.82rem;">
                  Abrir Turno (R$ 400)
                </button>
              </div>

              <div style="border:1px solid #cbd5e1;border-radius:6px;padding:0.75rem;background:#f8fafc;display:flex;flex-direction:column;justify-content:space-between;">
                <div>
                  <strong style="color:#1e293b;font-size:0.9rem;">🛡️ Ronda Preventiva e Iluminação</strong>
                  <p style="font-size:0.8rem;color:#64748b;margin:0.25rem 0 0.5rem 0;">Vigilância noturna nos corredores comerciais e iluminação nos pontos escuros.</p>
                </div>
                <button onclick="window.VilarejoDashboard.executeGovernanceAction('action_security_patrol')" style="padding:0.4rem 0.6rem;background:#0f766e;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;font-size:0.82rem;">
                  Ativar Ronda (R$ 350)
                </button>
              </div>

              <div style="border:1px solid #cbd5e1;border-radius:6px;padding:0.75rem;background:#f8fafc;display:flex;flex-direction:column;justify-content:space-between;">
                <div>
                  <strong style="color:#1e293b;font-size:0.9rem;">🗣️ Audiência Pública & Conselho da Cidade</strong>
                  <p style="font-size:0.8rem;color:#64748b;margin:0.25rem 0 0.5rem 0;">Abre diálogo com líderes comunitários, dissipa tensão popular (-25%) e pactua metas.</p>
                </div>
                <button onclick="window.VilarejoDashboard.executeGovernanceAction('action_civic_hearing')" style="padding:0.4rem 0.6rem;background:#0f766e;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;font-size:0.82rem;">
                  Convocar Audiência (R$ 150)
                </button>
              </div>
            </div>
          </article>

          <!-- Rede Operacional de Instalações Públicas -->
          <article class="content-card" style="margin-bottom:1.2rem;">
            <div class="section-heading compact-heading">
              <div>
                <div class="eyebrow">EQUIPAMENTOS PÚBLICOS MUNICIPAIS</div>
                <h3 style="margin:0.2rem 0;">Rede Física de Instalações e Servidores</h3>
                <p style="margin:0;color:#64748b;font-size:0.85rem;">Construa unidades públicas permanentes e contrate servidores para zerar os déficits essenciais de saúde, educação e segurança.</p>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:0.85rem;margin-top:0.75rem;">
              <div style="border:1px solid #cbd5e1;border-radius:6px;padding:0.85rem;background:#f8fafc;display:flex;flex-direction:column;justify-content:space-between;">
                <div>
                  <strong style="color:#0f766e;font-size:0.95rem;">✚ Unidade Básica de Saúde (UBS)</strong>
                  <p style="font-size:0.8rem;color:#475569;margin:0.35rem 0;">Atenção primária contínua e ESF. Capacidade: 18 atendimentos por servidor. Equipe inicial: 2 a 8 trabalhadores.</p>
                  <small style="color:#64748b;">Investimento: R$ 9.000 · Custeio: R$ 180 fixo + R$ 1.450/servidor</small>
                </div>
                <button onclick="window.VilarejoDashboard.buildFacility('health_post')" style="margin-top:0.6rem;padding:0.45rem 0.75rem;background:#0f766e;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;font-size:0.82rem;">
                  Erguer UBS (R$ 9.000)
                </button>
              </div>

              <div style="border:1px solid #cbd5e1;border-radius:6px;padding:0.85rem;background:#f8fafc;display:flex;flex-direction:column;justify-content:space-between;">
                <div>
                  <strong style="color:#0284c7;font-size:0.95rem;">▤ Escola Básica Municipal</strong>
                  <p style="font-size:0.8rem;color:#475569;margin:0.35rem 0;">Acesso escolar universal e alfabetização. Capacidade: 14 vagas por educador. Equipe inicial: 3 a 16 profissionais.</p>
                  <small style="color:#64748b;">Investimento: R$ 12.000 · Custeio: R$ 220 fixo + R$ 1.650/professor</small>
                </div>
                <button onclick="window.VilarejoDashboard.buildFacility('school')" style="margin-top:0.6rem;padding:0.45rem 0.75rem;background:#0284c7;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;font-size:0.82rem;">
                  Erguer Escola Básica (R$ 12.000)
                </button>
              </div>

              <div style="border:1px solid #cbd5e1;border-radius:6px;padding:0.85rem;background:#f8fafc;display:flex;flex-direction:column;justify-content:space-between;">
                <div>
                  <strong style="color:#475569;font-size:0.95rem;">⬡ Posto de Polícia Comunitária</strong>
                  <p style="font-size:0.8rem;color:#475569;margin:0.35rem 0;">Policiamento preventivo, patrulhas de bairro e ordem. Capacidade: 35 munícipes por operador. Equipe: 3 a 10 policiais.</p>
                  <small style="color:#64748b;">Investimento: R$ 10.000 · Custeio: R$ 260 fixo + R$ 1.750/policial</small>
                </div>
                <button onclick="window.VilarejoDashboard.buildFacility('police_station')" style="margin-top:0.6rem;padding:0.45rem 0.75rem;background:#334155;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;font-size:0.82rem;">
                  Erguer Posto Policial (R$ 10.000)
                </button>
              </div>
            </div>
          </article>

          <!-- Infraestrutura Urbana e Mercado Local (Consistência Original) -->
          <div class="services-details-grid">
            <article class="content-card">
              <div class="section-heading compact-heading">
                <div>
                  <div class="eyebrow">MERCADO LOCAL</div>
                  <h3>Abastecimento observado</h3>
                  <p>Estoque e preços do mercado da simulação econômica.</p>
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
                  <div class="eyebrow">INFRAESTRUTURA URBANA</div>
                  <h3>Valores agregados do município</h3>
                  <p>Equipamentos públicos e capacidade de suporte aos domicílios.</p>
                </div>
              </div>
              <div class="services-stat-list">
                ${row("Capacidade urbana agregada", infra?.capacity)}
                ${row("Demanda urbana agregada", infra?.demand)}
                ${row("Lotes residenciais", s.lotCount, number)}
                ${row("Caixa disponível no Tesouro", s.treasuryCash, money)}
              </div>
              <div class="ux-public-services-unavailable" style="margin-top:0.75rem;">
                <strong>Indicadores de serviços públicos: indisponíveis</strong>
                <p>Séries temporais e projeções contábeis de longo prazo de saúde, educação e segurança não têm séries próprias publicadas pela referência atual; nenhum índice é estimado.</p>
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

    if (worldRendererHandle && typeof worldRendererHandle.refresh === "function") {
      worldRendererHandle.refresh();
    }

    const history = data.history || [];
    const signature = (data.sessionId || "session-local") + ":" + history.length + ":" +
      (history.length ? JSON.stringify(history[history.length - 1]) : "inicio");
    if (signature !== lastChartSignature) {
      refreshCharts(data);
      lastChartSignature = signature;
    }

    refreshActiveView();
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

  function closeEventModal() {
    const modal = $("event");
    if (!modal) return;
    modal.classList.add("hidden");
    if (typeof window !== "undefined" && window.VilarejoTest) {
      const snap = window.VilarejoTest.stateSnapshot ? window.VilarejoTest.stateSnapshot() : null;
      if (snap && snap.pendingCabinetDilemma) {
        // desobstrui pendência no Core se for dilema
      }
    }
    syncEventModalVisibility();
  }

  function trapEventModalFocus(event) {
    if (!eventModalWasOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeEventModal();
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

  function initNavigation() {
    const topHomeBtn = $("btnTopHome");
    if (topHomeBtn) {
      topHomeBtn.addEventListener("click", () => setView("overview"));
    }
    const breadHome = $("breadHome");
    if (breadHome) {
      breadHome.addEventListener("click", () => setView("overview"));
    }
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        setView(button.dataset.view);
        document.body.classList.remove("menu-open");
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
      todayBtn.addEventListener("click", () => returnCalendarToToday());
    }
    const mobileToggle = $("mobileMenu");
    if (mobileToggle) mobileToggle.addEventListener("click", () => document.body.classList.toggle("menu-open"));
    const toggleAudioBtn = $("toggleAudio");
    const ambientAudio = $("ambientAudio");
    if (toggleAudioBtn && ambientAudio) {
      ambientAudio.volume = 0.35;
      let isAudioPlaying = false;
      toggleAudioBtn.addEventListener("click", () => {
        if (isAudioPlaying) {
          ambientAudio.pause();
          isAudioPlaying = false;
          toggleAudioBtn.classList.remove("active");
          toggleAudioBtn.textContent = "♫ Áudio";
          toggleAudioBtn.title = "Ligar trilha sonora ambiente";
        } else {
          ambientAudio.play().then(() => {
            isAudioPlaying = true;
            toggleAudioBtn.classList.add("active");
            toggleAudioBtn.textContent = "♫ Tocando";
            toggleAudioBtn.title = "Pausar trilha sonora ambiente";
          }).catch((err) => {
            console.warn("Reprodução bloqueada pelo navegador:", err);
          });
        }
      });
    }
    ["start", "pause"].forEach((id) => {
      const control = $(id);
      if (control) control.addEventListener("click", refresh);
    });
  }

  function initMapDetails() {
    initWorldRenderer();
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

  function initWorldRenderer() {
    if (typeof document === "undefined") return;
    const container = $("worldCanvas");
    if (!container) return;

    const renderer = (typeof window !== "undefined" && window.VilarejoWorldRenderer) ||
                     (typeof globalThis !== "undefined" && globalThis.VilarejoWorldRenderer);
    const phaser = (typeof window !== "undefined" && window.Phaser) ||
                   (typeof globalThis !== "undefined" && globalThis.Phaser);

    if (!renderer || typeof renderer.mount !== "function" || !phaser) {
      return;
    }

    if (worldRendererHandle || container.__vilarejoWorld) {
      return;
    }

    try {
      worldRendererHandle = renderer.mount({
        container,
        Phaser: phaser,
        getSnapshot: () => snapshot() || {}
      });
      container.setAttribute("data-world-status", "mounted");
    } catch (err) {
      console.warn("Falha ao inicializar VilarejoWorldRenderer:", err);
    }
  }

  function destroyWorldRenderer() {
    if (worldRendererHandle) {
      try {
        if (typeof worldRendererHandle.destroy === "function") {
          worldRendererHandle.destroy();
        }
      } catch (e) {
        console.warn("Erro ao destruir VilarejoWorldRenderer:", e);
      }
      worldRendererHandle = null;
    }
    if (typeof document !== "undefined") {
      const container = $("worldCanvas");
      if (container) {
        if (container.__vilarejoWorld) {
          try {
            if (typeof container.__vilarejoWorld.destroy === "function") {
              container.__vilarejoWorld.destroy();
            }
          } catch (e) {}
          delete container.__vilarejoWorld;
        }
        container.setAttribute("data-world-status", "awaiting-engine");
      }
    }
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
      const resetCalendarForNewRun = (event) => {
        resetCalendarNavigation(finiteValue(event?.payload?.day));
        refreshAlerts();
        refresh();
      };
      window.VilarejoRuntime.events.on("game:initialized", resetCalendarForNewRun);
      window.VilarejoRuntime.events.on("game:reset", resetCalendarForNewRun);
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
      resetCalendarNavigation,
      getCalendarViewState,
      getSnapshot: snapshot,
      selectMapSector,
      getDecisionRecords: () => decisionObserver ? decisionObserver.getRecords() : [],
      recordMonthClosure,
      refreshAlerts,
      renderIntelligenceDashboard,
      renderNewspaperDashboard,
      initWorldRenderer,
      destroyWorldRenderer,
      getWorldRenderer: () => worldRendererHandle,
      closeEventModal,
      resolveCabinetDilemma: (choiceId) => {
        if (typeof window !== "undefined" && window.VilarejoTest && window.VilarejoTest.resolveCabinetDilemma) {
          const snap = window.VilarejoTest.stateSnapshot();
          const dilemma = snap?.pendingCabinetDilemma;
          if (dilemma) {
            window.VilarejoTest.resolveCabinetDilemma(dilemma.id, choiceId);
            refresh();
          }
        }
      },
      triggerRandomCabinetDilemma: () => {
        if (typeof window !== "undefined" && window.VilarejoTest && window.VilarejoTest.getCabinetDilemmas) {
          const list = window.VilarejoTest.getCabinetDilemmas();
          if (list && list.length) {
            const snap = window.VilarejoTest.stateSnapshot();
            const available = list.filter((d) => !snap?.resolvedDilemmas?.some((r) => r.id === d.id));
            const chosen = available.length ? available[0] : list[0];
            window.VilarejoTest.triggerCabinetDilemma(chosen.id);
            refresh();
          }
        }
      },
      foundCooperative: () => {
        if (typeof window !== "undefined" && window.VilarejoTest && window.VilarejoTest.foundCooperative) {
          window.VilarejoTest.foundCooperative(3000, "treasury");
          refresh();
        }
      },
      distributeCooperativeSurplus: () => {
        if (typeof window !== "undefined" && window.VilarejoTest && window.VilarejoTest.distributeCooperativeSurplus) {
          window.VilarejoTest.distributeCooperativeSurplus();
          refresh();
        }
      },
      issueMicrocredit: (amount) => {
        if (typeof window !== "undefined" && window.VilarejoTest && window.VilarejoTest.issueMicrocredit) {
          window.VilarejoTest.issueMicrocredit("house:1", amount || 1000, "capital de giro para produção autônoma");
          refresh();
        }
      },
      voteBill: (billId) => {
        if (typeof window !== "undefined" && window.VilarejoInstitutionsRuntime && window.VilarejoInstitutionsRuntime.voteBill) {
          const res = window.VilarejoInstitutionsRuntime.voteBill(billId);
          if (res && res.approved && window.VilarejoTest && window.VilarejoTest.enactLegislation) {
            window.VilarejoTest.enactLegislation(res);
          }
          renderGovernmentSubView();
          refresh();
        }
      },
      selectPlatform: (platformId) => {
        if (typeof window !== "undefined" && window.VilarejoInstitutionsRuntime && window.VilarejoInstitutionsRuntime.selectCampaignPlatform) {
          window.VilarejoInstitutionsRuntime.selectCampaignPlatform(platformId);
          renderGovernmentSubView();
        }
      },
      holdElection: () => {
        if (typeof window !== "undefined" && window.VilarejoInstitutionsRuntime && window.VilarejoInstitutionsRuntime.holdElection) {
          window.VilarejoInstitutionsRuntime.holdElection();
          renderGovernmentSubView();
        }
      },
      executeGovernanceAction: (actionId) => {
        if (typeof window !== "undefined") {
          const action = window.VilarejoServices?.GOVERNANCE_ACTIONS?.[actionId];
          if (action && window.VilarejoTest && window.VilarejoTest.executeGovernanceAction) {
            window.VilarejoTest.executeGovernanceAction(action);
          } else if (window.VilarejoServicesRuntime && window.VilarejoServicesRuntime.executeGovernanceAction) {
            window.VilarejoServicesRuntime.executeGovernanceAction(actionId);
          }
          refresh();
        }
      },
      buildFacility: (type, options) => {
        if (typeof window !== "undefined") {
          if (window.VilarejoTest && window.VilarejoTest.buildPublicFacility) {
            window.VilarejoTest.buildPublicFacility(type, options);
          } else if (window.VilarejoServicesRuntime && window.VilarejoServicesRuntime.buildFacility) {
            window.VilarejoServicesRuntime.buildFacility(type, options);
          }
          refresh();
        }
      },
      hireStaff: (facilityId, count) => {
        if (typeof window !== "undefined") {
          if (window.VilarejoTest && window.VilarejoTest.hirePublicStaff) {
            window.VilarejoTest.hirePublicStaff(facilityId, count);
          } else if (window.VilarejoServicesRuntime && window.VilarejoServicesRuntime.hireStaff) {
            window.VilarejoServicesRuntime.hireStaff(facilityId, count);
          }
          refresh();
        }
      },
      hireCharacter: (charId) => {
        if (typeof window !== "undefined" && window.VilarejoTest && window.VilarejoTest.hirePoliticalCharacter) {
          window.VilarejoTest.hirePoliticalCharacter(charId);
          renderGovernmentSubView();
          refresh();
        }
      },
      dismissCharacter: (groupId) => {
        if (typeof window !== "undefined" && window.VilarejoTest && window.VilarejoTest.dismissPoliticalCharacter) {
          window.VilarejoTest.dismissPoliticalCharacter(groupId);
          renderGovernmentSubView();
          refresh();
        }
      }
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
      resetCalendarNavigation,
      getCalendarViewState,
      refresh,
      setView,
      setGovTab,
      getSnapshot: snapshot,
      selectMapSector,
      getDecisionRecords: () => decisionObserver ? decisionObserver.getRecords() : [],
      recordMonthClosure,
      refreshAlerts,
      renderIntelligenceDashboard,
      renderNewspaperDashboard,
      initWorldRenderer,
      destroyWorldRenderer,
      getWorldRenderer: () => worldRendererHandle,
      closeEventModal,
      resolveCabinetDilemma: (choiceId) => {
        if (typeof window !== "undefined" && window.VilarejoTest && window.VilarejoTest.resolveCabinetDilemma) {
          const snap = window.VilarejoTest.stateSnapshot();
          const dilemma = snap?.pendingCabinetDilemma;
          if (dilemma) {
            window.VilarejoTest.resolveCabinetDilemma(dilemma.id, choiceId);
            refresh();
          }
        }
      },
      triggerRandomCabinetDilemma: () => {
        if (typeof window !== "undefined" && window.VilarejoTest && window.VilarejoTest.getCabinetDilemmas) {
          const list = window.VilarejoTest.getCabinetDilemmas();
          if (list && list.length) {
            const snap = window.VilarejoTest.stateSnapshot();
            const available = list.filter((d) => !snap?.resolvedDilemmas?.some((r) => r.id === d.id));
            const chosen = available.length ? available[0] : list[0];
            window.VilarejoTest.triggerCabinetDilemma(chosen.id);
            refresh();
          }
        }
      },
      foundCooperative: () => {
        if (typeof window !== "undefined" && window.VilarejoTest && window.VilarejoTest.foundCooperative) {
          window.VilarejoTest.foundCooperative(3000, "treasury");
          refresh();
        }
      },
      distributeCooperativeSurplus: () => {
        if (typeof window !== "undefined" && window.VilarejoTest && window.VilarejoTest.distributeCooperativeSurplus) {
          window.VilarejoTest.distributeCooperativeSurplus();
          refresh();
        }
      },
      issueMicrocredit: (amount) => {
        if (typeof window !== "undefined" && window.VilarejoTest && window.VilarejoTest.issueMicrocredit) {
          window.VilarejoTest.issueMicrocredit("house:1", amount || 1000, "capital de giro para produção autônoma");
          refresh();
        }
      },
      voteBill: (billId) => {
        if (typeof window !== "undefined" && window.VilarejoInstitutionsRuntime && window.VilarejoInstitutionsRuntime.voteBill) {
          const res = window.VilarejoInstitutionsRuntime.voteBill(billId);
          if (res && res.approved && window.VilarejoTest && window.VilarejoTest.enactLegislation) {
            window.VilarejoTest.enactLegislation(res);
          }
          renderGovernmentSubView();
          refresh();
        }
      },
      selectPlatform: (platformId) => {
        if (typeof window !== "undefined" && window.VilarejoInstitutionsRuntime && window.VilarejoInstitutionsRuntime.selectCampaignPlatform) {
          window.VilarejoInstitutionsRuntime.selectCampaignPlatform(platformId);
          renderGovernmentSubView();
        }
      },
      holdElection: () => {
        if (typeof window !== "undefined" && window.VilarejoInstitutionsRuntime && window.VilarejoInstitutionsRuntime.holdElection) {
          window.VilarejoInstitutionsRuntime.holdElection();
          renderGovernmentSubView();
        }
      },
      executeGovernanceAction: (actionId) => {
        if (typeof window !== "undefined") {
          const action = window.VilarejoServices?.GOVERNANCE_ACTIONS?.[actionId];
          if (action && window.VilarejoTest && window.VilarejoTest.executeGovernanceAction) {
            window.VilarejoTest.executeGovernanceAction(action);
          } else if (window.VilarejoServicesRuntime && window.VilarejoServicesRuntime.executeGovernanceAction) {
            window.VilarejoServicesRuntime.executeGovernanceAction(actionId);
          }
          refresh();
        }
      },
      buildFacility: (type, options) => {
        if (typeof window !== "undefined") {
          if (window.VilarejoTest && window.VilarejoTest.buildPublicFacility) {
            window.VilarejoTest.buildPublicFacility(type, options);
          } else if (window.VilarejoServicesRuntime && window.VilarejoServicesRuntime.buildFacility) {
            window.VilarejoServicesRuntime.buildFacility(type, options);
          }
          refresh();
        }
      },
      hireStaff: (facilityId, count) => {
        if (typeof window !== "undefined") {
          if (window.VilarejoTest && window.VilarejoTest.hirePublicStaff) {
            window.VilarejoTest.hirePublicStaff(facilityId, count);
          } else if (window.VilarejoServicesRuntime && window.VilarejoServicesRuntime.hireStaff) {
            window.VilarejoServicesRuntime.hireStaff(facilityId, count);
          }
          refresh();
        }
      },
      hireCharacter: (charId) => {
        if (typeof window !== "undefined" && window.VilarejoTest && window.VilarejoTest.hirePoliticalCharacter) {
          window.VilarejoTest.hirePoliticalCharacter(charId);
          renderGovernmentSubView();
          refresh();
        }
      },
      dismissCharacter: (groupId) => {
        if (typeof window !== "undefined" && window.VilarejoTest && window.VilarejoTest.dismissPoliticalCharacter) {
          window.VilarejoTest.dismissPoliticalCharacter(groupId);
          renderGovernmentSubView();
          refresh();
        }
      }
    };
  }
})();
