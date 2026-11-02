# Módulo Economia — `economia` 3.0.0

**Fonte:** `src/economy/vilarejo_economy.js`. Esta branch mantém a Economia como autoridade sobre transações, contas, produção e política fiscal; a integração modular não transfere essas regras para outros domínios.

## Responsabilidades e estado

O módulo executa ciclos diários/mensais e mantém famílias/domicílios, firmas, setores, inventários, emprego e salários, preços e consumo, comércio externo, empréstimos, inadimplência, políticas, balanços e `gameOver`. Calcula caixa e fluxos, DRE, contas nacionais/PIB, reconciliação, resultado fiscal, inflação/custo de vida, indicadores laborais, crédito e risco, investimento, infraestrutura/congestionamento e outros indicadores do motor.

O calendário econômico interno usa 30 dias por mês e 360 dias por ano, coerente com o Runtime de 12 meses econômicos. A Economia ainda contém controladores e renderização da interface-base, além de auditorias de conservação de caixa e consistência patrimonial.

## Dependências e eventos

A integração com `window.VilarejoCore` é condicional. Quando o Core existe, a Economia cria/exibe `VilarejoRuntime`, sincroniza relógio e população e registra o módulo `economia`. Publica `game:initialized` no começo da partida e `economy:month-closed` ao fechar o mês, com número do mês, dia/ano, população, resumo nacional, resultado fiscal e fim de jogo. Não há listener próprio do Runtime identificado no arquivo.

Eventos V3 é outra integração condicional; o dashboard também só é chamado se sua API existir. A ausência desses globals não cria garantia de integração, embora o motor principal mantenha seu fluxo local.

## Limites

A Sociedade pode receber a projeção demográfica, mas nascimentos/idade social não substituem diretamente empregos ou população econômica. A marca explícita de migrante e os IDs de domicílio foram protegidos nesta integração, sem alterar as fórmulas fiscais. Serviços não debita caixa ou altera o relatório fiscal.

## Testes

`src/test/test_runner.js` executa o conjunto econômico interno (61 cenários nomeados), auditorias de caixa/SFC/PIB, fechamentos mensais, stress tests de 12/24/60/120 meses, 24 sementes × 240 meses e as integrações do Runtime. A validação reportada nesta branch: 98 verificações do runner aprovadas, com 61 testes econômicos internos.
