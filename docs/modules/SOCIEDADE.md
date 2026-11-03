# Módulo Sociedade — `sociedade` 1.0.0

**Fonte:** `src/society/vilarejo_society.js`; teste dedicado em `src/test/society_test.js`.

## Responsabilidades

Mantém pessoas/domicílios demográficos, identidade, idade, origem, cultura, integração, nascimentos/mortalidade, envelhecimento, imigração/emigração e histórico. Reconcilia grupos recebidos do Runtime e produz projeção por domicílio. O estado social é próprio: o módulo não recebe nem modifica `S` da Economia.

## Dados e indicadores

O snapshot agrega população, faixas etárias, dependência, domicílios, nascidos no exterior, mobilidade mensal/cumulativa, diversidade e integração cultural, eventos, projeção econômica e qualidade de vida. Qualidade de vida só inclui as dimensões disponíveis e informa cobertura/dimensões não medidas; no adaptador atual, indicadores de bem-estar e emprego são parciais.

Novos domicílios migratórios recebem um sinal explícito da Economia. A Sociedade preserva a identidade migratória e marca o adulto recém-chegado como nascido no exterior. IDs de famílias e pessoas são validados para impedir duplicação; o cadastro valida antes de efetivar seed/reconciliação. O histórico de qualidade de vida/migração e eventos tem limite configurado no estado.

## Dependências e eventos

Registra dependências `core` e `economia`. Escuta `game:reset`, `world:synchronized` e `economy:month-closed`; sincroniza/reconcilia grupos no reset/mundo e publica `society:month-closed` após avançar a demografia uma única vez no mês. Atualiza o snapshot `sociedade` do Runtime.

## Limites

A projeção social é leitura: não reescreve emprego, salários ou campos econômicos. O adaptador atual usa somente métricas econômicas reconhecíveis; qualidade de vida permanece parcial quando outras dimensões não têm dados. A remoção de grupo na fonte econômica pode ser interpretada como saída do diretório; remoção individual só registra saída migratória explicitamente solicitada.

## Testes

`src/test/society_test.js` cobre 15 casos: IDs duplicados, marcador de migrante, identidade das pessoas, reconciliação econômica, envelhecimento, idempotência, semente reproduzível, migração, qualidade de vida parcial, projeção somente leitura, renderização, Runtime e reset.
