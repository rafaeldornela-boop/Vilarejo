"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const EventosV3 = require("../events/eventos_v3.js");
const VilarejoPublicServices = require("../services/public_services_engine.js");

const ROOT = path.join(__dirname, "../../");
const DOMAIN_SCRIPTS = [
  "src/society/vilarejo_society.js",
  "src/politics/vilarejo_politics.js",
  "src/institutions/vilarejo_institutions.js",
  "src/services/vilarejo_services.js"
];

function makeElement(id) {
  return {
    id,
    innerHTML: "",
    textContent: "",
    value: "",
    disabled: false,
    onclick: null,
    oninput: null,
    onchange: null,
    dataset: {},
    style: {},
    classList: {
      add() {},
      remove() {},
      contains() { return false; },
      toggle() { return false; }
    },
    closest() { return null; },
    appendChild() {},
    removeChild() {},
    setAttribute() {},
    getAttribute() { return null; },
    querySelector(selector) { return makeElement(`${id}:${selector}`); },
    querySelectorAll() { return []; }
  };
}

function createSimulationContext({ includeDomainModules = false } = {}) {
  const elements = new Map();
  const getElementById = (id) => {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  };
  const document = {
    getElementById,
    querySelector: getElementById,
    querySelectorAll: () => [],
    createElement: (tag) => makeElement(tag),
    activeElement: null,
    body: getElementById("body"),
    documentElement: getElementById("html")
  };
  const context = {
    document,
    console,
    Math,
    Date,
    JSON,
    Object,
    Array,
    Number,
    String,
    Boolean,
    Map,
    Set,
    Intl,
    RegExp,
    Error,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Infinity,
    NaN,
    EventosV3,
    VilarejoPublicServices,
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: () => 1,
    clearTimeout: () => {}
  };
  // In a browser, window and globalThis name the same global object.
  context.window = context;
  vm.createContext(context);

  const scripts = [
    "src/core/vilarejo_core.js",
    "src/economy/vilarejo_economy.js",
    ...(includeDomainModules ? DOMAIN_SCRIPTS : [])
  ];
  for (const relativePath of scripts) {
    const code = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    vm.runInContext(code, context, { filename: path.basename(relativePath), timeout: 30000 });
  }
  return context;
}

module.exports = { createSimulationContext };
