(function initVilarejoPlayerExperience() {
  "use strict";

  const VERSION = "1.0.0";
  const SELECTORS = {
    actionCard: ".action-card",
    actions: "#actions",
    briefing: "#playerBriefing"
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const n = (value) => finite(Number(value)) ? Number(value) : null;
  const money = (value) => "R$ " + Math.round(Number(value) || 0).toLocaleString("pt-BR");

  function readSnapshot() {
    try {
      return window.VilarejoDashboard?.getSnapshot?.() || null;
    } catch (error) {
      console.warn("[PlayerExperience] Snapshot indisponível:", error);
      return null;
    }
  }

  function readFarmOwnership(raw) {
    const ownership = raw?.farmOwnership || {};
    const state = n(ownership.treasury);
    const privateShare = n(ownership.private);
    if (state === null && privateShare === null) return null;
    return {
      state: state === null ? null : Math.max(0, Math.min(1, state)),
      private: privateShare === null ? null : Math.max(0, Math.min(1, privateShare))
    };
  }

  function deriveStage(snapshot) {
    const raw = snapshot?.raw || {};
    const firms = Array.isArray(raw.firms) ? raw.firms.filter((firm) => firm && firm.status !== "liquidated") : [];
    const activeFirms = firms.filter((firm) => firm.status === "active");
    const nonFarmFirms = activeFirms.filter((firm) => firm.id !== "farm");
    const nonFarmWorkers = nonFarmFirms.reduce((sum, firm) => sum + Math.max(0, n(firm.activeWorkers) || 0), 0);
    const population = n(snapshot?.population) ?? n(raw.population) ?? 0;
    const infrastructure = snapshot?.urbanInfra || raw.urbanInfra || {};
    const capacity = n(infrastructure.capacity) ?? n(raw.infrastructureCapacity) ?? 0;
    const bakeryExists = firms.some((firm) => firm.id === "bakery");
    const advancedFirmCount = firms.filter((firm) => !["farm", "commerce", "workshop"].includes(firm.id)).length;

    // A fase descreve o estágio observado. Ela não cria nem desbloqueia mecânicas.
    if (advancedFirmCount >= 2 && capacity >= 40 && nonFarmWorkers >= 4) {
      return {
        id: "municipio",
        label: "Município desenvolvido",
        description: "A economia já reúne atividades diversificadas e capacidade urbana ampliada."
      };
    }
    if ((bakeryExists || advancedFirmCount >= 1) && nonFarmWorkers >= 1) {
      return {
        id: "diversificacao",
        label: "Economia em diversificação",
        description: "Novas atividades começam a dividir espaço com a produção rural."
      };
    }
    if (population >= 20 || capacity > 20) {
      return {
        id: "expansao",
        label: "Vilarejo em expansão",
        description: "O crescimento da comunidade começa a exigir mais capacidade e serviços."
      };
    }
    return {
      id: "rural",
      label: "Comunidade rural",
      description: "A produção básica e as condições de vida ainda concentram a gestão."
    };
  }

  function deriveAttention(snapshot) {
    const raw = snapshot?.raw || {};
    const items = [];
    const infra = snapshot?.urbanInfra || raw.urbanInfra || {};
    const congestion = n(infra.congestionRatio);
    const population = n(snapshot?.population);
    const housing = n(snapshot?.housingCapacity ?? raw.housingCapacity);
    const shortage = n(raw.lastShortageUnits ?? raw.lastShortage);
    const treasury = n(raw.treasuryCash ?? raw.accounts?.treasury);
    const ownership = readFarmOwnership(raw);

    if (congestion !== null && congestion > 1.05) {
      items.push({
        id: "infrastructure",
        level: congestion > 1.25 ? "high" : "medium",
        title: "Infraestrutura pressionada",
        detail: `A demanda está em ${congestion.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} vez(es) a capacidade disponível.`
      });
    }

    if (population !== null && housing !== null && housing > 0 && population / housing >= 0.9) {
      items.push({
        id: "housing",
        level: population / housing >= 1 ? "high" : "medium",
        title: "Moradias merecem atenção",
        detail: `Ocupação aproximada de ${Math.round(population / housing * 100)}% da capacidade habitacional.`
      });
    }

    if (shortage !== null && shortage > 0.1) {
      items.push({
        id: "supply",
        level: "high",
        title: "Abastecimento com déficit",
        detail: `${shortage.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} unidade(s) de demanda ficaram sem atendimento no último fechamento.`
      });
    }

    if (treasury !== null && treasury < 6000) {
      items.push({
        id: "treasury",
        level: "medium",
        title: "Caixa público limitado",
        detail: `O Tesouro tem ${money(treasury)}. Evite comprometer recursos sem avaliar as prioridades.`
      });
    }

    if (ownership && ownership.state !== null && ownership.state <= 0.005) {
      items.push({
        id: "farm-private",
        level: "info",
        title: "Fazenda integralmente privada",
        detail: "A privatização foi concluída. A empresa permanece na economia e deve continuar sendo acompanhada."
      });
    }

    return items;
  }

  const ACTION_RULES = [
    {
      id: "housing",
      match: /moradia|moradias|habita[cç][aã]o|construir casas/i,
      relevant: (s) => {
        const pop = n(s?.population);
        const cap = n(s?.housingCapacity ?? s?.raw?.housingCapacity);
        return pop !== null && cap !== null && cap > 0 && pop / cap >= 0.85;
      }
    },
    {
      id: "infrastructure",
      match: /infraestrutura|obras p[uú]blicas|investir em obras/i,
      relevant: (s) => {
        const ratio = n((s?.urbanInfra || s?.raw?.urbanInfra || {}).congestionRatio);
        return ratio !== null && ratio > 1.0;
      }
    },
    {
      id: "land",
      match: /vender terreno|venda de terreno|alienar terreno/i,
      relevant: (s) => {
        const lots = n(s?.lots ?? s?.raw?.lots);
        return lots !== null && lots > 0;
      }
    },
    {
      id: "farm-privatization",
      match: /privatiza|vender participa[cç][aã]o.*fazenda|alienar.*fazenda/i,
      relevant: (s) => {
        const ownership = readFarmOwnership(s?.raw || {});
        return ownership?.state !== null && ownership?.state > 0.005;
      }
    },
    {
      id: "concession",
      match: /concess[aã]o|conceder servi[cç]os|privatizar servi[cç]os/i,
      relevant: (s) => !Boolean(s?.raw?.concessionActive)
    }
  ];

  function classifyAction(button) {
    const label = String(button.textContent || "").replace(/\s+/g, " ").trim();
    return ACTION_RULES.find((rule) => rule.match.test(label)) || null;
  }

  function applyActionContext(snapshot) {
    const host = $(SELECTORS.actions);
    if (!host) return { visible: 0, hidden: 0 };

    let visible = 0;
    let hidden = 0;

    host.querySelectorAll("button").forEach((button) => {
      const label = String(button.textContent || "").replace(/\s+/g, " ").trim();
      const normalized = label.toLocaleLowerCase("pt-BR");
      const completedFarmLabel = /fazenda\s*100%\s*privada|privatiza[cç][aã]o\s*conclu[ií]da/.test(normalized);
      const rule = classifyAction(button);
      let shouldShow = !button.disabled && !completedFarmLabel;

      if (shouldShow && rule) shouldShow = Boolean(rule.relevant(snapshot));

      // Uma ação sem regra contextual permanece visível se o motor a habilitou.
      button.hidden = !shouldShow;
      button.setAttribute("aria-hidden", shouldShow ? "false" : "true");
      if (shouldShow) visible += 1;
      else hidden += 1;
    });

    return { visible, hidden };
  }

  function ensureBriefingHost() {
    const card = $(SELECTORS.actionCard);
    if (!card) return null;
    let host = $(SELECTORS.briefing, card);
    if (!host) {
      host = document.createElement("section");
      host.id = "playerBriefing";
      host.className = "player-briefing";
      host.setAttribute("aria-live", "polite");
      const heading = card.querySelector(".section-heading");
      if (heading?.nextSibling) card.insertBefore(host, heading.nextSibling);
      else card.prepend(host);
    }
    return host;
  }

  function renderBriefing(snapshot, actionCounts) {
    const host = ensureBriefingHost();
    if (!host) return;

    if (!snapshot) {
      host.innerHTML = '<p class="player-briefing-empty">Aguardando os dados do município.</p>';
      return;
    }

    const stage = deriveStage(snapshot);
    const attention = deriveAttention(snapshot);
    const current = attention.filter((item) => item.level === "high");
    const primary = current[0] || attention[0] || null;
    const actionText = actionCounts.visible === 0
      ? "Nenhuma decisão operacional disponível neste momento."
      : `${actionCounts.visible} decisão(ões) disponível(is) para avaliar.`;

    host.innerHTML = `
      <div class="player-briefing-top">
        <div>
          <span class="player-briefing-kicker">MOMENTO DO MUNICÍPIO</span>
          <strong>${stage.label}</strong>
          <p>${stage.description}</p>
        </div>
        <span class="player-stage-tag">${stage.id === "rural" ? "ETAPA 1" : stage.id === "expansao" ? "ETAPA 2" : stage.id === "diversificacao" ? "ETAPA 3" : "ETAPA 4"}</span>
      </div>
      <div class="player-briefing-focus">
        <span class="player-briefing-kicker">O QUE MERECE SUA ATENÇÃO</span>
        ${primary
          ? `<strong>${primary.title}</strong><p>${primary.detail}</p>`
          : '<strong>Sem pressão prioritária identificada</strong><p>Continue acompanhando os indicadores e os acontecimentos do município.</p>'}
      </div>
      <div class="player-briefing-actions">
        <span class="player-briefing-kicker">SUAS POSSIBILIDADES</span>
        <strong>${actionText}</strong>
      </div>
      ${attention.length > 1 ? `<details class="player-briefing-more"><summary>Ver outros sinais (${attention.length - 1})</summary><ul>${attention.slice(1).map((item) => `<li><b>${item.title}</b><span>${item.detail}</span></li>`).join("")}</ul></details>` : ""}
    `;
  }

  function refresh(snapshot = readSnapshot()) {
    const actionCounts = applyActionContext(snapshot);
    renderBriefing(snapshot, actionCounts);
    return { stage: snapshot ? deriveStage(snapshot) : null, attention: snapshot ? deriveAttention(snapshot) : [], actionCounts };
  }

  function init() {
    const host = $(SELECTORS.actions);
    if (!host) return;
    refresh();
    if (typeof MutationObserver === "function") {
      const observer = new MutationObserver(() => refresh());
      observer.observe(host, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled"] });
    }
    window.addEventListener("vilarejo:snapshot-updated", () => refresh());
  }

  window.VilarejoPlayerExperience = Object.freeze({
    version: VERSION,
    refresh,
    deriveStage,
    deriveAttention,
    applyActionContext
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
