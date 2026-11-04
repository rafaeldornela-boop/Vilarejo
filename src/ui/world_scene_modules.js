/**
 * VILAREJO | SCENE MODULE COMPOSER
 * Monta e desmonta as camadas visuais no container do mundo.
 * Carregue todos os módulos world_*.js antes deste arquivo.
 */
(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (root) root.VilarejoWorldSceneModules = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const REQUIRED = [
    "VilarejoWorldTerrain", "VilarejoWorldRoads", "VilarejoWorldNature",
    "VilarejoWorldStructures", "VilarejoWorldEffects", "VilarejoWorldAtmosphere"
  ];

  function mount(scene, options) {
    if (!scene || !scene.add || typeof scene.add.container !== "function") throw new TypeError("Informe uma cena Phaser válida.");
    const missing = REQUIRED.filter(name => !root[name] || typeof root[name].mount !== "function");
    if (missing.length) throw new Error("Módulos visuais ausentes: " + missing.join(", "));
    const o = Object.assign({ parent: null, terrain: {}, roads: {}, nature: {}, structures: {}, effects: {}, atmosphere: false }, options || {});
    const parent = o.parent || scene.add.container(0, 0);
    const ownedParent = !o.parent;
    const layers = {};
    let destroyed = false;

    try {
      layers.terrain = root.VilarejoWorldTerrain.mount(scene, Object.assign({}, o.terrain, { parent }));
      layers.roads = root.VilarejoWorldRoads.mount(scene, Object.assign({}, o.roads, { parent }));
      layers.nature = root.VilarejoWorldNature.mount(scene, Object.assign({}, o.nature, { parent }));
      layers.structures = root.VilarejoWorldStructures.mount(scene, Object.assign({}, o.structures, { parent }));
      layers.effects = root.VilarejoWorldEffects.mount(scene, Object.assign({}, o.effects, { parent }));
      if (o.atmosphere) layers.atmosphere = root.VilarejoWorldAtmosphere.mount(scene, typeof o.atmosphere === "object" ? o.atmosphere : {});
    } catch (error) {
      Object.keys(layers).reverse().forEach(key => { if (layers[key] && layers[key].destroy) layers[key].destroy(); });
      if (ownedParent) parent.destroy(true);
      throw error;
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      ["atmosphere", "effects", "structures", "nature", "roads", "terrain"].forEach(key => {
        if (layers[key] && layers[key].destroy) layers[key].destroy();
      });
      if (ownedParent) parent.destroy(true);
    }

    return Object.freeze({
      version: "1.0.0", container: parent, layers,
      addStructure: data => layers.structures.add(data),
      removeStructure: id => layers.structures.remove(id),
      attachEffect: (kind, config) => layers.effects.attach(kind, config),
      setAtmosphere: patch => {
        if (!layers.atmosphere) throw new Error("Atmosfera não foi habilitada na montagem.");
        return layers.atmosphere.setConditions(patch);
      },
      destroy
    });
  }

  return Object.freeze({ version: "1.0.0", mount, requiredModules: Object.freeze(REQUIRED.slice()) });
});
