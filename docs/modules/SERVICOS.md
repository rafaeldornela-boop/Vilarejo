# Módulo Serviços públicos — `servicos` 1.0.0

**Fonte:** `src/services/vilarejo_services.js`; teste dedicado em `src/test/services_test.js`.

## Áreas e responsabilidades

Um arquivo agregado define e registra sete domínios: Saúde (`saude`), Educação (`educacao`), Segurança (`seguranca`), Ciência (`ciencia`), Desenvolvimento (`desenvolvimento`), Cultura (`cultura`) e Infraestrutura/recursos estratégicos (`infraestrutura`). Um módulo coordenador `servicos` opera o estado integrado. Os arquivos não são sete subsistemas separados.

Cada domínio mantém indicadores, alavancas, prioridades, satisfação, capacidade/pressão, histórico, status e qualidade dos dados. O módulo também modela recursos de água, eletricidade, petróleo e minerais, impactos/eventos, saneamento, capacidade pública e efeitos cruzados. Entre os indicadores estão resultados de saúde, aprendizagem, confiança pública, talento científico, produtividade, participação cultural, saneamento, confiabilidade elétrica e governança de recursos.

## Dependências e eventos

Exige os módulos Core, Economia e Sociedade registrados. Instala os sete módulos setoriais e o agregador; as relações entre áreas dentro das definições descrevem conexões conceituais, não dependências Runtime adicionais. Escuta `game:reset`, `economy:month-closed` e `services:policy-impact`. Publica `services:month-closed`, `services:indicator-updated` e `services:policy-updated`, atualizando snapshots setoriais e agregado.

Fechamento mensal é idempotente; mês anterior é rejeitado. Eventos limitam a variação do indicador e mantêm histórico limitado. O cálculo de demanda elétrica usa indicadores presentes no estado, e a atualização mensal de recursos mantém valores finitos.

## Limite fiscal essencial

Os valores iniciais são **parâmetros de cenário**, não observações reais. `assumptions.baseline` identifica essa condição e `budgetLinked` permanece `false`. Alavancas mudam os indicadores de Serviços; não debita Tesouro, não altera contas/relatório fiscal, não contrata servidores, não constrói instalações e não consome insumos econômicos. O painel explicita que custos fiscais e execução física são integração futura.

O estado inclui água, eletricidade, petróleo e minerais; os testes confirmam que petróleo é não renovável e reduz reservas com produção, e que mineração registra pressão ambiental. Não há subsistema separado de gás natural ou inventário geológico completo de reservas/extração/abastecimento. Portanto, a lista pedida para infraestrutura só está parcialmente representada por indicadores e recursos de cenário, não por cadeias produtivas completas.

Uma conexão fiscal futura precisa pedir orçamento e registrar a execução pela Economia, com lançamentos simétricos e testes de caixa/SFC; não deve modificar `S.accounts` diretamente.

## Testes

`src/test/services_test.js` cobre 23 casos: sete áreas e recursos, limites/rejeição de alavancas e eventos inválidos, evolução sem NaN, demanda elétrica, idempotência, efeitos de saneamento/educação/ciência/energia/mineração/governança, histórico/snapshot/renderização, Runtime e rejeição de registro parcial.
