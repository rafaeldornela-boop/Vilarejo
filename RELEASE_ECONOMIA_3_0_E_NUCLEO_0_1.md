# Release 3.1.0 | Economia 3.0 + Núcleo Central 0.1

## Escopo

Esta release preserva o motor econômico 3.0 e acrescenta a primeira camada executável de arquitetura modular.

## Incluído

- Preservação integral do motor de Economia 3.0 e do catálogo de 30 eventos.
- Núcleo compartilhado em `vilarejo_core.js`.
- Calendário de 30 dias por mês e 12 meses por ano.
- Gestão central do status da partida.
- Diretório populacional sincronizado com os domicílios econômicos.
- Registro de módulos com verificação de dependências.
- Barramento de eventos versionado, com histórico limitado e contadores por tópico.
- Publicação de `economy:month-closed` ao fim de cada ciclo econômico.
- Testes unitários do Núcleo e testes de integração com Economia.

## Validação

- `npm run build`: aprovado.
- `npm test`: 92 verificações aprovadas, 0 reprovadas.
- Testes econômicos anteriores mantidos: 61 testes internos e 5.760 meses-simulação nas 24 sementes de robustez.
- Testes do núcleo: calendário, registro e dependências de módulos, barramento, cancelamento de listeners, sincronização populacional, isolamento de erro e limpeza de sessão.
- Testes integrados: registro da Economia, população compartilhada e três eventos de fechamento mensal.

## O que esta release não faz

- Não cria ainda o módulo Sociedade, Política ou Legislação.
- Não converte o motor econômico monolítico em vários arquivos.
- Não altera cálculos, preços, tributos, salários ou regras de produção da Economia 3.0.
- Não oferece ainda salvamento completo de partidas.

## Arquivos principais

- `vilarejo_core.js`: núcleo central.
- `script.js`: Economia 3.0 com adaptador para o Núcleo.
- `eventos_v3.js`: eventos econômicos.
- `index.html`: ordem de carregamento.
- `server.js`: allowlist de arquivos estáticos atualizada.
- `test_runner.js`: 92 verificações automatizadas.
- `docs/ARQUITETURA_MODULAR_V0.1.md`: visão da arquitetura.
- `docs/CONTRATO_DE_MODULOS_V1.md`: padrão obrigatório para módulos futuros.
