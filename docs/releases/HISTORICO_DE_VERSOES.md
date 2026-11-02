# Histórico de versões e releases

Este arquivo registra o estado do repositório e não afirma que uma release foi publicada. Consulte tags/releases do GitHub para artefatos oficiais.

| Versão/identificador | Estado | Conteúdo relevante |
|---|---|---|
| Economia 3.0.0 | Base da aplicação preservada | Motor econômico, contas, empresas, trabalho, relatórios, auditorias e testes de estresse. |
| Core 0.1.0 | Base modular | Runtime, calendário, população, eventos, sessão e registro de módulos. |
| Sociedade 1.0.0 | Integrada | Demografia, migração, cultura, qualidade de vida parcial e reconciliação com Core/Economia. |
| Política 1.0.0 | Integrada nesta branch | Dez grupos de interesse, composição/medição, influência, relação com governo e impactos. |
| Instituições 1.0.0 | Integrada nesta branch | Representação, assentos, maioria, coalizão, oposição e mandatos. |
| Serviços 1.0.0 | Integrado nesta branch | Sete domínios, recursos estratégicos, alavancas e efeitos cruzados com dados de cenário. |
| Vilarejo `3.1.0` | `package.json` | Versão declarada do pacote; não é uma tag de release publicada por este trabalho. |
| `integracao-governo-1.0` | Origem do trabalho integrado | Branch preservada como origem das etapas e dos módulos; não foi alterada por esta reconciliação. |
| `reconciliacao-final` | Branch de reconciliação | Baseada em `main` após Etapa 3; preserva Instituições/UI atuais e agrega Core, Sociedade, Serviços, integração real, segurança HTTP, documentação e CI. Não mesclada automaticamente na `main`. |

## Evidências históricas da integração original

No checkout original de `integracao-governo-1.0`, antes da reconciliação com a Etapa 3:

- `npm ci --ignore-scripts --no-audit --no-fund`: concluído sem dependências externas.
- `npm run build`: passou.
- `npm test`: passou com 98 verificações do runner, 15 testes da Sociedade, 21 de Política, 16 de Instituições e 23 de Serviços, além de 1 teste de integração do Runtime e 1 smoke test HTTP. Estes totais são um registro histórico daquele checkout, não a validação do merge atual.
- A suíte interna econômica executou 61 cenários; o runner também verificou horizontes de até 240 meses e 24 sementes × 240 meses.

## Validação local de `reconciliacao-final`

- `npm ci --ignore-scripts --no-audit --no-fund`: concluído.
- `npm run build`: passou.
- `npm test`: passou com 102 verificações do runner, 16 testes da Sociedade, 21 de Política, 22 de Instituições e 23 de Serviços.
- A integração real da Economia com Core, Sociedade, Política, Instituições e Serviços passou em 12, 24 e 60 meses, incluindo imigração determinística, reset/replay e auditorias mensais de caixa, SFC e contas nacionais. Os smoke tests HTTP verificaram os oito módulos JavaScript e rejeição de caminhos proibidos.
- CI remoto de `push`: [run 41537618119](https://github.com/rafaeldornela-boop/Vilarejo/actions/runs/41537618119) — Node 18 e 22 aprovados.
- CI remoto de `pull_request`: [run 41537754525](https://github.com/rafaeldornela-boop/Vilarejo/actions/runs/41537754525) — Node 18 e 22 aprovados.

Os resultados referem-se ao commit de reconciliação e devem ser reexecutados se o código da branch mudar.

## Compatibilidade

A declaração de suporte é Node.js 18 ou superior. O workflow CI roda Node 18 e 22. O lockfile contém apenas o pacote local, sem dependências externas.
