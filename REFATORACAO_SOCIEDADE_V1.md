# Refatoração da Sociedade | Contrato 1.0.0

## 1. Objetivo

Retirar a dependência estrutural do módulo social em relação ao estado interno da Economia. O sistema anterior recebia o objeto econômico inteiro, criava `household.members` dentro dele e recalculava campos que pertencem ao motor econômico. Isso fazia a Sociedade alterar, entre outros, `adults`, `children`, `outOfLaborForce`, `jobs` e `sectorJobs`.

A versão 1.0.0 mantém o cadastro de pessoas em um estado próprio e se comunica com o Core por um adaptador.

## 2. Responsabilidades

**Sociedade é responsável por:**

- cadastro individual e identidade das pessoas;
- idade, transição para vida adulta e terceira idade;
- nascimentos, mortalidade e histórico demográfico;
- imigração, emigração, diversidade cultural e integração;
- indicadores de qualidade de vida, com cobertura explícita dos dados disponíveis;
- projeção agregada por domicílio para futura integração.

**Economia continua responsável por:**

- dinheiro, caixa, depósitos, crédito e balanços;
- empresas, empregos, vagas, salários e folha de pagamento;
- produção, consumo, mercado, preços, impostos e contas nacionais;
- composição agregada dos domicílios que alimenta atualmente seu próprio mercado de trabalho.

**Core continua responsável por:**

- calendário e sessão;
- registro dos módulos;
- barramento de eventos e diretório populacional compartilhado.

## 3. Integração

O arquivo deve ser carregado depois de `src/economy/script.js`. A suíte dedicada é executada por `node src/test/society_test.js`; a suíte econômica existente continua sendo executada separadamente por `node src/test/test_runner.js`:

```html
<script src="src/core/vilarejo_core.js"></script>
<script src="src/events/eventos_v3.js"></script>
<script src="src/economy/script.js"></script>
<script src="src/society/vilarejo_society.js"></script>
```

A Sociedade registra o módulo `sociedade`, dependente de `core` e `economia`. No início, importa os grupos do diretório populacional do Core. A cada `economy:month-closed`, reconcilia apenas mudanças de origem econômica, avança a demografia uma vez e publica `society:month-closed`.

O adaptador também acompanha `game:reset` e volta a semear o cadastro após a próxima sincronização do mundo.

## 4. Contrato de dados

Pontos principais da API:

- `createState({ seed })`: cria estado independente e serializável.
- `seedFromEconomy(state, groups)`: cria o cadastro inicial a partir dos grupos econômicos.
- `reconcileFromEconomy(state, groups, { month })`: aplica apenas diferenças de composição recebidas da Economia, sem apagar a idade individual já acumulada.
- `advanceMonth(state, options)`: avança um fechamento, com proteção contra duplicidade do mesmo mês.
- `addImmigrant(...)` e `removePerson(...)`: alteram o cadastro social e registram mobilidade quando solicitado.
- `getSnapshot(state)`: entrega demografia, mobilidade, cultura, qualidade de vida e projeção.
- `getEconomyProjection(state)`: retorna contagens projetadas por domicílio, sem alterar a Economia.
- `registerWithRuntime(runtime)`: registra e conecta o módulo ao Core.

## 5. Qualidade de vida

Os seis componentes preservados são poder de compra, segurança alimentar, emprego, moradia, infraestrutura e bem-estar familiar. A nova função `calculateQualityOfLife(metrics)` só utiliza indicadores numéricos válidos entre 0 e 100. Os pesos são renormalizados entre os indicadores disponíveis e o resultado informa `coverage`, `measuredDimensions` e `unmeasuredDimensions`.

Na integração atual, o Runtime fornece apenas bem-estar declarado e uma aproximação de emprego. O indicador começa, portanto, como **provisório**. Não se convertem dimensões sem dados em zero, nem se apresenta o resultado parcial como índice completo.

## 6. Proteções e decisões

1. O módulo não recebe o objeto `S` da Economia.
2. A reconciliação usa um registro separado (`economyBaseline`) para distinguir alterações externas de envelhecimento interno.
3. A Sociedade tem gerador pseudoaleatório próprio. A evolução demográfica não consome a semente aleatória da Economia.
4. O fechamento mensal é idempotente por `lastAdvancedMonth`.
5. A projeção econômica é somente leitura. Não reduz empregos nem reescreve `sectorJobs`.
6. Um domicílio removido do diretório econômico é registrado como saída migratória; um novo domicílio é registrado como entrada.
7. A interface de painel foi preservada como `renderDashboard(state, host)`, desacoplada do HTML principal.

## 7. Limite deliberado desta etapa

A Economia ainda utiliza seus próprios totais agregados de adultos e crianças para o mercado de trabalho. A Sociedade passa a manter a distribuição etária individual, mas esta versão não escreve as alterações de nascimentos, mortes ou envelhecimento de volta em `S.households`. Isso evita reintroduzir o acoplamento que a refatoração remove.

O próximo passo, depois de aprovar a versão 1.0.0, é desenhar e testar um adaptador de projeção demográfica para o mercado de trabalho. Esse adaptador deverá definir regras para disponibilidade laboral, aposentadoria, desemprego e atualização dos empregos sem permitir que o módulo social contabilize salários ou contratações.

## 8. Camada de desenvolvimento social

`evolucao_social.js` permanece separada. Seu domínio é maturidade institucional, serviços, obras e manutenção. Ela não deve ser incorporada ao módulo demográfico. A integração futura deverá consumir indicadores publicados pela Economia e pela Sociedade por contratos explícitos.
