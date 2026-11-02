# Inventário de arquivos — branch integrada

Este inventário foca a aplicação e os caminhos efetivamente usados por `index.html`, `package.json`, `server.js` e `npm test`.

## Aplicação

| Caminho | Função | Referência ativa |
|---|---|---|
| `index.html` | Estrutura de oito áreas, navegação, elementos de renderização e ordem de scripts. | Servido em `/`; scripts da página. |
| `style.css` | Tema responsivo e componentes dos módulos. | Servido em `/style.css`. |
| `server.js` | Servidor HTTP estático com allowlist de caminhos e MIME types. | `npm start`, `npm run dev`. |
| `package.json`, `package-lock.json` | Versão, scripts, requisito Node >=18 e lockfile sem dependências npm externas. | `npm install`, `npm ci`, build/test. |
| `.github/workflows/ci.yml` | Verificação automatizada em Node 18/22. | GitHub Actions em push/PR. |
| `.env.example`, `.gitignore`, `metadata.json` | Configuração/referência do repositório. | Não fazem parte da carga do navegador. |

## Código-fonte `src/`

| Diretório/arquivo | Conteúdo |
|---|---|
| `src/core/vilarejo_core.js` | Runtime, eventos, relógio, sessão, população, módulos e snapshots. |
| `src/events/eventos_v3.js` | Motor e catálogo de eventos V3. |
| `src/economy/vilarejo_economy.js` | Motor econômico principal, interface base, auditorias e eventos do Runtime. |
| `src/society/vilarejo_society.js` | Estado social e adaptador com a Economia/Core. |
| `src/politics/vilarejo_politics.js` | Grupos de interesse e influência. |
| `src/institutions/vilarejo_institutions.js` | Câmara, representação, coalizão e mandatos. |
| `src/services/vilarejo_services.js` | Sete áreas públicas, recursos, efeitos cruzados e adaptação. |
| `src/ui/dashboard.js` | Navegação, status, mapas, gráficos e renderização dos painéis. |

## Testes executados por `npm test`

- `src/test/test_runner.js`: estrutura, Core, Eventos e suíte de estresse embutida na Economia, múltiplas sementes e horizontes longos.
- `src/test/society_test.js`: demografia, identidade, migração, qualidade de vida e Runtime.
- `src/test/politics_test.js`: grupos, composição, impactos, influência e Runtime.
- `src/test/institutions_test.js`: assentos, maioria, coalizões, mandatos e Runtime.
- `src/test/services_test.js`: sete domínios, indicadores, recursos, eventos, idempotência e alavancas.
- `src/test/module_integration_test.js`: registro real dos módulos, migrante econômico, fechamento repetido e reset.
- `src/test/server_test.js`: respostas HTTP, MIME de CSS/JS e bloqueio de arquivo privado da raiz.

## Documentação de referência

- `docs/architecture/`: arquitetura, contratos/eventos, inventário e decisões.
- `docs/modules/`: responsabilidade, estado, dependências, eventos, limites e testes de cada domínio.
- `docs/gameplay/`: guias de instalação e execução.
- `docs/legislation/`: status documentado do módulo jurídico, ainda não implementado.
- `docs/decisions/`: ADRs da integração.
- `docs/releases/`: histórico de versões e relatórios de release.
- `docs/history/`: documentos históricos ou snapshots explicitamente não normativos.
- `docs/economy/`: material de contexto econômico anterior; a documentação operacional atual está no módulo da Economia e neste inventário.

## Arquivos legados mantidos

O arquivo `install.js` na raiz não é invocado por `package.json`, não é carregado por `index.html` e não participa do build atual; ele pressupõe caminhos anteriores e não é o caminho de instalação documentado. Os patches `0001-*.patch`, `0002-*.patch` e `integration.patch` foram preservados em `docs/history/patches/`, sem uso no build ou na página. Use `npm install`/`npm ci` e `npm start`.

Documentos de projeto anteriores podem conter nomes ou comportamentos de versões que não existem no código atual. Os guias normativos são o README da raiz, os documentos em `docs/architecture/`, `docs/modules/` e `docs/gameplay/`; os snapshots históricos são identificados como tais.
