# Arquitetura modular do Vilarejo | Núcleo Central 0.1

**Release:** 3.1.0  
**Economia:** 3.0.0 (preservada)  
**Núcleo central:** 0.1.0  
**Estado:** fundação inicial integrada; módulos de Sociedade, Política e Legislação ainda não implementados.

## 1. Objetivo

Separar responsabilidades sem criar quatro jogos independentes. O Núcleo Central oferece serviços compartilhados e contratos de comunicação. Cada módulo mantém suas próprias regras e publica fatos relevantes por eventos.

## 2. Componentes atuais

- `vilarejo_core.js`: fábrica do núcleo central, barramento de eventos, calendário, sessão, diretório populacional e registro de módulos.
- `script.js`: motor econômico legado, agora registrado como módulo `economia` e sincronizado com o núcleo. O motor ainda é monolítico nesta etapa.
- `eventos_v3.js`: motor de eventos econômicos integrado à Economia. Não deve ser confundido com o barramento geral de eventos do núcleo.
- `index.html`: carrega os scripts na ordem `vilarejo_core.js` → `eventos_v3.js` → `script.js`.

## 3. Serviços do Núcleo Central

### Calendário

O calendário usa 30 dias por mês e 12 meses por ano. O dia absoluto do motor econômico é convertido em `year`, `month`, `day` e `dayOfYear`. O núcleo também preserva `economicMonthNumber`, contador operacional usado pela Economia. Os dois campos são publicados separadamente para que módulos futuros não confundam a data do calendário com o número de fechamentos contábeis.

Eventos emitidos: `time:day-advanced`, `time:month-started` e `time:year-started`.

### Estado da partida

A sessão mantém identificador, status (`ready`, `running`, `paused` ou `game-over`), dia de início e contador de reinicializações. Eventos de sessão: `game:initialized`, `game:reset`, `game:running`, `game:paused` e `game:game-over`.

### Diretório populacional

A Economia sincroniza os grupos domiciliares existentes. O diretório central consolida adultos, crianças, população total, ocupação e felicidade média. Extensões com namespace permitem que Sociedade acrescente informações próprias sem sobrescrever os campos básicos sincronizados pela Economia.

O diretório não cria ainda cidadãos individuais nem substitui o modelo domiciliar econômico.

### Registro de módulos

Cada módulo informa identificador, versão, descrição e dependências. Dependências precisam estar registradas antes do módulo dependente. O Núcleo (`core`) é registrado automaticamente; a Economia (`economia`) é registrada na inicialização da partida.

### Barramento de eventos

O barramento publica envelopes versionados com identificador, tópico, origem, dia e payload. Inscrições podem ser canceladas. Erros de um listener são isolados e devolvidos no resultado da publicação, sem interromper outros listeners ou a simulação. O histórico é limitado a 500 eventos por padrão; contadores por tópico permanecem disponíveis durante a sessão.

## 4. Fluxo atual

1. O HTML carrega o Núcleo.
2. O motor de eventos e o motor econômico são carregados.
3. A Economia registra-se como módulo e cria a partida.
4. O estado econômico sincroniza calendário e grupos populacionais com o Núcleo.
5. Cada avanço diário atualiza a data central.
6. Cada fechamento econômico publica `economy:month-closed`, com indicadores resumidos e leitura de população.
7. Os módulos futuros poderão assinar esse evento e publicar seus próprios eventos sem alterar diretamente o estado privado da Economia.

## 5. Limites desta entrega

- Economia 3.0 foi preservada; nenhuma fórmula econômica foi reescrita para criar o Núcleo.
- A integração é inicialmente observacional: o Núcleo recebe snapshots e publica eventos, mas não altera contas, preços, salários, impostos ou produção.
- A população central é uma projeção sincronizada dos domicílios econômicos, não uma base demográfica completa.
- O motor econômico permanece concentrado em `script.js`. A extração gradual de serviços econômicos deverá ocorrer em etapas próprias, com testes de regressão.
- Sociedade, Política e Legislação ainda não existem como módulos nesta release.

## 6. Próximas etapas recomendadas

1. Extrair o estado compartilhado e os contratos de comando/leitura sem transferir regras econômicas de uma vez.
2. Criar o módulo Sociedade, começando por educação, saúde, habitação, segurança e desigualdade.
3. Definir eventos de política pública para que Política e Legislação possam solicitar alterações por comandos validados.
4. Adicionar testes de integração entre módulos e testes de salvamento/restauração do estado completo.

Consulte `docs/CONTRATO_DE_MODULOS_V1.md` antes de criar qualquer módulo novo.
