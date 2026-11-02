# Módulo Instituições — `instituicoes` 1.0.0

**Fonte:** `src/institutions/vilarejo_institutions.js`; teste dedicado em `src/test/institutions_test.js`.

## Responsabilidades e estado

Mantém Estado sui generis, Executivo controlado pelo jogador e Câmara. Deriva bancadas dos grupos de Política e distribui assentos pelo método dos maiores restos. Calcula assentos alocados/vagos, quórum, maioria, coalizão, oposição, alinhamento, liderança, mandatos, histórico e eventos. A configuração inicial é 21 assentos e 48 meses por mandato; parâmetros podem ser ajustados dentro dos limites validados no módulo.

As bancadas representam grupos políticos. Uma mesma pessoa pode se enquadrar em mais de um grupo, então composição de grupos não equivale a contagem exclusiva de eleitores. Grupos neutros não entram automaticamente na coalizão: seus IDs precisam ser indicados.

## Dependências e eventos

Registra `instituicoes` com dependências `core`, `economia` e `politica`. Escuta `game:reset`, `game:initialized`, `politics:month-closed`, `politics:group-updated` e `politics:influence-changed`. Publica `institutions:month-closed`, `institutions:representation-updated`, `institutions:mandate-renewed` e `institutions:coalition-updated` e atualiza snapshot.

A câmara não redistribui assentos a cada alteração política; atualiza dados políticos sem redistribuir antes da renovação do mandato. Fechamento repetido do mesmo mês é ignorado e retrocesso é rejeitado.

## Limites

Não implementa eleição popular, sistema de partidos eleitorais nem votação legislativa. O painel e a coalizão representam uma simulação institucional baseada em grupos de interesse. Não altera contas, caixa ou dados demográficos.

## Testes

`src/test/institutions_test.js` cobre 16 casos: distribuição exata e reproduzível, empates, composição, coalizão/oposição, atualização sem redistribuição antecipada, renovação de mandato, validação de parâmetros, segurança do painel e reset/Runtime.
