# Integração do Mundo Vivo no Vilarejo

A entrega é uma camada complementar. Ela não substitui Eventos V3, Economia, Sociedade, Política, Instituições, Serviços, Inteligência ou Jornal.

## Arquivos novos

- `src/world/vilarejo_world_engine.js`: observa snapshots reais, detecta tendências, gera acontecimentos registrados, recomenda áreas de análise e acompanha marcos.
- `src/test/world_engine_test.js`: testes unitários do motor e do contrato do Runtime.
- `src/test/world_integration_test.js`: integração real da Economia, dos módulos sociais, do Mundo Vivo e do Jornal no harness do projeto.
- `patches/world-live-ui.html`: bloco HTML do painel.
- `patches/world-live.css`: estilos isolados do painel.

## Instalação automatizada

O pacote inclui `integrar.sh`. Coloque a pasta `Vilarejo_Mundo_Vivo_V1` dentro do repositório e execute, na raiz do Vilarejo:

```bash
bash Vilarejo_Mundo_Vivo_V1/integrar.sh .
```

O script valida todos os patches antes de alterar o projeto, copia os novos arquivos, integra Economia, Eventos V3, Jornal, HTML e bundle Netlify, acrescenta o CSS, atualiza os comandos de teste sem apagar outros scripts e executa `npm run build` e `npm test`. Para integrar sem executar os testes automaticamente, use `SKIP_VALIDATION=1`.

## Alterações em arquivos existentes

1. As alterações de código existentes estão reunidas em `patches/integracao-completa.patch`. O painel HTML já está incluído em `patches/index-integration.patch`. O snippet isolado também está disponível em `patches/world-live-ui.html`.
2. Aplicar `patches/index-integration.patch` em `index.html`. Ele insere o painel na Visão geral e posiciona o script do Mundo Vivo **depois de Serviços e antes do Jornal**:

   ```html
   <script src="src/services/vilarejo_services.js"></script>
   <script src="src/world/vilarejo_world_engine.js"></script>
   <script src="src/newspaper/vilarejo_newspaper.js"></script>
   ```

   A posição é importante: Sociedade, Política, Instituições e Serviços precisam publicar seus snapshots antes do fechamento observado pelo Mundo Vivo; o Jornal precisa carregar depois para incorporar os registros do mesmo mês.
3. Aplicar `patches/prepare-dist-integration.patch` em `scripts/prepare_dist.js`. Sem isso, a validação do bundle do Netlify rejeitará o novo script.
4. Aplicar `patches/economy-events-v3-integration.patch` em `src/economy/vilarejo_economy.js` para incluir os registros reais do Eventos V3 no fechamento mensal.
5. Acrescentar o conteúdo de `patches/world-live.css` ao final de `style.css`.
6. Atualizar `package.json` com `patches/package.json` ou copiar dele as verificações `node --check` dos dois novos testes no `build` e acrescentar os dois novos testes ao comando `test`.
7. Aplicar `patches/newspaper-world-integration.patch` para o Jornal incluir os acontecimentos observados e marcos conquistados na edição do mesmo mês.
8. Aplicar `patches/newspaper-world-test.patch` para cobrir essa integração.

## O que muda no jogo

- O Mundo Vivo lê os fechamentos de Economia, os registros mensais já produzidos pelo Eventos V3 e os snapshots da Sociedade, Política, Instituições e Serviços.
- Detecta pressão fiscal após dois déficits consecutivos, queda persistente do bem-estar, saldo migratório negativo ou positivo, fragilidade persistente da coalizão, baixa satisfação média dos serviços e recuperações fiscal ou social.
- Registra nascimentos e óbitos publicados pela Sociedade, evitando duplicação por identificador de origem.
- Acompanha marcos de desenvolvimento, como primeiro fechamento, primeiro ano, cobertura social, estabilidade fiscal e crescimento populacional.
- Sugere a área que merece atenção e oferece atalho para Governo, Sociedade, Serviços ou Economia. O painel também mostra a situação da coalizão e a média dos índices de satisfação dos serviços.
- O Jornal incorpora os acontecimentos do Eventos V3, os sinais observados e os marcos alcançados no mesmo fechamento mensal.

## Limites preservados

- A camada não lança transações, altera caixa, preços, salários, empregos, serviços ou indicadores econômicos.
- As sugestões ainda não executam políticas. Elas encaminham o jogador para a área onde pode analisar o problema.
- Os indicadores indisponíveis permanecem como `null`; não são convertidos em zero.
- `serialize()` e `restore()` salvam apenas o estado do Mundo Vivo. Isso **não é** salvamento integral da partida.
- Os eventos narrativos são sinais derivados de observações. Não atribuem uma causa que o motor não mediu.
- Os limites de alerta (dois fechamentos, saldo migratório de pelo menos duas pessoas e média de serviços abaixo de 38) são heurísticas de jogo, não parâmetros empíricos ou previsões.

## Validação

Na entrega isolada foram executados:

```bash
node --check src/world/vilarejo_world_engine.js
node --check src/test/world_engine_test.js
node --check src/test/world_integration_test.js
node src/test/world_engine_test.js
node src/test/world_integration_test.js
```

Resultado validado nesta entrega: 15 testes unitários do Mundo Vivo aprovados e todos os arquivos JavaScript entregues passaram em `node --check`. O teste integrado está incluído, mas precisa ser executado no checkout completo depois da aplicação. Não consegui clonar o repositório no ambiente desta execução. Antes de publicar, confirmar `npm run build` e `npm test`.
