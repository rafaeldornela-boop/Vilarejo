/**
 * VILAREJO | TERRAIN LAYER
 * Camada ilustrativa de solo, água, campos e relevo suave.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (root) root.VilarejoWorldTerrain = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function hashSeed(seed) {
    let h = 2160136261 >>> 0;
    const s = String(seed == null ? "vilarejo" : seed);
    for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
    return function () {
      h += 0x6D2B79F5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function polygon(g, points, color, alpha) {
    if (!points || points.length < 3) return;
    g.fillStyle(color, alpha == null ? 1 : alpha);
    g.beginPath();
    g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) g.lineTo(points[i][0], points[i][1]);
    g.closePath();
    g.fillPath();
  }

  function mount(scene, options) {
    if (!scene || !scene.add || typeof scene.add.graphics !== "function") {
      throw new TypeError("Informe uma cena Phaser válida.");
    }
    const o = Object.assign({ width: 1900, height: 1350, seed: "vilarejo", parent: null, baseColor: 0xb7cda9, tileSize: 86 }, options || {});
    const container = o.parent || scene.add.container(0, 0);
    const g = scene.add.graphics();
    container.add(g);
    const rand = hashSeed(o.seed);
    const w = Math.max(300, Number(o.width) || 1900);
    const h = Math.max(300, Number(o.height) || 1350);

    g.fillStyle(o.baseColor, 1).fillRect(0, 0, w, h);

    const colors = [0xc6d8b7, 0xa9c49b, 0xbdd0a9, 0xaec99f, 0xd0d9b8];
    const stepX = Math.max(38, Number(o.tileSize) || 86);
    const stepY = stepX * 0.68;
    for (let y = 0, r = 0; y < h; y += stepY, r += 1) {
      for (let x = 0, c = 0; x < w; x += stepX, c += 1) {
        if (rand() > 0.48) {
          const cx = x + (r % 2) * stepX / 2;
          const cy = y;
          polygon(g, [[cx, cy - 18], [cx + 34, cy], [cx, cy + 18], [cx - 34, cy]], colors[Math.floor(rand() * colors.length)], 0.26);
        }
      }
    }

    // Áreas de relevo e manchas de vegetação, sem bloquear construções.
    for (let i = 0; i < 17; i += 1) {
      const x = 100 + rand() * (w - 200);
      const y = 100 + rand() * (h - 200);
      const rx = 46 + rand() * 75;
      const ry = 20 + rand() * 35;
      polygon(g, [[x, y - ry], [x + rx, y], [x, y + ry], [x - rx, y]], 0x789b70, 0.11);
    }

    // Pequenos cursos d'água decorativos configuráveis.
    const waters = Array.isArray(o.waterBodies) ? o.waterBodies : [
      [[70, 240], [170, 190], [320, 230], [370, 295], [285, 340], [145, 315]],
      [[0, h * 0.76], [0, h * 0.81], [w * 0.27, h * 0.68], [w * 0.31, h * 0.71], [w * 0.08, h * 0.85]]
    ];
    waters.forEach(points => polygon(g, points, 0x83b8c0, 0.84));

    // Margens leves destacam a água sem parecerem contornos de interface.
    waters.forEach(points => {
      if (!Array.isArray(points) || points.length < 2) return;
      g.lineStyle(3, 0xd1d2b0, 0.55);
      g.beginPath();
      g.moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach(p => g.lineTo(p[0], p[1]));
      g.strokePath();
    });

    let destroyed = false;
    return Object.freeze({
      version: "1.0.0",
      container,
      graphics: g,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        g.destroy();
        if (!o.parent) container.destroy(true);
      }
    });
  }

  return Object.freeze({ version: "1.0.0", mount });
});
