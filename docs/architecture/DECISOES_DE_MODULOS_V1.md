# Regras de manutenção dos módulos

Este é o contrato normativo atual para novas alterações. Consulte `CONTRATOS_E_EVENTOS_V1.md` para a matriz de tópicos e `ARQUITETURA_GERAL_V1.md` para o desenho geral.

## Identidade e versão

- Registre `id`, `version`, `name`, `description` e dependências Runtime realmente necessárias.
- Use IDs estáveis e namespaces de evento próprios do domínio.
- O registro deve ser único e dependências precisam existir antes do módulo dependente.
- Não declare relações conceituais do modelo como dependências Runtime se o Core não as verifica.

## Estado e propriedade

- Cada domínio mantém seu estado e publica snapshot copiado.
- Não escreva diretamente em `S`, contas, domicílios, pessoas ou DOM privado de outro módulo.
- A integração econômica que afeta dinheiro, orçamento, saldo, folha, estoque ou ativo deve ser validada e lançada pelo módulo Economia.
- O diretório de população do Core recebe grupos econômicos agregados e extensões em namespace. IDs são únicos após normalização textual; colisão deve ser rejeitada antes da substituição.

## Eventos e calendário

- Use `economy:month-closed` como sinal do fechamento econômico; leia o mês do payload, com relógio do Runtime apenas como fallback.
- Consumidores mensais devem rejeitar reprocessamento do mesmo mês e não avançar calendário para trás.
- O calendário operacional do Runtime/Economia usa 30 dias por mês e 12 meses por ano.
- Reentregas de impactos devem possuir critério de idempotência (por mês/eventId) antes de aplicar ajustes cumulativos.
- Cancelar listeners ao desmontar um adaptador.

## Reset, salvamento e UI

- Assine `game:reset` e limpe snapshots/históricos conforme o domínio; espere sincronização da nova partida se depender de grupos econômicos.
- Não assumir save completo: ele ainda não está implementado. Toda serialização parcial deve declarar seu escopo.
- Renderizadores recebem `(state, host)` e escapam conteúdo dinâmico.
- Painéis usam CSS responsivo local e DOM semântico, evitando duplicar tokens globais.

## Testes de cada alteração

Rode `npm run build` e `npm test`. Mudanças de contrato devem incluir teste de unidade e integração do Runtime. Mudanças de interface devem verificar ordem única de scripts, caminhos servidos e atualização pós-fechamento. Mudanças econômicas exigem manter auditorias de caixa, balanços, reconciliação do PIB e testes de horizonte longo/múltiplas sementes.
