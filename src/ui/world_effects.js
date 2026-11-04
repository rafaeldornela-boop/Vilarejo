/**
 * VILAREJO | WORLD EFFECTS
 * Efeitos visuais leves para chaminés, usinas, quedas d'água e iluminação.
 * Os efeitos não representam produção real nem alteram dados da simulação.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (root) root.VilarejoWorldEffects = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function mount(scene, options) {
    if (!scene || !scene.add || !scene.tweens || typeof scene.tweens.add !== "function") {
      throw new TypeError("Informe uma cena Phaser com sistema de tweens.");
    }
    const o = Object.assign({ parent: null, maxEffects: 80 }, options || {});
    const container = o.parent || scene.add.container(0, 0);
    const effects = new Set();
    let destroyed = false;

    function track(objects, tweens) {
      const handle = {
        destroy() {
          if (!effects.has(handle)) return;
          effects.delete(handle);
          (tweens || []).forEach(t => { if (t && t.remove) t.remove(); });
          (objects || []).forEach(obj => { if (obj && obj.destroy) obj.destroy(); });
        }
      };
      effects.add(handle);
      while (effects.size > Math.max(1, Number(o.maxEffects) || 80)) {
        const oldest = effects.values().next().value;
        oldest.destroy();
      }
      return Object.freeze(handle);
    }

    function puff(kind, x, y, config) {
      if (destroyed) throw new Error("A camada de efeitos foi destruída.");
      const c = Object.assign({ count: 4, color: kind === "steam" ? 0xe9eee8 : 0x737b78, alpha: 0.28, spread: 14, rise: 62, duration: 2500 }, config || {});
      const objects = [], tweens = [];
      const count = Math.max(1, Math.min(12, Number(c.count) || 4));
      for (let i = 0; i < count; i += 1) {
        const r = 5 + (i % 3) * 2;
        const cloud = scene.add.ellipse(x + (i - count / 2) * c.spread / 2, y, r * 2, r * 1.5, c.color, c.alpha);
        container.add(cloud); objects.push(cloud);
        const tween = scene.tweens.add({
          targets: cloud,
          y: y - c.rise - i * 6,
          x: cloud.x + (i % 2 ? 1 : -1) * c.spread,
          alpha: 0,
          scaleX: 1.7,
          scaleY: 1.7,
          duration: c.duration + i * 240,
          delay: i * 360,
          repeat: -1,
          onRepeat: () => { if (!destroyed && cloud.active) { cloud.x = x + (i - count / 2) * c.spread / 2; cloud.y = y; cloud.alpha = c.alpha; cloud.setScale(1); } }
        });
        tweens.push(tween);
      }
      return track(objects, tweens);
    }

    function waterFlow(x, y, config) {
      if (destroyed) throw new Error("A camada de efeitos foi destruída.");
      const c = Object.assign({ length: 90, count: 5, color: 0xd5f0ed, duration: 1500 }, config || {});
      const objects = [], tweens = [];
      const count = Math.max(1, Math.min(12, Number(c.count) || 5));
      for (let i = 0; i < count; i += 1) {
        const streak = scene.add.rectangle(x + i * (c.length / count), y + (i % 2) * 4, 18, 2, c.color, 0.62);
        container.add(streak); objects.push(streak);
        tweens.push(scene.tweens.add({ targets: streak, x: x + c.length, alpha: 0.08, duration: c.duration, repeat: -1, onRepeat: () => { if (!destroyed && streak.active) { streak.x = x; streak.alpha = 0.62; } } }));
      }
      return track(objects, tweens);
    }

    function beacon(x, y, config) {
      if (destroyed) throw new Error("A camada de efeitos foi destruída.");
      const c = Object.assign({ color: 0xffd56b, radius: 8, duration: 1100 }, config || {});
      const glow = scene.add.circle(x, y, c.radius, c.color, 0.38);
      container.add(glow);
      const tween = scene.tweens.add({ targets: glow, alpha: 0.08, scale: 2.1, duration: c.duration, yoyo: true, repeat: -1 });
      return track([glow], [tween]);
    }

    function attach(kind, config) {
      const c = Object.assign({}, config || {});
      const x = Number(c.x) || 0, y = Number(c.y) || 0;
      if (kind === "smoke") return puff("smoke", x, y, c);
      if (kind === "steam") return puff("steam", x, y, c);
      if (kind === "water") return waterFlow(x, y, c);
      if (kind === "beacon" || kind === "light") return beacon(x, y, c);
      throw new RangeError("Efeito desconhecido: " + kind);
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      Array.from(effects).forEach(effect => effect.destroy());
      if (!o.parent) container.destroy(true);
    }

    scene.events && scene.events.once && scene.events.once("shutdown", destroy);
    return Object.freeze({ version: "1.0.0", container, attach, smoke: (x,y,c) => puff("smoke",x,y,c), steam: (x,y,c) => puff("steam",x,y,c), waterFlow, beacon, destroy });
  }

  return Object.freeze({ version: "1.0.0", mount });
});
