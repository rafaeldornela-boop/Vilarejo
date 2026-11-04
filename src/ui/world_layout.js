/**
 * VILAREJO | WORLD LAYOUT
 * Utilitários geométricos para mapa isométrico.
 * Independente do Core e da economia.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (root) root.VilarejoWorldLayout = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "1.0.0";
  const DEFAULTS = Object.freeze({ width: 2600, height: 1900, tileWidth: 96, tileHeight: 48 });

  function finite(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, finite(value, min)));
  }

  function gridToWorld(col, row, options) {
    const o = Object.assign({}, DEFAULTS, options || {});
    const origin = o.origin || { x: o.width / 2, y: 120 };
    const tw = finite(o.tileWidth, DEFAULTS.tileWidth);
    const th = finite(o.tileHeight, DEFAULTS.tileHeight);
    return {
      x: finite(origin.x, 0) + (finite(col, 0) - finite(row, 0)) * tw / 2,
      y: finite(origin.y, 0) + (finite(col, 0) + finite(row, 0)) * th / 2
    };
  }

  function worldToGrid(x, y, options) {
    const o = Object.assign({}, DEFAULTS, options || {});
    const origin = o.origin || { x: o.width / 2, y: 120 };
    const tw = finite(o.tileWidth, DEFAULTS.tileWidth);
    const th = finite(o.tileHeight, DEFAULTS.tileHeight);
    const dx = finite(x, 0) - finite(origin.x, 0);
    const dy = finite(y, 0) - finite(origin.y, 0);
    return {
      col: (dx / (tw / 2) + dy / (th / 2)) / 2,
      row: (dy / (th / 2) - dx / (tw / 2)) / 2
    };
  }

  function snapToGrid(x, y, options) {
    const cell = worldToGrid(x, y, options);
    return gridToWorld(Math.round(cell.col), Math.round(cell.row), options);
  }

  function clampPoint(point, bounds) {
    if (!point || !bounds) throw new TypeError("Informe ponto e limites.");
    return {
      x: clamp(point.x, finite(bounds.x, 0), finite(bounds.x, 0) + Math.max(0, finite(bounds.width, 0))),
      y: clamp(point.y, finite(bounds.y, 0), finite(bounds.y, 0) + Math.max(0, finite(bounds.height, 0)))
    };
  }

  function distance(a, b) {
    return Math.hypot(finite(a && a.x, 0) - finite(b && b.x, 0), finite(a && a.y, 0) - finite(b && b.y, 0));
  }

  function isInside(point, rect) {
    if (!point || !rect) return false;
    return point.x >= rect.x && point.y >= rect.y &&
      point.x <= rect.x + rect.width && point.y <= rect.y + rect.height;
  }

  function boundsOf(points) {
    if (!Array.isArray(points) || points.length === 0) return null;
    const xs = points.map(p => finite(p && p.x, NaN)).filter(Number.isFinite);
    const ys = points.map(p => finite(p && p.y, NaN)).filter(Number.isFinite);
    if (!xs.length || !ys.length) return null;
    const minX = Math.min.apply(null, xs);
    const minY = Math.min.apply(null, ys);
    const maxX = Math.max.apply(null, xs);
    const maxY = Math.max.apply(null, ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  return Object.freeze({
    version: VERSION,
    defaults: DEFAULTS,
    clamp,
    gridToWorld,
    worldToGrid,
    snapToGrid,
    clampPoint,
    distance,
    isInside,
    boundsOf
  });
});
