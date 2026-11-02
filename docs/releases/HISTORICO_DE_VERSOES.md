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
| `integracao-governo-1.0` | Branch de trabalho | Organização dos módulos, interface, contratos, testes, documentação e CI. Não mesclada automaticamente na `main`. |

## Evidências de validação da branch

Na execução reportada durante a implementação:

- `npm ci --ignore-scripts --no-audit --no-fund`: concluído sem dependências externas.
- `npm run build`: passou.
- `npm test`: passou com 98 verificações do runner, 15 testes da Sociedade, 21 de Política, 16 de Instituições e 23 de Serviços, além de 1 teste de integração do Runtime e 1 smoke test HTTP.
- A suíte interna econômica executou 61 cenários; o runner também verificou horizontes de até 240 meses e 24 sementes × 240 meses.

Os resultados são datados do checkout desta branch e devem ser reexecutados antes de uma publicação posterior.

## Compatibilidade

A declaração de suporte é Node.js 18 ou superior. O workflow CI roda Node 18 e 22. O lockfile contém apenas o pacote local, sem dependências externas.
