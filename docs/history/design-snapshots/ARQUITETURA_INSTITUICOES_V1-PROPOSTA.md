# Vilarejo | Arquitetura do módulo Instituições 1.0.0

## 1. Objetivo

O módulo Instituições transforma necessidades coletivas da população em demanda por serviços públicos e administra a capacidade de atendimento, os equipamentos existentes, sua conservação e os projetos de expansão.

Ele é uma camada autônoma. Não altera domicílios, pessoas, empregos, salários, produção, contas ou saldos da Economia. Também não altera diretamente os dados demográficos da Sociedade.

## 2. Responsabilidades

- Receber população agregada do Core e, quando disponível, a projeção demográfica publicada pela Sociedade.
- Estimar demanda por sete setores: educação, saúde, segurança, saneamento, mobilidade, energia e administração pública.
- Cadastrar, atualizar e desativar equipamentos institucionais.
- Calcular capacidade instalada, cobertura, qualidade, conservação e déficit de serviço.
- Registrar projetos de implantação e expansão, com prioridade, custo e progresso.
- Processar custeio e investimento informados por uma camada externa.
- Publicar resultados e necessidades orçamentárias para os demais módulos.

## 3. Fora do escopo nesta versão

- Não movimenta o caixa do Tesouro nem qualquer conta da Economia.
- Não cria dinheiro, receita tributária, dívida ou crédito.
- Não contrata servidores nem cria empregos na Economia.
- Não altera escolaridade, saúde, segurança percebida ou felicidade individual na Sociedade.
- Não decide impostos, prioridades políticas ou regras legais.
- Não presume que o vilarejo já possui escolas, hospitais ou infraestrutura. O estado inicial não recebe equipamentos gratuitos.

Essas conexões dependem de adaptadores próprios e regras aprovadas em etapas posteriores.

## 4. Integração com o Core

O arquivo `src/institutions/vilarejo_institutions.js` é UMD: funciona no navegador e pode ser importado por Node.js. No navegador, registra-se automaticamente quando `window.VilarejoRuntime` já existe e o módulo `core` está registrado.

Contrato de módulo:

- ID: `instituicoes`
- Versão: `1.0.0`
- Dependência obrigatória: `core`
- Dependência da Sociedade: opcional, por evento. Isso permite inicialização independente e evita acoplamento rígido.

Eventos consumidos:

| Evento | Uso |
|---|---|
| `world:synchronized` | Atualiza o retrato populacional agregado do Core. |
| `society:month-closed` | Substitui o agregado pela projeção demográfica da Sociedade, quando ela publica dados reconhecíveis. |
| `economy:month-closed` | Processa o ciclo institucional do mês, usando o número do mês informado pela Economia. |
| `game:reset` | Limpa instalações, projetos e histórico institucional. |

Eventos publicados:

| Evento | Conteúdo |
|---|---|
| `institutions:month-closed` | Índice institucional, serviços, capacidade, déficits, orçamento e obras concluídas. |
| `institutions:budget-requested` | Necessidade informativa de custeio e investimento. O campo `status` é `proposal_only`. |

A Economia atualmente sincroniza o Core antes de publicar `economy:month-closed`. Por isso, o listener institucional consegue ler os grupos atualizados no fechamento.

## 5. Ordem dos scripts

No `index.html`, a ordem desejada é:

```html
<script src="src/core/vilarejo_core.js"></script>
<script src="src/events/eventos_v3.js"></script>
<script src="src/economy/script.js"></script>
<script src="src/society/vilarejo_society.js"></script>
<script src="src/institutions/vilarejo_institutions.js"></script>
```

Instituições deve carregar depois de Sociedade para receber a publicação demográfica do mesmo fechamento mensal antes de processar seu próprio ciclo.

## 6. API pública

A API é exposta em `window.VilarejoInstitutions` e, após registro automático, em `window.VilarejoInstitutionsRuntime`.

| Método | Finalidade |
|---|---|
| `createState(options)` | Cria estado institucional independente. |
| `addFacility(state, facility)` | Cadastra equipamento existente. |
| `updateFacility(state, id, changes)` | Atualiza capacidade, qualidade, conservação ou situação. |
| `removeFacility(state, id)` | Remove equipamento. |
| `createProject(state, project)` | Cria projeto de implantação ou expansão. |
| `cancelProject(state, id)` | Cancela projeto ainda não concluído. |
| `updatePopulation(state, population)` | Atualiza a base demográfica agregada. |
| `calculateDemand(population)` | Calcula necessidades setoriais. |
| `calculateServiceLevels(state, population)` | Calcula oferta, cobertura e índices de serviço. |
| `setBudgets(state, {operating, investment})` | Informa os limites mensais simulados. |
| `processMonth(state, options)` | Executa desgaste, manutenção, obras e apuração mensal. |
| `getSnapshot(state)` | Devolve cópia do estado público. |
| `renderDashboard(state, element)` | Renderiza o painel institucional em um elemento DOM. |
| `registerWithRuntime(runtime, options)` | Registra e conecta o módulo ao Core. |

A integração automática oferece métodos equivalentes, além de `reset()` para reinicialização manual e `destroy()` para remover listeners.

## 7. Dados e propriedade

Instituições mantém apenas:

- `facilities`: equipamentos e serviços instalados;
- `projects`: obras planejadas, em andamento, concluídas ou canceladas;
- `population`: retrato demográfico de entrada, sem posse sobre os registros individuais;
- `settings`: parâmetros de desgaste e limites orçamentários;
- `history` e `lastResult`: resultados institucionais.

Os dados recebidos são normalizados e copiados. O módulo não recebe referência mutável a `S.households`.

## 8. Idempotência e reinicialização

`processMonth` não repete o mesmo mês e rejeita meses anteriores. O evento `game:reset` recria o estado institucional. A integração também reinicializa o estado quando detecta retorno do número econômico mensal para um valor inferior ao último processado.

Limitação atual: `newGame()` da Economia não publica um evento próprio de reinicialização no Runtime. Um reinício que retorne exatamente ao mesmo número mensal já processado pode não ser distinguido pelo adaptador. A integração definitiva deve fazer a Economia publicar `game:reset`/`game:initialized` quando reiniciar uma partida, sem depender de inferência.

## 9. Segurança de integração

A saída `institutions:budget-requested` é apenas uma solicitação. Nenhuma rotina de Instituições chama `CORE_RUNTIME.log`, altera `S.accounts`, debita Tesouro, cria folha salarial ou grava em `S.households`. Uma futura integração fiscal deverá ser explícita, transacional e testada separadamente.
