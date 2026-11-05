
/**
 * VILAREJO | PHASER WORLD RENDERER
 * v0.2.0 - Etapas 1 e 2
 *
 * ETAPA 1:
 * Mapa ilustrativo, câmera, zoom, arraste e seleção.
 *
 * ETAPA 2:
 * Catálogo de infraestrutura, categorias, ficha da edificação
 * e implantação visual de construções temporárias.
 *
 * INTEGRAÇÃO:
 * const world = VilarejoWorldRenderer.mount({
 *   container: document.getElementById("worldCanvas"),
 *   getSnapshot: () => window.VilarejoRuntime.snapshot()
 * });
 *
 * Após atualização do Core:
 * world.refresh();
 *
 * Ao sair da tela:
 * world.destroy();
 *
 * SEGURANÇA:
 * Somente leitura do snapshot.
 * Não avança a simulação nem altera economia, caixa,
 * população ou qualquer estado de domínio.
 *
 * Construções implantadas pelo catálogo são apenas visuais,
 * temporárias e não persistem.
 *
 * Phaser 3 deve estar carregado em window.Phaser.
 */
(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.VilarejoWorldRenderer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const VERSION = "0.2.0";
  const W = 1280, H = 760, MAP_W = 1900, MAP_H = 1350;
  const KEY = "VilarejoWorldScene";

  const C = {
    grass: 0xb7cda9,
    water: 0x8dbdc0,
    road: 0xd8c7a2,
    panel: 0xf7f6ec,
    border: 0xcbd6c5,
    selected: 0xe5b95c
  };

  const CATALOG = [
    {
      type: "house",
      spriteKey: "bld_house",
      label: "Residência",
      category: "Moradia",
      color: 0xd96b43,
      description: "Edificação residencial ilustrativa."
    },
    {
      type: "commerce",
      spriteKey: "bld_market",
      label: "Mercado",
      category: "Comércio",
      color: 0xd49b3b,
      description: "Ponto comercial ilustrativo."
    },
    {
      type: "production",
      spriteKey: "bld_barn",
      label: "Oficina",
      category: "Produção",
      color: 0x8c5a3c,
      description: "Unidade produtiva ilustrativa."
    },
    {
      type: "service",
      spriteKey: "bld_health",
      label: "Posto de saúde",
      category: "Serviços",
      color: 0x568f7c,
      description: "Equipamento de serviço público ilustrativo."
    },
    {
      type: "civic",
      spriteKey: "bld_civic",
      label: "Prefeitura",
      category: "Administração",
      color: 0x5f7464,
      description: "Edificação administrativa ilustrativa."
    }
  ];

  const DEFAULTS = [
    ["central", "civic", 840, 555, "Centro administrativo"],
    ["house1", "house", 650, 680, "Residência 01"],
    ["house2", "house", 1040, 690, "Residência 02"],
    ["house3", "house", 1200, 480, "Residência 03"],
    ["market", "commerce", 1050, 420, "Mercado comunitário"],
    ["workshop", "production", 1370, 680, "Oficina"],
    ["health", "service", 590, 440, "Posto de saúde"],
    ["house4", "house", 790, 850, "Residência 04"]
  ];

  const object = v =>
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v);

  function readSnapshot(fn) {
    try {
      const v = fn();
      return object(v) ? v : {};
    } catch (e) {
      console.warn(
        "[Vilarejo/Phaser] Snapshot indisponível:",
        e
      );
      return {};
    }
  }

  function normalize(raw, i) {
    if (!object(raw)) return null;

    const type = CATALOG.some(c => c.type === raw.type)
      ? raw.type
      : "house";

    const x = Number(raw.x);
    const y = Number(raw.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }

    const meta = CATALOG.find(c => c.type === type);

    return {
      id: String(raw.id || `building-${i + 1}`),
      type,
      x,
      y,
      name: String(raw.name || meta.label),
      description: String(
        raw.description || meta.description
      ),
      source: raw.source === "external"
        ? "external"
        : "illustrative"
    };
  }

  function sceneFactory(Phaser, latest, options) {
    return class WorldScene extends Phaser.Scene {

      constructor() {
        super({ key: KEY });

        this.buildings = new Map();
        this.selected = null;
        this.placing = null;
        this.nextId = 1;
        this.drag = null;
      }

      preload() {
        this.installSprites();
      }

      installSprites() {
        const spriteLib =
          (root && root.VilarejoPixelArtSprites) ||
          (typeof globalThis !== "undefined" && globalThis.VilarejoPixelArtSprites) ||
          (typeof window !== "undefined" && window.VilarejoPixelArtSprites);

        if (spriteLib && typeof spriteLib.install === "function") {
          spriteLib.install(this);
        }
      }

      hasTexture(key) {
        return Boolean(
          this.textures &&
          typeof this.textures.exists === "function" &&
          this.textures.exists(key) &&
          this.add &&
          typeof this.add.image === "function"
        );
      }

      create() {
        this.installSprites();
        this.cameras.main.setBackgroundColor(0xdfe9d9);
        this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
        this.cameras.main.centerOn(
          MAP_W / 2,
          MAP_H / 2
        );

        this.world = this.add.container(0, 0);

        this.ui = this.add.container(0, 0)
          .setScrollFactor(0)
          .setDepth(1000);

        this.drawTerrain();
        this.drawRoads();
        this.drawTrees();
        this.addHeadings();

        const supplied =
          typeof options.getWorldData === "function"
            ? options.getWorldData()
            : null;

        const initial =
          Array.isArray(supplied?.buildings)
            ? supplied.buildings
            : DEFAULTS.map(
                ([id, type, x, y, name]) => ({
                  id,
                  type,
                  x,
                  y,
                  name
                })
              );

        initial
          .map(normalize)
          .filter(Boolean)
          .forEach(b => this.addBuilding(b));

        this.createUI();
        this.updateSnapshot(latest());

        this.input.on(
          "pointerdown",
          this.pointerDown,
          this
        );

        this.input.on(
          "pointermove",
          this.pointerMove,
          this
        );

        this.input.on("pointerup", () => {
          this.drag = null;
        });

        this.input.on("gameout", () => {
          this.drag = null;
        });

        this.input.on("wheel", this.wheel, this);
      }

      polygon(target, points, color, alpha = 1) {
        const g = this.add.graphics()
          .fillStyle(color, alpha);

        g.fillPoints(
          points.map(
            p => new Phaser.Geom.Point(p[0], p[1])
          ),
          true
        );

        target.add(g);
        return g;
      }

      diamond(
        target,
        x,
        y,
        rx,
        ry,
        color,
        alpha = 1
      ) {
        return this.polygon(
          target,
          [
            [x, y - ry],
            [x + rx, y],
            [x, y + ry],
            [x - rx, y]
          ],
          color,
          alpha
        );
      }

      drawTerrain() {
        this.polygon(
          this.world,
          [
            [0, 0],
            [MAP_W, 0],
            [MAP_W, MAP_H],
            [0, MAP_H]
          ],
          C.grass
        );

        const hasGrassTiles = this.hasTexture("tile_grass_1");

        if (hasGrassTiles) {
          const grassKeys = ["tile_grass_1", "tile_grass_2", "tile_grass_3"];
          for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 20; c++) {
              const key = grassKeys[(r * 5 + c * 3) % grassKeys.length];
              const tile = this.add.image(48 + c * 96, 48 + r * 90, key);
              if (typeof tile.setAlpha === "function") tile.setAlpha(0.75);
              this.world.add(tile);
            }
          }
        } else {
          for (let r = 0; r < 23; r++) {
            for (let c = 0; c < 29; c++) {
              const palette = [
                0xb7cda9,
                0xc9daba,
                0xa9c397
              ];

              this.diamond(
                this.world,
                45 + c * 67 + (r % 2) * 33,
                70 + r * 47,
                37,
                19,
                palette[(r * 3 + c) % 3],
                0.38
              );
            }
          }
        }

        this.polygon(
          this.world,
          [
            [80, 210],
            [170, 165],
            [300, 205],
            [330, 270],
            [260, 315],
            [130, 285]
          ],
          C.water,
          0.92
        );

        this.polygon(
          this.world,
          [
            [0, 1030],
            [0, 1090],
            [430, 940],
            [520, 970],
            [470, 1010],
            [80, 1145]
          ],
          C.water,
          0.75
        );

        if (this.hasTexture("tile_water")) {
          [
            [175, 225],
            [223, 225],
            [271, 240],
            [195, 265],
            [243, 265],
            [180, 1060],
            [260, 1030],
            [340, 1000],
            [420, 975]
          ].forEach(([wx, wy]) => {
            const wTile = this.add.image(wx, wy, "tile_water");
            this.world.add(wTile);
          });
        }

        if (this.hasTexture("tile_farm")) {
          [
            [1280, 770],
            [1328, 770],
            [1376, 770],
            [1280, 818],
            [1328, 818],
            [1376, 818]
          ].forEach(([fx, fy]) => {
            const fTile = this.add.image(fx, fy, "tile_farm");
            this.world.add(fTile);
          });
        }

        if (this.hasTexture("prop_well")) {
          const well = this.add.image(915, 610, "prop_well").setDepth(610);
          this.world.add(well);
        }
      }

      drawRoads() {
        const roads = [
          [
            [90, 760],
            [120, 715],
            [790, 460],
            [835, 485],
            [850, 515],
            [810, 535],
            [145, 805]
          ],
          [
            [800, 485],
            [845, 455],
            [1510, 740],
            [1470, 780],
            [1430, 790],
            [830, 535]
          ],
          [
            [1020, 160],
            [1060, 140],
            [1160, 440],
            [1125, 465],
            [1090, 450]
          ],
          [
            [420, 930],
            [450, 895],
            [950, 1090],
            [920, 1130],
            [880, 1135]
          ]
        ];

        roads.forEach(p =>
          this.polygon(this.world, p, C.road)
        );

        if (this.hasTexture("tile_path")) {
          [
            [240, 700], [360, 655], [480, 610], [600, 565], [720, 520],
            [830, 500], [950, 550], [1070, 600], [1190, 650], [1310, 700],
            [1065, 240], [1095, 320], [1120, 400],
            [540, 960], [660, 1005], [780, 1050]
          ].forEach(([px, py]) => {
            const pTile = this.add.image(px, py, "tile_path");
            this.world.add(pTile);
          });
        }
      }

      drawTrees() {
        const hasTreeSprites = this.hasTexture("prop_tree_oak");

        [
          [180, 420],
          [260, 520],
          [430, 330],
          [520, 800],
          [730, 250],
          [930, 280],
          [1450, 360],
          [1570, 510],
          [1650, 880],
          [1350, 980],
          [1080, 1050],
          [320, 1120],
          [1750, 250],
          [70, 890],
          [1520, 1120]
        ].forEach(([x, y], i) => {
          if (hasTreeSprites) {
            const shadow = this.add.ellipse(x, y + 18, 48, 20, 0x4b6447, 0.28);
            const treeKey = i % 3 === 0 && this.hasTexture("prop_tree_pine")
              ? "prop_tree_pine"
              : "prop_tree_oak";
            const tree = this.add.image(x, y - 6, treeKey).setDepth(y);
            this.world.add([shadow, tree]);

            if (i % 4 === 0 && this.hasTexture("prop_bush_flower")) {
              const bush = this.add
                .image(x + 36, y + 14, "prop_bush_flower")
                .setDepth(y + 14);
              this.world.add(bush);
            }
          } else {
            this.world.add([
              this.add.rectangle(
                x, y + 8, 10, 31, 0x80694b
              ),
              this.add.ellipse(
                x, y - 16, 48, 42,
                i % 2 ? 0x477b55 : 0x5c8b5d
              ),
              this.add.ellipse(
                x - 7, y - 25, 25, 22,
                i % 2 ? 0x619968 : 0x75a66c
              )
            ]);
          }
        });
      }

      addHeadings() {
        this.world.add([
          this.add.text(
            75,
            65,
            "O TERRITÓRIO",
            {
              fontFamily: "DM Sans,Arial",
              fontSize: 14,
              fontStyle: "bold",
              color: "#55715b",
              letterSpacing: 2
            }
          ),

          this.add.text(
            75,
            91,
            "Uma comunidade em construção",
            {
              fontFamily: "Manrope,Arial",
              fontSize: 27,
              fontStyle: "bold",
              color: "#234333"
            }
          )
        ]);
      }

      addBuilding(data) {
        const meta =
          CATALOG.find(c => c.type === data.type) ||
          CATALOG[0];

        const group = this.add.container(
          data.x,
          data.y
        );

        const shadow = this.add.ellipse(
          0, 25, 116, 46, 0x71856b, 0.28
        );

        const ring = this.add.ellipse(
          0, 2, 122, 72, 0xffffff, 0
        )
          .setStrokeStyle(3, C.selected, 0)
          .setVisible(false);

        const label = this.add.text(
          0,
          54,
          data.name,
          {
            fontFamily: "DM Sans,Arial",
            fontSize: 12,
            fontStyle: "bold",
            color: "#294735",
            backgroundColor: "#f7f6ec",
            padding: { x: 6, y: 4 }
          }
        ).setOrigin(0.5, 0);

        const spriteKey = meta.spriteKey || "bld_house";

        if (this.hasTexture(spriteKey)) {
          const sprite = this.add.image(0, -10, spriteKey);
          group.add([
            shadow,
            ring,
            sprite,
            label
          ]);
        } else {
          const left = this.add.polygon(
            -31,
            -3,
            [-39, -34, 0, -55, 0, 18, -39, 39],
            0xeee4d1
          );

          const right = this.add.polygon(
            0,
            -18,
            [0, -37, 39, -16, 39, 39, 0, 18],
            0xd3c4aa
          );

          const roof = this.add.polygon(
            0,
            -50,
            [-48, -4, 0, -31, 48, -4, 0, 23],
            meta.color
          );

          const door = this.add.rectangle(
            -7, 17, 14, 31, 0x765d46
          );

          const win = this.add.rectangle(
            21, -3, 13, 16, 0xa9c7c4
          );

          group.add([
            shadow,
            left,
            right,
            roof,
            door,
            win,
            ring,
            label
          ]);
        }

        group
          .setSize(116, 125)
          .setDepth(data.y);

        group.setInteractive(
          new Phaser.Geom.Rectangle(
            -58, -55, 116, 125
          ),
          Phaser.Geom.Rectangle.Contains
        );

        group.on("pointerdown", p => {
          p.event.stopPropagation();
          this.select(data.id);
        });

        this.world.add(group);

        this.buildings.set(data.id, {
          data,
          group,
          ring,
          category: meta.category
        });
      }

      select(id) {
        const entry = this.buildings.get(id);
        if (!entry) return;

        this.selected = id;

        this.buildings.forEach(v => {
          v.ring.setVisible(v.data.id === id);

          if (v.data.id === id) {
            v.ring.setStrokeStyle(
              3,
              C.selected,
              1
            );
          }
        });

        this.infoTitle.setText(entry.data.name);

        this.infoBody.setText(
          `${entry.category}\n` +
          `${entry.data.description}\n\n` +
          `${
            entry.data.source === "external"
              ? "Origem: adaptador visual."
              : "Origem: elemento ilustrativo temporário."
          }`
        );
      }

      startPlacement(type) {
        if (!CATALOG.some(c => c.type === type)) {
          return;
        }

        this.placing = type;

        const m = CATALOG.find(
          c => c.type === type
        );

        this.hint.setText(
          `MODO DE IMPLANTAÇÃO: clique no terreno ` +
          `para posicionar ${m.label.toLowerCase()}.`
        );
      }

      cancelPlacement() {
        this.placing = null;

        this.hint.setText(
          "Escolha uma estrutura ou selecione uma edificação no mapa."
        );
      }

      place(x, y) {
        if (!this.placing) return;

        const meta = CATALOG.find(
          c => c.type === this.placing
        );

        const id = `visual-${this.nextId++}`;

        const b = {
          id,
          type: this.placing,
          x: Math.round(x),
          y: Math.round(y),
          name: `${meta.label} ${this.nextId - 1}`,
          description: meta.description,
          source: "illustrative"
        };

        this.addBuilding(b);
        this.select(id);
        this.cancelPlacement();
      }

      createUI() {
        const panel = this.add.rectangle(
          1090,
          245,
          340,
          400,
          C.panel,
          0.97
        ).setStrokeStyle(1, C.border);

        const heading = this.add.text(
          940,
          66,
          "GESTÃO DO TERRITÓRIO",
          {
            fontFamily: "DM Sans,Arial",
            fontSize: 11,
            fontStyle: "bold",
            color: "#667b68",
            letterSpacing: 1
          }
        );

        const title = this.add.text(
          940,
          94,
          "Infraestrutura",
          {
            fontFamily: "Manrope,Arial",
            fontSize: 21,
            fontStyle: "bold",
            color: "#294735"
          }
        );

        this.hint = this.add.text(
          940,
          126,
          "Escolha uma estrutura no catálogo ou selecione uma edificação.",
          {
            fontFamily: "DM Sans,Arial",
            fontSize: 11,
            color: "#667b68",
            wordWrap: { width: 285 },
            lineSpacing: 3
          }
        );

        let y = 190;

        const controls = [
          panel,
          heading,
          title,
          this.hint
        ];

        CATALOG.forEach(item => {
          const btn = this.add.rectangle(
            1088,
            y + 12,
            286,
            34,
            0xe9eee3
          )
            .setStrokeStyle(1, 0xd6dfd0)
            .setInteractive({ useHandCursor: true });

          const swatch = this.add.rectangle(
            958,
            y + 12,
            12,
            12,
            item.color
          );

          const txt = this.add.text(
            976,
            y + 4,
            `${item.label} · ${item.category}`,
            {
              fontFamily: "DM Sans,Arial",
              fontSize: 12,
              color: "#294735"
            }
          ).setInteractive({ useHandCursor: true });

          btn.on(
            "pointerdown",
            () => this.startPlacement(item.type)
          );

          txt.on(
            "pointerdown",
            () => this.startPlacement(item.type)
          );

          controls.push(btn, swatch, txt);
          y += 42;
        });

        const cancel = this.button(
          1088,
          414,
          286,
          30,
          "Cancelar implantação",
          () => this.cancelPlacement()
        );

        const divider = this.add.rectangle(
          1090,
          445,
          286,
          1,
          0xd6dfd0
        );

        this.infoTitle = this.add.text(
          950,
          466,
          "Edificação selecionada",
          {
            fontFamily: "Manrope,Arial",
            fontSize: 15,
            fontStyle: "bold",
            color: "#294735",
            wordWrap: { width: 275 }
          }
        );

        this.infoBody = this.add.text(
          950,
          493,
          "Clique em uma construção para consultar os detalhes.",
          {
            fontFamily: "DM Sans,Arial",
            fontSize: 11,
            color: "#667b68",
            wordWrap: { width: 275 },
            lineSpacing: 4
          }
        );

        controls.push(
          cancel,
          divider,
          this.infoTitle,
          this.infoBody
        );

        controls.push(
          this.button(
            960, 550, 40, 30, "+",
            () => this.zoom(0.15)
          )
        );

        controls.push(
          this.button(
            1010, 550, 40, 30, "−",
            () => this.zoom(-0.15)
          )
        );

        controls.push(
          this.button(
            1090, 550, 110, 30, "Centralizar",
            () => this.resetCamera()
          )
        );

        this.status = this.add.text(
          75,
          710,
          "LENDO ESTADO DA SIMULAÇÃO...",
          {
            fontFamily: "DM Sans,Arial",
            fontSize: 11,
            fontStyle: "bold",
            color: "#536955"
          }
        );

        controls.push(this.status);
        this.ui.add(controls);
      }

      button(x, y, w, h, label, callback) {
        const bg = this.add.rectangle(
          x, y, w, h, 0xe9eee3
        )
          .setStrokeStyle(1, C.border)
          .setInteractive({ useHandCursor: true });

        const txt = this.add.text(
          x,
          y,
          label,
          {
            fontFamily: "DM Sans,Arial",
            fontSize: 11,
            fontStyle: "bold",
            color: "#294735"
          }
        )
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });

        bg.on("pointerdown", callback);
        txt.on("pointerdown", callback);

        return this.add.container(
          0,
          0,
          [bg, txt]
        );
      }

      pointerDown(pointer) {
        if (pointer.x > 900) return;

        if (this.placing) {
          const p = this.cameras.main.getWorldPoint(
            pointer.x,
            pointer.y
          );

          this.place(p.x, p.y);
          return;
        }

        this.drag = {
          x: pointer.x,
          y: pointer.y,
          sx: this.cameras.main.scrollX,
          sy: this.cameras.main.scrollY
        };
      }

      pointerMove(pointer) {
        if (!this.drag || !pointer.isDown) return;

        this.cameras.main.scrollX =
          this.drag.sx -
          (pointer.x - this.drag.x) /
          this.cameras.main.zoom;

        this.cameras.main.scrollY =
          this.drag.sy -
          (pointer.y - this.drag.y) /
          this.cameras.main.zoom;
      }

      wheel(pointer, objects, dx, dy) {
        if (pointer.x < 900) {
          this.zoom(dy > 0 ? -0.08 : 0.08);
        }
      }

      zoom(delta) {
        this.cameras.main.setZoom(
          Phaser.Math.Clamp(
            this.cameras.main.zoom + delta,
            0.55,
            1.65
          )
        );
      }

      resetCamera() {
        this.cameras.main.setZoom(1);
        this.cameras.main.centerOn(
          MAP_W / 2,
          MAP_H / 2
        );
      }

      updateSnapshot(snapshot) {
        if (!this.status) return;

        const session = object(snapshot.session)
          ? snapshot.session
          : {};

        const calendar = object(snapshot.calendar)
          ? snapshot.calendar
          : {};

        const pop = object(snapshot.population)
          ? snapshot.population
          : {};

        const totals = object(pop.totals)
          ? pop.totals
          : {};

        const count = Array.isArray(snapshot.modules)
          ? snapshot.modules.length
          : 0;

        const labels = {
          ready: "Pronta",
          running: "Em andamento",
          paused: "Pausada",
          "game-over": "Encerrada"
        };

        const day = Number.isFinite(calendar.day)
          ? `Dia ${calendar.day}`
          : "Dia não informado";

        const people = Number.isFinite(totals.people)
          ? ` · População: ${totals.people}`
          : "";

        this.status.setText(
          `SIMULAÇÃO: ${
            labels[session.status] || "Estado não informado"
          } · ${day} · Módulos: ${count}${people}`
        );
      }
    };
  }

  function mount(options = {}) {
    const Phaser = options.Phaser || root.Phaser;
    const container = options.container;
    const getSnapshot = options.getSnapshot;

    if (
      !Phaser ||
      !Phaser.Game ||
      !Phaser.Scene ||
      !Phaser.Geom ||
      !Phaser.Math
    ) {
      throw new Error(
        "Phaser 3 não está carregado corretamente."
      );
    }

    if (
      !container ||
      typeof container.appendChild !== "function"
    ) {
      throw new TypeError(
        "Informe um elemento HTML válido em container."
      );
    }

    if (typeof getSnapshot !== "function") {
      throw new TypeError(
        "Informe getSnapshot como função somente de leitura."
      );
    }

    if (container.__vilarejoWorld) {
      throw new Error(
        "Já existe um mundo montado neste elemento."
      );
    }

    let snapshot = readSnapshot(getSnapshot);

    const Scene = sceneFactory(
      Phaser,
      () => snapshot,
      options
    );

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: W,
      height: H,
      backgroundColor: 0xdfe9d9,

      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: W,
        height: H
      },

      render: {
        pixelArt: true,
        antialias: false,
        roundPixels: true
      },

      scene: [Scene]
    });

    const handle = {
      game,

      refresh() {
        snapshot = readSnapshot(getSnapshot);

        try {
          const s = game.scene.getScene(KEY);

          if (s && s.updateSnapshot) {
            s.updateSnapshot(snapshot);
          }
        } catch (e) {}

        return snapshot;
      },

      destroy() {
        if (game && game.destroy) {
          game.destroy(true);
        }

        if (container.__vilarejoWorld === handle) {
          delete container.__vilarejoWorld;
        }
      }
    };

    container.__vilarejoWorld = handle;

    return Object.freeze(handle);
  }

  return Object.freeze({
    version: VERSION,
    catalog: Object.freeze(CATALOG),
    mount
  });
});
