# VILAREJO | Arquitetura Econômica v0.1

**Status:** diagnóstico e proposta de arquitetura.  
**Base examinada:** `index.html` do repositório GitHub, blob SHA `b4765186b9ac8e6508c2646d0e2440aa0904b9e0` (versão identificada no HTML como v2.3); `server.js`; `package.json`; documento enviado `Vilarejo_ lógica da economia.md`.

> Este documento não altera o código. Ele define a estrutura conceitual e a ordem recomendada de implementação. As regras propostas para o jogo são adaptações de design, não reprodução exata da economia brasileira.

---

## 1. Diretriz central

O Vilarejo deve ser uma **simulação econômica local aberta**, na qual o espaço urbano cresce como consequência de decisões e interações entre agentes. Não haverá nível de cidade, XP ou desbloqueio artificial.

A economia deve gerar os motivos para a urbanização: demanda, oportunidade de lucro, investimento, emprego, renda, migração, arrecadação, infraestrutura e oferta de serviços. A expansão urbana, por sua vez, cria novos custos e restrições: preço da terra, congestionamento, falta de moradia, necessidade de saneamento, energia, saúde, educação e transporte.

**Princípio de projeto:** os indicadores são resultados calculados a partir do estado da economia. Não devem ser números inseridos manualmente para sugerir que a cidade está crescendo.

## 2. Diagnóstico da versão atual

### 2.1 O que já existe

| Área | Situação atual | Leitura técnica |
|---|---|---|
| Famílias | Implementado | Quatro domicílios iniciais, com adultos, crianças, caixa, depósitos, salários e dívidas. |
| Produção | Parcial | Uma fazenda de café, com safra sazonal, insumos importados, clima e venda externa. |
| Comércio | Parcial | Um único comércio que importa e revende uma cesta básica. Não representa várias empresas independentes. |
| Governo | Parcial | Tesouro, tributos, aporte à fazenda estatal e investimento habitacional. Ainda não há balanço patrimonial público completo. |
| Banco | Parcial | Caixa, depósitos familiares, empréstimos, reserva mínima e juros. Não há análise de risco robusta nem balanço bancário completo. |
| Mercado de trabalho | Simplificado | Empregos e salários existem, mas todos os postos estão vinculados à capacidade econômica da fazenda. |
| Habitação | Parcial | Capacidade habitacional, aluguel e moradia subsidiada. Não há mercado imobiliário amplo nem preço de terra endógeno. |
| Economia externa | Parcial | Preço externo do café, câmbio, salário externo, exportações e importações. O setor externo ainda funciona como fonte/destino muito simplificado de recursos. |
| Migração | Parcial | Entradas e saídas respondem a renda e moradia, com regras probabilísticas simplificadas. |
| Políticas públicas | Implementado em pequena escala | Salários, tributos, moradia, apoio estatal, juros e regime cambial. |
| Livro-caixa | Implementado | Transações entre contas e auditoria de conservação do caixa. |
| Testes de estresse | Implementado como estrutura | Existe `window.VilarejoTest.runStressTests()` com cenários; os testes não foram executados nesta auditoria. |

### 2.2 O que ainda não existe como sistema geral

- Cadastro de empresas independentes por setor, com identidade, proprietário, gestor e atividade.
- Estrutura societária com participação pública e privada, distribuição de dividendos e venda parcial de participação.
- Concessão como contrato entre proprietário do ativo e operador privado.
- Produção de vários bens e serviços, com receitas, insumos, estoques, custos e preços próprios.
- Capital produtivo, depreciação, reposição e produtividade por empresa.
- Mercado de trabalho com pessoas procurando emprego, empresas disputando trabalhadores e salários por setor.
- Sistema de formação e encerramento de empresas baseado em oportunidade, capital, lucro e insolvência.
- Balanços patrimoniais completos de famílias, firmas, banco e governo.
- Índice de preços de uma cesta de vários produtos. Hoje existe essencialmente um preço local de cesta básica.
- PIB local/valor adicionado por atividade. O painel não calcula PIB.
- Demografia natural (nascimentos, envelhecimento e mortes) e estrutura etária detalhada.
- Evolução endógena dos serviços e da infraestrutura urbana.

### 2.3 Problemas e simplificações que merecem prioridade

**1. A taxa exibida como desemprego não é a taxa de desemprego da PNAD Contínua.** O código divide adultos sem emprego pelo total de adultos. Isso não distingue quem está procurando trabalho de quem está fora da força de trabalho. Até existir essa distinção, o indicador deve ser chamado de “adultos sem ocupação” ou “proporção de adultos empregados”, não de taxa oficial de desemprego.

**2. A atribuição de empregos favorece a ordem dos domicílios.** `assignJobs()` percorre a lista e distribui as vagas às primeiras famílias. Não há procura por trabalho, qualificação, preferência ou competição entre empregadores.

**3. A capacidade de emprego é determinada por uma fazenda.** `updateEmploymentCapacity()` usa a contribuição estimada de cada trabalhador na cafeicultura. Isso é aceitável como aproximação inicial de uma economia monocultora, mas não pode sobreviver como regra geral quando surgirem comércio, serviços, construção e indústria.

**4. O indicador de preços ainda não é inflação geral.** O preço da cesta reage ao câmbio, ao estoque, à escassez e ao markup. Sem vários produtos e pesos de consumo, o jogo pode informar “variação do preço da cesta” ou “pressão de custo de vida”, mas ainda não deve chamar isso de IPCA ou inflação geral local.

**5. O resultado da fazenda não contempla todos os custos econômicos.** O cálculo atual considera receitas e vários custos operacionais, mas não há depreciação sistemática do capital. Os juros pagos nos empréstimos não entram claramente no custo usado no cálculo do lucro tributável. Isso tende a superestimar o lucro econômico.

**6. A dívida bancária mistura atrasos de principal e juros.** `settleBankLoans()` soma o valor total não pago em `loan.arrears`; no período seguinte, esse saldo é somado ao valor chamado `interestDue`. Depois, `interestPaid` pode classificar todo esse atraso como receita de juros. É necessário separar, no mínimo, principal em atraso e juros em atraso, com ordem de apropriação e amortização explícita.

**7. A auditoria monetária é uma auditoria de caixa, não uma auditoria patrimonial completa.** `domesticMoney()` soma o caixa das contas e o dinheiro em espécie das famílias, mas não inclui depósitos como um agregado monetário. Isso pode servir para verificar a conservação do caixa existente no jogo, mas não deve ser apresentado como medida de moeda ampla. Depósitos são ativos das famílias e passivos do banco; devem aparecer nos balanços, sem serem confundidos com o caixa físico do banco.

**8. O banco ainda não precifica risco.** O crédito depende sobretudo do caixa disponível acima de uma reserva fixa de 20% dos depósitos. Os empréstimos recebem uma taxa comum, sem avaliação de probabilidade de inadimplência, garantia, prazo ou risco do tomador.

**9. A fazenda estatal não possui uma política explícita de destinação do lucro.** O resultado permanece em seu caixa. Isso pode representar retenção e reinvestimento, mas o jogador ainda não decide quanto reinvestir, distribuir ao Tesouro ou reservar.

**10. O setor externo é uma simplificação forte.** Transações com `external` funcionam como entrada ou saída de caixa. Precisaremos separar exportações, importações, investimento externo, financiamento, remessas e variação de reservas/câmbio conforme a simulação amadurecer.

---

## 3. Constituição econômica: agentes e balanços

A unidade básica da simulação não deve ser uma tela ou um indicador. Deve ser o **agente econômico**, com recursos, obrigações e decisões.

### 3.1 Famílias

**Ativos:** dinheiro, depósitos, moradia, terra e participações em empresas.  
**Rendas:** salários, trabalho autônomo, lucros distribuídos, aluguel recebido, transferências e benefícios.  
**Despesas:** consumo, aluguel, impostos, juros e serviços.  
**Decisões:** procurar emprego, aceitar trabalho, consumir, poupar, tomar crédito, empreender, mudar de residência e migrar.

Cada adulto deve ter uma situação laboral: ocupado, desempregado procurando trabalho ou fora da força de trabalho. Crianças, estudantes, aposentados e pessoas sem disponibilidade para trabalhar não podem ser automaticamente classificados como desempregados.

### 3.2 Empresas

Cada empresa deve possuir:

- Identificador, nome, setor e atividade econômica.
- Proprietários e participações percentuais.
- Gestor ou operador, que pode ser diferente do proprietário.
- Caixa, contas a receber e a pagar.
- Estoques e ativos produtivos.
- Trabalhadores, salários e encargos.
- Tecnologia, produtividade e capacidade instalada.
- Dívidas, juros, vencimentos e situação de crédito.
- Receitas, custos, lucro, impostos e política de investimento.
- Política de preço, produção, contratação e distribuição de resultados.

Uma conta chamada “comércio” ou “fazenda” não substitui uma empresa. A conta é apenas uma parte de seu balanço.

### 3.3 Governo

O governo deve possuir caixa, ativos, terrenos, infraestrutura, participações societárias, dívidas e obrigações. Suas receitas devem ser separadas por origem: impostos sobre renda, folha, lucro, consumo, propriedade, taxas, tarifas e dividendos recebidos.

As despesas devem distinguir consumo e custeio, investimento, transferências, subsídios, serviço da dívida e aportes a empresas públicas.

### 3.4 Banco

O banco precisa ter ativos (caixa/reservas, empréstimos e outros créditos) e passivos (depósitos e obrigações). O capital próprio do banco absorve perdas. O modelo inicial pode continuar simples, mas o balanço deve ser coerente.

### 3.5 Setor externo

Representa compradores, fornecedores, investidores e credores de fora do vilarejo. Deve registrar fluxos externos sem criar dinheiro silenciosamente. Toda entrada ou saída precisa ter natureza identificada: venda externa, compra externa, transferência, investimento, empréstimo ou pagamento de renda.

---

## 4. Regras contábeis obrigatórias

Antes de adicionar dezenas de variáveis, o motor precisa obedecer a identidades simples.

### 4.1 Caixa por agente

`Caixa final = Caixa inicial + recebimentos efetivos - pagamentos efetivos`

Nenhum pagamento pode ser maior que o saldo disponível, salvo quando a operação gerar explicitamente uma obrigação ou dívida.

### 4.2 Dívida

`Dívida final = Dívida inicial + novos empréstimos + juros capitalizados + novos atrasos - principal amortizado - baixas/perdões`

Principal em atraso e juros em atraso devem ser campos separados. Pagamento deve seguir uma ordem configurada e transparente, por exemplo: tarifas vencidas, juros vencidos, juros correntes e principal vencido/corrente. A regra escolhida deve valer para todos os contratos equivalentes.

### 4.3 Depósitos

`Depósito final = Depósito inicial + novos depósitos + juros creditados - saques - perdas contratuais`

O depósito é ativo da família e passivo do banco. Não é o mesmo que dinheiro em caixa no banco.

### 4.4 Estoque e capital físico

`Estoque final = Estoque inicial + produção + compras - vendas - perdas`

`Capital final = Capital inicial + investimento - depreciação - alienações`

A produção precisa ser limitada por mão de obra, capacidade produtiva, tecnologia, insumos e capital de giro. Comprar uma máquina ou construir uma instalação não deve gerar produção instantânea sem período de implantação.

### 4.5 Livro de transações

Toda transação deve registrar data, origem, destino, valor, natureza, agente responsável e referência ao evento que a provocou. O livro-caixa atual é um bom começo, mas a arquitetura futura deve permitir gerar os balanços e demonstrativos a partir dos lançamentos, e não manter números desconectados em variáveis diferentes.

---

## 5. Indicadores econômicos do jogo

Os indicadores oficiais brasileiros servem como referência metodológica. Não devem ser copiados literalmente para uma aldeia de 12 moradores.

### 5.1 Produção e renda

**Valor adicionado por empresa:**

`VA_i = Valor da produção_i - Consumo intermediário_i`

**PIB local estimado:**

`PIB_local = Σ VA_i + impostos sobre produtos - subsídios sobre produtos`

A receita de venda não é PIB integral. Somar o valor vendido pela fazenda e depois o valor revendido pelo comércio causaria dupla contagem. O cálculo deve medir o valor agregado em cada etapa.

### 5.2 Trabalho

`Força de trabalho = Ocupados + Desocupados`

`Taxa de desocupação = Desocupados / Força de trabalho × 100`

Desocupado é quem não está ocupado, está disponível e procura trabalho segundo a janela definida pelo modelo. Quem não procura trabalho fica fora da força de trabalho. Na vila inicial, apresentar também os números absolutos: “5 ocupados, 2 procurando trabalho, 3 fora da força de trabalho”. A porcentagem isolada pode oscilar demais com poucos habitantes.

### 5.3 Preços e custo de vida

Para cada bem ou serviço, registrar preço e peso de consumo. Uma primeira aproximação de índice local pode usar uma cesta de pesos fixos:

`Índice_t = Σ (peso_i × preço_i,t / preço_i,base) × 100`

`Inflação_t = (Índice_t / Índice_t-1 - 1) × 100`

Os pesos devem representar a participação dos itens no orçamento das famílias. Famílias com renda e composição diferentes podem ter cestas efetivas distintas. O painel pode mostrar uma cesta média e, internamente, calcular custo de vida por grupo de renda.

Com apenas um produto, o indicador é variação do preço desse produto, não inflação ampla.

### 5.4 Consumo, poupança e crédito

Acompanhar consumo planejado e efetivo, demanda não atendida, poupança, saldo de depósitos, saldo de empréstimos, prestações em atraso e inadimplência.

`Inadimplência = saldo vencido / carteira de crédito × 100`

A métrica e a janela de atraso devem ser definidas pelo jogo. O SCR do Banco Central é uma referência útil porque permite analisar carteiras e inadimplência por tipo de cliente, modalidade e atividade econômica.

### 5.5 Governo

`Resultado primário = receitas primárias - despesas primárias`

`Resultado nominal = resultado primário - despesa líquida de juros` (convenção simplificada de sinal)

A dívida é um estoque; o resultado fiscal é um fluxo. Não devem ser tratados como a mesma coisa. Para o painel do jogador, o método “acima da linha” (receitas menos despesas) explica de onde veio o resultado. A variação do estoque de dívida ajuda a entender o financiamento.

### 5.6 Indicadores urbanos e sociais

População, domicílios, densidade, vacância habitacional, preço do aluguel, acesso a água, energia, saneamento, saúde, educação, transporte, diversidade de atividades, empregos por setor, produtividade e arrecadação por habitante.

Não criar um único “índice de cidade”. O vilarejo pode crescer em população e atividade econômica enquanto piora em moradia, saneamento, desigualdade ou congestionamento.

---

## 6. Modelos econômicos essenciais

As fórmulas abaixo são uma base de design a calibrar em testes. Os conceitos gerais são respaldados pela literatura e pelas metodologias oficiais citadas; os parâmetros numéricos e as funções específicas do jogo ainda precisarão de calibração.

### 6.1 Produção

`Produção efetiva = mínimo(capacidade, produção limitada por trabalho, produção limitada por insumos) × fator tecnológico × fator de choque`

Cada setor terá sua própria função. A fazenda pode manter sazonalidade, clima, solo, insumos e produtividade agrícola. Comércio produz serviços de distribuição, não o mesmo bem que revende. Construção transforma materiais, trabalho e capital em moradia e infraestrutura.

### 6.2 Preço

`Preço-alvo = custo unitário + margem compatível com o mercado`

A margem deve reagir à concorrência, estoque, demanda, qualidade, risco e poder de mercado. O preço efetivo pode ajustar gradualmente em direção ao preço-alvo, evitando mudanças bruscas artificiais. Escassez não deve ser o único determinante dos preços.

### 6.3 Emprego e salários

A empresa contrata enquanto a receita adicional esperada do trabalho for suficiente para cobrir o custo adicional do trabalhador:

`Valor do produto marginal do trabalho ≥ salário + encargos + benefícios`

No jogo, pode-se usar uma função discreta e simplificada, mas a decisão deve ocorrer por empresa e setor, não por uma única fazenda definindo todas as vagas do vilarejo.

### 6.4 Lucro empresarial

`Lucro econômico = receitas - insumos - salários - encargos - aluguel - depreciação - juros - tributos + subsídios operacionais`

Separar lucro operacional, resultado financeiro e lucro líquido evita que juros ou depreciação desapareçam do modelo.

### 6.5 Investimento

Uma empresa investe quando o retorno esperado supera seu custo de capital e quando possui financiamento e capacidade de execução. Uma regra inicial pode comparar retorno esperado do projeto com taxa de financiamento ajustada ao risco, mas o cálculo deve considerar demanda futura, prazo, manutenção, vida útil, ociosidade e risco.

`VPL = Σ [Fluxo de caixa esperado_t / (1 + taxa de desconto)^t] - investimento inicial`

O VPL pode ser uma regra interna. Não precisa aparecer ao jogador. Não se deve investir automaticamente só porque uma margem estimada de um mês superou o juro mensal.

### 6.6 Crédito

`Taxa do empréstimo = taxa básica + spread operacional + prêmio de risco`

`Perda esperada = probabilidade de inadimplência × perda em caso de inadimplência × exposição`

Começar com risco por setor e por tomador, capacidade de pagamento e garantias simplificadas. Juros, amortização, atrasos e perdas precisam ser separados no contrato.

### 6.7 Migração

A decisão de migrar deve responder a oportunidades de trabalho, renda real, custo de vida, moradia, serviços e qualidade de vida. Uma forma possível é transformar a diferença de atratividade entre o vilarejo e a região externa em probabilidade de entrada ou saída por meio de uma função logística. Os pesos devem ser calibrados, não escolhidos para produzir crescimento garantido.

### 6.8 Entrada e saída de empresas

Abertura deve ser possível quando houver demanda não atendida, oportunidade de lucro, empreendedor, capital, mão de obra e insumos. Encerramento deve ocorrer quando a empresa não consegue honrar obrigações, perde patrimônio líquido ou deixa de encontrar demanda suficiente. A falência não deve ser disparada apenas porque um evento aleatório decidiu.

---

## 7. Propriedade empresarial: os quatro casos que não podem ser confundidos

### 7.1 Empresa pública

O governo é proprietário do capital. A empresa tem caixa, ativos, dívidas, trabalhadores e resultado próprios. O lucro pode ser destinado a:

1. Reinvestimento e expansão;
2. Formação de reserva;
3. Dividendos ao Tesouro;
4. Combinação das opções anteriores.

Se a empresa tiver obrigação de prestar serviço abaixo do custo, o subsídio precisa ser explícito no orçamento. Prejuízo não pode desaparecer dentro do Tesouro sem registro.

### 7.2 Empresa privada

O capital pertence a sócios privados. Eles aportam recursos, assumem perdas e recebem dividendos conforme participação e decisão de distribuição. O governo recebe os tributos previstos, não uma porcentagem automática do lucro por ser regulador.

### 7.3 Concessão

O ativo ou direito permanece público, enquanto uma empresa privada opera o serviço segundo contrato. O contrato pode prever prazo, investimento obrigatório, padrões de qualidade, tarifa, fiscalização, pagamento ao poder público e eventual participação na receita. A remuneração deve considerar custos e riscos do operador; participação sobre receita bruta não deve ser usada automaticamente como se fosse participação sobre lucro.

### 7.4 Venda total ou parcial

Na venda total, a propriedade e os direitos transferidos passam ao comprador conforme o contrato. O Tesouro recebe o preço de venda, e as dívidas/obrigações são alocadas conforme o negócio.

Na venda parcial, o governo recebe o valor correspondente às ações/quotas vendidas e continua recebendo dividendos sobre a participação que reteve. É essa participação societária, e não uma taxa informal sobre o lucro, que justifica o recebimento contínuo.

### 7.5 Estrutura sugerida

Separar três dimensões:

- **Proprietário:** quem detém o capital ou o ativo.
- **Operador:** quem administra e executa a atividade.
- **Regulador/contratante:** quem define obrigações e fiscaliza.

Essa separação permite empresa estatal operada pelo Estado, empresa estatal operada por concessionária, empresa privada, sociedade mista e venda parcial, sem criar cinco sistemas independentes.

---

## 8. Como a cidade surge organicamente

A urbanização deve ser uma consequência acumulada de decisões e restrições.

**Ciclo de expansão:**

1. Aumento da renda e da população amplia a demanda.
2. A demanda abre espaço para novos empreendimentos.
3. Empresas criam empregos e pagam salários.
4. Renda e variedade de serviços atraem moradores e investimentos.
5. O crescimento aumenta a arrecadação potencial e a demanda por serviços públicos.
6. Infraestrutura e serviços melhoram a produtividade e a atratividade.

**Ciclo de pressão:**

1. População cresce mais rápido que moradia e infraestrutura.
2. Aluguéis, deslocamentos e custo de vida sobem.
3. Falta de serviços e congestionamento reduzem qualidade de vida.
4. Empresas enfrentam custos maiores e trabalhadores podem migrar.

O motor deve permitir crescimento, estagnação e regressão. O jogo não deve forçar uma cidade a surgir só porque o calendário avançou.

Não criar “níveis urbanos”. Usar dimensões contínuas, como população, densidade, diversidade econômica, empregos, renda, infraestrutura e acesso a serviços. A interface pode descrever a situação com linguagem contextual, mas não deve bloquear sistemas por uma classificação artificial.

---

## 9. Indicadores: o que mostrar e o que manter interno

### Painel inicial do vilarejo

Mostrar poucos indicadores que sejam observáveis e compreensíveis:

- População e domicílios;
- Pessoas ocupadas e pessoas procurando trabalho;
- Vagas abertas e não preenchidas;
- Salário médio e renda disponível;
- Preço da cesta e itens em falta;
- Produção, estoque e vendas da fazenda;
- Número de empresas e empregos por atividade;
- Caixa, receitas, despesas e resultado do Tesouro;
- Crédito disponível e parcelas em atraso;
- Moradias disponíveis e ocupação.

### Variáveis internas

Elasticidade-preço, propensão marginal a consumir, propensão a poupar, produtividade, capacidade utilizada, custo de capital, risco de crédito, expectativa de inflação, poder de mercado, concentração, depreciação, probabilidade de entrada/saída e parâmetros de migração.

O jogador não precisa ver todas essas variáveis. Precisa conseguir perceber suas consequências e entender as relações causais por meio de relatórios e eventos.

### Qualidade dos indicadores em população pequena

No começo, mostrar contagens e intervalos/avisos de baixa amostra. Percentuais calculados sobre 8 adultos podem saltar muito com a migração de uma única pessoa. Conforme a economia cresce, os indicadores agregados ganham estabilidade. Isso não exige um nível urbano: é consequência matemática do tamanho da amostra.

---

## 10. Plano de implementação recomendado

### Etapa 0 | Correções de integridade

- Separar principal em atraso e juros em atraso no contrato bancário.
- Corrigir a classificação de juros recebidos pelo banco.
- Rebatizar o indicador atual de desemprego até implementar força de trabalho.
- Distinguir caixa, depósitos, empréstimos e patrimônio nos relatórios.
- Incluir juros e depreciação na apuração de resultado da empresa.
- Criar testes unitários para as identidades de caixa, depósitos, dívida e estoque.

### Etapa 1 | Modelo comum de agentes e transações

Definir contratos de dados para famílias, empresas, governo, banco e setor externo. Toda entidade terá identificador estável, caixa, ativos e obrigações. Centralizar os lançamentos financeiros e gerar demonstrativos a partir deles.

### Etapa 2 | Empresa genérica

Transformar fazenda e comércio em instâncias de uma estrutura de empresa, mantendo seus comportamentos setoriais como módulos. Adicionar pelo menos uma terceira atividade não agrícola para provar que a arquitetura não depende do café.

### Etapa 3 | Trabalho e mercados

Pessoas com situação laboral; empresas com vagas, demanda de trabalho e salários; produtos com oferta, demanda, estoques e preços; mercado habitacional e valor da terra.

### Etapa 4 | Propriedade, investimento e governo

Participações societárias, dividendos, reservas, venda parcial/total, concessões, subsídios explícitos, investimento público e endividamento.

### Etapa 5 | Indicadores e política econômica

Calcular valor adicionado, índice local de preços, taxa de desocupação corretamente definida, resultados fiscais, crédito e produtividade. Adicionar efeitos de juros, câmbio e políticas públicas sobre consumo, investimento, preços e emprego.

### Etapa 6 | Formação urbana

Entrada e saída de negócios, população, moradia, infraestrutura e serviços respondem aos sinais econômicos. A expansão espacial e o adensamento entram depois que a lógica de demanda e investimento estiver funcionando.

---

## 11. Critérios de aceite para qualquer nova mecânica

Uma mecânica só deve entrar no motor quando responder a estas perguntas:

1. Qual princípio econômico ou necessidade de design ela representa?
2. Quais agentes tomam a decisão e com quais incentivos/restrições?
3. Quais variáveis entram no cálculo?
4. Qual fórmula ou regra foi escolhida e por quê?
5. Como a operação afeta caixa, ativos, dívidas, estoques e patrimônio?
6. Qual efeito o jogador consegue observar?
7. Que cenário de teste demonstra que a regra funciona?
8. Qual comportamento indesejado pode surgir e como será detectado?

**Regra de qualidade:** nenhum indicador importante deve ser apenas decorativo; nenhuma transação deve criar ou destruir dinheiro, dívida, patrimônio ou estoque sem registro; nenhuma decisão empresarial deve ignorar custos e restrições relevantes.

---

## 12. Referências metodológicas oficiais

- **IBGE | Sistema de Contas Nacionais:** apresenta produção, consumo, acumulação, patrimônio, relações entre setores institucionais, valor adicionado e PIB. https://www.ibge.gov.br/estatisticas/economicas/contas-nacionais/9052-sistema-de-contas-nacionais-brasil.html
- **IBGE | Glossário do Anuário Estatístico:** define valor adicionado bruto como produção menos consumo intermediário e o PIB como soma dos valores adicionados, acrescida dos impostos líquidos de subsídios sobre produtos. https://anuario.ibge.gov.br/2024/glossario-2024.html
- **IBGE | IPCA:** descreve a estrutura de pesos, coleta de preços e agregação ponderada dos itens da cesta. https://www.ibge.gov.br/estatisticas/economicas/precos-e-custos/9258-indice-nacional-de-precos-ao-consumidor-amplo-ipca.html
- **IBGE | PNAD Contínua:** base conceitual para distinguir ocupados, desocupados e pessoas fora da força de trabalho. https://www.ibge.gov.br/estatisticas/sociais/trabalho/9173-pnadcontinua.html
- **Banco Central | Mecanismos de transmissão da política monetária:** juros afetam consumo, investimento, câmbio, ativos, crédito e expectativas. https://www.bcb.gov.br/controleinflacao/transmissaopoliticamonetaria
- **Banco Central | SCR.data:** referência para carteira de crédito e inadimplência por tipo de cliente, modalidade e atividade. https://www.bcb.gov.br/estabilidadefinanceira/scrdata
- **Tesouro Nacional | Resultado do Tesouro Nacional:** apresenta receitas e despesas, resultado primário e metodologias “acima da linha” e “abaixo da linha”. https://www.gov.br/tesouronacional/pt-br/estatisticas-fiscais-e-planejamento/resultado-do-tesouro-nacional-rtn

---

## 13. Decisão técnica desta versão

**Não ampliar o número de indicadores ainda.** Primeiro corrigir a integridade do crédito e formalizar o modelo comum de agentes e transações. Em seguida, converter fazenda e comércio em empresas genéricas. Só então vale construir uma economia com diversos setores e deixar a urbanização emergir.

A versão 2.3 é uma boa prova de conceito: ela já demonstra fluxo de caixa, política, produção sazonal, crédito, escassez e crises. Mas ainda é uma simulação centrada em uma fazenda e um comércio, não uma economia urbana autônoma. O próximo salto deve ser arquitetural, não cosmético.

## 14. Verificação executada nesta auditoria

A versão atual foi compilada sintaticamente com `new Function()` e a função `window.VilarejoTest.runStressTests()` foi executada com um DOM mínimo simulado para fornecer os elementos usados pela interface. Resultado: **11 de 11 cenários internos passaram**. Isso confirma os cenários cobertos, não equivale a teste completo de navegador, interface ou economia.

Cenários aprovados: choque salarial; imposto elevado com aluguel; escassez por falta de capital/crédito; câmbio e custo de importação; remuneração de depósitos sem tomadores; investimento produtivo quando o retorno supera os juros; bloqueio do investimento com crédito caro; falência do comércio; socorro estatal; entrada de novo comerciante/reestruturação; conservação do caixa por 12 meses.

### Teste adicional não coberto pela bateria existente: atraso de empréstimo

Foi simulado um empréstimo de R$ 8.000, à taxa de 2,5% ao mês, prazo de 24 meses. Após uma prestação integralmente não paga, o sistema registra R$ 533,33 de atraso (R$ 200,00 de juros + R$ 333,33 de principal). Quando o tomador recebe caixa suficiente para quitar o atraso e a prestação seguinte, o código classifica os R$ 533,33 acumulados como juros. O resultado registrado foi:

- Principal final no código: R$ 7.652,17.
- Receita de juros reconhecida pelo banco: R$ 733,33.
- Principal final esperado, amortizando os dois componentes de principal vencidos: R$ 7.318,84.
- Juros correspondentes aos dois períodos, sem capitalização contratual adicional: R$ 400,00.

A diferença de R$ 333,33 é principal vencido classificado como juros. Portanto, a bateria atual passa, mas não cobre essa situação. **A correção da estrutura de atrasos deve preceder qualquer expansão do crédito.**

**Limite de validação:** os testes foram executados no código atual por meio de um ambiente JavaScript isolado com elementos DOM simulados. Não foi realizado teste manual em navegador real, nem teste visual responsivo.
