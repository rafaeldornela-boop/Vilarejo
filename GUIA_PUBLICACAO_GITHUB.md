# Publicação no GitHub | Economia estável e Arquitetura Modular

A entrega contém dois marcos para preservar uma versão estável e evoluir a arquitetura sem perder a referência anterior.

## 1. Criar a branch `economia-estavel`

1. No GitHub, abra o repositório `Vilarejo`.
2. Crie a branch `economia-estavel` a partir da `main` atual.
3. Extraia o pacote `Vilarejo-Economia-Estavel-v3.0.zip`.
4. Envie o conteúdo extraído para a raiz da branch, preservando as pastas `docs/` e `docs/historico/`.
5. Não crie uma pasta externa chamada `Vilarejo-economia-v3.0`. Os arquivos `index.html`, `script.js` e `package.json` devem ficar diretamente na raiz.
6. Faça o commit `chore: estabiliza economia 3.0`.

Essa branch é o marco de referência da Economia 3.0, sem o Núcleo Central modular.

## 2. Criar a branch `arquitetura-modular`

1. Crie `arquitetura-modular` a partir da branch `economia-estavel`, não da `main`.
2. Extraia `Vilarejo-Arquitetura-Modular-Overlay-v0.1.zip`.
3. Envie os arquivos extraídos para a raiz da branch. O pacote contém apenas arquivos novos ou atualizados em relação à Economia 3.0; preserve os demais arquivos herdados da branch-base.
4. Mantenha os diretórios `docs/` e os caminhos indicados no ZIP.
5. Faça o commit `feat: adiciona núcleo central modular 0.1`.

Se preferir uma substituição integral, `Vilarejo-Arquitetura-Modular-v0.1.zip` contém o projeto completo da release 3.1.0. Nesse caso, extraia seu conteúdo na raiz da branch `arquitetura-modular`, substituindo os arquivos existentes.

## 3. Verificação após o envio

No ambiente local, execute:

```bash
npm run build
npm test
npm start
```

A validação desta entrega resultou em 92 testes aprovados e 0 reprovados. O GitHub não foi alterado por esta preparação: os commits e pushes ficam a cargo de quem administra o repositório.
