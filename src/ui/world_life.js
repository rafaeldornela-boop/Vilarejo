/**
 * VILAREJO | WORLD LIFE
 * Vida urbana visual: veículos, pedestres, bicicletas, trens, barcos e aviões.
 * As rotas e posições devem vir do mapa/snapshot. Este módulo não simula economia.
 * Phaser 3 | UMD global: VilarejoWorldLife
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (root) root.VilarejoWorldLife = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "1.0.0";
  const DEFAULT_SPEEDS = Object.freeze({ car: 62, taxi: 66, bus: 42, truck: 38, bicycle: 34, pedestrian: 18, train: 78, boat: 28, plane: 120 });
  const DEFAULT_COUNTS = Object.freeze({ car: 3, taxi: 1, bus: 1, truck: 1, bicycle: 1, pedestrian: 3, train: 1, boat: 1, plane: 1 });
  const ALLOWED = Object.freeze(Object.keys(DEFAULT_SPEEDS));

  function finite(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, finite(value, min))); }
  function point(value) {
    if (!value || !Number.isFinite(Number(value.x)) || !Number.isFinite(Number(value.y))) return null;
    return { x: Number(value.x), y: Number(value.y) };
  }
  function polygon(graphics, points, color, alpha) {
    if (!points || points.length < 3) return;
    graphics.fillStyle(color, alpha === undefined ? 1 : alpha);
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) graphics.lineTo(points[i].x, points[i].y);
    graphics.closePath();
    graphics.fillPath();
  }
  function line(graphics, color, alpha, width, x1, y1, x2, y2) {
    graphics.lineStyle(width || 1, color, alpha === undefined ? 1 : alpha);
    graphics.lineBetween(x1, y1, x2, y2);
  }
  function hashSeed(value) {
    const text = String(value === undefined ? "vilarejo-life" : value);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
  }
  function randomFactory(seed) {
    let state = hashSeed(seed) || 1;
    return function () { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  }
  function normalizeRoute(input, index) {
    if (!input || typeof input !== "object") throw new TypeError("Cada rota precisa ser um objeto.");
    const points = (Array.isArray(input.points) ? input.points : []).map(point).filter(Boolean);
    if (points.length < 2) throw new TypeError("Cada rota precisa de pelo menos dois pontos válidos.");
    const type = String(input.type || "car");
    const types = Array.isArray(input.types) ? input.types.map(String) : [type];
    if (!types.length || types.some(t => !ALLOWED.includes(t))) throw new RangeError("Tipo de entidade inválido na rota.");
    const countRaw = input.count === undefined ? DEFAULT_COUNTS[types[0]] : Math.floor(finite(input.count, 1));
    return {
      id: String(input.id || "life-route-" + (index + 1)),
      type: types[0], types,
      points,
      count: clamp(countRaw, 0, 40),
      speed: clamp(input.speed === undefined ? DEFAULT_SPEEDS[types[0]] : input.speed, 1, 260),
      closed: input.closed !== false,
      scale: clamp(input.scale === undefined ? 1 : input.scale, 0.35, 2.5),
      colors: Array.isArray(input.colors) ? input.colors.slice(0, 8) : null,
      depth: finite(input.depth, 20)
    };
  }
  function measurePath(route) {
    const points = route.points.slice();
    if (route.closed && points.length >= 2) points.push(points[0]);
    const segments = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i], b = points[i + 1];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length > 0.001) { segments.push({ a, b, length, start: total }); total += length; }
    }
    return { segments, total };
  }
  function samplePath(path, distance, reverse) {
    const d = clamp(distance, 0, path.total);
    let segment = path.segments[path.segments.length - 1];
    for (let i = 0; i < path.segments.length; i += 1) {
      const candidate = path.segments[i];
      if (d <= candidate.start + candidate.length) { segment = candidate; break; }
    }
    const ratio = clamp((d - segment.start) / segment.length, 0, 1);
    const x = segment.a.x + (segment.b.x - segment.a.x) * ratio;
    const y = segment.a.y + (segment.b.y - segment.a.y) * ratio;
    let angle = Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x);
    if (reverse) angle += Math.PI;
    return { x, y, angle };
  }
  function drawVehicle(graphics, type, color) {
    graphics.fillStyle(0x17232c, 0.22); graphics.fillEllipse(0, 7, type === "bus" || type === "truck" ? 45 : 31, 12);
    if (type === "pedestrian") {
      line(graphics, 0x263744, 0.9, 2, -1, 1, -3, 7); line(graphics, 0x263744, 0.9, 2, 1, 1, 4, 7);
      graphics.fillStyle(0x304c60, 1); graphics.fillEllipse(0, -1, 7, 11);
      graphics.fillStyle(0xe8bd91, 1); graphics.fillCircle(0, -9, 3.6);
      graphics.fillStyle(0x263744, 1); graphics.fillEllipse(-1, -13, 6, 3);
      return;
    }
    if (type === "bicycle") {
      graphics.lineStyle(1.7, 0x263744, 1); graphics.strokeCircle(-7, 4, 5); graphics.strokeCircle(8, 4, 5);
      line(graphics, 0x497f88, 1, 2, -7, 4, -2, -2); line(graphics, 0x497f88, 1, 2, -2, -2, 8, 4);
      line(graphics, 0x497f88, 1, 2, -2, -2, -7, 4); line(graphics, 0x497f88, 1, 2, -2, -2, 1, 4);
      graphics.fillStyle(0xe5b98b, 1); graphics.fillCircle(-2, -7, 2.5);
      return;
    }
    if (type === "boat") {
      polygon(graphics, [{x:-22,y:-2},{x:19,y:-2},{x:12,y:8},{x:-14,y:8}], 0x344c5b, 1);
      polygon(graphics, [{x:-13,y:-6},{x:12,y:-6},{x:8,y:-2},{x:-10,y:-2}], color, 1);
      graphics.fillStyle(0xe7e8df, 1); graphics.fillRect(-5, -13, 11, 7);
      graphics.fillStyle(0x8cc4d0, 0.9); graphics.fillRect(-3, -12, 4, 4);
      line(graphics, 0x9ed4dc, 0.7, 2, -23, 11, -10, 11); line(graphics, 0x9ed4dc, 0.7, 2, 11, 12, 23, 12);
      return;
    }
    if (type === "plane") {
      polygon(graphics, [{x:-22,y:-3},{x:-4,y:-5},{x:2,y:-16},{x:7,y:-16},{x:5,y:-5},{x:19,y:-3},{x:22,y:0},{x:5,y:2},{x:7,y:12},{x:3,y:12},{x:-3,y:2},{x:-22,y:1}], 0xe7e9e5, 1);
      polygon(graphics, [{x:-4,y:-3},{x:5,y:-3},{x:4,y:1},{x:-4,y:1}], color, 1);
      line(graphics, 0x6b8794, 1, 1, -13, -2, 13, -2);
      return;
    }
    if (type === "train") {
      graphics.fillStyle(color, 1); graphics.fillRoundedRect(-23, -10, 46, 18, 5);
      graphics.fillStyle(0xd8e4e5, 1); graphics.fillRoundedRect(-15, -8, 9, 6, 2); graphics.fillRoundedRect(-3, -8, 9, 6, 2); graphics.fillRoundedRect(9, -8, 8, 6, 2);
      graphics.fillStyle(0x354754, 1); graphics.fillRect(-19, 5, 38, 3);
      graphics.fillStyle(0x202d37, 1); graphics.fillCircle(-13, 9, 3); graphics.fillCircle(13, 9, 3);
      graphics.fillStyle(0xf3d28a, 1); graphics.fillCircle(21, -2, 2);
      return;
    }
    const isHeavy = type === "truck" || type === "bus";
    if (type === "truck") {
      graphics.fillStyle(0x66727a, 1); graphics.fillRoundedRect(-22, -8, 27, 14, 2);
      polygon(graphics, [{x:6,y:-7},{x:16,y:-7},{x:21,y:-1},{x:21,y:6},{x:6,y:6}], color, 1);
      graphics.fillStyle(0xa9c7ce, 1); graphics.fillRect(11, -6, 6, 4);
    } else if (type === "bus") {
      graphics.fillStyle(color, 1); graphics.fillRoundedRect(-23, -9, 46, 17, 5);
      graphics.fillStyle(0xa9cbd0, 1); for (let i = 0; i < 5; i += 1) graphics.fillRoundedRect(-17 + i * 7, -7, 5, 6, 1);
    } else {
      graphics.fillStyle(color, 1);
      polygon(graphics, [{x:-19,y:0},{x:-12,y:-7},{x:9,y:-7},{x:18,y:-1},{x:20,y:5},{x:-18,y:6}], color, 1);
      polygon(graphics, [{x:-8,y:-7},{x:-3,y:-13},{x:7,y:-13},{x:12,y:-6}], 0x3e6473, 1);
      graphics.fillStyle(0x9bc4cb, 1); graphics.fillTriangle(-5, -7, -1, -12, 4, -7);
      if (type === "taxi") { graphics.fillStyle(0xf1d36f, 1); graphics.fillRect(-2, -16, 7, 3); }
    }
    graphics.fillStyle(0x26313a, 1);
    graphics.fillCircle(-12, 6, isHeavy ? 3.2 : 3); graphics.fillCircle(13, 6, isHeavy ? 3.2 : 3);
    graphics.fillStyle(0xf2e0a7, 1); graphics.fillCircle(18, 1, 1.4);
    graphics.fillStyle(0xc76e5e, 1); graphics.fillCircle(-18, 2, 1.3);
  }

  function mount(scene, options) {
    if (!scene || !scene.add || typeof scene.add.container !== "function" || !scene.events || typeof scene.events.on !== "function") {
      throw new TypeError("Informe uma cena Phaser válida com eventos de atualização.");
    }
    const o = Object.assign({ parent: null, routes: [], seed: "vilarejo-life", speedMultiplier: 1, enabled: true, depth: 30 }, options || {});
    const parent = o.parent || scene.add.container(0, 0);
    const ownedParent = !o.parent;
    if (!parent || typeof parent.add !== "function") throw new TypeError("O parent precisa ser um Container Phaser.");
    const layer = scene.add.container(0, 0);
    parent.add(layer);
    const random = randomFactory(o.seed);
    const routes = new Map();
    const entities = new Map();
    let nextEntityId = 1;
    let speedMultiplier = clamp(o.speedMultiplier, 0, 5);
    let enabled = o.enabled !== false;
    let destroyed = false;

    function createEntity(route, routePath, index, type) {
      const id = "life-" + nextEntityId++;
      const colors = route.colors || [0x56879a, 0xc17c55, 0x758d70, 0xd1ad58, 0x74839a, 0xb7b9b2];
      const chosen = colors[Math.floor(random() * colors.length)];
      const object = scene.add.container(0, 0);
      const graphic = scene.add.graphics();
      drawVehicle(graphic, type, chosen);
      object.add(graphic);
      layer.add(object);
      const initial = routePath.total * ((index + random() * 0.45) / Math.max(1, route.count));
      const state = {
        id, routeId: route.id, type, object, path: routePath, distance: initial,
        direction: 1, speed: route.speed * (0.78 + random() * 0.42) * (type === "pedestrian" ? 0.45 : 1),
        scale: route.scale * (type === "pedestrian" ? 0.56 : type === "plane" ? 0.9 : 1), depth: route.depth, closed: route.closed
      };
      object.setScale(state.scale);
      entities.set(id, state);
      const initialPoint = samplePath(routePath, initial, false);
      object.setPosition(initialPoint.x, initialPoint.y);
      object.setRotation(initialPoint.angle);
      object.setDepth(finite(o.depth, 30) + route.depth + initialPoint.y * 0.001);
      return state;
    }
    function clearRouteEntities(routeId) {
      entities.forEach((entity, id) => {
        if (entity.routeId === routeId) { entity.object.destroy(true); entities.delete(id); }
      });
    }
    function addRoute(input) {
      if (destroyed) throw new Error("O módulo de vida urbana foi destruído.");
      const route = normalizeRoute(input, routes.size);
      if (routes.has(route.id)) throw new Error("Já existe uma rota com o id " + route.id + ".");
      const path = measurePath(route);
      if (path.total <= 0) throw new TypeError("A rota não possui comprimento válido.");
      routes.set(route.id, { config: route, path });
      for (let i = 0; i < route.count; i += 1) createEntity(route, path, i, route.types[i % route.types.length]);
      return Object.freeze({ id: route.id, count: route.count, types: route.types.slice() });
    }
    function removeRoute(id) {
      if (!routes.has(String(id))) return false;
      clearRouteEntities(String(id)); routes.delete(String(id)); return true;
    }
    function setRoutes(list) {
      if (!Array.isArray(list)) throw new TypeError("routes precisa ser uma lista.");
      Array.from(routes.keys()).forEach(removeRoute);
      list.forEach(addRoute);
      return getStats();
    }
    function update(_time, delta) {
      if (destroyed || !enabled || speedMultiplier <= 0) return;
      const dt = clamp(delta, 0, 80) / 1000;
      entities.forEach(entity => {
        const length = entity.path.total;
        let reverse = false;
        let sampleDistance;
        if (entity.closed) {
          entity.distance = (entity.distance + entity.speed * speedMultiplier * dt) % length;
          sampleDistance = entity.distance;
        } else {
          const span = length * 2;
          entity.distance = (entity.distance + entity.speed * speedMultiplier * dt) % span;
          reverse = entity.distance > length;
          sampleDistance = reverse ? span - entity.distance : entity.distance;
        }
        const p = samplePath(entity.path, sampleDistance, reverse);
        entity.object.setPosition(p.x, p.y);
        entity.object.setRotation(p.angle);
        entity.object.setDepth(finite(o.depth, 30) + entity.depth + p.y * 0.001);
      });
    }
    function setEnabled(value) { enabled = Boolean(value); layer.setVisible(enabled); return enabled; }
    function setSpeedMultiplier(value) { speedMultiplier = clamp(value, 0, 5); return speedMultiplier; }
    function getStats() {
      const byType = Object.create(null);
      entities.forEach(entity => { byType[entity.type] = (byType[entity.type] || 0) + 1; });
      return Object.freeze({ routes: routes.size, entities: entities.size, byType: Object.freeze(byType), enabled, speedMultiplier });
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      scene.events.off && scene.events.off("update", update);
      scene.events.off && scene.events.off("shutdown", destroy);
      entities.forEach(entity => entity.object.destroy(true)); entities.clear(); routes.clear();
      layer.destroy(true);
      if (ownedParent) parent.destroy(true);
    }
    scene.events.on("update", update);
    scene.events.once && scene.events.once("shutdown", destroy);
    try { (Array.isArray(o.routes) ? o.routes : []).forEach(addRoute); }
    catch (error) { destroy(); throw error; }

    return Object.freeze({
      version: VERSION, container: layer, addRoute, removeRoute, setRoutes,
      setEnabled, setSpeedMultiplier, getStats, destroy
    });
  }

  const presets = Object.freeze({
    demo: Object.freeze([
      Object.freeze({ id: "demo-avenue", type: "car", count: 5, speed: 56, closed: true, points: Object.freeze([{x:300,y:520},{x:640,y:455},{x:890,y:565},{x:560,y:650}]) }),
      Object.freeze({ id: "demo-service-road", types: Object.freeze(["bus","truck"]), count: 2, speed: 36, closed: true, points: Object.freeze([{x:420,y:740},{x:680,y:690},{x:800,y:790},{x:540,y:840}]) }),
      Object.freeze({ id: "demo-pedestrians", type: "pedestrian", count: 5, speed: 17, closed: true, points: Object.freeze([{x:500,y:545},{x:620,y:515},{x:700,y:565},{x:580,y:595}]) })
    ])
  });

  return Object.freeze({ version: VERSION, types: ALLOWED, presets, defaults: DEFAULT_SPEEDS, mount });
});
