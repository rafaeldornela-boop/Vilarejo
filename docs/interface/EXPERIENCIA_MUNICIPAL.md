# Experiência municipal — interface do Vilarejo

## Escopo

Esta camada reorganiza a interface do jogo já existente, preservando a simulação econômica e seus contratos. Não altera fórmulas, parâmetros, eventos de domínio ou regras do motor. As oito áreas continuam acessíveis: Visão geral, Economia, Sociedade, Governo, Serviços, Inteligência, Jornal e Histórico. A antiga área visual “Oficina” é apresentada como “Serviços”; nomes internos dos motores não são renomeados.

## Origem dos dados e integração

| Área | Fonte consumida | Regra de apresentação |
|---|---|---|
| Resumo e séries | `VilarejoIntelligenceRuntime.service`, `getCurrentHistory()` e `getCurrentRunId()` | Os fechamentos oficiais alimentam o History Store compartilhado; o dashboard não mantém buffer mensal concorrente. |
| Estado corrente | `VilarejoTest.stateSnapshot()`, `VilarejoRuntime.snapshot()` e `VilarejoSocietyRuntime.getSnapshot()` | O dashboard usa as APIs já publicadas pelo jogo. Valores devem ser finitos e observados para serem exibidos como números. |
| Calendário e agenda | `calendar.absoluteDay`, `VilarejoRuntime.events.getHistory()` e eventos recentes publicados por Sociedade | Só rótulos e períodos existentes são mostrados. Sem dia publicado, a interface informa que a data específica não está disponível; entradas técnicas sem rótulo não viram acontecimentos. |
| Governo | Snapshots públicos de Política e Instituições | A interface renderiza os contratos atuais dos módulos, sem inferir assentos, políticas ou consequências ausentes. |
| Mapa setorial | Snapshot da simulação, por setor selecionado | Exibe apenas agregados que o snapshot realmente publica, com fonte; a seleção do desenho não representa consulta espacial. |
| Escolhas | Botões existentes em `#actions` e `#eventOptions`; observador local da interface | Texto/opções vêm do motor. Custos ou riscos não são criados pela camada visual. |

### Dois calendários, sem conversão de regra

A data civil é uma projeção visual do dia absoluto: o dia 1 da simulação corresponde a 1º de janeiro de 2026 e a conversão usa o calendário gregoriano UTC, incluindo anos bissextos. Em paralelo, os campos econômicos continuam sendo derivados do ciclo vigente de 12 meses × 30 dias = 360 dias. A virada do ano econômico não redefine janeiro nem modifica o relógio do motor.

A agenda junta somente eventos com texto útil e data/período de Core ou Sociedade. Quando há apenas mês econômico, a apresentação não inventa um dia civil. Fechamentos internos de módulos não são exibidos como acontecimentos comunitários por padrão.

`calendar.month` é o mês do ciclo calculado a partir do dia absoluto. O campo `economicMonthNumber` do Core é um contador separado e pode ser `0` antes do primeiro fechamento; o histórico de decisões exibe o dia absoluto e quantos fechamentos antecederam a escolha, sem apresentar esse contador como “mês econômico 0”.

### History Store como única série mensal

`src/shared/vilarejo_history_store.js` e o serviço de Inteligência continuam sendo a fonte canônica das observações mensais por execução. A interface lê `getCurrentHistory()`/`getCurrentRunId()` e renderiza os registros existentes, sem recriar `monthlyHistory` ou outro array de snapshots no dashboard.

`src/ui/decision_observer.js` mantém um livro separado e limitado de **escolhas**, necessário para a área de acompanhamento: texto da alternativa selecionada, identificador da execução, período, medidas finitas whitelisted antes da escolha, medida imediata e medidas do primeiro fechamento posterior. Ele não grava snapshots mensais completos, não alimenta os gráficos históricos e não substitui o History Store. Os registros ficam no armazenamento local do navegador sob versão própria, são filtrados por execução e podem ser apagados se o usuário limpar os dados do navegador.

### Comparação de decisões

O observador escuta a fase de captura do clique em uma alternativa real do motor, registra apenas a escolha e um retrato de medidas disponibilizadas naquele momento, e captura uma leitura imediata após a ação. No evento oficial `economy:month-closed`, compara essas medidas com as observações do primeiro fechamento posterior da mesma execução. `game:reset` e a detecção de execução arquivada encerram pendências sem fabricar comparação.

A interface usa os rótulos “Aguardando fechamento”, “Comparação observada” e “Sem comparação”. A diferença é descritiva: mudanças entre períodos podem ter outras causas e não demonstram que a escolha produziu aquele resultado. Campos ausentes não são convertidos em zero.

## Calendário visual e mapa

Os controles do tempo permanecem fixos no topo. A agenda combina a data civil com a etapa do calendário econômico, e a linha de progresso informa explicitamente qual escala representa. Setores selecionáveis do SVG esquemático atualizam o painel lateral com métricas agregadas e suas fontes.

O desenho do mapa e os seus edifícios, campos, moradias, vias e instalações são **ilustrativos**, não georreferenciados. O motor atual não expõe IDs, coordenadas, polígonos ou trajetórias individuais de propriedades, bairros, estradas, obras ou instalações; portanto, esta interface não afirma acompanhar expansão urbana, construções, plantações ou mudanças territoriais reais. Para isso, os módulos de domínio precisariam publicar entidades espaciais versionadas e eventos de alteração correspondentes.

O modal de decisões inclui uma ilustração editorial genérica de reunião comunitária, com legenda explícita de que não retrata o acontecimento nem um resultado específico. Eventos aparecem com texto publicado pelo motor; não se geram imagens específicas de incidentes sem categoria, mídia ou descrição visual confiável fornecida por um contrato de domínio.

## Indisponibilidades preservadas

- O índice de Gini e a renda média permanecem indisponíveis quando não publicados pelo motor; não há linha sintética, valor padrão ou proxy rotulado como esses indicadores.
- Saúde, educação e segurança não possuem séries específicas na referência atual. Capacidade urbana, preço de serviço local, lotes ou caixa público não são apresentados como desempenho de serviço público.
- Quando um campo não existe ou não é numérico, a interface informa “Indisponível” e não o converte em zero.
- O mapa pode mostrar totais agregados, mas não atribui posição ou propriedade a eles.

## Testes e verificação visual

`src/test/interface_integration_test.js` verifica unicidade das rotas/IDs, scripts e histórico canônico, navegação, estado inicial do observador e independência entre calendários. `src/test/decision_observer_test.js` cobre validação, persistência local, separação por execução, comparação, reset e campos ausentes. `src/test/intelligence_integration_test.js` executa a Economia real em horizontes de 12, 24 e 60 fechamentos e verifica integração com Core, Sociedade, Política, Instituições, History Store, calendário, dashboard, Governo, Serviços e Inteligência.

A interface foi inspecionada no navegador em 1280 px e com capturas Chromium em 1024×900, 768×1024 e 390×844; o calendário usa toda a largura, empilha a agenda em larguras médias e separa título/controles em celulares. A tela do Jornal mostrou o empty state editorial, sem notícias fabricadas. A implementação não inclui um runtime de Jornal neste repositório.

No navegador, uma escolha real de “Vender lote” foi registrada antes de um fechamento real da Economia. O acompanhamento exibiu “Comparação observada”, valores imediatos e deltas até o fechamento; a escolha e seus números permaneceram em Histórico após recarga. A recarga inicia uma nova execução econômica, então o resumo da Visão geral filtra a nova execução enquanto o registro anterior continua no Histórico local pelo seu `runId`. O gráfico de PIB gerou SVG após o fechamento; a Central indicou zero alertas persistentes nessa execução. O motor não emitiu um evento que abrisse o modal durante esse cenário; o conteúdo dinâmico de uma decisão modal não foi validado ao vivo.

## Limitações remanescentes

1. A geografia é esquemática: propriedades, bairros, estradas, instalações e alterações territoriais não podem ser selecionados como entidades reais sem novas APIs do motor.
2. A ilustração de evento é contextual, não específica. Sem metadados visuais/eventuais do motor, associar uma imagem particular poderia inventar o tipo ou a consequência do episódio.
3. O armazenamento de histórico e das observações de decisão é local ao navegador, não sincronizado entre dispositivos/usuários.
4. Gini e indicadores setoriais de serviços públicos seguem indisponíveis até que o motor publique suas definições e séries.
5. O Jornal ainda não tem um runtime editorial; a interface apresenta apenas o estado vazio até que o módulo correspondente seja fornecido.
6. A execução econômica corrente não é restaurada após recarga; a nova execução recebe outro `runId`, enquanto registros de decisões anteriores seguem consultáveis em Histórico.
