# Módulo Core — `core` 0.1.0

**Fonte:** `src/core/vilarejo_core.js`. O Core constrói o Runtime compartilhado; não substitui a Economia e não contém regras fiscais.

## Responsabilidades e estado

O Runtime agrupa barramento de eventos, calendário, sessão, registro de módulos, diretório populacional, snapshots e metadados do jogo. O calendário padrão é 30 dias por mês × 12 meses por ano e oferece dia absoluto, ano, mês, dia, dia do ano, índice do mês e mês econômico.

O diretório consolida grupos de domicílios com população/adultos/crianças/emprego e felicidade média, registra o dia da última sincronização e guarda extensões por namespace. Um registro de Runtime mantém `id`, versão, nome, descrição, dependências, sequência e status; snapshots de cada domínio são separados.

## Dependências e API

Core não importa outros módulos. O descriptor `core` não declara dependências. O arquivo fornece fábrica de Runtime, `modules.register/get/has/updateSnapshot`, relógio, população, `publish`, assinaturas do barramento, transição/reset de sessão e `snapshot()` agregado. A Economia sincroniza grupos e campos do jogo; o Core só atualiza o snapshot do módulo `economia` se esse ID já estiver registrado.

## Eventos

Publica eventos de calendário (`time:day-advanced`, `time:month-started`, `time:year-started`), população (`population:synchronized`, `population:extension-updated`), módulos (`module:registered`, `module:state-updated`), sessão (`game:ready`, `game:running`, `game:paused`, `game:game-over`, `game:reset`) e mundo (`world:synchronized`). Também aceita tópico de domínio enviado por `runtime.publish(topic, payload, source)`.

O Core não instala listeners internos para esses tópicos: um evento publicado só tem efeito downstream quando um módulo se inscreve. Os envelopes contêm ID sequencial, tópico, origem, dia, sequência e payload. Histórico é configurável e limitado a 500 por padrão; erros de listener não interrompem outros listeners.

## Integridade e limites

A população rejeita IDs ausentes/duplicados após normalização antes de substituir snapshot, e permite namespaced extensions sem apagar campos de origem. Payloads/snapshots são copiados por JSON, portanto devem ser serializáveis e sem referência circular. Reset recria/limpa a partida e seus snapshots, mas não redefine todos os listeners/contadores/registro do Runtime. `maxEventHistory: 0` cai no padrão por causa do fallback `|| 500`.

## Testes

`src/test/test_runner.js` cobre registro, calendário, publicação, cancelamento de subscription, isolamento de listener com erro, normalização e duplicatas de ID sem mutação parcial, extensões populacionais e reset.
