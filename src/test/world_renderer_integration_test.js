"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "../../");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const worldSpritesCode = fs.readFileSync(path.join(ROOT, "src/ui/world_sprites_pixelart.js"), "utf8");
const worldRendererCode = fs.readFileSync(path.join(ROOT, "src/ui/world_renderer_phaser.js"), "utf8");
const dashboardCode = fs.readFileSync(path.join(ROOT, "src/ui/dashboard.js"), "utf8");

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`  ✗ ${name}: ${error.stack || error}`);
  }
}

/**
 * Cria mock estruturado do Phaser 3 compatível com os requisitos de world_renderer_phaser.js.
 */
function createMockPhaser() {
  function makeBaseObject() {
    return {
      setOrigin: function() { return this; },
      setScrollFactor: function() { return this; },
      setDepth: function() { return this; },
      setAlpha: function() { return this; },
      setText: function() { return this; },
      setVisible: function() { return this; },
      setInteractive: function() { return this; },
      setFillStyle: function() { return this; },
      setStrokeStyle: function() { return this; },
      on: function() { return this; },
      destroy: function() {}
    };
  }

  class MockScene {
    constructor(config) {
      this.config = config;
      this.cameras = {
        main: {
          zoom: 1,
          scrollX: 0,
          scrollY: 0,
          setBackgroundColor: function() { return this; },
          setZoom: function(z) { this.zoom = z; return this; },
          setBounds: function() { return this; },
          centerOn: function(x, y) { this.scrollX = x; this.scrollY = y; return this; },
          getWorldPoint: function(x, y) { return { x, y }; }
        }
      };
      this.add = {
        graphics: () => ({
          ...makeBaseObject(),
          clear: function() { return this; },
          fillStyle: function() { return this; },
          lineStyle: function() { return this; },
          fillRect: function() { return this; },
          strokeRect: function() { return this; },
          fillPoints: function() { return this; },
          strokePoints: function() { return this; },
          beginPath: function() { return this; },
          moveTo: function() { return this; },
          lineTo: function() { return this; },
          closePath: function() { return this; },
          fillPath: function() { return this; },
          strokePath: function() { return this; },
          fillCircle: function() { return this; },
          strokeCircle: function() { return this; }
        }),
        text: () => makeBaseObject(),
        image: () => makeBaseObject(),
        rectangle: () => makeBaseObject(),
        ellipse: () => makeBaseObject(),
        polygon: () => makeBaseObject(),
        container: () => ({
          ...makeBaseObject(),
          add: function() { return this; },
          setSize: function() { return this; }
        })
      };
      const registeredTextures = new Map();
      this.textures = {
        exists: (key) => registeredTextures.has(key),
        addCanvas: (key, canvas) => {
          registeredTextures.set(key, canvas);
          return canvas;
        },
        getRegisteredKeys: () => [...registeredTextures.keys()]
      };
      this.input = {
        on: function() { return this; },
        topOnly: true
      };
      this.scale = {
        width: 1280,
        height: 760
      };
    }
  }

  class MockGame {
    constructor(config) {
      this.config = config;
      this.destroyed = false;
      this.canvas = {
        tagName: "CANVAS",
        width: config.width || 1280,
        height: config.height || 760
      };
      if (config.parent && typeof config.parent.appendChild === "function") {
        config.parent.appendChild(this.canvas);
      }
      const SceneClass = Array.isArray(config.scene) ? config.scene[0] : config.scene;
      this.activeScene = SceneClass ? new SceneClass() : new MockScene();
      if (typeof this.activeScene.init === "function") this.activeScene.init();
      if (typeof this.activeScene.create === "function") this.activeScene.create();

      this.scene = {
        getScene: (key) => this.activeScene
      };
    }

    destroy(removeCanvas) {
      this.destroyed = true;
      if (removeCanvas && this.canvas && this.canvas.parentNode) {
        this.canvas.parentNode.removeChild(this.canvas);
      }
    }
  }

  return {
    AUTO: 0,
    Scale: { FIT: 1, CENTER_BOTH: 2 },
    Game: MockGame,
    Scene: MockScene,
    Geom: {
      Point: class { constructor(x = 0, y = 0) { this.x = x; this.y = y; } },
      Polygon: class { constructor(points = []) { this.points = points; } },
      Rectangle: class { constructor(x = 0, y = 0, w = 0, h = 0) { this.x = x; this.y = y; this.width = w; this.height = h; } }
    },
    Math: {
      Clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
      Between: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
    }
  };
}

/**
 * Cria mock do DOM simulando o index.html com o elemento #worldCanvas.
 */
function createMockDOM() {
  const elements = new Map();
  const childrenMap = new Map();
  const docListeners = new Map();

  function makeElement(id, tagName = "DIV") {
    const classSet = new Set();
    const attrs = new Map();
    const childList = [];
    childrenMap.set(id, childList);

    const el = {
      id,
      tagName,
      children: childList,
      classList: {
        add: (...cls) => cls.forEach((c) => classSet.add(c)),
        remove: (...cls) => cls.forEach((c) => classSet.delete(c)),
        toggle: (c, force) => {
          if (force === true) { classSet.add(c); return true; }
          if (force === false) { classSet.delete(c); return false; }
          if (classSet.has(c)) { classSet.delete(c); return false; }
          classSet.add(c); return true;
        },
        contains: (c) => classSet.has(c)
      },
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => attrs.get(k) ?? null,
      dataset: {
        get engine() { return attrs.get("data-engine"); },
        get worldStatus() { return attrs.get("data-world-status"); },
        set worldStatus(v) { attrs.set("data-world-status", v); }
      },
      appendChild: (child) => {
        childList.push(child);
        child.parentNode = el;
        return child;
      },
      removeChild: (child) => {
        const idx = childList.indexOf(child);
        if (idx >= 0) childList.splice(idx, 1);
        child.parentNode = null;
        return child;
      },
      addEventListener: () => {},
      querySelectorAll: () => [],
      querySelector: () => null,
      focus: () => {}
    };

    elements.set(id, el);
    return el;
  }

  // Prepara elementos essenciais
  const worldCanvas = makeElement("worldCanvas");
  worldCanvas.setAttribute("data-engine", "phaser");
  worldCanvas.setAttribute("data-world-status", "awaiting-engine");

  makeElement("villageMap", "SVG");
  makeElement("pageTitle");
  makeElement("pageHeading");
  makeElement("pageDescription");
  makeElement("monthIndicator");
  makeElement("dayIndicator");
  makeElement("event");
  makeElement("eventTitle");
  makeElement("eventText");
  makeElement("eventOptions");

  return {
    getElementById: (id) => elements.get(id) || null,
    querySelectorAll: (selector) => [],
    querySelector: (selector) => null,
    addEventListener: (evt, cb) => {
      if (!docListeners.has(evt)) docListeners.set(evt, []);
      docListeners.get(evt).push(cb);
    },
    removeEventListener: () => {},
    activeElement: null
  };
}

console.log("\n=== TESTES DE INTEGRAÇÃO DO PHASER & WORLD RENDERER ===");

test("index.html declara container #worldCanvas com data-engine='phaser' e scripts na ordem certa", () => {
  assert.ok(html.includes('id="worldCanvas"'), "Container #worldCanvas deve estar presente");
  assert.ok(html.includes('data-engine="phaser"'), "data-engine deve ser phaser");

  const phaserCdnIndex = html.indexOf("cdn.jsdelivr.net/npm/phaser@3.87.0/dist/phaser.min.js");
  const worldSpritesIndex = html.indexOf("src/ui/world_sprites_pixelart.js");
  const worldRendererIndex = html.indexOf("src/ui/world_renderer_phaser.js");
  const dashboardIndex = html.indexOf("src/ui/dashboard.js");

  assert.ok(phaserCdnIndex >= 0, "Phaser CDN deve estar referenciado");
  assert.ok(worldSpritesIndex >= 0, "world_sprites_pixelart.js deve estar referenciado");
  assert.ok(worldRendererIndex >= 0, "world_renderer_phaser.js deve estar referenciado");
  assert.ok(dashboardIndex >= 0, "dashboard.js deve estar referenciado");

  assert.ok(phaserCdnIndex < worldSpritesIndex, "Phaser deve carregar antes do world_sprites_pixelart");
  assert.ok(worldSpritesIndex < worldRendererIndex, "world_sprites_pixelart deve carregar antes do world_renderer");
  assert.ok(worldRendererIndex < dashboardIndex, "world_renderer deve carregar antes de dashboard");
});

test("VilarejoWorldRenderer.mount() valida parâmetros, instala sprites pixel-art e instancia Game no container", () => {
  const Phaser = createMockPhaser();
  const dom = createMockDOM();
  const container = dom.getElementById("worldCanvas");

  const sandbox = {
    Phaser,
    console
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(worldSpritesCode, sandbox);
  vm.runInContext(worldRendererCode, sandbox);

  const sprites = sandbox.VilarejoPixelArtSprites;
  assert.ok(sprites, "VilarejoPixelArtSprites deve estar disponível");
  assert.ok(Array.isArray(sprites.spriteKeys) && sprites.spriteKeys.length >= 12, "Deve exportar catálogo de sprites pixel-art");

  const renderer = sandbox.VilarejoWorldRenderer;
  assert.ok(renderer, "VilarejoWorldRenderer deve estar disponível");
  assert.equal(typeof renderer.mount, "function", "mount() deve ser uma função");

  let snapshotCalled = false;
  const mockSnapshot = {
    monthNumber: 3,
    treasury: 15000,
    population: 25,
    territory: { buildings: [] }
  };

  const handle = renderer.mount({
    container,
    Phaser,
    getSnapshot: () => {
      snapshotCalled = true;
      return mockSnapshot;
    }
  });

  assert.ok(snapshotCalled, "getSnapshot deve ter sido invocado na inicialização");
  assert.ok(handle, "mount() deve retornar um objeto handle");
  assert.ok(handle.game, "handle deve conter a instância game do Phaser");
  assert.equal(typeof handle.refresh, "function", "handle.refresh deve ser função");
  assert.equal(typeof handle.destroy, "function", "handle.destroy deve ser função");

  assert.ok(container.children.some((c) => c.tagName === "CANVAS"), "O canvas do Phaser deve estar no container");
  assert.equal(container.__vilarejoWorld, handle, "Referência __vilarejoWorld associada ao container");
  assert.equal(handle.game.config.render.pixelArt, true, "Configuração render.pixelArt deve estar ativa");
  assert.equal(handle.game.config.render.antialias, false, "Configuração render.antialias deve estar desativada para pixel-art");
  assert.ok(handle.game.activeScene.textures.exists("bld_house"), "Textura bld_house deve estar instalada na cena");
  assert.ok(handle.game.activeScene.textures.exists("bld_civic"), "Textura bld_civic deve estar instalada na cena");
  assert.ok(handle.game.activeScene.textures.exists("prop_tree_oak"), "Textura prop_tree_oak deve estar instalada na cena");

  // Testa refresh
  const refreshed = handle.refresh();
  assert.deepEqual(refreshed, mockSnapshot, "refresh() deve retornar o snapshot atualizado");

  // Testa destroy
  handle.destroy();
  assert.equal(handle.game.destroyed, true, "game.destroy(true) deve ter sido chamado");
  assert.equal(container.__vilarejoWorld, undefined, "__vilarejoWorld deve ser removido no destroy");
});

test("Dashboard inicializa VilarejoWorldRenderer no overview, atualiza no refresh e destrói adequadamente", () => {
  const Phaser = createMockPhaser();
  const dom = createMockDOM();
  const container = dom.getElementById("worldCanvas");

  let mockSnapshotData = {
    monthNumber: 1,
    day: 1,
    treasury: 10000,
    population: 12,
    history: []
  };

  const sandbox = {
    window: {
      Phaser,
      VilarejoRuntime: {
        snapshot: () => mockSnapshotData,
        events: { on: () => {} }
      },
      scrollTo: () => {},
      addEventListener: () => {},
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (id) => clearTimeout(id)
    },
    document: dom,
    console,
    Phaser,
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id)
  };
  sandbox.globalThis = sandbox.window;
  sandbox.window.window = sandbox.window;

  vm.createContext(sandbox);

  // Carrega sprites, renderer e depois dashboard
  vm.runInContext(worldSpritesCode, sandbox);
  vm.runInContext(worldRendererCode, sandbox);
  vm.runInContext(dashboardCode, sandbox);

  const dashboard = sandbox.window.VilarejoDashboard;
  assert.ok(dashboard, "VilarejoDashboard deve estar disponível");

  // Verifica que o renderer foi inicializado no overview
  const rendererHandle = dashboard.getWorldRenderer();
  assert.ok(rendererHandle, "Renderer handle deve ter sido criado no mount do dashboard");
  assert.equal(container.getAttribute("data-world-status"), "mounted", "Status deve ser 'mounted'");
  assert.ok(container.children.some((c) => c.tagName === "CANVAS"), "Canvas inserido no container");

  // Testa refresh do dashboard chamando refresh do renderer
  mockSnapshotData.monthNumber = 2;
  dashboard.refresh();
  assert.ok(rendererHandle.game, "Renderer continua ativo após refresh");

  // Testa destroyWorldRenderer
  dashboard.destroyWorldRenderer();
  assert.equal(dashboard.getWorldRenderer(), null, "getWorldRenderer deve retornar null após destroy");
  assert.equal(container.getAttribute("data-world-status"), "awaiting-engine", "Status volta a 'awaiting-engine'");
});

if (failures.length > 0) {
  console.error(`\n${failures.length} teste(s) falharam em world_renderer_integration_test.`);
  process.exit(1);
} else {
  console.log(`\nTodos os ${passed} testes de integração do Phaser passaram com sucesso!`);
}
