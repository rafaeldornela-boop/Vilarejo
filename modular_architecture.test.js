"use strict";

const assert = require("node:assert/strict");
const ModuleKit = require("../public/modules/module_factory.js");
const EconomyPort = require("../public/modules/economia/index.js");
const Core = require("../vilarejo_core.js");

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${name}: ${error.stack || error}`);
  }
}

function makeRuntime() {
  const runtime = Core.createRuntime({ calendar: { daysPerMonth: 30, monthsPerYear: 12 } });
  runtime.modules.register({
    id: "economia",
    version: "3.0.0",
    name: "Economia",
    dependencies: ["core"]
  });
  runtime.modules.updateSnapshot("economia", { monthNumber: 0, status: "ready" }, "economia.test");
  runtime.population.syncFromEconomy([
    { id: 1, name: "Família A", adults: 2, children: 1, jobs: 1, happiness: 65 }
  ], 1);
  return runtime;
}

console.log("\n=== CONTRATO MODULAR 0.2 ===");

check("Fábrica exporta a versão e os métodos esperados", () => {
  assert.equal(ModuleKit.version, "0.2.1");
  assert.equal(typeof ModuleKit.createModule, "function");
  assert.equal(typeof ModuleKit.normalizeDescriptor, "function");
  assert.equal(typeof ModuleKit.cloneSerializable, "function");
});

check("Descritores exigem identificador e versão semântica válidos", () => {
  assert.throws(() => ModuleKit.createModule({ id: "Sociedade", version: "0.1" }), /identificador|versionamento semântico/);
  assert.throws(() => ModuleKit.createModule({ id: "sociedade", version: "versao" }), /versionamento semântico/);
  assert.throws(() => ModuleKit.createModule({ id: "sociedade", version: "0.1.0", dependencies: "core" }), /lista/);
  assert.throws(() => ModuleKit.createModule({ id: "sociedade", version: "0.1.0", dependencies: ["core", "core"] }), /duplicadas/);
  assert.throws(() => ModuleKit.createModule({ id: "sociedade", version: "0.1.0", dependencies: ["sociedade"] }), /não pode depender de si mesmo/);
});

check("Dependências ausentes impedem registro e inicialização", () => {
  const runtime = makeRuntime();
  const module = ModuleKit.createModule({ id: "sociedade", version: "0.1.0", dependencies: ["politica"] });
  assert.throws(() => module.start(runtime), /Dependência ausente/);
  assert.equal(module.getStatus(), "created");
  assert.equal(runtime.modules.has("sociedade"), false);
});

check("Módulo registra, inicia e publica seu snapshot privado", () => {
  const runtime = makeRuntime();
  const module = ModuleKit.createModule(
    { id: "sociedade", version: "0.1.0", name: "Sociedade", dependencies: ["core", "economia"] },
    { initialState: { indicadores: 0 }, start(context) { context.setState({ indicadores: 1 }); } }
  );
  module.start(runtime);
  assert.equal(module.getStatus(), "active");
  assert.equal(runtime.modules.has("sociedade"), true);
  assert.equal(runtime.modules.get("sociedade").snapshot.lifecycle, "active");
  assert.equal(runtime.modules.get("sociedade").snapshot.state.indicadores, 1);
});

check("Contexto não expõe runtime bruto e entrega snapshots isolados", () => {
  const runtime = makeRuntime();
  let context;
  const module = ModuleKit.createModule({ id: "sociedade", version: "0.1.0", dependencies: ["core"] }, {
    start(value) { context = value; }
  });
  module.start(runtime);
  assert.equal(Object.prototype.hasOwnProperty.call(context, "runtime"), false);
  const snapshot = context.worldSnapshot();
  snapshot.population.totals.total = 999;
  assert.equal(runtime.population.getSnapshot().totals.total, 3);
  const clock = context.clock.snapshot();
  clock.absoluteDay = 999;
  assert.equal(runtime.clock.snapshot().absoluteDay, 1);
  const state = module.getState();
  assert.deepEqual(state, {});
});

check("Publicação de eventos é restrita ao namespace do módulo", () => {
  const runtime = makeRuntime();
  let published = null;
  runtime.events.on("sociedade:indicador-atualizado", (event) => { published = event; });
  const module = ModuleKit.createModule({ id: "sociedade", version: "0.1.0", dependencies: ["core"] }, {
    start(context) {
      context.events.publish("indicador-atualizado", { indicador: "frequência-escolar", valor: 0.9 });
    }
  });
  module.start(runtime);
  assert.equal(published.topic, "sociedade:indicador-atualizado");
  assert.equal(published.source, "sociedade");
  assert.throws(() => {
    const bad = ModuleKit.createModule({ id: "politica", version: "0.1.0", dependencies: ["core"] }, {
      start(context) { context.events.publish("sociedade:lei-aprovada", {}); }
    });
    bad.start(runtime);
  }, /nome local do evento/);
  assert.throws(() => {
    const bad = ModuleKit.createModule({ id: "legislacao", version: "0.1.0", dependencies: ["core"] }, {
      start(context) { context.events.on("evento-sem-namespace", () => {}); }
    });
    bad.start(runtime);
  }, /usar namespace/);
});

check("Inscrições são canceladas ao encerrar o módulo", () => {
  const runtime = makeRuntime();
  let received = 0;
  const module = ModuleKit.createModule({ id: "sociedade", version: "0.1.0", dependencies: ["core"] }, {
    start(context) {
      context.events.on("economy:month-closed", () => { received += 1; });
    }
  });
  module.start(runtime);
  runtime.publish("economy:month-closed", { monthNumber: 1 }, "economia");
  assert.equal(received, 1);
  assert.equal(module.stop(), true);
  runtime.publish("economy:month-closed", { monthNumber: 2 }, "economia");
  assert.equal(received, 1);
  assert.equal(module.getStatus(), "stopped");
  assert.equal(module.stop(), false);
  assert.equal(module.start(runtime).getStatus(), "active");
  runtime.publish("economy:month-closed", { monthNumber: 3 }, "economia");
  assert.equal(received, 2);
  module.stop();
});

check("Assinatura única é removida depois do primeiro evento", () => {
  const runtime = makeRuntime();
  let received = 0;
  const module = ModuleKit.createModule({ id: "sociedade", version: "0.1.0", dependencies: ["core"] }, {
    start(context) {
      context.events.once("economy:month-closed", () => { received += 1; });
    }
  });
  module.start(runtime);
  runtime.publish("economy:month-closed", { monthNumber: 1 }, "economia");
  runtime.publish("economy:month-closed", { monthNumber: 2 }, "economia");
  assert.equal(received, 1);
});

check("Payloads recusam funções, undefined, não finitos e referências circulares", () => {
  const cycle = {};
  cycle.self = cycle;
  assert.throws(() => ModuleKit.cloneSerializable(cycle), /circular/);
  assert.throws(() => ModuleKit.cloneSerializable({ callback() {} }), /serializáveis/);
  assert.throws(() => ModuleKit.cloneSerializable({ missing: undefined }), /undefined/);
  assert.throws(() => ModuleKit.cloneSerializable({ price: Infinity }), /finitos/);
  assert.throws(() => ModuleKit.cloneSerializable({ date: new Date() }), /objetos simples/);
  assert.throws(() => ModuleKit.cloneSerializable([, 1]), /posições vazias/);
  let getterExecuted = false;
  const accessor = Object.defineProperty({}, "danger", {
    enumerable: true,
    get() { getterExecuted = true; return "nope"; }
  });
  assert.throws(() => ModuleKit.cloneSerializable(accessor), /getters e setters/);
  assert.equal(getterExecuted, false);
});

check("Clonagem não permite poluição do protótipo", () => {
  const hostile = JSON.parse('{"__proto__":{"polluted":true},"safe":1}');
  const copy = ModuleKit.cloneSerializable(hostile);
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(copy, "__proto__"), true);
  assert.equal(copy.safe, 1);
  assert.equal(Object.getPrototypeOf(copy), Object.prototype);
});

check("Extensões populacionais ficam isoladas no namespace do módulo", () => {
  const runtime = makeRuntime();
  let context;
  const module = ModuleKit.createModule({ id: "sociedade", version: "0.1.0", dependencies: ["core"] }, {
    start(value) { context = value; }
  });
  module.start(runtime);
  assert.equal(context.population.addExtension("1", { escolaridade: "média" }), true);
  assert.equal(runtime.population.getSnapshot().groups[0].extensions.sociedade.escolaridade, "média");
  assert.equal(context.population.addExtension("999", { escolaridade: "fundamental" }), false);
  assert.throws(() => context.population.addExtension("1", { inválida: undefined }), /undefined/);
});

check("Falha na inicialização limpa inscrições criadas parcialmente", () => {
  const runtime = makeRuntime();
  let calls = 0;
  const module = ModuleKit.createModule({ id: "sociedade", version: "0.1.0", dependencies: ["core"] }, {
    start(context) {
      context.events.on("economy:month-closed", () => { calls += 1; });
      throw new Error("falha intencional de inicialização");
    }
  });
  assert.throws(() => module.start(runtime), /falha intencional/);
  assert.equal(module.getStatus(), "failed");
  runtime.publish("economy:month-closed", { monthNumber: 1 }, "economia");
  assert.equal(calls, 0);
});

check("Contexto encerrado não permite nova escrita nem novas inscrições", () => {
  const runtime = makeRuntime();
  let context;
  const module = ModuleKit.createModule({ id: "sociedade", version: "0.1.0", dependencies: ["core"] }, {
    start(value) { context = value; }
  });
  module.start(runtime);
  module.stop();
  assert.throws(() => context.setState({ fora: true }), /não pode alterar o estado/);
  assert.throws(() => context.events.publish("fora", {}), /não pode publicar eventos/);
  assert.throws(() => context.events.on("economy:month-closed", () => {}), /não pode assinar eventos/);
  assert.throws(() => context.population.addExtension("1", { fora: true }), /não pode alterar extensões/);
});

check("Porta pública da Economia oferece leitura e eventos sem escrita financeira", () => {
  const runtime = makeRuntime();
  const port = EconomyPort.createEconomyPort(runtime);
  assert.equal(port.id, "economia");
  const economicSnapshot = port.getSnapshot();
  assert.equal(economicSnapshot.snapshot.monthNumber, 0);
  economicSnapshot.snapshot.monthNumber = 999;
  assert.equal(runtime.modules.get("economia").snapshot.monthNumber, 0);
  assert.equal(port.getPopulation().totals.total, 3);
  assert.equal(port.getClock().absoluteDay, 1);

  let monthReceived = 0;
  const unsubscribeMonth = port.onMonthClosed((event) => { monthReceived = event.payload.monthNumber; });
  runtime.publish("economy:month-closed", { monthNumber: 7 }, "economia");
  unsubscribeMonth();
  runtime.publish("economy:month-closed", { monthNumber: 8 }, "economia");
  assert.equal(monthReceived, 7);

  let syncReceived = 0;
  const unsubscribeSync = port.onWorldSynchronized((event) => { syncReceived += event.payload.reason === "test" ? 1 : 0; });
  runtime.syncFromEconomy({ day: 2, monthNumber: 1, households: [] }, "test");
  unsubscribeSync();
  assert.equal(syncReceived, 1);
  assert.equal(typeof port.setBalance, "undefined");
  assert.equal(typeof port.transfer, "undefined");
});

check("Estado inicial preserva valores falsos explicitamente informados", () => {
  const runtime = makeRuntime();
  const module = ModuleKit.createModule({ id: "module-flags", version: "0.1.0", dependencies: ["core"] }, {
    initialState: false
  });
  module.start(runtime);
  assert.equal(module.getState(), false);
});

console.log(`\nResultado modular: ${passed} aprovados; ${failed} reprovados.`);
if (failed > 0) process.exitCode = 1;
