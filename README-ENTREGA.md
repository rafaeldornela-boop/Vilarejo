# Vilarejo | Política + Instituições 1.0.0

Esta entrega reúne os dois módulos e as alterações de interface para a `main`.

## Conteúdo do pacote

### Arquivos novos

- `src/politics/vilarejo_politics.js`: dez grupos de interesse, indicadores de poder, representatividade, eventos causais e fechamento mensal.
- `src/institutions/vilarejo_institutions.js`: Executivo, Câmara de Representação dos Interesses, distribuição de cadeiras, mandato, coalizão e oposição.
- `src/test/politics_test.js`: 21 testes do módulo Política.
- `src/test/institutions_test.js`: 16 testes do módulo Instituições.
- `docs/politics/README.md` e `docs/institutions/README.md`: contratos e regras documentadas.

### Arquivos existentes alterados pelo patch

- `index.html`: novas entradas de navegação, painéis e ordem de carregamento dos módulos;
- `src/ui/dashboard.js`: títulos e renderização dos dois painéis;
- `style.css`: cartões, indicadores, bancadas, coalizão e layout responsivo;
- `package.json`: build e execução das novas suítes;
- `src/test/test_runner.js`: validação da ordem dos scripts.

## Aplicação na raiz do repositório

Extraia o conteúdo do ZIP diretamente na raiz do repositório `main`, mesclando `src/`, `docs/` e `integration/` com os diretórios existentes. Depois aplique:

```bash
git apply --check integration/0001-politics-institutions-integration.patch
git apply integration/0001-politics-institutions-integration.patch
npm test
npm run build
git diff --check
```

Revise o resultado antes do commit:

```bash
git status --short
git diff --stat
git diff
```

## Resultado dos testes desta entrega

- Política: 21/21 aprovados.
- Instituições: 16/16 aprovados.
- Total isolado: 37/37 aprovados.
- Sintaxe dos dois módulos: verificada com `node --check`.
- Sintaxe e aplicação do patch: o patch foi validado pelo parser do Git (`git apply --numstat`).

A suíte completa do repositório-base não foi executada nesta pasta, porque ela depende dos arquivos da `main` que não fazem parte do pacote incremental. Por isso, execute `npm test` e `npm run build` depois de aplicar o patch no seu clone.

## Decisão de desenho que deve ser conhecida

A Câmara começa com 21 cadeiras, alocadas aos grupos pelo indicador de influência política, com método dos maiores restos. Isso representa bancadas de interesse, não uma eleição popular. O mandato-padrão é de 48 meses. Oscilações mensais não mudam imediatamente a distribuição de cadeiras; a renovação ocorre ao fim do mandato. A coalizão precisa ser formada explicitamente e pode ser majoritária ou minoritária.
