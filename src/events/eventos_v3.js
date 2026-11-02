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

function alterarCaixa(s, delta, motivo, categoria = "geral") {
  if (!delta) return;
  s.caixa += delta;
  if (typeof s.onTransacao === "function") s.onTransacao(delta, motivo, categoria);
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
  s.cooldowns[ev.id] = ev.cooldown;
  recalcularModificadores(s);
  ev.aoDisparar?.(s, sev);
  s.moral = limita(s.moral, 0, 100);
  s.reputacao = limita(s.reputacao, 0, 100);
  if (ev.crise !== false) s.criseMes = true;
  s.log.push(`Mês ${s.mes}: ${ev.caixa} (${sev})`);
  for (const c of ev.encadeia ?? []) {
    if (!c.severidade || c.severidade.includes(sev)) agendarEvento(s, c.id, s.mes + c.emMeses, sev, "encadeado");
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

  s.ativos = s.ativos.filter((a) => --a.mesesRestantes > 0);
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
  if (!a || a.respondido || !esc || s.caixa < esc.custo) return false;
  a.respondido = true;
  if (esc.custo > 0) alterarCaixa(s, -esc.custo, `Escolha "${idEscolha}" em ${ev.caixa}`, ev.categoria);
  esc.aplica?.(s, a);
  s.moral = limita(s.moral, 0, 100);
  s.reputacao = limita(s.reputacao, 0, 100);
  recalcularModificadores(s);

  if (!s.modoIntegrado && s._ultimoFluxoMes === s.mes) {
    const novoFluxo = calcularFluxoMensalAutonomo(s);
    s.caixa += (novoFluxo - s._ultimoFluxoValor);
    s._ultimoFluxoValor = novoFluxo;
  }

  s.log.push(`Mês ${s.mes}: escolha "${idEscolha}" em ${idEvento} (custo R$ ${esc.custo})`);
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
    ativos: [], agendados: [], cooldowns: {}, sinaisAtivos: [], log: [],
    stats: { avisosReais: 0, alarmesFalsos: 0, surpresas: 0 },
  };
  garantirSinaisAtivos(estado);
  return estado;
}

function salvarEstado(s) {
  return JSON.stringify(Object.assign({}, s, {
    sinaisAtivos: Array.from(s.sinaisAtivos || []),
    onTransacao: undefined
  }));
}

function carregarEstado(jsonOuObj, onTransacao = null) {
  const dados = typeof jsonOuObj === "string" ? JSON.parse(jsonOuObj) : JSON.parse(JSON.stringify(jsonOuObj));
  garantirSinaisAtivos(dados);
  if (onTransacao) dados.onTransacao = onTransacao;
  return dados;
}

function sincronizarComVilarejo(S, s, helpers = {}) {
  s.modoIntegrado = true;
  const contaFazenda = S.owner === "state" ? "stateFarm" : "privateFarm";
  s.caixa = helpers.balance ? helpers.balance(contaFazenda) : (S.accounts?.[contaFazenda] || 0);
  s.moral = limita(Math.round(helpers.approval ? helpers.approval() : 55), 0, 100);
  s.trabalhadores = Math.max(1, helpers.employed ? helpers.employed() : 6);
  s.salarioRel = Number((S.wage / Math.max(1, S.externalWage || 2200)).toFixed(2));
  s.protecaoGeada = Boolean(S.weatherProtection);
  s.seguro = Boolean(S.weatherProtection);
  s.geadaNativaAtiva = Boolean(S.weatherDecisionDone || S.weatherEventDone);
  s.moradiaFornecida = S.policy?.housing === "employer" || S.policy?.housing === "state";
  s.onTransacao = (delta, motivo, categoria) => {
    if (!helpers.log) return;
    const fAcc = S.owner === "state" ? "stateFarm" : "privateFarm";
    if (delta > 0) helpers.log("external", fAcc, delta, `Evento (${categoria}): ${motivo}`);
    else if (delta < 0) {
      const destino = categoria === "governo" ? "treasury" : (categoria === "infra" ? "workshop" : "external");
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
  return S.eventMods;
}

const EventosV3 = {
  EVENTOS, processarMes, responder, novoEstado, usarSemente,
  recalcularModificadores, salvarEstado, carregarEstado,
  sincronizarComVilarejo, aplicarNoVilarejo
};

if (typeof window !== "undefined") window.EventosV3 = EventosV3;
if (typeof module !== "undefined" && module.exports) module.exports = EventosV3;
