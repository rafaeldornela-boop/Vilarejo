# Vilarejo
## Contrato de Integração entre Interface, Jornal e Inteligência
**Versão:** 0.1  
**Finalidade:** orientar o trabalho paralelo dos agentes de Interface (AI Studio), Jornal (Grok) e Inteligência (Manus), reduzindo conflitos e evitando alterações indevidas no motor da simulação.

---

## 1. Objetivo e escopo

Este documento estabelece limites de atuação e regras de integração para três frentes:

1. **Interface:** navegação, apresentação dos dados, calendário visual e experiência de uso.
2. **Jornal:** transformação dos acontecimentos registrados pela simulação em edições históricas.
3. **Inteligência:** gráficos históricos, indicadores derivados e central de alertas.

As três frentes devem consumir informações produzidas pelo jogo. Não devem criar uma segunda simulação nem alterar resultados econômicos, sociais ou políticos.

Este contrato é uma especificação de integração. Ele não autoriza, por si só, mudanças no código ou no motor econômico.

## 2. Princípios obrigatórios

- A simulação é a fonte oficial dos fatos.
- Interface, Jornal e Inteligência são camadas de apresentação, interpretação ou consulta.
- Nenhum módulo pode inventar população, renda, produção, inflação, eventos, personagens, causas ou consequências.
- Indicadores derivados devem ser identificados como cálculos ou interpretações, e não como dados originais do motor.
- A ausência de dados deve ser apresentada como ausência de dados. Não preencher lacunas com estimativas silenciosas.
- A passagem do tempo e o fechamento econômico continuam sob responsabilidade do sistema existente.
- A camada visual pode apresentar calendário gregoriano, mas não pode substituir nem modificar o calendário interno da simulação.
- Os módulos devem funcionar sem serviços pagos, APIs externas obrigatórias ou dependências desnecessárias.
- Cada agente trabalha em branch própria. Nenhum agente deve fazer merge em `main` ou alterar a branch de outro agente.

## 3. Fonte de verdade e responsabilidades

| Informação | Fonte responsável | Consumidores |
|---|---|---|
| Tempo e calendário interno | Core da simulação | Interface, Jornal, Inteligência |
| Fechamento mensal e resultados econômicos | Economia | Core, Sociedade, Jornal, Inteligência, Interface |
| População, famílias e dinâmica social | Sociedade/Core, conforme implementação existente | Interface, Jornal, Inteligência |
| Grupos, representação e governo | Política/Instituições | Interface, Jornal, Inteligência |
| Indicadores e níveis dos serviços | Serviços | Interface, Jornal, Inteligência |
| Histórico apresentado em gráficos | Registros históricos disponíveis no jogo | Inteligência e Interface |
| Edições jornalísticas | Módulo Jornal | Interface |
| Alertas derivados | Módulo Inteligência | Interface |

A tabela indica responsabilidades conceituais. Antes de integrar, cada agente deve conferir no código qual módulo efetivamente fornece cada dado e qual é o nome real do campo, evento ou método.

## 4. Contrato de leitura de dados

Os módulos consumidores devem preferir, nesta ordem:

1. APIs públicas e métodos já existentes dos módulos.
2. Eventos oficiais já emitidos pela simulação.
3. Snapshots ou históricos públicos já disponibilizados pelo sistema.
4. Uma nova interface de leitura, caso seja indispensável e aprovada.

É proibido acessar ou modificar diretamente variáveis privadas de outro módulo para contornar a ausência de uma API.

### 4.1 Regras para qualquer dado consumido

Todo registro utilizado deve preservar, quando disponíveis:

- identificador ou referência de origem;
- período a que o dado pertence;
- unidade de medida;
- natureza do dado (observado, calculado ou interpretado);
- módulo de origem.

Não presumir que esses campos já existam. Se estiverem ausentes, registrar a lacuna e propor um contrato mínimo antes de implementar dependências.

### 4.2 Período e calendário

O calendário econômico interno trabalha com anos de 360 dias, divididos em 12 meses de 30 dias. A interface pode converter o avanço da simulação em datas gregorianas para exibição.

Regras:

- O calendário gregoriano é uma representação visual.
- A data exibida deve ser derivada de uma referência temporal única e determinística.
- Jornal e Inteligência devem usar o mesmo período oficial de fechamento usado pela simulação.
- Não criar um segundo contador de meses ou dias.
- Não alterar a duração do mês econômico para acomodar o calendário visual.
- Divergências entre data visual e período econômico devem ser explicitadas, nunca corrigidas silenciosamente.

## 5. Contrato de integração por frente

### 5.1 Interface

Responsabilidades:

- organizar navegação e painéis;
- apresentar dados reais dos módulos;
- exibir o calendário gregoriano como camada visual;
- apresentar gráficos e alertas produzidos pela Inteligência;
- disponibilizar acesso às edições do Jornal.

Limites:

- não recalcular regras econômicas;
- não alterar população, instituições ou serviços;
- não duplicar a lógica de fechamento mensal;
- não manter cópias concorrentes do estado oficial;
- não criar indicadores fictícios para preencher componentes vazios.

### 5.2 Jornal

Responsabilidades:

- produzir uma edição por período oficial, quando houver fatos suficientes;
- organizar acontecimentos em seções, como Economia, Sociedade, Governo e Serviços;
- manter referência ao período e aos fatos que sustentam cada notícia;
- preservar edições anteriores e impedir duplicação de uma mesma edição;
- separar fatos registrados, tendências observadas e interpretação editorial.

Limites:

- não inventar falas, entrevistas, personagens ou acontecimentos;
- não atribuir causalidade sem evidência nos dados;
- não transformar variação estatística isolada em afirmação categórica;
- não alterar eventos ou resultados da simulação;
- não depender da interface para gerar ou armazenar o conteúdo jornalístico.

### 5.3 Inteligência

Responsabilidades:

- organizar séries históricas disponíveis;
- calcular indicadores derivados com fórmula documentada;
- identificar variações relevantes e possíveis anomalias;
- gerar alertas rastreáveis aos dados que os motivaram;
- disponibilizar consultas para a Interface.

Limites:

- não alterar os dados de origem;
- não confundir correlação com causalidade;
- não emitir alertas sem regra ou limiar documentado;
- não inventar histórico anterior ao início dos registros;
- não apresentar projeções como resultados observados.

## 6. Eventos e fechamento mensal

O fechamento mensal é um ponto de integração sensível. A implementação existente deve ser consultada antes de qualquer alteração.

O evento `economy:month-closed` foi identificado como referência relevante no fluxo atual. Seu uso deve ser confirmado no código da branch-base antes de criar assinaturas ou dependências.

Regras de integração:

1. O módulo consumidor deve reagir ao fechamento oficial, e não criar seu próprio fechamento.
2. A mesma edição ou conjunto de alertas não pode ser gerado duas vezes para o mesmo período.
3. A geração deve ser determinística quando receber os mesmos dados e a mesma configuração.
4. Falha no Jornal ou na Inteligência não pode interromper o fechamento econômico.
5. Falha de apresentação não pode desfazer uma atualização válida da simulação.
6. Se o evento atual não fornecer dados suficientes, o consumidor deve consultar uma API pública ou solicitar uma extensão mínima e documentada.

Não assumir que o evento carrega todos os dados necessários. Conferir seu payload real.

## 7. Histórico, persistência e partidas

Antes de implementar persistência, verificar o mecanismo atual de salvar, carregar e reiniciar partidas. A arquitetura anteriormente analisada indicou limitações nessa área; não presumir que exista save/load completo.

Requisitos:

- registros devem pertencer a uma partida específica;
- reiniciar uma partida não pode misturar o histórico anterior com o novo;
- carregar uma partida deve restaurar ou reconstruir os dados derivados de modo consistente;
- não duplicar edições ou alertas após recarregar;
- histórico ausente deve ser tratado como indisponível, não reconstruído por adivinhação.

Se não houver mecanismo confiável de identificação de partida, documentar a necessidade antes de criar soluções locais incompatíveis.

## 8. Isolamento de arquivos e conflitos

Cada agente deve priorizar arquivos próprios:

| Frente | Área preferencial |
|---|---|
| Interface | `src/ui/`, `index.html`, `style.css` |
| Jornal | `src/newspaper/` |
| Inteligência | `src/intelligence/` |

Essas áreas são preferenciais, não uma afirmação de que todos os diretórios já existam.

Arquivos compartilhados como `src/core/`, `src/economy/`, `src/society/`, `src/politics/`, `src/institutions/`, `src/services/`, `index.html`, `style.css`, `package.json` e o executor de testes exigem cautela.

Se uma frente precisar alterar arquivo fora de sua área:

1. explicar por que a alteração é necessária;
2. identificar impacto nas outras frentes;
3. propor a menor mudança possível;
4. não sobrescrever trabalho de outro agente;
5. registrar a alteração no relatório de entrega.

## 9. Branches e fluxo de trabalho

Cada agente deve:

- trabalhar em branch exclusiva, criada a partir da mesma base aprovada;
- confirmar o SHA da base antes de começar;
- não usar a branch `economia estável`;
- não fazer merge em `main`;
- não fazer merge de outra frente;
- não usar force-push;
- publicar commits e informar o SHA final;
- entregar relatório de arquivos alterados, testes e limitações.

Se a base comum não estiver disponível ou houver divergência entre branches, interromper a implementação e informar o problema. Não escolher uma base por suposição.

## 10. Critérios mínimos de aceitação

### Integração geral
- A simulação continua funcionando sem Jornal e sem Inteligência.
- A falha de um módulo consumidor não interrompe os demais.
- Nenhuma regra econômica ou social é alterada.
- Não há duplicação de registros por período.
- Os módulos usam o mesmo período oficial.

### Interface
- Exibe dados provenientes dos módulos reais.
- Calendário visual não altera o calendário econômico.
- Gráficos, Jornal e alertas são apresentados sem duplicar suas fontes.

### Jornal
- Cada notícia pode ser rastreada até fatos registrados.
- Não inventa fatos quando faltam dados.
- Não duplica edições ao repetir o fechamento ou recarregar a partida.

### Inteligência
- Cada indicador derivado tem fórmula e unidade documentadas.
- Cada alerta informa a condição que o disparou.
- Ausência de histórico não gera valores artificiais.

### Qualidade técnica
- testes automatizados dos módulos;
- testes de integração com a Economia real;
- `npm run build`;
- `npm test`;
- `git diff --check`;
- relatório de testes efetivamente executados.

## 11. Entrega obrigatória de cada agente

Cada agente deve entregar:

1. branch e SHA da base;
2. branch e SHA final;
3. lista de arquivos criados e alterados;
4. descrição objetiva do que foi implementado;
5. contratos, eventos e APIs consumidos;
6. alterações feitas em arquivos compartilhados e justificativa;
7. testes executados e resultados;
8. limitações conhecidas;
9. exemplo real de saída usando dados da simulação;
10. instruções para integração posterior.

Não declarar teste aprovado se ele não foi executado. Não declarar integração concluída enquanto depender de código ainda não publicado por outra frente.

## 12. Fora do escopo desta versão

Este documento não autoriza:

- reescrever ou balancear o motor econômico;
- alterar fórmulas, parâmetros ou regras de simulação;
- integrar fiscalmente os Serviços Públicos;
- criar eleições populares, legislação ou votação de leis;
- criar uma segunda passagem de tempo;
- fazer merge automático ou publicar alterações diretamente em `main`;
- integrar branches sem auditoria de compatibilidade.

## 13. Decisão de integração

A integração das três frentes deve ocorrer somente depois que cada branch estiver publicada e auditada.

Ordem recomendada:

1. confirmar que as três branches partem da mesma base;
2. auditar cada entrega isoladamente;
3. identificar arquivos compartilhados e conflitos;
4. integrar primeiro contratos e APIs necessários;
5. integrar cada módulo separadamente;
6. executar testes unitários, integração real e build após cada etapa;
7. validar o jogo completo antes de qualquer merge em `main`.

**Regra final:** o motor produz os fatos; Jornal, Inteligência e Interface os organizam e apresentam. Nenhuma dessas camadas pode reescrever a realidade da simulação.
