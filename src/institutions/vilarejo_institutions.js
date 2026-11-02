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
      lastPoliticsSnapshot: null
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
      recentEvents: clone(state.events.slice(-12))
    };
  }

  function resetState(state, options = {}) {
    const next = createState(options);
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, next);
    return state;
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
            <div class="section-heading compact-heading"><div><span class="eyebrow">PODER LEGISLATIVO</span><h2>${escapeHtml(data.legislature.name)}</h2><p>As cadeiras representam força institucional organizada, não uma contagem de cidadãos exclusivos.</p></div></div>
            <div class="institutions-groups">${groupCards}</div>
            <div class="institution-data-note">Distribuição inicial por influência política, usando o método dos maiores restos. A renovação ocorre ao fim do mandato. Não é uma eleição popular: o modelo representa bancadas de interesses e será a base das votações legislativas futuras.</div>
          </article>
          <aside class="content-card institutions-side-card">
            <div class="eyebrow">PODER EXECUTIVO</div><h3>${escapeHtml(data.executive.name)}</h3><p>Chefia controlada pelo jogador. O governo administra as competências do Estado sui generis.</p>
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
    registerWithRuntime
  };
});
