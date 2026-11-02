# Arquivos e exclusões

## Estrutura ativa

- `src/` — código e módulos organizados
- `docs/` — documentação oficial
- `index.html` e `server.js` — entrada e execução do projeto

## Arquivos raiz

Arquivos na raiz podem continuar existindo por compatibilidade durante a migração arquitetural, mas a fonte de verdade deve ser a estrutura organizada dentro de `src/` e `docs/`.

## Política de manutenção

- não remover arquivos sem confirmação clara de que não há dependência ativa;
- deixar compatibilidade temporal para evitar regressão;
- priorizar organização e rastreabilidade.
