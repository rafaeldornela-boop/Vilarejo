(function attachVilarejoEconomyPort(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.VilarejoRuntime) {
    root.VilarejoEconomiaPort = api.createEconomyPort(root.VilarejoRuntime);
  }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null), function createEconomyPortFactory() {
  "use strict";

  function clone(value) {
    if (value === undefined || value === null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function createEconomyPort(runtime) {
    if (!runtime || !runtime.modules || !runtime.events || !runtime.clock || !runtime.population) {
      throw new TypeError("O runtime do Vilarejo não oferece os serviços necessários à porta da Economia.");
    }
    if (!runtime.modules.has("economia")) {
      throw new Error("O módulo Economia precisa estar registrado antes da criação da porta pública.");
    }

    return Object.freeze({
      id: "economia",
      version: "0.1.0",
      getSnapshot() {
        return clone(runtime.modules.get("economia"));
      },
      getPopulation() {
        return clone(runtime.population.getSnapshot());
      },
      getClock() {
        return clone(runtime.clock.snapshot());
      },
      onMonthClosed(listener) {
        if (typeof listener !== "function") throw new TypeError("O listener do fechamento mensal precisa ser uma função.");
        return runtime.events.on("economy:month-closed", (event) => listener(clone(event)));
      },
      onWorldSynchronized(listener) {
        if (typeof listener !== "function") throw new TypeError("O listener de sincronização precisa ser uma função.");
        return runtime.events.on("world:synchronized", (event) => listener(clone(event)));
      }
    });
  }

  return Object.freeze({ createEconomyPort });
});
