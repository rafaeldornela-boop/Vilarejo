(function initVilarejoProgression() {
  "use strict";

  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const num = (value) => finite(Number(value)) ? Number(value) : null;

  function evaluate(snapshot) {
    const raw = snapshot?.raw || {};
    const firms = Array.isArray(raw.firms) ? raw.firms.filter((firm) => firm && firm.status !== "liquidated") : [];
    const activeFirms = firms.filter((firm) => firm.status === "active");
    const nonFarm = activeFirms.filter((firm) => firm.id !== "farm");
    const nonFarmWorkers = nonFarm.reduce((sum, firm) => sum + Math.max(0, num(firm.activeWorkers) || 0), 0);
    const population = num(snapshot?.population) ?? 0;
    const capacity = num(snapshot?.urbanInfra?.capacity ?? raw.infrastructureCapacity) ?? 0;
    const advanced = firms.filter((firm) => !["farm", "commerce", "workshop"].includes(firm.id));
    const hasBakery = firms.some((firm) => firm.id === "bakery");

    const milestones = [
      {
        id: "community",
        label: "Comunidade estruturada",
        achieved: population >= 10,
        evidence: "A comunidade já possui uma base populacional observável."
      },
      {
        id: "urban-capacity",
        label: "Capacidade urbana ampliada",
        achieved: capacity > 20,
        evidence: capacity > 20 ? `Capacidade atual: ${capacity}.` : "A capacidade ainda está no patamar inicial ou não foi observada."
      },
      {
        id: "economic-diversity",
        label: "Diversificação produtiva",
        achieved: hasBakery || advanced.length > 0,
        evidence: hasBakery ? "A Padaria e Empório está registrada." : advanced.length ? `${advanced.length} atividade(s) adicional(is) registrada(s).` : "Ainda não há uma atividade adicional registrada."
      },
      {
        id: "nonfarm-employment",
        label: "Emprego fora da fazenda",
        achieved: nonFarmWorkers > 0,
        evidence: `${nonFarmWorkers} trabalhador(es) ativo(s) em outros setores.`
      }
    ];

    const achievedCount = milestones.filter((item) => item.achieved).length;
    const phase = achievedCount >= 4
      ? "municipio"
      : achievedCount >= 3
        ? "diversificacao"
        : achievedCount >= 2
          ? "expansao"
          : "rural";

    return {
      phase,
      achievedCount,
      totalMilestones: milestones.length,
      milestones,
      note: "Este quadro reconhece conquistas observadas. Não cria desbloqueios, não altera o motor e não libera ações por conta própria."
    };
  }

  window.VilarejoProgression = Object.freeze({ evaluate });
})();
