# Contrato de módulos do Vilarejo | v2

Este contrato é obrigatório para Economia, Sociedade, Política, Legislação e qualquer futuro domínio. Ele define interfaces e fronteiras de propriedade para evitar dependências ocultas e escrita direta no estado de outro módulo.

## 1. Descritor

```js
{
  id: "sociedade",
  version: "0.1.0",
  name: "Sociedade",
  description: "Indicadores e políticas sociais.",
  dependencies: ["core", "economia"]
}
```

`id` deve ser único, minúsculo e conter somente letras, números e hífens. `version` segue SemVer. Dependências devem ser únicas, não podem incluir o próprio módulo e precisam estar registradas antes de `start()`.

## 2. Criação e ciclo de vida

```js
const sociedade = VilarejoModuleKit.createModule(descriptor, implementation);
sociedade.start(window.VilarejoRuntime);
```

A implementação pode declarar:

- `initialState`: estado privado, serializável;
- `start(context)`: inicialização síncrona, podendo retornar uma função de limpeza;
- `stop(context)`: encerramento opcional.

A instância oferece `start(runtime)`, `stop()`, `getStatus()` e `getState()`. Estados: `created`, `starting`, `active`, `failed` e `stopped`. A instância pode ser reiniciada no mesmo runtime após encerramento, mas não migrada para outro runtime depois de iniciada.

## 3. Contexto permitido

O contexto fornece somente:

- `id` e `version`;
- `clock.snapshot()`;
- `population.getSnapshot()` e `population.addExtension(groupId, data)`;
- `events.on(topic, handler)` e `events.once(topic, handler)`;
- `events.publish(localName, payload)`;
- `getState()`, `setState(data)` e `worldSnapshot()`.

Não expõe `runtime`, `window.S`, variáveis locais de outro módulo, contas financeiras ou elementos do DOM. Escritas e novas inscrições feitas por um contexto depois do encerramento são recusadas.

## 4. Comunicação por eventos

Para ouvir o fechamento econômico:

```js
context.events.on("economy:month-closed", (event) => {
  const monthNumber = event.payload.monthNumber;
  context.setState({ lastEconomicMonth: monthNumber });
});
```

Para publicar um fato do próprio domínio:

```js
context.events.publish("indicator-updated", {
  indicator: "school-attendance",
  value: 0.91,
  period: context.clock.snapshot().economicMonthNumber
});
```

O tópico resultante será `sociedade:indicator-updated`, com origem `sociedade`. O módulo não pode informar outro namespace no nome local.

Payloads aceitam `null`, strings, booleanos, números finitos, arrays densos e objetos simples. Não aceitam funções, símbolos, `bigint`, `undefined`, instâncias de classes, `Date`, `Map`, `Set`, arrays esparsos ou referências circulares.

## 5. Propriedade dos dados

- Núcleo Central: calendário, sessão, registro de módulos e barramento geral.
- Economia: contas, firmas, produção, preços, folha, crédito, dívidas, tributos e balanços.
- Sociedade: indicadores e políticas sociais.
- Política: partidos, eleições, mandatos e decisões políticas.
- Legislação: normas, vigência, hierarquia e regras jurídicas.

A atribuição de domínio aos três últimos módulos é uma regra para desenvolvimento futuro, não significa que já estejam implementados.

## 6. População

A Economia sincroniza os domicílios existentes no diretório populacional. Outros módulos podem acrescentar dados no próprio namespace:

```js
context.population.addExtension("1", {
  escolaridade: "ensino médio",
  coberturaSaude: true
});
```

O núcleo não deve armazenar dados pessoais reais; a população é fictícia e pertence à simulação.

## 7. Integridade

1. Não alterar diretamente o estado interno de outro módulo.
2. Não controlar timers de passagem do tempo fora do controlador central.
3. Não atualizar o DOM de outro domínio.
4. Usar eventos namespaced e payloads serializáveis.
5. Eventos financeiros não transferem dinheiro. A Economia terá de validar e executar qualquer operação financeira por uma API de comando própria.
6. Cada módulo novo terá testes unitários, de contrato e de integração.
7. A ausência de um módulo opcional não pode impedir o carregamento da Economia.

## 8. Compatibilidade

Mudanças incompatíveis em métodos, payloads ou semântica exigem nova versão MAJOR do contrato. Novos eventos devem usar namespace do emissor. Não reutilizar um tópico com significado diferente.
