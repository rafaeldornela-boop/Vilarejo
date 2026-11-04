# Vilarejo — Auditoria de bibliotecas e recursos visuais

**Data da auditoria:** 03/11/2026  
**Repositório analisado:** `rafaeldornela-boop/Vilarejo`  
**Branch consultada:** `main`  
**Objetivo:** escolher ferramentas e arte gráfica existentes antes de continuar escrevendo renderizadores próprios.

## Decisão recomendada

1. **Padronizar o mundo visual em Phaser 4.2.1**, antes de integrar o renderizador. O HTML ainda não carrega Phaser, portanto esta é a melhor janela para decidir a versão.
2. **Não importar um plugin isométrico de terceiros.** O projeto já possui projeção e coordenadas próprias, e o Phaser possui suporte nativo a Tilemaps isométricos.
3. **Usar recursos Kenney em pequenos lotes**, começando pelos pacotes Isometric Tiles City, Buildings, Landscape e Vehicles. São CC0, mas a compatibilidade estética precisa ser validada antes de substituir os desenhos vetoriais.
4. **Usar o PathFollower nativo do Phaser** para veículos em rotas conhecidas. Não precisamos do Rex só para mover objetos por caminhos.
5. **Deixar EasyStar.js como opcional** para uma futura navegação em grade. Não instalar agora: a malha de estradas ainda precisa de um contrato claro.

## Arquivos deste pacote

- `AUDITORIA_TECNICA.md`: estado observado no `main` e lacunas de integração.
- `MATRIZ_DE_BIBLIOTECAS.md`: decisão sobre motores, plugins e pathfinding.
- `PACOTES_GRAFICOS_E_LICENCAS.md`: pacotes visuais recomendados e licença.
- `PLANO_DE_INTEGRACAO.md`: passos para adicionar a dependência sem quebrar o build estático.
- `PROMPT_PARA_IA_INTEGRADORA.md`: prompt pronto para a IA que fará a integração.
- `DECISOES_TECNICAS.json`: decisões em formato legível por máquina.

## Importante

Este pacote é uma auditoria e um plano de adoção. **Não instala bibliotecas, não baixa os assets para o repositório e não altera o GitHub.** A integração deve ser feita em uma alteração controlada, com testes do mapa no navegador e do build Netlify.
