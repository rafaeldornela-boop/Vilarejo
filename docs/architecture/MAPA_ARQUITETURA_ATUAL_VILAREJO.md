# Mapa da arquitetura atual do Vilarejo

**Referência:** branch `main`\
**Commit de referência:** `6f90d36`\
**Finalidade:** orientar manutenção e integração de módulos sem alterar
regras da simulação.

> Este documento é um mapa de orientação, não substitui a leitura do
> código. Em caso de divergência, prevalecem o comportamento
> implementado e os testes.

## 1. Visão geral

O Vilarejo possui um Núcleo Central, um motor econômico e módulos de
domínio. Cada módulo é responsável pelo próprio estado. A comunicação
entre módulos deve ocorrer por consultas públicas, snapshots e eventos,
sem escrita direta no estado privado de outro domínio.

  ---------------------------------------------------------------------------------------------
  Área                    Arquivo ou pasta                              Responsabilidade
  ----------------------- --------------------------------------------- -----------------------
  Núcleo                  `src/core/vilarejo_core.js`                   Runtime, calendário
                                                                        interno, sessão,
                                                                        diretório populacional,
                                                                        registro de módulos e
                                                                        barramento

  Economia                `src/economy/vilarejo_economy.js`             Simulação econômica e
                                                                        fechamento mensal

  Eventos                 `src/events/eventos_v3.js`                    Eventos do domínio
                                                                        econômico

  Sociedade               `src/society/vilarejo_society.js`             Demografia, migração,
                                                                        cultura e qualidade de
                                                                        vida

  Política                `src/politics/vilarejo_politics.js`           Grupos de interesse,
                                                                        influência e relações
                                                                        políticas

  Instituições            `src/institutions/vilarejo_institutions.js`   Executivo, Câmara de
                                                                        representação,
                                                                        cadeiras, coalizões e
                                                                        mandatos

  Serviços                `src/services/`                               Domínios de serviços
                                                                        públicos e indicadores

  Interface               `src/ui/dashboard.js`, `index.html`,          Apresentação, navegação
                          `style.css`                                   e interação

  Testes                  `src/test/`                                   Testes unitários e de
                                                                        integração
  ---------------------------------------------------------------------------------------------

## 2. Tempo: calendário interno e data civil

O Core utiliza um calendário operacional de **12 meses de 30 dias**,
totalizando 360 dias por ano econômico. O snapshot do relógio inclui
campos como `year`, `month`, `day`, `dayOfYear`, `economicMonthNumber` e
`absoluteDay`.

Esses campos representam o calendário interno da simulação. Uma camada
visual pode converter `absoluteDay` em uma data gregoriana, mas essa
conversão não pode alterar o avanço do tempo, a duração dos meses
econômicos, o fechamento mensal, o número do mês econômico ou os eventos
emitidos pelo Core e pela Economia.

Não criar um segundo relógio para controlar a simulação.

## 3. Barramento de eventos

O Core oferece publicação, assinatura, cancelamento de assinatura e
histórico limitado. Os eventos são envelopes com metadados, incluindo
identificador, tópico, origem, dia e payload.

Boas práticas: - publicar fatos consumados, não comandos disfarçados; -
usar tópicos com namespace do módulo emissor; - manter payloads
serializáveis; - tratar eventos de forma idempotente quando houver risco
de reprocessamento; - não alterar o estado privado de outro módulo; -
cancelar listeners quando o ciclo de vida exigir.

O histórico do barramento é limitado e não deve ser tratado como arquivo
histórico permanente.

## 4. Fechamento mensal

O evento `economy:month-closed` é o ponto natural de sincronização entre
domínios. Ele informa que o mês econômico foi fechado e fornece um
payload resumido, incluindo referências temporais, dados de população,
contas nacionais, resultado fiscal e estado de encerramento da partida.

Módulos consumidores devem validar os dados recebidos, atualizar somente
o próprio estado e, quando aplicável, publicar seu evento de fechamento.
A ordem e os detalhes exatos do payload devem ser confirmados em
`src/economy/vilarejo_economy.js` antes de implementar um consumidor
novo.

## 5. Limites entre os módulos

### Economia

É proprietária das regras e contas econômicas. Outros módulos não devem
escrever diretamente em seu estado interno nem alterar fórmulas, preços,
salários, produção, impostos ou saldos.

### Sociedade

Mantém estado próprio para pessoas, domicílios, demografia, migração,
cultura e qualidade de vida. Não deve ser confundida com o diretório
populacional do Core, que é uma visão compartilhada/sincronizada.

### Política

Modela grupos de interesse, atributos de organização e influência e
relações com o governo. Parâmetros iniciais são parâmetros do cenário,
não estatísticas empíricas.

### Instituições

Modela estrutura institucional, representação, distribuição de cadeiras,
coalizões e mandatos. Não presumir que isso equivale a eleições
populares ou a um sistema legislativo completo.

### Serviços públicos

Indicadores e controles de serviços não devem ser interpretados
automaticamente como execução orçamentária. Antes de qualquer integração
fiscal, é necessário um contrato explícito com a Economia. Não presumir
débito no Tesouro, contratação, compra de insumos ou execução física de
obras.

### Interface

A interface lê snapshots e apresenta informações. Não deve se tornar
proprietária de regras econômicas, demográficas ou institucionais.
Histórico mantido em memória pela interface não equivale à persistência
da partida.

## 6. Persistência e histórico

Não presumir que exista um sistema completo de salvar/carregar toda a
partida. Antes de implementar persistência, verificar se todos os
módulos possuem contratos de serialização e restauração compatíveis.

Até existir esse contrato: - históricos em memória duram somente durante
a sessão; - reset deve limpar os dados transitórios do módulo; - não
prometer recuperação do histórico após recarregar a página; - não usar o
histórico limitado de eventos como substituto de armazenamento
permanente.

## 7. Regras para contribuições paralelas

1.  Cada agente trabalha em branch própria, criada a partir do
    commit-base definido.
2.  Não trabalhar diretamente na `main` nem fazer merge sem revisão.
3.  Não alterar módulos fora do escopo sem justificar a necessidade.
4.  Não modificar o motor econômico ou as regras do Core em tarefas de
    interface, jornal ou inteligência.
5.  Evitar editar simultaneamente `index.html`, `style.css` e
    `src/ui/dashboard.js` em frentes diferentes. Combinar previamente os
    pontos de integração.
6.  Não criar dados, notícias, alertas ou indicadores fictícios.
7.  Informar SHA, arquivos alterados, testes efetivamente executados e
    limitações.
8.  Quando uma funcionalidade depender de API inexistente, documentar a
    lacuna em vez de simular que ela existe.

## 8. Documentação que exige revisão

Há documentos de arquitetura anteriores que descrevem Sociedade,
Política e outros módulos como futuros ou inexistentes. Esses trechos
não representam necessariamente o estado atual do repositório.

Antes de seguir instruções antigas, conferir o código e os testes
atuais. Este arquivo também é um retrato datado e deve ser atualizado
quando a arquitetura mudar.

## 9. Frentes de desenvolvimento previstas

-   **Interface:** calendário civil de apresentação, navegação e
    experiência do jogador.
-   **Jornal:** transformar fatos reais dos fechamentos e eventos em
    memória narrativa, sem inventar dados.
-   **Inteligência:** gráficos históricos, tendências e alertas
    derivados de dados disponíveis e verificáveis.

Essas frentes não devem duplicar relógios, alterar a Economia nem
assumir persistência completa antes que ela exista.
