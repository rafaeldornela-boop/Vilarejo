# Vilarejo v2.5 | Sociedade, cultura, migração e qualidade de vida

## O que entra nesta versão

A v0.3 acrescenta uma camada demográfica e social ao motor econômico existente, mantendo `S.households` como unidade financeira. Cada domicílio passa a conter um vetor `members` com pessoas individualizadas. Isso permite registrar idade, sexo, origem, grupo cultural, integração, tempo de residência e gestação sem substituir as contas bancárias dos domicílios.

### Demografia
- Pessoas individualizadas dentro dos domicílios.
- Envelhecimento mensal, passagem para a vida adulta aos 18 anos e classificação de idosos a partir dos 65.
- Nascimentos após período gestacional e mortalidade probabilística por faixa etária.
- Atualização de adultos, crianças, aposentados e força de trabalho a partir das pessoas registradas.

### Migração e cultura
- Registro de entradas, saídas, saldo mensal e saldo acumulado de pessoas e domicílios.
- Integração com a decisão migratória Harris-Todaro já existente no jogo.
- Correção da colisão de identificadores: novos domicílios recebem ID acima do maior ID existente.
- Registro de origem cultural dos novos migrantes: regional, urbana ou rural.
- Índice descritivo de diversidade cultural e índice médio de integração dos migrantes.
- A diversidade cultural não é tratada automaticamente como bônus ou problema. O módulo não cria penalidades por origem.

### Indicador de qualidade de vida

O Índice de Qualidade de Vida (IQV) é uma métrica interna provisória, de 0 a 100, composta por:

| Dimensão | Peso |
|---|---:|
| Poder de compra | 22% |
| Segurança alimentar | 22% |
| Emprego | 16% |
| Capacidade habitacional | 12% |
| Infraestrutura | 12% |
| Bem-estar declarado pelas famílias | 16% |

O painel mostra o valor geral, nível, variação mensal, componentes, diferença de bem-estar entre domicílios, demografia, dependência etária, migração e composição cultural.

**Limite deliberado:** saúde, educação, segurança pública, saneamento, meio ambiente e cultura/lazer ainda não entram no IQV porque o jogo não mede esses resultados. A capacidade habitacional também é uma aproximação baseada na capacidade urbana, não uma medição completa da qualidade das moradias. Os pesos e parâmetros precisam de calibração em simulações mais longas.

## Como a migração funciona nesta versão

A decisão de migrar continua sendo calculada pelo mecanismo Harris-Todaro já existente. A v0.3 não substitui seus critérios econômicos; ela registra cada movimento, adiciona a pessoa ao cadastro individual ou registra sua saída, atribui origem cultural e atualiza os indicadores sociais. O mecanismo anterior considera atratividade econômica, custo de migração, disponibilidade de trabalho e capacidade habitacional.

## Integridade econômica

A camada social não cria nem destrói caixa, depósitos ou crédito. `S.households` continua sendo a unidade financeira. As pessoas são registros demográficos anexados aos domicílios. A entrada e a saída migratória continuam usando o fluxo financeiro do mecanismo econômico existente.

## Instalação

1. Faça um commit ou backup do repositório.
2. Extraia todos os arquivos deste pacote na raiz do projeto `Vilarejo`, preservando os nomes.
3. Execute na raiz:

   ```bash
   node integrar_vilarejo_v03.js
   ```

4. Execute:

   ```bash
   npm install
   npm test
   ```

5. Só publique as alterações se todas as suítes passarem.

O instalador aplica primeiro a base de evolução social v0.2 e, em seguida, conecta a v0.3 ao motor. Ele valida os pontos de integração, cria backups em `.vilarejo-backup-v02/` e `.vilarejo-backup-v03/`, atualiza a versão do projeto para `2.5.0` e se protege contra a execução duplicada. Se o código-base não corresponder à versão esperada, ele interrompe a instalação.

## Testes

- Evolução Social v0.2: 30 testes unitários.
- Sociedade v0.3: 20 testes unitários.
- Integração v0.2: 6 testes com `jsdom`.
- Integração v0.3: 5 testes com `jsdom`.
- A suíte econômica e contábil já existente continua no `npm test`.

Neste pacote, os 30 testes unitários da v0.2 e os 20 testes unitários da v0.3 foram executados e passaram. A suíte de integração depende de `jsdom`, declarado em `devDependencies`; ela deve ser executada no ambiente do projeto por `npm test`.

## Próximo passo recomendado

Calibrar o IQV com simulações de 5, 10 e 20 anos, analisar sua sensibilidade a choques e só então incorporar saúde, educação, segurança, saneamento e cultura/lazer, quando esses serviços tiverem produção, custos, pessoal e efeitos mensuráveis.
