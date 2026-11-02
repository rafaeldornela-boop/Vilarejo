# Publicação da Arquitetura Modular 0.2 no GitHub

## Branch de destino

Crie a branch `arquitetura-modular` **a partir da branch `economia-estavel`**. Não use `main` como base e não faça esta publicação diretamente em `economia-estavel`.

## Usar o pacote completo

1. Baixe `Vilarejo-Arquitetura-Modular-v0.2.1-COMPLETO.zip`.
2. Extraia o ZIP. Os arquivos `index.html`, `script.js`, `package.json` e `README.md` devem aparecer diretamente na raiz extraída.
3. Abra a branch `arquitetura-modular` no GitHub.
4. Use **Add file → Upload files** e envie o conteúdo extraído, preservando as pastas `docs`, `public`, `tests` e `.github`.
5. Não envie uma pasta externa chamada `Vilarejo-Arquitetura-Modular-v0.2.1`; envie o conteúdo dela.
6. Faça um commit com a mensagem `Add modular architecture 0.2.1`.

O GitHub não extrai ZIP automaticamente. Enviar somente o arquivo `.zip` para o repositório não instala os arquivos do projeto.

## Arquivos centrais desta atualização

- `index.html` (atualizado para carregar a fábrica e a porta da Economia);
- `package.json` (build e testes atualizados);
- `test_runner.js` (testes estruturais e integração ampliados);
- `public/modules/module_factory.js` (novo);
- `public/modules/economia/index.js` (novo);
- `tests/modular_architecture.test.js` (novo);
- `.github/workflows/ci.yml` (novo);
- `README.md` e documentação em `docs/` (atualizados).

## Depois do commit

O GitHub Actions deve executar `npm run build` e `npm test`. O resultado local desta release foi 114 verificações aprovadas e zero falhas.

## Conferência manual

Na raiz da branch, confirme que existem:

```text
index.html
script.js
package.json
vilarejo_core.js
public/modules/module_factory.js
public/modules/economia/index.js
tests/modular_architecture.test.js
.github/workflows/ci.yml
```

Não apague `script.js`, `vilarejo_core.js` ou `eventos_v3.js`. Eles continuam sendo necessários para a simulação.

## Arquivos antigos que podem permanecer na raiz

A branch original pode conter cópias antigas de documentos e um ZIP de release na raiz. O pacote novo organiza a documentação em `docs/` e mantém o histórico em `docs/historico/`. Depois da publicação, você pode excluir as cópias antigas da raiz, desde que confirme que seus equivalentes estão nas pastas `docs/`:

- `ARQUITETURA_MODULAR_V0.1.md`
- `ARQUIVOS_E_EXCLUSOES.md`
- `CONTRATO_DE_MODULOS_V1.md`
- `GUIA_PUBLICACAO_GITHUB.md`
- `LOGICA_DA_ECONOMIA_BASE.md`
- `RELATORIO_AUDITORIA_V2.5.md`
- `RELATORIO_ECONOMIA_V3.0.md`
- `RELEASE_ECONOMIA_3_0_E_NUCLEO_0_1.md`
- `Vilarejo_Arquitetura_Economica_v0.1_98ee5972.md`
- `Vilarejo_Prospecto_Economico_v0.2.md`
- `Vilarejo_Prospecto_Economico_v0.3.md`
- `Vilarejo-economia-v3.0.zip`

Essa limpeza é opcional e não interfere no funcionamento da aplicação. Não apague `metadata.json` se ainda utiliza Google AI Studio.
