# Vilarejo | Expansão do Estado 1.0.0

Pacote consolidado: Política + Instituições + sete módulos de serviços públicos e recursos estratégicos, com painel do jogador.

## Conteúdo

- `src/politics/vilarejo_politics.js`
- `src/institutions/vilarejo_institutions.js`
- `src/services/vilarejo_services.js`
- `src/test/politics_test.js`
- `src/test/institutions_test.js`
- `src/test/services_test.js`
- documentação em `docs/`
- patches de integração sequenciais em `integration/`

## Aplicação na branch main

A expansão anterior de Política e Instituições precisa ser aplicada antes do painel de Serviços, pois o segundo patch se apoia nos painéis e na ordem de scripts criados pelo primeiro.

```bash
git apply --check integration/0001-politics-institutions-integration.patch
git apply integration/0001-politics-institutions-integration.patch

git apply --check integration/0002-services-integration.patch
git apply integration/0002-services-integration.patch

npm test
npm run build
git diff --check
```

Se a integração Política + Instituições já estiver aplicada no seu clone, pule o primeiro patch. Não aplique o mesmo patch duas vezes.

## O que aparece na visão do jogador

Novo item de navegação: **Serviços e desenvolvimento**. A tela mostra sete cartões, indicadores, prioridades e controles de intensidade. Abaixo, um painel de recursos estratégicos mostra água, eletricidade, petróleo e minerais.

## Módulos e escopo

Os domínios são registrados individualmente no Runtime: `saude`, `educacao`, `seguranca`, `ciencia`, `desenvolvimento`, `cultura` e `infraestrutura`. O módulo agregado `servicos` coordena fechamento mensal, snapshots e eventos entre áreas.

Saneamento, água, eletricidade, petróleo e mineração estão em Infraestrutura e Recursos Estratégicos, não dentro da Saúde. Saúde consome os efeitos de saneamento, água e energia. Essa separação evita que um setor seja dono de recursos que servem ao Estado inteiro.

## Testes executados nesta entrega

- Política: 21/21.
- Instituições: 16/16.
- Serviços: 20/20.
- Total isolado: **57/57 aprovados**.
- `node --check` nos três módulos.
- Os patches foram validados estruturalmente com `git apply --numstat`.

A suíte completa do repositório e o `git apply --check` contra um clone atualizado da `main` não foram executados neste ambiente. Portanto, rode os comandos acima antes do commit. Nenhum commit foi feito no GitHub.

## Limite importante

Os controles atuais alteram intensidade de políticas e os indicadores evoluem mensalmente. Ainda não há débito no orçamento, contratação de pessoal, construção física ou consumo de insumos da Economia. A próxima fase deve integrar cada decisão ao orçamento, à capacidade administrativa, ao mercado de trabalho, à produção e à infraestrutura. Não trate os índices desta versão como gastos reais.
