# Interface, dashboard e servidor

**Fontes:** `index.html`, `style.css`, `src/ui/dashboard.js`, `server.js`; verificações em `src/test/test_runner.js` e `src/test/server_test.js`.

## Interface

A página contém oito áreas de navegação: Visão geral, Economia, Sociedade, Governo, Política, Instituições, Serviços e desenvolvimento, e Registros. O HTML define elementos acessíveis e os pontos de montagem. O stylesheet fornece componentes responsivos e estados de foco. `dashboard.js` lê o snapshot da partida, mantém a janela gráfica de 12/24/60 meses, atualiza mapa/calendário/indicadores e delega a renderização dos módulos quando suas APIs públicas estão disponíveis.

A navegação chama atualização do painel; a Economia chama `VilarejoDashboard.refresh()` depois do fechamento mensal se disponível. A API global também expõe `setView`. Serviços publica `setLever` ao host de dashboard para encaminhar uma alavanca ao seu módulo; o Dashboard não deve escrever no estado interno da Economia.

## Ordem e segurança

O HTML carrega uma única vez os oito scripts: Core, Eventos, Economia, Sociedade, Política, Instituições, Serviços e Dashboard. O teste estrutural compara a sequência completa. Renderizadores de módulos escapam conteúdo dinâmico. Páginas sem snapshot podem manter conteúdo inicial fixo; não trate defaults do HTML como estado econômico confirmado.

## Servidor

`server.js` atende apenas GET/HEAD e entrega arquivos estáticos com MIME e cabeçalhos de segurança básicos. A raiz permite `index.html` e `style.css`; `src/` e `public/` têm caminhos permitidos; segmentos ocultos e arquivos privados na raiz são bloqueados. Não há endpoint de simulação, autenticação, TLS ou persistência.

## Limites

O dashboard lê globals opcionais; ausência deles impede apenas os painéis correspondentes. O arquivo de dashboard não é dono dos handlers de toda a simulação; os controles de jogo pertencem ao motor econômico. Fontes remotas usam fallbacks locais no CSS.

## Testes

`src/test/test_runner.js` verifica idioma, scripts únicos/ordem, stylesheet, allowlist e estrutura. `src/test/server_test.js` inicia o servidor em porta temporária e verifica HTML/CSS/JS e negação de arquivo privado. Não foi realizada inspeção visual interativa em navegador nesta execução.
