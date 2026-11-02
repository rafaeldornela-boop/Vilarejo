# Guia de instalação

## Requisitos

- Node.js 18 ou superior e npm.
- Git para clonar e contribuir.
- Navegador moderno.
- Sem banco de dados, Docker ou dependências npm de terceiros para a versão atual.

## Obter o código

```bash
git clone https://github.com/rafaeldornela-boop/Vilarejo.git
cd Vilarejo
```

Para testar esta integração, faça checkout da branch `integracao-governo-1.0` se ela estiver publicada. A `main` não é modificada nem mesclada automaticamente.

## Instalar e verificar

```bash
npm install
npm run build
npm test
```

`npm install` mantém o lockfile; `npm ci` faz instalação reproduzível para CI. O projeto declara atualmente zero dependências npm externas. `npm run build` roda `node --check` nos módulos e testes; `npm test` executa regressões econômicas e as suítes integradas.

## Iniciar

```bash
npm start
```

O servidor escuta em `http://localhost:3000` por padrão. `npm run dev` é um alias de desenvolvimento. `HOST` e `PORT` podem ser fornecidos no ambiente. O smoke test HTTP verifica a entrega de `/style.css` e de um módulo sob `/src/`.

O servidor é local e estático. Ele não fornece autenticação, HTTPS, API de estado nem armazenamento de partidas. Não exponha o servidor em uma rede não confiável sem uma camada de implantação apropriada.
