# Guia de publicação no GitHub

## Objetivo

Padronizar a liberação do projeto e reduzir risco de regressão durante mudanças estruturais.

## Fluxo recomendado

1. validar branch de origem
2. confirmar que o núcleo e a Economia ainda funcionam
3. verificar `README.md` e `docs/`
4. publicar branch de trabalho
5. abrir PR para `economia-estavel`
6. validar CI e testes antes do merge

## Regras

- não mexer em `main` diretamente
- preservar `economia-estavel` como base funcional
- proteger o que já foi validado
- manter documentação em `docs/`
