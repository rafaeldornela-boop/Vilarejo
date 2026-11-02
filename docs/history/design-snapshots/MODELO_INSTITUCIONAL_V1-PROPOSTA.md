# Vilarejo | Modelo de funcionamento das Instituições 1.0.0

## 1. Setores simulados

| Setor | O que representa | Equipamentos disponíveis |
|---|---|---|
| Educação | Capacidade de atendimento escolar | Escola |
| Saúde | Atendimento preventivo e clínico | Unidade de saúde, hospital |
| Segurança | Presença e capacidade de proteção pública | Posto de segurança |
| Saneamento | Abastecimento, esgoto e resíduos | Sistema de água e esgoto, serviço de resíduos |
| Mobilidade | Circulação e transporte coletivo | Malha viária, transporte público |
| Energia | Oferta e distribuição de energia | Rede de energia |
| Administração | Capacidade administrativa do governo | Administração pública |

O equipamento é a unidade concreta de capacidade. Nesta primeira versão, uma instituição não é uma decisão política ou uma secretaria abstrata: é um serviço público com capacidade mensurável e custo de operação.

## 2. Demanda populacional

As demandas são calculadas a partir da população recebida:

| Setor | Coeficiente inicial | Fórmula |
|---|---:|---|
| Educação | 1,00 | crianças × 1,00 |
| Saúde | 0,10 | população × 0,10 |
| Segurança | 0,05 | população × 0,05 |
| Saneamento | 1,00 | população × 1,00 |
| Mobilidade | 0,35 | população × 0,35 |
| Energia | 0,45 | população × 0,45 |
| Administração | 1,00 | maior valor entre domicílios × 1,5 e população × 0,02 |

Os coeficientes são parâmetros de balanceamento do jogo, não indicadores empíricos nem normas técnicas. A intenção é produzir unidades abstratas de demanda e capacidade que permitam comparar expansão e déficit entre os setores.

Quando a Sociedade fornecer população idosa, ela será preservada no retrato demográfico, mas não altera a fórmula de demanda da versão 1.0. A segmentação por idade e necessidades específicas ficará para uma evolução posterior do modelo demográfico.

## 3. Capacidade, cobertura e qualidade

Cada equipamento possui:

- capacidade: unidades abstratas de atendimento/serviço;
- qualidade: 0 a 100;
- conservação: 0 a 100;
- pessoal: quantidade informativa, sem gerar trabalhadores na Economia;
- custo mensal de operação;
- situação ativa ou desativada.

Fórmulas:

```text
Capacidade nominal = soma da capacidade dos equipamentos ativos
Capacidade efetiva = soma(capacidade × qualidade/100 × conservação/100)
Cobertura = mínimo(100, capacidade nominal / demanda × 100)
Índice setorial = mínimo(100, capacidade efetiva / demanda × 100)
```

O índice institucional geral é a média ponderada dos setores que possuem demanda mensurável. Os pesos iniciais são: educação 20%, saúde 22%, segurança 15%, saneamento 18%, mobilidade 10%, energia 10% e administração 5%. Se um setor não tiver demanda, ele não entra no denominador da média.

## 4. Custeio e conservação

Cada equipamento tem custo mensal. O orçamento de custeio informado pelo jogo é comparado com a soma dos custos dos equipamentos ativos.

```text
Cobertura de manutenção = mínimo(100, orçamento disponível / custo mensal total × 100)
Desgaste mensal = desgaste-base + (1 - cobertura de manutenção) × desgaste por subfinanciamento
```

Parâmetros iniciais: desgaste-base de 0,15 ponto por mês e desgaste adicional máximo de 0,60 ponto por mês. São parâmetros de balanceamento, não taxas observadas no mundo real.

O sistema não realiza pagamento efetivo. O campo `operatingSpent` informa o montante simulado de custeio absorvido pelo ciclo, e o evento orçamentário comunica a necessidade. A ligação com o caixa público só será criada quando houver um adaptador fiscal aprovado.

## 5. Projetos e investimento

Um projeto contém equipamento futuro, custo total, custo restante, progresso e prioridade.

- Projetos são processados por prioridade decrescente.
- Em empate, prevalece a ordem de criação.
- O orçamento de investimento é alocado sequencialmente.
- Financiamento parcial aumenta o progresso, mas não cria o equipamento.
- Ao quitar o custo restante, o projeto é concluído e o equipamento entra no cadastro.
- Projetos cancelados ou concluídos não recebem nova alocação.

O investimento também é simulado internamente. A conclusão de uma obra não movimenta caixa ou contas nacionais da Economia nesta versão.

## 6. Custos-padrão de operação

Quando o usuário não informa `monthlyCost`, o sistema calcula um valor inicial por capacidade:

| Setor | Custo por unidade de capacidade/mês |
|---|---:|
| Educação | 12 |
| Saúde | 20 |
| Segurança | 10 |
| Saneamento | 7 |
| Mobilidade | 8 |
| Energia | 9 |
| Administração | 15 |

Valores são coeficientes nominais de balanceamento. Não são preços de mercado nem estimativas de custo público real. O custo pode ser informado manualmente em cada equipamento.

## 7. Estado inicial

A criação do módulo não cadastra escolas, postos, hospitais ou redes automaticamente. Isso evita inventar patrimônio e capacidade que ainda não existem no estado da partida. A configuração inicial deverá ser feita por cenário, decisão do jogador ou evento próprio.

## 8. O que o jogador poderá decidir futuramente

A estrutura já suporta futuras telas e regras para:

- construir, ampliar, desativar ou encerrar equipamentos;
- definir prioridades de investimento;
- comparar déficit de serviço entre setores;
- avaliar custo mensal de operação antes de construir;
- acompanhar conservação e queda de capacidade;
- relacionar cobertura institucional à qualidade de vida;
- encaminhar pedidos de orçamento à camada fiscal.

As últimas duas relações exigem integração explícita com Sociedade e Política e não são aplicadas automaticamente nesta versão.
