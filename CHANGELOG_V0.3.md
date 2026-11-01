# Changelog | Sociedade v0.3

## Novidades
- Cadastro demográfico individual dentro de cada domicílio econômico.
- Envelhecimento, maioridade, aposentadoria, nascimentos e mortalidade.
- Histórico de migração com entradas, saídas e saldo.
- Integração com o mecanismo Harris-Todaro existente.
- Identificadores únicos para novos domicílios migrantes.
- Composição cultural, diversidade e integração de migrantes.
- Índice provisório de qualidade de vida com seis dimensões ponderadas.
- Painel visual de sociedade, cultura, migração e qualidade de vida.

## Preservação
- `S.households` continua como unidade financeira.
- O módulo demográfico não altera caixa, depósitos ou crédito.
- O motor econômico e os balanços SFC permanecem como fonte dos indicadores econômicos.

## Limites
- Saúde, educação, segurança, saneamento, ambiente e cultura/lazer ainda não são medidos.
- O IQV é um indicador de jogo provisório, não um índice estatístico oficial.
- A migração usa os critérios Harris-Todaro já existentes.
- Sincronização do cadastro individual com alterações no status de participação da força de trabalho.
- Proteção do limite de três filhos por domicílio considerando gestações em andamento e nascimentos do próprio mês.
