# Contrato de módulos do Vilarejo | v1

Este documento define o padrão mínimo obrigatório para Economia, Sociedade, Política, Legislação e futuros módulos. O objetivo é impedir dependências ocultas e escrita direta no estado interno de outro módulo.

## 1. Registro

O runtime compartilhado é `window.VilarejoRuntime`. Os arquivos dos módulos devem ser carregados depois de `script.js`, que instancia e expõe esse runtime. Um módulo registra-se uma única vez: 

```js
const runtime = window.VilarejoRuntime;

runtime.modules.register({
  id: "sociedade",
  version: "0.1.0",
  name: "Sociedade",
  dependencies: ["core", "economia"],
  description: "Indicadores e políticas sociais do Vilarejo."
});
```

Regras:

- `id` é obrigatório, único, minúsculo e estável.
- `version` é obrigatória e segue versionamento semântico.
- `dependencies` lista somente módulos realmente necessários.
- Uma dependência precisa estar registrada antes do módulo.
- Não registrar o mesmo módulo duas vezes.

## 2. Comunicação por eventos

Os módulos devem publicar fatos consumados e assinar fatos de que dependem. Exemplos de tópicos: `economy:month-closed`, `society:indicator-updated`, `policy:decision-approved` e `law:enacted`.

Assinatura:

```js
const unsubscribe = runtime.events.on("economy:month-closed", (event) => {
  const fechamento = event.payload;
  // Atualizar somente o estado privado de Sociedade.
});

// Ao desmontar ou desativar o módulo:
unsubscribe();
```

Publicação:

```js
runtime.publish("society:indicator-updated", {
  indicator: "school-attendance",
  value: 0.92,
  period: runtime.clock.snapshot().economicMonthNumber
}, "sociedade");
```

Todo evento recebe envelope com `schemaVersion`, `id`, `topic`, `source`, `day` e `payload`. O payload deve conter dados simples e serializáveis: objetos, arrays, strings, números, booleanos ou `null`. Não enviar funções, elementos DOM, timers ou referências circulares.

## 3. Estado e propriedade dos dados

- Cada módulo é dono das regras e dos dados específicos de seu domínio.
- Um módulo não pode alterar diretamente variáveis internas de outro módulo.
- Não usar `window.S`, não acessar variáveis locais de `script.js` e não editar diretamente contas da Economia.
- A leitura cruzada deve ocorrer por snapshots publicados ou por consultas públicas documentadas.
- Alterações cruzadas devem ser solicitadas por comandos/eventos e validadas pelo módulo proprietário.

O Núcleo disponibiliza `runtime.snapshot()`, `runtime.clock.snapshot()`, `runtime.population.getSnapshot()` e `runtime.modules.get(id)` para leitura.

## 4. População compartilhada

A Economia sincroniza o cadastro básico dos domicílios. Módulos sociais podem acrescentar atributos com namespace, sem sobrescrever os campos de origem: 

```js
runtime.population.addExtension("1", "sociedade", {
  escolaridade: "ensino médio",
  coberturaSaude: true
});
```

O identificador do grupo é estável dentro da partida. Não armazenar dados pessoais reais: trata-se de população fictícia do simulador.

## 5. Calendário e ciclo de vida

Use `runtime.clock.snapshot()` para ler a data. Não crie contadores de mês ou ano paralelos. O campo `economicMonthNumber` identifica o fechamento econômico; `year`, `month` e `day` identificam o calendário do jogo.

Status da sessão: `ready`, `running`, `paused` ou `game-over`. O ciclo é gerenciado pelo Núcleo e pelo controlador principal. Módulos não devem iniciar timers próprios para avançar o tempo do mundo.

## 6. Regras de integridade

1. Nenhum módulo pode atualizar diretamente o DOM pertencente a outro módulo.
2. Nenhum módulo deve depender da ordem acidental de variáveis globais.
3. Eventos devem ser idempotentes quando houver risco de reprocessamento.
4. Alterações em payloads não podem modificar o estado original do emissor.
5. Eventos não devem transportar saldos financeiros como comandos de transferência. A Economia valida e executa as operações financeiras.
6. Cada módulo precisa de testes unitários, testes de contrato e ao menos um teste de integração com o Núcleo.
7. A ausência de um módulo opcional não pode impedir o carregamento da Economia.

## 7. Compatibilidade e versão

- Mudança compatível: incremento `MINOR` do módulo ou contrato, conforme o caso.
- Correção compatível: incremento `PATCH`.
- Mudança que quebra payload, método ou semântica: incremento `MAJOR` do contrato.
- Eventos novos devem usar namespace do módulo emissor.
- Não reutilizar tópico existente com significado diferente.

## 8. O que ainda não está implementado

O contrato define como os módulos devem conversar, mas não cria automaticamente os subsistemas de Sociedade, Política ou Legislação. A execução e a validação dessas regras serão entregues em releases próprias.
