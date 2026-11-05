"use strict";

/**
 * Valida o artefato de publicação estática em dist/.
 * Exige que npm run build (ou prepare:dist) tenha sido executado antes.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "../../");
const DIST = path.join(ROOT, "dist");

const REQUIRED_SCRIPTS = [
  "src/core/vilarejo_core.js",
  "src/shared/vilarejo_history_store.js",
  "src/events/eventos_v3.js",
  "src/economy/vilarejo_economy.js",
  "src/society/vilarejo_society.js",
  "src/politics/vilarejo_politics.js",
  "src/institutions/vilarejo_institutions.js",
  "src/services/vilarejo_services.js",
  "src/world/vilarejo_world_engine.js",
  "src/newspaper/vilarejo_newspaper.js",
  "src/intelligence/vilarejo_intelligence.js",
  "src/intelligence/intelligence_view.js",
  "src/ui/decision_observer.js",
  "src/ui/world_sprites_pixelart.js",
  "src/ui/world_renderer_phaser.js",
  "src/ui/dashboard.js"
];

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write(`✓ ${name}\n`);
  } catch (error) {
    failed += 1;
    process.stderr.write(`✗ ${name}\n  ${error && error.stack ? error.stack : error}\n`);
  }
}

console.log("=== PUBLICAÇÃO DIST/ (NETLIFY) ===\n");

test("dist/ existe após o build de publicação", () => {
  assert.ok(fs.existsSync(DIST), "pasta dist/ ausente — execute npm run build");
  assert.ok(fs.statSync(DIST).isDirectory());
});

test("index.html e style.css estão na raiz de dist/", () => {
  assert.ok(fs.existsSync(path.join(DIST, "index.html")));
  assert.ok(fs.existsSync(path.join(DIST, "style.css")));
});

test("todos os scripts do index estão presentes em dist/ com caminhos relativos intactos", () => {
  const html = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((m) => m[1]).filter((src) => !src.startsWith("http://") && !src.startsWith("https://"));
  assert.deepEqual(scripts, REQUIRED_SCRIPTS);
  for (const src of scripts) {
    const absolute = path.join(DIST, src);
    assert.ok(fs.existsSync(absolute), `faltando ${src}`);
    assert.ok(fs.statSync(absolute).size > 0, `${src} vazio`);
  }
});

test("assets públicos referenciados existem em dist/", () => {
  const html = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
  const css = fs.readFileSync(path.join(DIST, "style.css"), "utf8");
  const refs = [
    ...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi),
    ...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)
  ]
    .map((m) => m[1].trim())
    .filter((ref) => ref && !ref.startsWith("#") && !/^(?:[a-z]+:|\/\/)/i.test(ref) && !ref.startsWith("data:"));

  for (const ref of refs) {
    if (ref === "style.css" || ref.endsWith(".js")) continue;
    const absolute = path.join(DIST, ref);
    assert.ok(fs.existsSync(absolute), `recurso local ausente em dist/: ${ref}`);
  }

  assert.ok(
    fs.existsSync(path.join(DIST, "public/assets/interface/community-decision-illustration.jpg"))
  );
  assert.ok(
    fs.existsSync(path.join(DIST, "public/assets/audio/morning_light_on_cobblestone.mp3"))
  );
});

test("dist/ não inclui testes, docs nem servidor Node", () => {
  const forbidden = [
    "src/test",
    "docs",
    "server.js",
    "package.json",
    "scripts",
    "node_modules",
    ".git"
  ];
  for (const item of forbidden) {
    assert.equal(fs.existsSync(path.join(DIST, item)), false, `${item} não deveria estar em dist/`);
  }
});

test("módulos principais exportam API esperada quando carregados em sequência", () => {
  const sandbox = {
    window: {},
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({
        style: {},
        classList: { add() {}, remove() {}, contains() { return false; } },
        setAttribute() {},
        appendChild() {},
        addEventListener() {}
      }),
      addEventListener() {}
    },
    console,
    setTimeout,
    clearTimeout,
    setInterval: () => 1,
    clearInterval() {},
    Math,
    Date,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    RegExp,
    Error,
    TypeError,
    Map,
    Set,
    Promise,
    parseInt,
    parseFloat,
    isNaN,
    isFinite
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);

  const load = (relativePath) => {
    const code = fs.readFileSync(path.join(DIST, relativePath), "utf8");
    vm.runInContext(code, context, { filename: relativePath });
  };

  // Core e histórico primeiro (sem economia completa, que depende de DOM/timer).
  load("src/core/vilarejo_core.js");
  load("src/shared/vilarejo_history_store.js");
  load("src/newspaper/vilarejo_newspaper.js");

  assert.ok(context.VilarejoCore, "VilarejoCore disponível");
  assert.ok(context.VilarejoHistoryStore, "VilarejoHistoryStore disponível");
  assert.ok(context.VilarejoNewspaper, "VilarejoNewspaper disponível");
  assert.equal(typeof context.VilarejoNewspaper.registerWithRuntime, "function");
  assert.equal(typeof context.VilarejoNewspaper.renderDashboard, "function");

  const runtime = context.VilarejoCore.createRuntime({
    calendar: { daysPerMonth: 30, monthsPerYear: 12 }
  });
  runtime.modules.register({
    id: "economia",
    version: "3.0.0",
    dependencies: ["core"]
  });
  const registration = context.VilarejoNewspaper.registerWithRuntime(runtime, { window: context });
  assert.equal(registration.alreadyRegistered, false);
  assert.ok(runtime.modules.has("jornal"));
});

test("netlify.toml publica dist/ e não usa SPA fallback 200", () => {
  const toml = fs.readFileSync(path.join(ROOT, "netlify.toml"), "utf8");
  assert.match(toml, /publish\s*=\s*"dist"/);
  assert.doesNotMatch(toml, /from\s*=\s*"\/\*"[\s\S]*to\s*=\s*"\/index\.html"[\s\S]*status\s*=\s*200/);
});

console.log(`\nResultado dist/: ${passed} aprovados; ${failed} reprovados.`);
if (failed) process.exitCode = 1;
