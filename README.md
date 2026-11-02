# Vilarejo | Módulo Política 1.0.0

## Finalidade

O módulo Política representa grupos de interesse, seus recursos de poder, sua base social, sua satisfação e sua capacidade de influenciar decisões públicas. Ele não implementa partidos, cadeiras legislativas ou votação nesta etapa.

## Princípios do modelo

1. **Grupos não são categorias sociais exclusivas.** Uma pessoa pode pertencer simultaneamente a mais de um grupo. A soma das representatividades pode, portanto, ultrapassar 100%; isso não significa duplicação da população total.
2. **Ausência de dado não é zero.** `representedPopulation` e `representativity` são `null` enquanto não houver informação suficiente. O painel apresenta esses casos como “Não mensurado”.
3. **Poder não é sinônimo de tamanho.** Poder econômico, organização, coesão, capacidade de mobilização, acesso institucional e representatividade são dimensões distintas.
4. **Os atributos iniciais são parâmetros de cenário.** Os valores iniciais de poder, organização, coesão, mobilização e acesso institucional são hipóteses de balanceamento do jogo, não estatísticas reais.
5. **Influência é um indicador derivado.** A pontuação é uma síntese para leitura, não substitui as dimensões originais.
6. **Impactos precisam de causa rastreável.** O módulo só altera os atributos de um grupo quando recebe um impacto explícito, com origem, justificativa e, quando disponível, evidência.

## Fórmula de influência

A influência é calculada pela média ponderada dos indicadores disponíveis:

- Poder econômico: 25%;
- Organização: 25%;
- Coesão: 15%;
- Capacidade de mobilização: 15%;
- Acesso institucional: 10%;
- Representatividade: 10%, somente quando mensurada.

Quando a representatividade não está disponível, os demais pesos são normalizados para somarem 100%. A escala final é de 0 a 100.

A relação com o governo é derivada da satisfação:

- 65 a 100: apoio;
- 36 a 64,9: neutralidade;
- 0 a 35: oposição.

Esses limites são parâmetros iniciais do jogo e podem ser calibrados por cenário.

## Fonte de dados atual

O adaptador usa o retrato populacional publicado pelo Core e a composição etária mantida pela Sociedade. Nesta versão, somente a população em idade ativa (18 a 64 anos) pode alimentar uma estimativa para o grupo Trabalhadores.

Essa estimativa ainda não distingue ocupados, desempregados e pessoas fora da força de trabalho. Os demais grupos aparecem como não mensurados até que os módulos existentes forneçam atributos de renda, patrimônio, ocupação, propriedade, setor econômico ou mobilização.

Não usar felicidade domiciliar como substituto automático de pobreza, classe social ou vulnerabilidade. Também não inferir que todo adulto é trabalhador, empresário, servidor ou proprietário.

## Contrato de impacto

O barramento aceita `politics:interest-impact` com o formato:

```js
runtime.publish("politics:interest-impact", {
  eventId: "state-enterprise-tariff-001",
  eventType: "state-enterprise-impact",
  month: 1,
  source: "state-enterprise",
  impacts: [
    {
      groupId: "merchants",
      reason: "Aumento tarifário elevou custos operacionais.",
      evidence: { tariffChangePercent: 15, enterpriseId: "energy-company" },
      channels: {
        satisfaction: -8,
        economicPower: -3
      }
    }
  ]
}, "state-enterprise");
```

Canais aceitos: `economicPower`, `organization`, `cohesion`, `mobilizationCapacity` e `satisfaction`. Os deltas são limitados ao intervalo 0–100. O produtor do evento é responsável por calcular impactos causais; o módulo não presume que todo aumento de tarifa, lucro, contratação ou subsídio afeta todos os grupos da mesma forma.

## Integração mensal

O módulo é carregado depois da Sociedade e se registra no Runtime como `politica`, dependendo de `core` e `economia`.

Eventos consumidos:

- `world:synchronized`: atualiza o retrato populacional;
- `society:month-closed`: atualiza os dados demográficos disponíveis;
- `economy:month-closed`: fecha o ciclo político mensal;
- `game:reset`: reinicia o estado político;
- `game:initialized`: reconstrói a composição inicial;
- `politics:interest-impact`: recebe impactos rastreáveis.

Eventos publicados:

- `politics:month-closed`;
- `politics:influence-changed`;
- `politics:group-updated`.

O fechamento mensal é idempotente: o mesmo mês não pode ser processado duas vezes e o módulo rejeita retrocesso do calendário.

## API pública

`window.VilarejoPolitics` / `require("./src/politics/vilarejo_politics.js")`:

- `createState(options)`;
- `addGroup(state, definition)`;
- `removeGroup(state, groupId)`;
- `updateGroup(state, groupId, changes)`;
- `mergeGroups(state, groupIds, definition)`;
- `splitGroup(state, sourceGroupId, definitions)`;
- `setComposition(state, composition)`;
- `deriveComposition(populationSnapshot, societyState)`;
- `applyImpact(state, impact)`;
- `recordImpacts(state, payload)`;
- `advanceMonth(state, options)`;
- `getSnapshot(state)`;
- `renderDashboard(state, element)`;
- `registerWithRuntime(runtime, options)`.

## Escopo deliberadamente adiado

Não há ainda partidos, eleições, composição parlamentar, mandatos, coalizões, tramitação ou votação. Esses recursos devem ser construídos após validar a qualidade dos grupos e de seus dados de composição.
