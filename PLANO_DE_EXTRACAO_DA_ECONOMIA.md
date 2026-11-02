# Plano de extração gradual da Economia

## Objetivo

Reduzir o monólito `script.js` sem reescrever o motor inteiro nem alterar as regras econômicas de uma só vez. A arquitetura modular 0.2 cria o trilho; a extração precisa ser incremental, com compatibilidade temporária e regressão obrigatória.

## Sequência recomendada

### Etapa 1. Contrato e leitura pública (entregue na 0.2)

A fábrica de módulos e a porta de leitura da Economia já delimitam o que módulos externos podem consultar. Nenhuma fórmula econômica foi transferida.

### Etapa 2. Separar tipos, estado inicial e validação (próxima)

Identificar e extrair estruturas de estado, normalizadores, migrações de dados e invariantes que não dependem do DOM. Criar testes unitários sem alterar os fluxos de caixa.

### Etapa 3. Separar contabilidade e livro-caixa

Isolar lançamentos, saldos, auditorias monetárias, balanços patrimoniais e reconciliação das contas nacionais. Manter uma única autoridade para movimentações financeiras.

### Etapa 4. Separar domínios econômicos

Extrair, um por vez, trabalho e salários; empresas e produção; mercado e preços; crédito e dívidas; Tesouro e tributos. Cada extração deverá manter o contrato legado até que todas as chamadas sejam migradas.

### Etapa 5. Adaptador e remoção gradual do legado

Quando uma responsabilidade estiver coberta por API pública e testes, o `script.js` passa a delegar ao módulo extraído. Só remover o código antigo depois de comparar resultados e executar a suíte completa.

## Regras de segurança da refatoração

- Não mover vários subsistemas simultaneamente.
- Não mudar fórmulas durante uma etapa de extração estrutural.
- Comparar cenários determinísticos antes e depois da mudança.
- Preservar a conservação monetária e a reconciliação dos balanços setoriais.
- Verificar os efeitos em pelo menos 240 meses e em várias sementes.
- Não permitir escrita direta de Sociedade, Política ou Legislação em contas econômicas.
- Reverter a etapa se houver divergência inexplicada.

## Critério de conclusão

A Economia só será considerada modularizada quando cada subsistema tiver arquivo próprio, interface documentada, testes de unidade e integração, e o arquivo principal deixar de conter as implementações internas desses subsistemas. A versão 0.2 ainda não atingiu esse ponto: `script.js` permanece monolítico.
