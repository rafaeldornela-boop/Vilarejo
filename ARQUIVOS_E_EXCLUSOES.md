# Arquivos: manter, arquivar ou excluir

Esta classificação considera a estrutura da Economia 3.0 e as referências encontradas na aplicação e na suíte de testes.

## Arquivos essenciais

- `index.html`: interface e ordem de carregamento dos scripts.
- `vilarejo_core.js`: núcleo central, calendário, diretório populacional, registro de módulos e barramento de eventos.
- `script.js`: motor econômico principal.
- `eventos_v3.js`: motor de eventos carregado pela página e integrado ao ciclo econômico. **Não excluir.**
- `server.js`: servidor local opcional.
- `test_runner.js`: executor das verificações automatizadas.
- `package.json`: versão, requisitos e comandos `start`, `build` e `test`.
- `README.md`: instruções atualizadas de uso e limitações.
- `.gitignore` e `.env.example`: higiene do repositório e referência para configuração do servidor.

## Podem ser excluídos, dependendo do fluxo de trabalho

- `metadata.json`: não é lido pelo motor, pela página, pelo servidor nem pelos testes. Pode ser removido se o projeto não for mais importado ou administrado pelo Google AI Studio. Mantenha-o caso ainda utilize esse fluxo.
- `docs/historico/*.md`: não são dependências de execução. Recomendo manter para preservar a evolução das regras e decisões do projeto.

## Arquivos e pastas temporários removidos anteriormente

- `.aistudio/artifacts/brain/.../.tempmediaStorage/media_*.png`: imagens temporárias sem referência na página ou nos scripts.
- Estrutura vazia `.aistudio/artifacts/...`: removida junto com os arquivos temporários.
- Documento antigo em `public/assets/aistudio/`: movido para `docs/historico/`, pois era documentação, não recurso estático.

## Histórico

`docs/historico/` guarda prospectos, arquitetura preliminar e auditoria da versão 2.5. Esses documentos são registros históricos, não regras atuais do simulador. Para saber o que está implementado e testado na versão vigente, consulte `README.md`, `docs/RELATORIO_ECONOMIA_V3.0.md` e `docs/ARQUITETURA_MODULAR_V0.1.md`.
