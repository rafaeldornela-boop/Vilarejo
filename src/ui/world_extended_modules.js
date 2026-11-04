/**
 * VILAREJO | EXTENDED VISUAL MODULES
 * Compositor opcional para os quatro módulos de expansão visual.
 * Carregue após world_life.js, world_landmarks.js,
 * world_city_evolution.js e world_economy_overlay.js.
 * Phaser 3 | UMD global: VilarejoWorldExtendedModules
 */
(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (root) root.VilarejoWorldExtendedModules = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const VERSION = "1.0.0";
  const REQUIRED = Object.freeze([
    "VilarejoWorldLife", "VilarejoWorldLandmarks",
    "VilarejoWorldCityEvolution", "VilarejoWorldEconomyOverlay"
  ]);

  function mount(scene, options) {
    if (!scene || !scene.add || typeof scene.add.container !== "function") throw new TypeError("Informe uma cena Phaser válida.");
    const missing = REQUIRED.filter(name => !root[name] || typeof root[name].mount !== "function");
    if (missing.length) throw new Error("Módulos adicionais ausentes: " + missing.join(", "));
    const o = Object.assign({
      parent: null,
      life: {},
      landmarks: {},
      cityEvolution: {},
      economyOverlay: {}
    }, options || {});
    const parent = o.parent || scene.add.container(0, 0);
    const ownedParent = !o.parent;
    if (!parent || typeof parent.add !== "function") throw new TypeError("O parent precisa ser um Container Phaser.");
    const layers = {};
    let destroyed = false;

    function enabledOptions(value) { return value === false ? null : (value && typeof value === "object" ? value : {}); }
    try {
      const lifeOptions = enabledOptions(o.life);
      const landmarkOptions = enabledOptions(o.landmarks);
      const evolutionOptions = enabledOptions(o.cityEvolution);
      const economyOptions = enabledOptions(o.economyOverlay);
      // Ordem de composição: efeitos urbanos de base, marcos, circulação e, por cima, leitura econômica.
      if (evolutionOptions) layers.cityEvolution = root.VilarejoWorldCityEvolution.mount(scene, Object.assign({}, evolutionOptions, { parent }));
      if (landmarkOptions) layers.landmarks = root.VilarejoWorldLandmarks.mount(scene, Object.assign({}, landmarkOptions, { parent }));
      if (lifeOptions) layers.life = root.VilarejoWorldLife.mount(scene, Object.assign({}, lifeOptions, { parent }));
      if (economyOptions) layers.economyOverlay = root.VilarejoWorldEconomyOverlay.mount(scene, Object.assign({}, economyOptions, { parent }));
    } catch (error) {
      ["economyOverlay", "life", "landmarks", "cityEvolution"].forEach(key => {
        if (layers[key] && typeof layers[key].destroy === "function") layers[key].destroy();
      });
      if (ownedParent) parent.destroy(true);
      throw error;
    }

    function ensureActive() { if (destroyed) throw new Error("Os módulos visuais adicionais foram destruídos."); }
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      ["economyOverlay", "life", "landmarks", "cityEvolution"].forEach(key => {
        if (layers[key] && typeof layers[key].destroy === "function") layers[key].destroy();
      });
      if (ownedParent) parent.destroy(true);
    }
    return Object.freeze({
      version: VERSION,
      container: parent,
      layers: Object.freeze(layers),
      addLandmark: data => { ensureActive(); if (!layers.landmarks) throw new Error("Camada de marcos urbanos desativada."); return layers.landmarks.add(data); },
      removeLandmark: id => { ensureActive(); return layers.landmarks ? layers.landmarks.remove(id) : false; },
      addLifeRoute: data => { ensureActive(); if (!layers.life) throw new Error("Camada de vida urbana desativada."); return layers.life.addRoute(data); },
      setCitySnapshot: data => { ensureActive(); if (!layers.cityEvolution) throw new Error("Camada de evolução urbana desativada."); return layers.cityEvolution.applySnapshot(data); },
      setEconomyData: data => { ensureActive(); if (!layers.economyOverlay) throw new Error("Camada econômica desativada."); return layers.economyOverlay.setData(data); },
      setEconomyMode: mode => { ensureActive(); if (!layers.economyOverlay) throw new Error("Camada econômica desativada."); return layers.economyOverlay.setMode(mode); },
      destroy
    });
  }

  return Object.freeze({ version: VERSION, requiredModules: REQUIRED, mount });
});
