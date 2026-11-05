/**
 * VILAREJO | PIXEL-ART SPRITE GENERATOR (16-BIT COZY FARM & VILLAGE)
 * v1.0.0
 *
 * Gera texturas pixel-art 16-bit (inspiradas em Sprout Lands / Stardew Valley)
 * de forma 100% programática via Canvas 2D API e registra no TextureManager
 * do Phaser 3 (scene.textures.addCanvas).
 *
 * Sem dependências externas ou arquivos binários PNG.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.VilarejoPixelArtSprites = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "1.0.0";

  // Paleta unificada 16-bit fazenda & comunidade
  const PALETTE = {
    ".": null,
    // Grama e vegetação
    g: "#88c96b", // grama base clara
    G: "#73b657", // grama média
    d: "#5d9e44", // grama escura / detalhe
    l: "#a4dc84", // folha iluminada
    L: "#468238", // folhagem profunda
    D: "#2f6127", // sombra de copa
    y: "#f4d35e", // flor amarela / trigo
    p: "#f28482", // flor rosa / fruto
    w: "#ffffff", // brilho branco / flor branca

    // Terra, estrada e lavoura
    r: "#d9be96", // estrada areia/terra clara
    R: "#c4a478", // estrada terra média
    s: "#a8875c", // pedrinha / borda terra
    f: "#8d5b3e", // solo arado base
    F: "#6e4228", // sulco de solo arado

    // Água
    a: "#6cb8d6", // água base
    A: "#549fbe", // água profunda
    e: "#a6dcef", // espuma / reflexo d'água

    // Madeiras e troncos
    t: "#8c5a3c", // tronco / madeira média
    T: "#663f27", // madeira escura / contorno
    c: "#b88458", // madeira clara / cerca

    // Paredes e pedras
    m: "#f6eed8", // parede creme iluminada
    M: "#dfd2b5", // parede creme sombreada
    k: "#9da3a4", // pedra clara / alicerce
    K: "#73797a", // pedra escura / chaminé
    o: "#3d312a", // contorno escuro pixel-art / interior porta

    // Telhados
    h: "#d96b43", // telhado terracota claro
    H: "#b54d2a", // telhado terracota médio
    v: "#8c3519", // telhado terracota sombra
    b: "#d49b3b", // telhado/toldo dourado
    B: "#aa7522", // telhado/toldo dourado escuro
    u: "#568f7c", // telhado saúde verde-água
    U: "#3d6e5e", // telhado saúde escuro
    n: "#5f7464", // telhado cívico ardósia
    N: "#435447", // telhado cívico escuro

    // Janelas e detalhes
    j: "#9ad1d4", // vidro janela
    J: "#d4f0f2", // reflexo janela
    x: "#d94e4e"  // emblema cruz / detalhe vermelho
  };

  const SPRITES = {
    // ======================== TILES DE TERRENO (16x16 @ scale 3 = 48x48) ========================
    tile_grass_1: {
      scale: 3,
      rows: [
        "ggggGGGGggggGGGG",
        "ggggGGGGggggGGGG",
        "ggdggggggglggggg",
        "ggdggggggggggggg",
        "GGGGggggGGGGgggg",
        "GGGGggggGGGGgggg",
        "ggggggggggggdggg",
        "gggggglgggggdggg",
        "ggggGGGGggggGGGG",
        "ggggGGGGggggGGGG",
        "gglggggggggggggg",
        "ggggggggggdggggg",
        "GGGGggggGGdGgggg",
        "GGGGggggGGGGgggg",
        "gggggggggggglggg",
        "gggggggggggggggg"
      ]
    },
    tile_grass_2: {
      scale: 3,
      rows: [
        "GGGGggggGGGGgggg",
        "GGGGggggGGGGgggg",
        "ggggggdggggggggg",
        "ggggggdggggpyggg",
        "ggggGGGGggggGGGG",
        "ggggGGGGggggGGGG",
        "gglggggggggggggg",
        "gggggggggggggggg",
        "GGGGggggGGGGgggg",
        "GGGGggggGGGGgggg",
        "ggggggggggdggggg",
        "gggydgggggdggggg",
        "ggggGGGGggggGGGG",
        "ggggGGGGggggGGGG",
        "gggggggglggggggg",
        "gggggggggggggggg"
      ]
    },
    tile_grass_3: {
      scale: 3,
      rows: [
        "ggggGGGGggggGGGG",
        "gglggggggggggggg",
        "ggggggggggwdgggg",
        "ggggggggggddgggg",
        "GGGGggggGGGGgggg",
        "GGGGggggGGGGgggg",
        "ggggdggggggggggg",
        "ggggdggggglggggg",
        "ggggGGGGggggGGGG",
        "ggggGGGGggggGGGG",
        "gggggggggggggggg",
        "gglgggggggydgggg",
        "GGGGggggGGddgggg",
        "GGGGggggGGGGgggg",
        "gggggggggggggggg",
        "gggggggggggggggg"
      ]
    },
    tile_path: {
      scale: 3,
      rows: [
        "rrrrRRRRrrrrRRRR",
        "rwwrRRRRrrrrRRRR",
        "rrrrrrsrrrrrrsrr",
        "rrrrrrrrrrrrrrrr",
        "RRRRrrrrRRRRrrrr",
        "RRRRrrrrRRRRrwwr",
        "rrsrrrrrrrrrrrrr",
        "rrrrrrrrrrsrrrrr",
        "rrrrRRRRrrrrRRRR",
        "rrrrRRRRrrrrRRRR",
        "rrrrrrwrrrrrrrrr",
        "rrrrrrrrrrrrsrrr",
        "RRRRrrrrRRRRrrrr",
        "RRRRrsrrRRRRrrrr",
        "rrrrrrrrrrwrrrrr",
        "rrrrrrrrrrrrrrrr"
      ]
    },
    tile_water: {
      scale: 3,
      rows: [
        "aaaaAAAAaaaaAAAA",
        "aaeeewAAaaaaAAAA",
        "aaaaaaaaaaaaeeea",
        "aaaaAAAAaaaaaaaa",
        "AAAAaaaaAAAAaaaa",
        "AAAAaaaaAAeeewaa",
        "aaeeaaaaaaaaaaaa",
        "aaaaaaaaAAAAaaaa",
        "aaaaAAAAaaaaAAAA",
        "aaaaAAeeewaaAAAA",
        "aaaaaaaaaaaaaaaa",
        "aaeeaaaaAAAAaaaa",
        "AAAAaaaaAAAAeeea",
        "AAAAaaaaaaaaaaaa",
        "aaaaaaeeewaaaaaa",
        "aaaaAAAAaaaaAAAA"
      ]
    },
    tile_farm: {
      scale: 3,
      rows: [
        "ffffffffffffffff",
        "fFFFFFFFFFFFFFFf",
        "fFglgFFglgFFglFf",
        "fFFFFFFFFFFFFFFf",
        "ffffffffffffffff",
        "fFFFFFFFFFFFFFFf",
        "fFFglgFFglgFFgFf",
        "fFFFFFFFFFFFFFFf",
        "ffffffffffffffff",
        "fFFFFFFFFFFFFFFf",
        "fFglgFFglgFFglFf",
        "fFFFFFFFFFFFFFFf",
        "ffffffffffffffff",
        "fFFFFFFFFFFFFFFf",
        "fFFglgFFglgFFgFf",
        "ffffffffffffffff"
      ]
    },

    // ======================== PROPS & VEGETAÇÃO ========================
    prop_tree_oak: {
      scale: 3,
      rows: [
        "......oooooo......",
        "....oollllllLoo...",
        "...olllgggggLLLo..",
        "..ollggggggggLLLo.",
        ".ollgggglgggggLLLo",
        ".olgggggggggggLLLo",
        "oolggggggggpggLLDo",
        "oolggggpggggggLDDo",
        "oolGGGgggggggLLDDo",
        ".ooLGGGGGGGGLLDDDo",
        "..ooLLLLLLLLLDDDoo",
        "...oooDDDDDDDDooo.",
        ".....ooooooooo....",
        ".......otTto......",
        ".......otTto......",
        ".......otTto......",
        "......ootTtoo.....",
        ".....oTTtTtTTo....",
        ".....ooooooooo...."
      ]
    },
    prop_tree_pine: {
      scale: 3,
      rows: [
        ".......oo.......",
        "......olLo......",
        ".....ollLLo.....",
        "....olggggLo....",
        "...ooGGGGGGoo...",
        "....olggggLo....",
        "...ollggggLLo...",
        "..olggggggggLo..",
        ".ooGGGGGGGGGGoo.",
        "..olGGGGGGGGLLo.",
        ".ollggggggggLLLo",
        "oolGGGGGGGGGGDDo",
        "ooLLLLLLLLLLDDDo",
        "..oooooooooooooo",
        "......otTto.....",
        "......otTto.....",
        ".....ootTtoo....",
        ".....ooooooo...."
      ]
    },
    prop_bush_flower: {
      scale: 3,
      rows: [
        "...oooooooo...",
        "..olllggggLo..",
        ".olggpyggygLo.",
        "oolgggggggpLLo",
        "ooLGGGGGGGLLDo",
        ".ooLLLLLLDDDoo",
        "..oooooooooo.."
      ]
    },
    prop_well: {
      scale: 3,
      rows: [
        "..oooooooooooo..",
        ".ohhhhhhhhhhhHo.",
        "ohHHHHHHHHHHHHvo",
        "ovvvvvvvvvvvvvvo",
        ".oooooooooooooo.",
        "..otTo....otTo..",
        "..otTo....otTo..",
        "..otTo.oo.otTo..",
        ".oooooooooooooo.",
        ".okkkkkkkkkkkKo.",
        ".okKKkkkkkkKKKo.",
        ".okkkkkkkkkkkKo.",
        ".oKKKKKKKKKKKKo.",
        "..oooooooooooo.."
      ]
    },

    // ======================== EDIFICAÇÕES (28x26 @ scale 3 = 84x78) ========================
    bld_house: {
      scale: 3,
      rows: [
        "...................oooo.....",
        "...................okKo.....",
        "..........oooooooo.okKo.....",
        "........oohhhhhhhhookKo.....",
        "......oohhhhhhhhhhHokKo.....",
        "....oohhhhhhhhhhhhhHHKoo....",
        "...ohhhhhhhhHHHHHHHHHHvoo...",
        "..ohhhhhhHHHHHHHHHHHHHHvoo..",
        ".ohhhhHHHHHHHHHHHHHHHHHHvoo.",
        "ohhhHHHHHHHHHHHHHHHHHHHHHvoo",
        "ovvvvvvvvvvvvvvvvvvvvvvvvvvo",
        ".ooooooooooommmmooooooooooo.",
        "..ommmmmmmmmmmmmmmmmmmmmMo..",
        "..ommmmmmmmmmmmmmmmmmmmmMo..",
        "..ommmuuuuoommmmmmoouuuMMo..",
        "..ommmujJuoommmmmmooujJMMo..",
        "..ommmujJuoomoooooomujJMMo..",
        "..ommmuuuuoomottttomuuuMMo..",
        "..ommmppppoomottttompppMMo..",
        "..ommmmmmmmmmotTttommmmmMo..",
        "..ommmmmmmmmmottytommmmmMo..",
        "..oMMMMMMMMMMottttoMMMMMMo..",
        "..okkkkkkkkkkottttokkkkkKo..",
        "..oKKKKKKKKKKottttoKKKKKKo..",
        "..oooooooooooooooooooooooo.."
      ]
    },

    bld_market: {
      scale: 3,
      rows: [
        "......oooooooooooooooo......",
        "....oohhhhhhhhhhhhhhhHoo....",
        "...ohhhhhhhhHHHHHHHHHHHvo...",
        "..ohhhhhHHHHHHHHHHHHHHHHvo..",
        ".ovvvvvvvvvvvvvvvvvvvvvvvvo.",
        ".oommmmmmmmmmmmmmmmmmmmmmoo.",
        "..ommmbbbbbbbbbbbbbbbbMMMo..",
        "..ommmbwwwwbbbbwwwwbbbMMMo..",
        ".ooooobwwwwbbbbwwwwbbbooooo.",
        "ohhhhwwwwhhhhwwwwhhhhwwwwhHo",
        "ohhhhwwwwhhhhwwwwhhhhwwwwhHo",
        "ovvvvBBBBvvvvBBBBvvvvBBBBvvo",
        ".oooooooooooooooooooooooooo.",
        "..otTo..mmmmmmmmmmmm..otTo..",
        "..otTo..mjjjjmmjjjjm..otTo..",
        "..otTo..mjjjjmmjjjjm..otTo..",
        "..otTo.oooooooooooooo.otTo..",
        "..otTo.occccccccccccCo.otTo.",
        "..otTo.ocyyccppccggcCo.otTo.",
        "..otTo.occccccccccccCo.otTo.",
        "..otTo.oTTTTTTTTTTTTTo.otTo.",
        "..okkkkkkkkkkkkkkkkkkkkkKo..",
        "..oKKKKKKKKKKKKKKKKKKKKKKo..",
        "..oooooooooooooooooooooooo.."
      ]
    },

    bld_barn: {
      scale: 3,
      rows: [
        ".........oooooooooo.........",
        ".......oohhhhhhhhhHoo.......",
        ".....oohhhhhhHHHHHHHvoo.....",
        "...oohhhhhhHHHHHHHHHHHvoo...",
        "..ohhhhhHHHHHHHHHHHHHHHHvo..",
        ".ohhhHHHHHHHHoommmoHHHHHHvo.",
        ".ovvvvvvvvvvvojJjvovvvvvvvo.",
        "..ootttttttttojJjvottttttoo.",
        "..ottttttttttooooooottttTo..",
        "..otttttttttttttttttttttTo..",
        "..otTtttttttttttttttttttTo..",
        "..otTtttccccccccccccttttTo..",
        "..otTtttcwccccccccwcttttTo..",
        "..otTtttccwccccccwccttttTo..",
        "..otTtttcccwccccwcccttttTo..",
        "..otTtttccccwccwccccttttTo..",
        "..otTtttcccccwwcccccttttTo..",
        "..otTtttccccwccwccccttttTo..",
        "..otTtttcccwccccwcccttttTo..",
        "..otTtttccwccccccwccttttTo..",
        "..otTtttccccccccccccttttTo..",
        "..okkkkkkkkkkkkkkkkkkkkkKo..",
        "..oKKKKKKKKKKKKKKKKKKKKKKo..",
        "..oooooooooooooooooooooooo.."
      ]
    },

    bld_health: {
      scale: 3,
      rows: [
        "........oooooooooooo........",
        "......oouuuuuuuuuuuUoo......",
        "....oouuuuuuuuuuuuuuUUoo....",
        "...ouuuuuuuuUUUUUUUUUUUoo...",
        "..ouuuuuuUUUUUUUUUUUUUUUoo..",
        ".ouuuuUUUUUUUUUUUUUUUUUUUoo.",
        ".oooooooooooooooooooooooooo.",
        "..ommmmmmmmmmxmmmmmmmmmmMo..",
        "..ommmmmmmmmxxxmmmmmmmmmMo..",
        "..ommmmmmmmmmxxmmmmmmmmmMo..",
        "..ommmmmmmmmmmmmmmmmmmmmMo..",
        "..ommuuuuoommmmmmoouuuuMMo..",
        "..ommujJuoommmmmmooujJuMMo..",
        "..ommujJuoomoooooomujJuMMo..",
        "..ommuuuuoomojJjjomuuuuMMo..",
        "..ommmmmmmmmmojJjjommmmmMo..",
        "..ommmmmmmmmmojJjjommmmmMo..",
        "..ommmmmmmmmmojJjjommmmmMo..",
        "..oMMMMMMMMMMojJjjomMMMMMo..",
        "..okkkkkkkkkkojJjjokkkkkKo..",
        "..oKKKKKKKKKKooooookKKKKKo..",
        "..oooooooooooooooooooooooo.."
      ]
    },

    bld_civic: {
      scale: 3,
      rows: [
        "...........oooooo...........",
        "..........onnnnnNo..........",
        ".........onnnwywnNo.........",
        "........onnnnyyynnNo........",
        "......oonnnnnwywnnnNoo......",
        "....oonnnnnnnNNNNNNNNNoo....",
        "..oonnnnnnNNNNNNNNNNNNNNoo..",
        ".onnnnnNNNNNNNNNNNNNNNNNNNo.",
        "onnnnNNNNNNNNNNNNNNNNNNNNNNo",
        "oooooooooooooooooooooooooooo",
        ".ommmmmmmmmmmmmmmmmmmmmmmMo.",
        ".ommmbbbbbbbbbbbbbbbbbbMMMo.",
        ".omoooooooooooooooooooooMMo.",
        "..okKo.ommmmooooooommmmo.oKo",
        "..okKo.omjJmomtttmoMjJmo.oKo",
        "..okKo.omjJmotTtTtoMjJmo.oKo",
        "..okKo.ommmmotTtTtommmmo.oKo",
        "..okKo.ommmmottyttommmmo.oKo",
        "..okKo.ommmmotTtTtommmmo.oKo",
        "..okKo.oMMMMotTtTtoMMMMo.oKo",
        ".ookKkkkkkkkkottttokkkkkkKoo",
        ".oKKKKKKKKKKKKKKKKKKKKKKKKo.",
        ".oooooooooooooooooooooooooo."
      ]
    }
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
    // Fallback leve para ambientes de teste Node/VM sem HTMLCanvasElement nativo
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

  function renderSpriteToCanvas(def) {
    const scale = def.scale || 3;
    const rows = def.rows || [];
    const h = rows.length * scale;
    const w = (rows[0] ? rows[0].length : 16) * scale;

    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;

    for (let ry = 0; ry < rows.length; ry++) {
      const row = rows[ry];
      for (let rx = 0; rx < row.length; rx++) {
        const ch = row[rx];
        const color = PALETTE[ch];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(rx * scale, ry * scale, scale, scale);
      }
    }
    return canvas;
  }

  function install(scene) {
    if (!scene || !scene.textures || typeof scene.textures.addCanvas !== "function") {
      return 0;
    }

    let count = 0;
    const keys = Object.keys(SPRITES);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (typeof scene.textures.exists === "function" && scene.textures.exists(key)) {
        count++;
        continue;
      }
      const canvas = renderSpriteToCanvas(SPRITES[key]);
      scene.textures.addCanvas(key, canvas);
      count++;
    }
    return count;
  }

  return Object.freeze({
    version: VERSION,
    palette: Object.freeze({ ...PALETTE }),
    spriteKeys: Object.freeze(Object.keys(SPRITES)),
    install
  });
});
