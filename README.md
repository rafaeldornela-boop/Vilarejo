# Vilarejo | Release 3.1.0

Simulador econômico didático com a Economia 3.0 preservada e a primeira versão executável do Núcleo Central modular.

A Economia mantém famílias, trabalhadores, empresas, fazenda estatal ou privada, Tesouro, banco, proprietário de imóveis e setor externo. O motor acompanha produção, consumo, salários, tributos, crédito, dívidas, estoques, investimento, patrimônio, eventos e contas nacionais simplificadas.

O Núcleo Central acrescenta calendário compartilhado, estado da partida, diretório populacional, registro de módulos e barramento de eventos. Nesta release ele acompanha a Economia, mas não altera os cálculos econômicos.

## Executar

Requisitos: Node.js 18 ou superior.

```bash
npm start
```

Acesse `http://localhost:3000`. A porta e o endereço de escuta podem ser definidos por `PORT` e `HOST`. Também é possível abrir `index.html` diretamente no navegador. O servidor usa módulos nativos do Node.js; não é necessário executar `npm install`.

## Verificar e testar

```bash
npm run build
npm test
```

A suíte atual executa **92 verificações automatizadas**, sem dependências npm externas:

- 61 testes internos do motor econômico e bancário;
- 8 testes diretos do Núcleo Central;
- verificações estruturais de HTML, ordem de carregamento e servidor;
- simulações econômicas de 6, 120 e 240 meses, stress test de 120 meses e robustez com 24 sementes × 240 meses (5.760 meses-simulação);
- testes integrados de registro do módulo Economia, sincronização populacional e publicação dos fechamentos mensais;
- testes do motor de eventos: determinismo, serialização e catálogo.

O executor usa um DOM mínimo de teste, sem `jsdom`.

## Estrutura principal

- `index.html`: interface e ordem de carregamento.
- `vilarejo_core.js`: Núcleo Central 0.1.
- `script.js`: motor econômico 3.0 e adaptador para o Núcleo. O arquivo continua monolítico nesta etapa.
- `eventos_v3.js`: catálogo e motor de eventos econômicos.
- `server.js`: servidor HTTP estático com allowlist explícita.
- `test_runner.js`: executor das verificações.
- `docs/`: documentação, contratos e histórico.

## Como funciona o Núcleo Central

A página carrega os scripts nesta ordem: `vilarejo_core.js` → `eventos_v3.js` → `script.js`. O runtime compartilhado fica disponível como `window.VilarejoRuntime` depois do carregamento de `script.js`; os arquivos dos módulos futuros devem entrar depois dele na página. A Economia registra-se como módulo `economia` e sincroniza seu dia, contador de fechamento mensal, estado da partida e grupos domiciliares.

Serviços públicos atuais:

- `runtime.clock.snapshot()`: calendário do jogo;
- `runtime.population.getSnapshot()`: totais e grupos populacionais;
- `runtime.modules.register(...)`: registro e validação de dependências;
- `runtime.modules.get(id)` e `runtime.modules.list()`: leitura do registro de módulos;
- `runtime.events.on(topic, listener)`: inscrição em eventos;
- `runtime.publish(topic, payload, source)`: publicação de eventos;
- `runtime.snapshot()`: visão consolidada de sessão, calendário, população, módulos e eventos recentes.

A Economia publica `economy:month-closed` após cada fechamento contábil. Os demais módulos devem comunicar-se por eventos e respeitar a propriedade dos dados. Não devem alterar diretamente variáveis internas de outro módulo.

Leia [`docs/ARQUITETURA_MODULAR_V0.1.md`](docs/ARQUITETURA_MODULAR_V0.1.md) e, obrigatoriamente, [`docs/CONTRATO_DE_MODULOS_V1.md`](docs/CONTRATO_DE_MODULOS_V1.md) antes de desenvolver Sociedade, Política ou Legislação.

## Economia 3.0 preservada

A versão 3.0 estabilizou o capital de giro sazonal da fazenda, incluindo folha, encargos, moradia, insumos da próxima etapa e serviço programado da dívida. O aporte do Tesouro cobre somente a diferença entre a reserva operacional e o caixa disponível, limitado pelo teto de política e pela liquidez fiscal.

O motor de eventos contém 30 eventos. Seus efeitos e transações continuam integrados à Economia. As contas nacionais são simplificadas e reconciliadas internamente; não representam estatísticas oficiais. O excedente operacional bruto é residual na ótica da renda.

Relatório econômico original: [`docs/RELATORIO_ECONOMIA_V3.0.md`](docs/RELATORIO_ECONOMIA_V3.0.md).

## Resultado da validação da release 3.1.0

- `npm run build`: aprovado.
- `npm test`: 92 verificações aprovadas, 0 reprovadas.
- Economia 3.0: 61 testes internos e 5.760 meses-simulação de robustez mantidos.
- Núcleo Central 0.1: calendário, população, sessão, registro de módulos e barramento testados.
- Integração Economia/Núcleo: registro, população e fechamento mensal verificados.

Relatório da release: [`docs/RELEASE_ECONOMIA_3_0_E_NUCLEO_0_1.md`](docs/RELEASE_ECONOMIA_3_0_E_NUCLEO_0_1.md).

## Limitações conhecidas

- O modelo econômico é didático, com poucos agentes e setores; não é previsão econômica nem reprodução integral da economia brasileira.
- O Núcleo observa e coordena o estado existente; ainda não é o dono de todo o estado do mundo.
- O diretório populacional é sincronizado a partir dos domicílios econômicos; ainda não há cadastro individual de cidadãos.
- `script.js` continua monolítico. A separação interna da Economia deverá ocorrer gradualmente, com testes de regressão.
- Sociedade, Política e Legislação ainda não foram implementados.
- Não existe ainda salvamento e restauração completos de uma partida.

## Branches sugeridas

- `economia-estavel`: preservar a versão pura da Economia 3.0.
- `arquitetura-modular`: partir da `economia-estavel` e adicionar a fundação modular desta release 3.1.0.
