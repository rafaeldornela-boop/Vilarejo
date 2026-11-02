# Entrega | Política 1.0.0 para Vilarejo

Esta pasta contém os arquivos novos e as alterações necessárias para integrar o primeiro módulo político à `main`.

## Arquivos novos

- `src/politics/vilarejo_politics.js`
- `src/test/politics_test.js`
- `docs/politics/README.md`

## Arquivos existentes que recebem alterações

O patch `integration/0001-politics-integration.patch` altera:

- `index.html`: navegação, painel político e carregamento do módulo depois da Sociedade;
- `src/ui/dashboard.js`: renderização do painel e título da navegação;
- `style.css`: estilos responsivos da tela de grupos;
- `package.json`: verificações de sintaxe e execução dos testes políticos;
- `src/test/test_runner.js`: verificação da ordem de carregamento.

## Aplicação

Extraia o ZIP na raiz do repositório, mesclando os diretórios `src/`, `docs/` e `integration/` com os existentes. Em seguida, na raiz do repositório, aplique o patch:

```bash
git apply --check integration/0001-politics-integration.patch
git apply integration/0001-politics-integration.patch
npm test
npm run build
```

Depois revise:

```bash
git status --short
git diff --check
git diff
```

Faça o commit somente depois de executar a suíte completa do próprio repositório.

## Resultado dos testes desta entrega

A suíte isolada do módulo Política passou em 21 testes, sem falhas. Os testes de integração exercitam um Runtime de contrato simulado, não substituem a execução do Core, Economia e Sociedade reais. A suíte valida inicialização, ausência de dados inventados, sobreposição de grupos, representatividade, influência, impactos, idempotência, determinismo, renderização segura, integração pelo contrato do Runtime, reinicialização e eventos relacionados a estatais.

A suíte econômica e a suíte da Sociedade não foram executadas nesta pasta, pois dependem dos arquivos preexistentes do repositório. Execute `npm test` depois de copiar os arquivos e aplicar o patch sobre a `main`.
