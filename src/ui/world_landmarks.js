/**
 * VILAREJO | WORLD LANDMARKS
 * Grandes equipamentos urbanos e marcos visuais exclusivos.
 * Não cria custos, capacidades, serviços ou efeitos econômicos.
 * Phaser 3 | UMD global: VilarejoWorldLandmarks
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (root) root.VilarejoWorldLandmarks = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "1.0.0";
  const CATALOG = Object.freeze([
    ["stadium", "Estádio", "Esporte e eventos"],
    ["shopping_mall", "Shopping center", "Comércio e lazer"],
    ["university", "Universidade", "Educação superior"],
    ["central_bank", "Banco central", "Instituição financeira"],
    ["research_center", "Centro de pesquisa", "Ciência e tecnologia"],
    ["amusement_park", "Parque de diversões", "Turismo e lazer"],
    ["museum", "Museu", "Cultura e patrimônio"],
    ["monument", "Monumento", "Marco urbano"],
    ["botanical_garden", "Jardim botânico", "Meio ambiente"],
    ["convention_center", "Centro de convenções", "Eventos e negócios"],
    ["observatory", "Observatório", "Ciência e turismo"],
    ["broadcast_tower", "Torre de comunicação", "Telecomunicações"],
    ["space_center", "Centro aeroespacial", "Pesquisa e tecnologia"]
  ].map(row => Object.freeze({ type: row[0], label: row[1], category: row[2], visualOnly: true })));
  const TYPES = Object.freeze(CATALOG.map(item => item.type));
  const LOOKUP = Object.freeze(CATALOG.reduce((map, item) => { map[item.type] = item; return map; }, Object.create(null)));

  function finite(value, fallback) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, finite(value, min))); }
  function poly(g, pts, color, alpha) {
    g.fillStyle(color, alpha === undefined ? 1 : alpha); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i += 1) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath(); g.fillPath();
  }
  function stroke(g, color, width, pts, alpha) {
    g.lineStyle(width || 1, color, alpha === undefined ? 1 : alpha); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i += 1) g.lineTo(pts[i][0], pts[i][1]);
    g.strokePath();
  }
  function box(g, x, y, w, h, color, roofColor, depthColor) {
    poly(g, [[x-w/2,y],[x,y-h*0.22],[x+w/2,y],[x,y+h*0.22]], roofColor, 1);
    poly(g, [[x-w/2,y],[x,y+h*0.22],[x,y+h*0.22+h],[x-w/2,y+h*0.78]], color, 1);
    poly(g, [[x,y+h*0.22],[x+w/2,y],[x+w/2,y+h*0.78],[x,y+h*0.22+h]], depthColor, 1);
  }
  function windows(g, x, y, cols, rows, sx, sy, color) {
    for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) {
      g.fillStyle(color, 0.92); g.fillRect(x + c * sx, y + r * sy, Math.max(2, sx * 0.48), Math.max(2, sy * 0.48));
    }
  }
  function base(g, width) {
    g.fillStyle(0x17242d, 0.19); g.fillEllipse(0, 13, width * 1.2, 29);
    poly(g, [[-width/2,1],[0,-12],[width/2,1],[0,15]], 0x99a69a, 1);
    poly(g, [[-width/2,1],[0,15],[0,20],[-width/2,7]], 0x6e7d79, 1);
    poly(g, [[0,15],[width/2,1],[width/2,7],[0,20]], 0x53676b, 1);
  }
  function drawLandmark(g, type) {
    switch (type) {
      case "stadium": {
        g.fillStyle(0x596f70, 1); g.fillEllipse(0, -18, 126, 47);
        g.fillStyle(0xc0c8b4, 1); g.fillEllipse(0, -22, 112, 40);
        g.fillStyle(0x4b8b69, 1); g.fillEllipse(0, -22, 76, 23);
        g.lineStyle(5, 0xd8ddd0, 1); g.strokeEllipse(0, -23, 120, 44);
        g.lineStyle(1, 0xe6e5d7, 0.75); g.strokeEllipse(0, -22, 81, 25);
        g.lineStyle(1, 0xe9e9d9, 0.8); g.lineBetween(-38,-22,38,-22); g.strokeCircle(0,-22,8);
        for (let i = 0; i < 5; i += 1) { g.fillStyle(0x8ea0a0, 1); g.fillRect(-48 + i*20, -1, 13, 12); }
        break;
      }
      case "shopping_mall": {
        box(g, 0, -7, 108, 50, 0x8b9da0, 0xbfc9c1, 0x627b85);
        box(g, -22, -33, 64, 25, 0x8daab0, 0xd6ded5, 0x58747f);
        g.fillStyle(0xd8b96d, 1); g.fillRoundedRect(-30, -46, 62, 7, 3);
        g.fillStyle(0x9dcbd0, 0.95); for (let i=0;i<5;i+=1) g.fillRect(-42+i*17, 5, 10, 15);
        g.fillStyle(0xd5d8cc, 1); g.fillRect(-7, -5, 15, 36);
        g.fillStyle(0x4d6671, 1); g.fillRect(-4, -2, 9, 30);
        break;
      }
      case "university": {
        box(g, 0, -8, 105, 37, 0xd4c7a8, 0xf0e5ca, 0x927f67);
        poly(g, [[-48,-18],[0,-48],[48,-18]], 0xb6a17a, 1);
        poly(g, [[-40,-20],[0,-43],[40,-20]], 0xe7d8b8, 1);
        for (let i=0;i<5;i+=1) { g.fillStyle(0xf2e7d0,1); g.fillRect(-35+i*17,-18,5,34); }
        g.fillStyle(0x8e795c,1); g.fillRect(-45,15,90,5);
        g.fillStyle(0x557f8a,1); g.fillRect(-7,-3,14,20);
        break;
      }
      case "central_bank": {
        box(g, 0, -5, 100, 35, 0xb7b6a7, 0xe0ddc9, 0x7e8989);
        poly(g, [[-48,-18],[0,-43],[48,-18]], 0x657d83, 1);
        poly(g, [[-42,-20],[0,-39],[42,-20]], 0xd5d4c4, 1);
        for (let i=0;i<6;i+=1) { g.fillStyle(0xe8e4d2,1); g.fillRect(-35+i*14,-17,5,34); }
        g.fillStyle(0x917b45,1); g.fillCircle(0,-31,6); g.fillStyle(0xf2d98c,1); g.fillCircle(0,-31,3);
        g.fillStyle(0x65757a,1); g.fillRect(-42,16,84,4);
        break;
      }
      case "research_center": {
        box(g, -19, -6, 66, 46, 0x6d929d, 0x9dc5cb, 0x466875);
        g.fillStyle(0x8ec9d2,0.9); g.fillCircle(20,-34,18); g.lineStyle(2,0xe1eeee,0.9); g.strokeCircle(20,-34,18);
        g.lineStyle(2,0xd6e7e6,1); g.lineBetween(20,-53,20,-65); g.lineBetween(1,-34,-10,-34); g.lineBetween(20,-16,20,-7);
        g.fillStyle(0xdce6e1,1); g.fillRect(-43,-2,22,35); g.fillStyle(0x5d808b,1); g.fillRect(-38,3,12,8);
        g.fillStyle(0xe1bd68,1); g.fillCircle(20,-34,4);
        break;
      }
      case "amusement_park": {
        g.fillStyle(0x789f83,1); g.fillEllipse(0,1,110,34);
        g.lineStyle(3,0xd7e3d6,1); g.strokeCircle(-18,-34,24); g.lineStyle(1,0xf0d28a,1);
        for(let i=0;i<8;i+=1){const a=i*Math.PI/4;g.lineBetween(-18,-34, -18+Math.cos(a)*23,-34+Math.sin(a)*23);g.fillStyle(i%2?0xc77a62:0x5d91a0,1);g.fillCircle(-18+Math.cos(a)*23,-34+Math.sin(a)*23,3);}
        g.fillStyle(0x668c9b,1); g.fillRoundedRect(20,-32,39,17,4); g.lineStyle(2,0xd7e3d6,1); g.lineBetween(20,-32,39,-48);g.lineBetween(39,-48,57,-32);
        g.fillStyle(0xd3aa5d,1);g.fillTriangle(23,-34,39,-53,55,-34); g.fillStyle(0xeee0bd,1);g.fillRect(30,-13,18,16);
        break;
      }
      case "museum": {
        poly(g,[[-54,-9],[0,-40],[54,-9],[43,-3],[-43,-3]],0xc6c3b4,1);
        poly(g,[[-48,-5],[0,-32],[48,-5]],0xe5dfca,1);
        g.fillStyle(0xb7b3a3,1);g.fillRect(-48,-5,96,32);
        for(let i=0;i<6;i+=1){g.fillStyle(0xe9e4d3,1);g.fillRect(-39+i*15,-3,5,28);}
        g.fillStyle(0x726e61,1);g.fillRect(-54,25,108,5);g.fillStyle(0x6e8b91,1);g.fillRect(-8,4,16,22);
        break;
      }
      case "monument": {
        poly(g,[[-30,5],[0,-5],[30,5],[0,15]],0x8b9695,1);poly(g,[[-18,-1],[0,-10],[18,-1],[0,7]],0xb9c0b7,1);
        poly(g,[[-10,-4],[0,-62],[10,-4]],0xb6c4c0,1);poly(g,[[-10,-4],[0,-62],[0,-4]],0x768d91,1);
        g.fillStyle(0xe6d59b,0.9);g.fillCircle(0,-55,4);g.lineStyle(2,0xd7c58d,0.8);g.lineBetween(0,-68,0,-76);
        break;
      }
      case "botanical_garden": {
        g.fillStyle(0x5f8f70,1);g.fillEllipse(0,4,112,29);
        g.fillStyle(0x9dc8bd,0.95);g.fillEllipse(-20,-18,51,39);g.fillEllipse(25,-18,51,39);
        g.lineStyle(2,0xe2eee2,0.9);g.strokeEllipse(-20,-18,51,39);g.strokeEllipse(25,-18,51,39);
        g.lineStyle(2,0x6c9992,1);g.lineBetween(-20,-37,-20,1);g.lineBetween(25,-37,25,1);g.lineBetween(-44,-18,4,-18);g.lineBetween(1,-18,49,-18);
        for(let i=0;i<7;i+=1){g.fillStyle(i%2?0x4f805f:0x78a67a,1);g.fillCircle(-43+i*14,8-(i%3)*3,6);}
        break;
      }
      case "convention_center": {
        box(g,0,-3,116,38,0x8c9da0,0xcbd4cb,0x5c737d);
        poly(g,[[-56,-13],[0,-35],[56,-13],[0,3]],0x6d8992,1);poly(g,[[-44,-13],[0,-29],[44,-13],[0,0]],0xc5d8d3,1);
        g.fillStyle(0x9ed0d3,0.95);g.fillRect(-41,6,81,15);g.lineStyle(1,0xe7eeee,0.8);g.lineBetween(-14,6,-14,21);g.lineBetween(13,6,13,21);
        break;
      }
      case "observatory": {
        g.fillStyle(0x899b9b,1);g.fillEllipse(0,3,78,24);g.fillStyle(0xb8c8c3,1);g.fillCircle(0,-23,27);
        g.fillStyle(0x607e88,1);g.fillCircle(0,-23,22);g.fillStyle(0xaec8c8,1);g.fillEllipse(0,-35,44,18);
        g.lineStyle(3,0xe4e8df,1);g.lineBetween(-23,-23,22,-45);g.fillStyle(0x263d4b,1);g.fillCircle(22,-45,4);
        g.fillStyle(0x586e76,1);g.fillRect(-30,-7,60,14);
        break;
      }
      case "broadcast_tower": {
        poly(g,[[-7,15],[0,-65],[7,15]],0x84969a,1);stroke(g,0xe4e9e4,2,[[-7,15],[0,-65],[7,15],[-7,15]],1);
        for(let i=0;i<5;i+=1){const y=-12-i*12;g.lineStyle(1.5,0xaec2c1,1);g.lineBetween(-12+i*1.2,y,12-i*1.2,y);}
        g.lineStyle(2,0xe8c87b,0.9);g.strokeCircle(0,-48,16);g.strokeCircle(0,-48,25);g.fillStyle(0xefc86e,1);g.fillCircle(0,-65,4);
        g.fillStyle(0x65797c,1);g.fillRect(-20,14,40,5);
        break;
      }
      case "space_center": {
        g.fillStyle(0x687e89,1);g.fillRect(-40,-4,80,33);g.fillStyle(0x9babb0,1);g.fillRect(-24,-47,48,44);
        g.fillStyle(0xe5e8e0,1);g.fillRoundedRect(-7,-76,14,47,6);g.fillTriangle(-7,-76,0,-88,7,-76);
        g.fillStyle(0xd4775d,1);g.fillRect(-7,-47,14,16);g.fillStyle(0x8ec5d0,1);g.fillCircle(0,-60,3);
        g.lineStyle(3,0xbfcac4,1);g.lineBetween(-24,-43,-38,-3);g.lineBetween(24,-43,38,-3);g.lineBetween(-38,-3,-38,27);g.lineBetween(38,-3,38,27);
        g.fillStyle(0xd2b36e,1);g.fillRect(-48,27,96,5);
        break;
      }
      default: throw new RangeError("Marco urbano desconhecido: " + type);
    }
  }

  function mount(scene, options) {
    if (!scene || !scene.add || typeof scene.add.container !== "function") throw new TypeError("Informe uma cena Phaser válida.");
    const o = Object.assign({ parent: null, landmarks: [], showLabels: true, depth: 42 }, options || {});
    const parent = o.parent || scene.add.container(0, 0);
    const ownedParent = !o.parent;
    if (!parent || typeof parent.add !== "function") throw new TypeError("O parent precisa ser um Container Phaser.");
    const items = new Map();
    let destroyed = false;

    function add(data) {
      if (destroyed) throw new Error("A camada de marcos urbanos foi destruída.");
      if (!data || typeof data !== "object") throw new TypeError("Informe os dados do marco urbano.");
      const type = String(data.type || "");
      if (!LOOKUP[type]) throw new RangeError("Tipo de marco não catalogado: " + type);
      const id = String(data.id || type + "-" + (items.size + 1));
      if (items.has(id)) throw new Error("Já existe um marco com o id " + id + ".");
      const x = finite(data.x, NaN), y = finite(data.y, NaN);
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError("O marco precisa de coordenadas x e y.");
      const object = scene.add.container(x, y);
      const graphic = scene.add.graphics();
      const scale = clamp(data.scale === undefined ? 1 : data.scale, 0.45, 2.5);
      const width = finite(data.baseWidth, 118) * scale;
      base(graphic, width);
      drawLandmark(graphic, type);
      object.add(graphic);
      if (o.showLabels && data.showLabel !== false) {
        const label = String(data.name || LOOKUP[type].label);
        const text = scene.add.text(0, 30 * scale, label, {
          fontFamily: "Arial, sans-serif", fontSize: Math.round(12 * scale) + "px",
          color: "#f4f0df", stroke: "#25343b", strokeThickness: 3,
          align: "center", shadow: { color: "#17242d", blur: 4, fill: true, offsetY: 2 }
        }).setOrigin(0.5, 0);
        object.add(text);
      }
      object.setScale(scale).setDepth(finite(o.depth, 42) + y * 0.001);
      parent.add(object);
      const record = Object.freeze({ id, type, name: String(data.name || LOOKUP[type].label), x, y, object });
      items.set(id, record);
      return record;
    }
    function remove(id) { const item = items.get(String(id)); if (!item) return false; item.object.destroy(true); items.delete(String(id)); return true; }
    function clear() { Array.from(items.keys()).forEach(remove); }
    function get(id) { return items.get(String(id)) || null; }
    function list() { return Array.from(items.values()).map(item => Object.freeze({ id: item.id, type: item.type, name: item.name, x: item.x, y: item.y })); }
    function destroy() {
      if (destroyed) return; destroyed = true;
      scene.events && scene.events.off && scene.events.off("shutdown", destroy);
      clear(); if (ownedParent) parent.destroy(true);
    }
    scene.events && scene.events.once && scene.events.once("shutdown", destroy);
    try { (Array.isArray(o.landmarks) ? o.landmarks : []).forEach(add); }
    catch (error) { destroy(); throw error; }
    return Object.freeze({ version: VERSION, container: parent, catalog: CATALOG, add, remove, clear, get, list, destroy });
  }

  return Object.freeze({ version: VERSION, catalog: CATALOG, types: TYPES, mount });
});
