/**
 * VILAREJO | NATURE & VEGETATION
 * Vegetação e rochas decorativas com aleatoriedade reproduzível por seed.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (root) root.VilarejoWorldNature = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function randomFrom(seed) {
    const source = String(seed == null ? 42 : seed);
    let state = 2166136261 >>> 0;
    for (let i = 0; i < source.length; i += 1) {
      state = Math.imul(state ^ source.charCodeAt(i), 16777619) >>> 0;
    }
    if (state === 0) state = 73421;
    return function () {
      state = (state + 0x6D2B79F5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function mount(scene, options) {
    if (!scene || !scene.add || typeof scene.add.container !== "function") throw new TypeError("Informe uma cena Phaser válida.");
    const o = Object.assign({ parent: null, seed: 42, area: { x: 0, y: 0, width: 1700, height: 1150 }, count: 34, avoid: [] }, options || {});
    const container = o.parent || scene.add.container(0, 0);
    const rand = randomFrom(o.seed);
    const items = [];

    function isAvoided(x, y) {
      return (o.avoid || []).some(r => x >= r.x && y >= r.y && x <= r.x + r.width && y <= r.y + r.height);
    }

    function add(type, x, y, config) {
      const c = scene.add.container(x, y);
      const g = scene.add.graphics();
      c.add(g);
      const variant = Object.assign({}, config || {});
      if (type === "tree" || type === "pine" || type === "palm") {
        const scale = Math.max(0.55, Math.min(1.6, Number(variant.scale) || 1));
        g.fillStyle(0x79664a, 1).fillRect(-5 * scale, 3 * scale, 10 * scale, 28 * scale);
        if (type === "pine") {
          g.fillStyle(0x426c4d, 1);
          g.fillTriangle(0, -54 * scale, -26 * scale, 13 * scale, 26 * scale, 13 * scale);
          g.fillTriangle(0, -34 * scale, -31 * scale, 24 * scale, 31 * scale, 24 * scale);
        } else if (type === "palm") {
          g.lineStyle(5 * scale, 0x806b4b, 1).beginPath().moveTo(0, 16 * scale).lineTo(0, -34 * scale).strokePath();
          g.lineStyle(5 * scale, 0x4e8055, 1);
          [[-34,-45],[-20,-58],[0,-62],[22,-55],[37,-41]].forEach(p => { g.beginPath(); g.moveTo(0, -34 * scale); g.lineTo(p[0] * scale, p[1] * scale); g.strokePath(); });
        } else {
          g.fillStyle(0x4b7d53, 1).fillEllipse(0, -21 * scale, 54 * scale, 47 * scale);
          g.fillStyle(0x6a9966, 0.9).fillEllipse(-9 * scale, -29 * scale, 28 * scale, 23 * scale);
          g.fillStyle(0x83aa70, 0.8).fillEllipse(10 * scale, -18 * scale, 23 * scale, 18 * scale);
        }
      } else if (type === "rock") {
        g.fillStyle(0x888b81, 1).fillPoints([
          { x: -26, y: 9 }, { x: -17, y: -13 }, { x: 3, y: -22 }, { x: 24, y: -8 }, { x: 29, y: 9 }
        ], true);
        g.fillStyle(0xb4b5a7, 0.7).fillTriangle(-17, -7, 3, -22, 7, -4);
      } else if (type === "bush") {
        g.fillStyle(0x5d895b, 1).fillEllipse(-9, 0, 34, 25);
        g.fillStyle(0x77a36a, 1).fillEllipse(10, -4, 35, 27);
      }
      c.setDepth(y);
      container.add(c);
      items.push(c);
      return c;
    }

    const types = Array.isArray(o.types) && o.types.length ? o.types : ["tree", "tree", "pine", "bush", "rock"];
    const area = o.area || { x: 0, y: 0, width: 1700, height: 1150 };
    const count = Math.max(0, Math.min(500, Number(o.count) || 0));
    for (let i = 0; i < count; i += 1) {
      const x = area.x + rand() * area.width;
      const y = area.y + rand() * area.height;
      if (isAvoided(x, y)) continue;
      add(types[Math.floor(rand() * types.length)], x, y, { scale: 0.65 + rand() * 0.65 });
    }

    let destroyed = false;
    return Object.freeze({
      version: "1.0.0", container, items,
      add,
      clear() { items.splice(0).forEach(item => item.destroy(true)); },
      destroy() {
        if (destroyed) return; destroyed = true;
        items.splice(0).forEach(item => item.destroy(true));
        if (!o.parent) container.destroy(true);
      }
    });
  }

  return Object.freeze({ version: "1.0.0", mount });
});
