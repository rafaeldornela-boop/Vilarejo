(function attachVilarejoModuleKit(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.VilarejoModuleKit = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null), function createModuleKit() {
  "use strict";

  const KIT_VERSION = "0.2.1";
  const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
  const ID_PATTERN = /^[a-z][a-z0-9-]*$/;
  const TOPIC_PATTERN = /^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/;
  const LOCAL_EVENT_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

  function assert(condition, message, ErrorType = TypeError) {
    if (!condition) throw new ErrorType(message);
  }

  function cloneSerializable(value, label = "valor", ancestors = new Set()) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") {
      assert(Number.isFinite(value), `${label}: números precisam ser finitos.`);
      return value;
    }

    assert(typeof value === "object", `${label}: somente dados serializáveis são permitidos.`);
    assert(!ancestors.has(value), `${label}: referência circular não é permitida.`);

    if (Array.isArray(value)) {
      ancestors.add(value);
      const result = [];
      for (let index = 0; index < value.length; index += 1) {
        assert(Object.prototype.hasOwnProperty.call(value, index), `${label}[${index}]: arrays não podem conter posições vazias.`);
        result.push(cloneSerializable(value[index], `${label}[${index}]`, ancestors));
      }
      ancestors.delete(value);
      return result;
    }

    const prototype = Object.getPrototypeOf(value);
    assert(prototype === Object.prototype || prototype === null,
      `${label}: use objetos simples, sem classes, Map ou Set.`);
    assert(Object.getOwnPropertySymbols(value).length === 0,
      `${label}: propriedades Symbol não são permitidas.`);

    ancestors.add(value);
    const result = {};
    for (const key of Object.keys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      assert(descriptor && Object.prototype.hasOwnProperty.call(descriptor, "value"),
        `${label}.${key}: getters e setters não são permitidos.`);
      const item = descriptor.value;
      assert(item !== undefined, `${label}.${key}: undefined não é permitido.`);
      Object.defineProperty(result, key, {
        value: cloneSerializable(item, `${label}.${key}`, ancestors),
        enumerable: true,
        configurable: true,
        writable: true
      });
    }
    ancestors.delete(value);
    return result;
  }

  function normalizeDescriptor(input) {
    assert(input && typeof input === "object" && !Array.isArray(input),
      "O descritor do módulo precisa ser um objeto.");

    const id = String(input.id || "").trim();
    const version = String(input.version || "").trim();
    assert(ID_PATTERN.test(id),
      "O identificador precisa ser minúsculo e conter apenas letras, números e hífens.");
    assert(SEMVER_PATTERN.test(version),
      `Versão inválida para o módulo '${id}'. Use versionamento semântico.`);
    assert(input.dependencies === undefined || Array.isArray(input.dependencies),
      `As dependências do módulo '${id}' precisam ser uma lista.`);

    const dependencies = (input.dependencies || []).map((item) => String(item).trim());
    assert(dependencies.every((item) => ID_PATTERN.test(item)),
      `Dependência inválida no módulo '${id}'.`);
    assert(new Set(dependencies).size === dependencies.length,
      `O módulo '${id}' contém dependências duplicadas.`);
    assert(!dependencies.includes(id), `O módulo '${id}' não pode depender de si mesmo.`);

    return Object.freeze({
      id,
      version,
      name: String(input.name || id),
      description: String(input.description || ""),
      dependencies: Object.freeze(dependencies.slice())
    });
  }

  function createModule(descriptorInput, implementation = {}) {
    const descriptor = normalizeDescriptor(descriptorInput);
    assert(implementation && typeof implementation === "object" && !Array.isArray(implementation),
      "A implementação do módulo precisa ser um objeto.");
    assert(implementation.start === undefined || typeof implementation.start === "function",
      "implementation.start precisa ser uma função.");
    assert(implementation.stop === undefined || typeof implementation.stop === "function",
      "implementation.stop precisa ser uma função.");

    let status = "created";
    let runtimeRef = null;
    let registeredHere = false;
    let state = cloneSerializable(
      implementation.initialState === undefined ? {} : implementation.initialState,
      "estado inicial"
    );
    let context = null;
    let cleanupHandlers = [];
    const stopHook = implementation.stop || null;

    function assertUsable(action) {
      assert(status === "starting" || status === "active",
        `O módulo '${descriptor.id}' não pode ${action} no estado '${status}'.`, Error);
    }

    function updateRuntimeSnapshot() {
      if (!runtimeRef || !registeredHere) return;
      runtimeRef.modules.updateSnapshot(descriptor.id, {
        lifecycle: status,
        moduleVersion: descriptor.version,
        state: cloneSerializable(state, "estado do módulo")
      }, descriptor.id);
    }

    function addCleanup(cleanup) {
      if (typeof cleanup !== "function") return cleanup;
      let active = true;
      const wrapped = () => {
        if (!active) return;
        active = false;
        cleanup();
      };
      cleanupHandlers.push(wrapped);
      return wrapped;
    }

    function buildContext() {
      const clock = Object.freeze({
        snapshot: () => cloneSerializable(runtimeRef.clock.snapshot(), "calendário")
      });

      const population = Object.freeze({
        getSnapshot: () => cloneSerializable(runtimeRef.population.getSnapshot(), "população"),
        addExtension(groupId, data) {
          assertUsable("alterar extensões populacionais");
          return runtimeRef.population.addExtension(
            String(groupId), descriptor.id, cloneSerializable(data, "extensão populacional")
          );
        }
      });

      const events = Object.freeze({
        on(topic, listener) {
          assertUsable("assinar eventos");
          assert(typeof topic === "string" && TOPIC_PATTERN.test(topic),
            "O tópico assinado precisa usar namespace, por exemplo economy:month-closed.");
          assert(typeof listener === "function", "O listener precisa ser uma função.");
          const unsubscribe = runtimeRef.events.on(topic, (event) =>
            listener(cloneSerializable(event, "evento recebido"))
          );
          return addCleanup(unsubscribe);
        },
        once(topic, listener) {
          assertUsable("assinar eventos");
          assert(typeof topic === "string" && TOPIC_PATTERN.test(topic),
            "O tópico assinado precisa usar namespace, por exemplo economy:month-closed.");
          assert(typeof listener === "function", "O listener precisa ser uma função.");
          let unsubscribe = null;
          const wrapped = (event) => {
            if (unsubscribe) unsubscribe();
            listener(cloneSerializable(event, "evento recebido"));
          };
          unsubscribe = events.on(topic, wrapped);
          return unsubscribe;
        },
        publish(localName, payload = {}) {
          assertUsable("publicar eventos");
          const suffix = String(localName || "").trim();
          assert(LOCAL_EVENT_PATTERN.test(suffix),
            "Informe somente o nome local do evento, sem namespace.");
          const safePayload = cloneSerializable(payload, "payload publicado");
          return runtimeRef.publish(`${descriptor.id}:${suffix}`, safePayload, descriptor.id);
        }
      });

      return Object.freeze({
        id: descriptor.id,
        version: descriptor.version,
        clock,
        population,
        events,
        getState: () => cloneSerializable(state, "estado do módulo"),
        setState(nextState) {
          assertUsable("alterar o estado");
          state = cloneSerializable(nextState, "novo estado do módulo");
          updateRuntimeSnapshot();
          return cloneSerializable(state, "estado do módulo");
        },
        worldSnapshot: () => cloneSerializable(runtimeRef.snapshot(), "snapshot do mundo")
      });
    }

    function start(runtime) {
      assert(runtime && runtime.modules && runtime.events && runtime.clock && runtime.population &&
        typeof runtime.publish === "function" && typeof runtime.snapshot === "function",
      `Runtime inválido ao iniciar '${descriptor.id}'.`);
      assert(typeof runtime.modules.has === "function" &&
        typeof runtime.modules.register === "function" &&
        typeof runtime.modules.get === "function" &&
        typeof runtime.modules.updateSnapshot === "function",
      `Registro de módulos inválido ao iniciar '${descriptor.id}'.`);
      assert(typeof runtime.events.on === "function" &&
        typeof runtime.population.getSnapshot === "function" &&
        typeof runtime.population.addExtension === "function" &&
        typeof runtime.clock.snapshot === "function",
      `Serviços do runtime incompletos ao iniciar '${descriptor.id}'.`);

      assert(status !== "active" && status !== "starting",
        `O módulo '${descriptor.id}' já está iniciado.`, Error);
      if (runtimeRef && runtimeRef !== runtime) {
        assert(status === "created",
          `O módulo '${descriptor.id}' não pode migrar entre runtimes depois de iniciado.`, Error);
      }
      runtimeRef = runtime;

      for (const dependency of descriptor.dependencies) {
        assert(runtime.modules.has(dependency),
          `Dependência ausente para '${descriptor.id}': '${dependency}'.`, Error);
      }

      if (!registeredHere) {
        assert(!runtime.modules.has(descriptor.id),
          `O módulo '${descriptor.id}' já está registrado no runtime.`, Error);
        runtime.modules.register(descriptor);
        registeredHere = true;
      } else {
        const registered = runtime.modules.get(descriptor.id);
        assert(registered && registered.version === descriptor.version,
          `O registro existente de '${descriptor.id}' é incompatível.`, Error);
      }

      status = "starting";
      cleanupHandlers = [];
      context = buildContext();
      updateRuntimeSnapshot();
      try {
        const cleanup = implementation.start ? implementation.start(context) : null;
        if (typeof cleanup === "function") addCleanup(cleanup);
        status = "active";
        updateRuntimeSnapshot();
        return api;
      } catch (error) {
        for (const cleanup of cleanupHandlers.slice().reverse()) {
          try { cleanup(); } catch { /* preserva o erro original */ }
        }
        cleanupHandlers = [];
        status = "failed";
        updateRuntimeSnapshot();
        throw error;
      }
    }

    function stop() {
      if (status !== "active" && status !== "failed") return false;
      const errors = [];
      if (stopHook && context) {
        try { stopHook(context); } catch (error) { errors.push(error); }
      }
      for (const cleanup of cleanupHandlers.slice().reverse()) {
        try { cleanup(); } catch (error) { errors.push(error); }
      }
      cleanupHandlers = [];
      status = errors.length ? "failed" : "stopped";
      updateRuntimeSnapshot();
      if (errors.length) throw new AggregateError(errors, `Falha ao encerrar o módulo '${descriptor.id}'.`);
      return true;
    }

    const api = Object.freeze({
      descriptor,
      start,
      stop,
      getStatus: () => status,
      getState: () => cloneSerializable(state, "estado do módulo")
    });

    return api;
  }

  return Object.freeze({
    version: KIT_VERSION,
    createModule,
    normalizeDescriptor,
    cloneSerializable
  });
});
