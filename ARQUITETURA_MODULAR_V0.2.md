# Vilarejo | Arquitetura Modular 0.2

**Release do projeto:** `3.2.0-alpha.1`  
**Base:** `economia-estavel`, release 3.1.0  
**Fábrica de módulos:** `0.2.1`  
**Estado:** fronteira executável implementada; Sociedade, Política e Legislação ainda não implementadas.

## 1. Objetivo

Permitir que os domínios do simulador evoluam em arquivos e ciclos de vida separados, preservando um único mundo simulado. Um módulo é dono de suas regras e de seu estado privado. A comunicação entre módulos ocorre por snapshots, eventos e, futuramente, comandos validados pelo módulo proprietário.

## 2. Componentes

- `vilarejo_core.js`: runtime central, calendário, sessão, diretório populacional e barramento geral.
- `script.js`: motor econômico legado, ainda monolítico, que registra Economia e publica os fechamentos mensais.
- `eventos_v3.js`: catálogo e motor de eventos econômicos.
- `public/modules/module_factory.js`: fábrica de módulos, validação de contratos, contexto restrito e ciclo de vida.
- `public/modules/economia/index.js`: porta somente de leitura da Economia.
- `tests/modular_architecture.test.js`: testes de unidade e contrato da nova camada.

## 3. Ordem de carregamento

A página mantém a ordem original e acrescenta os novos arquivos depois do motor econômico:

1. `vilarejo_core.js`
2. `eventos_v3.js`
3. `script.js`
4. `public/modules/module_factory.js`
5. `public/modules/economia/index.js`

A ordem é necessária porque `script.js` instancia `window.VilarejoRuntime` e registra o módulo `economia`. Depois, a fábrica e a porta de leitura são carregadas.

## 4. Fronteiras de propriedade

| Domínio | Responsável |
|---|---|
| Calendário, sessão e eventos gerais | Núcleo Central |
| Contas, firmas, produção, preços, salários, crédito, dívidas e tributos | Economia |
| Indicadores, cadastro e políticas sociais | Sociedade, futuramente |
| Partidos, eleições, mandatos e decisões políticas | Política, futuramente |
| Normas, hierarquia, vigência e regras jurídicas | Legislação, futuramente |

Nenhum módulo novo deve ler variáveis locais de `script.js`, usar `window.S`, alterar contas econômicas diretamente ou controlar o timer geral do jogo.

## 5. Fábrica de módulos

`window.VilarejoModuleKit.createModule(descriptor, implementation)` cria uma instância isolada. O descritor contém `id`, `version`, `name`, `description` e `dependencies`.

A implementação pode declarar `initialState`, `start(context)` e `stop(context)`. Os estados do ciclo de vida são `created`, `starting`, `active`, `failed` e `stopped`. Uma instância encerrada pode ser iniciada novamente no mesmo runtime; as inscrições da execução anterior já terão sido removidas.

O contexto oferece:

- `clock.snapshot()` e `population.getSnapshot()` para leitura por cópia;
- `population.addExtension(groupId, data)` para gravar dados no namespace do módulo;
- `events.on(topic, listener)` e `events.once(topic, listener)` para ouvir tópicos namespaced;
- `events.publish(localName, payload)` para publicar apenas no namespace do próprio módulo;
- `getState()`, `setState(data)` e `worldSnapshot()`.

O contexto não entrega a referência bruta ao runtime. Payloads aceitam somente dados simples serializáveis, com números finitos; funções, `undefined`, `Symbol`, instâncias de classes, `Map`, `Set`, arrays esparsos e referências circulares são recusados.

## 6. Porta pública da Economia

`window.VilarejoEconomiaPort` oferece:

- `getSnapshot()`;
- `getPopulation()`;
- `getClock()`;
- `onMonthClosed(listener)`;
- `onWorldSynchronized(listener)`.

A porta é somente de leitura. Ela não contém operações para transferir dinheiro, alterar saldos, tributos, salários, produção, preços, dívida ou políticas.

## 7. Eventos e idempotência

O módulo publica nomes locais, por exemplo `indicator-updated`. A fábrica converte isso em `sociedade:indicator-updated`, preenchendo a origem com `sociedade`. O módulo pode assinar tópicos de outros domínios, por exemplo `economy:month-closed`.

Eventos devem representar fatos ocorridos, não solicitações de transferência financeira. Operações que alterem outro domínio precisarão de um comando explícito e validado pelo módulo proprietário, ainda não implementado nesta versão.

## 8. Validação

`npm run build` valida a sintaxe de todos os arquivos principais e modulares. `npm test` executa a suíte econômica existente, os testes de integração e a suíte modular. O GitHub Actions repete os mesmos comandos em push e pull request.

## 9. Limites desta entrega

- Economia 3.0 e suas fórmulas não foram reescritas.
- `script.js` ainda é monolítico; extração gradual é a próxima frente técnica.
- Não existe módulo funcional de Sociedade, Política ou Legislação.
- Não existe uma API pública de comandos econômicos.
- O estado completo da partida ainda não é persistido em armazenamento.
