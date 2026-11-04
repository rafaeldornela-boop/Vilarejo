/**
 * VILAREJO | WORLD ATMOSPHERE
 * Camada visual independente para período do dia e condições climáticas.
 * Não controla relógio, clima econômico, produção ou qualquer estado do Core.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (root) root.VilarejoWorldAtmosphere = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TIME = Object.freeze({
    morning: { color: 0xffd8a3, alpha: 0.08 },
    day: { color: 0xffffff, alpha: 0 },
    evening: { color: 0xf2a66a, alpha: 0.17 },
    night: { color: 0x1e3552, alpha: 0.42 }
  });
  const WEATHER = Object.freeze({
    clear: { color: 0xffffff, alpha: 0 },
    cloudy: { color: 0x657788, alpha: 0.10 },
    rain: { color: 0x52677b, alpha: 0.18 },
    fog: { color: 0xe1e9e2, alpha: 0.24 }
  });

  function mount(scene, options) {
    if (!scene || !scene.add || !scene.tweens || !scene.scale) throw new TypeError("Informe uma cena Phaser 3 ativa.");
    const o = Object.assign({ timeOfDay: "day", weather: "clear", transitionMs: 650, rainDrops: 38 }, options || {});
    if (scene.__vilarejoAtmosphere) throw new Error("A atmosfera já está montada nesta cena.");
    const width = Math.max(1, Number(scene.scale.width) || 1280);
    const height = Math.max(1, Number(scene.scale.height) || 760);
    const timeLayer = scene.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 0).setScrollFactor(0).setDepth(900);
    const weatherLayer = scene.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 0).setScrollFactor(0).setDepth(910);
    const rainLayer = scene.add.container(0, 0).setScrollFactor(0).setDepth(920).setVisible(false);
    let rainMade = false, destroyed = false;
    let state = { timeOfDay: "day", weather: "clear" };
    const rainTweens = [];

    function fade(target, alpha, duration) {
      scene.tweens.killTweensOf(target);
      if (duration <= 0) target.setAlpha(alpha);
      else scene.tweens.add({ targets: target, alpha, duration, ease: "Sine.easeInOut" });
    }
    function createRain() {
      if (rainMade) return;
      rainMade = true;
      const count = Math.max(8, Math.min(90, Number(o.rainDrops) || 38));
      for (let i = 0; i < count; i += 1) {
        const drop = scene.add.rectangle(Math.random() * width, Math.random() * height, 1.5, 14, 0xdce8ef, 0.48).setRotation(-0.16);
        rainLayer.add(drop);
        rainTweens.push(scene.tweens.add({
          targets: drop, y: height + 24, alpha: 0.08,
          duration: 850 + Math.random() * 650, delay: Math.random() * 1200, repeat: -1,
          onRepeat: () => { if (!destroyed && drop.active) { drop.x = Math.random() * width; drop.y = -20 - Math.random() * 110; drop.alpha = 0.48; } }
        }));
      }
    }
    function setConditions(patch) {
      if (destroyed) throw new Error("A camada de atmosfera foi destruída.");
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new TypeError("Informe um objeto de condições.");
      const next = Object.assign({}, state);
      if (patch.timeOfDay !== undefined) {
        if (!Object.prototype.hasOwnProperty.call(TIME, patch.timeOfDay)) throw new RangeError("timeOfDay inválido.");
        next.timeOfDay = patch.timeOfDay;
      }
      if (patch.weather !== undefined) {
        if (!Object.prototype.hasOwnProperty.call(WEATHER, patch.weather)) throw new RangeError("weather inválido.");
        next.weather = patch.weather;
      }
      const d = patch.transitionMs === undefined ? Number(o.transitionMs) : Number(patch.transitionMs);
      const duration = Number.isFinite(d) ? Math.max(0, Math.min(5000, d)) : 650;
      state = next;
      timeLayer.setFillStyle(TIME[state.timeOfDay].color, 1);
      weatherLayer.setFillStyle(WEATHER[state.weather].color, 1);
      fade(timeLayer, TIME[state.timeOfDay].alpha, duration);
      fade(weatherLayer, WEATHER[state.weather].alpha, duration);
      if (state.weather === "rain") createRain();
      rainLayer.setVisible(state.weather === "rain");
      return getConditions();
    }
    function getConditions() { return Object.freeze({ timeOfDay: state.timeOfDay, weather: state.weather }); }
    function resize(size) {
      if (destroyed) return;
      const w = Math.max(1, Number(size && size.width) || Number(scene.scale.width) || width);
      const h = Math.max(1, Number(size && size.height) || Number(scene.scale.height) || height);
      timeLayer.setPosition(w / 2, h / 2).setSize(w, h);
      weatherLayer.setPosition(w / 2, h / 2).setSize(w, h);
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (scene.scale.off) scene.scale.off("resize", resize);
      if (scene.events && scene.events.off) scene.events.off("shutdown", destroy);
      scene.tweens.killTweensOf(timeLayer); scene.tweens.killTweensOf(weatherLayer);
      rainTweens.forEach(t => { if (t && t.remove) t.remove(); });
      rainLayer.destroy(true); timeLayer.destroy(); weatherLayer.destroy();
      if (scene.__vilarejoAtmosphere === handle) delete scene.__vilarejoAtmosphere;
    }
    const handle = Object.freeze({ version: "1.0.0", setConditions, getConditions, destroy });
    scene.__vilarejoAtmosphere = handle;
    if (scene.scale.on) scene.scale.on("resize", resize);
    if (scene.events && scene.events.once) scene.events.once("shutdown", destroy);
    setConditions({ timeOfDay: o.timeOfDay, weather: o.weather, transitionMs: 0 });
    return handle;
  }

  return Object.freeze({ version: "1.0.0", timePresets: TIME, weatherPresets: WEATHER, mount });
});
