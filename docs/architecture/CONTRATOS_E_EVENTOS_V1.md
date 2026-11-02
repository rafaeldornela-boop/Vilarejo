# Contratos de módulos e eventos — implementação atual

Este inventário acompanha as chamadas de registro e eventos dos fontes em `src/`. Eventos são fatos/payloads; snapshots não são comandos financeiros. Os testes de integração exercitam a sequência mensal combinada.

## Registro e dependências

| ID | Versão | Dependências Runtime verificadas | Escopo do registro |
|---|---:|---|---|
| `core` | `0.1.0` | Nenhuma | Registro, calendário, sessão, população e barramento. |
| Eventos V3 | V3 | Não registrado no Core | Estado e API próprios; relação com Economia por helpers/globais. |
| `economia` | `3.0.0` | Registra `core` em `dependencies`; cria Runtime condicionalmente por `VilarejoCore`. | Motor econômico atual. |
| `sociedade` | `1.0.0` | `core`, `economia` | Estado demográfico e snapshot próprios. |
| `politica` | `1.0.0` | `core`, `economia` | Dez grupos de interesse e impactos. |
| `instituicoes` | `1.0.0` | `core`, `economia`, `politica` | Câmara, bancadas, coalizão e mandatos. |
| `saude`, `educacao`, `seguranca`, `ciencia`, `desenvolvimento`, `cultura`, `infraestrutura` | `1.0.0` | `core`, `economia`, `sociedade` | Domínios setoriais com snapshots próprios dentro do módulo Serviços. |
| `servicos` | `1.0.0` | Os sete IDs setoriais | Estado agregado, eventos e dashboard de Serviços. |

**IDs não são nomes de pastas.** Os sete domínios de Serviços estão no mesmo arquivo JavaScript e são registrados separadamente; a lista `dependencies` dentro de cada definição setorial descreve relações temáticas, não dependências verificadas do Runtime.

## Eventos do Core e do jogo

### Core

O Core pode publicar eventos de calendário (`time:day-advanced`, `time:month-started`, `time:year-started`), população (`population:synchronized`, `population:extension-updated`), módulos (`module:registered`, `module:state-updated`), sessão (`game:ready`, `game:running`, `game:paused`, `game:game-over`, `game:reset`) e mundo (`world:synchronized`). `runtime.publish(topic, payload, source)` aceita tópicos de domínio. Publicar não cria consumidor: cada assinatura é registrada por um módulo.

### Eventos consumidos e publicados pelos adaptadores

| Módulo | Consome | Publica no Runtime |
|---|---|---|
| Economia | Nenhuma assinatura própria no barramento identificada | `game:initialized`; `economy:month-closed` |
| Sociedade | `game:reset`, `world:synchronized`, `economy:month-closed` | `society:month-closed` |
| Política | `game:reset`, `game:initialized`, `world:synchronized`, `society:month-closed`, `economy:month-closed`, `politics:interest-impact` | `politics:month-closed`, `politics:influence-changed`, `politics:group-updated` |
| Instituições | `game:reset`, `game:initialized`, `politics:month-closed`, `politics:group-updated`, `politics:influence-changed` | `institutions:month-closed`, `institutions:representation-updated`, `institutions:mandate-renewed`, `institutions:coalition-updated` |
| Serviços | `game:reset`, `economy:month-closed`, `services:policy-impact` | `services:month-closed`, `services:indicator-updated`, `services:policy-updated` |
| Eventos V3 | Nenhum tópico do Core | Nenhum tópico do Core |

A atualização de snapshots por `runtime.modules.updateSnapshot(...)` não é um evento. Eventos V3 tem estrutura `EventosV3` própria, catálogo e serialização; a integração com a Economia ocorre pelo estado e helpers fornecidos.

## Payloads de referência

- `economy:month-closed`: `{ monthNumber, day, year, population, nationalAccounts, fiscalResult, gameOver }`. `fiscalResult` é resultado fiscal nominal; não equivale a orçamento disponível para Serviços.
- `society:month-closed`: snapshot público da Sociedade após reconciliação, evolução demográfica e cálculo das métricas disponíveis.
- `politics:month-closed`: snapshot de Política após evolução de mês; eventos de atualização carregam `groupId`, impacto e/ou snapshot conforme a operação.
- `institutions:month-closed`: snapshot da Câmara/representação após fechamento de Política.
- `services:month-closed`: resultado mensal e snapshot agregado de Serviços.

Os consumidores devem usar o `payload` do envelope emitido pelo Core, validar versão/IDs quando apropriado e ser idempotentes por mês/evento. IDs duplicados na população geram erro antes da substituição do snapshot do Core.

## Regras de integração fiscal

Não emitir transferências de caixa como eventos genéricos. A Economia valida e efetua lançamentos, com contrapartidas e auditoria. No estado atual, as alavancas de Serviços apenas atualizam seu próprio estado e publicam `services:policy-updated`; não alteram relatório fiscal, contas nem dinheiro. Uma futura conexão exige contrato específico de orçamento/execução e testes contábeis.

## Referências de código

- `src/core/vilarejo_core.js`: Runtime, envelope e população.
- `src/economy/vilarejo_economy.js`: sincronização e fechamento econômico.
- `src/society/vilarejo_society.js`: adaptador demográfico.
- `src/politics/vilarejo_politics.js`: impacto, grupos e influência.
- `src/institutions/vilarejo_institutions.js`: representação e mandatos.
- `src/services/vilarejo_services.js`: áreas, alavancas, recursos e adaptação.
