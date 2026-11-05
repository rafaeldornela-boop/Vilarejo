// Motor de eventos v3 — Compatível com Browser (window.EventosV3) e Node.js (module.exports)
"use strict";

let sementeGlobal = 42;
let rand = Math.random;

function passoMulberry32(n) {
  n = (n + 0x6d2b79f5) | 0;
  let t = Math.imul(n ^ (n >>> 15), 1 | n);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { valor: ((t ^ (t >>> 14)) >>> 0) / 4294967296, semente: n };
}

function usarSemente(n) {
  sementeGlobal = n | 0;
  rand = () => {
    const r = passoMulberry32(sementeGlobal);
    sementeGlobal = r.semente;
    return r.valor;
  };
}

function sortear(s) {
  if (s && typeof s.semente === "number") {
    const r = passoMulberry32(s.semente);
    s.semente = r.semente;
    return r.valor;
  }
  return rand();
}

const CALENDARIO = [
  "chuvosa", "chuvosa", "chuvosa", "outono", "outono", "inverno",
  "inverno", "inverno", "seca", "seca", "chuvosa", "chuvosa"
];
const estacaoDo = (mes) => CALENDARIO[((Math.max(1, mes) - 1) % 12)];
const porSev = (sev, l, m, g) => ({ leve: l, media: m, grave: g })[sev];
const SEV = { leve: 0.6, media: 0.3, grave: 0.1 };
const achar = (id) => EVENTOS.find((e) => e.id === id);
const limita = (v, a, b) => Math.max(a, Math.min(b, v));

function garantirSinaisAtivos(s) {
  if (s.sinaisAtivos instanceof Set) s.sinaisAtivos = Array.from(s.sinaisAtivos);
  else if (!Array.isArray(s.sinaisAtivos)) s.sinaisAtivos = [];
  if (typeof s.sinaisAtivos.has !== "function") {
    Object.defineProperties(s.sinaisAtivos, {
      has: { value(k) { return this.includes(k); }, configurable: true },
      add: { value(k) { if (!this.includes(k)) this.push(k); return this; }, configurable: true },
      delete: {
        value(k) {
          const i = this.indexOf(k);
          if (i >= 0) { this.splice(i, 1); return true; }
          return false;
        },
        configurable: true
      },
      size: { get() { return this.length; }, configurable: true }
    });
  }
  return s.sinaisAtivos;
}

function alterarCaixa(s, delta, motivo, categoria = "geral", conta = null) {
  if (!delta) return;
  if (conta === "treasury") {
    s.caixaTesouro = (s.caixaTesouro || 0) + delta;
  } else {
    s.caixa += delta;
  }
  if (typeof s.onTransacao === "function") s.onTransacao(delta, motivo, categoria, conta);
}

function cancelarAgendado(s, id) {
  if (!Array.isArray(s.agendados)) return false;
  const antes = s.agendados.length;
  s.agendados = s.agendados.filter((a) => a.id !== id);
  return s.agendados.length < antes;
}

function perderTrabalhadores(s, qtd) {
  if (qtd <= 0) return;
  const perda = s.trabalhadores <= 6 ? Math.min(qtd, Math.max(1, Math.floor(qtd / 2))) : qtd;
  s.trabalhadores = Math.max(1, s.trabalhadores - perda);
}

const EVENTOS = [
  { id: "seca", categoria: "clima", tipo: "sorteio", pBase: 0.08, pMax: 0.25, cooldown: 12, duracao: 3,
    condicoes: (s) => s.estacao === "seca" && s.mes >= 3,
    modificadores: [{ se: (s) => !s.irrigacao, valor: 0.5 }, { se: (s) => s.reservaAgua, valor: -0.3 }],
    severidade: SEV,
    aviso: { meses: 1, precisao: 0.7, falsoAlarme: 0.015, texto: "Os mais velhos dizem que as chuvas vão falhar este ano." },
    efeito: (s, sev) => { s.modProducao += porSev(sev, -0.1, -0.2, -0.3); },
    escolhas: [{ id: "absorver", custo: 0 }, { id: "irrigar", custo: 1500, aplica: (s, a) => { a.fator = 0.33; } }],
    encadeia: [{ id: "preco_sobe", emMeses: 2, severidade: ["media", "grave"] }],
    caixa: "Perda por seca" },

  { id: "geada", categoria: "clima", tipo: "sorteio", pBase: 0.06, pMax: 0.2, cooldown: 12, duracao: 4,
    condicoes: (s) => s.estacao === "inverno" && s.mes >= 3 && !s.geadaNativaAtiva,
    modificadores: [{ se: (s) => s.protecaoGeada, valor: -0.4 }],
    severidade: SEV,
    aviso: { meses: 1, precisao: 0.6, falsoAlarme: 0.02, texto: "Frio fora de época: a previsão fala em geada no próximo mês." },
    efeito: (s, sev) => { s.modProducao += porSev(sev, -0.15, -0.3, -0.5); },
    escolhas: [{ id: "absorver", custo: 0 }, { id: "proteger_lavoura", custo: 600, aplica: (s, a) => { a.fator = 0.5; } }],
    encadeia: [{ id: "preco_sobe", emMeses: 2, severidade: ["grave"] }],
    caixa: "Perda por geada" },

  { id: "praga_broca", categoria: "clima", tipo: "sorteio", pBase: 0.07, pMax: 0.2, cooldown: 10, duracao: 4,
    condicoes: (s) => s.estacao === "chuvosa" && s.mes >= 3,
    modificadores: [{ se: (s) => !s.manejoPragas, valor: 0.4 }, { se: (s) => s.manejoPragas, valor: -0.3 }],
    severidade: SEV,
    aviso: { meses: 1, precisao: 0.8, falsoAlarme: 0.015, texto: "As armadilhas estão pegando mais brocas que o normal." },
    efeito: (s, sev) => { s.modProducao += porSev(sev, -0.08, -0.15, -0.25); },
    escolhas: [{ id: "absorver", custo: 0 }, { id: "controle_biologico", custo: 700, aplica: (s, a) => { a.fator = 0.4; } }],
    caixa: "Perda por broca-do-café" },

  { id: "preco_cai", categoria: "mercado", tipo: "sorteio", pBase: 0.07, pMax: 0.2, cooldown: 8, duracao: 4,
    condicoes: (s) => s.mes >= 3,
    modificadores: [{ se: (s) => s.cooperativa, valor: -0.3 }],
    severidade: SEV,
    aviso: { meses: 2, precisao: 0.65, falsoAlarme: 0.01, texto: "Boatos de safra recorde no exterior: os compradores estão hesitantes." },
    efeito: (s, sev) => { s.modPreco += porSev(sev, -0.1, -0.2, -0.35); },
    escolhas: [{ id: "absorver", custo: 0 }, { id: "estocar", custo: 300, aplica: (s, a) => { a.fator = 0.5; } }],
    caixa: "Queda no preço do café" },

  { id: "preco_sobe", categoria: "mercado", tipo: "encadeado", cooldown: 6, duracao: 4, crise: false,
    efeito: (s) => { s.modPreco += 0.2; },
    escolhas: [], caixa: "Alta no preço do café" },

  { id: "proposta_contrato", categoria: "mercado", tipo: "sorteio", pBase: 0.06, pMax: 0.15, cooldown: 10, duracao: 1, crise: false,
    condicoes: (s) => s.mes >= 4 && !s.contrato,
    modificadores: [{ se: (s) => s.reputacao > 60, valor: 0.5 }],
    severidade: { media: 1 },
    escolhas: [{ id: "recusar", custo: 0 },
      { id: "aceitar", custo: 0, aplica: (s) => { alterarCaixa(s, 3000, "Adiantamento de contrato de venda", "mercado"); s.contrato = { meta: 0.92, mesesRestantes: 12 }; } }],
    caixa: "Proposta de contrato de venda" },

  { id: "multa_contrato", categoria: "mercado", tipo: "limiar", cooldown: 6, duracao: 1,
    condicoes: (s) => Boolean(s.contrato && 1 + s.modProducao < s.contrato.meta),
    aoDisparar: (s) => { alterarCaixa(s, -1200, "Multa por descumprir contrato", "mercado"); s.reputacao = limita(s.reputacao - 5, 0, 100); },
    escolhas: [{ id: "absorver", custo: 0 },
      { id: "renegociar", custo: 0, aplica: (s) => { alterarCaixa(s, 600, "Renegociação parcial de multa contratual", "mercado"); s.reputacao = limita(s.reputacao - 5, 0, 100); } }],
    caixa: "Multa por descumprir contrato" },

  { id: "greve", categoria: "social", tipo: "limiar", cooldown: 12, duracao: 2,
    condicoes: (s) => s.moral < 30 && s.mesesMoralBaixa >= 2,
    sinais: [{ se: (s) => s.moral < 45, texto: "Murmúrio entre os trabalhadores: o clima na fazenda está pesado." }],
    efeito: (s) => { s.modProducao += -0.4; },
    escolhas: [{ id: "absorver", custo: 0 },
      { id: "aumentar_salario", custo: 800, aplica: (s, a) => { a.fator = 0; s.moral = limita(s.moral + 15, 0, 100); s.salarioRel = Math.max(s.salarioRel, 1); } }],
    caixa: "Greve dos trabalhadores" },

  { id: "familia_sai", categoria: "social", tipo: "sorteio", pBase: 0.05, pMax: 0.2, cooldown: 6, duracao: 3,
    condicoes: (s) => s.mes >= 4 && s.trabalhadores > 4,
    modificadores: [{ se: (s) => s.moral < 40, valor: 1.0 }, { se: (s) => s.salarioRel < 1, valor: 0.5 },
      { se: (s) => s.moradiaFornecida, valor: -0.3 }],
    severidade: { media: 1 },
    efeito: (s) => { s.modProducao += -0.1; },
    aoDisparar: (s) => { perderTrabalhadores(s, 3); },
    escolhas: [{ id: "deixar_ir", custo: 0 },
      { id: "contraoferta", custo: 500, aplica: (s, a) => { s.trabalhadores += 2; a.fator = 0.3; } }],
    caixa: "Uma família deixou o vilarejo" },

  { id: "empresa_externa", categoria: "social", tipo: "sorteio", pBase: 0.05, pMax: 0.2, cooldown: 10, duracao: 1,
    condicoes: (s) => s.mes >= 4 && s.trabalhadores > 4,
    modificadores: [{ se: (s) => s.salarioRel < 1, valor: 0.8 }, { se: (s) => s.moral < 50, valor: 0.5 }],
    severidade: { media: 1 },
    aviso: { meses: 2, precisao: 0.6, falsoAlarme: 0.01, texto: "Corre o boato de que uma empresa de fora vai contratar na região." },
    aoDisparar: (s) => { perderTrabalhadores(s, s.moral < 50 ? 3 : 1); },
    escolhas: [{ id: "deixar_ir", custo: 0 },
      { id: "igualar_salario", custo: 800, aplica: (s) => { s.salarioRel = Math.max(s.salarioRel, 1); s.trabalhadores += 1; } }],
    caixa: "Empresa de fora contratou trabalhadores" },

  { id: "doenca", categoria: "social", tipo: "sorteio", pBase: 0.05, pMax: 0.15, cooldown: 4, duracao: 2, sevInicial: 12,
    condicoes: (s) => s.mes >= 2,
    modificadores: [{ se: (s) => s.seguro, valor: -0.5 }],
    severidade: SEV,
    efeito: (s, sev) => { s.modProducao += porSev(sev, -0.05, -0.1, -0.2); },
    escolhas: [{ id: "absorver", custo: 0 }, { id: "tratar", custo: 400, aplica: (s, a) => { a.fator = 0.3; } }],
    caixa: "Surto de doença entre os trabalhadores" },

  { id: "estrada_estraga", categoria: "infra", tipo: "limiar", cooldown: 8, duracao: 4,
    condicoes: (s) => s.mesesSemManutencao >= 12,
    sinais: [{ se: (s) => s.mesesSemManutencao >= 8, texto: "Buracos começam a aparecer na estrada." }],
    efeito: (s) => { s.modPreco += -0.08; },
    escolhas: [{ id: "absorver", custo: 0 },
      { id: "reparar", custo: 1200, aplica: (s, a) => { a.fator = 0; s.mesesSemManutencao = 0; } }],
    caixa: "Estrada danificada encarece o frete" },

  { id: "imposto_novo", categoria: "governo", tipo: "sorteio", pBase: 0.04, pMax: 0.12, cooldown: 12, duracao: 1, crise: false,
    condicoes: (s) => s.mes >= 6,
    modificadores: [],
    severidade: { media: 1 },
    aviso: { meses: 2, precisao: 0.75, falsoAlarme: 0.005, texto: "Corre a notícia de que a prefeitura vai criar uma taxa sobre a produção." },
    aoDisparar: (s) => { alterarCaixa(s, -900, "Nova taxa municipal", "governo"); },
    escolhas: [{ id: "pagar", custo: 0 }, { id: "contestar", custo: 300, aplica: (s) => { alterarCaixa(s, 450, "Restituição parcial de taxa municipal", "governo"); } }],
    caixa: "Nova taxa municipal" },

  { id: "quebra_equipamento", categoria: "infra", tipo: "sorteio", pBase: 0.04, pMax: 0.12, cooldown: 6, duracao: 1, sevInicial: 12,
    condicoes: (s) => s.mes >= 2,
    modificadores: [{ se: (s) => s.manutencaoPreventiva, valor: -0.4 }],
    severidade: SEV,
    aoDisparar: (s, sev) => { alterarCaixa(s, -porSev(sev, 300, 700, 1500), "Quebra de equipamento", "infra"); },
    escolhas: [],
    caixa: "Quebra de equipamento" },

  { id: "pandemia", categoria: "global", tipo: "sorteio", global: true, pAnual: 0.03, cooldown: 120, duracao: 10,
    condicoes: (s) => s.mes >= 6,
    modificadores: [],
    severidade: SEV,
    aviso: { meses: 2, precisao: 0.9, falsoAlarme: 0.003, texto: "Notícias de uma doença desconhecida se espalhando pelo mundo." },
    efeito: (s, sev) => { s.modProducao += porSev(sev, -0.15, -0.3, -0.5); s.modPreco += porSev(sev, -0.05, -0.1, -0.2); },
    aoDisparar: (s, sev) => { perderTrabalhadores(s, porSev(sev, 0, 1, 3)); s.moral = limita(s.moral - porSev(sev, 3, 8, 15), 0, 100); },
    escolhas: [{ id: "absorver", custo: 0 },
      { id: "protocolos_sanitarios", custo: 1000, aplica: (s, a) => { a.fator = 0.5; s.moral = limita(s.moral + 5, 0, 100); } }],
    encadeia: [{ id: "preco_cai", emMeses: 3, severidade: ["grave"] }],
    caixa: "Pandemia" },

  { id: "guerra_mundial", categoria: "global", tipo: "sorteio", global: true, pAnual: 0.035, cooldown: 240, duracao: 24,
    condicoes: (s) => s.mes >= 12,
    modificadores: [],
    severidade: SEV,
    aviso: { meses: 3, precisao: 0.8, falsoAlarme: 0.003, texto: "Tensão entre as grandes potências: exércitos sendo mobilizados." },
    efeito: (s, sev) => { s.modPreco += porSev(sev, -0.15, -0.25, -0.4); s.modCusto += porSev(sev, 0.1, 0.2, 0.3); },
    aoDisparar: (s, sev) => { perderTrabalhadores(s, porSev(sev, 0, 2, 4)); },
    escolhas: [{ id: "absorver", custo: 0 },
      { id: "fornecer_ao_governo", custo: 0, aplica: (s, a) => { a.fator = 0.5; alterarCaixa(s, 2000, "Fornecimento estratégico ao governo", "governo"); s.reputacao = limita(s.reputacao + 5, 0, 100); } }],
    encadeia: [{ id: "inflacao", emMeses: 4, severidade: ["media", "grave"] }],
    caixa: "Guerra mundial" },

  { id: "crash_financeiro", categoria: "global", tipo: "sorteio", global: true, pAnual: 0.03, cooldown: 60, duracao: 8,
    condicoes: (s) => s.mes >= 6,
    modificadores: [],
    severidade: SEV,
    aviso: { meses: 1, precisao: 0.5, falsoAlarme: 0.004, texto: "Bancos do exterior em apuros: o crédito está sumindo." },
    efeito: (s, sev) => { s.modPreco += porSev(sev, -0.15, -0.3, -0.4); },
    aoDisparar: (s, sev) => { alterarCaixa(s, -porSev(sev, 500, 1500, 3000), "Restrição de crédito por crash financeiro", "mercado"); },
    escolhas: [{ id: "absorver", custo: 0 }, { id: "renegociar_dividas", custo: 200, aplica: (s, a) => { a.fator = 0.6; } }],
    caixa: "Crash financeiro" },

  { id: "mudanca_governo", categoria: "governo", tipo: "sorteio", pAnual: 0.03, cooldown: 60, duracao: 6,
    condicoes: (s) => s.mes >= 12,
    modificadores: [{ se: (s) => s.reputacao < 30, valor: 0.5 }],
    severidade: SEV,
    aviso: { meses: 2, precisao: 0.5, falsoAlarme: 0.004, texto: "Quartéis em movimento e boatos de conspiração na capital." },
    efeito: (s, sev) => { s.modCusto += porSev(sev, 0.05, 0.1, 0.2); },
    aoDisparar: (s) => { s.reputacao = limita(s.reputacao - 10, 0, 100); },
    escolhas: [{ id: "neutralidade", custo: 0 },
      { id: "apoiar_novo_governo", custo: 1000, aplica: (s, a) => { a.fator = 0.3; s.reputacao = limita(s.reputacao + 5, 0, 100); } }],
    encadeia: [{ id: "imposto_novo", emMeses: 3, severidade: ["media", "grave"] }],
    caixa: "Mudança de governo" },

  { id: "incendio_armazem", categoria: "infra", tipo: "sorteio", pAnual: 0.05, cooldown: 24, duracao: 1, sevInicial: 12,
    condicoes: (s) => s.mes >= 2,
    modificadores: [{ se: (s) => s.seguro, valor: -0.5 }],
    severidade: SEV,
    aoDisparar: (s, sev) => { alterarCaixa(s, -porSev(sev, 800, 3000, 8000) * (s.seguro ? 0.3 : 1), "Incêndio no armazém", "infra"); },
    escolhas: [],
    caixa: "Incêndio no armazém" },

  { id: "enchente", categoria: "clima", tipo: "sorteio", pBase: 0.03, pMax: 0.12, cooldown: 12, duracao: 3,
    condicoes: (s) => s.estacao === "chuvosa" && s.mes >= 3,
    modificadores: [{ se: (s) => s.drenagem, valor: -0.4 }],
    severidade: SEV,
    aviso: { meses: 1, precisao: 0.5, falsoAlarme: 0.02, texto: "O rio está subindo mais rápido do que o normal." },
    efeito: (s, sev) => { s.modProducao += porSev(sev, -0.1, -0.25, -0.4); },
    aoDisparar: (s) => { s.mesesSemManutencao += 6; },
    escolhas: [{ id: "absorver", custo: 0 }, { id: "drenagem_emergencial", custo: 800, aplica: (s, a) => { a.fator = 0.5; s.drenagem = true; } }],
    caixa: "Enchente" },

  { id: "safra_excepcional", categoria: "clima", tipo: "sorteio", pBase: 0.05, pMax: 0.12, cooldown: 12, duracao: 3, crise: false,
    condicoes: (s) => (s.estacao === "chuvosa" || s.estacao === "outono") && s.mes >= 3,
    modificadores: [{ se: (s) => s.manejoPragas, valor: 0.3 }],
    severidade: SEV,
    efeito: (s, sev) => { s.modProducao += porSev(sev, 0.1, 0.2, 0.3); },
    escolhas: [{ id: "absorver", custo: 0 }, { id: "contratar_diaristas", custo: 250, aplica: (s, a) => { a.fator = 1.6; } }],
    caixa: "Safra excepcional" },

  { id: "inflacao", categoria: "mercado", tipo: "sorteio", pAnual: 0.1, pMax: 0.05, cooldown: 24, duracao: 8,
    condicoes: (s) => s.mes >= 6,
    modificadores: [],
    severidade: SEV,
    efeito: (s, sev) => { s.modCusto += porSev(sev, 0.1, 0.2, 0.3); },
    escolhas: [{ id: "absorver", custo: 0 }, { id: "renegociar_fornecedores", custo: 300, aplica: (s, a) => { a.fator = 0.6; } }],
    caixa: "Inflação dos custos" },

  { id: "comprador_visita", categoria: "mercado", tipo: "sorteio", pBase: 0.05, pMax: 0.12, cooldown: 8, duracao: 1, crise: false,
    condicoes: (s) => s.mes >= 4,
    modificadores: [{ se: (s) => s.reputacao > 60, valor: 0.6 }, { se: (s) => s.reputacao < 30, valor: -0.5 }],
    severidade: { media: 1 },
    escolhas: [{ id: "recusar", custo: 0 },
      { id: "aceitar", custo: 0, aplica: (s) => { agendarEvento(s, "preco_sobe", s.mes + 1, "media", "encadeado"); } }],
    caixa: "Comprador de fora visitou a fazenda" },

  { id: "cooperativa", categoria: "mercado", tipo: "sorteio", pBase: 0.03, pMax: 0.08, cooldown: 24, duracao: 1, crise: false,
    condicoes: (s) => s.mes >= 6 && !s.cooperativa,
    modificadores: [],
    severidade: { media: 1 },
    escolhas: [{ id: "recusar", custo: 0 }, { id: "entrar", custo: 500, aplica: (s) => { s.cooperativa = true; } }],
    caixa: "Proposta para entrar numa cooperativa" },

  { id: "festa_colheita", categoria: "social", tipo: "sorteio", pBase: 0.35, pMax: 0.5, cooldown: 12, duracao: 1, crise: false,
    condicoes: (s) => s.estacao === "outono",
    modificadores: [],
    severidade: { media: 1 },
    escolhas: [{ id: "ignorar", custo: 0, aplica: (s) => { s.moral = limita(s.moral - 3, 0, 100); } },
      { id: "patrocinar", custo: 400, aplica: (s) => { s.moral = limita(s.moral + 10, 0, 100); s.reputacao = limita(s.reputacao + 3, 0, 100); } }],
    caixa: "Festa da colheita" },

  { id: "chegada_migrantes", categoria: "social", tipo: "sorteio", pBase: 0.03, pMax: 0.12, cooldown: 8, duracao: 1, crise: false,
    condicoes: (s) => s.mes >= 4,
    modificadores: [{ se: (s) => s.salarioRel >= 1, valor: 1.0 }, { se: (s) => s.moradiaFornecida, valor: 0.5 }, { se: (s) => s.moral > 70, valor: 0.5 }],
    severidade: { media: 1 },
    aoDisparar: (s) => { s.trabalhadores += 1; },
    escolhas: [{ id: "deixar_por_conta", custo: 0 }, { id: "acolher", custo: 300, aplica: (s) => { s.trabalhadores += 2; } }],
    caixa: "Migrantes chegaram ao vilarejo" },

  { id: "disputa_terra", categoria: "social", tipo: "sorteio", pBase: 0.04, pMax: 0.1, cooldown: 12, duracao: 6,
    condicoes: (s) => s.mes >= 4,
    modificadores: [{ se: (s) => s.reputacao < 30, valor: 0.5 }],
    severidade: { media: 1 },
    efeito: (s) => { s.modProducao += -0.04; },
    escolhas: [{ id: "absorver", custo: 0 },
      { id: "acordo_amigavel", custo: 400, aplica: (s, a) => { a.fator = 0; } },
      { id: "ir_a_justica", custo: 1200, aplica: (s, a) => { a.fator = 0.5; if (sortear(s) < 0.5) alterarCaixa(s, 2000, "Indenização judicial em disputa de terra", "social"); else s.reputacao = limita(s.reputacao - 3, 0, 100); } }],
    caixa: "Vizinho contesta os limites da terra" },

  { id: "roubo_colheita", categoria: "social", tipo: "sorteio", pBase: 0.04, pMax: 0.1, cooldown: 6, duracao: 1, sevInicial: 12,
    condicoes: (s) => s.mes >= 2,
    modificadores: [{ se: (s) => s.seguro, valor: -0.3 }, { se: (s) => s.vigilancia, valor: -0.5 }],
    severidade: SEV,
    aoDisparar: (s, sev) => { alterarCaixa(s, -porSev(sev, 300, 800, 2000), "Roubo de café do armazém", "social"); },
    escolhas: [{ id: "absorver", custo: 0 }, { id: "contratar_vigia", custo: 300, aplica: (s) => { s.vigilancia = true; } }],
    caixa: "Roubo de café do armazém" },

  { id: "fiscalizacao", categoria: "governo", tipo: "sorteio", pBase: 0.04, pMax: 0.12, cooldown: 12, duracao: 1,
    condicoes: (s) => s.mes >= 6,
    modificadores: [{ se: (s) => s.salarioRel < 1, valor: 0.8 }, { se: (s) => s.obrigacaoPrograma, valor: 0.5 }],
    severidade: { media: 1 },
    aviso: { meses: 1, precisao: 0.4, falsoAlarme: 0.005, texto: "Um carro oficial foi visto rondando as fazendas vizinhas." },
    aoDisparar: (s) => { alterarCaixa(s, -(s.salarioRel < 1 ? 900 : 200), "Auto de infração trabalhista", "governo"); },
    escolhas: [{ id: "pagar_multa", custo: 0 },
      { id: "regularizar_salarios", custo: 500, aplica: (s) => { s.salarioRel = Math.max(s.salarioRel, 1.0); s.moral = limita(s.moral + 5, 0, 100); alterarCaixa(s, 400, "Desconto na multa por regularização salarial imediata", "governo"); } }],
    caixa: "Fiscalização trabalhista" },

  { id: "programa_governo", categoria: "governo", tipo: "sorteio", pBase: 0.03, pMax: 0.08, cooldown: 18, duracao: 1, crise: false,
    condicoes: (s) => s.mes >= 6 && !s.obrigacaoPrograma,
    modificadores: [{ se: (s) => s.reputacao > 60, valor: 0.5 }],
    severidade: { media: 1 },
    escolhas: [{ id: "recusar", custo: 0 },
      { id: "aderir", custo: 200, aplica: (s) => { alterarCaixa(s, 1500, "Subvenção de programa governamental", "governo"); s.reputacao = limita(s.reputacao + 2, 0, 100); s.obrigacaoPrograma = true; s.mesesObrigacaoPrograma = 12; } }],
    caixa: "Programa de incentivo do governo" },

  // --- EVENTOS NARRATIVOS EMERGENTES DO VILAREJO ---

  // 1. ECONÔMICOS
  {
    id: "desemprego_elevado",
    titulo: "Crise de Desemprego e Retração da Renda",
    caixa: "Crise de Desemprego e Retração da Renda",
    categoria: "economico",
    tipo: "limiar",
    gravidade: "grave",
    cooldown: 8,
    duracao: 3,
    descricao: "O número de trabalhadores desocupados cresceu no vilarejo. Comerciantes relatam queda sensível no movimento e famílias buscam amparo na assistência social.",
    causa: "Taxa de desemprego superou 12%, reduzindo a renda familiar e o consumo na comunidade.",
    condicoes: (s) => (s.desemprego ?? 0) > 12 && s.mes >= 2,
    condicoesEncerramento: (s) => (s.desemprego ?? 0) <= 8,
    efeito: (s) => { s.moral = limita(s.moral - 4, 0, 100); },
    escolhas: [
      {
        id: "frente_trabalho",
        titulo: "Frente de Trabalho Municipal",
        custo: 2500,
        origemCaixa: "treasury",
        descricao: "Abre vagas temporárias de manutenção e limpeza urbana, garantindo renda às famílias.",
        cancelaEncadeados: ["retracao_consumo"],
        aplica: (s) => { s.moral = limita(s.moral + 8, 0, 100); s.desemprego = Math.max(2, (s.desemprego || 12) - 5); }
      },
      {
        id: "subsidio_empresas",
        titulo: "Crédito e Estímulo à Contratação",
        custo: 1200,
        origemCaixa: "treasury",
        descricao: "Apoia oficinas e comércio para reter funcionários.",
        cancelaEncadeados: ["retracao_consumo"],
        aplica: (s) => { s.moral = limita(s.moral + 4, 0, 100); s.desemprego = Math.max(2, (s.desemprego || 12) - 3); }
      },
      {
        id: "aguardar_mercado",
        titulo: "Aguardar Ajuste do Mercado",
        custo: 0,
        descricao: "Preserva o caixa público, mas a renda permanecerá reprimida.",
        encadeia: [{ id: "retracao_consumo", emMeses: 2 }]
      }
    ],
    encadeia: [{ id: "retracao_consumo", emMeses: 2, severidade: ["grave", "media"] }]
  },

  {
    id: "carestia_alimentos",
    titulo: "Carestia da Cesta Básica",
    caixa: "Carestia da Cesta Básica",
    categoria: "economico",
    tipo: "limiar",
    gravidade: "media",
    cooldown: 8,
    duracao: 3,
    descricao: "O custo dos alimentos essenciais subiu acentuadamente no comércio local, pesando no orçamento doméstico das famílias assalariadas.",
    causa: "Preço da cesta básica aumentou devido a pressões de frete ou escassez relativa de suprimentos.",
    condicoes: (s) => ((s.precoCesta ?? 25) > 32 || (s.escassezMercado ?? 0) > 0.5) && s.mes >= 3,
    condicoesEncerramento: (s) => (s.precoCesta ?? 25) <= 26 && (s.escassezMercado ?? 0) <= 0.1,
    efeito: (s) => { s.moral = limita(s.moral - 4, 0, 100); },
    escolhas: [
      {
        id: "subsidio_alimentar",
        titulo: "Subsídio Alimentar Emergencial",
        custo: 1500,
        origemCaixa: "treasury",
        descricao: "Compensa parte do preço dos alimentos no comércio para conter a inflação local.",
        cancelaEncadeados: ["pressao_trabalhadores"],
        aplica: (s) => { s.moral = limita(s.moral + 7, 0, 100); s.precoCesta = Math.max(22, (s.precoCesta || 32) - 6); }
      },
      {
        id: "compras_locais",
        titulo: "Aquisição Direta dos Produtores",
        custo: 800,
        origemCaixa: "treasury",
        descricao: "Adquire alimentos direto dos sítios locais para abastecer a comunidade sem atravessadores.",
        aplica: (s) => { s.moral = limita(s.moral + 4, 0, 100); }
      },
      {
        id: "deixar_precos",
        titulo: "Livre Formação de Preços",
        custo: 0,
        descricao: "Não gasta recursos do Tesouro, mas corre o risco de mobilização popular.",
        encadeia: [{ id: "pressao_trabalhadores", emMeses: 2 }]
      }
    ],
    encadeia: [{ id: "pressao_trabalhadores", emMeses: 2, severidade: ["media", "grave"] }]
  },

  {
    id: "queda_arrecadacao",
    titulo: "Queda na Arrecadação Tributária",
    caixa: "Queda na Arrecadação Tributária",
    categoria: "economico",
    tipo: "limiar",
    gravidade: "grave",
    cooldown: 8,
    duracao: 2,
    descricao: "O Secretário da Fazenda adverte que o recolhimento de impostos caiu e o Tesouro opera com saldo restrito, ameaçando despesas programadas.",
    causa: "Retração das transações locais gerou arrecadação abaixo do custeio administrativo e operacional.",
    condicoes: (s) => (s.caixaTesouro ?? 10000) < 3000 && (s.resultadoFiscal ?? 0) < 0 && s.mes >= 3,
    condicoesEncerramento: (s) => (s.caixaTesouro ?? 10000) >= 5000 && (s.resultadoFiscal ?? 0) >= 0,
    efeito: (s) => { s.reputacao = limita(s.reputacao - 5, 0, 100); },
    escolhas: [
      {
        id: "contingenciamento",
        titulo: "Contingenciamento de Gastos",
        custo: 0,
        descricao: "Congela despesas não essenciais para equilibrar as contas, com leve queixa dos servidores.",
        cancelaEncadeados: ["impasse_camara"],
        aplica: (s) => { s.reputacao = limita(s.reputacao + 3, 0, 100); alterarCaixa(s, 1000, "Economia por contingenciamento orçamentário", "governo", "treasury"); }
      },
      {
        id: "cobranca_ativa",
        titulo: "Força-Tarefa de Cobrança Fiscal",
        custo: 400,
        origemCaixa: "treasury",
        descricao: "Notifica contribuintes em atraso e regulariza certidões pendentes.",
        cancelaEncadeados: ["impasse_camara"],
        aplica: (s) => { alterarCaixa(s, 1800, "Recuperação de créditos tributários", "governo", "treasury"); }
      },
      {
        id: "usar_reserva",
        titulo: "Consumir Fundo de Reserva",
        custo: 0,
        descricao: "Evita cortes imediatos, mas mantém as contas públicas vulneráveis.",
        encadeia: [{ id: "impasse_camara", emMeses: 2 }]
      }
    ],
    encadeia: [{ id: "impasse_camara", emMeses: 2, severidade: ["grave"] }]
  },

  {
    id: "retracao_consumo",
    titulo: "Retração nas Vendas do Comércio",
    caixa: "Retração nas Vendas do Comércio",
    categoria: "economico",
    tipo: "limiar",
    gravidade: "media",
    cooldown: 8,
    duracao: 3,
    descricao: "Comerciantes locais relatam mercadorias encalhadas e prateleiras cheias. O faturamento caiu e os proprietários cogitam dispensar ajudantes.",
    causa: "A baixa liquidez familiar e o desemprego contraíram o consumo interno de bens e serviços.",
    condicoes: (s) => ((s.desemprego ?? 0) > 10 || (s.estoqueMercado ?? 30) > 60) && s.mes >= 3,
    condicoesEncerramento: (s) => (s.desemprego ?? 0) <= 6 && (s.estoqueMercado ?? 30) <= 40,
    efeito: (s) => { s.moral = limita(s.moral - 3, 0, 100); },
    escolhas: [
      {
        id: "vale_compras",
        titulo: "Programa de Vale-Alimentação Local",
        custo: 1600,
        origemCaixa: "treasury",
        descricao: "Injeta poder de compra direto nas famílias para gastar exclusivamente no comércio da cidade.",
        aplica: (s) => { s.moral = limita(s.moral + 6, 0, 100); }
      },
      {
        id: "feira_livre",
        titulo: "Organizar Feira Promocional na Praça",
        custo: 300,
        origemCaixa: "treasury",
        descricao: "Apoia divulgação e estandes para que os comerciantes desovem os estoques.",
        aplica: (s) => { s.moral = limita(s.moral + 3, 0, 100); }
      },
      {
        id: "absorver",
        titulo: "Deixar o Comércio Liquidar",
        custo: 0,
        descricao: "O comércio terá de baixar suas margens por conta própria."
      }
    ]
  },

  {
    id: "investidor_industrial",
    titulo: "Proposta de Investimento Industrial",
    caixa: "Proposta de Investimento Industrial",
    categoria: "economico",
    tipo: "sorteio",
    pBase: 0.05,
    pMax: 0.15,
    cooldown: 12,
    duracao: 2,
    crise: false,
    descricao: "Um grupo de empresários de café torrado e beneficiamento visitou o vilarejo com plano de erguer uma unidade fabril e contratar trabalhadores locais.",
    causa: "A estabilidade macroeconômica e a capacidade produtiva da cidade chamaram atenção de capitais externos.",
    condicoes: (s) => (s.pib ?? 50000) > 40000 && (s.caixaTesouro ?? 10000) > 6000 && s.mes >= 4,
    severidade: { media: 1 },
    escolhas: [
      {
        id: "incentivo_infra",
        titulo: "Conceder Apoio e Lote Industrial",
        custo: 2800,
        origemCaixa: "treasury",
        descricao: "Prepara terraplanagem e acesso viário. Gera novos empregos e dinamismo em cadeia.",
        encadeia: [{ id: "chegada_novas_familias", emMeses: 2 }],
        aplica: (s) => { s.reputacao = limita(s.reputacao + 8, 0, 100); s.moral = limita(s.moral + 6, 0, 100); }
      },
      {
        id: "contrapartidas",
        titulo: "Exigir Formação de Mão de Obra Local",
        custo: 800,
        origemCaixa: "treasury",
        descricao: "Apoia o projeto mediante garantia de capacitação e contratação prioritária de moradores locais.",
        aplica: (s) => { s.reputacao = limita(s.reputacao + 5, 0, 100); s.moral = limita(s.moral + 8, 0, 100); }
      },
      {
        id: "recusar_incentivo",
        titulo: "Recusar Incentivo Público",
        custo: 0,
        descricao: "Preserva o caixa do Tesouro integralmente; o investidor avaliará outras regiões."
      }
    ]
  },

  // 2. SOCIAIS
  {
    id: "sobrecarga_saude",
    titulo: "Fila e Sobrecarga no Posto de Saúde",
    caixa: "Fila e Sobrecarga no Posto de Saúde",
    categoria: "social",
    tipo: "limiar",
    gravidade: "media",
    cooldown: 8,
    duracao: 3,
    descricao: "Moradores relatam demora nos agendamentos e falta de insumos básicos na unidade médica do vilarejo após aumento nos atendimentos clínicos.",
    causa: "O crescimento da população e a demanda por atendimento superaram a capacidade da equipe de saúde.",
    condicoes: (s) => ((s.qualidadeSaude ?? 60) < 50 || (s.populacao ?? 20) > 30) && s.mes >= 3,
    condicoesEncerramento: (s) => (s.qualidadeSaude ?? 60) >= 65,
    efeito: (s) => { s.moral = limita(s.moral - 4, 0, 100); },
    escolhas: [
      {
        id: "mutirao_saude",
        titulo: "Contratar Plantão Médico Extra",
        custo: 1800,
        origemCaixa: "treasury",
        descricao: "Reforça o atendimento com profissionais temporários e medicamentos essenciais.",
        cancelaEncadeados: ["pressao_popular"],
        aplica: (s) => { s.moral = limita(s.moral + 8, 0, 100); s.qualidadeSaude = limita((s.qualidadeSaude || 50) + 12, 0, 100); }
      },
      {
        id: "reorganizar_atendimento",
        titulo: "Otimizar Triagem e Prevenção",
        custo: 400,
        origemCaixa: "treasury",
        descricao: "Agentes comunitários organizam visitas domiciliares para desafogar a unidade.",
        aplica: (s) => { s.moral = limita(s.moral + 3, 0, 100); s.qualidadeSaude = limita((s.qualidadeSaude || 50) + 5, 0, 100); }
      },
      {
        id: "absorver",
        titulo: "Manter Estrutura Atual",
        custo: 0,
        descricao: "Não amplia despesas, mas a insatisfação popular com a saúde persistirá.",
        encadeia: [{ id: "pressao_popular", emMeses: 2 }]
      }
    ],
    encadeia: [{ id: "pressao_popular", emMeses: 2, severidade: ["media"] }]
  },

  {
    id: "deficit_habitacional_critico",
    titulo: "Déficit Habitacional e Aluguéis Pressionados",
    caixa: "Déficit Habitacional e Aluguéis Pressionados",
    categoria: "social",
    tipo: "limiar",
    gravidade: "grave",
    cooldown: 8,
    duracao: 3,
    descricao: "Com a chegada de novos moradores, a ocupação das moradias atingiu 100%. Famílias dividem quartos e os preços dos aluguéis subiram.",
    causa: "A população total ultrapassou a capacidade habitacional formal instalada no município.",
    condicoes: (s) => (s.populacao ?? 20) >= (s.capacidadeMoradia ?? 20) && s.mes >= 3,
    condicoesEncerramento: (s) => (s.populacao ?? 20) < (s.capacidadeMoradia ?? 20),
    efeito: (s) => { s.moral = limita(s.moral - 5, 0, 100); },
    escolhas: [
      {
        id: "obra_habitacional",
        titulo: "Edificar Novas Unidades Populares",
        custo: 3200,
        origemCaixa: "treasury",
        descricao: "Financia a construção de novos módulos residenciais pelo setor de obras públicas.",
        cancelaEncadeados: ["protesto_popular"],
        aplica: (s) => { s.capacidadeMoradia = (s.capacidadeMoradia || 20) + 4; s.moral = limita(s.moral + 10, 0, 100); }
      },
      {
        id: "cooperativa_habitacao",
        titulo: "Apoiar Mutirão Comunitário",
        custo: 1400,
        origemCaixa: "treasury",
        descricao: "Fornece tijolos e madeiras para famílias ampliarem suas casas.",
        aplica: (s) => { s.capacidadeMoradia = (s.capacidadeMoradia || 20) + 2; s.moral = limita(s.moral + 5, 0, 100); }
      },
      {
        id: "absorver",
        titulo: "Deixar Construção Particular",
        custo: 0,
        descricao: "Depende exclusivamente da iniciativa imobiliária privada.",
        encadeia: [{ id: "protesto_popular", emMeses: 2 }]
      }
    ],
    encadeia: [{ id: "protesto_popular", emMeses: 2, severidade: ["grave"] }]
  },

  {
    id: "alerta_seguranca",
    titulo: "Insegurança e Desordem Noturna",
    caixa: "Insegurança e Desordem Noturna",
    categoria: "social",
    tipo: "limiar",
    gravidade: "media",
    cooldown: 8,
    duracao: 3,
    descricao: "Comerciantes e moradores da praça reclamam de pequenos furtos e falta de patrulhamento durante a noite nos pontos ermos da cidade.",
    causa: "Indicador de segurança em queda por falta de vigilância e expansão das vias urbanas sem iluminação.",
    condicoes: (s) => (s.qualidadeSeguranca ?? 60) < 50 && s.mes >= 3,
    condicoesEncerramento: (s) => (s.qualidadeSeguranca ?? 60) >= 65,
    efeito: (s) => { s.reputacao = limita(s.reputacao - 4, 0, 100); },
    escolhas: [
      {
        id: "reforco_patrulha",
        titulo: "Instituir Guarda Municipal Noturna",
        custo: 1500,
        origemCaixa: "treasury",
        descricao: "Contrata agentes municipais e instala iluminação nas esquinas escuras.",
        aplica: (s) => { s.qualidadeSeguranca = limita((s.qualidadeSeguranca || 50) + 15, 0, 100); s.moral = limita(s.moral + 6, 0, 100); }
      },
      {
        id: "iluminacao_praca",
        titulo: "Instalar Postes de Luz na Praça",
        custo: 600,
        origemCaixa: "treasury",
        descricao: "Melhora a visibilidade e inibe ocorrências nos pontos centrais.",
        aplica: (s) => { s.qualidadeSeguranca = limita((s.qualidadeSeguranca || 50) + 6, 0, 100); s.moral = limita(s.moral + 3, 0, 100); }
      },
      {
        id: "absorver",
        titulo: "Orientar Cuidado aos Moradores",
        custo: 0,
        descricao: "Sem custo financeiro, mas o receio público permanece."
      }
    ]
  },

  {
    id: "desigualdade_social",
    titulo: "Tensão por Disparidade Social",
    caixa: "Tensão por Disparidade Social",
    categoria: "social",
    tipo: "limiar",
    gravidade: "media",
    cooldown: 8,
    duracao: 3,
    descricao: "Enquanto donos de fazendas e estabelecimentos celebram lucros, trabalhadores comissionados expressam frustração com o contraste de renda.",
    causa: "Concentração do crescimento econômico nas margens de lucro sem repasse correspondente aos salários.",
    condicoes: (s) => (s.indiceGini ?? 35) > 45 && s.mes >= 4,
    condicoesEncerramento: (s) => (s.indiceGini ?? 35) <= 38,
    efeito: (s) => { s.moral = limita(s.moral - 4, 0, 100); },
    escolhas: [
      {
        id: "abono_social",
        titulo: "Criar Programa de Amparo Comunitário",
        custo: 1800,
        origemCaixa: "treasury",
        descricao: "Aporte financeiro direto para famílias de menor renda do vilarejo.",
        aplica: (s) => { s.moral = limita(s.moral + 9, 0, 100); s.indiceGini = Math.max(25, (s.indiceGini || 45) - 6); }
      },
      {
        id: "capacitacao_oficinas",
        titulo: "Cursos de Ofícios e Artesanato",
        custo: 700,
        origemCaixa: "treasury",
        descricao: "Capacita jovens para ocupações mais produtivas e de maior remuneração.",
        aplica: (s) => { s.moral = limita(s.moral + 4, 0, 100); }
      },
      {
        id: "absorver",
        titulo: "Manter Mercado Vigente",
        custo: 0,
        descricao: "Não interfere na distribuição natural de renda da economia."
      }
    ]
  },

  // 3. POLÍTICOS
  {
    id: "baixa_popularidade",
    titulo: "Crise de Popularidade do Governo",
    caixa: "Crise de Popularidade do Governo",
    categoria: "politico",
    tipo: "limiar",
    gravidade: "grave",
    cooldown: 8,
    duracao: 3,
    descricao: "A aprovação do governo municipal caiu a níveis críticos. Conversas na praça e artigos no jornal apontam insatisfação generalizada.",
    causa: "A aprovação média da população caiu abaixo de 40% devido à soma de queixas e carências acumuladas.",
    condicoes: (s) => (s.moral ?? 50) < 40 && s.mes >= 3,
    condicoesEncerramento: (s) => (s.moral ?? 50) >= 55,
    efeito: (s) => { s.reputacao = limita(s.reputacao - 6, 0, 100); },
    escolhas: [
      {
        id: "pacote_obras",
        titulo: "Anunciar Pacote Emergencial de Ações",
        custo: 2400,
        origemCaixa: "treasury",
        descricao: "Investe visivelmente em reformas urbanas, praça e melhorias rápidas no vilarejo.",
        cancelaEncadeados: ["protesto_popular"],
        aplica: (s) => { s.moral = limita(s.moral + 12, 0, 100); s.reputacao = limita(s.reputacao + 8, 0, 100); }
      },
      {
        id: "audiencia_publica",
        titulo: "Convocar Conferência com a População",
        custo: 400,
        origemCaixa: "treasury",
        descricao: "Abre o gabinete para ouvir os moradores e priorizar reivindicações urgentes.",
        aplica: (s) => { s.moral = limita(s.moral + 5, 0, 100); s.reputacao = limita(s.reputacao + 4, 0, 100); }
      },
      {
        id: "ignorar",
        titulo: "Manter Rumos Administrativos",
        custo: 0,
        descricao: "Ignora o clamor das ruas, arriscando protestos e paralisia política.",
        encadeia: [{ id: "protesto_popular", emMeses: 2 }]
      }
    ],
    encadeia: [{ id: "protesto_popular", emMeses: 2, severidade: ["grave"] }]
  },

  {
    id: "pressao_produtores",
    titulo: "Pressão dos Produtores Rurais",
    caixa: "Pressão dos Produtores Rurais",
    categoria: "politico",
    tipo: "limiar",
    gravidade: "media",
    cooldown: 8,
    duracao: 2,
    descricao: "Sitiantes e cafeicultores reuniram-se na Cooperativa para protestar contra as más condições das estradas vicinais e as taxas municipais.",
    causa: "Produtores agrícolas alegam que os custos de frete e tributos estão reduzindo a rentabilidade do campo.",
    condicoes: (s) => (s.mesesSemManutencao >= 6 || (s.apoioCamara ?? 65) < 50) && s.mes >= 4,
    condicoesEncerramento: (s) => s.mesesSemManutencao === 0 && (s.apoioCamara ?? 65) >= 60,
    efeito: (s) => { s.reputacao = limita(s.reputacao - 4, 0, 100); },
    escolhas: [
      {
        id: "recapeamento_vicinais",
        titulo: "Manutenção Emergencial de Estradas Rurais",
        custo: 1800,
        origemCaixa: "treasury",
        descricao: "Desloca maquinário para recuperar estradas e facilitar o escoamento da safra.",
        aplica: (s) => { s.mesesSemManutencao = 0; s.reputacao = limita(s.reputacao + 6, 0, 100); s.apoioCamara = limita((s.apoioCamara || 65) + 8, 0, 100); }
      },
      {
        id: "desconto_taxa_rural",
        titulo: "Alívio Temporário de Taxa Rural",
        custo: 600,
        origemCaixa: "treasury",
        descricao: "Concede moratória de 60 dias nas tarifas públicas do campo.",
        aplica: (s) => { s.apoioCamara = limita((s.apoioCamara || 65) + 4, 0, 100); }
      },
      {
        id: "manter_firme",
        titulo: "Manter Cronograma Vigente",
        custo: 0,
        descricao: "Exige cumprimento das obrigações fiscais sem concessões imediatas."
      }
    ]
  },

  {
    id: "pressao_trabalhadores",
    titulo: "Mobilização Trabalhista por Reajuste",
    caixa: "Mobilização Trabalhista por Reajuste",
    categoria: "politico",
    tipo: "limiar",
    gravidade: "media",
    cooldown: 8,
    duracao: 2,
    descricao: "Trabalhadores rurais e urbanos realizaram assembleia cobrando recomposição salarial frente à alta dos alimentos e moradia.",
    causa: "Relação do salário com a economia externa ou custo de vida caiu significativamente.",
    condicoes: (s) => ((s.salarioRel ?? 0.9) < 0.85 || s.mesesMoralBaixa >= 1) && s.mes >= 3,
    condicoesEncerramento: (s) => (s.salarioRel ?? 0.9) >= 1.0,
    efeito: (s) => { s.moral = limita(s.moral - 5, 0, 100); },
    escolhas: [
      {
        id: "reajuste_piso",
        titulo: "Aprovar Reposição do Piso Salarial",
        custo: 1200,
        origemCaixa: "treasury",
        descricao: "Reajusta o padrão salarial municipal, elevando o moral da mão de obra.",
        cancelaEncadeados: ["protesto_popular"],
        aplica: (s) => { s.salarioRel = Math.max(s.salarioRel || 0.9, 1.0); s.moral = limita(s.moral + 10, 0, 100); }
      },
      {
        id: "cesta_auxilio",
        titulo: "Distribuir Cesta de Alimentos",
        custo: 700,
        origemCaixa: "treasury",
        descricao: "Fornece complemento alimentar direto sem onerar a folha salarial permanente.",
        aplica: (s) => { s.moral = limita(s.moral + 5, 0, 100); }
      },
      {
        id: "resistir",
        titulo: "Negar Reivindicações",
        custo: 0,
        descricao: "Contém gastos imediatos, mas acirra o descontentamento coletivo.",
        encadeia: [{ id: "protesto_popular", emMeses: 2 }]
      }
    ],
    encadeia: [{ id: "protesto_popular", emMeses: 2, severidade: ["grave"] }]
  },

  {
    id: "impasse_camara",
    titulo: "Impasse Político na Câmara Municipal",
    caixa: "Impasse Político na Câmara Municipal",
    categoria: "politico",
    tipo: "limiar",
    gravidade: "grave",
    cooldown: 8,
    duracao: 3,
    descricao: "Vereadores da oposição articulam um bloco majoritário e ameaçam rejeitar os projetos de lei orçamentários do Executivo.",
    causa: "Apoio da base legislativa caiu abaixo de 45%, fragilizando a governabilidade.",
    condicoes: (s) => (s.apoioCamara ?? 65) < 45 && s.mes >= 4,
    condicoesEncerramento: (s) => (s.apoioCamara ?? 65) >= 55,
    efeito: (s) => { s.reputacao = limita(s.reputacao - 5, 0, 100); },
    escolhas: [
      {
        id: "emendas_vereadores",
        titulo: "Negociar Emendas e Obras nos Bairros",
        custo: 2000,
        origemCaixa: "treasury",
        descricao: "Atende demandas dos vereadores com recursos para obras comunitárias, recompondo a base.",
        cancelaEncadeados: ["protesto_popular"],
        aplica: (s) => { s.apoioCamara = limita((s.apoioCamara || 40) + 20, 0, 100); s.reputacao = limita(s.reputacao + 5, 0, 100); }
      },
      {
        id: "acordo_republicano",
        titulo: "Firmar Acordo de Metas Públicas",
        custo: 0,
        descricao: "Apresenta plano transparente aos líderes partidários para aprovar pautas prioritárias.",
        aplica: (s) => { s.apoioCamara = limita((s.apoioCamara || 40) + 8, 0, 100); }
      },
      {
        id: "confronto",
        titulo: "Denunciar Corporativismo Parlamentar",
        custo: 0,
        descricao: "Apela à opinião pública contra as exigências dos edis, aumentando a polarização.",
        aplica: (s) => { s.apoioCamara = Math.max(10, (s.apoioCamara || 40) - 10); s.moral = limita(s.moral + 3, 0, 100); }
      }
    ]
  },

  {
    id: "protesto_popular",
    titulo: "Manifestação Popular na Praça Central",
    caixa: "Manifestação Popular na Praça Central",
    categoria: "politico",
    tipo: "limiar",
    gravidade: "grave",
    cooldown: 10,
    duracao: 2,
    descricao: "Moradores e trabalhadores se reuniram com faixas e apitos em frente à sede da Prefeitura exigindo soluções imediatas para a cidade.",
    causa: "Acúmulo de queixas sem resposta (saúde precária, carestia, desemprego ou baixa popularidade).",
    condicoes: (s) => (s.moral ?? 50) < 32 && s.mes >= 3,
    condicoesEncerramento: (s) => (s.moral ?? 50) >= 50,
    efeito: (s) => { s.moral = limita(s.moral - 8, 0, 100); s.reputacao = limita(s.reputacao - 8, 0, 100); },
    escolhas: [
      {
        id: "atender_pauta",
        titulo: "Assinar Termo de Compromisso e Aporte",
        custo: 2500,
        origemCaixa: "treasury",
        descricao: "Recebe a comissão comunitária e destina recursos imediatos para as prioridades das ruas.",
        aplica: (s) => { s.moral = limita(s.moral + 15, 0, 100); s.reputacao = limita(s.reputacao + 10, 0, 100); }
      },
      {
        id: "discurso_conciliador",
        titulo: "Diálogo Aberto e Cronograma de Reformas",
        custo: 300,
        origemCaixa: "treasury",
        descricao: "Conversa diretamente com a multidão e assume prazos claros de entrega.",
        aplica: (s) => { s.moral = limita(s.moral + 8, 0, 100); }
      },
      {
        id: "repressao",
        titulo: "Dispersar a Concentração",
        custo: 0,
        descricao: "Usa a força pública para desobstruir a via, desgastando severamente a imagem cívica.",
        aplica: (s) => { s.moral = Math.max(10, s.moral - 10); s.reputacao = Math.max(10, s.reputacao - 12); }
      }
    ]
  },

  // 4. POSITIVOS E CONQUISTAS
  {
    id: "superavit_recorde",
    titulo: "Superávit Fiscal Histórico",
    caixa: "Superávit Fiscal Histórico",
    categoria: "positivo",
    tipo: "limiar",
    gravidade: "media",
    cooldown: 8,
    duracao: 2,
    crise: false,
    descricao: "Com as contas em alta e a economia local pujante, o Tesouro Municipal atingiu saldo financeiro recorde neste mês.",
    causa: "A arrecadação contínua e a gestão equilibrada superaram com folga as despesas programadas.",
    condicoes: (s) => (s.caixaTesouro ?? 10000) > 15000 && (s.resultadoFiscal ?? 0) > 400 && s.mes >= 3,
    condicoesEncerramento: (s) => (s.caixaTesouro ?? 10000) < 10000,
    escolhas: [
      {
        id: "fundo_soberano",
        titulo: "Criar Fundo de Reserva Municipal",
        custo: 3000,
        origemCaixa: "treasury",
        descricao: "Reserva parte do excedente para proteger o município contra futuras oscilações climáticas ou de preços.",
        aplica: (s) => { s.reputacao = limita(s.reputacao + 6, 0, 100); s.sorte = limita(s.sorte + 0.1, 0.5, 1.25); }
      },
      {
        id: "antecipar_obras",
        titulo: "Antecipar Obras de Infraestrutura",
        custo: 4000,
        origemCaixa: "treasury",
        descricao: "Acelera construções e reformas públicas para gerar novas vagas de trabalho e modernizar a cidade.",
        aplica: (s) => { s.moral = limita(s.moral + 8, 0, 100); s.reputacao = limita(s.reputacao + 8, 0, 100); }
      },
      {
        id: "alivio_tributario",
        titulo: "Conceder Alívio Tributário Temporário",
        custo: 1000,
        origemCaixa: "treasury",
        descricao: "Devolve poder de compra às famílias e estabelecimentos por meio de isenções parciais.",
        aplica: (s) => { s.moral = limita(s.moral + 10, 0, 100); }
      }
    ]
  },

  {
    id: "safra_ouro",
    titulo: "Safra de Ouro e Reconhecimento Agrícola",
    caixa: "Safra de Ouro e Reconhecimento Agrícola",
    categoria: "positivo",
    tipo: "sorteio",
    pBase: 0.06,
    pMax: 0.15,
    cooldown: 12,
    duracao: 3,
    crise: false,
    descricao: "A combinação de clima favorável, manejo exemplar e dedicação dos colonos rendeu grãos de café de qualidade excepcional e safra abundante.",
    causa: "Excelente produtividade no campo acompanhada de preços firmes no mercado comprador.",
    condicoes: (s) => (s.estacao === "outono" || s.estacao === "seca") && s.modProducao >= 0 && (s.trabalhadores ?? 10) >= 8 && s.mes >= 4,
    severidade: { media: 1 },
    efeito: (s) => { s.modPreco += 0.15; s.modProducao += 0.15; },
    escolhas: [
      {
        id: "bonificacao_trabalhadores",
        titulo: "Distribuir Bônus de Produtividade",
        custo: 1200,
        origemCaixa: "farm",
        descricao: "Recompensa os colhedores e famílias rurais pelo esforço extraordinário na colheita.",
        aplica: (s) => { s.moral = limita(s.moral + 12, 0, 100); s.reputacao = limita(s.reputacao + 5, 0, 100); }
      },
      {
        id: "expandir_armazenagem",
        titulo: "Reinvestir na Modernização do Silo",
        custo: 1800,
        origemCaixa: "farm",
        descricao: "Aumenta a capacidade de estocagem para valorizar ainda mais os grãos no mercado.",
        aplica: (s) => { s.reputacao = limita(s.reputacao + 6, 0, 100); }
      },
      {
        id: "capitalizar",
        titulo: "Reter Recursos em Caixa",
        custo: 0,
        descricao: "Preserva a liquidez conquistada pela safra nos cofres da fazenda."
      }
    ]
  },

  {
    id: "pleno_emprego",
    titulo: "Vilarejo em Pleno Emprego",
    caixa: "Vilarejo em Pleno Emprego",
    categoria: "positivo",
    tipo: "limiar",
    gravidade: "media",
    cooldown: 8,
    duracao: 3,
    crise: false,
    descricao: "Praticamente todos os adultos aptos ao trabalho no município estão ocupados em lavouras, oficinas e comércio. A praça celebra o dinamismo econômico.",
    causa: "Taxa de desemprego caiu abaixo de 4% com forte demanda por mão de obra em todos os setores.",
    condicoes: (s) => (s.desemprego ?? 10) < 4 && (s.pib ?? 50000) > 30000 && s.mes >= 4,
    condicoesEncerramento: (s) => (s.desemprego ?? 10) >= 7,
    efeito: (s) => { s.moral = limita(s.moral + 6, 0, 100); },
    escolhas: [
      {
        id: "capacitacao_avancada",
        titulo: "Incentivo a Escolas Técnicas",
        custo: 1500,
        origemCaixa: "treasury",
        descricao: "Capacita a mão de obra para funções de maior valor agregado e produtividade.",
        aplica: (s) => { s.reputacao = limita(s.reputacao + 8, 0, 100); s.qualidadeEducacao = limita((s.qualidadeEducacao || 60) + 10, 0, 100); }
      },
      {
        id: "festa_trabalhador",
        titulo: "Festa Cívica do Trabalho",
        custo: 500,
        origemCaixa: "treasury",
        descricao: "Celebração comunitária em homenagem às famílias e trabalhadores do vilarejo.",
        aplica: (s) => { s.moral = limita(s.moral + 8, 0, 100); }
      },
      {
        id: "aproveitar_momento",
        titulo: "Manter o Ciclo Espontâneo",
        custo: 0,
        descricao: "Deixa a economia usufruir naturalmente da alta atividade."
      }
    ]
  },

  {
    id: "reconhecimento_servicos",
    titulo: "Referência Regional em Serviços Públicos",
    caixa: "Referência Regional em Serviços Públicos",
    categoria: "positivo",
    tipo: "limiar",
    gravidade: "leve",
    cooldown: 8,
    duracao: 3,
    crise: false,
    descricao: "Autoridades de municípios vizinhos e a imprensa regional elogiam a qualidade da saúde e educação do Vilarejo, destacando a eficiência da gestão pública.",
    causa: "Indicadores de qualidade de vida nos serviços públicos ultrapassaram 75 pontos.",
    condicoes: (s) => ((s.qualidadeSaude ?? 60) >= 75 || (s.qualidadeEducacao ?? 60) >= 75) && s.mes >= 4,
    condicoesEncerramento: (s) => (s.qualidadeSaude ?? 60) < 65 && (s.qualidadeEducacao ?? 60) < 65,
    efeito: (s) => { s.reputacao = limita(s.reputacao + 6, 0, 100); s.moral = limita(s.moral + 5, 0, 100); },
    escolhas: [
      {
        id: "intercambio_regional",
        titulo: "Liderar Consórcio Intermunicipal",
        custo: 1000,
        origemCaixa: "treasury",
        descricao: "Atrai repasses e cooperação regional para reforçar ainda mais a infraestrutura.",
        aplica: (s) => { s.reputacao = limita(s.reputacao + 10, 0, 100); alterarCaixa(s, 2000, "Aporte por convênio intermunicipal", "governo", "treasury"); }
      },
      {
        id: "ampliar_bolsas",
        titulo: "Expandir Bolsas e Material Escolar",
        custo: 600,
        origemCaixa: "treasury",
        descricao: "Garante materiais e uniformes de qualidade a todos os estudantes locais.",
        aplica: (s) => { s.moral = limita(s.moral + 6, 0, 100); }
      },
      {
        id: "apenas_comemorar",
        titulo: "Registrar Marco nos Anais Municipais",
        custo: 0,
        descricao: "Sem despesas orçamentárias; fortalece o orgulho cívico dos munícipes."
      }
    ]
  },

  {
    id: "chegada_novas_familias",
    titulo: "Atração de Famílias Empreendedoras",
    caixa: "Atração de Famílias Empreendedoras",
    categoria: "positivo",
    tipo: "sorteio",
    pBase: 0.05,
    pMax: 0.15,
    cooldown: 10,
    duracao: 2,
    crise: false,
    descricao: "A boa reputação da cidade, a estabilidade das contas e o ambiente de trabalho acolhedor atraíram famílias experientes em artesanato, mecânica e lavoura.",
    causa: "Elevada reputação municipal aliada a vagas abertas na economia e qualidade de vida.",
    condicoes: (s) => (s.reputacao ?? 50) > 65 && (s.moral ?? 50) > 60 && (s.desemprego ?? 10) < 8 && s.mes >= 4,
    severidade: { media: 1 },
    aoDisparar: (s) => { s.trabalhadores = (s.trabalhadores || 10) + 2; s.populacao = (s.populacao || 20) + 4; },
    escolhas: [
      {
        id: "acolhimento_cidadao",
        titulo: "Plano de Integração e Apoio à Fixação",
        custo: 800,
        origemCaixa: "treasury",
        descricao: "Facilita a regularização de novos lotes e acesso aos serviços essenciais para as novas famílias.",
        aplica: (s) => { s.moral = limita(s.moral + 6, 0, 100); s.reputacao = limita(s.reputacao + 4, 0, 100); }
      },
      {
        id: "deixar_instalacao",
        titulo: "Instalação por Conta Própria",
        custo: 0,
        descricao: "As novas famílias se estabelecem com seus próprios recursos e economias."
      }
    ]
  }
];

function probabilidade(ev, s) {
  const pb = ev.pAnual ? ev.pAnual / 12 : ev.pBase;
  const pMax = ev.pMax ?? pb * 3;
  const mods = (ev.modificadores ?? []).reduce((t, m) => t + (m.se(s) ? m.valor : 0), 0);
  const fatorCiclo = ev.crise === false ? Math.max(1.0, s.sorte) : s.sorte;
  return limita(pb * (1 + mods) * fatorCiclo, 0, pMax);
}

function sorteiaSeveridade(tabela, s) {
  let r = sortear(s), acc = 0;
  for (const [nome, peso] of Object.entries(tabela)) { acc += peso; if (r < acc) return nome; }
  return Object.keys(tabela)[0];
}

function condicaoValidaNoMes(ev, s, mesAlvo) {
  if (!ev.condicoes) return true;
  if (mesAlvo === s.mes) return Boolean(ev.condicoes(s));
  const estadoSimulado = Object.assign({}, s, { mes: mesAlvo, estacao: estacaoDo(mesAlvo) });
  return Boolean(ev.condicoes(estadoSimulado));
}

function agendarEvento(s, id, mes, sev = "media", origem = "encadeado") {
  if (s.agendados.some((a) => a.id === id)) return false;
  s.agendados.push({ id, mes, sev, origem });
  return true;
}

function podeDisparar(ev, s, limiteAtivos, ignoraCondicoes = false) {
  return !s.cooldowns[ev.id]
    && !s.ativos.some((a) => a.id === ev.id)
    && (ev.global || s.ativos.filter((a) => !achar(a.id).global).length < limiteAtivos)
    && (ignoraCondicoes || !ev.condicoes || Boolean(ev.condicoes(s)));
}

function aplicaEfeito(ev, a, s) {
  const m0 = s.modProducao, p0 = s.modPreco, c0 = s.modCusto;
  ev.efeito?.(s, a.sev);
  s.modProducao = m0 + (s.modProducao - m0) * a.fator;
  s.modPreco = p0 + (s.modPreco - p0) * a.fator;
  s.modCusto = c0 + (s.modCusto - c0) * a.fator;
}

function recalcularModificadores(s) {
  s.modProducao = 0; s.modPreco = 0; s.modCusto = 0;
  for (const a of s.ativos) {
    const ev = achar(a.id);
    if (ev) aplicaEfeito(ev, a, s);
  }
  s.modProducao = limita(s.modProducao, -0.85, 1.0);
  s.modPreco = limita(s.modPreco, -0.70, 1.0);
  s.modCusto = limita(s.modCusto, -0.50, 1.5);
}

function calcularFluxoMensalAutonomo(s) {
  const f = s.trabalhadores / 10;
  return 1800 * f * (1 + s.modProducao) * (1 + s.modPreco) - 1200 * f * s.salarioRel * (1 + s.modCusto);
}

function disparar(ev, s, sev = "media") {
  if (ev.sevInicial && s.mes <= ev.sevInicial) sev = "leve";
  const a = { id: ev.id, sev, mesesRestantes: ev.duracao ?? 1, fator: 1, respondido: false };
  s.ativos.push(a);
  s.cooldowns[ev.id] = ev.cooldown ?? 6;
  recalcularModificadores(s);
  ev.aoDisparar?.(s, sev);
  s.moral = limita(s.moral, 0, 100);
  s.reputacao = limita(s.reputacao, 0, 100);
  if (ev.crise !== false) s.criseMes = true;
  const rotulo = ev.titulo || ev.caixa || ev.id;
  s.log.push(`Mês ${s.mes}: ${rotulo} (${sev})`);
  for (const c of ev.encadeia ?? []) {
    if (!c.severidade || c.severidade.includes(sev)) agendarEvento(s, c.id, s.mes + (c.emMeses || 1), c.sev || sev, "encadeado");
  }
}

function emiteSinais(s) {
  const sinais = garantirSinaisAtivos(s);
  for (const ev of EVENTOS) (ev.sinais ?? []).forEach((sn, i) => {
    const chave = `${ev.id}#${i}`;
    if (sn.se(s)) {
      if (!sinais.has(chave)) { sinais.add(chave); s.log.push(`Mês ${s.mes} · SINAL: ${sn.texto}`); }
    } else sinais.delete(chave);
  });
}

function processarMes(s, limiteAtivos = 2, opcoes = {}) {
  garantirSinaisAtivos(s);
  s.mes++; s.estacao = estacaoDo(s.mes); s.criseMes = false;
  s.mesesSemManutencao++;

  if (s.contrato && typeof s.contrato.mesesRestantes === "number" && --s.contrato.mesesRestantes <= 0) {
    s.contrato = null;
    s.reputacao = limita(s.reputacao + 3, 0, 100);
    s.log.push(`Mês ${s.mes}: Contrato de fornecimento concluído com sucesso`);
  }
  if (s.obrigacaoPrograma && typeof s.mesesObrigacaoPrograma === "number" && --s.mesesObrigacaoPrograma <= 0) {
    s.obrigacaoPrograma = false;
  }

  if (!s.modoIntegrado) s.moral = limita(s.moral + (s.salarioRel >= 1 ? 1 : -3), 0, 100);
  s.mesesMoralBaixa = s.moral < 30 ? s.mesesMoralBaixa + 1 : 0;
  for (const k in s.cooldowns) if (--s.cooldowns[k] <= 0) delete s.cooldowns[k];

  s.ativos = s.ativos.filter((a) => {
    const ev = achar(a.id);
    if (ev?.condicoesEncerramento && ev.condicoesEncerramento(s)) {
      s.log.push(`Mês ${s.mes}: ${ev.titulo || ev.caixa} encerrado antecipadamente por normalização das condições`);
      return false;
    }
    return --a.mesesRestantes > 0;
  });
  recalcularModificadores(s);
  emiteSinais(s);

  for (const ev of EVENTOS.filter((e) => e.tipo === "limiar"))
    if (podeDisparar(ev, s, limiteAtivos)) disparar(ev, s);

  const vencidos = s.agendados.filter((a) => a.mes <= s.mes);
  const futuros = s.agendados.filter((a) => a.mes > s.mes);
  const adiados = [];
  for (const a of vencidos) {
    const ev = achar(a.id);
    if (!ev) continue;
    const ehEncadeado = a.origem === "encadeado" || ev.tipo === "encadeado";
    if (!ehEncadeado && ev.condicoes && !ev.condicoes(s)) continue;
    if (podeDisparar(ev, s, limiteAtivos + 1, true)) {
      disparar(ev, s, a.sev ?? "media");
    } else if (!s.ativos.some((x) => x.id === ev.id) && !s.cooldowns[ev.id]) {
      adiados.push({ ...a, mes: s.mes + 1 });
    }
  }
  s.agendados = futuros.concat(adiados);

  const sorteios = EVENTOS.filter((e) => e.tipo === "sorteio").sort(() => sortear(s) - 0.5);
  for (const ev of sorteios) {
    if (!podeDisparar(ev, s, limiteAtivos) || s.agendados.some((a) => a.id === ev.id)) continue;
    if (sortear(s) < probabilidade(ev, s)) {
      const sev = sorteiaSeveridade(ev.severidade ?? { media: 1 }, s);
      const mesAlvoAviso = ev.aviso ? s.mes + ev.aviso.meses : s.mes;
      if (ev.aviso && condicaoValidaNoMes(ev, s, mesAlvoAviso) && sortear(s) < ev.aviso.precisao) {
        agendarEvento(s, ev.id, mesAlvoAviso, sev, "aviso");
        s.log.push(`Mês ${s.mes} · AVISO: ${ev.aviso.texto}`);
        s.stats.avisosReais++;
      } else {
        if (ev.aviso) s.stats.surpresas++;
        disparar(ev, s, sev);
      }
    } else if (ev.aviso && sortear(s) < ev.aviso.falsoAlarme) {
      s.log.push(`Mês ${s.mes} · AVISO: ${ev.aviso.texto}`);
      s.stats.alarmesFalsos++;
    }
  }

  recalcularModificadores(s);

  const temCriseAtiva = s.ativos.some((a) => achar(a.id)?.crise !== false);
  const tetoSorte = temCriseAtiva ? 1.0 : 1.15;
  const deltaSorte = s.criseMes ? -0.15 : (temCriseAtiva ? 0.02 : 0.05);
  s.sorte = limita(s.sorte + deltaSorte, 0.5, tetoSorte);

  if (!s.modoIntegrado && opcoes.calcularEconomia !== false) {
    const fluxo = calcularFluxoMensalAutonomo(s);
    s.caixa += fluxo;
    s._ultimoFluxoMes = s.mes;
    s._ultimoFluxoValor = fluxo;
  }
}

function responder(s, idEvento, idEscolha) {
  const ev = achar(idEvento);
  const a = s.ativos.find((x) => x.id === idEvento);
  const esc = ev?.escolhas?.find((c) => c.id === idEscolha);
  if (!a || a.respondido || !esc) return false;

  const custo = Number(esc.custo) || 0;
  const ehTesouro = esc.origemCaixa === "treasury";
  const saldoDisponivel = ehTesouro ? (s.caixaTesouro ?? s.caixa) : s.caixa;
  if (saldoDisponivel < custo) return false;

  a.respondido = true;
  if (custo > 0) {
    alterarCaixa(s, -custo, `Escolha "${esc.titulo || idEscolha}" em ${ev.titulo || ev.caixa}`, ev.categoria, ehTesouro ? "treasury" : "farm");
  }

  if (Array.isArray(esc.cancelaEncadeados)) {
    for (const cancelId of esc.cancelaEncadeados) {
      cancelarAgendado(s, cancelId);
    }
  }
  if (Array.isArray(esc.encadeia)) {
    for (const c of esc.encadeia) {
      agendarEvento(s, c.id, s.mes + (c.emMeses || 1), c.sev || a.sev || "media", "encadeado");
    }
  }

  esc.aplica?.(s, a);
  s.moral = limita(s.moral, 0, 100);
  s.reputacao = limita(s.reputacao, 0, 100);
  recalcularModificadores(s);

  if (!s.modoIntegrado && s._ultimoFluxoMes === s.mes) {
    const novoFluxo = calcularFluxoMensalAutonomo(s);
    s.caixa += (novoFluxo - s._ultimoFluxoValor);
    s._ultimoFluxoValor = novoFluxo;
  }

  if (!Array.isArray(s.decisoesTomadas)) s.decisoesTomadas = [];
  const rotuloCusto = custo > 0 ? ` (custo ${ehTesouro ? "Tesouro R$" : "R$"} ${custo})` : " (sem custo)";
  const detalheStr = `${esc.titulo || idEscolha}${rotuloCusto}`;
  s.decisoesTomadas.push({
    mes: s.mes,
    idEvento,
    idEscolha,
    eventoId: idEvento,
    escolhaId: idEscolha,
    tituloEvento: ev.titulo || ev.caixa || idEvento,
    tituloEscolha: esc.titulo || esc.title || idEscolha,
    custo,
    origemCaixa: ehTesouro ? "treasury" : "farm",
    detalhe: detalheStr
  });

  s.log.push(`Mês ${s.mes}: escolha "${esc.titulo || idEscolha}" em ${ev.titulo || ev.caixa}${rotuloCusto}`);
  return true;
}

function novoEstado(opcoes = {}) {
  const estado = {
    semente: opcoes.semente ?? sementeGlobal,
    modoIntegrado: Boolean(opcoes.modoIntegrado),
    mes: 0, estacao: "chuvosa", caixa: 10000, moral: 50, reputacao: 50, sorte: 1.0,
    trabalhadores: 10, salarioRel: 0.9,
    irrigacao: false, reservaAgua: false, protecaoGeada: false, manejoPragas: false,
    seguro: false, manutencaoPreventiva: false, moradiaFornecida: false, contrato: null,
    drenagem: false, vigilancia: false, cooperativa: false, obrigacaoPrograma: false,
    mesesObrigacaoPrograma: 0, geadaNativaAtiva: false,
    modProducao: 0, modPreco: 0, modCusto: 0, mesesMoralBaixa: 0, mesesSemManutencao: 0, criseMes: false,
    _ultimoFluxoMes: -1, _ultimoFluxoValor: 0,
    desemprego: 6, caixaTesouro: 10000, populacao: 20, capacidadeMoradia: 22, deficitHabitacional: 0,
    precoCesta: 25, escassezMercado: 0, estoqueMercado: 30, pib: 50000, resultadoFiscal: 500,
    arrecadacao: 3000, apoioCamara: 65, qualidadeSaude: 60, qualidadeEducacao: 60, qualidadeSeguranca: 60,
    indiceGini: 35, empresasAtivas: 3, decisoesTomadas: [],
    ativos: [], agendados: [], cooldowns: {}, sinaisAtivos: [], log: [],
    stats: { avisosReais: 0, alarmesFalsos: 0, surpresas: 0 },
  };
  garantirSinaisAtivos(estado);
  return estado;
}

function salvarEstado(s) {
  return JSON.stringify(Object.assign({}, s, {
    sinaisAtivos: Array.from(s.sinaisAtivos || []),
    decisoesTomadas: Array.isArray(s.decisoesTomadas) ? s.decisoesTomadas : [],
    onTransacao: undefined
  }));
}

function carregarEstado(jsonOuObj, onTransacao = null) {
  const dados = typeof jsonOuObj === "string" ? JSON.parse(jsonOuObj) : JSON.parse(JSON.stringify(jsonOuObj));
  garantirSinaisAtivos(dados);
  if (!Array.isArray(dados.decisoesTomadas)) dados.decisoesTomadas = [];
  if (onTransacao) dados.onTransacao = onTransacao;
  return dados;
}

function sincronizarComVilarejo(S, s, helpers = {}) {
  s.modoIntegrado = true;
  const contaFazenda = S.owner === "state" ? "stateFarm" : "privateFarm";
  s.caixa = helpers.balance ? helpers.balance(contaFazenda) : (S.accounts?.[contaFazenda] || 0);
  s.caixaTesouro = helpers.balance ? helpers.balance("treasury") : (S.accounts?.treasury || 0);
  s.moral = limita(Math.round(helpers.approval ? helpers.approval() : 55), 0, 100);
  s.reputacao = limita(Math.round(S.reputation ?? s.moral), 0, 100);
  s.trabalhadores = Math.max(1, helpers.employed ? helpers.employed() : 6);
  s.salarioRel = Number((S.wage / Math.max(1, S.externalWage || 2200)).toFixed(2));
  s.protecaoGeada = Boolean(S.weatherProtection);
  s.seguro = Boolean(S.weatherProtection);
  s.geadaNativaAtiva = Boolean(S.weatherDecisionDone || S.weatherEventDone);
  s.moradiaFornecida = S.policy?.housing === "employer" || S.policy?.housing === "state";

  const ls = typeof helpers.getLaborStats === "function" ? helpers.getLaborStats() : (typeof getLaborStats === "function" ? getLaborStats() : null);
  s.desemprego = ls ? Number(ls.unemploymentRate) : (s.desemprego ?? 6);
  s.populacao = typeof helpers.population === "function" ? helpers.population() : (typeof population === "function" ? population() : (s.populacao ?? 20));
  s.capacidadeMoradia = S.housingCapacity || (s.capacidadeMoradia ?? 20);
  s.deficitHabitacional = Math.max(0, s.populacao - s.capacidadeMoradia);
  s.precoCesta = S.marketPrice || (s.precoCesta ?? 25);
  s.escassezMercado = S.lastShortageUnits || 0;
  s.estoqueMercado = S.marketStock || 0;
  s.pib = S.lastNationalAccounts?.gdp || (s.pib ?? 50000);
  s.resultadoFiscal = S.lastFiscalReport?.primaryResult ?? S.lastFiscalReport?.nominalResult ?? (s.resultadoFiscal ?? 500);
  s.arrecadacao = S.lastFiscalReport?.taxRevenue ?? (s.arrecadacao ?? 3000);
  s.apoioCamara = S.councilSupport ?? (s.apoioCamara ?? 65);
  s.qualidadeSaude = S.healthQol ?? (s.qualidadeSaude ?? 60);
  s.qualidadeEducacao = S.educationQol ?? (s.qualidadeEducacao ?? 60);
  s.qualidadeSeguranca = S.securityQol ?? (s.qualidadeSeguranca ?? 60);
  s.indiceGini = S.giniIndex ?? (s.indiceGini ?? 35);
  s.empresasAtivas = (S.firms || []).filter(f => f.status === "active").length;

  s.onTransacao = (delta, motivo, categoria, conta) => {
    if (!helpers.log) return;
    const ehTesouro = conta === "treasury";
    const fAcc = ehTesouro ? "treasury" : (S.owner === "state" ? "stateFarm" : "privateFarm");
    if (delta > 0) {
      helpers.log("external", fAcc, delta, `Evento (${categoria}): ${motivo}`);
    } else if (delta < 0) {
      const destino = ehTesouro ? "workshop" : (categoria === "governo" ? "treasury" : (categoria === "infra" ? "workshop" : "external"));
      helpers.log(fAcc, destino, Math.abs(delta), `Evento (${categoria}): ${motivo}`);
    }
  };
  return s;
}

function aplicarNoVilarejo(S, s) {
  recalcularModificadores(s);
  S.eventMods = {
    producao: Number((1 + s.modProducao).toFixed(4)),
    preco: Number((1 + s.modPreco).toFixed(4)),
    custo: Number((1 + s.modCusto).toFixed(4))
  };
  if (s.salarioRel >= 1 && S.wage < S.externalWage && S.owner === "state") {
    S.policy.publicWage = Math.max(S.policy.publicWage, Math.round(S.externalWage));
  }
  if (typeof s.apoioCamara === "number") {
    S.councilSupport = limita(Math.round(s.apoioCamara), 10, 100);
  }
  if (typeof s.capacidadeMoradia === "number" && s.capacidadeMoradia > S.housingCapacity) {
    S.housingCapacity = s.capacidadeMoradia;
  }
  if (typeof s.qualidadeSaude === "number") S.healthQol = s.qualidadeSaude;
  if (typeof s.qualidadeEducacao === "number") S.educationQol = s.qualidadeEducacao;
  if (typeof s.qualidadeSeguranca === "number") S.securityQol = s.qualidadeSeguranca;
  return S.eventMods;
}

const EventosV3 = {
  EVENTOS, processarMes, responder, novoEstado, usarSemente,
  recalcularModificadores, salvarEstado, carregarEstado,
  sincronizarComVilarejo, aplicarNoVilarejo, agendarEvento, cancelarAgendado
};

if (typeof window !== "undefined") window.EventosV3 = EventosV3;
if (typeof module !== "undefined" && module.exports) module.exports = EventosV3;
