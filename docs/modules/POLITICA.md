# Módulo Política — `politica` 1.0.0

**Fonte:** `src/politics/vilarejo_politics.js`; teste dedicado em `src/test/politics_test.js`.

## Responsabilidades e estado

Mantém dez grupos de interesse, população representada, status/base da medição, poder econômico, organização, coesão, capacidade de mobilização, satisfação e acesso institucional. Deriva influência em escala 0–100, relação de apoio/oposição ao governo, eventos e histórico. Permite atualizar, remover, fundir e dividir grupos, com composição explicitamente informada quando necessário.

Os grupos podem se sobrepor: soma das representatividades não equivale a população exclusiva. A integração estima somente parte da composição, por exemplo, trabalhadores em idade ativa; não inventa representatividade quando a base não está disponível. Os parâmetros iniciais são hipóteses de cenário, não dados empíricos.

## Dependências e eventos

Registra `politica` com dependências `core` e `economia`; a composição da Sociedade é fonte opcional. Escuta `game:reset`, `game:initialized`, `world:synchronized`, `society:month-closed`, `economy:month-closed` e `politics:interest-impact`. Publica `politics:month-closed`, `politics:influence-changed` e `politics:group-updated`, além de atualizar seu snapshot no Runtime.

Impactos são limitados a canais reconhecidos e a faixa do indicador; canal desconhecido ou inválido não modifica estado. A evolução é idempotente por mês e rejeita retrocesso no calendário.

## Limites

A base ocupacional não distingue integralmente ocupados, desempregados e pessoas fora da força de trabalho. Representatividade é não exclusiva; status `estimated` não deve ser descrito como censo. A medição começa indisponível para grupos sem dado.

## Testes

`src/test/politics_test.js` cobre 21 casos, incluindo inicialização de dez grupos, transparência de representatividade, prevenção de mutação parcial, influência, impactos, divisão/fusão, limites mensais, determinismo, escape HTML e integração/reset do Runtime.
