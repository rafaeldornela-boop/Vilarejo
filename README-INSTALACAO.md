# Vilarejo: redesign da interface + calendário civil

Esta atualização transforma a tela de relatório em uma interface de jogo de gestão, com mapa isométrico ilustrativo, áreas de navegação, gráficos históricos e calendário gregoriano visual.

## O que muda

- Visão geral do território com mapa ilustrativo e indicadores da comunidade.
- Navegação separada em Visão geral, Economia, Sociedade, Governo e Registros.
- Dez gráficos em SVG, sem bibliotecas externas: PIB, trabalho, aprovação, custo de vida, salário real de referência, inflação, produção/consumo, população, receitas/despesas, dívida pública e desigualdade estimada.
- Seleção de janelas de 12, 24 ou 60 meses.
- Calendário civil com dias da semana, meses de 28 a 31 dias e anos bissextos. Cada nova partida começa na data local do computador; a partir daí, cada dia simulado avança a data do calendário em um dia.
- Relógio econômico separado do calendário civil: o motor mantém seus meses de 30 dias e anos de 360 dias. A interface mostra safra, entressafra e dias até o próximo fechamento sem alterar as regras econômicas.
- Histórico mensal real, iniciado no primeiro fechamento da partida. Não cria dados anteriores fictícios.
- Políticas, ações, eventos, balanços e livro-caixa continuam ligados ao motor existente.

## O que precisa estar instalado no computador

1. **Node.js 18 ou superior**. Recomendo instalar a versão LTS atual pelo site oficial `https://nodejs.org/`. O Node executa o instalador, o servidor local e os testes.
2. **Git** para clonar o repositório e enviar as alterações ao GitHub. Pode ser instalado pelo site oficial `https://git-scm.com/` ou substituído pelo GitHub Desktop.
3. **Um navegador moderno** (Chrome, Edge ou Firefox) para jogar.

Não precisa instalar banco de dados, Docker, Python, bibliotecas de gráficos nem extensões pagas. O pacote não tem dependências npm externas, portanto não é necessário executar `npm install`.

Um editor como VS Code ou Antigravity é recomendado para abrir os arquivos, mas não é requisito para o jogo funcionar.

## Instalação da atualização

1. Faça commit ou cópia do estado atual do repositório. O instalador também gera um backup dos arquivos que substituirá, em uma pasta ao lado do projeto.
2. Baixe e extraia `Vilarejo-Redesign.zip` em uma pasta temporária.
3. Abra o terminal nessa pasta extraída, onde existe a pasta `scripts`, e execute apontando para a pasta raiz do repositório:

```powershell
node scripts/install.js "C:\Projetos\Vilarejo"
```

No macOS/Linux, por exemplo:

```bash
node scripts/install.js "$HOME/projetos/Vilarejo"
```

4. Abra um terminal na pasta raiz do repositório:

```bash
cd C:\Projetos\Vilarejo
npm run build
npm test
npm start
```

5. Abra `http://localhost:3000` no navegador.

O instalador substitui `index.html` e `style.css`, instala `src/ui/dashboard.js` e aplica adaptações pontuais em `src/economy/script.js`. Ele não modifica fórmulas de PIB, preços, salários, crédito, impostos, produção, consumo ou regras de encerramento da partida.

## Como publicar no GitHub

Depois de instalar e validar localmente, faça commit e push dos arquivos modificados para o repositório. Apenas enviar o ZIP para o GitHub não instala a atualização no projeto: o conteúdo do pacote precisa ser aplicado à pasta do repositório. O GitHub Pages pode hospedar a versão estática; ele não executa `server.js`. Para executar com `npm start`, use o computador local ou uma hospedagem que aceite Node.js.

## Como o calendário funciona

A tela usa um calendário civil gregoriano real, que avança um dia por avanço da simulação, incluindo fevereiro bissexto. Como o motor econômico atual usa ciclos próprios de 30 dias e 360 dias, a interface apresenta os dois relógios com nomes distintos: data civil e ano/dia econômico. Assim conseguimos ter um calendário familiar sem mexer no equilíbrio atual da economia. Uma futura atualização poderá migrar os fechamentos econômicos para meses civis reais, mas isso exigiria revisão de regras e testes do motor.

## Limite do mapa

O mapa é uma representação isométrica ilustrativa. Os contadores ao lado refletem o estado real, mas os edifícios ainda não são posicionados ou construídos dinamicamente no mapa.
