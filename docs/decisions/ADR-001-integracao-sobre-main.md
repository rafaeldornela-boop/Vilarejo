# ADR-001 — Integrar módulos sobre a `main` sem reescrever a Economia

- **Estado:** adotada nesta branch.
- **Data:** 2026-11-02.
- **Contexto:** arquivos de Política, Instituições e Serviços já existiam no checkout, mas sua localização, scripts, testes e documentação não correspondiam ao carregamento em `src/`. Os patches de raiz pressupunham contextos ausentes e não aplicavam limpos. O pedido especificou `main` como base e proibiu merge automático da branch divergente `architecture-modular`.

## Decisão

1. Usar exclusivamente o conteúdo da `main` como base; desenvolver em `integracao-governo-1.0` sem merge de `architecture-modular`.
2. Reorganizar os arquivos existentes para `src/politics`, `src/institutions`, `src/services` e `src/test`, preservando conteúdo e referências de CommonJS.
3. Carregar os módulos após Core, Eventos, Economia e Sociedade conforme seus contratos; registrar estado por adaptadores do Runtime e atualizar painéis na interface existente.
4. Preservar a Economia como dona de contas, caixa, balanços e operação financeira. Serviços mantém indicadores de cenário e `budgetLinked: false` até existir uma integração fiscal contabilizada.
5. Validar IDs de domicílios nos limites do Core e Sociedade, proteger a identidade migratória da Economia até o cadastro social e impedir evolução duplicada do mesmo mês em Sociedade/Serviços.
6. Documentar snapshots antigos como históricos; comandos normativos são `npm install`/`npm ci`, `npm run build`, `npm test` e `npm start`.

## Consequências positivas

- Módulos usam caminhos consistentes entre HTML, Node e testes.
- UI e Runtime deixam de ter painéis sem carregamento/atualização.
- IDs duplicados falham antes de corromper os snapshots; o teste de integração cobre reentrega mensal e reset.
- Não são fabricados lançamentos de caixa para preencher a UI; as auditorias econômicas continuam passando.
- Instalação, testes e execução são comandos diretos, e CI valida Node 18/22.

## Limitações aceitas

- Serviços ainda não converte alavancas em orçamento, folha, compras, obras, manutenção ou produção; requer adaptador econômico futuro.
- O motor econômico continua sendo o módulo de maior acoplamento/monólito; esta decisão não autoriza uma refatoração financeira ampla.
- Demografia social não reescreve a força de trabalho econômica. Política usa estimativas e representatividade não exclusiva. Instituições não implementa eleição popular nem votação legislativa.
- A partida inteira não possui persistência documentada.
- Arquivos de patch e documentação antigos permanecem apenas como registros históricos e não são aplicados no build.

## Alternativas rejeitadas

- Aplicar patches em sequência contra contextos ausentes: rejeitado porque `git apply --check` já falhava em arquivos do `main`.
- Importar a branch `architecture-modular`: rejeitado pelo histórico divergente e pela instrução explícita.
- Criar novos arquivos vazios por domínio ou apontar para arquivos ausentes: rejeitado; sete serviços são módulos lógicos existentes em um arquivo agregado.
- Fazer a UI debitar o Tesouro diretamente: rejeitado por violar propriedade da Economia e integridade contábil.
- Mesclar automaticamente na `main`: rejeitado; a revisão deve ocorrer em PR separado.
