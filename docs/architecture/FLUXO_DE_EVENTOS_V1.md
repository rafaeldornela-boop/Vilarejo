# Fluxo de eventos do Vilarejo

## Fechamento mensal

```mermaid
flowchart TD
  economy[Economia] -->|sincroniza população, calendário e snapshot| core[Core Runtime]
  economy -->|economy:month-closed| society[Sociedade]
  economy -->|economy:month-closed| politics[Política]
  economy -->|economy:month-closed| services[Serviços]
  society -->|society:month-closed| politics
  politics -->|politics:month-closed| institutions[Instituições]
  politics -->|politics:group-updated| institutions
  politics -->|politics:influence-changed| institutions
  society -->|snapshot próprio| core
  politics -->|snapshot próprio| core
  institutions -->|snapshot próprio| core
  services -->|snapshots agregado + setoriais| core
  core -->|snapshots e estado público| ui[Dashboard]
  society -. reset/sincronização .-> society
  politics -. game:reset / game:initialized / world:synchronized .-> politics
  institutions -. game:reset / game:initialized .-> institutions
  services -. game:reset .-> services
```

No código, o produtor `economy:month-closed` primeiro chama `syncFromEconomy`; os módulos de domínio escutam esse evento. Sociedade então publica o fechamento social; Política produz seu fechamento e Instituições o consome. Serviços evolui por fechamento econômico. Após o despacho, a Economia chama `VilarejoDashboard.refresh()` se a interface já estiver carregada.

## Eventos de mudança de política

```mermaid
flowchart LR
  policy[Impacto de interesse] -->|politics:interest-impact| politics[Política]
  politics -->|politics:group-updated| institutions[Instituições]
  servicePolicy[Impacto de serviço] -->|services:policy-impact| services[Serviços]
  services -->|services:indicator-updated| observers[Consumidores futuros]
  lever[Alavanca local na UI] --> services
  services -->|services:policy-updated| observers
```

A interface encaminha alavancas de Serviços ao adaptador público do módulo; nenhum evento cria um lançamento no razão econômico.

## Motor de Eventos V3

`src/events/eventos_v3.js` mantém catálogo/estado próprios e exporta `EventosV3`. A Economia injeta estado e funções helper; não foram encontrados `runtime.events.on` nem `runtime.publish` dentro do motor V3. Ele não deve ser confundido com o barramento genérico do Core.

## Propriedades do barramento

O Core encapsula eventos com tópico, source, dia e payload serializável, mantém histórico limitado e isola falha de listener dos demais. As assinaturas retornam uma função para cancelar. O namespace de evento deve refletir o domínio emissor; payload deve ser simples e não conter referências circulares, funções ou elementos DOM.
