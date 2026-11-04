# Auditoria técnica do Vilarejo

## 1. Escopo e método

Foi consultada a branch `main` do repositório em 03/11/2026. Foram lidos `package.json`, `index.html`, `scripts/prepare_dist.js`, `server.js`, `README.md`, `docs/architecture/MAPA_ARQUITETURA_ATUAL_VILAREJO.md` e os módulos visuais presentes em `src/ui/`.

A auditoria é estática: confirma conteúdo e referências de arquivos. Não equivale a uma execução visual no navegador.

## 2. O que já existe no repositório

Estes arquivos estão presentes em `src/ui/`:

- `world_layout.js`: conversão e geometria isométrica.
- `world_infrastructure_catalog.js`: catálogo visual de estruturas.
- `world_terrain.js`: terreno ilustrativo.
- `world_roads.js`: desenho de vias e elementos viários.
- `world_nature.js`: árvores e elementos naturais.
- `world_structures.js`: construções desenhadas com Phaser Graphics.
- `world_effects.js`: efeitos animados com tweens.
- `world_atmosphere.js`: clima e transição visual.
- `world_placement.js`: pré-visualização/posicionamento visual.
- `world_scene_modules.js`: compositor de camadas que exige os módulos acima.
- `world_renderer_phaser.js`: renderizador principal, versão 0.2.0.

## 3. Lacunas que precisam ser resolvidas antes de importar recursos

### Phaser não está carregado

O `index.html` tem o contêiner `#worldCanvas`, mas seus scripts finais carregam Core, módulos de domínio e Dashboard. Não há uma tag de carregamento do Phaser nem dos módulos `world_*.js`. Portanto, o mapa ainda não está sendo iniciado pelo HTML.

### Não há dependências npm

O `package.json` declara scripts e a exigência de Node >=18, mas não tem dependências. O projeto não tem bundler configurado para transformar imports de módulos em um bundle de navegador.

### O build estático tem uma lista fechada

`scripts/prepare_dist.js` verifica as tags `<script src="...">` contra `RUNTIME_SCRIPTS`. Uma nova referência local, uma URL CDN ou um arquivo de vendor fora dessa lista causa falha de validação. O script copia a pasta `public/`, então a estratégia mais limpa é manter o Phaser local em `public/vendor/` e ensinar o verificador a aceitar essa origem, validando a existência do arquivo.

### O compositor não está conectado ao renderizador

`world_scene_modules.js` monta as camadas em uma cena Phaser, mas `world_renderer_phaser.js` não o chama. A IA integradora deve definir uma única composição e um ciclo de vida, em vez de criar duas cenas ou duplicar o terreno.

### Compatibilidade com Phaser 4

O renderizador existente contém `new Phaser.Geom.Point(...)` em `world_renderer_phaser.js` (método `polygon`). A classe `Geom.Point` foi removida no Phaser 4 e deve ser adaptada para `Phaser.Math.Vector2` ou para a forma de ponto aceita pela API usada. O restante das referências encontradas usa APIs comuns de cena, Graphics, Container, Rectangle, Tween, Scale e câmera, mas isso não substitui um teste de execução com a versão escolhida.

### Os módulos da segunda expansão não aparecem na main

Na consulta feita, não foram encontrados em `main`: `world_life.js`, `world_landmarks.js`, `world_city_evolution.js`, `world_economy_overlay.js` e `world_extended_modules.js`. Esses arquivos não devem ser considerados parte da integração até serem adicionados ao repositório.

## 4. Arquitetura recomendada

- **Phaser:** única engine de renderização do mundo.
- **`world_layout.js`:** permanece dono da conversão isométrica.
- **Camadas de terreno/estradas/natureza/construções:** preservam geometria, IDs e contratos, mas podem passar gradualmente de `Graphics` para sprites de atlas.
- **`world_infrastructure_catalog.js`:** continua dono dos IDs e metadados visuais; não recebe custos ou efeitos econômicos.
- **`world_scene_modules.js`:** orquestra as camadas uma única vez.
- **`world_renderer_phaser.js`:** mantém câmera, seleção, interação e leitura do snapshot.
- **Dados de economia e sociedade:** continuam vindo do Runtime/snapshots. A camada visual não calcula produção, emprego, saldo, preços ou valorização.

## 5. Ordem de execução sugerida

1. Decidir e fixar Phaser 4.2.1.
2. Ajustar a compatibilidade do renderizador e validar uma cena vazia.
3. Integrar o build estático para publicar o Phaser localmente.
4. Carregar módulos na ordem correta e conectar o compositor ao renderizador.
5. Testar com os desenhos atuais antes de substituir qualquer arte.
6. Importar um pequeno conjunto de sprites Kenney e substituir primeiro árvores, casas e veículos de teste.
7. Só então expandir para os demais prédios e efeitos.
