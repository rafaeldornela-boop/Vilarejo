(function attachVilarejoPolitics(root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.VilarejoPolitics = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createVilarejoPolitics(root) {
  "use strict";

  const VERSION = "1.0.0";
  const HISTORY_LIMIT = 36;
  const EVENT_LIMIT = 120;
  const CHANNELS = new Set([
    "economicPower",
    "organization",
    "cohesion",
    "mobilizationCapacity",
    "satisfaction"
  ]);

  // Parâmetros de cenário para iniciar a simulação. Não são dados empíricos.
  // A calibração poderá ser alterada por cenário sem mudar a lógica do módulo.
  const GROUP_DEFINITIONS = Object.freeze([
    {
      id: "workers", name: "Trabalhadores", description: "Pessoas que dependem principalmente do trabalho para obter renda.",
      economicPower: 32, organization: 48, cohesion: 62, mobilizationCapacity: 60,
      interests: ["emprego", "salários", "segurança do trabalho", "custo de vida"]
    },
    {
      id: "business", name: "Empresariado", description: "Proprietários e controladores de empresas privadas.",
      economicPower: 82, organization: 62, cohesion: 66, mobilizationCapacity: 50,
      interests: ["tributação", "crédito", "infraestrutura", "segurança jurídica"]
    },
    {
      id: "rural_producers", name: "Produtores rurais", description: "Agentes econômicos ligados à produção agropecuária.",
      economicPower: 56, organization: 48, cohesion: 58, mobilizationCapacity: 54,
      interests: ["preços agrícolas", "crédito produtivo", "logística", "recursos naturais"]
    },
    {
      id: "merchants", name: "Comerciantes", description: "Empresas e trabalhadores do comércio e da distribuição.",
      economicPower: 58, organization: 58, cohesion: 61, mobilizationCapacity: 54,
      interests: ["consumo", "segurança", "tributação", "infraestrutura"]
    },
    {
      id: "finance", name: "Setor financeiro", description: "Instituições e agentes que intermediam crédito, poupança e pagamentos.",
      economicPower: 90, organization: 72, cohesion: 76, mobilizationCapacity: 44,
      interests: ["estabilidade monetária", "crédito", "solidez fiscal", "regulação"]
    },
    {
      id: "public_servants", name: "Servidores públicos", description: "Pessoas empregadas diretamente pela administração estatal.",
      economicPower: 38, organization: 58, cohesion: 66, mobilizationCapacity: 52,
      interests: ["remuneração", "carreira", "serviços públicos", "condições de trabalho"]
    },
    {
      id: "landowners", name: "Proprietários de terras", description: "Agentes que detêm propriedades fundiárias e ativos imobiliários.",
      economicPower: 72, organization: 54, cohesion: 70, mobilizationCapacity: 40,
      interests: ["propriedade", "uso do solo", "tributação patrimonial", "infraestrutura"]
    },
    {
      id: "vulnerable", name: "População vulnerável", description: "Pessoas expostas a maior risco de pobreza e privação material.",
      economicPower: 8, organization: 22, cohesion: 42, mobilizationCapacity: 67,
      interests: ["renda", "moradia", "alimentação", "serviços essenciais"]
    },
    {
      id: "middle_class", name: "Classe média", description: "Famílias com posição intermediária na distribuição de renda e patrimônio.",
      economicPower: 55, organization: 40, cohesion: 50, mobilizationCapacity: 43,
      interests: ["poder de compra", "educação", "saúde", "tributação"]
    },
    {
      id: "environmentalists", name: "Ambientalistas", description: "Organizações e cidadãos mobilizados por objetivos ambientais.",
      economicPower: 20, organization: 48, cohesion: 67, mobilizationCapacity: 62,
      interests: ["conservação", "poluição", "uso da terra", "transição energética"]
    }
  ]);

  const POLITICAL_CHARACTERS_DATA = Object.freeze({
  "versao": "1.0",
  "jogo": "Vilarejo",
  "modulo": "grupos-de-interesse",
  "convencaoFoto": "/assets/personagens/<grupo>/<slug-nome>.jpg — caminho placeholder, arquivos de imagem não inclusos",
  "mecanicaEscolha": "Por grupo, o jogador contrata no máximo 1 personagem ativo por vez, pagando custoContratacao (saída única do Tesouro). Enquanto ativo, os bonus do personagem se aplicam a cada fechamento mensal. Trocar de representante dentro do mesmo grupo paga custoContratacao novamente. Se dois personagens ativos simultaneamente aparecem na lista conflitosCom um do outro, sugere-se penalidade de -3 a -5 pontos de aprovação por par em conflito, representando o atrito político entre eles.",
  "legendaBonus": {
    "produtividadeTrabalho": "pontos percentuais somados à produção potencial de café por trabalhador",
    "aprovacaoPopular": "pontos fixos somados à felicidade média das famílias a cada fechamento mensal",
    "protecaoSocialDividas": "pontos percentuais que reduzem o impacto negativo de dívida salarial ou de aluguel na aprovação",
    "custoCestaImportacao": "pontos percentuais de redução no custo de importação da cesta básica",
    "margemComercio": "pontos percentuais adicionais de margem/estoque do comércio por fechamento",
    "custoInsumosAgricolas": "pontos percentuais de redução no custo dos insumos agrícolas da fazenda",
    "produtividadeAgricola": "pontos percentuais somados à produção potencial de café antes do fator climático",
    "resilienciaClimatica": "valor somado ao fator climático (weatherFactor), que normalmente varia entre 0.65 e 1",
    "creditoRural": "pontos percentuais de redução no custo de capital/insumos da fazenda",
    "precoExportacao": "pontos percentuais somados ao preço de venda do café no mercado externo",
    "investimentoExterno": "valor em R$ injetado uma única vez no Tesouro ao contratar o personagem",
    "custoMigracao": "valor em R$ subtraído do custo único de migração",
    "taxaJurosCredito": "pontos percentuais de redução (ou aumento, se negativo) no custo de crédito",
    "valorizacaoImobiliaria": "pontos percentuais adicionais de valorização no setor imobiliário",
    "custoConstrucao": "pontos percentuais de redução no custo de construção de moradias",
    "sustentabilidadeProducao": "pontos percentuais adicionais de produção quando há baixo impacto ambiental",
    "segurancaPublica": "pontos percentuais de redução na probabilidade ou severidade de eventos negativos de ordem pública",
    "coesaoSocial": "pontos fixos de aprovação entre famílias, sobretudo as com filhos",
    "transparenciaGoverno": "pontos percentuais de redução na chance de eventos de escândalo ou crise de confiança"
  },
  "grupos": [
    {
      "id": "trabalhadores",
      "nome": "Trabalhadores",
      "interesses": "Emprego, salários, renda e proteção social"
    },
    {
      "id": "comerciantes",
      "nome": "Comerciantes",
      "interesses": "Crédito, consumo, abastecimento e margem de lucro"
    },
    {
      "id": "financeiro",
      "nome": "Setor financeiro",
      "interesses": "Liquidez, juros, segurança dos empréstimos e rentabilidade"
    },
    {
      "id": "proprietarios-urbanos",
      "nome": "Proprietários urbanos",
      "interesses": "Aluguéis, valorização imobiliária e mercado habitacional"
    },
    {
      "id": "proprietarios-rurais",
      "nome": "Proprietários rurais",
      "interesses": "Crédito agrícola, produção, terras e rentabilidade rural"
    },
    {
      "id": "parceiros-estrangeiros",
      "nome": "Parceiros estrangeiros",
      "interesses": "Investimentos, comércio exterior e cooperação econômica"
    },
    {
      "id": "ambientalistas",
      "nome": "Ambientalistas",
      "interesses": "Preservação ambiental, sustentabilidade e impacto da produção"
    },
    {
      "id": "seguranca",
      "nome": "Forças de segurança",
      "interesses": "Ordem pública, segurança e infraestrutura de proteção"
    },
    {
      "id": "clero",
      "nome": "Lideranças religiosas",
      "interesses": "Coesão social, assistência comunitária e valores tradicionais"
    },
    {
      "id": "imprensa",
      "nome": "Imprensa e opinião pública",
      "interesses": "Transparência, fiscalização e reputação do governo"
    }
  ],
  "personagens": [
    {
      "id": "trab01",
      "nome": "Vicente Almeida",
      "grupo": "trabalhadores",
      "foto": "/assets/personagens/trabalhadores/vicente-almeida.jpg",
      "influencia": 81,
      "custoContratacao": 5200,
      "personalidade": "Líder sindical histórico, direto e combativo; desconfia de proposta patronal sem contrapartida.",
      "falas": [
        "Salário atrasado não é imprevisto, é escolha de quem não paga.",
        "Trabalhador não pede esmola, pede o que já trabalhou para ganhar."
      ],
      "bonus": [
        {
          "tipo": "protecaoSocialDividas",
          "valor": 10
        },
        {
          "tipo": "aprovacaoPopular",
          "valor": 2
        }
      ],
      "conflitosCom": [
        "rur03"
      ]
    },
    {
      "id": "trab02",
      "nome": "Rosa Ferreira",
      "grupo": "trabalhadores",
      "foto": "/assets/personagens/trabalhadores/rosa-ferreira.jpg",
      "influencia": 58,
      "custoContratacao": 2800,
      "personalidade": "Trabalhadora rural de base, fala pouco mas é ouvida pelos colegas de lavoura; prática e conciliadora.",
      "falas": [
        "A gente quer trabalhar com dignidade, não é pedir muito.",
        "Prefiro conversa a greve, mas greve a gente faz se precisar."
      ],
      "bonus": [
        {
          "tipo": "produtividadeTrabalho",
          "valor": 5
        }
      ]
    },
    {
      "id": "trab03",
      "nome": "Edmilson Costa",
      "grupo": "trabalhadores",
      "foto": "/assets/personagens/trabalhadores/edmilson-costa.jpg",
      "influencia": 45,
      "custoContratacao": 2200,
      "personalidade": "Operário pragmático, foca em resultado e evita discurso inflamado; confia mais em planilha que em promessa.",
      "falas": [
        "Me mostra o número e eu confio no acordo.",
        "Produtividade alta também é vitória do trabalhador."
      ],
      "bonus": [
        {
          "tipo": "produtividadeTrabalho",
          "valor": 7
        }
      ]
    },
    {
      "id": "trab04",
      "nome": "Joana Pires",
      "grupo": "trabalhadores",
      "foto": "/assets/personagens/trabalhadores/joana-pires.jpg",
      "influencia": 39,
      "custoContratacao": 1900,
      "personalidade": "Trabalhadora informal, representa quem fica fora dos contratos formais; insiste em políticas que cheguem a todos.",
      "falas": [
        "Quem não tem carteira assinada também sente a inflação.",
        "Política boa é a que não esquece quem trabalha por fora."
      ],
      "bonus": [
        {
          "tipo": "custoCestaImportacao",
          "valor": 8
        }
      ]
    },
    {
      "id": "trab05",
      "nome": "Tadeu Nogueira",
      "grupo": "trabalhadores",
      "foto": "/assets/personagens/trabalhadores/tadeu-nogueira.jpg",
      "influencia": 36,
      "custoContratacao": 2100,
      "personalidade": "Jovem, usa redes sociais para mobilizar, impaciente com burocracia e com promessas antigas.",
      "falas": [
        "Se não postar, parece que não aconteceu — então eu posto.",
        "Geração nova não aceita esperar dez anos por melhoria."
      ],
      "bonus": [
        {
          "tipo": "aprovacaoPopular",
          "valor": 4
        }
      ]
    },
    {
      "id": "trab06",
      "nome": "Marlene Souza",
      "grupo": "trabalhadores",
      "foto": "/assets/personagens/trabalhadores/marlene-souza.jpg",
      "influencia": 52,
      "custoContratacao": 2600,
      "personalidade": "Aposentada, vigilante sobre benefícios e previdência; fala com autoridade de quem já viu promessa não cumprida.",
      "falas": [
        "Já ouvi esse discurso antes, moço, e sei como termina.",
        "Quem trabalhou a vida inteira merece segurança na velhice."
      ],
      "bonus": [
        {
          "tipo": "coesaoSocial",
          "valor": 3
        },
        {
          "tipo": "protecaoSocialDividas",
          "valor": 4
        }
      ]
    },
    {
      "id": "trab07",
      "nome": "Nilton Araújo",
      "grupo": "trabalhadores",
      "foto": "/assets/personagens/trabalhadores/nilton-araujo.jpg",
      "influencia": 61,
      "custoContratacao": 3400,
      "personalidade": "Trabalhador técnico qualificado, orgulhoso do ofício; defende capacitação como caminho de valorização.",
      "falas": [
        "Mão de obra qualificada rende mais e merece pagar mais.",
        "Invista em curso, não só em promessa de campanha."
      ],
      "bonus": [
        {
          "tipo": "produtividadeTrabalho",
          "valor": 9
        },
        {
          "tipo": "custoInsumosAgricolas",
          "valor": 3
        }
      ]
    },
    {
      "id": "com01",
      "nome": "Haroldo Benevides",
      "grupo": "comerciantes",
      "foto": "/assets/personagens/comerciantes/haroldo-benevides.jpg",
      "influencia": 64,
      "custoContratacao": 3100,
      "personalidade": "Dono do armazém mais antigo do vilarejo, tradicionalista, valoriza relação de confiança com fregueses antigos.",
      "falas": [
        "Negócio bom é o que o cliente volta, não o que engana uma vez.",
        "Prateleira cheia é o termômetro de um vilarejo tranquilo."
      ],
      "bonus": [
        {
          "tipo": "margemComercio",
          "valor": 6
        }
      ]
    },
    {
      "id": "com02",
      "nome": "Cristiane Lopes",
      "grupo": "comerciantes",
      "foto": "/assets/personagens/comerciantes/cristiane-lopes.jpg",
      "influencia": 48,
      "custoContratacao": 2400,
      "personalidade": "Comerciante jovem, aposta em vendas on-line e logística; impaciente com burocracia que atrasa entrega.",
      "falas": [
        "Cliente de hoje não espera o comércio se organizar sozinho.",
        "Quero menos imposto sobre venda, não mais discurso sobre venda."
      ],
      "bonus": [
        {
          "tipo": "margemComercio",
          "valor": 4
        },
        {
          "tipo": "custoCestaImportacao",
          "valor": 5
        }
      ]
    },
    {
      "id": "com03",
      "nome": "Sebastião Quintão",
      "grupo": "comerciantes",
      "foto": "/assets/personagens/comerciantes/sebastiao-quintao.jpg",
      "influencia": 70,
      "custoContratacao": 3900,
      "personalidade": "Atacadista que abastece boa parte do comércio local; negocia duro e pensa em volume, não em simpatia.",
      "falas": [
        "Eu não vendo favor, vendo carga — e carga tem preço.",
        "Abastecimento parado é vilarejo com prateleira vazia."
      ],
      "bonus": [
        {
          "tipo": "custoCestaImportacao",
          "valor": 10
        }
      ]
    },
    {
      "id": "com04",
      "nome": "Lúcia Marinho",
      "grupo": "comerciantes",
      "foto": "/assets/personagens/comerciantes/lucia-marinho.jpg",
      "influencia": 33,
      "custoContratacao": 1600,
      "personalidade": "Feirante pequena, simpática e próxima da população; fala pelo pequeno comerciante que vive do giro diário.",
      "falas": [
        "Eu vivo do troco do dia, imposto alto pesa direto no meu bolso.",
        "Feira é onde o vilarejo se conhece — vale mais do que parece."
      ],
      "bonus": [
        {
          "tipo": "aprovacaoPopular",
          "valor": 3
        }
      ]
    },
    {
      "id": "com05",
      "nome": "Otávio Ramalho",
      "grupo": "comerciantes",
      "foto": "/assets/personagens/comerciantes/otavio-ramalho.jpg",
      "influencia": 74,
      "custoContratacao": 4300,
      "personalidade": "Dono de rede de lojas, ambicioso, fala em expansão e escala; vê o vilarejo como mercado a conquistar.",
      "falas": [
        "Quem pensa pequeno, fica pequeno — eu penso em rede.",
        "Dou emprego, dou imposto, só peço espaço para crescer."
      ],
      "bonus": [
        {
          "tipo": "margemComercio",
          "valor": 9
        },
        {
          "tipo": "investimentoExterno",
          "valor": 4000
        }
      ],
      "conflitosCom": [
        "com04"
      ]
    },
    {
      "id": "com06",
      "nome": "Débora Castanho",
      "grupo": "comerciantes",
      "foto": "/assets/personagens/comerciantes/debora-castanho.jpg",
      "influencia": 55,
      "custoContratacao": 2900,
      "personalidade": "Fornece insumos agrícolas ao comércio local; ponte entre a fazenda e a prateleira, fala a língua dos dois lados.",
      "falas": [
        "Insumo caro na minha loja é lavoura atrasada na fazenda.",
        "Eu só lucro se o produtor plantar — nosso interesse é o mesmo."
      ],
      "bonus": [
        {
          "tipo": "custoInsumosAgricolas",
          "valor": 6
        }
      ]
    },
    {
      "id": "fin01",
      "nome": "Ricardo Valente",
      "grupo": "financeiro",
      "foto": "/assets/personagens/financeiro/ricardo-valente.jpg",
      "influencia": 83,
      "custoContratacao": 5600,
      "personalidade": "Gerente de banco regional, cauteloso, mede risco antes de qualquer promessa; fala em números, não em sentimento.",
      "falas": [
        "Crédito sem garantia não é generosidade, é imprudência.",
        "Juro reflete risco — baixe o risco e o juro acompanha."
      ],
      "bonus": [
        {
          "tipo": "taxaJurosCredito",
          "valor": 4
        }
      ]
    },
    {
      "id": "fin02",
      "nome": "Patrícia Albuquerque",
      "grupo": "financeiro",
      "foto": "/assets/personagens/financeiro/patricia-albuquerque.jpg",
      "influencia": 57,
      "custoContratacao": 3000,
      "personalidade": "Dirige cooperativa de crédito local, acredita em acesso facilitado para pequeno produtor e comerciante.",
      "falas": [
        "Cooperado que cresce faz a cooperativa crescer junto.",
        "Crédito bom é o que cabe no bolso de quem recebe."
      ],
      "bonus": [
        {
          "tipo": "taxaJurosCredito",
          "valor": 3
        },
        {
          "tipo": "creditoRural",
          "valor": 5
        }
      ]
    },
    {
      "id": "fin03",
      "nome": "Fábio Cerqueira",
      "grupo": "financeiro",
      "foto": "/assets/personagens/financeiro/fabio-cerqueira.jpg",
      "influencia": 41,
      "custoContratacao": 1800,
      "personalidade": "Opera crédito informal fora do sistema bancário; polêmico, mas resolve quando ninguém mais resolve.",
      "falas": [
        "Banco pede garantia que eu não peço — por isso me procuram.",
        "Juro alto? Risco alto. Simples assim."
      ],
      "bonus": [
        {
          "tipo": "taxaJurosCredito",
          "valor": -3
        },
        {
          "tipo": "investimentoExterno",
          "valor": 1500
        }
      ]
    },
    {
      "id": "fin04",
      "nome": "Helena Drummond",
      "grupo": "financeiro",
      "foto": "/assets/personagens/financeiro/helena-drummond.jpg",
      "influencia": 76,
      "custoContratacao": 6100,
      "personalidade": "Representa fundo de investimento externo, fala em rentabilidade e previsibilidade regulatória antes de comprometer capital.",
      "falas": [
        "Capital vai aonde tem regra clara e governo previsível.",
        "Rentabilidade sem estabilidade não me interessa."
      ],
      "bonus": [
        {
          "tipo": "investimentoExterno",
          "valor": 9000
        }
      ]
    },
    {
      "id": "fin05",
      "nome": "Mauro Spínola",
      "grupo": "financeiro",
      "foto": "/assets/personagens/financeiro/mauro-spinola.jpg",
      "influencia": 44,
      "custoContratacao": 2300,
      "personalidade": "Corretor de seguros rurais, discreto, defende proteção contra clima e safra perdida como investimento, não gasto.",
      "falas": [
        "Quem não segura a safra, segura o prejuízo sozinho.",
        "Seguro é o que separa um susto de uma falência."
      ],
      "bonus": [
        {
          "tipo": "resilienciaClimatica",
          "valor": 0.08
        }
      ]
    },
    {
      "id": "urb01",
      "nome": "Beatriz Monteiro",
      "grupo": "proprietarios-urbanos",
      "foto": "/assets/personagens/proprietarios-urbanos/beatriz-monteiro.jpg",
      "influencia": 79,
      "custoContratacao": 4800,
      "personalidade": "Maior proprietária de imóveis do vilarejo, elegante e firme; vê moradia como patrimônio a ser protegido.",
      "falas": [
        "Aluguel justo é o que cobre manutenção e ainda rende.",
        "Imóvel sem valorização é dinheiro parado — isso eu não aceito."
      ],
      "bonus": [
        {
          "tipo": "valorizacaoImobiliaria",
          "valor": 7
        }
      ]
    },
    {
      "id": "urb02",
      "nome": "Jorge Villela",
      "grupo": "proprietarios-urbanos",
      "foto": "/assets/personagens/proprietarios-urbanos/jorge-villela.jpg",
      "influencia": 52,
      "custoContratacao": 2700,
      "personalidade": "Construtor civil, prático, interessado em obra contínua; fala em prazo e material, não em discurso.",
      "falas": [
        "Obra parada é operário desempregado — isso eu sinto primeiro.",
        "Me dá previsibilidade de contrato e eu entrego moradia mais barata."
      ],
      "bonus": [
        {
          "tipo": "custoConstrucao",
          "valor": 8
        }
      ]
    },
    {
      "id": "urb03",
      "nome": "Lígia Prado",
      "grupo": "proprietarios-urbanos",
      "foto": "/assets/personagens/proprietarios-urbanos/ligia-prado.jpg",
      "influencia": 38,
      "custoContratacao": 1900,
      "personalidade": "Administra aluguéis para pequenos proprietários, mediadora, tenta equilibrar inquilino e dono sem favorecer nenhum lado.",
      "falas": [
        "Contrato claro evita briga depois — eu insisto nisso sempre.",
        "Inquilino satisfeito paga em dia; isso também é interesse do dono."
      ],
      "bonus": [
        {
          "tipo": "coesaoSocial",
          "valor": 2
        }
      ]
    },
    {
      "id": "urb04",
      "nome": "Aurélio Bastos",
      "grupo": "proprietarios-urbanos",
      "foto": "/assets/personagens/proprietarios-urbanos/aurelio-bastos.jpg",
      "influencia": 66,
      "custoContratacao": 3600,
      "personalidade": "Especulador imobiliário, ambicioso, compra na baixa e aposta em crescimento futuro do vilarejo.",
      "falas": [
        "Quem compra cedo é quem lucra quando o vilarejo crescer.",
        "Terreno parado hoje é fortuna amanhã — eu só adianto o relógio."
      ],
      "bonus": [
        {
          "tipo": "valorizacaoImobiliaria",
          "valor": 10
        }
      ],
      "conflitosCom": [
        "trab04",
        "imp04"
      ]
    },
    {
      "id": "urb05",
      "nome": "Cecília Nunes",
      "grupo": "proprietarios-urbanos",
      "foto": "/assets/personagens/proprietarios-urbanos/cecilia-nunes.jpg",
      "influencia": 29,
      "custoContratacao": 1400,
      "personalidade": "Pequena proprietária que vive do próprio aluguel recebido; modesta, preocupada com inadimplência, não com especulação.",
      "falas": [
        "Eu não tenho fortuna, tenho uma casa e um aluguel para viver.",
        "Inadimplência pra mim não é número, é mês sem comer direito."
      ],
      "bonus": [
        {
          "tipo": "protecaoSocialDividas",
          "valor": 3
        }
      ]
    },
    {
      "id": "rur01",
      "nome": "Geraldo Tavares",
      "grupo": "proprietarios-rurais",
      "foto": "/assets/personagens/proprietarios-rurais/geraldo-tavares.jpg",
      "influencia": 85,
      "custoContratacao": 5900,
      "personalidade": "Fazendeiro tradicional, cafeicultor de geração; fala com autoridade de quem conhece a terra e desconfia de mudança rápida.",
      "falas": [
        "Café bom se faz com paciência, não com planilha de cidade.",
        "Quem nunca perdeu safra para geada não sabe o que é risco."
      ],
      "bonus": [
        {
          "tipo": "produtividadeAgricola",
          "valor": 8
        }
      ]
    },
    {
      "id": "rur02",
      "nome": "Antônia Siqueira",
      "grupo": "proprietarios-rurais",
      "foto": "/assets/personagens/proprietarios-rurais/antonia-siqueira.jpg",
      "influencia": 60,
      "custoContratacao": 3300,
      "personalidade": "Defende cooperativismo entre produtores rurais, articuladora, acredita em força coletiva mais do que em fazenda isolada.",
      "falas": [
        "Produtor sozinho negocia fraco; produtor em cooperativa negocia forte.",
        "Dividir insumo e dividir risco é o que mantém o pequeno de pé."
      ],
      "bonus": [
        {
          "tipo": "custoInsumosAgricolas",
          "valor": 7
        },
        {
          "tipo": "creditoRural",
          "valor": 4
        }
      ]
    },
    {
      "id": "rur03",
      "nome": "Wellington Dutra",
      "grupo": "proprietarios-rurais",
      "foto": "/assets/personagens/proprietarios-rurais/wellington-dutra.jpg",
      "influencia": 88,
      "custoContratacao": 6400,
      "personalidade": "Grande latifundiário, influente e pouco flexível; vê qualquer imposto sobre a terra como ataque pessoal.",
      "falas": [
        "Terra produtiva sustenta esse vilarejo inteiro, lembrem disso.",
        "Imposto sobre lucro rural é imposto sobre quem ainda se arrisca a plantar."
      ],
      "bonus": [
        {
          "tipo": "produtividadeAgricola",
          "valor": 11
        }
      ],
      "conflitosCom": [
        "trab01",
        "amb01"
      ]
    },
    {
      "id": "rur04",
      "nome": "Rosana Peixoto",
      "grupo": "proprietarios-rurais",
      "foto": "/assets/personagens/proprietarios-rurais/rosana-peixoto.jpg",
      "influencia": 42,
      "custoContratacao": 2200,
      "personalidade": "Agricultura familiar, defende pequena propriedade e diversificação; desconfia de monocultura em larga escala.",
      "falas": [
        "Plantação pequena alimenta a família antes de alimentar a exportação.",
        "Diversificar é segurança — monocultura é aposta arriscada."
      ],
      "bonus": [
        {
          "tipo": "resilienciaClimatica",
          "valor": 0.05
        }
      ]
    },
    {
      "id": "rur05",
      "nome": "Benedito Xavier",
      "grupo": "proprietarios-rurais",
      "foto": "/assets/personagens/proprietarios-rurais/benedito-xavier.jpg",
      "influencia": 54,
      "custoContratacao": 2800,
      "personalidade": "Pecuarista que diversifica entre café e gado; pragmático, não aposta tudo em uma única cultura.",
      "falas": [
        "Quem só planta café reza para o clima o ano inteiro.",
        "Diversificação é o seguro que eu mesmo construo na minha terra."
      ],
      "bonus": [
        {
          "tipo": "produtividadeAgricola",
          "valor": 5
        },
        {
          "tipo": "resilienciaClimatica",
          "valor": 0.03
        }
      ]
    },
    {
      "id": "rur06",
      "nome": "Yara Monte Alegre",
      "grupo": "proprietarios-rurais",
      "foto": "/assets/personagens/proprietarios-rurais/yara-montealegre.jpg",
      "influencia": 47,
      "custoContratacao": 2600,
      "personalidade": "Jovem herdeira interessada em agrotecnologia, aposta em eficiência e dados contra o método tradicional da família.",
      "falas": [
        "Sensor de solo acerta mais que intuição de avô, com todo respeito.",
        "Tecnologia na lavoura não é luxo, é sobrevivência no mercado de hoje."
      ],
      "bonus": [
        {
          "tipo": "produtividadeAgricola",
          "valor": 6
        },
        {
          "tipo": "custoInsumosAgricolas",
          "valor": 4
        }
      ]
    },
    {
      "id": "ext01",
      "nome": "Henry Whitfield",
      "grupo": "parceiros-estrangeiros",
      "foto": "/assets/personagens/parceiros-estrangeiros/henry-whitfield.jpg",
      "influencia": 72,
      "custoContratacao": 4100,
      "personalidade": "Trader internacional de café, frio e calculista; fala em preço de mercado global e logística de exportação.",
      "falas": [
        "O mercado internacional não espera a safra local se decidir.",
        "Preço bom hoje pode não existir amanhã — eu fecho contrato agora."
      ],
      "bonus": [
        {
          "tipo": "precoExportacao",
          "valor": 6
        }
      ]
    },
    {
      "id": "ext02",
      "nome": "Ingrid Larsen",
      "grupo": "parceiros-estrangeiros",
      "foto": "/assets/personagens/parceiros-estrangeiros/ingrid-larsen.jpg",
      "influencia": 65,
      "custoContratacao": 4700,
      "personalidade": "Representa fundo de desenvolvimento estrangeiro, fala em sustentabilidade e governança como condição para aporte.",
      "falas": [
        "Nosso fundo exige transparência antes de qualquer cifra.",
        "Desenvolvimento que ignora o meio ambiente não recebe nosso aporte."
      ],
      "bonus": [
        {
          "tipo": "investimentoExterno",
          "valor": 7000
        },
        {
          "tipo": "sustentabilidadeProducao",
          "valor": 4
        }
      ]
    },
    {
      "id": "ext03",
      "nome": "Diego Fuentes",
      "grupo": "parceiros-estrangeiros",
      "foto": "/assets/personagens/parceiros-estrangeiros/diego-fuentes.jpg",
      "influencia": 51,
      "custoContratacao": 2900,
      "personalidade": "Articula câmara de comércio regional, facilita acordos comerciais na fronteira; diplomático e bem conectado.",
      "falas": [
        "Comércio de fronteira cresce com confiança, não com burocracia.",
        "Vilarejo que exporta bem é vilarejo que o vizinho respeita."
      ],
      "bonus": [
        {
          "tipo": "custoMigracao",
          "valor": 500
        },
        {
          "tipo": "precoExportacao",
          "valor": 3
        }
      ]
    },
    {
      "id": "ext04",
      "nome": "Akira Tanaka",
      "grupo": "parceiros-estrangeiros",
      "foto": "/assets/personagens/parceiros-estrangeiros/akira-tanaka.jpg",
      "influencia": 68,
      "custoContratacao": 3800,
      "personalidade": "Investidor industrial estrangeiro, metódico, avalia infraestrutura e mão de obra antes de qualquer promessa de aporte.",
      "falas": [
        "Decido por dado, não por discurso de autoridade local.",
        "Infraestrutura fraca afasta investimento mais do que imposto alto."
      ],
      "bonus": [
        {
          "tipo": "investimentoExterno",
          "valor": 6000
        }
      ]
    },
    {
      "id": "ext05",
      "nome": "Fátima Al-Rashid",
      "grupo": "parceiros-estrangeiros",
      "foto": "/assets/personagens/parceiros-estrangeiros/fatima-alrashid.jpg",
      "influencia": 46,
      "custoContratacao": 2100,
      "personalidade": "Coordena cooperação técnica internacional, foca em capacitação e transferência de conhecimento mais do que em dinheiro direto.",
      "falas": [
        "Treinar quem produz vale mais do que doar insumo por um ano.",
        "Cooperação boa deixa capacidade, não deixa dependência."
      ],
      "bonus": [
        {
          "tipo": "produtividadeTrabalho",
          "valor": 4
        },
        {
          "tipo": "custoInsumosAgricolas",
          "valor": 3
        }
      ]
    },
    {
      "id": "amb01",
      "nome": "Iara Bittencourt",
      "grupo": "ambientalistas",
      "foto": "/assets/personagens/ambientalistas/iara-bittencourt.jpg",
      "influencia": 49,
      "custoContratacao": 2400,
      "personalidade": "Bióloga à frente de ONG local, firme sobre limites ambientais, mas disposta a negociar prazos razoáveis.",
      "falas": [
        "Produção sem limite hoje é safra perdida amanhã.",
        "Eu não quero parar a fazenda, quero que ela dure mais tempo."
      ],
      "bonus": [
        {
          "tipo": "resilienciaClimatica",
          "valor": 0.06
        },
        {
          "tipo": "sustentabilidadeProducao",
          "valor": 3
        }
      ],
      "conflitosCom": [
        "rur03"
      ]
    },
    {
      "id": "amb02",
      "nome": "Caetano Lira",
      "grupo": "ambientalistas",
      "foto": "/assets/personagens/ambientalistas/caetano-lira.jpg",
      "influencia": 38,
      "custoContratacao": 1900,
      "personalidade": "Defende agroecologia e produção sustentável na prática, já converteu parte da própria terra; fala com exemplo, não só teoria.",
      "falas": [
        "Eu faço na minha terra antes de pedir que outro faça.",
        "Solo cuidado hoje é safra garantida daqui a dez anos."
      ],
      "bonus": [
        {
          "tipo": "sustentabilidadeProducao",
          "valor": 6
        }
      ]
    },
    {
      "id": "amb03",
      "nome": "Marina Kael",
      "grupo": "ambientalistas",
      "foto": "/assets/personagens/ambientalistas/marina-kael.jpg",
      "influencia": 33,
      "custoContratacao": 1500,
      "personalidade": "Ativista jovem, mobiliza pelas redes sociais, impaciente com promessas vagas de sustentabilidade.",
      "falas": [
        "Promessa verde sem meta é só maquiagem, e a gente percebe.",
        "Nossa geração vai cobrar o que vocês decidirem hoje."
      ],
      "bonus": [
        {
          "tipo": "aprovacaoPopular",
          "valor": 2
        },
        {
          "tipo": "transparenciaGoverno",
          "valor": 3
        }
      ]
    },
    {
      "id": "amb04",
      "nome": "Aldo Serafim",
      "grupo": "ambientalistas",
      "foto": "/assets/personagens/ambientalistas/aldo-serafim.jpg",
      "influencia": 56,
      "custoContratacao": 2700,
      "personalidade": "Professor universitário e pesquisador, fala com dados técnicos, tenta traduzir ciência em política aplicável ao vilarejo.",
      "falas": [
        "Dado publicado é decisão mais difícil de contestar depois.",
        "Impacto ambiental mal medido hoje vira custo mal calculado amanhã."
      ],
      "bonus": [
        {
          "tipo": "resilienciaClimatica",
          "valor": 0.04
        },
        {
          "tipo": "transparenciaGoverno",
          "valor": 2
        }
      ]
    },
    {
      "id": "seg01",
      "nome": "Coronel Ubirajara Fontes",
      "grupo": "seguranca",
      "foto": "/assets/personagens/seguranca/ubirajara-fontes.jpg",
      "influencia": 73,
      "custoContratacao": 4000,
      "personalidade": "Comanda a guarnição local, formal e disciplinado; fala em ordem e prevenção como base de qualquer progresso.",
      "falas": [
        "Vilarejo sem ordem não atrai investimento nem trabalhador.",
        "Prevenção custa menos do que lidar com a crise depois."
      ],
      "bonus": [
        {
          "tipo": "segurancaPublica",
          "valor": 8
        }
      ]
    },
    {
      "id": "seg02",
      "nome": "Sargento Ivete Carneiro",
      "grupo": "seguranca",
      "foto": "/assets/personagens/seguranca/ivete-carneiro.jpg",
      "influencia": 40,
      "custoContratacao": 1900,
      "personalidade": "Coordena policiamento comunitário, próxima da população, acredita em confiança mútua mais do que em repressão.",
      "falas": [
        "Segurança boa é aquela que a comunidade ajuda a construir.",
        "Eu prefiro conhecer o morador pelo nome a conhecer pelo boletim."
      ],
      "bonus": [
        {
          "tipo": "segurancaPublica",
          "valor": 4
        },
        {
          "tipo": "coesaoSocial",
          "valor": 2
        }
      ]
    },
    {
      "id": "seg03",
      "nome": "Major Heitor Dantas",
      "grupo": "seguranca",
      "foto": "/assets/personagens/seguranca/heitor-dantas.jpg",
      "influencia": 58,
      "custoContratacao": 2500,
      "personalidade": "Responsável pela segurança de estradas e fronteiras do vilarejo, direto, prioriza fluxo seguro de mercadoria e gente.",
      "falas": [
        "Estrada insegura encarece tudo que entra e tudo que sai.",
        "Quem transporta café precisa de rota protegida, não só de boa vontade."
      ],
      "bonus": [
        {
          "tipo": "custoMigracao",
          "valor": 300
        },
        {
          "tipo": "segurancaPublica",
          "valor": 3
        }
      ]
    },
    {
      "id": "seg04",
      "nome": "Capitão Rogério Macedo",
      "grupo": "seguranca",
      "foto": "/assets/personagens/seguranca/rogerio-macedo.jpg",
      "influencia": 35,
      "custoContratacao": 1700,
      "personalidade": "Trabalha com inteligência e prevenção, discreto, prefere antecipar o problema a reagir a ele.",
      "falas": [
        "Quando o problema aparece na manchete, eu já devia ter agido.",
        "Informação boa evita decisão ruim tomada no desespero."
      ],
      "bonus": [
        {
          "tipo": "transparenciaGoverno",
          "valor": 3
        }
      ]
    },
    {
      "id": "cler01",
      "nome": "Padre Anselmo Guedes",
      "grupo": "clero",
      "foto": "/assets/personagens/clero/anselmo-guedes.jpg",
      "influencia": 62,
      "custoContratacao": 2600,
      "personalidade": "Pastoral social católica, acolhedor mas firme em cobrar atenção aos mais pobres do vilarejo.",
      "falas": [
        "Quem decide por esse vilarejo não pode esquecer quem tem menos.",
        "Pão na mesa de todos é a medida que eu uso para julgar política."
      ],
      "bonus": [
        {
          "tipo": "coesaoSocial",
          "valor": 5
        },
        {
          "tipo": "protecaoSocialDividas",
          "valor": 3
        }
      ]
    },
    {
      "id": "cler02",
      "nome": "Pastora Eunice Ramos",
      "grupo": "clero",
      "foto": "/assets/personagens/clero/eunice-ramos.jpg",
      "influencia": 50,
      "custoContratacao": 2300,
      "personalidade": "Lidera igreja evangélica com forte trabalho assistencial; comunicadora direta, mobiliza rápido a comunidade.",
      "falas": [
        "Minha igreja alimenta quem a prefeitura ainda não alcançou.",
        "Fé move gente, e gente movida ajuda a resolver problema de verdade."
      ],
      "bonus": [
        {
          "tipo": "aprovacaoPopular",
          "valor": 3
        },
        {
          "tipo": "coesaoSocial",
          "valor": 3
        }
      ]
    },
    {
      "id": "cler03",
      "nome": "Mãe Oyá de Baluaê",
      "grupo": "clero",
      "foto": "/assets/personagens/clero/mae-oya-baluae.jpg",
      "influencia": 34,
      "custoContratacao": 1600,
      "personalidade": "Liderança de terreiro, guardiã da cultura afro-brasileira local; serena, mas resoluta sobre respeito e reconhecimento.",
      "falas": [
        "Cultura que resiste merece respeito, não apenas tolerância.",
        "Comunidade forte é a que reconhece todas as suas raízes."
      ],
      "bonus": [
        {
          "tipo": "coesaoSocial",
          "valor": 4
        }
      ]
    },
    {
      "id": "cler04",
      "nome": "Rabino David Lindenbaum",
      "grupo": "clero",
      "foto": "/assets/personagens/clero/david-lindenbaum.jpg",
      "influencia": 28,
      "custoContratacao": 1300,
      "personalidade": "Atende pequena comunidade local, mediador nato, costuma ser chamado para resolver impasses entre grupos rivais.",
      "falas": [
        "Já vi disputa pior do que essa se resolver numa boa conversa.",
        "Comunidade pequena não pode se dar ao luxo de ficar dividida."
      ],
      "bonus": [
        {
          "tipo": "transparenciaGoverno",
          "valor": 2
        },
        {
          "tipo": "coesaoSocial",
          "valor": 2
        }
      ]
    },
    {
      "id": "imp01",
      "nome": "Simone Vidal",
      "grupo": "imprensa",
      "foto": "/assets/personagens/imprensa/simone-vidal.jpg",
      "influencia": 59,
      "custoContratacao": 2800,
      "personalidade": "Jornalista do jornal impresso local, rigorosa com fontes, não aceita resposta vaga de autoridade.",
      "falas": [
        "Eu publico o que foi dito, não o que deveria ter sido dito.",
        "Transparência não é favor do governo, é obrigação dele."
      ],
      "bonus": [
        {
          "tipo": "transparenciaGoverno",
          "valor": 6
        }
      ]
    },
    {
      "id": "imp02",
      "nome": "Breno Castilho",
      "grupo": "imprensa",
      "foto": "/assets/personagens/imprensa/breno-castilho.jpg",
      "influencia": 44,
      "custoContratacao": 1700,
      "personalidade": "Blogueiro e influenciador político, opinativo, mistura informação com interpretação pessoal; popular entre os jovens.",
      "falas": [
        "Minha audiência decide o que vira pauta, não o gabinete.",
        "Eu simplifico a política para quem não tem tempo de acompanhar tudo."
      ],
      "bonus": [
        {
          "tipo": "aprovacaoPopular",
          "valor": 3
        }
      ]
    },
    {
      "id": "imp03",
      "nome": "Zilda Amaral",
      "grupo": "imprensa",
      "foto": "/assets/personagens/imprensa/zilda-amaral.jpg",
      "influencia": 37,
      "custoContratacao": 1500,
      "personalidade": "Apresenta rádio comunitária, voz popular e próxima do morador simples; fala o que as pessoas comentam na fila do mercado.",
      "falas": [
        "Rádio da gente fala o que a prefeitura não quer comentar.",
        "O povo me conta primeiro, antes de qualquer nota oficial sair."
      ],
      "bonus": [
        {
          "tipo": "coesaoSocial",
          "valor": 2
        },
        {
          "tipo": "aprovacaoPopular",
          "valor": 2
        }
      ]
    },
    {
      "id": "imp04",
      "nome": "Felipe Tocantins",
      "grupo": "imprensa",
      "foto": "/assets/personagens/imprensa/felipe-tocantins.jpg",
      "influencia": 53,
      "custoContratacao": 3000,
      "personalidade": "Repórter investigativo, persistente, incomoda quem prefere esconder número ruim do público.",
      "falas": [
        "Número escondido hoje vira escândalo publicado amanhã.",
        "Eu só sossego quando a planilha bate com o discurso."
      ],
      "bonus": [
        {
          "tipo": "transparenciaGoverno",
          "valor": 7
        }
      ],
      "conflitosCom": [
        "urb04"
      ]
    }
  ]
});

  const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
  const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const numberOr = (value, fallback = 0) => finite(value) ? Number(value) : fallback;
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const text = (value, fallback = "") => String(value ?? fallback);
  const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;

  function createGroup(definition, custom = {}) {
    const source = { ...definition, ...custom };
    return {
      id: text(source.id).trim(),
      name: text(source.name, source.id),
      description: text(source.description),
      representedPopulation: null,
      representativity: null,
      measurement: { status: "unavailable", basis: "Aguardando dados sociais ou econômicos específicos." },
      economicPower: clamp(source.economicPower),
      organization: clamp(source.organization),
      cohesion: clamp(source.cohesion),
      mobilizationCapacity: clamp(source.mobilizationCapacity),
      satisfaction: clamp(source.satisfaction ?? 55),
      institutionalAccess: clamp(source.institutionalAccess ?? 35),
      influence: 0,
      governmentRelation: "neutral",
      interests: Array.isArray(source.interests) ? source.interests.map(String) : [],
      history: []
    };
  }

  function calculateInfluence(group) {
    const components = [
      ["economicPower", 0.25],
      ["organization", 0.25],
      ["cohesion", 0.15],
      ["mobilizationCapacity", 0.15],
      ["institutionalAccess", 0.10]
    ];
    if (finite(group.representativity)) components.push(["representativity", 0.10]);
    const weight = components.reduce((sum, [, factor]) => sum + factor, 0);
    const score = components.reduce((sum, [key, factor]) => sum + clamp(group[key]) * factor, 0) / weight;
    return round1(clamp(score));
  }

  function relationFromSatisfaction(value) {
    if (value >= 65) return "support";
    if (value <= 35) return "opposition";
    return "neutral";
  }

  function refreshGroup(group) {
    group.influence = calculateInfluence(group);
    group.governmentRelation = relationFromSatisfaction(group.satisfaction);
    return group;
  }

  function getCharactersCatalog() {
    return clone(POLITICAL_CHARACTERS_DATA);
  }

  function getCharacterById(id) {
    if (!id || !POLITICAL_CHARACTERS_DATA?.personagens) return null;
    const found = POLITICAL_CHARACTERS_DATA.personagens.find((c) => c.id === String(id));
    return found ? clone(found) : null;
  }

  function getCharactersByGroup(groupId) {
    if (!groupId || !POLITICAL_CHARACTERS_DATA?.personagens) return [];
    return POLITICAL_CHARACTERS_DATA.personagens
      .filter((c) => c.grupo === String(groupId))
      .map(clone);
  }

  function getBonusLegend() {
    return clone(POLITICAL_CHARACTERS_DATA.legendaBonus || {});
  }

  function calculateActiveBonuses(activeIds = []) {
    const ids = Array.isArray(activeIds) ? activeIds : Object.values(activeIds || {});
    const totals = {};
    for (const id of ids) {
      const char = POLITICAL_CHARACTERS_DATA.personagens.find((c) => c.id === id);
      if (!char || !Array.isArray(char.bonus)) continue;
      for (const b of char.bonus) {
        totals[b.tipo] = Number((Number(totals[b.tipo] || 0) + Number(b.valor || 0)).toFixed(4));
      }
    }
    return totals;
  }

  function calculateConflicts(activeIds = []) {
    const ids = Array.isArray(activeIds) ? activeIds : Object.values(activeIds || {});
    const chars = ids.map((id) => POLITICAL_CHARACTERS_DATA.personagens.find((c) => c.id === id)).filter(Boolean);
    const conflicts = [];
    const checkedPairs = new Set();
    for (let i = 0; i < chars.length; i++) {
      for (let j = i + 1; j < chars.length; j++) {
        const a = chars[i];
        const b = chars[j];
        const pairKey = [a.id, b.id].sort().join(":");
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);
        const aHatesB = Array.isArray(a.conflitosCom) && a.conflitosCom.includes(b.id);
        const bHatesA = Array.isArray(b.conflitosCom) && b.conflitosCom.includes(a.id);
        if (aHatesB || bHatesA) {
          conflicts.push({
            pair: [a.id, b.id],
            names: [a.nome, b.nome],
            groups: [a.grupo, b.grupo],
            description: a.nome + " (" + a.grupo + ") em atrito com " + b.nome + " (" + b.grupo + ")",
            penalty: -4
          });
        }
      }
    }
    return conflicts;
  }

  function createState(options = {}) {
    const seed = Math.floor(Math.abs(numberOr(options.seed, 20261102))) >>> 0;
    const groups = GROUP_DEFINITIONS.map((definition) => refreshGroup(createGroup(definition)));
    return {
      version: VERSION,
      rngSeed: seed || 1,
      currentMonth: 0,
      lastProcessedMonth: null,
      population: { total: 0, workingAge: null, dataStatus: "unavailable" },
      groups,
      history: [],
      events: [],
      nextEventId: 1,
      compositionSource: "not_initialized"
    };
  }

  function ensureState(state) {
    if (!state || state.version !== VERSION || !Array.isArray(state.groups)) {
      throw new TypeError(`Estado político inválido. Esperado schema ${VERSION}.`);
    }
    return state;
  }

  function findGroup(state, groupId) {
    return state.groups.find((group) => group.id === String(groupId));
  }

  function pushEvent(state, event) {
    const record = { ...clone(event), id: `pol-${state.nextEventId++}` };
    state.events.push(record);
    if (state.events.length > EVENT_LIMIT) state.events.splice(0, state.events.length - EVENT_LIMIT);
    return record;
  }

  function addGroup(state, definition) {
    ensureState(state);
    if (!definition || !String(definition.id || "").trim()) throw new TypeError("O identificador do grupo é obrigatório.");
    if (findGroup(state, definition.id)) throw new Error(`O grupo '${definition.id}' já existe.`);
    const group = refreshGroup(createGroup({ id: definition.id, name: definition.name || definition.id }, definition));
    state.groups.push(group);
    pushEvent(state, { type: "group_created", month: state.currentMonth, groupId: group.id, message: `O grupo ${group.name} foi criado.` });
    return clone(group);
  }

  function removeGroup(state, groupId) {
    ensureState(state);
    const index = state.groups.findIndex((group) => group.id === String(groupId));
    if (index < 0) return false;
    const [removed] = state.groups.splice(index, 1);
    pushEvent(state, { type: "group_removed", month: state.currentMonth, groupId: removed.id, message: `O grupo ${removed.name} deixou de existir.` });
    return true;
  }

  function updateGroup(state, groupId, changes = {}) {
    ensureState(state);
    const group = findGroup(state, groupId);
    if (!group) throw new Error(`Grupo político não encontrado: ${groupId}`);
    const scalarFields = ["economicPower", "organization", "cohesion", "mobilizationCapacity", "satisfaction", "institutionalAccess"];
    for (const key of scalarFields) {
      if (finite(changes[key])) group[key] = clamp(changes[key]);
    }
    if (Array.isArray(changes.interests)) group.interests = changes.interests.map(String);
    if (changes.name !== undefined) group.name = text(changes.name, group.name);
    if (changes.description !== undefined) group.description = text(changes.description, group.description);
    refreshGroup(group);
    pushEvent(state, { type: "group_updated", month: state.currentMonth, groupId: group.id, message: `Os indicadores de ${group.name} foram atualizados.` });
    return clone(group);
  }

  function mergeGroups(state, groupIds, definition = {}) {
    ensureState(state);
    const ids = [...new Set((Array.isArray(groupIds) ? groupIds : []).map(String))];
    if (ids.length < 2) throw new TypeError("A fusão exige pelo menos dois grupos distintos.");
    if (!definition.id || findGroup(state, definition.id)) throw new Error("A fusão exige um novo identificador de grupo.");
    const sources = ids.map((id) => findGroup(state, id));
    if (sources.some((group) => !group)) throw new Error("Todos os grupos da fusão precisam existir.");
    const average = (key) => round1(sources.reduce((sum, group) => sum + group[key], 0) / sources.length);
    const interests = [...new Set(sources.flatMap((group) => group.interests))];
    const mergedCount = finite(definition.representedPopulation)
      ? Math.max(0, Math.floor(Number(definition.representedPopulation)))
      : null;
    if (mergedCount !== null && mergedCount > state.population.total) {
      throw new RangeError(`O grupo '${definition.id}' excede a população total.`);
    }
    const merged = refreshGroup(createGroup({
      id: definition.id,
      name: definition.name || sources.map((group) => group.name).join(" + "),
      description: definition.description || `Grupo formado pela fusão de ${sources.map((group) => group.name).join(", ")}.`,
      economicPower: average("economicPower"),
      organization: average("organization"),
      cohesion: average("cohesion"),
      mobilizationCapacity: average("mobilizationCapacity"),
      satisfaction: average("satisfaction"),
      institutionalAccess: average("institutionalAccess"),
      interests,
      ...definition
    }));
    state.groups = state.groups.filter((group) => !ids.includes(group.id));
    state.groups.push(merged);
    if (mergedCount !== null) {
      const count = mergedCount;
      merged.representedPopulation = count;
      merged.representativity = state.population.total > 0 ? round1((count / state.population.total) * 100) : 0;
      merged.measurement = {
        status: definition.evidenceLevel === "measured" ? "measured" : "estimated",
        basis: text(definition.basis, "Base informada explicitamente durante a fusão.")
      };
      refreshGroup(merged);
    }
    pushEvent(state, { type: "groups_merged", month: state.currentMonth, sourceGroupIds: ids, groupId: merged.id, message: `${sources.length} grupos foram fundidos em ${merged.name}.` });
    return clone(findGroup(state, merged.id));
  }

  function splitGroup(state, sourceGroupId, definitions = []) {
    ensureState(state);
    const source = findGroup(state, sourceGroupId);
    if (!source) throw new Error(`Grupo político não encontrado: ${sourceGroupId}`);
    if (!Array.isArray(definitions) || definitions.length < 2) throw new TypeError("A divisão exige pelo menos dois novos grupos.");
    const ids = definitions.map((item) => String(item?.id || "").trim());
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length || ids.some((id) => findGroup(state, id))) {
      throw new Error("Cada grupo resultante precisa de um identificador novo e exclusivo.");
    }
    const created = definitions.map((definition) => {
      const group = refreshGroup(createGroup({
        id: definition.id,
        name: definition.name || `${source.name} (${definition.id})`,
        description: definition.description || `Segmento originado da divisão de ${source.name}.`,
        economicPower: source.economicPower,
        organization: source.organization,
        cohesion: source.cohesion,
        mobilizationCapacity: source.mobilizationCapacity,
        satisfaction: source.satisfaction,
        institutionalAccess: source.institutionalAccess,
        interests: source.interests,
        ...definition
      }));
      if (finite(definition.representedPopulation)) {
        const count = Math.max(0, Math.floor(Number(definition.representedPopulation)));
        if (count > state.population.total) throw new RangeError(`O grupo '${group.id}' excede a população total.`);
        group.representedPopulation = count;
        group.representativity = state.population.total > 0 ? round1((count / state.population.total) * 100) : 0;
        group.measurement = {
          status: definition.evidenceLevel === "measured" ? "measured" : "estimated",
          basis: text(definition.basis, "Base informada explicitamente durante a divisão.")
        };
      }
      return group;
    });
    state.groups = state.groups.filter((group) => group.id !== source.id).concat(created);
    pushEvent(state, { type: "group_split", month: state.currentMonth, sourceGroupId: source.id, createdGroupIds: ids, message: `${source.name} foi dividido em ${created.length} grupos.` });
    return clone(created);
  }

  function setComposition(state, composition = {}) {
    ensureState(state);
    const total = Math.max(0, Math.floor(numberOr(composition.population, state.population.total)));
    const workingAge = finite(composition.workingAge) ? Math.max(0, Math.floor(Number(composition.workingAge))) : null;
    const memberships = composition.groups || {};
    const resolvedMemberships = new Map();
    for (const group of state.groups) {
      const item = Array.isArray(memberships)
        ? memberships.find((entry) => entry && String(entry.groupId) === group.id)
        : memberships[group.id];
      if (item && finite(item.count)) {
        const count = Math.max(0, Math.floor(Number(item.count)));
        if (count > total) throw new RangeError(`O grupo '${group.id}' não pode representar mais pessoas que a população total.`);
        resolvedMemberships.set(group.id, { ...item, count });
      }
    }

    state.population = {
      total,
      workingAge,
      dataStatus: text(composition.dataStatus, total > 0 ? "measured" : "unavailable")
    };

    for (const group of state.groups) {
      const item = resolvedMemberships.get(group.id);
      if (!item || !finite(item.count)) {
        group.representedPopulation = null;
        group.representativity = null;
        group.measurement = {
          status: "unavailable",
          basis: "Não há variável suficiente na simulação atual para identificar este segmento."
        };
      } else {
        const count = item.count;
        group.representedPopulation = count;
        group.representativity = total > 0 ? round1((count / total) * 100) : 0;
        group.measurement = {
          status: item.evidenceLevel === "measured" ? "measured" : "estimated",
          basis: text(item.basis, "Composição informada por um adaptador de dados.")
        };
      }
      refreshGroup(group);
    }
    state.compositionSource = text(composition.source, "external_adapter");
    return clone(state.population);
  }

  function deriveComposition(populationSnapshot = {}, societyState = null) {
    const totals = populationSnapshot.totals || {};
    const coreGroups = Array.isArray(populationSnapshot.groups) ? populationSnapshot.groups : [];
    const total = Math.max(0, Math.floor(numberOr(totals.total, coreGroups.reduce((sum, item) => sum + numberOr(item.population, numberOr(item.adults) + numberOr(item.children)), 0))));
    const societyHouseholds = Array.isArray(societyState?.households) ? societyState.households : null;
    let workingAge = null;
    if (societyHouseholds) {
      workingAge = societyHouseholds.reduce((sum, household) => sum + (Array.isArray(household.members)
        ? household.members.filter((person) => numberOr(person.age) >= 18 && numberOr(person.age) < 65).length
        : 0), 0);
    } else if (finite(totals.adults)) {
      workingAge = Math.max(0, Math.floor(Number(totals.adults)));
    }

    const groups = {};
    if (workingAge !== null) {
      groups.workers = {
        count: Math.min(total, workingAge),
        evidenceLevel: "estimated",
        basis: societyHouseholds
          ? "Estimativa pela população em idade ativa (18 a 64 anos); ainda não separa ocupados, desempregados e inativos."
          : "Estimativa pela quantidade de adultos informada pelo Core; a faixa etária detalhada ainda não foi fornecida."
      };
    }
    return {
      population: total,
      workingAge,
      groups,
      dataStatus: total > 0 ? "measured" : "unavailable",
      source: "core_society_adapter"
    };
  }

  function updateCompositionFromRuntime(state, runtime, societyState = null) {
    if (!runtime?.population || typeof runtime.population.getSnapshot !== "function") return null;
    return setComposition(state, deriveComposition(runtime.population.getSnapshot(), societyState));
  }

  function applyImpact(state, impact = {}) {
    ensureState(state);
    const groupId = text(impact.groupId).trim();
    const group = findGroup(state, groupId);
    if (!group) throw new Error(`Grupo político não encontrado para impacto: ${groupId}`);
    const channels = impact.channels || {};
    const changes = {};
    for (const [channel, rawDelta] of Object.entries(channels)) {
      if (!CHANNELS.has(channel)) continue;
      if (!finite(rawDelta)) continue;
      const before = group[channel];
      group[channel] = clamp(before + Number(rawDelta));
      changes[channel] = round1(group[channel] - before);
    }
    refreshGroup(group);
    const event = pushEvent(state, {
      type: "interest_impact",
      month: finite(impact.month) ? Number(impact.month) : state.currentMonth,
      source: text(impact.source, "external"),
      sourceEventId: impact.eventId ?? null,
      groupId,
      groupName: group.name,
      reason: text(impact.reason, "Impacto registrado sem descrição."),
      evidence: clone(impact.evidence || null),
      changes,
      influenceAfter: group.influence,
      relationAfter: group.governmentRelation
    });
    return { group: clone(group), event };
  }

  function recordImpacts(state, payload = {}) {
    ensureState(state);
    const impacts = Array.isArray(payload.impacts) ? payload.impacts : [];
    const results = impacts.map((impact) => applyImpact(state, {
      ...impact,
      month: finite(impact.month) ? impact.month : payload.month,
      eventId: impact.eventId ?? payload.eventId,
      source: impact.source || payload.source || payload.eventType || "external"
    }));
    return results;
  }

  function captureHistory(state, month) {
    const snapshot = {
      month,
      population: state.population.total,
      measuredGroups: state.groups.filter((group) => group.measurement.status !== "unavailable").length,
      groups: state.groups.map((group) => ({
        id: group.id,
        influence: group.influence,
        satisfaction: group.satisfaction,
        governmentRelation: group.governmentRelation,
        representedPopulation: group.representedPopulation,
        representativity: group.representativity
      }))
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
    if (state.lastProcessedMonth === month) return { unchanged: true, snapshot: getSnapshot(state), influenceChanges: [] };
    if (state.lastProcessedMonth !== null && month < state.lastProcessedMonth) {
      throw new RangeError("O módulo político não pode retroceder no calendário.");
    }

    const before = new Map(state.groups.map((group) => [group.id, group.influence]));
    if (options.composition) setComposition(state, options.composition);
    else if (options.populationSnapshot) {
      setComposition(state, deriveComposition(options.populationSnapshot, options.societyState || null));
    }

    for (const impact of Array.isArray(options.impacts) ? options.impacts : []) {
      applyImpact(state, { ...impact, month });
    }
    for (const group of state.groups) refreshGroup(group);

    state.currentMonth = month;
    state.lastProcessedMonth = month;
    captureHistory(state, month);
    const influenceChanges = state.groups.map((group) => ({
      groupId: group.id,
      previous: before.has(group.id) ? before.get(group.id) : null,
      current: group.influence,
      delta: before.has(group.id) ? round1(group.influence - before.get(group.id)) : null
    })).filter((item) => item.delta !== null && Math.abs(item.delta) >= 0.1);

    pushEvent(state, {
      type: "month_closed",
      month,
      population: state.population.total,
      groupCount: state.groups.length,
      influenceChanges,
      message: `O retrato político do mês ${month} foi atualizado.`
    });
    return { unchanged: false, snapshot: getSnapshot(state), influenceChanges };
  }

  function getSnapshot(state) {
    ensureState(state);
    const groups = state.groups.map((group) => clone(refreshGroup(group))).sort((a, b) => b.influence - a.influence);
    const relations = groups.reduce((result, group) => {
      result[group.governmentRelation] = (result[group.governmentRelation] || 0) + 1;
      return result;
    }, { support: 0, neutral: 0, opposition: 0 });
    return {
      version: VERSION,
      currentMonth: state.currentMonth,
      population: clone(state.population),
      summary: {
        groupCount: groups.length,
        measuredGroups: groups.filter((group) => group.measurement.status !== "unavailable").length,
        unmeasuredGroups: groups.filter((group) => group.measurement.status === "unavailable").length,
        relations,
        mostInfluentialGroup: groups[0] ? { id: groups[0].id, name: groups[0].name, influence: groups[0].influence } : null
      },
      groups,
      history: clone(state.history),
      recentEvents: clone(state.events.slice(-12)),
      compositionSource: state.compositionSource
    };
  }

  function resetState(state, options = {}) {
    const next = createState(options);
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, next);
    return state;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

    function renderDashboard(state, host) {
    if (!host || !state) return false;
    const data = getSnapshot(state);
    const relationLabel = { support: "Apoia", neutral: "Neutro", opposition: "Oposição" };
    const relationClass = { support: "politics-support", neutral: "politics-neutral", opposition: "politics-opposition" };
    const formatPopulation = (value) => value === null || value === undefined ? "Não mensurado" : Math.round(value).toLocaleString("pt-BR");

    const ecoSnapshot = (typeof window !== "undefined" && window.VilarejoTest?.stateSnapshot) ? window.VilarejoTest.stateSnapshot() : null;
    const activeCharsMap = ecoSnapshot?.activeCharacters || {};
    const activeIds = Object.values(activeCharsMap).filter(Boolean);
    const activeBonuses = calculateActiveBonuses(activeIds);
    const conflicts = calculateConflicts(activeIds);
    const treasuryBalance = Number(ecoSnapshot?.treasuryCash ?? 0);

    const bonusLabelMap = {
      produtividadeTrabalho: "+% Produtividade Trabalho",
      aprovacaoPopular: "pts Aprovação Popular",
      protecaoSocialDividas: "% Alívio Dívidas",
      custoCestaImportacao: "% Desconto Alimentos Importados",
      margemComercio: "% Margem Comércio",
      custoInsumosAgricolas: "% Economia Insumos Agrícolas",
      produtividadeAgricola: "+% Produtividade Agrícola",
      resilienciaClimatica: "Resiliência Geada",
      creditoRural: "% Subsídio Crédito Rural",
      precoExportacao: "+% Preço Exportação",
      investimentoExterno: "R$ Aporte Externo",
      custoMigracao: "R$ Subsídio Migração",
      taxaJurosCredito: "% Alívio Juros Bancários",
      valorizacaoImobiliaria: "% Valorização Imobiliária",
      custoConstrucao: "% Economia Obras Habitacionais",
      sustentabilidadeProducao: "% Bônus Sustentabilidade",
      segurancaPublica: "% Segurança Pública",
      coesaoSocial: "pts Coesão Social",
      transparenciaGoverno: "% Transparência Governo"
    };

    const activeCount = activeIds.length;
    const bonusBadges = Object.keys(activeBonuses).length > 0
      ? Object.entries(activeBonuses).map(([k, v]) => '<span class="politics-bonus-pill"><strong>' + (v > 0 ? "+" : "") + v + '</strong> ' + (bonusLabelMap[k] || k) + '</span>').join("")
      : '<span class="politics-bonus-empty">Nenhum bônus ativo no momento. Nomeie representantes para obter vantagens setoriais.</span>';

    const conflictBanner = conflicts.length > 0
      ? '<div class="politics-conflict-banner">' +
          '<div class="politics-conflict-head">' +
            '<span class="politics-conflict-icon">⚠</span>' +
            '<div>' +
              '<strong>Atrito Político no Gabinete: -' + (conflicts.length * 4) + ' pts de aprovação popular/mês</strong>' +
              '<p>Lideranças ativas com interesses conflitantes estão gerando desgaste público contínuo.</p>' +
            '</div>' +
          '</div>' +
          '<div class="politics-conflict-list">' +
            conflicts.map(c => '<div class="politics-conflict-item">⚡ ' + escapeHtml(c.names[0]) + ' (' + escapeHtml(c.groups[0]) + ') vs ' + escapeHtml(c.names[1]) + ' (' + escapeHtml(c.groups[1]) + ')</div>').join("") +
          '</div>' +
        '</div>'
      : '<div class="politics-harmony-banner">' +
          '<span class="politics-harmony-icon">✔</span>' +
          '<span>Harmonia Institucional: Nenhuma rivalidade política aberta entre as lideranças ativas.</span>' +
        '</div>';

    const groupsCatalog = POLITICAL_CHARACTERS_DATA.grupos || [];
    const charactersByGroup = groupsCatalog.map(g => {
      const chars = getCharactersByGroup(g.id);
      const activeCharId = activeCharsMap[g.id];
      const activeChar = chars.find(c => c.id === activeCharId);

      const charCards = chars.map(char => {
        const isActive = char.id === activeCharId;
        const canAfford = treasuryBalance >= char.custoContratacao;
        const initials = char.nome.split(" ").map(w => w[0]).slice(0, 2).join("");

        const bonusTags = (char.bonus || []).map(b => {
          const isCash = b.tipo === "investimentoExterno";
          const formattedVal = isCash ? ("+R$ " + Number(b.valor).toLocaleString("pt-BR")) : ((b.valor > 0 ? "+" : "") + b.valor);
          return '<span class="politics-char-bonus-tag ' + (isCash ? 'is-cash' : '') + '">' + formattedVal + ' ' + (bonusLabelMap[b.tipo] || b.tipo) + '</span>';
        }).join("");

        const conflictTags = (char.conflitosCom || []).map(cid => {
          const rival = getCharacterById(cid);
          return '<span class="politics-char-conflict-tag">⚡ Rival de: ' + (rival ? escapeHtml(rival.nome) : cid) + '</span>';
        }).join("");

        let actionBtn = "";
        if (isActive) {
          actionBtn = '<div class="politics-char-active-actions">' +
            '<span class="politics-badge-active">✔ Em Exercício</span>' +
            '<button type="button" class="politics-btn-dismiss" onclick="window.VilarejoDashboard &amp;&amp; window.VilarejoDashboard.dismissCharacter(&quot;' + char.grupo + '&quot;)">Dispensar</button>' +
          '</div>';
        } else if (activeCharId) {
          actionBtn = '<button type="button" class="politics-btn-hire is-replace" ' + (canAfford ? '' : 'disabled title="Saldo insuficiente no Tesouro"') + ' onclick="window.VilarejoDashboard &amp;&amp; window.VilarejoDashboard.hireCharacter(&quot;' + char.id + '&quot;)">' +
            'Substituir (R$ ' + char.custoContratacao.toLocaleString("pt-BR") + ')' +
          '</button>';
        } else {
          actionBtn = '<button type="button" class="politics-btn-hire" ' + (canAfford ? '' : 'disabled title="Saldo insuficiente no Tesouro"') + ' onclick="window.VilarejoDashboard &amp;&amp; window.VilarejoDashboard.hireCharacter(&quot;' + char.id + '&quot;)">' +
            'Nomear (R$ ' + char.custoContratacao.toLocaleString("pt-BR") + ')' +
          '</button>';
        }

        return '<div class="politics-char-card ' + (isActive ? 'is-active' : '') + '">' +
          '<div class="politics-char-head">' +
            '<div class="politics-char-avatar">' + initials + '</div>' +
            '<div class="politics-char-info">' +
              '<h4>' + escapeHtml(char.nome) + '</h4>' +
              '<span class="politics-char-influence">Influência: <strong>' + char.influencia + '/100</strong></span>' +
            '</div>' +
            '<span class="politics-char-cost">R$ ' + char.custoContratacao.toLocaleString("pt-BR") + '</span>' +
          '</div>' +
          '<p class="politics-char-quote">“' + escapeHtml(char.falas?.[0] || '') + '”</p>' +
          '<p class="politics-char-bio">' + escapeHtml(char.personalidade) + '</p>' +
          '<div class="politics-char-bonuses">' + bonusTags + conflictTags + '</div>' +
          '<div class="politics-char-footer">' + actionBtn + '</div>' +
        '</div>';
      }).join("");

      return '<div class="politics-group-section">' +
        '<div class="politics-group-section-head">' +
          '<div>' +
            '<h3>' + escapeHtml(g.nome) + '</h3>' +
            '<span class="politics-group-interests">Interesses prioritários: ' + escapeHtml(g.interesses) + '</span>' +
          '</div>' +
          '<div class="politics-group-status-pill ' + (activeChar ? 'has-active' : 'no-active') + '">' +
            (activeChar ? ('Representante: <strong>' + escapeHtml(activeChar.nome) + '</strong>') : 'Sem representante nomeado') +
          '</div>' +
        '</div>' +
        '<div class="politics-chars-row">' + charCards + '</div>' +
      '</div>';
    }).join("");

    const groupCards = data.groups.map((group) => {
      const measured = group.measurement.status !== "unavailable";
      const coverageLabel = group.measurement.status === "measured" ? "Medido" : group.measurement.status === "estimated" ? "Estimado" : "Sem dados";
      return '<article class="politics-group-card">' +
        '<div class="politics-group-head"><div><h3>' + escapeHtml(group.name) + '</h3><p>' + escapeHtml(group.description) + '</p></div><span class="politics-relation ' + relationClass[group.governmentRelation] + '">' + relationLabel[group.governmentRelation] + '</span></div>' +
        '<div class="politics-influence"><span>Influência política</span><strong>' + group.influence.toFixed(1) + '/100</strong></div>' +
        '<div class="politics-track"><span style="width:' + group.influence + '%"></span></div>' +
        '<div class="politics-metrics">' +
          '<div><span>Representatividade</span><b>' + (measured ? (group.representativity.toFixed(1) + "%") : "n/d") + '</b></div>' +
          '<div><span>Base representada</span><b>' + formatPopulation(group.representedPopulation) + '</b></div>' +
          '<div><span>Poder econômico</span><b>' + group.economicPower.toFixed(0) + '/100</b></div>' +
          '<div><span>Organização</span><b>' + group.organization.toFixed(0) + '/100</b></div>' +
          '<div><span>Coesão</span><b>' + group.cohesion.toFixed(0) + '/100</b></div>' +
          '<div><span>Mobilização</span><b>' + group.mobilizationCapacity.toFixed(0) + '/100</b></div>' +
          '<div><span>Acesso institucional</span><b>' + group.institutionalAccess.toFixed(0) + '/100</b></div>' +
          '<div><span>Satisfação</span><b>' + group.satisfaction.toFixed(0) + '/100</b></div>' +
          '<div><span>Qualidade do dado</span><b>' + coverageLabel + '</b></div>' +
        '</div>' +
        '<p class="politics-measurement">' + escapeHtml(group.measurement.basis) + '</p>' +
        '<div class="politics-interests">' + group.interests.map((interest) => '<span>' + escapeHtml(interest) + '</span>').join("") + '</div>' +
      '</article>';
    }).join("");

    host.innerHTML = '' +
      '<section class="politics-dashboard">' +
        '<div class="politics-cabinet-panel">' +
          '<div class="politics-cabinet-header">' +
            '<div>' +
              '<span class="eyebrow">GABINETE &amp; REPRESENTAÇÃO POLÍTICA</span>' +
              '<h2>Articulação com Grupos de Interesse</h2>' +
              '<p>Nomeie líderes setoriais para o gabinete municipal. Cada classe produtiva e civil aceita no máximo 1 representante ativo por vez. Lideranças trazem bônus econômicos permanentes ao custo de potenciais atritos com grupos rivais.</p>' +
            '</div>' +
            '<div class="politics-cabinet-kpi">' +
              '<span>Lideranças Nomeadas</span>' +
              '<strong>' + activeCount + ' / ' + groupsCatalog.length + '</strong>' +
              '<small>Tesouro disponível: R$ ' + treasuryBalance.toLocaleString("pt-BR") + '</small>' +
            '</div>' +
          '</div>' +

          '<div class="politics-bonuses-overview">' +
            '<span class="politics-bonuses-title">BÔNUS SETORIAIS ATIVOS:</span>' +
            '<div class="politics-bonuses-pills">' + bonusBadges + '</div>' +
          '</div>' +

          conflictBanner +

          '<div class="politics-representation-groups">' +
            charactersByGroup +
          '</div>' +
        '</div>' +

        '<div class="politics-section-heading">' +
          '<div>' +
            '<span class="eyebrow">MAPA ESTRUTURAL DE INTERESSES</span>' +
            '<h2>Quem tem poder e por quê</h2>' +
            '<p>A influência combina poder econômico, organização, coesão, mobilização, acesso institucional e representatividade quando medida.</p>' +
          '</div>' +
        '</div>' +
        '<div class="politics-summary-grid">' +
          '<article class="politics-summary-card"><span>Grupos ativos</span><strong>' + data.summary.groupCount + '</strong></article>' +
          '<article class="politics-summary-card"><span>População observada</span><strong>' + formatPopulation(data.population.total) + '</strong></article>' +
          '<article class="politics-summary-card"><span>Grupos com dados de base</span><strong>' + data.summary.measuredGroups + '/' + data.summary.groupCount + '</strong></article>' +
          '<article class="politics-summary-card"><span>Maior influência</span><strong>' + (data.summary.mostInfluentialGroup ? escapeHtml(data.summary.mostInfluentialGroup.name) : "n/d") + '</strong></article>' +
        '</div>' +
        '<div class="politics-groups-grid">' + groupCards + '</div>' +
        '<p class="politics-data-note">Representatividade não é exclusiva: uma mesma pessoa pode integrar vários grupos. “Não mensurado” significa ausência de dado, não população igual a zero. Os parâmetros iniciais de poder e organização são hipóteses de balanceamento do cenário.</p>' +
      '</section>';
    return true;
  }

  function registerWithRuntime(runtime, options = {}) {
    if (!runtime || !runtime.modules || !runtime.population || !runtime.events || typeof runtime.publish !== "function") {
      throw new TypeError("Runtime do Vilarejo incompleto para registrar Política.");
    }
    if (!runtime.modules.has("core") || !runtime.modules.has("economia")) {
      throw new Error("Política exige os módulos Core e Economia registrados.");
    }
    if (runtime.modules.has("politica")) {
      return { alreadyRegistered: true, state: null, dispose() {} };
    }

    runtime.modules.register({
      id: "politica",
      version: VERSION,
      name: "Política",
      dependencies: ["core", "economia"],
      description: "Grupos de interesse, representatividade, organização e influência política."
    });

    const state = createState({ seed: options.seed });
    const societyState = () => {
      if (typeof options.getSocietyState === "function") {
        const supplied = options.getSocietyState();
        return supplied && Array.isArray(supplied.households) ? supplied : null;
      }
      if (options.societyState && Array.isArray(options.societyState.households)) return options.societyState;
      const adapter = root?.VilarejoSocietyRuntime;
      return adapter?.state && Array.isArray(adapter.state.households) ? adapter.state : null;
    };
    const publishSnapshot = (source = "politica") => {
      const snapshot = getSnapshot(state);
      runtime.modules.updateSnapshot("politica", snapshot, source);
      return snapshot;
    };
    const refreshComposition = () => updateCompositionFromRuntime(state, runtime, societyState());

    refreshComposition();
    publishSnapshot("politica.initial-adapter");

    const unsubscribeReset = runtime.events.on("game:reset", () => {
      resetState(state, { seed: options.seed });
      publishSnapshot("politica.reset");
    });

    const unsubscribeInitialized = runtime.events.on("game:initialized", () => {
      refreshComposition();
      publishSnapshot("politica.game-initialized");
    });

    const unsubscribeWorld = runtime.events.on("world:synchronized", () => {
      refreshComposition();
    });

    const unsubscribeSociety = runtime.events.on("society:month-closed", () => {
      refreshComposition();
    });

    const unsubscribeEconomyMonth = runtime.events.on("economy:month-closed", (event) => {
      const month = Math.max(0, Math.floor(numberOr(event?.payload?.monthNumber, runtime.clock?.snapshot?.().economicMonthNumber || state.currentMonth + 1)));
      const result = advanceMonth(state, {
        month,
        populationSnapshot: runtime.population.getSnapshot(),
        societyState: societyState()
      });
      const snapshot = publishSnapshot("politica.month-closed");
      if (!result.unchanged) {
        runtime.publish("politics:month-closed", snapshot, "politica");
        for (const change of result.influenceChanges) {
          runtime.publish("politics:influence-changed", change, "politica");
        }
      }
    });

    const unsubscribeImpact = runtime.events.on("politics:interest-impact", (event) => {
      const results = recordImpacts(state, event?.payload || {});
      const snapshot = publishSnapshot("politica.impact-adapter");
      runtime.publish("politics:group-updated", { impacts: results.map((result) => result.event), snapshot }, "politica");
    });

    return {
      alreadyRegistered: false,
      state,
      getSnapshot: () => getSnapshot(state),
      updateGroup: (groupId, changes) => {
        const result = updateGroup(state, groupId, changes);
        const snapshot = publishSnapshot("politica.group-updated");
        runtime.publish("politics:group-updated", { groupId, group: result, snapshot }, "politica");
        return result;
      },
      applyImpact: (impact) => {
        const result = applyImpact(state, impact);
        const snapshot = publishSnapshot("politica.impact-applied");
        runtime.publish("politics:group-updated", { groupId: impact.groupId, impact: result.event, snapshot }, "politica");
        return result;
      },
      refreshComposition,
      dispose() {
        unsubscribeReset();
        unsubscribeInitialized();
        unsubscribeWorld();
        unsubscribeSociety();
        unsubscribeEconomyMonth();
        unsubscribeImpact();
      }
    };
  }

  if (root) {
    root.POLITICAL_CHARACTERS_CATALOG = POLITICAL_CHARACTERS_DATA;
  }

  if (root?.VilarejoRuntime) {
    try {
      root.VilarejoPoliticsRuntime = registerWithRuntime(root.VilarejoRuntime);
    } catch (error) {
      if (root.console?.error) root.console.error("Falha ao registrar o módulo Política:", error);
    }
  }

  return {
    VERSION,
    GROUP_DEFINITIONS: clone(GROUP_DEFINITIONS),
    CHARACTERS_CATALOG: clone(POLITICAL_CHARACTERS_DATA),
    getCharactersCatalog,
    getCharacterById,
    getCharactersByGroup,
    getBonusLegend,
    calculateActiveBonuses,
    calculateConflicts,
    createState,
    addGroup,
    removeGroup,
    updateGroup,
    mergeGroups,
    splitGroup,
    setComposition,
    deriveComposition,
    updateCompositionFromRuntime,
    calculateInfluence,
    applyImpact,
    recordImpacts,
    advanceMonth,
    getSnapshot,
    resetState,
    renderDashboard,
    registerWithRuntime
  };
});
