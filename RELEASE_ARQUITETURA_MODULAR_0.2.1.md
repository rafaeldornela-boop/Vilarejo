# Release 3.2.0-alpha.1 | Arquitetura Modular 0.2.1

**Base GitHub conferida:** branch `economia-estavel`, commit `3787390123d0756a78d74debbea961f10405bc85`. O arquivo `eventos_v3.js` foi alinhado ao blob atual da branch (`3e60b604e9efb36f00541ce471cd1e508623fab6`); o motor econômico `script.js` e o Núcleo `vilarejo_core.js` foram preservados.

## Entrega

- Fábrica de módulos com validação de SemVer, identificadores e dependências.
- Estado privado serializável, contexto controlado e ciclo de vida reiniciável no mesmo runtime.
- Eventos com namespace obrigatório e limpeza automática das inscrições no encerramento.
- Rejeição de payloads não serializáveis e proteção contra poluição do protótipo durante a clonagem.
- Porta de leitura da Economia sem métodos para movimentação ou alteração financeira.
- Integração dos novos scripts ao carregamento da aplicação.
- CI do GitHub Actions para build e testes.

## Compatibilidade

`script.js`, `vilarejo_core.js` e `eventos_v3.js` continuam no fluxo existente. As fórmulas e a simulação econômica não foram modificadas nesta etapa. A versão do motor econômico continua 3.0.0; `3.2.0-alpha.1` identifica a release do projeto com a camada modular.

## Testes

- `npm run build`: aprovado.
- `node test_runner.js`: 99 verificações aprovadas.
- `node tests/modular_architecture.test.js`: 15 verificações aprovadas.
- Total: **114 aprovadas, zero reprovadas**.
- Teste HTTP local: página principal e os dois scripts novos retornaram HTTP 200; `.env.example` foi bloqueado (404) e requisições POST foram recusadas (405).
- Simulação principal preserva 5.760 meses-simulação distribuídos em 24 sementes e 240 meses por semente.

## Limitações

- `script.js` ainda é monolítico.
- A porta da Economia é somente de leitura; não existe API pública de comandos transacionais.
- Sociedade, Política e Legislação ainda não foram implementados.
- Não há persistência integral do estado da partida.
