/**
 * VILAREJO | STRUCTURE RENDERER
 * Construções vetoriais: energia, mineração, petróleo, serviços e indústria.
 * Todos os elementos são cenográficos e não geram efeitos econômicos.
 */
(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (root) root.VilarejoWorldStructures = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const COLORS = Object.freeze({
    ground: 0x71866e, concrete: 0xc8c7bb, concreteDark: 0x8d918a,
    roof: 0x88765f, metal: 0x69787a, glass: 0x8db8bd,
    shadow: 0x53694f, yellow: 0xd5ad52, orange: 0xb96c43,
    green: 0x56865c, blue: 0x5e92a2, dark: 0x39484a,
    white: 0xe9e5d8, red: 0xb95b4c
  });

  function rect(g, x, y, w, h, color, alpha) {
    g.fillStyle(color, alpha == null ? 1 : alpha).fillRect(x, y, w, h);
  }
  function ellipse(g, x, y, w, h, color, alpha) {
    g.fillStyle(color, alpha == null ? 1 : alpha).fillEllipse(x, y, w, h);
  }
  function circle(g, x, y, r, color, alpha) {
    g.fillStyle(color, alpha == null ? 1 : alpha).fillCircle(x, y, r);
  }
  function poly(g, points, color, alpha) {
    g.fillStyle(color, alpha == null ? 1 : alpha);
    g.beginPath(); g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) g.lineTo(points[i][0], points[i][1]);
    g.closePath(); g.fillPath();
  }
  function line(g, points, color, width, alpha) {
    g.lineStyle(width || 3, color, alpha == null ? 1 : alpha);
    g.beginPath(); g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) g.lineTo(points[i][0], points[i][1]);
    g.strokePath();
  }

  function drawBase(g, meta) {
    ellipse(g, 0, 30, meta.width * 1.08, 35, COLORS.shadow, 0.30);
    poly(g, [[-meta.width / 2, 18], [0, 0], [meta.width / 2, 18], [0, 38]], 0xb5b39f, 1);
    poly(g, [[-meta.width / 2, 18], [0, 38], [0, 47], [-meta.width / 2, 27]], 0x969887, 1);
    poly(g, [[0, 38], [meta.width / 2, 18], [meta.width / 2, 27], [0, 47]], 0x858979, 1);
  }

  function drawHouse(g) {
    rect(g, -30, -17, 60, 38, 0xe5ddc9);
    poly(g, [[-36, -17], [0, -42], [36, -17], [0, -3]], 0x9b6549);
    rect(g, -7, 0, 14, 21, 0x765743);
    rect(g, 13, -7, 12, 12, COLORS.glass);
  }
  function drawApartment(g) {
    rect(g, -34, -76, 68, 98, 0xc9c7b8);
    rect(g, -41, -80, 82, 10, 0x8b8174);
    for (let r = 0; r < 4; r += 1) for (let c = 0; c < 3; c += 1) rect(g, -23 + c * 22, -62 + r * 20, 11, 10, 0x82aeb4);
    rect(g, -7, 0, 15, 22, 0x78634c);
  }
  function drawPublic(g, kind) {
    const accent = kind === "hospital" ? 0x6eaaa0 : kind === "school" ? 0x6b91a8 : 0x829179;
    rect(g, -47, -30, 94, 52, 0xe5e1d4);
    poly(g, [[-53, -30], [0, -55], [53, -30], [0, -12]], accent);
    rect(g, -8, -4, 16, 26, 0x78634c);
    for (let x = -32; x <= 32; x += 32) rect(g, x - 7, -21, 14, 13, COLORS.glass);
    if (kind === "hospital") {
      rect(g, -5, -48, 10, 21, 0xe9e5d8); rect(g, -11, -42, 22, 8, 0xe9e5d8);
      rect(g, -3, -46, 6, 17, 0xb75c50); rect(g, -8, -40, 16, 5, 0xb75c50);
    }
  }
  function drawFactory(g) {
    rect(g, -54, -28, 108, 50, 0xb9b7aa);
    poly(g, [[-56, -28], [-31, -49], [-5, -28], [20, -49], [56, -28]], 0x827d73);
    rect(g, 28, -74, 16, 46, 0x777d79);
    rect(g, 31, -82, 10, 9, 0x9c7661);
    rect(g, -37, -15, 19, 19, 0x7da4a7);
    rect(g, -8, -15, 19, 19, 0x7da4a7);
  }
  function drawWaterTreatment(g) {
    rect(g, -55, -18, 110, 35, 0xbabbb2);
    ellipse(g, -28, -11, 43, 28, 0x76aeb8);
    ellipse(g, 25, -11, 43, 28, 0x76aeb8);
    rect(g, -48, -47, 20, 29, 0xe2e0d5);
    rect(g, -43, -55, 10, 9, 0x6e999e);
    line(g, [[-48, -48], [45, -48], [45, -19]], 0x6c8e91, 5);
  }
  function drawHydro(g) {
    // Barragem em corte, vertedouro e casa de força.
    poly(g, [[-80, -35], [-45, -70], [44, -28], [67, 5], [-66, 12]], 0x969d98);
    poly(g, [[-45, -70], [44, -28], [67, 5], [18, -10]], 0x727f7d);
    for (let i = -37; i <= 35; i += 24) rect(g, i, -44 + (i + 37) * 0.18, 12, 30, 0x566a6b);
    rect(g, 35, -8, 42, 27, 0xe0d9c7);
    poly(g, [[30, -8], [56, -25], [83, -8], [56, 2]], 0x5c8791);
    rect(g, -82, 16, 164, 8, 0x6aaab4, 0.85);
    line(g, [[-65, 24], [-30, 28], [5, 24], [40, 28], [75, 24]], 0xc0e0dc, 3, 0.9);
    rect(g, 47, -30, 8, 24, 0xd8d5c9);
  }
  function drawCoolingTower(g, x, y, scale) {
    const s = scale || 1;
    poly(g, [[x - 17*s, y + 29*s], [x - 12*s, y - 27*s], [x - 7*s, y - 42*s], [x + 7*s, y - 42*s], [x + 12*s, y - 27*s], [x + 17*s, y + 29*s]], 0xd9d8cc);
    line(g, [[x - 13*s, y - 12*s], [x + 13*s, y - 12*s]], 0xb6b7ad, 2);
  }
  function drawNuclear(g) {
    rect(g, -65, -3, 130, 28, 0x9da59c);
    ellipse(g, -27, -23, 54, 43, 0xdeddd2);
    rect(g, -29, -25, 58, 27, 0xdeddd2);
    ellipse(g, -27, -39, 54, 30, 0xe8e5d9);
    drawCoolingTower(g, 47, -2, 1.12);
    drawCoolingTower(g, 77, 1, 0.92);
    rect(g, -59, -56, 8, 33, 0x9c9e96);
    rect(g, -62, -60, 14, 6, 0x777e7b);
    ellipse(g, 47, -63, 39, 17, 0xdce5e4, 0.25);
    ellipse(g, 77, -58, 34, 14, 0xdce5e4, 0.22);
    rect(g, -10, -16, 19, 13, 0x6d8c91);
  }
  function drawMine(g, isGold) {
    const rock = isGold ? 0x8a8063 : 0x777c79;
    poly(g, [[-72, 15], [-54, -23], [-26, -11], [-4, -43], [22, -14], [52, -27], [75, 15]], rock);
    rect(g, -32, -27, 64, 43, 0x554f45);
    poly(g, [[-38, -27], [0, -49], [38, -27]], 0x9a8e76);
    rect(g, -24, -13, 48, 28, 0x242f30);
    rect(g, -6, -58, 12, 32, 0x6c7777);
    line(g, [[-37, -57], [0, -75], [34, -57]], 0x5a625d, 5);
    line(g, [[0, -75], [0, -35]], 0x4f5d5b, 4);
    line(g, [[26, -20], [65, -3], [78, -3]], 0x4c5552, 5);
    ellipse(g, 52, 16, 38, 17, isGold ? 0xc5a04e : 0x9d8d7d);
    if (isGold) {
      circle(g, -43, 14, 5, 0xd3ad50); circle(g, -31, 19, 4, 0xe1c36c); circle(g, 41, 14, 5, 0xd3ad50);
    }
  }
  function drawPumpjack(g, x) {
    line(g, [[x, 18], [x, -25], [x - 18, 18], [x, -25], [x + 18, 18]], 0x465251, 5);
    line(g, [[x - 34, -28], [x + 34, -42]], 0x303e3e, 7);
    line(g, [[x - 34, -28], [x - 27, -18]], 0x303e3e, 4);
    line(g, [[x + 28, -41], [x + 35, -54]], 0x303e3e, 4);
    line(g, [[x + 35, -54], [x + 46, -50]], 0x303e3e, 3);
    circle(g, x, -24, 5, 0xb4a36f);
  }
  function drawOilField(g) {
    rect(g, -69, 8, 138, 15, 0x77766b);
    drawPumpjack(g, -34); drawPumpjack(g, 32);
    ellipse(g, 0, 4, 31, 19, 0x5a6663);
    rect(g, -7, -14, 14, 18, 0x9b9c8e);
  }
  function drawRefinery(g) {
    rect(g, -70, 2, 140, 22, 0x92948a);
    [[-47, -57, 18, 59], [-17, -72, 21, 74], [18, -48, 17, 50], [48, -65, 14, 67]].forEach(a => {
      rect(g, a[0], a[1], a[2], a[3], 0x9da59e);
      rect(g, a[0] - 3, a[1] - 4, a[2] + 6, 6, 0x6e7c7c);
      line(g, [[a[0] + a[2]/2, a[1] - 4], [a[0] + a[2]/2 + 4, a[1] - 16]], 0x7e7e73, 3);
    });
    [ -55, -6, 38 ].forEach(x => { ellipse(g, x, 4, 28, 17, 0xb3b0a2); rect(g, x-14, -2, 28, 9, 0xa5a699); });
    line(g, [[-65, -10], [-30, -22], [5, -10], [40, -21], [63, -8]], 0x4b777b, 4);
  }
  function drawSolar(g) {
    for (let r = 0; r < 3; r += 1) for (let c = 0; c < 4; c += 1) {
      const x = -58 + c * 31, y = -4 + r * 14;
      poly(g, [[x, y], [x + 25, y - 8], [x + 31, y + 1], [x + 6, y + 9]], 0x315c79);
      line(g, [[x + 6, y + 1], [x + 26, y - 5]], 0x9dc2d0, 1, 0.8);
    }
    line(g, [[-60, 42], [65, 42]], 0x6d6d61, 3);
  }
  function drawWind(g) {
    line(g, [[0, 26], [0, -63]], 0xe1e1d6, 7);
    circle(g, 0, -63, 6, 0x596c6d);
    [[0,-109],[-39,-40],[39,-40]].forEach(p => line(g, [[0,-63], p], 0xe7e6dc, 6));
    line(g, [[-12, -63], [12, -63]], 0x647779, 3);
    ellipse(g, 0, 28, 26, 10, 0x71866e, 0.22);
  }
  function drawPort(g) {
    rect(g, -73, 12, 146, 14, 0x6c8e98);
    rect(g, -60, -16, 58, 28, 0xb7b4a8);
    rect(g, 7, -10, 59, 22, 0x9e9e94);
    line(g, [[-41, -18], [-41, -78], [22, -78], [22, -18]], 0x4d6265, 5);
    line(g, [[-41, -64], [22, -64]], 0x4d6265, 4);
    line(g, [[10, -64], [10, -38], [32, -22]], 0x4d6265, 3);
    [ -48, -19, 13, 40 ].forEach((x, i) => rect(g, x, -25 - (i%2)*12, 22, 13, [0xb36c51,0x5e8191,0xb79a53,0x73856d][i]));
  }
  function drawAirport(g) {
    rect(g, -78, -4, 156, 26, 0x777e7b);
    line(g, [[-72, 9], [72, 9]], 0xe9e5d8, 2);
    rect(g, -38, -35, 76, 29, 0xbfc2b8);
    rect(g, -20, -45, 40, 10, 0x8d9693);
    line(g, [[0, -36], [0, -5]], 0x85b3bb, 5);
    line(g, [[-48, -47], [48, -47]], 0xbfc7c1, 3);
  }
  function drawGeneric(g, meta) {
    rect(g, -meta.width * 0.34, -31, meta.width * 0.68, 53, 0xd9d5c7);
    poly(g, [[-meta.width * 0.4, -31], [0, -56], [meta.width * 0.4, -31], [0, -13]], meta.color || COLORS.roof);
    rect(g, -8, -3, 16, 25, 0x765d46);
    rect(g, -meta.width * 0.24, -20, 14, 13, COLORS.glass);
    rect(g, meta.width * 0.12, -20, 14, 13, COLORS.glass);
  }

  function draw(g, type, meta) {
    if (type === "house" || type === "market" || type === "warehouse" || type === "town_hall" || type === "greenhouse") return drawHouse(g);
    if (type === "apartment") return drawApartment(g);
    if (["school", "hospital", "fire_station", "police_station"].includes(type)) return drawPublic(g, type);
    if (type === "factory" || type === "lumber_mill") return drawFactory(g);
    if (type === "water_treatment" || type === "sewage_plant") return drawWaterTreatment(g);
    if (type === "hydroelectric_dam") return drawHydro(g);
    if (type === "nuclear_plant") return drawNuclear(g);
    if (type === "gold_mine") return drawMine(g, true);
    if (type === "iron_mine") return drawMine(g, false);
    if (type === "oil_field") return drawOilField(g);
    if (type === "oil_refinery" || type === "thermal_plant") return drawRefinery(g);
    if (type === "solar_farm") return drawSolar(g);
    if (type === "wind_farm") return drawWind(g);
    if (type === "port") return drawPort(g);
    if (type === "airport" || type === "rail_station") return drawAirport(g);
    return drawGeneric(g, meta);
  }

  function mount(scene, options) {
    if (!scene || !scene.add || typeof scene.add.container !== "function" || typeof scene.add.graphics !== "function") {
      throw new TypeError("Informe uma cena Phaser 3 válida.");
    }
    const catalog = root && root.VilarejoWorldInfrastructureCatalog;
    const o = Object.assign({ parent: null, showLabels: true, onSelect: null }, options || {});
    const container = o.parent || scene.add.container(0, 0);
    const items = new Map();
    let nextId = 1;
    let destroyed = false;

    function add(data) {
      if (destroyed) throw new Error("O renderizador de estruturas foi destruído.");
      if (!data || !Number.isFinite(Number(data.x)) || !Number.isFinite(Number(data.y))) {
        throw new TypeError("A estrutura precisa de coordenadas x e y válidas.");
      }
      const type = String(data.type || "house");
      const meta = catalog && catalog.get(type) || { type, label: type, description: "Estrutura ilustrativa.", width: 112, height: 86, color: COLORS.roof };
      const id = String(data.id || "visual-structure-" + nextId++);
      if (items.has(id)) throw new Error("Já existe uma estrutura com este identificador: " + id);
      const object = scene.add.container(Number(data.x), Number(data.y));
      const g = scene.add.graphics();
      object.add(g);
      drawBase(g, meta);
      draw(g, type, meta);
      if (o.showLabels && scene.add.text) {
        const label = scene.add.text(0, Math.max(44, meta.height * 0.33), String(data.name || meta.label), {
          fontFamily: "Arial, sans-serif", fontSize: "11px", fontStyle: "bold",
          color: "#294735", backgroundColor: "#f4f1e5", padding: { x: 5, y: 3 }
        }).setOrigin(0.5, 0);
        object.add(label);
      }
      object.setDepth(Number(data.depth) || Number(data.y));
      if (typeof o.onSelect === "function") {
        if (!root.Phaser || !root.Phaser.Geom || !root.Phaser.Geom.Rectangle) {
          object.destroy(true);
          throw new Error("Carregue Phaser 3 antes de ativar seleção nas estruturas.");
        }
        object.setSize(meta.width || 112, meta.height || 86);
        object.setInteractive(new root.Phaser.Geom.Rectangle(-(meta.width || 112)/2, -(meta.height || 86)/2, meta.width || 112, meta.height || 86), root.Phaser.Geom.Rectangle.Contains);
        object.on("pointerdown", pointer => { if (pointer && pointer.event) pointer.event.stopPropagation(); o.onSelect(Object.assign({}, data, { id, type, label: meta.label })); });
      }
      container.add(object);
      items.set(id, { id, type, data: Object.assign({}, data, { id, type }), object, meta });
      return Object.freeze({ id, type, object });
    }

    function remove(id) {
      const item = items.get(String(id));
      if (!item) return false;
      item.object.destroy(true); items.delete(String(id)); return true;
    }
    function clear() { Array.from(items.keys()).forEach(remove); }
    function list() { return Array.from(items.values()).map(item => Object.assign({}, item.data)); }
    function get(id) { const item = items.get(String(id)); return item ? Object.assign({}, item.data) : null; }
    function destroy() { if (destroyed) return; destroyed = true; clear(); if (!o.parent) container.destroy(true); }

    return Object.freeze({ version: "1.0.0", container, add, remove, clear, list, get, destroy });
  }

  return Object.freeze({ version: "1.0.0", mount, colors: COLORS });
});
