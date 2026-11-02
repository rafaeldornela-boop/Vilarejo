# Arquivo histórico — não normativo

Os documentos neste diretório são preservados para rastreabilidade, mas descrevem entregas, propostas ou validações de momentos anteriores. Podem conter caminhos removidos, números antigos de teste ou comportamentos que não existem na implementação atual. Não use nenhum comando de aplicação de patch ou instalador listado neles sem revalidá-lo no código e na branch alvo.

- `design-snapshots/`: propostas/contratos e versões arquiteturais anteriores. Os contratos vigentes são [`docs/architecture/CONTRATOS_E_EVENTOS_V1.md`](../architecture/CONTRATOS_E_EVENTOS_V1.md), [`docs/architecture/DECISOES_DE_MODULOS_V1.md`](../architecture/DECISOES_DE_MODULOS_V1.md) e [`docs/architecture/ARQUITETURA_GERAL_V1.md`](../architecture/ARQUITETURA_GERAL_V1.md).
- `validation-snapshots/`: resultados de testes de pacotes anteriores; não representam a suíte completa atual. Para repetir a validação, rode `npm run build` e `npm test`.
- `patches/`: arquivos `.patch` propostos anteriormente. Não são usados por `package.json`, não são carregados pela aplicação e não devem ser aplicados em sequência como instrução desta branch.
- `README-ENTREGA-PACOTE-ANTERIOR.md`: instruções de uma entrega anterior, preservadas apenas como registro.
- `ARQUIVOS_E_EXCLUSOES.md`: índice de transição; inventário ativo está em [`docs/architecture/INVENTARIO_DE_ARQUIVOS_V1.md`](../architecture/INVENTARIO_DE_ARQUIVOS_V1.md).

A documentação normativa de uso e arquitetura começa no [`README.md` da raiz](../../README.md) e nos diretórios `docs/architecture/`, `docs/modules/` e `docs/gameplay/`.
