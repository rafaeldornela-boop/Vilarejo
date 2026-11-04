"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createSimulationContext } = require("./simulation_context.js");

const ROOT = path.join(__dirname, "../../");
const context = createSimulationContext({ includeDomainModules: true });

for (const relativePath of [
  "src/world/vilarejo_world_engine.js",
  "src/newspaper/vilarejo_newspaper.js"
]) {
  const code = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  vm.runInContext(code, context, { filename: path.basename(relativePath), timeout: 30000 });
}

const app = context.VilarejoTest;
const runtime = context.VilarejoRuntime;
assert.ok(app && runtime, "a simulação real deve expor Economia e Core");
assert.ok(context.VilarejoWorldRuntime, "Mundo Vivo deve se registrar no Runtime real");
assert.ok(context.VilarejoNewspaperRuntime, "Jornal deve se registrar depois do Mundo Vivo");

app.resetWithSeed(42);
const eventsBefore = app.getCoreEventCount("world:month-closed");
const state = app.simulateMonths(1, false);
const world = runtime.modules.get("mundo_vivo").snapshot;
const edition = context.VilarejoNewspaper.getEdition(1);

assert.equal(state.monthNumber, 1, "Economia deve fechar o primeiro mês");
assert.equal(world.currentMonth, 1, "Mundo Vivo deve acompanhar o fechamento real");
assert.equal(app.getCoreEventCount("world:month-closed") - eventsBefore, 1, "um evento world:month-closed deve ser publicado");
assert.ok(world.milestones.some((item) => item.id === "first_close" && item.achieved), "primeiro marco deve ser conquistado");
assert.ok(edition, "Jornal deve publicar a edição do mesmo mês");
const society = edition.sections.find((section) => section.section === "Sociedade");
assert.ok(society?.facts.some((fact) => fact.includes("Primeiro ciclo concluído")), "Jornal deve registrar o marco no mesmo fechamento");

console.log("✓ Economia real → Sociedade/Política/Instituições/Serviços → Mundo Vivo → Jornal");
console.log("✓ primeiro fechamento, marco e edição factual integrados sem substituir o motor econômico");
