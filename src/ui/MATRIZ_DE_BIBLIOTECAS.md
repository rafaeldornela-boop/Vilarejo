# Matriz de bibliotecas e ferramentas

## Decisão por componente

| Componente | Opção | Decisão | Motivo |
|---|---|---|---|
| Engine 2D | Phaser 4.2.1 | **ADOTAR** | Versão estável atual; o Phaser ainda não está carregado no projeto e a integração visual ainda está por fazer. |
| Plugin isométrico | `phaser3-plugin-isometric` | **NÃO ADOTAR** | Fork antigo/WIP, sem releases e sem atividade recente; o projeto já tem `world_layout.js` e o Phaser tem Tilemap isométrico nativo. |
| Seguir curvas/rotas | `Phaser.GameObjects.PathFollower` | **USAR NATIVO** | Já faz parte do Phaser; move sprites por `Phaser.Curves.Path`, permite controlar duração, sentido e rotação. |
| Animação e efeitos | Tweens, Animation, Graphics e recursos nativos do Phaser | **USAR NATIVO** | Evita bibliotecas extras para tarefas já cobertas pela engine. |
| UI avançada | `phaser4-rex-plugins` 4.2.0 | **ADIAR** | Só importar um plugin específico quando surgir uma necessidade concreta que Phaser não cubra. A distribuição do pacote aparece com alertas de vulnerabilidade em uma página CDN; fazer `npm audit`/revisão de dependências antes de adotá-lo. |
| Pathfinding em grade | `easystarjs` 0.4.4 | **OPCIONAL / ADIAR** | MIT e pequeno (~7 KB), mas última publicação há vários anos. Só faz sentido se o mapa passar a ter uma grade de passabilidade e obstáculos. |
| Editor de mapas | Tiled | **OPCIONAL** | Pode criar mapas ortogonais/isométricos exportados em JSON; só adotar se a autoria manual de mapas virar gargalo. |

## Por que Phaser 4.2.1

A lista oficial de releases registra Phaser 4.2.1 em 09/07/2026. O Phaser 3.90.0, por sua vez, é a última release 3.x listada e data de 23/05/2025. Como a engine ainda não está carregada pelo HTML e o renderizador ainda não foi integrado, vale decidir a versão agora, antes de construir mais código sobre Phaser 3.

A migração não é automática: Phaser 4 substituiu o renderer WebGL e removeu/alterou algumas APIs. No código atual, a incompatibilidade direta encontrada por busca estática é `Phaser.Geom.Point`, usado pelo método `polygon` de `world_renderer_phaser.js`. A IA deve executar os testes com Phaser 4 e revisar erros reais antes de concluir.

## Por que não importar Rex para tudo

O catálogo Rex é amplo, mas não é necessário para movimentação básica. Phaser já fornece `PathFollower`, curvas, tweens, sprites, animações, tilemaps e partículas. Importar um plugin grande só para resolver um comportamento que existe nativamente adicionaria peso e superfície de manutenção.

O pacote `phaser4-rex-plugins` fica como caixa de ferramentas futura. Quando houver necessidade, importar apenas o plugin específico e verificar versão, licença, dependências e alertas de segurança.

## Pathfinding: cuidado com o formato do mapa

EasyStar trabalha sobre uma grade/tilemap. As estradas atuais são desenhadas como linhas e polilinhas, não como uma grade de navegação formal. Para carros e caminhões, a primeira etapa deve ser seguir rotas definidas com `PathFollower`. Para rotas calculadas dinamicamente, primeiro criar um grafo/grade de estradas com nós, conexões, sentidos e custos; só depois escolher a biblioteca de A*.
