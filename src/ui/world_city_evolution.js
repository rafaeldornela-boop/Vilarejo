/**
 * VILAREJO | WORLD CITY EVOLUTION
 * Camada de evolução urbana: bairros, obras, iluminação, áreas verdes,
 * chaminés e eventos. Recebe estados visuais externos; não calcula economia.
 * Phaser 3 | UMD global: VilarejoWorldCityEvolution
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (root) root.VilarejoWorldCityEvolution = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "1.0.0";
  const STAGES = Object.freeze(["village", "town", "city", "metropolis"]);
  const DISTRICT_COLORS = Object.freeze({
    residential: 0x71a2a0, commercial: 0xd7b66f, industrial: 0xc98264,
    civic: 0x8e9eb8, logistics: 0x7e9cad, green: 0x6ca078
  });

  function finite(value, fallback) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, finite(value, min))); }
  function validPoint(item) {
    return item && Number.isFinite(Number(item.x)) && Number.isFinite(Number(item.y));
  }
  function poly(g, points, color, alpha) {
    g.fillStyle(color, alpha === undefined ? 1 : alpha); g.beginPath(); g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) g.lineTo(points[i][0], points[i][1]);
    g.closePath(); g.fillPath();
  }

  function mount(scene, options) {
    if (!scene || !scene.add || typeof scene.add.container !== "function" || !scene.tweens || typeof scene.tweens.add !== "function") {
      throw new TypeError("Informe uma cena Phaser válida com sistema de tweens.");
    }
    const o = Object.assign({ parent: null, snapshot: null, depth: 12, showDistricts: true, showConstruction: true, showLights: true, showSmoke: true, showGreenery: true }, options || {});
    const parent = o.parent || scene.add.container(0, 0);
    const ownedParent = !o.parent;
    if (!parent || typeof parent.add !== "function") throw new TypeError("O parent precisa ser um Container Phaser.");
    const layer = scene.add.container(0, 0);
    parent.add(layer);
    let snapshot = null;
    let destroyed = false;
    let generated = [];
    let tweens = [];

    function track(object) { if (object) { layer.add(object); generated.push(object); } return object; }
    function trackTween(tween) { if (tween) tweens.push(tween); return tween; }
    function clearGenerated() {
      tweens.forEach(tween => { if (tween && typeof tween.remove === "function") tween.remove(); });
      tweens = [];
      generated.forEach(object => { if (object && object.active !== false && typeof object.destroy === "function") object.destroy(true); });
      generated = [];
    }
    function drawDistrict(district) {
      if (!validPoint(district)) return;
      const type = String(district.kind || district.type || "residential");
      const color = DISTRICT_COLORS[type] || DISTRICT_COLORS.residential;
      const radius = clamp(district.radius === undefined ? 72 : district.radius, 28, 260);
      const intensity = clamp(district.intensity === undefined ? 0.32 : district.intensity, 0.05, 1);
      const g = scene.add.graphics();
      g.fillStyle(color, 0.07 + intensity * 0.11); g.fillEllipse(Number(district.x), Number(district.y), radius * 2.05, radius * 1.1);
      g.lineStyle(1.2, color, 0.18 + intensity * 0.18); g.strokeEllipse(Number(district.x), Number(district.y), radius * 2.05, radius * 1.1);
      if (district.selected) { g.lineStyle(2, 0xf0d48f, 0.9); g.strokeEllipse(Number(district.x), Number(district.y), radius * 2.22, radius * 1.2); }
      track(g);
      if (district.label) {
        const label = scene.add.text(Number(district.x), Number(district.y) - radius * 0.55, String(district.label), {
          fontFamily: "Arial, sans-serif", fontSize: "11px", color: "#ecf0e7",
          stroke: "#273840", strokeThickness: 3, align: "center"
        }).setOrigin(0.5, 1);
        track(label);
      }
    }
    function drawConstruction(site) {
      if (!validPoint(site)) return;
      const x = Number(site.x), y = Number(site.y), scale = clamp(site.scale === undefined ? 1 : site.scale, 0.5, 2.5);
      const width = clamp(site.width === undefined ? 48 : site.width, 20, 150) * scale;
      const height = clamp(site.height === undefined ? 34 : site.height, 14, 120) * scale;
      const g = scene.add.graphics();
      g.fillStyle(0x786e5c, 0.28); g.fillEllipse(x, y + 9 * scale, width * 1.25, 17 * scale);
      g.fillStyle(0xa68b61, 0.9); g.fillRect(x - width/2, y - height * 0.25, width, height * 0.25);
      g.lineStyle(2 * scale, 0xe2c27a, 0.95);
      g.lineBetween(x - width/2, y, x - width/2, y - height);
      g.lineBetween(x - width/2, y - height, x + width * 0.75, y - height);
      g.lineBetween(x + width * 0.55, y - height, x + width * 0.55, y - height * 0.72);
      g.lineBetween(x - width/2, y - height * 0.45, x + width/2, y - height * 0.45);
      g.lineStyle(1, 0xead9b6, 0.72); g.lineBetween(x - width/2, y, x + width/2, y); g.lineBetween(x - width/2, y - 6*scale, x + width/2, y - 6*scale);
      g.fillStyle(0xd9b96f, 1); for (let i=0;i<4;i+=1) g.fillRect(x - width/2 + i*width/4, y - 5*scale, width/9, 4*scale);
      track(g);
      if (site.label) track(scene.add.text(x, y + 12*scale, String(site.label), { fontFamily:"Arial, sans-serif", fontSize:"10px", color:"#f0dfb7", stroke:"#2b3539", strokeThickness:3 }).setOrigin(0.5,0));
    }
    function drawStreetLight(item) {
      if (!validPoint(item)) return;
      const x = Number(item.x), y = Number(item.y), scale = clamp(item.scale === undefined ? 1 : item.scale, 0.5, 2.2);
      const g = scene.add.graphics();
      g.lineStyle(2 * scale, 0x4b5b5e, 1); g.lineBetween(x, y, x, y - 27*scale); g.lineBetween(x, y - 27*scale, x + 8*scale, y - 27*scale);
      g.fillStyle(0xdac37d, 1); g.fillCircle(x + 9*scale, y - 27*scale, 2.6*scale);
      track(g);
      const glow = scene.add.graphics(); glow.fillStyle(0xf1d78b, 0.16); glow.fillCircle(x + 9*scale, y - 25*scale, 13*scale); track(glow);
      trackTween(scene.tweens.add({ targets: glow, alpha: 0.05, duration: 1250 + Math.round(x % 400), yoyo: true, repeat: -1 }));
    }
    function drawSmoke(source) {
      if (!validPoint(source)) return;
      const x = Number(source.x), y = Number(source.y), intensity = clamp(source.intensity === undefined ? 0.5 : source.intensity, 0.05, 1);
      const count = Math.max(2, Math.round(2 + intensity * 4));
      for (let i=0;i<count;i+=1) {
        const puff = scene.add.graphics();
        puff.fillStyle(source.color || 0xb7c0bb, 0.12 + intensity * 0.12);
        puff.fillEllipse(x + i * 5, y - i * 10, 13 + i*2, 9 + i*2);
        track(puff);
        trackTween(scene.tweens.add({ targets: puff, y: y - 23 - i*8, alpha: 0.025, scale: 1.42, duration: 1900 + i*260, delay: i*270, repeat: -1, onRepeat: function () { if (puff.active) { puff.y = y - i*10; puff.alpha = 0.2; puff.setScale(1); } } }));
      }
    }
    function drawGreenArea(area) {
      if (!validPoint(area)) return;
      const radius = clamp(area.radius === undefined ? 56 : area.radius, 18, 180), intensity = clamp(area.intensity === undefined ? 0.7 : area.intensity, 0.1, 1);
      const g = scene.add.graphics();
      g.fillStyle(0x4b9667, 0.13 + intensity*0.12); g.fillEllipse(Number(area.x), Number(area.y), radius*2, radius*0.9);
      g.lineStyle(1, 0x9ac69c, 0.32); g.strokeEllipse(Number(area.x), Number(area.y), radius*2, radius*0.9);
      track(g);
      const treeCount = clamp(area.trees === undefined ? Math.round(radius/16) : area.trees, 1, 18);
      for(let i=0;i<treeCount;i+=1){
        const offset = (i - (treeCount-1)/2) * Math.min(15, radius/treeCount*1.7);
        const tree = scene.add.graphics();
        tree.fillStyle(0x334b3e,0.22); tree.fillEllipse(Number(area.x)+offset,Number(area.y)+5,15,6);
        tree.fillStyle(i%2?0x6eaa76:0x4e8f65,0.95); tree.fillCircle(Number(area.x)+offset,Number(area.y)-3-(i%3)*2,5+(i%3));
        tree.fillStyle(0xa5c58b,0.65); tree.fillCircle(Number(area.x)+offset-2,Number(area.y)-5-(i%3)*2,2);
        track(tree);
      }
    }
    function drawFestival(event) {
      if (!event || typeof event !== "object" || !validPoint(event)) return;
      const x = finite(event.x, 0), y = finite(event.y, 0), width = clamp(event.width === undefined ? 260 : event.width, 80, 560);
      const g = scene.add.graphics();
      g.lineStyle(1.5, 0xe7d9b9, 0.8); g.lineBetween(x-width/2,y,x+width/2,y);
      const colors = [0xc87961,0xd8b56c,0x78a18b,0x7696ae,0xc9c5a9];
      for(let i=0;i<9;i+=1){const px=x-width/2+i*width/8;g.fillStyle(colors[i%colors.length],0.96);g.fillTriangle(px,y,px+width/16,y,px+width/32,y+10);}
      track(g);
      if(event.label) track(scene.add.text(x,y+13,String(event.label),{fontFamily:"Arial, sans-serif",fontSize:"12px",color:"#f2e4bd",stroke:"#293940",strokeThickness:3}).setOrigin(0.5,0));
    }
    function normalizeSnapshot(input) {
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("O snapshot visual precisa ser um objeto.");
      const stage = input.stage === undefined ? "village" : String(input.stage);
      if (!STAGES.includes(stage)) throw new RangeError("Estágio urbano inválido: " + stage);
      const list = key => Array.isArray(input[key]) ? input[key].filter(validPoint).map(item => Object.assign({}, item)) : [];
      return {
        stage,
        districts: list("districts"), constructionSites: list("constructionSites"),
        streetLights: list("streetLights"), smokestacks: list("smokestacks"),
        greenAreas: list("greenAreas"), festival: input.festival || null
      };
    }
    function applySnapshot(input) {
      if (destroyed) throw new Error("A camada de evolução urbana foi destruída.");
      const next = normalizeSnapshot(input);
      clearGenerated();
      snapshot = next;
      if (o.showDistricts) next.districts.forEach(drawDistrict);
      if (o.showConstruction) next.constructionSites.forEach(drawConstruction);
      if (o.showLights && next.stage !== "village") next.streetLights.forEach(drawStreetLight);
      if (o.showSmoke) next.smokestacks.forEach(drawSmoke);
      if (o.showGreenery) next.greenAreas.forEach(drawGreenArea);
      drawFestival(next.festival);
      return getState();
    }
    function getState() {
      return Object.freeze(snapshot ? {
        stage: snapshot.stage, districts: snapshot.districts.length,
        constructionSites: snapshot.constructionSites.length, streetLights: snapshot.streetLights.length,
        smokestacks: snapshot.smokestacks.length, greenAreas: snapshot.greenAreas.length,
        festival: Boolean(snapshot.festival)
      } : { stage: "village", districts: 0, constructionSites: 0, streetLights: 0, smokestacks: 0, greenAreas: 0, festival: false });
    }
    function destroy() {
      if (destroyed) return; destroyed = true;
      scene.events && scene.events.off && scene.events.off("shutdown", destroy);
      clearGenerated(); layer.destroy(true);
      if (ownedParent) parent.destroy(true);
    }
    scene.events && scene.events.once && scene.events.once("shutdown", destroy);
    if (o.snapshot) applySnapshot(o.snapshot);
    return Object.freeze({ version: VERSION, container: layer, applySnapshot, getState, clear: clearGenerated, destroy });
  }

  return Object.freeze({ version: VERSION, stages: STAGES, districtColors: DISTRICT_COLORS, mount });
});
