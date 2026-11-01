# Vilarejo | Economia 3.0

Simulador econômico didático de pequena escala. O cenário reúne famílias, trabalhadores, empresas, fazenda estatal ou privada, Tesouro, banco, proprietário de imóveis e setor externo. O motor acompanha produção, consumo, salários, tributos, crédito, dívidas, estoques, investimento, patrimônio, eventos e contas nacionais simplificadas.

A versão 3.0 consolida o ciclo operacional multissetorial, a apuração por empresa, o cálculo de capital de giro sazonal da fazenda, o serviço de dívidas no planejamento de liquidez e a integração do motor de eventos à partida principal.

## Executar

Requisitos: Node.js 18 ou superior.

```bash
npm start
```

Acesse `http://localhost:3000`. A porta e o endereço de escuta podem ser definidos pelas variáveis `PORT` e `HOST`:

```bash
PORT=3001 HOST=127.0.0.1 npm start
```

Também é possível abrir `index.html` diretamente no navegador. O servidor utiliza módulos nativos do Node.js. Não é necessário executar `npm install`. O arquivo `.env.example` documenta as variáveis, mas o servidor não carrega arquivos `.env` automaticamente.

## Verificar e testar

```bash
npm run build
npm test
```

`npm run build` verifica a sintaxe dos quatro arquivos JavaScript principais. `npm test` executa 76 verificações automatizadas, sem dependências npm externas:

- 61 testes internos do motor econômico e bancário;
- verificações estruturais do HTML e da ordem de carregamento dos scripts;
- simulações de 6, 120 e 240 meses, além de um stress test de 120 meses;
- teste de robustez com 24 sementes distintas, cada uma por 240 meses (5.760 meses-simulação);
- integração, sincronização, determinismo e persistência do motor de eventos.

O executor cria um DOM mínimo de teste para carregar a aplicação, sem depender de `jsdom`. O teste HTTP local também foi validado para `/`, `/script.js` e `/eventos_v3.js`; os arquivos internos de documentação e configuração não são publicados pela raiz do servidor.

## Estrutura

- `index.html`: interface do simulador.
- `script.js`: motor econômico principal e ciclo da simulação.
- `eventos_v3.js`: catálogo e motor de eventos integrado à partida.
- `server.js`: servidor HTTP estático seguro, feito com módulos nativos.
- `test_runner.js`: executor das verificações automatizadas.
- `docs/`: documentação atual e histórico de versões anteriores.

### Capital de giro da fazenda

Antes da liquidação mensal, o motor estima a necessidade operacional da fazenda. A reserva considera folha e encargos patronais, obrigações trabalhistas e tributárias em atraso, moradia fornecida pelo empregador, insumos previstos para a próxima etapa de colheita e serviço programado da dívida bancária. O Tesouro cobre somente a diferença entre a reserva calculada e o caixa disponível da fazenda, respeitando o teto de política e o saldo efetivo do próprio Tesouro.

O teto mensal padrão é de R$ 25.000 e pode ser ajustado na interface entre R$ 0 e R$ 30.000. Isso não significa que o Tesouro transfira automaticamente o teto inteiro: o aporte é limitado à necessidade de caixa identificada e à liquidez fiscal disponível. A política representa uma regra explícita de capitalização operacional, não receita produtiva nem dinheiro criado fora da contabilidade.

### Eventos integrados

`eventos_v3.js` é carregado antes de `script.js`. O calendário de eventos avança junto com o mês econômico. Os modificadores de produção, preço e custo afetam o ciclo agrícola; eventos com decisões exibem opções na interface. Custos e transferências são refletidos nas contas envolvidas e no livro-caixa. Eventos de natureza governamental movimentam o Tesouro; outros efeitos são classificados conforme sua categoria.

O catálogo contém 30 eventos. Nem toda dimensão social ou institucional do catálogo é um subsistema completo: alguns efeitos alteram variáveis e decisões existentes, enquanto os módulos próprios de Sociedade, Política e Legislação continuam fora desta entrega.

### Contas nacionais e resultado fiscal

O simulador apresenta as óticas da produção, da renda e da despesa, além do resultado fiscal primário e nominal. A reconciliação do PIB é uma identidade interna do modelo, com tolerância de arredondamento de um centavo. O excedente operacional bruto é obtido como parcela residual para fechar a ótica da renda; portanto, não é uma mensuração independente.

O resultado primário exclui alienações de ativos. O resultado nominal incorpora a despesa líquida de juros registrada para o Tesouro.

## Resultado da validação 3.0

- `npm run build`: aprovado.
- `npm test`: 76 verificações aprovadas, 0 reprovadas.
- 24 sementes × 240 meses: 5.760 meses-simulação concluídos sem fim de jogo, divergência de caixa, falha SFC ou quebra da reconciliação interna do PIB.
- Semente padrão: 240 meses naturais concluídos sem condição de fim de jogo.
- Teste HTTP: página e scripts principais servidos com HTTP 200; arquivos ocultos e documentação bloqueados.

O relatório detalhado está em [`docs/RELATORIO_ECONOMIA_V3.0.md`](docs/RELATORIO_ECONOMIA_V3.0.md).

## Limitações conhecidas

- É um modelo didático simplificado, com poucos agentes e setores. Não é previsão econômica, recomendação de política pública nem reprodução integral da economia brasileira.
- As contas nacionais são calculadas sobre as transações representadas no jogo. A reconciliação não certifica aderência integral ao Sistema de Contas Nacionais do IBGE.
- O excedente operacional bruto é residual na ótica da renda, conforme explicado acima.
- `script.js` continua concentrando o motor econômico em um arquivo. A modularização foi adiada para reduzir risco de regressão durante a estabilização; deve ser feita em etapa própria, com testes de contrato.
- Os eventos modificam variáveis e transações já representadas no simulador. Não substituem um modelo social, político ou jurídico completo.
- Os resultados de robustez valem para os parâmetros e as sementes cobertos pela suíte automatizada. Não provam equilíbrio para toda configuração possível ou toda sequência de decisões humanas.

## Histórico

Os prospectos e relatórios anteriores foram preservados em `docs/historico/`. Para entender a lógica atual, consulte [`docs/LOGICA_DA_ECONOMIA_BASE.md`](docs/LOGICA_DA_ECONOMIA_BASE.md) e o relatório da versão 3.0.
