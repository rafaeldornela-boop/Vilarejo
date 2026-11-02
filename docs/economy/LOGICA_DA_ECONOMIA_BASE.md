# Lógica-base da economia do Vilarejo

## 1. Agentes e instituições

A simulação representa famílias, empresas produtivas e comerciais, fazenda estatal ou privada, Tesouro, banco, proprietário de imóveis e setor externo. Cada agente possui conta financeira e posição patrimonial. As transferências internas conectam pagador e recebedor; entradas e saídas com o setor externo são registradas separadamente.

## 2. Ciclo econômico mensal

O fechamento mensal segue, em linhas gerais, esta sequência:

1. atualização de preços externos, câmbio e parâmetros de política;
2. planejamento das firmas e contratação coletiva de trabalhadores;
3. cálculo do capital de giro e eventual aporte fiscal à fazenda;
4. liquidação de salários e encargos;
5. moradia, preços, comercialização e consumo das famílias;
6. liquidação de crédito, impostos, juros e demais obrigações;
7. atualização de estoques, investimento, poupança, infraestrutura e indicadores;
8. apuração das contas nacionais e fiscais;
9. avanço e aplicação dos eventos do mês;
10. auditoria do caixa, balanços setoriais e condições de encerramento.

As políticas alteradas pela interface entram em vigor no fechamento mensal seguinte, conforme a regra de cada controle.

## 3. Mercado de trabalho e empresas

O mercado de trabalho é coletivo e multissetorial. As vagas são associadas às firmas, e o matching não deve depender da ordem em que os setores são processados. Folha salarial, encargos, tributos e atrasos são individualizados por empresa. O modelo inclui entrada e saída de firmas e liquidação ordenada de empresas insolventes.

## 4. Capital de giro e fazenda

A fazenda tem produção sazonal. Por isso, o caixa operacional não pode ser avaliado somente pela folha do mês. A regra de capital de giro estima compromissos imediatos e próximos: folha e encargos, atrasos, moradia, insumos da próxima janela produtiva e serviço programado da dívida. O aporte do Tesouro cobre o déficit de liquidez até o teto aprovado e nunca supera seu próprio caixa disponível.

O aporte é uma transferência patrimonial entre Tesouro e fazenda. Ele não é contabilizado como produção, receita de vendas ou entrada de recursos do setor externo.

## 5. Crédito, inadimplência e bancos

Os empréstimos registram principal regular, principal vencido, juros e juros vencidos. A liquidação respeita uma cascata de prioridades e pagamentos parciais. Perdas de crédito reduzem o ativo do banco e o passivo do tomador de forma simétrica, sem simular movimentação de caixa inexistente.

## 6. Consumo, preços e contas nacionais

As famílias distribuem o consumo entre bens essenciais, bens discricionários e serviços locais, com restrições de renda e disponibilidade. Preços domésticos respondem a custos externos, câmbio, estoques e markups representados no código.

As contas nacionais são montadas a partir das transações simuladas, com valor adicionado por firma, consumo, investimento, governo e setor externo. As três óticas do PIB são comparadas como controle de consistência interno. O excedente operacional bruto é residual na ótica da renda, de modo que a reconciliação não é uma medição estatística independente.

## 7. Contabilidade e auditoria

O livro-caixa registra origem, destino, valor e motivo das transações. A auditoria de conservação verifica que as transferências internas não criam nem destroem dinheiro e que a variação de caixa corresponde aos fluxos externos. A auditoria SFC verifica consistência entre ativos financeiros e passivos dos setores, além dos saldos operacionais.

## 8. Eventos

O motor de eventos avança no mesmo calendário do simulador. Eventos podem alterar produção, preços, custos e variáveis sociais/institucionais já representadas. Decisões com custo movimentam as contas reais e aparecem no livro-caixa. Os modificadores agrícolas são aplicados à produção, ao preço de venda e ao custo de insumos.

## 9. Limites do modelo

O Vilarejo é um laboratório didático. O número de agentes, setores, mercados e instrumentos é reduzido; os comportamentos são regras explícitas do código, e não estimativas empíricas completas. Não se deve interpretar os resultados como previsão, nem como equivalentes às estatísticas oficiais do IBGE ou do Tesouro Nacional.
