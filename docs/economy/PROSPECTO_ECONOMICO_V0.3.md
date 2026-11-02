# VILAREJO | Prospecto Econômico e Arquitetural Consolidado (v0.3 - Versão 2.4)

**Status:** Documento Diretor Consolidado — Reforma Contábil, Crédito e Arquitetura Empresarial (v2.4)  
**Base do Sistema:** `index.html` (v2.4), `test_runner.js`, `server.js`  
**Referencial Teórico:** Modelagem Baseada em Agentes (ABM) e Contabilidade Consistente de Estoques e Fluxos (SFC - Godley & Lavoie).

---

## 1. Escopo da Versão 2.4

A versão 2.4 do Vilarejo consolida quatro reformas estruturais indispensáveis:
1. **Reforma Matemática do Crédito e Inadimplência:** Segregação estrita entre principal vincendo (`principal`), principal vencido (`principalArrears`) e juros vencidos (`interestArrears`).
2. **Reconhecimento Contábil de Juros, Depreciação e Perdas:** DRE empresarial completa (EBITDA, Depreciação não monetária sobre capital físico, EBIT, LAIR, Impostos, Lucro Líquido); segregação no banco entre juros provisionados/accruados, juros recebidos em caixa, juros a receber e baixas contábeis de crédito (*write-downs*).
3. **Auditoria Patrimonial e Consistência Intersetorial SFC:** Balanços patrimoniais completos para Famílias, Empresas, Banco Local, Governo e Setor Externo com 9 verificações automatizadas de consistência estrita.
4. **Cadastro Operacional Central de Empresas (`S.firms`):** Substituição de estruturas dispersas por um registro central operacional permanente com separação entre Propriedade (*ownership*), Operação (*operator*) e Contrato (*contract*), garantindo autonomia contábil entre a Fazenda Estatal e o Tesouro.

---

## 2. Sistema de Crédito e Inadimplência

### 2.1 Estrutura Contratual dos Empréstimos
Cada empréstimo em `S.bankLoans` é definido por:
- `id`: Identificador único do contrato.
- `borrower`: Chave da conta do tomador (`farm`, `commerce`, `workshop`, `landlord`, `house:id`, `treasury`).
- `principal`: Saldo devedor principal vincendo (regular).
- `principalArrears`: Saldo principal vencido e não amortizado.
- `interestArrears`: Juros vencidos acumulados e não pagos.
- `rate`: Taxa de juros mensal contratada ($i = \text{baseRate} + \text{spread} + \text{riskPremium}$).
- `term`: Prazo residual em meses.
- `purpose`: Finalidade econômica do crédito.

### 2.2 Incidência de Juros Correntes
Os juros mensais devidos incidem estritamente sobre a base devedora de principal:
$$J = \text{rate} \times (\text{principal} + \text{principalArrears})$$
**Regra de Ouro:** Não há capitalização de juros sobre juros vencidos ($interestArrears$), eliminando anatocismo fictício não contratado.

### 2.3 Cascata Estrita de Apropriação de Pagamentos
O montante pago pelo tomador no fechamento mensal é apropriado na seguinte ordem hierárquica:
1. **Juros vencidos (`interestArrears`)**: Quitação das obrigações de juros passadas em aberto.
2. **Juros correntes ($J$)**: Apropriação como receita financeira do banco (`bankInterestIncome`). O saldo de juros correntes não quitado acumula-se em `interestArrears`.
3. **Principal vencido (`principalArrears`)**: Amortização prioritária do principal em atraso.
4. **Principal corrente da prestação ($P_{\text{quota}} = \text{principal} / \text{term}$)**: Amortização do principal vincendo. A parcela não paga migra imediatamente para `principalArrears`.
5. **Amortização extraordinária**: Caso haja saldo remanescente, amortiza-se o principal vincendo adicional.

**Reconciliação e Conservação:** O saldo total da dívida é dado por $\text{Dívida Total} = \text{principal} + \text{principalArrears} + \text{interestArrears}$, reconciliável a cada fechamento.

### 2.4 Baixa e Reestruturação de Créditos (`commerceLoanWriteDown` / Liquidação)
Quando ocorre deságio ou liquidação concursal:
- A redução do crédito do banco é exatamente igual à redução da obrigação do devedor ($\Delta \text{Ativo Bancário} = \Delta \text{Passivo Devedor}$).
- A perda é absorvida pelo Patrimônio Líquido bancário (`lastBankCreditLosses`, `cumulativeBankWriteDowns`).
- O alívio de dívida incrementa o Patrimônio Líquido do devedor (`cumulativeDebtorRelief`).
- **Zero movimentação fictícia de caixa:** O livro-caixa não registra trânsito financeiro inexistente; a operação é estritamente contábil-patrimonial.

---

## 3. Resultado Financeiro, Depreciação e Perdas

### 3.1 Demonstração de Resultado do Exercício (DRE) Empresarial
Para cada firma em `S.firms`:
$$\text{Receita Operacional Bruta} - \text{Custos Operacionais e Insumos} = \text{EBITDA}$$
$$\text{EBITDA} - \text{Depreciação Não Monetária} = \text{EBIT}$$
$$\text{EBIT} - \text{Despesas Financeiras (Juros Bancários)} = \text{LAIR (Lucro Antes do IR)}$$
$$\text{LAIR} - \text{Imposto sobre Lucro (IRPJ)} = \text{Lucro Líquido}$$

### 3.2 Depreciação Contábil Não Monetária
A depreciação mensal é apurada sobre o capital físico registrado:
$$\text{Depreciação} = \text{capitalStock} \times \text{depreciationRate}$$
- Reduz diretamente o valor contábil de `capitalStock` no balanço da empresa.
- Deduzida no EBIT para apuração fiscal justa.
- **Não envolve saída monetária de caixa**, preservando a liquidez financeira do tomador e a conservação do dinheiro doméstico.

### 3.3 Apuração Bancária
- **Juros Provisionados (`bankAccruedInterest`)**: Total de juros gerados pela carteira no mês ($J$).
- **Juros Recebidos em Caixa (`bankInterestIncome`)**: Total de juros efetivamente pagos em dinheiro pelos tomadores.
- **Juros a Receber (`interestArrears`)**: Saldo acumulado de juros devidos e não recebidos.
- **Resultado Líquido Bancário**: $\text{Juros Recebidos} - \text{Juros Pagos a Depositantes} - \text{Perdas com Crédito (Write-Downs)}$.

---

## 4. Auditoria Patrimonial Stock-Flow Consistent (SFC)

A função `generateBalanceSheets()` consolida cinco setores institucionais e submete o sistema a **9 verificações automatizadas de consistência estrita**:

1. **Equilíbrio Patrimonial por Setor**: $\text{Ativos} = \text{Passivos} + \text{Patrimônio Líquido}$ para Famílias, Empresas, Banco e Governo.
2. **Consistência de Depósitos**: Depósitos das Famílias = Passivo de Depósitos do Banco Local.
3. **Consistência de Crédito**: Carteira de Empréstimos do Banco = Soma das Dívidas Bancárias dos Tomadores (Famílias + Empresas + Governo).
4. **Créditos Tributários**: Obrigações fiscais das empresas = Créditos a receber do Tesouro.
5. **Salários**: Salários a receber pelas famílias = Salários a pagar pelas empresas.
6. **Aluguéis**: Aluguéis a receber do proprietário = Aluguéis a pagar das famílias.
7. **Simetria de Baixas**: Perdas bancárias acumuladas com write-down = Alívio acumulado de dívida dos tomadores.
8. **Conservação do Caixa Doméstico**: $\text{Caixa Doméstico Total} = \text{Entradas Externas Acumuladas} - \text{Saídas Externas Acumuladas}$.
9. **Integridade Numérica**: Ausência de `NaN`, infinitos ou saldos negativos espúrios em todos os estoques e fluxos.

---

## 5. Cadastro Operacional Central de Empresas (`S.firms`)

`S.firms` constitui a fonte oficial e permanente do registro das empresas do Vilarejo.

### 5.1 Atributos Obrigatórios
Cada registro empresarial contém:
- `id`: Identificador estável (`farm`, `commerce`, `workshop`, etc.).
- `name`: Nome empresarial.
- `sector`: Setor econômico (`agriculture`, `retail`, `construction_services`).
- `ownership`: Estrutura de capital social (`{treasury: number, private: number}`).
- `operator`: Operador da atividade (`"state"` ou `"private"`).
- `contract`: Regime contratual e obrigações institucionais.
- `account`: Conta de liquidação no livro-caixa.
- `cash`: Caixa líquido disponível.
- `capitalStock`: Valor contábil do capital produtivo físico.
- `depreciationRate`: Taxa mensal de depreciação do ativo permanente (0,25% a.m.).
- `inventory`: Quantidade física e valor unitário dos estoques.
- `baseCapacity`: Vagas de trabalho potenciais da planta.
- `activeWorkers`: Trabalhadores atualmente alocados.
- `productivityFactor`: Fator TFP de infraestrutura urbana.
- `revenue`, `costs`, `profit`: Contas de resultado mensal da DRE.
- `loans`: Saldo devedor bancário total.
- `payables`: Obrigações trabalhistas e tributárias correntes.
- `status`: Situação cadastral (`"active"`, `"liquidated"`).

### 5.2 Autonomia da Empresa Estatal
A Fazenda Estatal (`id: "farm"`, `account: "stateFarm"`) é uma unidade econômica autônoma, dotada de patrimônio próprio, receitas de exportação de café, custos operacionais e capital de giro, distinguindo-se formalmente do caixa do Tesouro Nacional (`"treasury"`).
