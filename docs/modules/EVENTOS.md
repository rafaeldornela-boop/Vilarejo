# Motor de Eventos V3

**Fonte:** `src/events/eventos_v3.js`. V3 é um sistema de eventos de jogo e não deve ser confundido com o barramento genérico do Core.

## Responsabilidades

Mantém catálogo fixo de eventos de clima, mercado, sociedade, infraestrutura e governo; condições, probabilidade, severidade, escolhas e efeitos; agendamento, cooldown, crise, moral, reputação, modificadores de produção/preço/custo e log. A API exporta `EventosV3` no browser e em CommonJS. O estado possui serialização/restauração do próprio motor.

## Estado e integração

`novoEstado` inclui semente, modo integrado, mês/estação, caixa, trabalhadores, salário relativo, flags de políticas, eventos agendados, cooldowns, sinais ativos, modificadores e estatísticas de avisos/alarmes/surpresas. `sincronizarComVilarejo` copia um conjunto específico de valores de `S` e aceita helpers injetados. No modo integrado, transações podem usar o helper `log`; sem ele, não se deve presumir lançamento externo no livro-caixa.

O motor não chama `runtime.events.on` nem `runtime.publish`. A Economia conversa com ele por APIs/globals e helpers, não por tópico do Core.

## Limites

O catálogo e os períodos sazonais são fixos. O estado e helpers devem ter o formato esperado pelo motor; não há validação geral de todos os argumentos. `serializar`/`carregarEstado` cobre Eventos V3, não a Economia, Sociedade ou a partida inteira.

## Testes

A execução oficial `npm test` verifica disponibilidade do catálogo (30 eventos), 120 ciclos válidos, determinismo com a mesma semente e preservação de estado serializado/restaurado. O runner geral também testa integração econômica e diferentes horizontes.
