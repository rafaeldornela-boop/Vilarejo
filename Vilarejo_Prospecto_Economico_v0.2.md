# VILAREJO | Prospecto Econômico e Arquitetural Consolidado (v0.2)

**Status:** Documento Diretor de Arquitetura Econômica, Contábil e Institucional (Stock-Flow Consistent & Agent-Based Model)  
**Fontes Consolidadas:**  
1. Auditoria Econômica e Técnica Independente (v2.3)  
2. Documento de Arquitetura `Vilarejo_Arquitetura_Economica_v0.1.md`  
3. Código-fonte atual (`index.html` v2.3) e bateria de estresse `window.VilarejoTest`  
4. Referências Metodológicas Oficiais (IBGE, Banco Central do Brasil, IPEA, Tesouro Nacional e literatura SFC de Godley & Lavoie)

> **Escopo deste documento:** Este prospecto consolida o diagnóstico rigoroso do motor atual (v2.3), resolve divergências entre indicadores macroeconômicos oficiais e a escala microeconômica do vilarejo, formaliza a matriz contábil de estoques e fluxos (SFC), estabelece as equações comportamentais e define o roteiro técnico de evolução da arquitetura sem alterar o código nesta etapa.

---

## 1. Visão Geral e Princípio Diretor

**Vilarejo** é um simulador econômico baseado em agentes (*Agent-Based Model* — ABM) acoplado a uma contabilidade rigorosa de fluxos e estoques (*Stock-Flow Consistent* — SFC). O jogador administra as instituições e políticas públicas de um pequeno núcleo populacional agrário que pode evoluir organicamente para uma vila comercial e, posteriormente, uma cidade complexa.

### 1.1 Regra de Ouro do Design
1. **Zero Progressão Artificial:** Não existem "níveis de cidade", pontos de experiência (XP) ou desbloqueios arbitrários por tempo de jogo.
2. **Emergência Econômica:** A urbanização emerge exclusivamente do excedente econômico, da divisão social do trabalho, da acumulação de capital, da demanda agregada local, da oferta de crédito, da provisão de infraestrutura e dos fluxos migratórios.
3. **Indicadores como Leitura, não Meta:** Nenhum indicador (PIB, inflação, desocupação, aprovação) é manipulado diretamente. Todo indicador é uma fotografia derivada dos balanços patrimoniais e das transações registradas no livro-caixa.
4. **Simetria de Crescimento e Regressão:** Se a base produtiva colapsar, se a inflação corroer a renda real ou se a infraestrutura falhar em acompanhar o adensamento, a cidade deve estagnar, encolher por emigração ou sofrer crises fiscais e bancárias.

---

## 2. Diagnóstico Consolidado do Motor Atual (v2.3)

O confronto entre a auditoria de código e a arquitetura `v0.1` confirma que a versão 2.3 é uma excelente prova de conceito para o fluxo de caixa em partidas dobradas, mas possui **falhas contábeis latentes e amarras estruturais** que impedem a transição para uma economia multissetorial.

### 2.1 Matriz de Estado dos Sistemas Atuais

| Subsistema | Status Técnico | Diagnóstico Consolidado |
| :--- | :--- | :--- |
| **Livro-Caixa (`log`) e Conservação de Caixa** | Implementado e Consistente | Toda transferência deduz da origem e credita no destino. A identidade `Entradas Externas - Saídas Externas = Caixa Doméstico Total` fecha com erro zero nos 11 testes de estresse. |
| **Auditoria Patrimonial Completa (SFC)** | Parcialmente Implementado | `auditCashConservation()` audita apenas **moeda física/caixa** (`accounts` + `household.cash`). Não audita o balanço patrimonial completo (ativos reais, estoques, depósitos bancários como passivo do banco e carteira de crédito). |
| **Sistema Bancário e Amortização (`settleBankLoans`)** | Implementado com Inconsistência Contábil Crítica | **Bug confirmado:** quando há atraso na prestação, `loan.arrears` acumula principal + juros vencidos. No mês seguinte, todo o `loan.arrears` é somado a `interestDue`. Quando o devedor quita o atraso, o principal vencido é apropriado como receita de juros (`interestIncome`), subamortizando a dívida principal e inflando artificialmente o lucro bancário e a remuneração dos depositantes. |
| **Apuração de Resultado Empresarial (`settleProfitTax`)** | Implementado com Distorção Econômica | O lucro tributável da fazenda ignora a **depreciação do capital físico** e não deduz claramente as **despesas financeiras (juros pagos ao banco)** da base de cálculo do imposto sobre o lucro, superestimando o lucro econômico. |
| **Mercado de Trabalho (`assignJobs`, `updateEmploymentCapacity`)** | Simplificado / Monocêntrico | Vagas dependem exclusivamente da margem da cafeicultura. A alocação (`assignJobs`) percorre o array `S.households` sequencialmente, privilegiando sempre as primeiras famílias da lista sem considerar salário de reserva individual, qualificação ou competição entre empresas. |
| **Indicador de Desemprego** | Conceitualmente Inadequado | Divide adultos sem ocupação pelo total de adultos, sem distinguir *Força de Trabalho* (ocupados + desocupados em busca ativa) de *Pessoas Fora da Força de Trabalho* (conceito PNAD Contínua/IBGE). |
| **Decisão de Investimento (`autoInvestAtLowRates`)** | Implementado com Regra Míope | Compara o retorno estimado de um único mês (`farmROI` ou `landlordROI`) diretamente com a taxa mensal de juros (`creditRate`), sem cálculo de Valor Presente Líquido (VPL), vida útil do ativo, depreciação ou risco de ociosidade. |
| **Formação de Preços (`updateMarketPrice`)** | Parcialmente Implementado | Reage ao câmbio, ao markup comercial e à razão de escassez/excesso de estoque de um único produto (cesta básica). Ainda representa variação de preço de item único, não um índice geral de inflação local. |
| **Governança Estatal vs. Privada** | Parcialmente Implementado | Na fazenda estatal, os lucros retidos acumulam-se indefinidamente no caixa operacional sem política explícita de distribuição de dividendos ao Tesouro, formação de reservas ou orçamento de investimento. |

---

## 3. Constituição Contábil e Matriz Estoque-Fluxo (SFC)

Para garantir consistência contábil estrita (padrão Godley & Lavoie), toda evolução do código deve respeitar duas tabelas fundamentais: a **Matriz de Balanços Patrimoniais (Estoques)** e a **Matriz de Transações e Fluxos**.

### 3.1 Matriz de Balanços Patrimoniais por Setor Institucional

Sinais: `+` Ativo (aplicação de recursos) | `-` Passivo (fonte de recursos / obrigação).

| Ativo / Passivo | Famílias ($H$) | Empresas ($F$) | Banco Local ($B$) | Governo ($G$) | Setor Externo ($X$) | Soma Horizontal |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Caixa / Reservas Monetárias ($M$)** | $+M_H$ | $+M_F$ | $+M_B$ | $+M_G$ | $-M_{ext}$ | $0$ |
| **Depósitos Bancários ($D$)** | $+D_H$ | $+D_F$ | $-D_B$ | $0$ | $0$ | $0$ |
| **Empréstimos Bancários ($L$)** | $-L_H$ | $-L_F$ | $+L_B$ | $-L_G$ | $0$ | $0$ |
| **Contas a Receber / Pagar ($\text{Arrears}$)** | $+A_{w}$ / $-A_{rent}$ | $-A_{w}$ / $-A_{tax}$ | $+A_{int}$ | $+A_{tax}$ | $\pm A_{ext}$ | $0$ |
| **Estoques Físicos ($INV$)** | $0$ | $+INV_F$ | $0$ | $0$ | — | $+INV_F$ |
| **Capital Físico e Terra ($K, T$)** | $+K_H, +T_H$ | $+K_F, +T_F$ | $0$ | $+K_G, +T_G$ | — | $+K_{total} + T_{total}$ |
| **Participações Societárias ($E$)** | $+E_H$ | $-E_F$ | $-E_B$ | $+E_G$ | $+E_X$ | $0$ |
| **Patrimônio Líquido ($NW$)** | $-NW_H$ | $-NW_F$ | $-NW_B$ | $-NW_G$ | $-NW_X$ | $-(INV + K + T)$ |

### 3.2 Identidades Contábeis Invioláveis (Etapa 0)

1. **Identidade de Caixa por Agente ($i$):**
   $$\text{Caixa}_{i,t} = \text{Caixa}_{i,t-1} + \sum \text{Recebimentos Efetivos}_{i,t} - \sum \text{Pagamentos Efetivos}_{i,t}$$
   *Regra:* Nenhum agente doméstico pode ter $\text{Caixa}_{i,t} < 0$. Pagamentos parciais geram registro explícito na conta de passivo correspondente (salário atrasado, tributo pendente, juros vencidos ou principal vencido).

2. **Segregação Estrita de Contratos de Crédito ($c$):**
   Cada contrato de empréstimo $c$ deve manter **três saldos distintos**:
   - $P^{reg}_{c,t}$: Principal vincendo (regular)
   - $P^{arr}_{c,t}$: Principal vencido em atraso
   - $I^{arr}_{c,t}$: Juros vencidos em atraso
   
   No fechamento mensal, os juros correntes incidem sobre o saldo devedor de principal ($J_{c,t} = r_c \cdot (P^{reg}_{c,t-1} + P^{arr}_{c,t-1})$) e a quota de amortização do período é $A_{c,t} = P^{reg}_{c,t-1} / \text{prazoRestante}$.
   - **Ordem obrigatória de apropriação do pagamento ($Pag_t$):**
     1. Quitação de Juros Vencidos ($I^{arr}_{c,t-1}$) -> Reconhecido como Receita de Juros do Banco.
     2. Quitação de Juros Correntes ($J_{c,t}$) -> Reconhecido como Receita de Juros do Banco.
     3. Quitação de Principal Vencido ($P^{arr}_{c,t-1}$) -> Reduz o Ativo de Crédito do Banco (Amortização, **não** receita de juros).
     4. Quitação de Principal Corrente ($A_{c,t}$) -> Reduz $P^{reg}_{c,t}$ (Amortização, **não** receita de juros).

3. **Distinção entre Moeda Base (Caixa) e Meios de Pagamento (M1/M2 Local):**
   - **Base Monetária Local (Caixa Total):** $\sum M_{\text{agentes}} = \text{Entradas Externas Acumuladas} - \text{Saídas Externas Acumuladas}$.
   - **Haveres Financeiros das Famílias:** $M_H + D_H$. Quando uma família deposita $\Delta D$ no banco, $M_H$ cai em $\Delta D$, $M_B$ sobe em $\Delta D$ e nasce o par Ativo/Passivo $+D_H / -D_B$. Quando o banco empresta $\Delta L$ a uma empresa, $M_B$ cai em $\Delta L$, $M_F$ sobe em $\Delta L$ e nasce o par $+L_B / -L_F$.

4. **Estoque e Capital Produtivo:**
   $$INV_{f,t} = INV_{f,t-1} + Q^{\text{prod}}_{f,t} + Q^{\text{comp}}_{f,t} - Q^{\text{vend}}_{f,t} - Q^{\text{perda}}_{f,t}$$
   $$K_{f,t} = K_{f,t-1} \cdot (1 - \delta_f) + I^{\text{concluído}}_{f,t} - K^{\text{alienado}}_{f,t}$$

---

## 4. Arquitetura de Agentes, Empresas e Propriedade

Em vez de variáveis globais fixas para `stateFarm`, `privateFarm` e `commerce`, o motor deve operar sobre um **Cadastro Geral de Empresas (`S.firms`)** e um **Cadastro de Unidades Domiciliares e Indivíduos (`S.households`)**.

### 4.1 A Estrutura de Empresa Genérica (`Firm`)

Cada empresa é um objeto autônomo contendo:
- **Identidade e Setor:** `id`, `name`, `sector` (`agriculture`, `retail`, `construction`, `services`, `manufacturing`, `utilities`).
- **Três Dimensões Institucionais Separadas:**
  1. **Propriedade (`ownership`):** Lista de acionistas/quotistas e suas participações percentuais (`{ treasury: 0.6, "house:1": 0.4, external: 0 }`).
  2. **Operação (`operator`):** Quem administra (`state`, `private`, `concessionaire`).
  3. **Regulação/Contrato (`contract`):** Parâmetros caso seja concessão ou PPP (prazo, tarifa-teto, outorga fixa/variável, obrigação de investimento, subsídio por universalização).
- **Balanço e Operação:**
  - `cash`, `deposits`, `inventory` (por tipo de insumo e produto final), `capitalStock` ($K$), `landLots` ($T$), `depreciationRate` ($\delta$).
  - `payables` (`wages`, `taxes`, `suppliers`), `loans` (referências aos contratos no banco).
  - `workers` (lista de vínculos), `openVacancies`, `offeredWage`, `productivityFactor`.
  - `dividendPayoutRatio` (% do lucro líquido distribuído aos sócios) e `retainedEarningsReserve`.

### 4.2 Os Cinco Modelos de Propriedade e Gestão

| Modelo | Estrutura Societária e Operacional | Regras de Fluxo Financeiro, Tributação e Dividendos |
| :--- | :--- | :--- |
| **1. Empresa Pública Integral** | `ownership: { treasury: 1.0 }`<br>`operator: "state"` | Possui caixa e balanço separados do Tesouro. Define política explícita de destinação do lucro líquido ($\Pi_{liq}$): $\alpha_{reinv}$ para reserva de expansão e $(1-\alpha_{reinv})$ transferido ao Tesouro como **Dividendos de Estatal**. Se operar com tarifa social deficitária, o subsídio do Tesouro entra explicitamente como receita operacional de subvenção. |
| **2. Empresa Privada Integral** | `ownership: { "house:x": p, external: 1-p }`<br>`operator: "private"` | Paga encargos sobre folha, impostos indiretos e imposto sobre o lucro líquido real (`profitTax`). Distribui dividendos proporcionalmente aos sócios privados conforme `dividendPayoutRatio`. |
| **3. Sociedade de Economia Mista (Venda Parcial)** | `ownership: { treasury: p_g, private: 1-p_g }` | Na alienação parcial de quotas, o Tesouro recebe o valor da venda das ações. Nos meses seguintes, a empresa é tributada normalmente como pessoa jurídica e distribui dividendos: o Tesouro recebe exatamente $p_g \times \text{Dividendos Distribuídos}$, e os sócios privados recebem $(1-p_g)$. |
| **4. Concessão de Serviço Público** | Ativo Físico pertence ao Governo (`K_G`); `operator: "concessionaire"` | A concessionária privada opera o ativo por prazo determinado, arrecada tarifas dos usuários, paga os custos operacionais, manutenção e outorga contratual ao Tesouro (fixa ou % da receita operacional), mantendo o lucro residual tributável. Ao fim do contrato, os ativos reversíveis retornam ao Estado. |
| **5. Parceria Público-Privada (PPP)** | Contrato compartilhado (`sponsored` ou `administrative`) | Usada quando a tarifa do usuário não cobre o VPL do projeto (ex: saneamento, transporte inicial, habitação social). A receita da operadora combina tarifa do usuário + **contraprestação pecuniária do Tesouro**, condicionada a metas de disponibilidade/qualidade. |

---

## 5. Indicadores Econômicos: Fundamentação Oficial vs. Adaptação Microeconômica

Abaixo separamos rigorosamente a **metodologia oficial brasileira**, a **adaptação para a escala inicial do Vilarejo** e a **regra de transição conforme a cidade cresce**.

### 5.1 Atividade Econômica: Valor Adicionado e PIB Local
- **Fundamento Oficial (IBGE — Sistema de Contas Nacionais):** O Produto Interno Bruto pela ótica da produção é a soma dos Valores Adicionados Brutos (VAB) de todas as unidades residentes mais os impostos líquidos de subsídios sobre produtos:
  $$\text{VAB}_f = \text{Valor Bruto da Produção}_f - \text{Consumo Intermediário}_f$$
  $$\text{PIB}_{\text{local}} = \sum_{f} \text{VAB}_f + \text{Impostos s/ Produtos} - \text{Subsídios s/ Produtos}$$
- **Adaptação para o Vilarejo:**
  - Na **Fazenda**, $\text{VAB}_{\text{fazenda}} = \text{Valor da Produção de Café} - \text{Insumos Agrícolas Consumidos}$.
  - No **Comércio**, a produção não é o valor total das cestas vendidas (evitando dupla contagem), mas a **margem comercial bruta**: $\text{VAB}_{\text{comércio}} = \text{Vendas de Cestas} - \text{Custo das Mercadorias Vendidas (CMV)} - \text{Serviços Intermediários}$.
  - Na **Construção**, $\text{VAB}_{\text{construção}} = \text{Valor das Obras Executadas} - \text{Materiais de Construção Consumidos}$.
- **Apresentação na Interface:** Na fase de pequeno vilarejo, exibir **"Valor Adicionado Local (R$)"** discriminado por setor (Agropecuária, Comércio/Serviços, Construção, Administração Pública), permitindo ao jogador ver a mudança estrutural da economia.

### 5.2 Mercado de Trabalho: Ocupação e Desocupação
- **Fundamento Oficial (IBGE — PNAD Contínua):**
  - *População em Idade de Trabalhar (PIT):* Adultos aptos.
  - *Força de Trabalho ($FT$):* $\text{Ocupados} (O) + \text{Desocupados em busca ativa} (U)$.
  - *Fora da Força de Trabalho ($FFT$):* Adultos incapacitados, estudantes em tempo integral, cuidadores exclusivos ou desalentados.
  - $\text{Taxa de Desocupação} = \frac{U}{O + U} \times 100$.
- **Adaptação para Pequena Amostra:**
  - Com 6 a 15 adultos, a saída de 1 pessoa altera a taxa percentual em mais de 10 p.p.
  - **Regra de Interface:** Exibir sempre os **números absolutos primeiro** (`"6 ocupados · 1 procurando emprego · 1 fora da força"`) acompanhados da taxa percentual e de uma média móvel trimestral, evitando alarmes falsos por variação de 1 habitante.

### 5.3 Preços, Custo de Vida e Inflação Local
- **Fundamento Oficial (IBGE — IPCA):** Índice de Laspeyres que mede a variação do custo de uma cesta de bens e serviços ponderada pela Pesquisa de Orçamentos Familiares (POF):
  $$I_t = \sum_{k=1}^{K} w_k \cdot \left(\frac{P_{k,t}}{P_{k,0}}\right) \times 100 \quad ; \quad \pi_t = \left(\frac{I_t}{I_{t-1}} - 1\right) \times 100$$
- **Adaptação Progressiva:**
  - Enquanto houver apenas alimentos e moradia, o painel informa **"Custo da Cesta e Habitação (R$)"** e sua variação mensal (%).
  - À medida que surgem vestuário, serviços locais, energia e transporte (Etapa 3), o índice passa a agregar os $K$ grupos com pesos orçamentários ($w_k$) distintos para famílias de baixa e média renda.

### 5.4 Finanças Públicas: Resultado Primário e Nominal
- **Fundamento Oficial (Tesouro Nacional — RTN):**
  - *Receitas Primárias:* Tributos (Renda, Folha, Lucro, Consumo, IPTU/Territorial), Concessões e Dividendos de Estatais.
  - *Despesas Primárias:* Pessoal/Custeio, Moradia Social/Transferências, Subsídios Operacionais e Investimento Público (Obras).
  - $\text{Resultado Primário} = \text{Receitas Primárias} - \text{Despesas Primárias}$.
  - $\text{Resultado Nominal} = \text{Resultado Primário} - (\text{Juros Pagos s/ Dívida Pública} - \text{Juros Recebidos})$.

---

## 6. Modelagem Matemática dos Mecanismos Econômicos

Cada mecanismo segue a estrutura padronizada: **Conceito**, **Equação/Regra**, **Variáveis**, **Comportamento Esperado**, **Consequências no Jogo** e **Riscos de Simplificação**.

---

### 6.1 Produção Setorial e Restrição de Leontief-Cobb-Douglas
1. **Conceito:** A produção exige complementaridade estrita entre capacidade instalada/insumos (Leontief) e produtividade dos fatores trabalho e capital (Cobb-Douglas), sujeita à sazonalidade agrícola e choques climáticos.
2. **Equação:**
   $$Q^{\text{pot}}_{f,t} = A_f \cdot K_{f,t}^{\beta_f} \cdot L_{f,t}^{1-\beta_f}$$
   $$Q^{\text{efetiva}}_{f,t} = \min\left(Q^{\text{cap}}_{f,t}, \; Q^{\text{pot}}_{f,t}, \; \frac{\text{InsumosDisponíveis}_{f,t}}{\phi_f}\right) \cdot \Theta_{f,t}$$
3. **Variáveis:** $A_f$ (tecnologia/produtividade), $K_{f,t}$ (capital líquido de depreciação), $L_{f,t}$ (trabalhadores ativos), $\phi_f$ (coeficiente técnico de insumo por unidade de produto), $\Theta_{f,t}$ (fator climático/operacional).
4. **Comportamento Esperado:** A contratação de trabalhadores sem capital de giro para comprar insumos ($\text{InsumosDisponíveis} = 0$) resulta em produção zero e prejuízo com folha salarial.
5. **Consequências no Jogo:** Obriga as empresas e o jogador a gerenciarem capital de giro, estoques de insumos e manutenção do capital físico.
6. **Riscos de Simplificação:** Se $\beta_f$ não for calibrado por setor, pequenas firmas de serviços exigiriam capital físico excessivo. Serviços terão $\beta_f$ baixo; indústria e infraestrutura terão $\beta_f$ elevado.

---

### 6.2 Formação de Preços e Ajuste Parcial
1. **Conceito:** Precificação por *cost-plus* (custo unitário médio mais margem alvo) modulada pela pressão de demanda/estoque e concorrência setorial, com inércia de ajuste parcial.
2. **Equação:**
   $$c_{f,t} = \frac{\text{CustoInsumos}_{f,t} + \text{FolhaEsperada}_{f,t} + \text{Depreciação}_{f,t}}{Q^{\text{normal}}_{f,t}}$$
   $$\mu^{\text{alvo}}_{f,t} = \bar{\mu}_s \cdot \left(1 + \alpha_D \cdot \frac{D_{f,t-1} - S_{f,t-1}}{\max(1, S_{f,t-1})} - \alpha_N \cdot (N_s - 1)\right)$$
   $$P^{\text{alvo}}_{f,t} = c_{f,t} \cdot (1 + \max(\mu_{\min}, \mu^{\text{alvo}}_{f,t}))$$
   $$P_{f,t} = \lambda P_{f,t-1} + (1 - \lambda) P^{\text{alvo}}_{f,t}$$
3. **Variáveis:** $c_{f,t}$ (custo unitário normal), $\bar{\mu}_s$ (markup base do setor $s$), $D_{f,t-1}$ (demanda), $S_{f,t-1}$ (estoque disponível), $N_s$ (número de firmas concorrentes no setor $s$), $\lambda \in [0.4, 0.7]$ (parâmetro de rigidez nominal).
4. **Comportamento Esperado:** Monopólios locais ($N_s=1$) com estoque baixo praticam markups elevados. A entrada de uma segunda mercearia ou feira local ($N_s > 1$) comprime o markup e reduz o custo de vida.
5. **Consequências no Jogo:** A abertura de novas empresas torna-se uma ferramenta real de combate à carestia local.
6. **Riscos de Simplificação:** Choques temporários de produção não devem explodir o custo unitário $c_{f,t}$; por isso utiliza-se a produção em capacidade normal ($Q^{\text{normal}}$) no denominador do custo padrão.

---

### 6.3 Demanda de Trabalho, Salários e Matching
1. **Conceito:** Cada empresa determina suas vagas abertas igualando a receita marginal esperada do trabalhador ao seu custo total (salário + encargos + benefícios). Trabalhadores buscam as vagas que oferecem maior remuneração líquida real acima de seu salário de reserva.
2. **Equação:**
   $$\text{RMgL}_{f,t}(L) = P^{\text{líquido}}_{f,t} \cdot \frac{\partial Q_{f,t}}{\partial L} \geq W_{f,t} \cdot (1 + \tau_{\text{patronal}}) + B_{\text{moradia}}$$
   $$W_{f,t} = \max\left(W_{\min}, \; W_{\text{reserva}} \cdot (1 + \gamma_f \cdot \text{EscassezMãoDeObra}_t)\right)$$
3. **Variáveis:** $\text{RMgL}$ (receita marginal do trabalho líquido de insumos diretos), $W_{\min}$ (salário mínimo legal), $W_{\text{reserva}}$ (salário de reserva local), $\tau_{\text{patronal}}$ (alíquota de encargo patronal).
4. **Comportamento Esperado:** A alocação de vagas (`matchLaborMarket`) prioriza desocupados de domicílios com menor renda per capita ou maior qualificação compatível, eliminando o viés estático de `assignJobs()` pela ordem do array.
5. **Consequências no Jogo:** Empresas mais produtivas conseguem pagar salários maiores e atrair trabalhadores; aumentos excessivos de encargos ou salário mínimo acima da produtividade marginal reduzem as vagas privadas.
6. **Riscos de Simplificação:** Rotatividade excessiva se trabalhadores trocarem de emprego por diferenças de R$ 1,00. Adota-se um custo de transição/fricção de mudança de emprego (ex: exige ganho salarial $\geq 8\%$).

---

### 6.4 Lucro Econômico e Demonstração de Resultado (DRE)
1. **Conceito:** Separação contábil entre Resultado Operacional (EBITDA), Depreciação, Resultado Financeiro (Juros) e Lucro Líquido Tributável.
2. **Equação:**
   $$\text{EBITDA}_{f,t} = \text{ReceitaVendas}_{f,t} + \text{Subsídios}_{f,t} - \text{CMV/Insumos}_{f,t} - \text{Salários}_{f,t} - \text{Encargos}_{f,t} - \text{Aluguéis}_{f,t}$$
   $$\text{LAJIR (EBIT)}_{f,t} = \text{EBITDA}_{f,t} - \delta_f K_{f,t-1}$$
   $$\text{LAIR}_{f,t} = \text{EBIT}_{f,t} - \text{JurosPagos}_{f,t} + \text{JurosRecebidos}_{f,t}$$
   $$T^{\text{lucro}}_{f,t} = \max(0, \text{LAIR}_{f,t} - \text{PrejuízoAcumulado}_{f,t-1}) \cdot \tau_{\pi}$$
   $$\Pi^{\text{líquido}}_{f,t} = \text{LAIR}_{f,t} - T^{\text{lucro}}_{f,t}$$
3. **Variáveis:** Receitas, custos operacionais, depreciação ($\delta_f K$), juros pagos em empréstimos ($\text{JurosPagos}$), alíquota de IRPJ/Lucro ($\tau_\pi$).
4. **Comportamento Esperado:** Empresas endividadas sob juros básicos elevados têm seu lucro tributável reduzido pelas despesas financeiras e podem incorrer em prejuízo líquido mesmo com operação bruta positiva.
5. **Consequências no Jogo:** Conecta diretamente a política monetária (juros básicos) à saúde financeira das empresas e à arrecadação fiscal sobre lucros.
6. **Riscos de Simplificação:** Depreciação reduz o lucro contábil, mas não é saída imediata de caixa; contudo, exige reposição de capital ($I_{\text{reposição}}$) para manter a capacidade produtiva.

---

### 6.5 Consumo, Poupança e Sistema de Despesa Linear (LES)
1. **Conceito:** As famílias alocam sua renda disponível e liquidez primeiro para garantir o consumo de subsistência de cada categoria essencial e distribuem a renda supernumerária entre consumo discricionário e poupança financeira.
2. **Equação:**
   $$C^{\text{min}}_{h,t} = \sum_{k} P_{k,t} \cdot \bar{q}^{\text{min}}_{k} \cdot \text{AdultosEquivalentes}_h$$
   $$\text{RendaSupernumerária}_{h,t} = \max\left(0, \; Y^{\text{disp}}_{h,t} - C^{\text{min}}_{h,t} - \text{Aluguel}_{h,t}\right)$$
   $$C_{h,k,t} = P_{k,t}\bar{q}^{\text{min}}_{k}\text{AE}_h + c_k(r_t) \cdot \text{RendaSupernumerária}_{h,t}$$
   $$S_{h,t} = Y^{\text{disp}}_{h,t} - \sum_k C_{h,k,t} - \text{Aluguel}_{h,t}$$
3. **Variáveis:** $\bar{q}^{\text{min}}_k$ (quantidade física mínima do bem $k$ por adulto equivalente), $c_k(r_t)$ (propensão marginal a consumir o bem $k$, decrescente na taxa real de juros $r_t$).
4. **Comportamento Esperado:** Quando o preço dos alimentos sobe ou a renda cai, as famílias cortam primeiro os bens discricionários e a poupança, podendo sacar depósitos bancários para defender o piso alimentar ($C^{\text{min}}$).
5. **Consequências no Jogo:** Gera a Lei de Engel de forma natural: vilarejos pobres gastam quase tudo em comida; conforme a renda cresce, surge demanda para serviços, manufaturas e lazer.
6. **Riscos de Simplificação:** Se $Y^{\text{disp}} + \text{Caixa} + \text{Saques} < C^{\text{min}}$, ocorre escassez real (fome/racionamento), penalizando severamente o bem-estar e a produtividade.

---

### 6.6 Crédito, Precificação de Risco e Inadimplência
1. **Conceito:** A taxa de juros ativa cobrada pelo banco incorpora a taxa básica, o spread operacional e um prêmio de risco específico do tomador (alavancagem, histórico de atraso e garantias).
2. **Equação:**
   $$r_{c,t} = r_{\text{base},t} + s_{\text{op}} + \rho_c \quad \text{onde} \quad \rho_c = \omega_1 \left(\frac{\text{Dívida}_i}{\max(1, \text{Patrimônio}_i)}\right) + \omega_2 \cdot \text{HistóricoAtrasos}_i$$
   $$\text{InadimplênciaCarteira}_t = \frac{\sum_c (P^{arr}_{c,t} + I^{arr}_{c,t})}{\sum_c (P^{reg}_{c,t} + P^{arr}_{c,t} + I^{arr}_{c,t})} \times 100$$
3. **Variáveis:** $r_{\text{base},t}$ (juros básicos), $s_{\text{op}}$ (spread base), alavancagem do tomador $i$, histórico de atrasos.
4. **Comportamento Esperado:** Tomadores muito endividados ou com prestações em atraso enfrentam crédito mais caro ou têm novos pedidos negados pelo limite de exposição do banco.
5. **Consequências no Jogo:** Evita que empresas insolventes rolhem dívidas infinitamente a juros baixos e protege as reservas dos depositantes.
6. **Riscos de Simplificação:** Se uma empresa falir definitivamente, a baixa do crédito (*write-off*) deve reduzir o ativo de empréstimos do banco ($L_B$) contra o Patrimônio Líquido/Reservas de Lucros do banco ($NW_B$), mantendo a identidade contábil sem destruir o caixa físico existente.

---

### 6.7 Investimento Empresarial via Valor Presente Líquido (VPL)
1. **Conceito:** A decisão de expandir capacidade (comprar lote, construir imóvel ou abrir negócio) compara o custo inicial do investimento com o fluxo de caixa incremental descontado ao longo de um horizonte de avaliação $H$ (ex: 24 meses), considerando taxa de ocupação/demanda esperada e depreciação.
2. **Equação:**
   $$\text{VPL}_{\text{proj}} = \sum_{\tau=1}^{H} \frac{E[\Delta \text{FC}_{\tau}]}{(1 + r_{\text{custo}})^{\tau}} - I_0 > 0$$
3. **Variáveis:** $I_0$ (desembolso inicial de capital), $E[\Delta \text{FC}_\tau]$ (fluxo de caixa operacional líquido incremental esperado considerando demanda não atendida e depreciação), $r_{\text{custo}}$ (custo de capital próprio ou taxa de empréstimo $r_{c,t}$).
4. **Comportamento Esperado:** Corrige a miopia de 1 mês da versão atual. Empresas só expandem se houver demanda sustentada, viabilidade financeira e capacidade de serviço da dívida.
5. **Consequências no Jogo:** Juros básicos altos, impostos excessivos ou queda na demanda travam o investimento privado de forma orgânica.
6. **Riscos de Simplificação:** Como o futuro é incerto, $E[\Delta \text{FC}_\tau]$ usa expectativas adaptativas baseadas na média móvel dos últimos 3 meses.

---

### 6.8 Migração e Demografia
1. **Conceito:** Diferencial de utilidade esperada à la Harris-Todaro combinando renda líquida real esperada, probabilidade de emprego, acesso à moradia e serviços urbanos, convertido por uma função logística calibrada.
2. **Equação:**
   $$U_{\text{local},t} = \frac{\bar{W}_{\text{líquido},t} \cdot (1 - u_t) + B_{\text{moradia},t} + B_{\text{serviços},t}}{I_{\text{custoVida},t}} \quad ; \quad U_{\text{ext},t} = \frac{W_{\text{ext},t}}{I_{\text{ext},t}}$$
   $$\Delta U_t = U_{\text{local},t} - U_{\text{ext},t} - \frac{C_{\text{migração}}}{12 \cdot I_{\text{custoVida},t}}$$
   $$P(\text{Imigração}_t) = \frac{p_{\max}}{1 + \exp(-\kappa \cdot \Delta U_t)} \cdot \mathbb{I}(\text{VacânciaHabitacional}_t > 0)$$
3. **Variáveis:** $\bar{W}_{\text{líquido}}$ (salário líquido médio), $u_t$ (taxa de desocupação), $I_{\text{custoVida}}$ (índice de custo de vida local), $C_{\text{migração}}$ (custo de mudança), vacância habitacional.
4. **Comportamento Esperado:** A cidade atrai moradores quando há vagas remuneradas acima do custo de vida e moradia disponível; perde moradores quando o desemprego sobe, os salários atrasam ou a carestia corrói a renda real.
5. **Consequências no Jogo:** A população responde de forma transparente à gestão econômica e habitacional do jogador.
6. **Riscos de Simplificação:** Na Etapa 6, se a imigração pressionar uma cidade sem vacância habitacional formal, pode emergir ocupação precária/déficit habitacional em vez de travamento rígido, gerando custos sociais e sanitários.

---

## 7. Dinâmica de Evolução Urbana Orgânica

Sem "níveis de cidade", a transformação espacial e institucional do Vilarejo ocorre pelo entrelaçamento de **dois ciclos causais**:

### 7.1 O Ciclo de Expansão e Diversificação
1. **Excedente Primário:** A fazenda exporta café, paga salários e gera renda local.
2. **Adensamento de Demanda Interna:** Com renda disponível acima da subsistência, as famílias demandam alimentos variados, vestuário, reparos e moradia melhor.
3. **Entrada Endógena de Firmas:** Quando a **demanda não atendida** ou o **markup praticado** em um setor supera o limiar de atratividade ($\text{VPL} > 0$), famílias poupadoras locais ou capital externo abrem novas empresas (padaria, oficina, construtora, comércio concorrente).
4. **Multiplicador Urbano:** Novas empresas contratam trabalhadores fora da cafeicultura, reduzindo a dependência monocultora e ampliando a base tributária do Tesouro.

### 7.2 O Ciclo de Pressão, Custos Urbanos e Infraestrutura
1. **Escassez de Terra e Habitação:** O aumento de domicílios e empresas consome lotes disponíveis, elevando o preço da terra e os aluguéis.
2. **Saturação de Infraestrutura:** O aumento da densidade populacional e do número de empresas pressiona o acesso à água, saneamento, energia, saúde e transporte.
3. **Custos de Congestionamento:** Se o Governo (diretamente, via estatal ou via concessão/PPP) não investir na expansão das redes urbanas, a produtividade total dos fatores ($A_f$) das empresas cai e o bem-estar das famílias se deteriora, estancando a imigração ou provocando êxodo.

---

## 8. Roteiro de Implementação em 7 Etapas (Roadmap Técnico)

Para preservar a estabilidade do código e permitir verificação contínua via testes automatizados, a evolução do código seguirá rigorosamente a ordem abaixo:

### Etapa 0 | Correções Críticas de Integridade Contábil (Bloqueante)
- **0.1.** Separar `principalArrears` ($P^{arr}$) e `interestArrears` ($I^{arr}$) nos contratos de empréstimo (`S.bankLoans`).
- **0.2.** Corrigir `settleBankLoans()` para apropriar pagamentos na ordem: juros vencidos $\rightarrow$ juros correntes $\rightarrow$ principal vencido $\rightarrow$ principal corrente, garantindo que amortização de principal vencido nunca infle `bankInterestIncome`.
- **0.3.** Adicionar o **Teste de Estresse 6.10 (Inadimplência e Quitação de Atraso Bancário)** cobrindo exatamente o cenário de atraso de R$ 533,33 e verificando que o principal final cai para R$ 7.318,84 e a receita de juros limita-se a R$ 400,00.
- **0.4.** Incluir despesas de juros pagos e depreciação na apuração de lucro empresarial (`settleProfitTax`).
- **0.5.** Renomear o indicador de desemprego atual para refletir "Adultos sem Ocupação" até a entrada da Força de Trabalho na Etapa 3, e explicitar na auditoria a separação entre Caixa Físico e Depósitos Bancários.

### Etapa 1 | Contratos de Dados e Balanços Patrimoniais (SFC)
- Definir estruturas padronizadas para Famílias, Empresas, Banco, Governo e Setor Externo.
- Implementar gerador automático de Balanço Patrimonial (Ativo, Passivo, Patrimônio Líquido) e DRE a partir dos lançamentos e saldos auditados.

### Etapa 2 | Sistema de Empresa Genérica (`S.firms`)
- Converter a Fazenda e o Comércio em instâncias da classe/estrutura `Firm`, preservando seus módulos produtivos específicos.
- Introduzir uma 3ª atividade local (ex: **Construção Civil / Oficina de Serviços Locais**) operando sob o mesmo contrato de empresa genérica.

### Etapa 3 | Mercado de Trabalho Descentralizado e Múltiplos Bens
- Implementar status laboral individual (`occupied`, `unemployed_seeking`, `out_of_labor_force`).
- Substituir `assignJobs()` por um mecanismo de contratação onde cada empresa abre vagas segundo sua viabilidade marginal e disputa trabalhadores.
- Desagregar o consumo familiar em bens essenciais e discricionários.

### Etapa 4 | Governança Societária, Dividendos, Concessões e PPPs
- Separar `ownership`, `operator` e `contract` nas empresas.
- Implementar política de distribuição de dividendos (para o Tesouro e acionistas privados), venda parcial de participação societária e contratos de concessão de serviços públicos.

### Etapa 5 | Indicadores Macroeconômicos Locais e Política Econômica
- Implementar o cálculo exato do **Valor Adicionado Bruto (VAB)** por setor e do **PIB Local** sem dupla contagem.
- Implementar o **Índice Local de Custo de Vida** ponderado e o **Resultado Fiscal Primário e Nominal** do Tesouro.
- Substituir o gatilho míope de investimento por avaliação de **VPL** e precificação de risco de crédito por tomador.

### Etapa 6 | Demografia, Entrada/Saída de Firmas e Evolução Urbana Orgânica
- Implementar abertura autônoma de empresas quando houver demanda reprimida e capital/crédito, bem como liquidação/falência ordenada.
- Conectar densidade populacional e empresarial à demanda por infraestrutura urbana (água, saneamento, energia, saúde, educação).

---

## 9. Protocolo de Aceite e Testes Obrigatórios

Nenhuma etapa será considerada concluída sem passar simultaneamente por:
1. **Bateria de Conservação de Fluxo de Caixa:** $\text{Entradas Externas} - \text{Saídas Externas} = \sum \text{Caixa Doméstico}$ (tolerância $< 10^{-6}$).
2. **Balanço de Partidas Dobradas de Crédito e Depósitos:** $\sum D_{\text{clientes}} = D_{\text{passivoBanco}}$ e $\sum (P^{reg} + P^{arr})_{\text{tomadores}} = L_{\text{ativoBanco}}$.
3. **Verificação dos 8 Critérios de Aceite Arquiteturais:** Princípio econômico claro, incentivos de agente explícitos, variáveis rastreáveis, equação fundamentada, impacto patrimonial completo, observabilidade na interface, teste unitário automatizado e trava contra comportamentos degenerados.

---

## 10. Referências Metodológicas Oficiais Consolidadas

- **IBGE — Sistema de Contas Nacionais (SCN):** Metodologia de Valor Adicionado Bruto, Consumo Intermediário e PIB pelas três óticas. https://www.ibge.gov.br/estatisticas/economicas/contas-nacionais/9052-sistema-de-contas-nacionais-brasil.html
- **IBGE — Glossário Estatístico (Valor Adicionado e PIB):** https://anuario.ibge.gov.br/2024/glossario-2024.html
- **IBGE — IPCA e Sistema Nacional de Índices de Preços ao Consumidor:** Ponderação orçamentária e cálculo de números-índices. https://www.ibge.gov.br/estatisticas/economicas/precos-e-custos/9258-indice-nacional-de-precos-ao-consumidor-amplo-ipca.html
- **IBGE — PNAD Contínua:** Definição de População em Idade de Trabalhar, Força de Trabalho, Ocupados, Desocupados e Subutilização. https://www.ibge.gov.br/estatisticas/sociais/trabalho/9173-pnadcontinua.html
- **Banco Central do Brasil — Mecanismos de Transmissão da Política Monetária:** Canais de juros, crédito, câmbio e expectativas. https://www.bcb.gov.br/controleinflacao/transmissaopoliticamonetaria
- **Banco Central do Brasil — Sistema de Informações de Crédito (SCR.data):** Classificação de carteira ativa, atrasos e inadimplência por porte e setor. https://www.bcb.gov.br/estabilidadefinanceira/scrdata
- **Tesouro Nacional — Resultado do Tesouro Nacional (RTN):** Metodologia de apuração fiscal acima e abaixo da linha, resultado primário e nominal. https://www.gov.br/tesouronacional/pt-br/estatisticas-fiscais-e-planejamento/resultado-do-tesouro-nacional-rtn
- **Godley, W., & Lavoie, M. (2007):** *Monetary Economics: An Integrated Approach to Credit, Money, Income, Production and Wealth*. Palgrave Macmillan (Fundamentação das matrizes Stock-Flow Consistent).
