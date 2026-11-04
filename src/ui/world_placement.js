/**
 * VILAREJO | PLACEMENT CONTROLLER
 * Pré-visualização e confirmação de posicionamento em grade isométrica.
 * Não escuta ponteiros automaticamente para não competir com a câmera existente.
 */
(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (root) root.VilarejoWorldPlacement = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  function mount(scene, options) {
    if (!scene || !scene.add || typeof scene.add.graphics !== "function") throw new TypeError("Informe uma cena Phaser válida.");
    const layout = root && root.VilarejoWorldLayout;
    if (!layout) throw new Error("Carregue world_layout.js antes de world_placement.js.");
    const o = Object.assign({ parent: null, tileWidth: 96, tileHeight: 48, origin: { x: 950, y: 120 }, bounds: { x: 0, y: 0, width: 1900, height: 1350 }, canPlace: null, onPlace: null }, options || {});
    const container = o.parent || scene.add.container(0, 0);
    const preview = scene.add.graphics();
    container.add(preview);
    let activeType = null;
    let current = null;
    let destroyed = false;

    function snapped(x, y) {
      const p = layout.snapToGrid(Number(x), Number(y), { tileWidth: o.tileWidth, tileHeight: o.tileHeight, origin: o.origin });
      return layout.clampPoint(p, o.bounds);
    }
    function setType(type) {
      if (destroyed) throw new Error("Controlador de posicionamento destruído.");
      activeType = type == null ? null : String(type);
      current = null;
      preview.clear();
      return activeType;
    }
    function drawPreview(point, valid) {
      preview.clear();
      const color = valid ? 0x74b987 : 0xc96a5b;
      preview.fillStyle(color, 0.18).fillPoints([
        { x: point.x, y: point.y - o.tileHeight / 2 },
        { x: point.x + o.tileWidth / 2, y: point.y },
        { x: point.x, y: point.y + o.tileHeight / 2 },
        { x: point.x - o.tileWidth / 2, y: point.y }
      ], true);
      preview.lineStyle(2, color, 0.95).beginPath()
        .moveTo(point.x, point.y - o.tileHeight / 2)
        .lineTo(point.x + o.tileWidth / 2, point.y)
        .lineTo(point.x, point.y + o.tileHeight / 2)
        .lineTo(point.x - o.tileWidth / 2, point.y)
        .closePath().strokePath();
    }
    function previewAt(x, y, meta) {
      if (destroyed) throw new Error("Controlador de posicionamento destruído.");
      if (!activeType) return null;
      const point = snapped(x, y);
      const valid = typeof o.canPlace !== "function" || o.canPlace({ type: activeType, x: point.x, y: point.y, meta: meta || null }) !== false;
      current = { type: activeType, x: point.x, y: point.y, valid };
      drawPreview(point, valid);
      return Object.freeze(Object.assign({}, current));
    }
    function confirm(meta) {
      if (!current || !activeType || !current.valid) return false;
      const payload = Object.freeze({ type: activeType, x: current.x, y: current.y, meta: meta || null });
      if (typeof o.onPlace === "function") o.onPlace(payload);
      current = null;
      preview.clear();
      return payload;
    }
    function cancel() {
      activeType = null; current = null; preview.clear();
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true; preview.destroy();
      if (!o.parent) container.destroy(true);
    }

    return Object.freeze({ version: "1.0.0", container, setType, previewAt, confirm, cancel, getCurrent: () => current ? Object.freeze(Object.assign({}, current)) : null, destroy });
  }

  return Object.freeze({ version: "1.0.0", mount });
});
