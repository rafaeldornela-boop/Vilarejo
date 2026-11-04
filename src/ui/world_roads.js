/**
 * VILAREJO | ROADS & CIVIL STRUCTURES
 * Estradas, pontes, viadutos e túneis puramente visuais.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (root) root.VilarejoWorldRoads = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function validPoints(points) {
    return Array.isArray(points) && points.length >= 2 && points.every(p =>
      p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y))
    );
  }

  function path(g, points) {
    g.beginPath();
    g.moveTo(Number(points[0].x), Number(points[0].y));
    points.slice(1).forEach(p => g.lineTo(Number(p.x), Number(p.y)));
  }

  function drawRoad(g, points, options) {
    if (!validPoints(points)) throw new TypeError("Uma estrada precisa de ao menos dois pontos válidos.");
    const o = Object.assign({ width: 34, color: 0xd8c7a2, shoulder: 0x9c927d, centerLine: true }, options || {});
    path(g, points);
    g.lineStyle(o.width + 8, o.shoulder, 0.95);
    g.strokePath();
    path(g, points);
    g.lineStyle(o.width, o.color, 1);
    g.strokePath();
    if (o.centerLine) {
      path(g, points);
      g.lineStyle(2, 0xf4ecd7, 0.72);
      g.strokePath();
    }
  }

  function drawBridge(scene, container, points, options) {
    const o = Object.assign({ width: 48, color: 0x8e8b80, railColor: 0xe0ded3, pillars: 3 }, options || {});
    const g = scene.add.graphics();
    container.add(g);
    drawRoad(g, points, { width: o.width, color: o.color, shoulder: 0x686d6b, centerLine: false });
    const first = points[0], last = points[points.length - 1];
    const dx = last.x - first.x, dy = last.y - first.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length, ny = dx / length;
    [-1, 1].forEach(side => {
      g.lineStyle(4, o.railColor, 0.96);
      g.beginPath();
      g.moveTo(first.x + nx * o.width * 0.43 * side, first.y + ny * o.width * 0.43 * side);
      g.lineTo(last.x + nx * o.width * 0.43 * side, last.y + ny * o.width * 0.43 * side);
      g.strokePath();
    });
    const count = Math.max(1, Math.min(8, Number(o.pillars) || 3));
    for (let i = 1; i <= count; i += 1) {
      const t = i / (count + 1);
      const x = first.x + dx * t;
      const y = first.y + dy * t;
      g.lineStyle(11, 0x777970, 1);
      g.beginPath();
      g.moveTo(x, y + 4);
      g.lineTo(x - 5, y + 85);
      g.moveTo(x, y + 4);
      g.lineTo(x + 5, y + 85);
      g.strokePath();
      g.lineStyle(2, 0xd2d0c5, 0.8);
      g.beginPath();
      g.moveTo(x - 12, y + 85);
      g.lineTo(x + 12, y + 85);
      g.strokePath();
    }
    return g;
  }

  function drawViaduct(scene, container, points, options) {
    const o = Object.assign({ width: 40, color: 0xaaa69b, pillars: 7, span: 105 }, options || {});
    const g = scene.add.graphics();
    container.add(g);
    const first = points[0], last = points[points.length - 1];
    drawRoad(g, points, { width: o.width, color: o.color, shoulder: 0x777b79, centerLine: true });
    const dx = last.x - first.x, dy = last.y - first.y;
    const count = Math.max(2, Math.min(14, Number(o.pillars) || 7));
    for (let i = 0; i <= count; i += 1) {
      const t = i / count;
      const x = first.x + dx * t;
      const y = first.y + dy * t;
      g.fillStyle(0x777e7c, 1).fillRect(x - 7, y + 5, 14, o.span);
      g.fillStyle(0x9da19a, 1).fillRect(x - 12, y + o.span - 8, 24, 9);
    }
    g.lineStyle(3, 0xe3dfd2, 0.9);
    g.beginPath();
    g.moveTo(first.x, first.y - 19);
    g.lineTo(last.x, last.y - 19);
    g.strokePath();
    return g;
  }

  function drawTunnel(scene, container, point, options) {
    const o = Object.assign({ width: 92, height: 66, color: 0x77766f }, options || {});
    const g = scene.add.graphics();
    container.add(g);
    g.fillStyle(0x64736d, 1).fillRect(point.x - o.width / 2, point.y - 18, o.width, 24);
    g.fillStyle(o.color, 1);
    g.fillEllipse(point.x, point.y - 18, o.width, o.height);
    g.fillStyle(0x27383b, 1);
    g.fillEllipse(point.x, point.y - 9, o.width * 0.66, o.height * 0.68);
    g.fillStyle(0xd6ccb5, 1).fillRect(point.x - o.width / 2 - 5, point.y - 4, 10, 26);
    g.fillStyle(0xd6ccb5, 1).fillRect(point.x + o.width / 2 - 5, point.y - 4, 10, 26);
    return g;
  }

  const PRESETS = Object.freeze({
    village: Object.freeze({
      roads: Object.freeze([
        { points: [{x:90,y:760},{x:120,y:715},{x:790,y:460},{x:835,y:485},{x:850,y:515},{x:810,y:535},{x:145,y:805}], options: { width: 34 } },
        { points: [{x:800,y:485},{x:845,y:455},{x:1510,y:740},{x:1470,y:780},{x:1430,y:790},{x:830,y:535}], options: { width: 34 } },
        { points: [{x:1020,y:160},{x:1060,y:140},{x:1160,y:440},{x:1125,y:465},{x:1090,y:450}], options: { width: 29 } },
        { points: [{x:420,y:930},{x:450,y:895},{x:950,y:1090},{x:920,y:1130},{x:880,y:1135}], options: { width: 31 } }
      ]),
      bridges: Object.freeze([
        { points: [{x:430,y:925},{x:500,y:952},{x:570,y:980}], options: { width: 42, pillars: 2 } }
      ])
    }),
    industrial: Object.freeze({
      roads: Object.freeze([
        { points: [{x:250,y:900},{x:620,y:820},{x:980,y:760},{x:1420,y:650}], options: { width: 48, color: 0xc9c4b6 } },
        { points: [{x:980,y:760},{x:1130,y:930},{x:1570,y:1080}], options: { width: 42, color: 0xc9c4b6 } }
      ]),
      viaducts: Object.freeze([
        { points: [{x:640,y:810},{x:980,y:760},{x:1330,y:700}], options: { width: 42, pillars: 6, span: 90 } }
      ])
    })
  });

  function mount(scene, options) {
    if (!scene || !scene.add || typeof scene.add.graphics !== "function") throw new TypeError("Informe uma cena Phaser válida.");
    const o = Object.assign({ parent: null, roads: [], bridges: [], viaducts: [], tunnels: [] }, options || {});
    const container = o.parent || scene.add.container(0, 0);
    const owned = [];
    const addRoad = (points, config) => {
      const g = scene.add.graphics(); container.add(g); drawRoad(g, points, config); owned.push(g); return g;
    };
    const addBridge = (points, config) => { const g = drawBridge(scene, container, points, config); owned.push(g); return g; };
    const addViaduct = (points, config) => { const g = drawViaduct(scene, container, points, config); owned.push(g); return g; };
    const addTunnel = (point, config) => { const g = drawTunnel(scene, container, point, config); owned.push(g); return g; };
    (o.roads || []).forEach(item => addRoad(item.points || item, item.options));
    (o.bridges || []).forEach(item => addBridge(item.points, item.options));
    (o.viaducts || []).forEach(item => addViaduct(item.points, item.options));
    (o.tunnels || []).forEach(item => addTunnel(item.point || item, item.options));
    let destroyed = false;
    return Object.freeze({
      version: "1.0.0", container, addRoad, addBridge, addViaduct, addTunnel,
      destroy() {
        if (destroyed) return; destroyed = true;
        owned.forEach(item => { if (item && item.destroy) item.destroy(); });
        if (!o.parent) container.destroy(true);
      }
    });
  }

  return Object.freeze({ version: "1.0.0", mount, drawRoad, drawBridge, drawViaduct, drawTunnel, presets: PRESETS });
});
