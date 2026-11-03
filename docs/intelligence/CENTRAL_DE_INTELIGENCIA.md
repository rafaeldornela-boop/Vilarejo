# Central de Inteligência — contrato e metodologia

## Escopo

A Central é um módulo analítico determinístico de leitura. Ela acompanha o evento real `economy:month-closed`, obtém os snapshots e as APIs públicas de Economia, Core e Sociedade, e publica seu próprio resumo no Runtime. Não escreve no estado dos motores de domínio, não modifica regras econômicas, não fabrica eventos e não é um modelo de previsão causal ou de inteligência artificial.

O registro mensal só inclui valores numéricos finitos efetivamente disponíveis. Um zero observado é mantido; `null`, valor ausente, `NaN` e infinito são omitidos, não convertidos em zero. Os fluxos sociais mensais só são registrados quando o mês do snapshot coincide com o mês do fechamento. Assim, uma lacuna não é preenchida por interpolação nem confundida com ausência de eventos.

## Métricas observadas

| Grupo | Indicadores | Semântica / fonte |
|---|---|---|
| População | População Core/Economia; população cadastrada na Sociedade | Estoques de pessoas, mantidos como séries separadas porque os cadastros têm contratos distintos. |
| Produção e renda nacional | PIB pela produção e pela renda; VAB total, agropecuária, comércio e oficina; remuneração total do trabalho; consumo das famílias | Fluxos nominais por mês simulado. Origem: APIs públicas das contas nacionais da Economia. |
| Trabalho | Pessoas ocupadas; força de trabalho; desocupação; participação | Contagens e taxas públicas do mercado de trabalho da Economia. Taxas são percentuais, não pontos percentuais acumulados. |
| Preços e aprovação | Inflação mensal; índice de custo de vida; aprovação modelada | Taxa mensal e índices/percentuais modelados pelo motor. Aprovação não é pesquisa observada. |
| Governo | Resultado primário, receita tributária, despesa primária e passivos do governo | Fluxos fiscais nominais mensais e estoque de passivos de balanços, conforme APIs públicas da Economia. |
| Demografia | Nascimentos e óbitos mensais e acumulados; imigração, emigração e migração líquida mensais; imigração/emigração acumuladas | Fluxos mensais e acumulados públicos da Sociedade. Os fluxos mensais exigem mês correspondente. |
| Sociedade | Qualidade de vida, cobertura e mortalidade mensal calculada | Índice social pode ser provisório; a cobertura é armazenada. Mortalidade é óbitos mensais divididos pela população cadastrada, vezes mil; não é extrapolada. |
| Índice calculado | Salário de referência real | Salário nominal de referência dividido pelo índice de custo de vida e escalado à base inicial. Não significa salário médio ou renda média familiar. |

O contrato versionado em `src/intelligence/vilarejo_intelligence.js` é a fonte completa das unidades, tipos (`estoque`, `fluxo mensal`, `taxa`, `índice`, `acumulado`) e fontes por indicador. A Central não apresenta Gini ou renda média porque a referência atual não os produz. Também não cria séries históricas de qualidade dos serviços públicos: a tela de Serviços não fornece snapshot mensal com contrato de série nesta versão.

## Tendências e comparações

O seletor permite 12, 24 ou 60 meses. O gráfico principal exibe valores sem transformação; a comparação entre até três indicadores divide cada observação pela primeira observação não nula da série e multiplica por 100. Isso torna índices relativos comparáveis visualmente, mas não equipara unidades nem demonstra relação causal.

A tendência descritiva requer pelo menos três observações válidas. Ela registra primeiro e último valores, variação absoluta, variação percentual quando a base não é zero e inclinação de regressão linear por mês. Para taxas, a mudança entre extremos é expressa em pontos percentuais. O rótulo de persistência só é atribuído quando as três observações mais recentes são de meses consecutivos e as duas mudanças têm o mesmo sinal.

Uma leitura de aceleração/desaceleração só é produzida com pelo menos seis observações válidas, comparando inclinações de regressão entre a metade inicial e a metade recente da série. “Acelerando” exige sinais iguais e inclinação recente em módulo mais de 25% maior; “desacelerando”, menos de 75%; os demais casos são classificados como ritmo semelhante ou mudança de ritmo sem aceleração persistente. É uma descrição estatística, não uma causa nem uma previsão.

## Regras de alerta

Os alertas são heurísticas internas do jogo. Um sinal isolado aparece como “informativo/em observação”; exige persistência para se tornar atenção ou crítico. A série pode exibir alertas ativos, pendentes por lacuna de dados, informativos e episódios resolvidos.

| Regra | Atenção | Crítico | Persistência |
|---|---|---|---|
| Contração do PIB pela produção | queda ≥10% contra 3 meses antes | queda ≥20% | 2 janelas mensais consecutivas para cada nível |
| Aumento da desocupação | aumento ≥3 p.p. contra 3 meses antes | aumento ≥6 p.p. | 2 janelas consecutivas |
| Inflação mensal alta | ≥5% | ≥10% | 3 fechamentos para atenção; 2 para crítico |
| Queda populacional Core | redução ≥2% contra 3 meses antes | redução ≥5% | 2 janelas consecutivas |
| Queda da remuneração total do trabalho | redução ≥10% contra 3 meses antes | redução ≥20% | 2 janelas consecutivas |
| Mortalidade mensal | pelo menos 2 óbitos e ≥100 óbitos por mil moradores | pelo menos 2 óbitos e ≥200 por mil | 2 meses consecutivos |
| Queda da qualidade de vida | redução ≥5 pontos contra 3 meses antes | redução ≥10 pontos | 2 janelas consecutivas; cobertura mínima de 50% |

As regras completas, inclusive fórmulas, mensagens e IDs, estão em `ALERT_RULES` no módulo. Os limites servem para monitorar o jogo, não são metas oficiais, critérios médicos, diagnósticos ou conclusões sobre economias reais. Qualquer mês faltante quebra a sequência necessária; dados ausentes não são tratados como zero. Coocorrência temporal não significa causalidade.

## Execuções e persistência

Cada execução recebe um ID e mantém no máximo 60 registros mensais em uma instância do contrato canônico `src/shared/vilarejo_history_store.js`. A Central não mantém uma segunda lista paralela de snapshots: cada execução persiste um `historySnapshot` exportado pelo History Store. O envelope é versionado (`vilarejo:intelligence:history:v1`, versão 2) em `localStorage`; a referência à execução ativa fica em `sessionStorage`. Registros do formato legado v1 são migrados preservando valores, qualidade, fonte e ordem dos períodos. Execuções reiniciadas são arquivadas, em vez de sobrescritas. Se o estado econômico reaparece em um mês anterior ao último registro, o módulo conserva o histórico futuro como arquivo e cria uma execução derivada só com o prefixo de meses válido.

A persistência analítica não salva nem restaura a partida econômica. Após recarregar o navegador, a simulação pode reiniciar enquanto as séries anteriores permanecem arquivadas. Se `localStorage` não estiver disponível, houver erro de quota ou o formato persistido for incompatível/ilegível, o módulo continua apenas em memória e informa essa condição; conteúdo incompatível ou ilegível não é sobrescrito. A quantidade de execuções arquivadas não é limitada pelo módulo; o limite de 60 aplica-se a cada execução.

## Calendário civil e calendário econômico

O período do History Store registra o número ordinal do mês fechado (`monthNumber`) e, quando disponível, o dia absoluto de simulação (`absoluteDay`). Ano econômico, proveniência e qualidade permanecem como metadados; o serial mensal não é convertido em mês/ano civil. O calendário gregoriano da interface calcula a data civil a partir do dia absoluto, enquanto o motor mantém seu próprio ciclo econômico de 360 dias (12 meses de 30 dias). Esses calendários continuam independentes; a Central não altera a contagem nem as regras do motor.

## Testes

- `src/test/intelligence_test.js` é uma suíte **unitária**: usa séries sintéticas para testar algoritmos, limiares, persistência, reset e ausências.
- `src/test/intelligence_integration_test.js` é uma suíte **integrada real**: carrega Core, Economia, Sociedade, Política, Instituições, History Store, Inteligência e dashboard em um contexto que espelha `window === globalThis`; avança a Economia real por 12, 24 e 60 fechamentos; compara valores, meses e dias com snapshots/APIs públicas; testa navegação Governo–Inteligência, gráficos, alertas, indisponibilidades, reset e reload.
- `src/test/calendar_test.js` e `src/test/history_store_test.js` verificam separadamente o calendário civil e o contrato canônico, inclusive metadados de proveniência/qualidade. `src/test/test_runner.js` preserva o ambiente econômico existente e verifica ordem de carregamento, calendário e fonte histórica única.

Os comandos oficiais de validação são `npm ci`, `npm run build`, `npm test` e `git diff --check`. O teste integrado não injeta valores econômicos, não publica eventos mensais manualmente e não altera funções, parâmetros ou estruturas internas do motor para forçar resultados.
