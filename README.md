# Vilarejo

Vilarejo é uma simulação de gestão de uma comunidade. A Economia é o motor principal do jogo; Core, Eventos, Sociedade, Política, Instituições e Serviços ampliam a representação do mundo por contratos explícitos, snapshots e fechamentos mensais.

> **Estado desta branch:** integração funcional de Política, Instituições e Serviços na interface e no Runtime, baseada exclusivamente na `main`. A Economia não foi reescrita. Parâmetros dos módulos de Serviços são indicadores de cenário, não estatísticas reais nem despesas contabilizadas.

## O que está implementado

| Módulo | Função atual | Limite que importa |
|---|---|---|
| Core (`core`, 0.1.0) | Calendário, sessão, diretório populacional, registro de módulos, snapshots e barramento de eventos. | Coordena e armazena estado; não é dono das regras econômicas. |
| Eventos V3 | Catálogo e ciclo de eventos com escolhas, efeitos e estado serializável; integra-se à Economia por API/helpers. | É um motor separado, não um módulo inscrito no barramento do Core. |
| Economia (`economia`, 3.0.0) | Produção, trabalho, empresas, preços, consumo, crédito, contas, balanços, PIB, resultado fiscal e auditorias. | Continua sendo o motor econômico existente; regras contábeis permanecem na Economia. |
| Sociedade (`sociedade`, 1.0.0) | Pessoas, demografia, mobilidade, cultura e qualidade de vida. | Não escreve nas contas, empregos ou idades econômicas; a qualidade de vida é parcial quando faltam dados. |
| Política (`politica`, 1.0.0) | Grupos de interesse, influência, satisfação, relação com o governo e impactos. | Representatividade pode ser estimada/incompleta; grupos podem se sobrepor. |
| Instituições (`instituicoes`, 1.0.0) | Câmara, bancadas, assentos, quórum, maioria, coalizão, oposição e mandatos. | Representa grupos; não implementa eleição popular nem votação legislativa. |
| Serviços (`servicos`, 1.0.0) | Sete áreas públicas, recursos estratégicos, alavancas, indicadores e efeitos cruzados. | Estado de cenário; não debita o Tesouro nem cria pessoal, obras ou compras. |

A interface oferece oito áreas: Visão geral, Economia, Sociedade, Governo, Política, Instituições, Serviços e desenvolvimento, e Registros. Painéis específicos usam os snapshots dos seus módulos e atualizam-se na navegação e após os fechamentos mensais.

Não há módulo jurídico de legislação nem votação legislativa nesta branch; a Câmara e os mandatos são simulados por Instituições. Esse limite está registrado em [`docs/legislation/`](docs/legislation/).

## Arquitetura e documentação

O HTML carrega os módulos nesta ordem: Core → Eventos → Economia → Sociedade → Política → Instituições → Serviços → interface. O fluxo de fechamento mensal usa `economy:month-closed`; módulos publicam seus próprios eventos e mantêm estado separado. Consulte [a arquitetura geral e os diagramas](docs/architecture/ARQUITETURA_GERAL_V1.md), [contratos e eventos](docs/architecture/CONTRATOS_E_EVENTOS_V1.md) e [inventário de arquivos](docs/architecture/INVENTARIO_DE_ARQUIVOS_V1.md).

As descrições por domínio ficam em [`docs/modules/`](docs/modules/). Os guias práticos são [instalação](docs/gameplay/GUIA_INSTALACAO.md) e [execução](docs/gameplay/GUIA_EXECUCAO.md). Decisões e histórico estão em [`docs/decisions/`](docs/decisions/) e [`docs/releases/HISTORICO_DE_VERSOES.md`](docs/releases/HISTORICO_DE_VERSOES.md).

## Requisitos e comandos

- Node.js 18 ou superior.
- Git e navegador moderno.
- Não há dependências npm externas no momento.

Na raiz do repositório:

```bash
npm install
npm run build
npm test
npm start
```

`npm run dev` continua disponível e também inicia o servidor. Abra `http://localhost:3000`. Para alterar a porta/endereço, defina `PORT` e/ou `HOST` (padrões `3000` e `127.0.0.1`). O servidor libera `index.html`, `style.css`, módulos JavaScript apenas dos diretórios de runtime aprovados e extensões de assets permitidas em `public/`; não expõe testes, configuração ou outros arquivos da raiz.

## Testes e automação

`npm run build` executa verificações sintáticas de servidor, módulos e testes. `npm test` executa a suíte econômica existente, testes de Sociedade, Política, Instituições e Serviços, uma integração real entre módulos e um smoke test HTTP do servidor. Na validação local de `reconciliacao-final`: 102 verificações do runner (incluindo 61 cenários internos da Economia), 16 testes de Sociedade, 21 de Política, 22 de Instituições e 23 de Serviços passaram. A integração real cobriu Economia/Core/Sociedade/Política/Instituições/Serviços em 12, 24 e 60 meses, imigração, reset e auditorias mensais; os testes HTTP verificaram assets e bloqueio de caminhos proibidos. Rode novamente após qualquer mudança.

O workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) valida Node 18 e 22 em push para `main`, `integracao-governo-1.0` e `reconciliacao-final`, e em PR para `main`. Nenhuma instalação, release, publicação ou merge na `main` é feita automaticamente pelo README.

## Integridade e limitações conhecidas

- Os identificadores de domicílios são validados após normalização no Core e na Sociedade; IDs repetidos são rejeitados sem atualização parcial. Migrantes econômicos recebem IDs com prefixo próprio e marcador preservado até a demografia.
- Fechamentos de Sociedade e Serviços ignoram a reentrega do mesmo mês; o avanço mensal de Serviços rejeita retrocesso. Testes cobrem publicação única no fluxo combinado.
- Os serviços públicos representam intensidade e evolução de indicadores de cenário. `budgetLinked` permanece `false`: nenhuma alavanca gera transação financeira.
- A Economia mantém os fechamentos contábeis e os dados fiscais reais do jogo. Uma integração futura de orçamento, folha pública, compras, obras, estoques ou produção estatal precisa ser implementada pela Economia com lançamentos correspondentes, não por uma alteração direta de caixa.
- Não há mecanismo de salvamento/restauração da partida inteira identificado. Eventos V3 serializa o próprio estado, o que não equivale a um save completo.
- O diagrama e as limitações do código estão descritos em [arquitetura](docs/architecture/ARQUITETURA_GERAL_V1.md) e [limites de integração fiscal](docs/modules/SERVICOS.md).

## Contribuição

Trabalhe em branch dedicada a partir da `main`, mantenha cada domínio dono do seu estado, documente alterações de contrato/evento e execute `npm run build` e `npm test`. Para integrar esta branch, abra uma revisão/PR; não faça merge automático na `main`.
