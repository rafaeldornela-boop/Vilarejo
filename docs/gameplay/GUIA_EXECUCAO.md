# Guia de execução

## Abrir o jogo

Inicie o servidor com `npm start` na raiz e acesse `http://localhost:3000`. A navegação contém:

- **Visão geral:** território e indicadores resumidos.
- **Economia:** atividade, contas, políticas, mercado e gráficos.
- **Sociedade:** demografia, mobilidade, cultura e qualidade de vida parcial.
- **Governo:** controles econômicos existentes, orçamento e balanços fiscais.
- **Política:** grupos, influência, satisfação e relação com o governo.
- **Instituições:** Câmara, bancadas, quórum, maioria, coalizão, oposição e mandato.
- **Serviços e desenvolvimento:** sete áreas, recursos estratégicos e alavancas de cenário.
- **Registros:** acontecimentos e livro-caixa.

A simulação econômica continua sendo a autoridade para a operação de iniciar/pausar, o fechamento, as transações e as regras de fim de partida. A interface de domínio atualiza os painéis por snapshots e pelo fechamento mensal.

## Interpretar os indicadores

A Economia contém resultados do próprio motor, com auditorias de caixa, balanços e contas nacionais. Sociedade e Política indicam quando uma medição é parcial, estimada ou indisponível. Instituições transforma grupos políticos em bancadas simuladas; a Câmara não é uma eleição popular.

Serviços começa com parâmetros de cenário e índices abstratos. Ajustar uma alavanca altera o estado do módulo e seus efeitos cruzados; **não** representa gasto já executado, contratação, compra ou obra. O quadro fiscal de Governo não recebe despesas de Serviços nesta versão.

O marcador de migração que vem da Economia identifica novos domicílios no cadastro demográfico. O Core e a Sociedade rejeitam IDs duplicados para impedir a sobreposição de famílias.

## Reiniciar e salvar

Use o controle de reinício da própria Economia para começar uma nova partida. Os adaptadores recebem `game:reset` e semeiam seu estado quando o mundo é sincronizado. Não há save/restore completo da partida neste momento; a serialização do motor Eventos V3 salva somente o estado de Eventos.

## Diagnóstico

```bash
npm run build
npm test
```

O relatório oficial da execução deve sempre ser obtido novamente no checkout que será publicado. O teste HTTP termina o processo de servidor que ele próprio inicia.
