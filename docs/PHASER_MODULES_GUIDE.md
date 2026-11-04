# Vilarejo | Kit de módulos visuais Phaser

**Versão do kit:** 1.0.0  
**Destino dos arquivos:** `src/ui/`  
**Escopo:** apresentação visual do mundo. Nenhum módulo modifica o Core, economia, população, serviços ou persistência.

## O que vem no kit

| Arquivo | Responsabilidade |
|---|---|
| `world_layout.js` | Conversão de coordenadas isométricas, encaixe na grade, limites e geometria. |
| `world_infrastructure_catalog.js` | Catálogo de 27 estruturas e instalações, sem custos ou efeitos econômicos. |
| `world_terrain.js` | Solo, manchas de terreno, relevo suave e corpos d'água decorativos. |
| `world_roads.js` | Estradas, pontes, viadutos, túneis e modelos de rede viária. |
| `world_nature.js` | Árvores, pinheiros, palmeiras, arbustos e rochas com distribuição reproduzível. |
| `world_structures.js` | Desenho vetorial de residências, serviços, indústria, usinas, minas, petróleo, porto e aeroporto. |
| `world_effects.js` | Fumaça, vapor, fluxo d'água e luzes pulsantes. |
| `world_atmosphere.js` | Transição de manhã, dia, entardecer, noite, chuva, neblina e céu nublado. |
| `world_placement.js` | Pré-visualização e encaixe de construções em grade isométrica. Não assume o controle do mouse. |
| `world_scene_modules.js` | Compositor que monta e desmonta as camadas acima em uma cena. |

## Conteúdo especial incluído

O catálogo e o renderizador de estruturas contemplam, entre outros:

- **Energia:** hidrelétrica com barragem e vertedouro, nuclear com torres de resfriamento, termelétrica, parque solar e parque eólico.
- **Extração:** mina de ouro, mina de ferro e campo de petróleo com bombas de extração.
- **Indústria:** refinaria com tanques e torres, fábrica, serraria e armazéns.
- **Logística:** porto, estação ferroviária e aeroporto.
- **Obras civis:** estradas, ponte com pilares, viaduto elevado e túnel.
- **Serviços:** hospital, escola, estação de tratamento de água e estação de esgoto.

Essas estruturas são **modelos visuais**. Elas não produzem energia, ouro, petróleo, empregos, receita, poluição ou qualquer outro efeito no jogo. Isso só deve ser implementado depois, com regras e contratos próprios nos módulos de domínio.

## Situação real do repositório

Na versão consultada, `src/ui/world_renderer_phaser.js` já possui câmera com arraste, zoom e centralização, além de um cenário ilustrativo básico. Por isso, este kit não cria uma segunda câmera.

O `index.html` já contém o espaço `#worldCanvas`, mas ainda não carrega a biblioteca Phaser nem `world_renderer_phaser.js`. Portanto, copiar os arquivos para `src/ui/` **não ativa o mundo automaticamente**. A conexão será uma etapa posterior, feita no carregamento dos scripts e no ciclo de vida da cena.

## Ordem de carregamento futura

1. Carregar Phaser 3 e disponibilizar `window.Phaser`.
2. Carregar `world_layout.js`.
3. Carregar `world_infrastructure_catalog.js`.
4. Carregar `world_terrain.js`, `world_roads.js`, `world_nature.js`, `world_structures.js`, `world_effects.js`, `world_atmosphere.js` e `world_placement.js`.
5. Carregar `world_scene_modules.js`.
6. Carregar `world_renderer_phaser.js`.
7. Carregar `dashboard.js` por último, como já ocorre atualmente.

Os módulos usam padrão global/UMD e não exigem npm, bundler ou importação ES Modules. O Phaser 3, porém, é uma dependência externa necessária ao momento da montagem.

## Exemplo de integração futura

Dentro de `WorldScene.create()`, depois da criação de `this.world`, o compositor poderá montar as camadas:

```js
this.visualModules = VilarejoWorldSceneModules.mount(this, {
  parent: this.world,
  terrain: {
    width: MAP_W,
    height: MAP_H,
    seed: "vilarejo-inicial"
  },
  roads: VilarejoWorldRoads.presets.village,
  nature: {
    seed: 2026,
    count: 44,
    area: { x: 40, y: 180, width: MAP_W - 80, height: MAP_H - 240 },
    avoid: [
      { x: 520, y: 360, width: 920, height: 580 }
    ]
  },
  structures: { showLabels: true },
  atmosphere: false
});
```

Para incluir uma usina ilustrativa:

```js
this.visualModules.addStructure({
  id: "visual-hydroelectric-01",
  type: "hydroelectric_dam",
  x: 360,
  y: 930,
  name: "Usina do Vale"
});
```

Para acrescentar uma ponte ou um viaduto, use `VilarejoWorldRoads.mount()` ou passe `bridges`/`viaducts` em `roads`. O kit inclui o modelo `VilarejoWorldRoads.presets.industrial` para uma rede viária elevada ilustrativa.

Para efeitos ligados a uma instalação:

```js
this.visualModules.attachEffect("steam", {
  x: 420,
  y: 790,
  count: 5,
  color: 0xe9eee8
});
```

Para ativar a camada de clima e horário:

```js
this.visualModules = VilarejoWorldSceneModules.mount(this, {
  parent: this.world,
  atmosphere: { timeOfDay: "evening", weather: "clear" }
});

this.visualModules.setAtmosphere({
  timeOfDay: "night",
  weather: "rain",
  transitionMs: 1200
});
```

A atmosfera é uma camada fixa à tela, não ao terreno, para manter a tonalidade estável enquanto a câmera se move.

## Posicionamento sem conflito com a câmera

`world_placement.js` deliberadamente não registra eventos globais de mouse. O renderizador atual já usa o ponteiro para arrastar, selecionar e implantar estruturas. Na integração, o próprio `WorldScene` deverá decidir se um clique pertence à câmera, à seleção ou ao posicionamento e então chamar `previewAt()`/`confirm()`.

## Regras de integração

1. **Não duplicar terreno, estradas e árvores.** O renderizador atual chama `drawTerrain()`, `drawRoads()` e `drawTrees()`. Ao migrar para o compositor, essas chamadas antigas devem ser substituídas, não executadas junto com as novas camadas.
2. **Não criar segunda câmera.** Arraste, zoom, limites e centralização continuam sob responsabilidade do `world_renderer_phaser.js` até uma refatoração explícita.
3. **Não escrever no Core.** As estruturas deste kit são objetos visuais temporários. Não são construções persistentes do jogo.
4. **Não inventar dados econômicos.** Não há custos, capacidade, produção, salários, receitas, reservas minerais ou consumo hídrico neste catálogo.
5. **Destruir as camadas ao encerrar a cena.** Use `this.visualModules.destroy()` no ciclo de vida apropriado, ou deixe o desligamento da cena limpar os componentes registrados.
6. **Persistência é outra etapa.** O kit não salva construções, coordenadas nem alterações de terreno.

## Limites e próximos trabalhos

- O desenho é vetorial e ilustrativo, não um pacote de arte final ou sprites isométricos pintados.
- A usina nuclear, mina, refinaria, ponte e demais instalações não possuem comportamento simulado.
- A distribuição de vegetação é determinística por `seed`, mas não analisa automaticamente colisões com edifícios; use `avoid` para reservar áreas.
- A grade isométrica está disponível como utilitário, mas a cena atual ainda utiliza coordenadas próprias. A conversão completa do mapa deve ser feita em uma etapa controlada.
- O carregamento efetivo do Phaser e a ligação dos módulos ao `WorldScene` continuam pendentes.
