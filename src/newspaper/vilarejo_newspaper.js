(function attachVilarejoNewspaper(root, factory) {
  "use strict";

  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root && typeof root === "object") {
    root.VilarejoNewspaper = api;
    if (root.VilarejoRuntime && !root.VilarejoNewspaperRuntime) {
      try {
        root.VilarejoNewspaperRuntime = api.registerWithRuntime(root.VilarejoRuntime, { window: root });
      } catch (error) {
        if (root.console && typeof root.console.error === "function") {
          root.console.error("Falha ao registrar o módulo Jornal do Vilarejo:", error);
        }
      }
    }
  }
})(typeof window !== "undefined" ? window : globalThis, function createVilarejoNewspaper() {
  "use strict";

  const VERSION = "1.0.0";
  const MODULE_ID = "jornal";
  const MAX_EDITIONS_PER_SESSION = 120;

  function clone(value) {
    if (value === undefined) return undefined;
    if (value === null || typeof value !== "object") return value;
    return JSON.parse(JSON.stringify(value));
  }

  function finiteOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function isPlainObject(value) {
    if (value === null || typeof value !== "object") return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function money(value) {
    const number = finiteOrNull(value);
    if (number === null) return null;
    return "R$ " + Math.round(number).toLocaleString("pt-BR");
  }

  function percent(value, digits = 1) {
    const number = finiteOrNull(value);
    if (number === null) return null;
    return number.toFixed(digits).replace(".", ",") + "%";
  }

  function formatDelta(current, previous, unitLabel) {
    if (current === null || previous === null) return null;
    const delta = current - previous;
    if (!Number.isFinite(delta)) return null;
    const sign = delta > 0 ? "+" : "";
    if (unitLabel === "money") return sign + money(delta);
    if (unitLabel === "pp") return sign + delta.toFixed(1).replace(".", ",") + " p.p.";
    if (unitLabel === "people") return sign + Math.round(delta).toLocaleString("pt-BR");
    return sign + String(Math.round(delta * 100) / 100);
  }

  function editionId(sessionId, monthNumber) {
    return `${sessionId}:m${monthNumber}`;
  }

  function collectFacts(payload, runtime, windowRef) {
    const facts = {
      observed: [],
      indicators: {},
      sources: [],
      gaps: []
    };

    const monthNumber = finiteOrNull(payload.monthNumber);
    const day = finiteOrNull(payload.day);
    const year = finiteOrNull(payload.year);

    if (monthNumber === null) {
      facts.gaps.push("Número do mês econômico ausente no evento de fechamento.");
      return facts;
    }

    facts.indicators.monthNumber = Math.floor(monthNumber);
    if (day !== null) facts.indicators.day = Math.floor(day);
    if (year !== null) facts.indicators.year = Math.floor(year);

    // O Mundo Vivo é carregado antes do Jornal. Assim, o snapshot do mesmo
    // fechamento já está disponível sem fabricar fatos nem alterar a Economia.
    try {
      const world = runtime?.modules?.get?.("mundo_vivo")?.snapshot;
      if (world) {
        const month = facts.indicators.monthNumber;
        const worldEvents = (Array.isArray(world.events) ? world.events : [])
          .filter((item) => Number(item.month) === month);
        const achievedMilestones = (Array.isArray(world.milestones) ? world.milestones : [])
          .filter((item) => item.achieved && Number(item.achievedAtMonth) === month);

        for (const item of worldEvents) {
          facts.observed.push({
            section: "Sociedade",
            kind: "fact",
            text: `O registro Mundo Vivo identificou o sinal "${String(item.title)}": ${String(item.narrative)}`
          });
        }
        for (const item of achievedMilestones) {
          facts.observed.push({
            section: "Sociedade",
            kind: "fact",
            text: `Marco de desenvolvimento alcançado: ${String(item.title)}. ${String(item.description)}`
          });
        }
        if (worldEvents.length || achievedMilestones.length) {
          facts.sources.push("runtime.modules.get('mundo_vivo').snapshot");
        }
      }
    } catch (_) {}

    // O payload mensal traz apenas registros produzidos pelo Eventos V3.
    // A redação identifica a origem para não confundir sinal com estatística.
    const engineEvents = Array.isArray(payload.eventEngine?.monthEvents) ? payload.eventEngine.monthEvents : [];
    for (const line of engineEvents) {
      if (typeof line !== "string" || !line.trim()) continue;
      facts.observed.push({
        section: "Acontecimentos",
        kind: "fact",
        text: `Eventos V3 registrou: ${line.replace(/^Mês \d+[: ·]\s*/, "")}`
      });
    }
    if (engineEvents.length) facts.sources.push("payload.eventEngine.monthEvents (Eventos V3)");

    const population = payload.population;
    if (isPlainObject(population) && finiteOrNull(population.total) !== null) {
      facts.indicators.population = Math.floor(population.total);
      facts.observed.push({
        section: "Sociedade",
        kind: "fact",
        text: `A população registrada no fechamento do mês ${facts.indicators.monthNumber} é de ${facts.indicators.population.toLocaleString("pt-BR")} habitantes.`
      });
      facts.sources.push("payload.population (economy:month-closed)");
    } else {
      facts.gaps.push("Totais populacionais não vieram no payload do fechamento.");
    }

    const national = payload.nationalAccounts;
    if (isPlainObject(national) && finiteOrNull(national.gdp) !== null) {
      facts.indicators.gdp = national.gdp;
      facts.observed.push({
        section: "Economia",
        kind: "fact",
        text: `O PIB pela ótica da produção no mês ${facts.indicators.monthNumber} foi de ${money(national.gdp)}.`
      });
      if (national.reconciled === true) {
        facts.observed.push({
          section: "Economia",
          kind: "fact",
          text: "As contas nacionais do período foram reconciliadas entre as óticas disponíveis."
        });
      } else if (national.reconciled === false) {
        facts.observed.push({
          section: "Economia",
          kind: "fact",
          text: "As contas nacionais do período não indicaram reconciliação completa entre as óticas."
        });
      }
      facts.sources.push("payload.nationalAccounts (economy:month-closed)");
    } else {
      facts.gaps.push("Contas nacionais ausentes ou sem PIB no payload.");
    }

    const fiscal = finiteOrNull(payload.fiscalResult);
    if (fiscal !== null) {
      facts.indicators.fiscalResult = fiscal;
      const label = fiscal > 0 ? "superávit nominal" : fiscal < 0 ? "déficit nominal" : "resultado nominal equilibrado";
      facts.observed.push({
        section: "Fisco",
        kind: "fact",
        text: `O resultado fiscal nominal do mês ${facts.indicators.monthNumber} foi de ${money(fiscal)} (${label}).`
      });
      facts.sources.push("payload.fiscalResult (economy:month-closed)");
    } else {
      facts.gaps.push("Resultado fiscal nominal não informado no payload.");
    }

    if (payload.gameOver) {
      facts.indicators.gameOver = String(payload.gameOver);
      facts.observed.push({
        section: "Governo",
        kind: "fact",
        text: `A simulação registrou encerramento da partida com o motivo: ${String(payload.gameOver)}.`
      });
      facts.sources.push("payload.gameOver (economy:month-closed)");
    }

    const completedProjects = Array.isArray(payload.completedProjects) ? payload.completedProjects : [];
    const recentProjects = completedProjects.filter(p => Number(p.month) === facts.indicators.monthNumber);
    for (const proj of recentProjects) {
      facts.observed.push({
        section: "Desenvolvimento",
        kind: "fact",
        text: `Obras públicas: Concluída a execução de "${proj.name}", com investimento de ${money(proj.cost)} pelo município.`
      });
    }
    if (recentProjects.length) facts.sources.push("payload.completedProjects");

    const housingDeficit = finiteOrNull(payload.housingDeficit);
    const housingCapacity = finiteOrNull(payload.housingCapacity);
    if (housingDeficit !== null) {
      facts.indicators.housingDeficit = housingDeficit;
      if (housingDeficit > 0) {
        facts.observed.push({
          section: "Sociedade",
          kind: "fact",
          text: `Habitação: Déficit habitacional registrado de ${Math.floor(housingDeficit)} pessoas sem moradia formal (capacidade instalada: ${Math.floor(housingCapacity || 12)} vagas).`
        });
      }
      facts.sources.push("payload.housingDeficit (economy:month-closed)");
    }

    const foodAutonomy = finiteOrNull(payload.localFoodAutonomy);
    if (foodAutonomy !== null && foodAutonomy > 0) {
      facts.indicators.localFoodAutonomy = foodAutonomy;
      facts.observed.push({
        section: "Economia",
        kind: "fact",
        text: `Abastecimento: A lavoura local supriu ${foodAutonomy.toFixed(1)}% do consumo alimentar no comércio municipal com alimentos locais.`
      });
      facts.sources.push("payload.localFoodAutonomy (economy:month-closed)");
    }

    if (payload.lastResolvedDilemma) {
      const d = payload.lastResolvedDilemma;
      facts.indicators.lastResolvedDilemma = d.id;
      facts.observed.push({
        section: "Governo",
        kind: "fact",
        text: `Deliberação Executiva: O Gabinete deliberou sobre "${d.title}", adotando a medida: "${d.choiceTitle || d.choiceLabel || d.choiceId}".`
      });
      facts.sources.push("payload.lastResolvedDilemma (economy:month-closed)");
    }

    if (payload.cooperativeActive) {
      facts.indicators.cooperativeActive = true;
      facts.observed.push({
        section: "Desenvolvimento",
        kind: "fact",
        text: "Cooperativismo: A Cooperativa Agroartesanal operou no período agregando valor à safra e distribuindo sobras aos produtores associados."
      });
      facts.sources.push("payload.cooperativeActive (economy:month-closed)");
    }

    if (payload.millActive) {
      facts.indicators.millActive = true;
      facts.observed.push({
        section: "Desenvolvimento",
        kind: "fact",
        text: "Indústria Local: O Moinho Municipal manteve o processamento de grãos e torrefação, abastecendo o comércio com farinhas e café com menor custo."
      });
      facts.sources.push("payload.millActive (economy:month-closed)");
    }

    if (payload.brickyardActive) {
      facts.indicators.brickyardActive = true;
      facts.observed.push({
        section: "Desenvolvimento",
        kind: "fact",
        text: "Manufatura de Base: A Olaria e Serraria Comunitária produziu tijolos e madeiras tratadas para obras públicas e reformas residenciais."
      });
      facts.sources.push("payload.brickyardActive (economy:month-closed)");
    }

    const activeConstructions = Array.isArray(payload.activeConstructions) ? payload.activeConstructions : [];
    for (const c of activeConstructions.filter(w => w.status === "in_progress")) {
      facts.observed.push({
        section: "Infraestrutura",
        kind: "fact",
        text: `Canteiro de Obras: "${c.name}" atingiu ${c.progressPercent}% de execução físico-financeira com operários locais em atividade.`
      });
    }
    if (activeConstructions.length) facts.sources.push("payload.activeConstructions (economy:month-closed)");

    const microCount = finiteOrNull(payload.microcreditCount);
    if (microCount !== null && microCount > 0) {
      facts.indicators.microcreditCount = microCount;
      const stats = payload.microcreditStats || {};
      const activePrincipal = finiteOrNull(stats.principal) ?? 0;
      facts.observed.push({
        section: "Economia",
        kind: "fact",
        text: `Microcrédito: O Banco Comunitário registrou ${Math.floor(microCount)} operações ativas de microcrédito produtivo orientado (${money(activePrincipal)} em carteira).`
      });
      facts.sources.push("payload.microcreditStats (economy:month-closed)");
    }

    const council = finiteOrNull(payload.councilSupport);
    if (council !== null) {
      facts.indicators.councilSupport = council;
      facts.observed.push({
        section: "Governo",
        kind: "fact",
        text: `Câmara Municipal: O índice de sustentação e apoio parlamentar ao Executivo fixou-se em ${percent(council, 0)}.`
      });
      facts.sources.push("payload.councilSupport (economy:month-closed)");
    }

    const activeChars = payload.activeCharacters || {};
    const activeCharCount = Object.keys(activeChars).length;
    if (activeCharCount > 0) {
      facts.indicators.activePoliticalCharactersCount = activeCharCount;
      facts.observed.push({
        section: "Governo",
        kind: "fact",
        text: `Articulação Política: O Gabinete conta com ${activeCharCount} lideranças setoriais nomeadas para representação de classes produtivas e civis.`
      });
      facts.sources.push("payload.activeCharacters (economy:month-closed)");
    }

    const polConflicts = Array.isArray(payload.politicalConflicts) ? payload.politicalConflicts : [];
    if (polConflicts.length > 0) {
      facts.indicators.politicalConflictsCount = polConflicts.length;
      facts.observed.push({
        section: "Governo",
        kind: "fact",
        text: `Tensões Políticas: O Gabinete enfrenta atrito entre alas rivais (${polConflicts.map(c => (c.names ? c.names.join(" e ") : "lideranças")).join("; ")}), impactando o clima político local.`
      });
      facts.sources.push("payload.politicalConflicts (economy:month-closed)");
    }

    try {
      const testApi = windowRef && windowRef.VilarejoTest;
      if (testApi && typeof testApi.stateSnapshot === "function") {
        const state = testApi.stateSnapshot();
        if (state) {
          const labor = typeof testApi.getLaborStats === "function" ? testApi.getLaborStats() : state.laborStats;
          if (labor && finiteOrNull(labor.unemploymentRate) !== null) {
            facts.indicators.unemploymentRate = labor.unemploymentRate;
            facts.observed.push({
              section: "Sociedade",
              kind: "fact",
              text: `A taxa de desemprego registrada no fechamento é de ${percent(labor.unemploymentRate)}.`
            });
            facts.sources.push("VilarejoTest.getLaborStats / stateSnapshot");
          }
          if (finiteOrNull(state.monthlyInflation) !== null) {
            facts.indicators.inflationMonthly = state.monthlyInflation;
            facts.observed.push({
              section: "Economia",
              kind: "fact",
              text: `A inflação mensal registrada no fechamento é de ${percent(state.monthlyInflation)}.`
            });
            facts.sources.push("VilarejoTest.stateSnapshot.monthlyInflation");
          }
          if (finiteOrNull(state.approval) !== null) {
            facts.indicators.approval = state.approval;
            facts.observed.push({
              section: "Governo",
              kind: "fact",
              text: `A aprovação registrada no fechamento é de ${percent(state.approval, 0)}.`
            });
            facts.sources.push("VilarejoTest.stateSnapshot.approval");
          }
        }
      }
    } catch (_) {}

    try {
      if (runtime && typeof runtime.snapshot === "function") {
        const coreSnap = runtime.snapshot();
        const total = finiteOrNull(coreSnap?.population?.totals?.total);
        if (total !== null && facts.indicators.population === undefined) {
          facts.indicators.population = Math.floor(total);
          facts.observed.push({
            section: "Sociedade",
            kind: "fact",
            text: `A população sincronizada no núcleo no fechamento do mês ${facts.indicators.monthNumber} é de ${facts.indicators.population.toLocaleString("pt-BR")} habitantes.`
          });
          facts.sources.push("runtime.snapshot().population");
        }
      }
    } catch (_) {}

    try {
      const societyRuntime = windowRef && windowRef.VilarejoSocietyRuntime;
      if (societyRuntime && typeof societyRuntime.getSnapshot === "function") {
        const society = societyRuntime.getSnapshot();
        const quality = finiteOrNull(society?.qualityOfLife?.current?.score);
        if (quality !== null) {
          facts.indicators.qualityOfLife = quality;
          facts.observed.push({
            section: "Sociedade",
            kind: "fact",
            text: `O indicador de qualidade de vida registrado pela Sociedade no período é ${quality.toFixed(1)}.`
          });
          facts.sources.push("VilarejoSocietyRuntime.getSnapshot");
        }
      }
    } catch (_) {}

    if (!facts.observed.length) {
      facts.gaps.push("Não há indicadores suficientes no payload nem nas APIs públicas para compor matérias factuais.");
    }

    return facts;
  }

  function buildComparisons(currentIndicators, previousEdition) {
    const interpretations = [];
    if (!previousEdition || !previousEdition.indicators) return interpretations;

    const prev = previousEdition.indicators;
    const cur = currentIndicators || {};

    function compare(key, section, subject, unit) {
      const current = finiteOrNull(cur[key]);
      const prior = finiteOrNull(prev[key]);
      if (current === null || prior === null) return;
      const deltaText = formatDelta(current, prior, unit);
      if (!deltaText) return;
      interpretations.push({
        section,
        kind: "interpretation",
        text: `Em relação ao mês ${prev.monthNumber}, ${subject} variou ${deltaText}. Trata-se de comparação entre fechamentos registrados; a variação isolada não estabelece causalidade.`
      });
    }

    compare("population", "Sociedade", "a população", "people");
    compare("gdp", "Economia", "o PIB (ótica da produção)", "money");
    compare("fiscalResult", "Fisco", "o resultado fiscal nominal", "money");
    compare("unemploymentRate", "Sociedade", "a taxa de desemprego", "pp");
    compare("inflationMonthly", "Economia", "a inflação mensal", "pp");
    compare("approval", "Governo", "a aprovação", "pp");
    compare("qualityOfLife", "Sociedade", "o indicador de qualidade de vida", "number");

    return interpretations;
  }

  function buildHeadline(monthNumber, indicators) {
    const parts = [];
    if (finiteOrNull(indicators.gdp) !== null) parts.push(`PIB de ${money(indicators.gdp)}`);
    if (finiteOrNull(indicators.fiscalResult) !== null) {
      const fr = indicators.fiscalResult;
      parts.push(fr >= 0 ? "resultado fiscal positivo" : "resultado fiscal negativo");
    }
    if (finiteOrNull(indicators.population) !== null) {
      parts.push(`população de ${Math.floor(indicators.population).toLocaleString("pt-BR")}`);
    }
    if (!parts.length) {
      return `Edição do mês econômico ${monthNumber}: dados parciais`;
    }
    return `Mês ${monthNumber}: ${parts.join("; ")}`;
  }

  function composeEdition(sessionId, payload, runtime, windowRef, previousEdition) {
    const facts = collectFacts(payload, runtime, windowRef);
    const monthNumber = facts.indicators.monthNumber;
    if (monthNumber === undefined || monthNumber === null) return null;

    const interpretations = buildComparisons(facts.indicators, previousEdition);
    const sections = {};

    for (const item of facts.observed) {
      if (!sections[item.section]) sections[item.section] = { facts: [], interpretations: [] };
      sections[item.section].facts.push(item.text);
    }
    for (const item of interpretations) {
      if (!sections[item.section]) sections[item.section] = { facts: [], interpretations: [] };
      sections[item.section].interpretations.push(item.text);
    }

    const body = [];
    const sectionOrder = ["Economia", "Fisco", "Sociedade", "Governo", "Serviços"];
    for (const name of sectionOrder) {
      const block = sections[name];
      if (!block) continue;
      body.push({
        section: name,
        facts: block.facts.slice(),
        interpretations: block.interpretations.slice()
      });
    }
    for (const name of Object.keys(sections)) {
      if (sectionOrder.includes(name)) continue;
      const block = sections[name];
      body.push({
        section: name,
        facts: block.facts.slice(),
        interpretations: block.interpretations.slice()
      });
    }

    return {
      id: editionId(sessionId, monthNumber),
      sessionId,
      monthNumber,
      day: facts.indicators.day ?? null,
      year: facts.indicators.year ?? null,
      headline: buildHeadline(monthNumber, facts.indicators),
      indicators: clone(facts.indicators),
      sections: body,
      sources: facts.sources.slice(),
      gaps: facts.gaps.slice(),
      hasSufficientData: facts.observed.length > 0,
      publishedAt: new Date().toISOString(),
      sourceEvent: "economy:month-closed"
    };
  }

  function createService(options = {}) {
    const runtime = options.runtime || null;
    const windowRef = options.window || (typeof window !== "undefined" ? window : null);
    const editions = new Map();
    let activeSessionId = null;
    let lastResetCount = null;

    function resolveSessionId(payload) {
      if (payload && payload.sessionId) return String(payload.sessionId);
      if (runtime && runtime.session && typeof runtime.session.get === "function") {
        const session = runtime.session.get();
        if (session && session.id) return String(session.id);
      }
      if (!activeSessionId) activeSessionId = "session-orphan";
      return activeSessionId;
    }

    function ensureSession(sessionId) {
      activeSessionId = sessionId;
    }

    function getPreviousEdition(sessionId, monthNumber) {
      const list = Array.from(editions.values())
        .filter((item) => item.sessionId === sessionId && item.monthNumber < monthNumber)
        .sort((a, b) => a.monthNumber - b.monthNumber);
      return list.length ? list[list.length - 1] : null;
    }

    function publishEdition(payload = {}) {
      const sessionId = resolveSessionId(payload);
      ensureSession(sessionId);

      const monthNumber = finiteOrNull(payload.monthNumber);
      if (monthNumber === null) return null;
      const month = Math.floor(monthNumber);
      const id = editionId(sessionId, month);

      if (editions.has(id)) {
        return clone(editions.get(id));
      }

      const previous = getPreviousEdition(sessionId, month);
      const edition = composeEdition(sessionId, payload, runtime, windowRef, previous);
      if (!edition) return null;

      editions.set(id, edition);

      const sessionEditions = Array.from(editions.values())
        .filter((item) => item.sessionId === sessionId)
        .sort((a, b) => a.monthNumber - b.monthNumber);
      if (sessionEditions.length > MAX_EDITIONS_PER_SESSION) {
        const overflow = sessionEditions.length - MAX_EDITIONS_PER_SESSION;
        for (let i = 0; i < overflow; i += 1) {
          editions.delete(sessionEditions[i].id);
        }
      }

      return clone(edition);
    }

    function getEditions(filters = {}) {
      let list = Array.from(editions.values());
      const sessionId = filters.sessionId || activeSessionId;
      if (sessionId) list = list.filter((item) => item.sessionId === sessionId);
      list.sort((a, b) => a.monthNumber - b.monthNumber);
      if (filters.limit !== undefined) {
        const limit = Math.max(0, Math.floor(Number(filters.limit) || 0));
        list = limit === 0 ? [] : list.slice(-limit);
      }
      return clone(list);
    }

    function getEdition(month, sessionId) {
      const targetSession = sessionId || activeSessionId;
      if (!targetSession) return null;
      const monthNumber = Math.floor(Number(month));
      if (!Number.isFinite(monthNumber)) return null;
      const found = editions.get(editionId(targetSession, monthNumber));
      return found ? clone(found) : null;
    }

    function resetForNewGame(details = {}) {
      const resetCount = finiteOrNull(details.resetCount);
      if (resetCount !== null && resetCount === lastResetCount) {
        return { sessionId: activeSessionId, editions: getEditions().length };
      }
      lastResetCount = resetCount;

      const newSessionId =
        (details.sessionId && String(details.sessionId)) ||
        (runtime && runtime.session && typeof runtime.session.get === "function" && runtime.session.get().id) ||
        `session-reset-${Date.now()}`;

      if (activeSessionId && activeSessionId !== newSessionId) {
        for (const [id, edition] of Array.from(editions.entries())) {
          if (edition.sessionId === activeSessionId) editions.delete(id);
        }
      }

      activeSessionId = String(newSessionId);
      return { sessionId: activeSessionId, editions: getEditions().length };
    }

    function clear() {
      editions.clear();
      activeSessionId = null;
      lastResetCount = null;
    }

    function getSummary() {
      const list = getEditions();
      return {
        version: VERSION,
        sessionId: activeSessionId,
        editionCount: list.length,
        latestMonth: list.length ? list[list.length - 1].monthNumber : null,
        latestHeadline: list.length ? list[list.length - 1].headline : null
      };
    }

    function renderDashboard(host) {
      if (!host || typeof host !== "object") {
        throw new TypeError("renderDashboard exige um elemento hospedeiro válido.");
      }

      const list = getEditions();
      const root = document.createElement("div");
      root.className = "vilarejo-newspaper";
      root.setAttribute("data-module", "jornal");

      const header = document.createElement("header");
      header.className = "vilarejo-newspaper__header";
      header.innerHTML = `<h2>Jornal do Vilarejo</h2><p class="vilarejo-newspaper__meta">Edições baseadas apenas em fechamentos econômicos registrados. Sem invenção de fatos.</p>`;
      root.appendChild(header);

      if (!list.length) {
        const empty = document.createElement("div");
        empty.className = "vilarejo-newspaper__empty";
        empty.textContent = "Nenhuma edição publicada ainda. O jornal é gerado a cada fechamento mensal da economia.";
        root.appendChild(empty);
      } else {
        const ordered = list.slice().reverse();
        for (const edition of ordered) {
          const article = document.createElement("article");
          article.className = "vilarejo-newspaper__edition";
          article.setAttribute("data-month", String(edition.monthNumber));

          const title = document.createElement("h3");
          title.textContent = edition.headline;
          article.appendChild(title);

          const meta = document.createElement("p");
          meta.className = "vilarejo-newspaper__edition-meta";
          const metaParts = [`Mês econômico ${edition.monthNumber}`];
          if (edition.day != null) metaParts.push(`dia ${edition.day}`);
          if (edition.year != null) metaParts.push(`ano ${edition.year}`);
          meta.textContent = metaParts.join(" · ");
          article.appendChild(meta);

          if (!edition.hasSufficientData) {
            const warn = document.createElement("p");
            warn.className = "vilarejo-newspaper__gap";
            warn.textContent = "Dados insuficientes neste fechamento para matérias factuais completas.";
            article.appendChild(warn);
          }

          for (const block of edition.sections || []) {
            const sectionEl = document.createElement("section");
            sectionEl.className = "vilarejo-newspaper__section";
            const h4 = document.createElement("h4");
            h4.textContent = block.section;
            sectionEl.appendChild(h4);

            if (block.facts && block.facts.length) {
              const factsTitle = document.createElement("p");
              factsTitle.className = "vilarejo-newspaper__label";
              factsTitle.textContent = "Fatos observados";
              sectionEl.appendChild(factsTitle);
              const ul = document.createElement("ul");
              for (const text of block.facts) {
                const li = document.createElement("li");
                li.textContent = text;
                ul.appendChild(li);
              }
              sectionEl.appendChild(ul);
            }

            if (block.interpretations && block.interpretations.length) {
              const intTitle = document.createElement("p");
              intTitle.className = "vilarejo-newspaper__label";
              intTitle.textContent = "Interpretação (comparação entre períodos)";
              sectionEl.appendChild(intTitle);
              const ul = document.createElement("ul");
              for (const text of block.interpretations) {
                const li = document.createElement("li");
                li.textContent = text;
                ul.appendChild(li);
              }
              sectionEl.appendChild(ul);
            }

            article.appendChild(sectionEl);
          }

          if (edition.gaps && edition.gaps.length) {
            const gaps = document.createElement("p");
            gaps.className = "vilarejo-newspaper__gap";
            gaps.textContent = "Lacunas: " + edition.gaps.join(" ");
            article.appendChild(gaps);
          }

          root.appendChild(article);
        }
      }

      if (typeof host.replaceChildren === "function") {
        host.replaceChildren(root);
      } else {
        while (host.firstChild) host.removeChild(host.firstChild);
        host.appendChild(root);
      }

      return root;
    }

    if (runtime && runtime.session && typeof runtime.session.get === "function") {
      const session = runtime.session.get();
      if (session && session.id) activeSessionId = String(session.id);
    }

    return {
      version: VERSION,
      publishEdition,
      getEditions,
      getEdition,
      getIssues: getEditions,
      getIssue: getEdition,
      resetForNewGame,
      clear,
      getSummary,
      renderDashboard,
      getActiveSessionId: () => activeSessionId
    };
  }

  function registerWithRuntime(runtime, options = {}) {
    if (!runtime || !runtime.modules || !runtime.events || typeof runtime.publish !== "function") {
      throw new TypeError("Runtime incompleto para registrar o Jornal do Vilarejo.");
    }

    if (runtime.modules.has(MODULE_ID)) {
      return { alreadyRegistered: true, service: null, dispose() {} };
    }

    const dependencies = ["core", "economia"].filter((id) => runtime.modules.has(id));
    if (!runtime.modules.has("core") || !runtime.modules.has("economia")) {
      throw new Error("O Jornal exige Core e Economia registrados.");
    }

    runtime.modules.register({
      id: MODULE_ID,
      version: VERSION,
      name: "Jornal do Vilarejo",
      dependencies,
      description: "Edições mensais factuais a partir dos fechamentos econômicos registrados; não inventa acontecimentos."
    });

    const windowRef = options.window || (typeof window !== "undefined" ? window : null);
    const service = createService({ ...options, runtime, window: windowRef });

    const publishSummary = (source = "jornal") => {
      try {
        runtime.modules.updateSnapshot(MODULE_ID, service.getSummary(), source);
      } catch (_) {}
    };

    const unsubscribers = [];

    unsubscribers.push(
      runtime.events.on("economy:month-closed", (event) => {
        try {
          const edition = service.publishEdition(event?.payload || {});
          if (!edition) return;
          publishSummary("jornal.month-adapter");
          runtime.publish(
            "newspaper:edition-published",
            {
              sessionId: edition.sessionId,
              monthNumber: edition.monthNumber,
              headline: edition.headline,
              hasSufficientData: edition.hasSufficientData
            },
            "jornal"
          );
        } catch (_) {}
      })
    );

    unsubscribers.push(
      runtime.events.on("game:reset", (event) => {
        try {
          service.resetForNewGame(event?.payload || {});
          publishSummary("jornal.reset-adapter");
        } catch (_) {}
      })
    );

    publishSummary("jornal.initial-adapter");

    return {
      alreadyRegistered: false,
      service,
      getSnapshot: () => service.getSummary(),
      dispose() {
        unsubscribers.forEach((unsubscribe) => {
          try {
            unsubscribe();
          } catch (_) {}
        });
      }
    };
  }

  let activeService = createService();

  const originalRegister = registerWithRuntime;
  function registerWithRuntimeAndBind(runtime, options = {}) {
    const result = originalRegister(runtime, options);
    if (result && result.service) {
      activeService = result.service;
    }
    return result;
  }

  return {
    VERSION,
    MODULE_ID,
    createService,
    registerWithRuntime: registerWithRuntimeAndBind,
    renderDashboard(host) {
      return activeService.renderDashboard(host);
    },
    getEditions(filters) {
      return activeService.getEditions(filters);
    },
    getEdition(month, sessionId) {
      return activeService.getEdition(month, sessionId);
    },
    getIssues(filters) {
      return activeService.getIssues(filters);
    },
    getIssue(month, sessionId) {
      return activeService.getIssue(month, sessionId);
    },
    _createService: createService,
    _composeEdition: composeEdition,
    _collectFacts: collectFacts,
    _getActiveService: () => activeService
  };
});
