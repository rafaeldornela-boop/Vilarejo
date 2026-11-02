# Relatório de fechamento e validação | Vilarejo Economia 3.0

**Escopo:** estabilização do núcleo econômico, correção do capital de giro da fazenda, integração do motor de eventos, documentação e testes de regressão.  
**Estado do GitHub:** nenhum commit ou push foi realizado nesta entrega.

## 1. Resultado executivo

A versão 2.5 ainda não fechava a sustentabilidade operacional do cenário padrão. A simulação natural encerrava por acúmulo de salários atrasados. A versão 3.0 corrige a regra de planejamento de liquidez da fazenda e amplia a reserva para considerar também o serviço da dívida bancária.

Validação executada no pacote entregue:

- `npm run build`: aprovado.
- `npm test`: **76 verificações aprovadas e 0 reprovadas**.
- Suíte interna do motor: 61 testes aprovados.
- Robustez: **24 sementes × 240 meses = 5.760 meses-simulação**, sem fim de jogo, divergência de caixa, falha na auditoria SFC ou quebra da reconciliação interna do PIB.
- Semente padrão: 240 meses naturais concluídos sem fim de jogo.
- Servidor HTTP: `GET /`, `GET /script.js` e `GET /eventos_v3.js` responderam HTTP 200. Acesso a `README.md`, `.env.example` e caminho externo foi bloqueado.

## 2. Correção do capital de giro

### Problema identificado

A fazenda recebia apoio fiscal calculado com base em folha, obrigações trabalhistas, moradia e insumos da próxima etapa. Entretanto, o valor reservado não contemplava o serviço programado da dívida bancária. Quando a liquidação do empréstimo ocorria, consumia recursos que deveriam permanecer disponíveis para financiar a próxima etapa produtiva. A fazenda podia, então, ficar sem insumos e receita futura, acumular atrasos salariais e caminhar para a condição de fim de jogo.

### Regra implementada

A necessidade de caixa passou a considerar:

- folha salarial e encargos patronais;
- salários e encargos em atraso;
- moradia fornecida pelo empregador;
- insumos previstos para os próximos 30 dias da janela de colheita;
- principal programado, principal vencido, juros do período e juros vencidos dos empréstimos da fazenda.

O aporte fiscal é calculado como o déficit entre a reserva operacional e o caixa disponível. O valor efetivamente transferido é limitado simultaneamente pelo teto de apoio configurado e pelo caixa real do Tesouro. O valor padrão do teto é R$ 25.000 por mês, ajustável na interface entre R$ 0 e R$ 30.000.

A transferência é registrada entre Tesouro e fazenda no livro-caixa e nos fluxos patrimoniais; não é tratada como produção, venda ou entrada externa.

## 3. Integração do motor de eventos

`eventos_v3.js` passou a ser carregado pela página antes de `script.js`. O estado do motor é inicializado com a semente da partida e sincronizado mensalmente com as variáveis do Vilarejo.

- O calendário dos eventos acompanha o calendário econômico.
- Modificadores de produção, preço e custo afetam a atividade agrícola.
- Eventos com escolhas exibem decisões na interface.
- Custos e transferências são refletidos nas contas dos agentes e no livro-caixa.
- Eventos governamentais utilizam o caixa do Tesouro quando a categoria do fluxo exige essa contraparte.
- A simulação automatizada resolve decisões pendentes de forma controlada para permitir testes de longa duração.

O catálogo contém 30 eventos. A integração não equivale a completar um modelo social, político ou jurídico. Efeitos de eventos são aplicados às variáveis que já existem no núcleo.

## 4. Integridade econômica e fiscal

A suíte cobre mercado de trabalho multissetorial, folha e encargos por empresa, inadimplência, cascata de pagamento de empréstimos, baixas de crédito, depreciação, balanços setoriais, contas nacionais e resultado fiscal.

A reconciliação das óticas do PIB utiliza tolerância de até R$ 0,01 para arredondamento. O excedente operacional bruto permanece como parcela residual na ótica da renda. Isso permite testar coerência interna entre as óticas, mas não valida o resultado contra uma mensuração estatística independente.

O resultado primário exclui alienações de ativos, enquanto o resultado nominal incorpora a despesa líquida de juros do Tesouro.

## 5. Testes realizados

| Grupo | Resultado |
|---|---:|
| Verificações estruturais | 4 aprovadas |
| Testes internos do motor econômico | 61 aprovados |
| Asserção de fechamento da suíte interna | 1 aprovada |
| Simulações integradas de controle | 6 aprovadas |
| Testes autônomos do motor de eventos | 4 aprovados |
| **Total** | **76 aprovadas / 0 reprovadas** |

A simulação de robustez cobre as sementes `1, 7, 17, 23, 42, 77, 99, 123, 256, 512, 1024, 2026, 31337, 65535, 8675309, 123456789, 314159, 271828, 999999, 20261101, 20261231, 86753090, 13579 e 24680` por 240 meses cada.

O teste de stress de 120 meses com continuação técnica após eventual fim de jogo é mantido para testar conservação monetária e consistência patrimonial mesmo em estados adversos. Esse teste é separado da simulação natural e não é usado para afirmar sustentabilidade.

## 6. Arquivos alterados

- `script.js`: capital de giro com serviço da dívida, integração de eventos, diagnósticos e funções de teste.
- `index.html`: carregamento do motor de eventos antes do motor econômico e atualização de referências da versão.
- `eventos_v3.js`: integração e callbacks de transação com as contas do simulador.
- `test_runner.js`: verificações estruturais, integração, sementes múltiplas e eventos.
- `package.json`: versão 3.0.0 e comandos de validação.
- `README.md`: instruções de execução, escopo, resultados e limitações.
- `docs/LOGICA_DA_ECONOMIA_BASE.md`: explicação da lógica efetivamente implementada.
- `docs/ARQUIVOS_E_EXCLUSOES.md`: classificação atualizada dos arquivos.
- `docs/historico/RELATORIO_AUDITORIA_V2.5.md`: preservado como registro histórico, pois descreve uma versão anterior.

## 7. Limitações remanescentes

1. `script.js` continua monolítico. A modularização foi adiada para não misturar uma refatoração estrutural com a correção econômica. É uma dívida técnica conhecida, não um bloqueio de funcionamento comprovado.
2. O modelo tem poucos agentes e setores e utiliza regras simplificadas. As simulações aprovadas cobrem os parâmetros e sementes listados, não todas as decisões, políticas ou estados possíveis.
3. O excedente operacional bruto é residual na ótica da renda; a igualdade das três óticas é uma identidade interna do simulador.
4. O motor de eventos é integrado, mas não substitui os futuros módulos de Sociedade, Política e Legislação.
5. A interface foi validada por carregamento estático, execução em DOM mínimo e teste HTTP. Não foi executado teste visual manual em diferentes navegadores ou dispositivos.

## 8. Conclusão

A Economia 3.0 passa nos testes automatizados e nas simulações naturais de longa duração definidas para esta entrega. A falha de capital de giro que provocava o colapso precoce da fazenda foi corrigida incluindo o serviço da dívida na reserva operacional. O motor de eventos está conectado à partida e suas transações entram no livro-caixa.

**Conclusão adequada:** núcleo econômico estabilizado para os cenários testados e preparado para receber os próximos módulos. Não significa que o modelo esteja livre de simplificações, que toda política possível esteja calibrada ou que a dívida técnica de modularização tenha sido eliminada.
