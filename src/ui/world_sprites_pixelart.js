/**
 * VILAREJO | SPROUT LANDS STYLE PIXEL-ART ENGINE
 * v2.0.0
 *
 * Inspirado diretamente na estética "Sprout Lands" (Cup Nooble):
 * - Paleta pastel vibrante (grama lima-menta, água turquesa com espuma branca,
 *   caminhos de areia/terra arredondados, telhados coral/mostarda/salvia/lavanda).
 * - Contornos escuros quentes (#422b23) e sombreamento pixel-art em blocos nítidos.
 * - Geração 100% em Pixel Grid via Canvas 2D (escala 3x: 1 pixel lógico = 3x3 px reais),
 *   sem borrões e sem dependência obrigatória de PNGs externos.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.VilarejoPixelArtSprites = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "2.0.0";
  const SCALE = 3; // 16x16 lógico -> 48x48 real

  // Paleta autêntica inspirada em Sprout Lands (Cup Nooble)
  const PALETTE = {
    outline: "#422b23",
    outlineSoft: "#5c3d31",

    // Grama Sprout Lands (verde menta/lima acolhedor)
    grassBase: "#9cd66c",
    grassLight: "#b2e682",
    grassMid: "#86c256",
    grassDark: "#6ba642",
    grassShadow: "#558c33",

    // Penhasco / Borda de ilha
    cliffTop: "#b88256",
    cliffMid: "#996640",
    cliffDark: "#784c2e",

    // Água turquesa pastel + espuma costeira
    waterBase: "#6ec9c4",
    waterDeep: "#5ab3ae",
    waterLight: "#8fe0db",
    waterFoam: "#f2f7f5",
    lilyPad: "#71b856",
    lilyFlower: "#ff9ebb",

    // Caminho de terra / areia arredondado
    pathBase: "#edd19d",
    pathLight: "#f7e2b8",
    pathEdge: "#d4af77",
    pathBorder: "#b58b55",
    pebble: "#c49c66",

    // Ponte e cercas de madeira
    woodLight: "#e0a46c",
    woodMid: "#c4834d",
    woodDark: "#9c6033",
    woodShadow: "#754320",

    // Lavoura / solo arado
    soilBase: "#9c6241",
    soilFurrow: "#78462a",
    soilWet: "#61361e",

    // Paredes e estruturas
    wallCream: "#fcf3dc",
    wallMid: "#ebdcb9",
    wallShadow: "#d1be97",
    stoneLight: "#c5ccd1",
    stoneMid: "#9ea7ad",
    stoneDark: "#768087",

    // Telhados pastel Cup Nooble
    roofCoralLight: "#f28d85",
    roofCoralMid: "#de6d66",
    roofCoralDark: "#ba4f49",

    roofGoldLight: "#fad678",
    roofGoldMid: "#e8b84f",
    roofGoldDark: "#c49231",

    roofSageLight: "#85d1b0",
    roofSageMid: "#62b391",
    roofSageDark: "#468f71",

    roofCivicLight: "#8ea4d6",
    roofCivicMid: "#6c84b8",
    roofCivicDark: "#4e6494",

    roofBarnLight: "#e37b5b",
    roofBarnMid: "#c45b3d",
    roofBarnDark: "#9c4128",

    // Janelas, flores e detalhes
    windowGlass: "#9de3e8",
    windowShine: "#e6fafa",
    flowerPink: "#ff85a1",
    flowerYellow: "#ffe066",
    flowerBlue: "#7cc6fe",
    flowerWhite: "#ffffff",
    berryRed: "#f05454",
    carrotOrange: "#ff9248",
    cowWhite: "#ffffff",
    cowSpot: "#5c4033",
    cowNose: "#ffb3ba"
  };

  function makeCanvas(width, height) {
    if (typeof document !== "undefined" && typeof document.createElement === "function") {
      const el = document.createElement("canvas");
      if (el && typeof el.getContext === "function") {
        el.width = width;
        el.height = height;
        return el;
      }
    }
    return {
      width,
      height,
      getContext() {
        return {
          fillStyle: "",
          fillRect() {},
          clearRect() {}
        };
      }
    };
  }

  /**
   * Cria um buffer de pintura lógica (pixel-art grid) onde cada unidade (x, y)
   * equivale a um bloco SCALE x SCALE no canvas final.
   */
  function createPixelGrid(logicalW, logicalH, scale = SCALE) {
    const canvas = makeCanvas(logicalW * scale, logicalH * scale);
    const ctx = canvas.getContext("2d");

    function px(x, y, color) {
      if (!ctx || !color) return;
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      if (ix < 0 || iy < 0 || ix >= logicalW || iy >= logicalH) return;
      ctx.fillStyle = color;
      ctx.fillRect(ix * scale, iy * scale, scale, scale);
    }

    function rect(x, y, w, h, color) {
      if (!ctx || !color) return;
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          px(x + dx, y + dy, color);
        }
      }
    }

    function boxed(x, y, w, h, fillColor, borderColor = PALETTE.outline) {
      rect(x, y, w, h, borderColor);
      if (w > 2 && h > 2 && fillColor) {
        rect(x + 1, y + 1, w - 2, h - 2, fillColor);
      }
    }

    function roundedBox(x, y, w, h, fillColor, borderColor = PALETTE.outline) {
      rect(x + 1, y, w - 2, h, borderColor);
      rect(x, y + 1, w, h - 2, borderColor);
      if (fillColor) {
        rect(x + 1, y + 1, w - 2, h - 2, fillColor);
      }
    }

    function disc(cx, cy, r, color) {
      const r2 = r * r;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r2 + 0.5) {
            px(cx + dx, cy + dy, color);
          }
        }
      }
    }

    function outlinedDisc(cx, cy, r, fillColor, highlightColor, shadowColor) {
      disc(cx, cy, r, PALETTE.outline);
      disc(cx, cy, r - 1, fillColor);
      if (shadowColor) {
        for (let dy = 0; dy <= r - 1; dy++) {
          for (let dx = -r + 1; dx <= r - 1; dx++) {
            if (dx * dx + dy * dy <= (r - 1) * (r - 1) && dy > r * 0.25) {
              px(cx + dx, cy + dy, shadowColor);
            }
          }
        }
      }
      if (highlightColor) {
        for (let dy = -(r - 1); dy < 0; dy++) {
          for (let dx = -(r - 1); dx < 0; dx++) {
            if (dx * dx + dy * dy <= (r - 2) * (r - 2)) {
              px(cx + dx, cy + dy, highlightColor);
            }
          }
        }
      }
    }

    return { canvas, px, rect, boxed, roundedBox, disc, outlinedDisc };
  }

  // ============================================================================
  // GERADORES DE TILES (16x16 lógico = 48x48 px)
  // ============================================================================

  function buildGrassTile(variant) {
    const g = createPixelGrid(16, 16);
    g.rect(0, 0, 16, 16, PALETTE.grassBase);

    // Manchas suaves estilo Sprout Lands
    g.rect(2, 2, 4, 3, PALETTE.grassLight);
    g.rect(10, 9, 4, 3, PALETTE.grassLight);
    g.rect(1, 11, 3, 3, PALETTE.grassMid);
    g.rect(9, 3, 4, 2, PALETTE.grassMid);

    if (variant === 1) {
      // Tufos de grama
      g.px(4, 6, PALETTE.grassDark);
      g.px(5, 5, PALETTE.grassDark);
      g.px(6, 6, PALETTE.grassDark);
      g.px(11, 13, PALETTE.grassDark);
      g.px(12, 12, PALETTE.grassDark);
    } else if (variant === 2) {
      // Florzinhas brancas e amarelas
      g.px(5, 5, PALETTE.grassDark);
      g.px(5, 4, PALETTE.flowerWhite);
      g.px(6, 4, PALETTE.flowerYellow);
      g.px(12, 11, PALETTE.grassDark);
      g.px(12, 10, PALETTE.flowerPink);
    } else if (variant === 3) {
      // Trevos e flor azul
      g.px(3, 8, PALETTE.grassDark);
      g.px(4, 7, PALETTE.grassLight);
      g.px(10, 6, PALETTE.grassDark);
      g.px(10, 5, PALETTE.flowerBlue);
      g.px(11, 5, PALETTE.flowerWhite);
    }
    return g.canvas;
  }

  function buildWaterTile(variant) {
    const g = createPixelGrid(16, 16);
    g.rect(0, 0, 16, 16, PALETTE.waterBase);
    g.rect(0, 4, 16, 3, PALETTE.waterDeep);
    g.rect(0, 12, 16, 2, PALETTE.waterDeep);

    if (variant === 1) {
      g.rect(3, 2, 5, 1, PALETTE.waterLight);
      g.rect(4, 3, 3, 1, PALETTE.waterFoam);
      g.rect(9, 10, 5, 1, PALETTE.waterLight);
    } else {
      // Vitória-régia com flor de lótus
      g.disc(8, 8, 4, PALETTE.outline);
      g.disc(8, 8, 3, PALETTE.lilyPad);
      g.px(10, 8, PALETTE.waterBase);
      g.rect(7, 6, 2, 2, PALETTE.lilyFlower);
      g.px(8, 6, PALETTE.flowerWhite);
    }
    return g.canvas;
  }

  function buildCoastTile() {
    // Tile de borda de ilha (grama no topo, penhasco de terra, espuma branca na água)
    const g = createPixelGrid(16, 16);
    g.rect(0, 0, 16, 16, PALETTE.waterBase);
    // Espuma costeira branca arredondada
    g.rect(0, 13, 16, 2, PALETTE.waterFoam);
    g.rect(2, 12, 4, 1, PALETTE.waterFoam);
    g.rect(10, 12, 4, 1, PALETTE.waterFoam);
    // Parede do penhasco
    g.rect(0, 7, 16, 5, PALETTE.cliffMid);
    g.rect(0, 11, 16, 1, PALETTE.outline);
    g.rect(2, 8, 3, 3, PALETTE.cliffTop);
    g.rect(9, 8, 4, 2, PALETTE.cliffDark);
    // Borda superior de grama pendente
    g.rect(0, 0, 16, 6, PALETTE.grassBase);
    g.rect(0, 6, 16, 1, PALETTE.outline);
    g.rect(1, 5, 4, 1, PALETTE.grassDark);
    g.rect(8, 5, 5, 1, PALETTE.grassDark);
    return g.canvas;
  }

  function buildPathTile() {
    const g = createPixelGrid(16, 16);
    g.rect(0, 0, 16, 16, PALETTE.grassBase);
    // Caminho arredondado estilo autotile Sprout Lands
    g.roundedBox(1, 1, 14, 14, PALETTE.pathBase, PALETTE.pathBorder);
    g.rect(2, 2, 12, 1, PALETTE.pathLight);
    g.rect(2, 12, 12, 1, PALETTE.pathEdge);
    // Pedrinhas decorativas
    g.rect(4, 5, 2, 2, PALETTE.pebble);
    g.px(5, 5, PALETTE.pathLight);
    g.rect(10, 9, 3, 2, PALETTE.pebble);
    g.px(11, 9, PALETTE.pathLight);
    return g.canvas;
  }

  function buildBridgeTile() {
    const g = createPixelGrid(16, 16);
    g.rect(0, 0, 16, 16, PALETTE.waterBase);
    g.rect(0, 2, 16, 1, PALETTE.waterFoam);
    g.rect(0, 13, 16, 1, PALETTE.waterFoam);
    // Corrimão e tábuas de madeira
    g.rect(0, 2, 16, 2, PALETTE.outline);
    g.rect(0, 3, 16, 1, PALETTE.woodDark);
    g.rect(0, 4, 16, 8, PALETTE.woodMid);
    g.rect(0, 12, 16, 2, PALETTE.outline);
    g.rect(0, 12, 16, 1, PALETTE.woodDark);
    for (let x = 1; x < 16; x += 4) {
      g.rect(x, 4, 2, 8, PALETTE.woodLight);
      g.rect(x + 3, 4, 1, 8, PALETTE.outline);
    }
    return g.canvas;
  }

  function buildFarmTile() {
    const g = createPixelGrid(16, 16);
    g.rect(0, 0, 16, 16, PALETTE.grassBase);
    g.roundedBox(1, 1, 14, 14, PALETTE.soilBase, PALETTE.outline);
    for (let y = 3; y <= 11; y += 4) {
      g.rect(2, y, 12, 2, PALETTE.soilFurrow);
      // Mudas brotando (repolhos e cenouras Sprout Lands)
      for (let x = 3; x <= 11; x += 4) {
        g.rect(x, y - 1, 2, 2, PALETTE.grassDark);
        g.px(x, y - 1, PALETTE.grassLight);
        if ((x + y) % 3 === 0) {
          g.px(x + 1, y, PALETTE.carrotOrange);
        }
      }
    }
    return g.canvas;
  }

  // ============================================================================
  // PROPS, VEGETAÇÃO E ANIMAIS (Sprout Lands)
  // ============================================================================

  function buildOakTree(withFruit) {
    const g = createPixelGrid(24, 28);
    // Sombra na grama
    g.rect(6, 24, 12, 3, PALETTE.grassShadow);
    // Tronco arredondado com contorno escuro
    g.boxed(9, 16, 6, 10, PALETTE.woodMid, PALETTE.outline);
    g.rect(10, 17, 2, 8, PALETTE.woodLight);
    g.rect(13, 17, 1, 8, PALETTE.woodDark);

    // Copa fofa em 3 bolhas sobrepostas (marca registrada de Cup Nooble)
    g.outlinedDisc(8, 12, 6, PALETTE.grassMid, PALETTE.grassLight, PALETTE.grassDark);
    g.outlinedDisc(16, 12, 6, PALETTE.grassMid, PALETTE.grassLight, PALETTE.grassDark);
    g.outlinedDisc(12, 8, 7, PALETTE.grassBase, PALETTE.grassLight, PALETTE.grassMid);

    if (withFruit) {
      // Maçãs/pêssegos vermelhos com brilho
      const fruits = [[8, 9], [15, 10], [11, 13], [13, 6]];
      fruits.forEach(([fx, fy]) => {
        g.rect(fx, fy, 2, 2, PALETTE.berryRed);
        g.px(fx, fy, PALETTE.flowerPink);
      });
    }
    return g.canvas;
  }

  function buildPineTree() {
    const g = createPixelGrid(22, 28);
    g.rect(6, 24, 10, 3, PALETTE.grassShadow);
    g.boxed(9, 19, 4, 7, PALETTE.woodDark, PALETTE.outline);
    // Camadas arredondadas de pinheiro
    g.outlinedDisc(11, 16, 7, PALETTE.grassDark, PALETTE.grassMid, PALETTE.grassShadow);
    g.outlinedDisc(11, 11, 6, PALETTE.grassMid, PALETTE.grassBase, PALETTE.grassDark);
    g.outlinedDisc(11, 6, 4, PALETTE.grassBase, PALETTE.grassLight, PALETTE.grassMid);
    return g.canvas;
  }

  function buildFlowerBush() {
    const g = createPixelGrid(16, 14);
    g.outlinedDisc(8, 8, 5, PALETTE.grassMid, PALETTE.grassLight, PALETTE.grassDark);
    g.outlinedDisc(5, 9, 4, PALETTE.grassMid, PALETTE.grassLight, PALETTE.grassDark);
    g.outlinedDisc(11, 9, 4, PALETTE.grassMid, PALETTE.grassLight, PALETTE.grassDark);
    g.rect(5, 6, 2, 2, PALETTE.flowerPink);
    g.rect(9, 5, 2, 2, PALETTE.flowerYellow);
    g.rect(11, 8, 2, 2, PALETTE.flowerWhite);
    return g.canvas;
  }

  function buildWell() {
    const g = createPixelGrid(24, 26);
    g.rect(4, 22, 16, 3, PALETTE.grassShadow);
    // Base circular de pedra
    g.roundedBox(5, 14, 14, 9, PALETTE.stoneMid, PALETTE.outline);
    g.rect(6, 15, 12, 2, PALETTE.stoneLight);
    g.rect(7, 14, 10, 2, PALETTE.waterBase);
    // Pilares de madeira
    g.boxed(6, 6, 3, 9, PALETTE.woodMid, PALETTE.outline);
    g.boxed(15, 6, 3, 9, PALETTE.woodMid, PALETTE.outline);
    // Telhado coral Sprout Lands
    g.roundedBox(3, 2, 18, 6, PALETTE.roofCoralMid, PALETTE.outline);
    g.rect(5, 3, 14, 2, PALETTE.roofCoralLight);
    g.rect(4, 6, 16, 1, PALETTE.roofCoralDark);
    return g.canvas;
  }

  function buildFenceHorizontal() {
    const g = createPixelGrid(16, 12);
    // Dois postes rechonchudos + 2 travessas
    g.boxed(1, 2, 4, 9, PALETTE.woodMid, PALETTE.outline);
    g.rect(2, 3, 2, 2, PALETTE.woodLight);
    g.boxed(11, 2, 4, 9, PALETTE.woodMid, PALETTE.outline);
    g.rect(12, 3, 2, 2, PALETTE.woodLight);
    g.boxed(0, 4, 16, 3, PALETTE.woodLight, PALETTE.outline);
    g.boxed(0, 7, 16, 3, PALETTE.woodMid, PALETTE.outline);
    return g.canvas;
  }

  function buildCowSprite() {
    // Vaquinha fofa estilo Sprout Lands
    const g = createPixelGrid(18, 15);
    g.rect(3, 12, 12, 2, PALETTE.grassShadow);
    // Corpo arredondado
    g.roundedBox(3, 5, 11, 7, PALETTE.cowWhite, PALETTE.outline);
    g.rect(5, 6, 3, 3, PALETTE.cowSpot);
    g.rect(9, 8, 3, 2, PALETTE.cowSpot);
    // Patinhas
    g.boxed(4, 11, 3, 3, PALETTE.cowWhite, PALETTE.outline);
    g.boxed(10, 11, 3, 3, PALETTE.cowWhite, PALETTE.outline);
    // Cabeça e focinho rosa
    g.roundedBox(10, 3, 7, 7, PALETTE.cowWhite, PALETTE.outline);
    g.rect(11, 7, 5, 2, PALETTE.cowNose);
    g.px(12, 5, PALETTE.outline);
    g.px(15, 5, PALETTE.outline);
    // Chifrinhos/orelhas
    g.rect(10, 2, 2, 2, PALETTE.cowSpot);
    g.rect(15, 2, 2, 2, PALETTE.cowSpot);
    return g.canvas;
  }

  function buildChickenSprite() {
    const g = createPixelGrid(12, 12);
    g.rect(3, 9, 6, 2, PALETTE.grassShadow);
    g.roundedBox(3, 4, 6, 6, PALETTE.cowWhite, PALETTE.outline);
    g.rect(5, 2, 2, 2, PALETTE.berryRed); // crista
    g.px(7, 5, PALETTE.outline); // olho
    g.rect(9, 5, 2, 2, PALETTE.roofGoldMid); // bico
    return g.canvas;
  }

  // ============================================================================
  // EDIFICAÇÕES SPROUT LANDS (36x32 lógico = 108x96 px)
  // ============================================================================

  function drawRoofGable(g, x, y, w, h, light, mid, dark) {
    // Desenha telhado arredondado acolhedor com telhas em escama
    for (let row = 0; row < h; row++) {
      const inset = Math.max(0, Math.floor((h - 1 - row) * 0.65));
      const rw = w - inset * 2;
      const rx = x + inset;
      const ry = y + row;
      const color = row < 3 ? light : row > h - 3 ? dark : mid;
      g.rect(rx, ry, rw, 1, PALETTE.outline);
      if (rw > 2 && row > 0 && row < h - 1) {
        g.rect(rx + 1, ry, rw - 2, 1, color);
        if (row % 3 === 0) {
          for (let sx = rx + 2; sx < rx + rw - 2; sx += 4) {
            g.px(sx, ry, dark);
          }
        }
      }
    }
  }

  function buildHouseSprite() {
    const g = createPixelGrid(36, 32);
    // Chaminé de pedra com fumaça
    g.boxed(24, 2, 5, 9, PALETTE.stoneMid, PALETTE.outline);
    g.rect(25, 3, 3, 2, PALETTE.stoneLight);
    g.disc(27, 0, 1, PALETTE.waterFoam);

    // Paredes creme com vigas de madeira
    g.roundedBox(5, 13, 26, 17, PALETTE.wallCream, PALETTE.outline);
    g.rect(6, 14, 24, 2, PALETTE.wallShadow);
    g.rect(6, 27, 24, 2, PALETTE.stoneMid); // alicerce de pedra

    // Telhado coral Sprout Lands
    drawRoofGable(g, 2, 4, 32, 11, PALETTE.roofCoralLight, PALETTE.roofCoralMid, PALETTE.roofCoralDark);

    // Janela circular no sótão
    g.outlinedDisc(18, 9, 3, PALETTE.windowGlass, PALETTE.windowShine, null);

    // Porta arredondada de madeira
    g.roundedBox(15, 19, 6, 10, PALETTE.woodMid, PALETTE.outline);
    g.rect(16, 20, 4, 8, PALETTE.woodLight);
    g.px(19, 24, PALETTE.roofGoldLight); // maçaneta

    // Janelas laterais com floreiras
    [8, 23].forEach(wx => {
      g.boxed(wx, 17, 5, 5, PALETTE.windowGlass, PALETTE.outline);
      g.px(wx + 1, 18, PALETTE.windowShine);
      g.boxed(wx - 1, 21, 7, 3, PALETTE.woodDark, PALETTE.outline);
      g.px(wx + 1, 21, PALETTE.flowerPink);
      g.px(wx + 3, 21, PALETTE.flowerYellow);
    });

    return g.canvas;
  }

  function buildMarketSprite() {
    const g = createPixelGrid(36, 32);
    // Estrutura da loja com telhado dourado-mel
    g.roundedBox(4, 11, 28, 19, PALETTE.wallCream, PALETTE.outline);
    drawRoofGable(g, 2, 3, 32, 9, PALETTE.roofGoldLight, PALETTE.roofGoldMid, PALETTE.roofGoldDark);

    // Toldo listrado coral & creme (estilo feira de fazenda)
    g.boxed(3, 12, 30, 6, PALETTE.wallCream, PALETTE.outline);
    for (let x = 4; x < 31; x += 6) {
      g.rect(x, 13, 3, 4, PALETTE.roofCoralMid);
      g.rect(x + 3, 13, 3, 4, PALETTE.wallCream);
    }

    // Balcão de madeira com caixotes de frutas/verduras
    g.boxed(5, 21, 26, 8, PALETTE.woodMid, PALETTE.outline);
    g.rect(6, 22, 24, 2, PALETTE.woodLight);
    // Caixotes coloridos
    g.boxed(7, 18, 6, 4, PALETTE.woodDark, PALETTE.outline);
    g.rect(8, 18, 4, 2, PALETTE.berryRed);
    g.boxed(15, 18, 6, 4, PALETTE.woodDark, PALETTE.outline);
    g.rect(16, 18, 4, 2, PALETTE.roofGoldLight);
    g.boxed(23, 18, 6, 4, PALETTE.woodDark, PALETTE.outline);
    g.rect(24, 18, 4, 2, PALETTE.grassLight);

    return g.canvas;
  }

  function buildBarnSprite() {
    const g = createPixelGrid(36, 32);
    // Celeiro de madeira vermelha/terracota Sprout Lands
    g.roundedBox(5, 12, 26, 18, PALETTE.roofBarnMid, PALETTE.outline);
    g.rect(6, 27, 24, 2, PALETTE.stoneMid);
    drawRoofGable(g, 2, 3, 32, 11, PALETTE.roofBarnLight, PALETTE.roofBarnMid, PALETTE.roofBarnDark);

    // Janela do feno no sótão
    g.boxed(15, 8, 6, 5, PALETTE.woodDark, PALETTE.outline);
    g.rect(16, 9, 4, 3, PALETTE.roofGoldLight);

    // Portão duplo com X branco clássico de fazenda
    g.boxed(11, 16, 14, 13, PALETTE.woodMid, PALETTE.outline);
    g.rect(12, 17, 12, 1, PALETTE.wallCream);
    g.rect(17, 17, 2, 11, PALETTE.wallCream);
    for (let i = 0; i < 10; i++) {
      g.px(13 + i, 18 + i, PALETTE.wallCream);
      g.px(22 - i, 18 + i, PALETTE.wallCream);
    }
    return g.canvas;
  }

  function buildHealthSprite() {
    const g = createPixelGrid(36, 32);
    g.roundedBox(5, 12, 26, 18, PALETTE.wallCream, PALETTE.outline);
    drawRoofGable(g, 2, 3, 32, 10, PALETTE.roofSageLight, PALETTE.roofSageMid, PALETTE.roofSageDark);

    // Emblema de cruz de saúde no frontão
    g.roundedBox(14, 7, 8, 7, PALETTE.wallCream, PALETTE.outline);
    g.rect(17, 8, 2, 5, PALETTE.berryRed);
    g.rect(16, 10, 4, 2, PALETTE.berryRed);

    // Porta dupla envidraçada e janelas
    g.boxed(15, 19, 6, 10, PALETTE.windowGlass, PALETTE.outline);
    g.boxed(8, 17, 5, 6, PALETTE.windowGlass, PALETTE.outline);
    g.boxed(23, 17, 5, 6, PALETTE.windowGlass, PALETTE.outline);
    return g.canvas;
  }

  function buildCivicSprite() {
    const g = createPixelGrid(38, 34);
    // Prefeitura / Centro Comunitário imponente com relógio
    g.roundedBox(3, 13, 32, 19, PALETTE.wallCream, PALETTE.outline);
    g.rect(4, 29, 30, 2, PALETTE.stoneMid);
    drawRoofGable(g, 1, 4, 36, 11, PALETTE.roofCivicLight, PALETTE.roofCivicMid, PALETTE.roofCivicDark);

    // Torre do relógio central
    g.roundedBox(14, 1, 10, 10, PALETTE.wallCream, PALETTE.outline);
    g.outlinedDisc(19, 6, 3, PALETTE.roofGoldLight, PALETTE.flowerWhite, null);
    g.px(19, 6, PALETTE.outline);
    g.px(19, 5, PALETTE.outline);
    g.px(20, 6, PALETTE.outline);

    // Colunas de pedra e porta nobre
    [6, 11, 25, 30].forEach(cx => {
      g.boxed(cx, 15, 3, 14, PALETTE.stoneLight, PALETTE.outline);
    });
    g.roundedBox(16, 19, 6, 11, PALETTE.woodDark, PALETTE.outline);
    g.rect(17, 20, 4, 9, PALETTE.woodMid);
    return g.canvas;
  }

  const GENERATORS = {
    tile_grass_1: () => buildGrassTile(1),
    tile_grass_2: () => buildGrassTile(2),
    tile_grass_3: () => buildGrassTile(3),
    tile_water: () => buildWaterTile(1),
    tile_water_lily: () => buildWaterTile(2),
    tile_coast: () => buildCoastTile(),
    tile_path: () => buildPathTile(),
    tile_bridge: () => buildBridgeTile(),
    tile_farm: () => buildFarmTile(),

    prop_tree_oak: () => buildOakTree(false),
    prop_tree_fruit: () => buildOakTree(true),
    prop_tree_pine: () => buildPineTree(),
    prop_bush_flower: () => buildFlowerBush(),
    prop_well: () => buildWell(),
    prop_fence_h: () => buildFenceHorizontal(),
    prop_cow: () => buildCowSprite(),
    prop_chicken: () => buildChickenSprite(),

    bld_house: () => buildHouseSprite(),
    bld_market: () => buildMarketSprite(),
    bld_barn: () => buildBarnSprite(),
    bld_health: () => buildHealthSprite(),
    bld_civic: () => buildCivicSprite()
  };

  function install(scene) {
    if (!scene || !scene.textures || typeof scene.textures.addCanvas !== "function") {
      return 0;
    }

    let count = 0;
    const keys = Object.keys(GENERATORS);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (typeof scene.textures.exists === "function" && scene.textures.exists(key)) {
        count++;
        continue;
      }
      const canvas = GENERATORS[key]();
      scene.textures.addCanvas(key, canvas);
      count++;
    }
    return count;
  }

  return Object.freeze({
    version: VERSION,
    palette: Object.freeze({ ...PALETTE }),
    spriteKeys: Object.freeze(Object.keys(GENERATORS)),
    install
  });
});
