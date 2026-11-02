# Arquivos: manter, arquivar ou excluir

Esta nota é um índice de transição. O inventário atual e caminhos ativos estão em [`docs/architecture/INVENTARIO_DE_ARQUIVOS_V1.md`](../architecture/INVENTARIO_DE_ARQUIVOS_V1.md); o guia de instalação está em [`docs/gameplay/GUIA_INSTALACAO.md`](../gameplay/GUIA_INSTALACAO.md).

A aplicação carrega `src/core/`, `src/events/`, `src/economy/`, `src/society/`, `src/politics/`, `src/institutions/`, `src/services/` e `src/ui/`. Os testes executados estão em `src/test/`. Os arquivos `script.js`, `src/economy/script.js` e os diretórios de patch citados em snapshots anteriores não são caminhos da aplicação nesta branch.

## Política de arquivo

Propostas, resultados de testes de versões antigas e patches não aplicáveis foram preservados em `docs/history/`. São material de auditoria histórica e não instruções para o código atual. `metadata.json`, `install.js` e demais ferramentas antigas permanecem no checkout, mas só devem ser considerados ativos se forem explicitamente invocados pelos scripts atuais ou pela página.

## Histórico

O inventário e os comandos de execução vigentes estão no README raiz e nos guias de `docs/gameplay/`. Para validar o checkout atual, rode `npm run build` e `npm test`; resultados arquivados nunca substituem uma nova execução.
