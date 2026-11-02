"use strict";

const assert = require("node:assert/strict");
const Core = require("../core/vilarejo_core.js");
const Society = require("../society/vilarejo_society.js");
const Politics = require("../politics/vilarejo_politics.js");
const Institutions = require("../institutions/vilarejo_institutions.js");
const Services = require("../services/vilarejo_services.js");

const runtime = Core.createRuntime({ calendar: { daysPerMonth: 30, monthsPerYear: 12 } });
runtime.modules.register({ id: "economia", version: "3.0.0", name: "Economia", dependencies: ["core"] });
runtime.clock.reset(149, 0);
const households = [
  { id: "1", name: "Família Silva", type: "family", adults: 2, children: 1, jobs: 1, happiness: 60 },
  { id: "migrant-1", name: "Migrante migrant-1", type: "single", migrant: true, adults: 1, children: 0, jobs: 0, happiness: 55 }
];
runtime.population.syncFromEconomy(households, 149);
const society = Society.registerWithRuntime(runtime, { seed: 2026 });
const politics = Politics.registerWithRuntime(runtime, { seed: 2026, societyState: society.state });
const institutions = Institutions.registerWithRuntime(runtime, { seed: 2026 });
const services = Services.registerWithRuntime(runtime, { seed: 2026 });

for (const id of ["core", "economia", "sociedade", "politica", "instituicoes", "saude", "educacao", "seguranca", "ciencia", "desenvolvimento", "cultura", "infraestrutura", "servicos"]) {
  assert.equal(runtime.modules.has(id), true, `módulo ${id} registrado`);
}
assert.equal(Society.getDemographicSnapshot(society.state).foreignBorn, 1, "marcador migratório chega à Sociedade");

const counts = { society: 0, politics: 0, institutions: 0, services: 0 };
runtime.events.on("society:month-closed", () => { counts.society += 1; });
runtime.events.on("politics:month-closed", () => { counts.politics += 1; });
runtime.events.on("institutions:month-closed", () => { counts.institutions += 1; });
runtime.events.on("services:month-closed", () => { counts.services += 1; });

const close = { monthNumber: 1, day: 179, fiscalResult: 0 };
runtime.publish("economy:month-closed", close, "economia");
runtime.publish("economy:month-closed", close, "economia");
assert.deepEqual(counts, { society: 1, politics: 1, institutions: 1, services: 1 }, "uma reentrega do fechamento não duplica avanços");
assert.equal(society.state.currentMonth, 1);
assert.equal(politics.state.currentMonth, 1);
assert.equal(institutions.state.currentMonth, 1);
assert.equal(services.state.currentMonth, 1);
for (const id of ["sociedade", "politica", "instituicoes", "servicos"]) {
  assert.ok(runtime.modules.get(id).snapshot, `snapshot de ${id} publicado`);
}

runtime.session.reset({ day: 149 });
runtime.syncFromEconomy({ day: 149, monthNumber: 0, households }, "new-game");
runtime.publish("game:initialized", { day: 149 }, "economia");
assert.equal(society.state.currentMonth, 0);
assert.equal(politics.state.currentMonth, 0);
assert.equal(institutions.state.currentMonth, 0);
assert.equal(services.state.currentMonth, 0);
assert.equal(Society.getDemographicSnapshot(society.state).foreignBorn, 1);

for (const adapter of [society, politics, institutions, services]) adapter.dispose();
console.log("✓ integração real do Runtime: registro, snapshots, marcador migratório, fechamento idempotente e reset");
