# Vilarejo | Gabinete e Administração Executiva 2.0

Módulo administrativo independente para simular **como o Executivo municipal se organiza, coordena pessoas, acompanha prioridades e cobra entregas**. Não substitui o Governo/Política, as Instituições, os serviços públicos nem o motor fiscal/econômico.

## O que ele faz

1. **Estrutura administrativa:** criar, encerrar e fundir secretarias; transferir titularidade; manter histórico.
2. **Equipe de governo:** nomear, substituir e exonerar secretários; registrar formação, competências, perfil qualitativo e avaliações periódicas.
3. **Planejamento:** criar metas com indicador, linha de base, alvo, unidade, direção (aumentar/diminuir), prazo, evidências e situação.
4. **Projetos:** organizar projetos por secretaria, prioridade, custo estimado, metas vinculadas, marcos e situação.
5. **Coordenação:** reuniões, participantes, pautas, decisões, responsáveis, prazos e pendências.
6. **Problemas administrativos:** registrar gargalos e conflitos entre secretarias, gravidade, responsáveis, prazo, andamento e solução.
7. **Orçamento administrativo:** secretarias solicitam recursos; o Executivo registra aprovação, rejeição ou devolução. A aprovação **não** empenha nem gasta dinheiro. O módulo fiscal devolve a referência de empenho/execução.
8. **Rotina mensal:** revisão de metas atrasadas, pendências vencidas, projetos ativos, solicitações pendentes e problemas abertos.
9. **Rastreabilidade:** trilha de auditoria, caixa de saída de eventos (outbox), exportação/importação e migração do estado 1.0.

## O que ele não faz, deliberadamente

- Não cria nem movimenta dinheiro, orçamento, dívida, receita, despesa ou folha.
- Não contrata servidores, não altera emprego, salários ou produtividade automaticamente.
- Não muda diretamente saúde, educação, segurança, infraestrutura, satisfação, aprovação popular, PIB ou qualquer indicador social/econômico.
- Não aprova leis, não forma coalizões, não calcula apoio parlamentar e não substitui o módulo de Política/Instituições.
- Não executa obras nem entrega serviços: registra planejamento e acompanha resultados que devem chegar por dados dos módulos responsáveis.
- Não simula ainda intrigas, corrupção, lealdade dinâmica ou personalidade autônoma dos secretários. Os atributos de perfil são dados de contexto, não motores de efeito.

Essas fronteiras são essenciais: o Gabinete organiza e coordena. Os módulos especializados continuam sendo a fonte da verdade sobre seus próprios resultados.

## Arquivos

- `src/executive/vilarejo_executive.js`: biblioteca UMD, sem dependências externas, compatível com Node e navegador.
- `test/executive_test.js`: testes automatizados nativos do Node.
- `docs/CONTRATO_INTEGRACAO.md`: contrato de integração e eventos.
- `docs/CAPACIDADES_E_LIMITES.md`: definição funcional do módulo.

## Testes

```bash
node test/executive_test.js
```

## Uso mínimo

```js
const Executive = require('./src/executive/vilarejo_executive.js');
const gabinete = Executive.createState({ executiveTitle: 'Prefeito' });

const titular = Executive.appointSecretary(gabinete, {
  departmentId: 'health',
  name: 'Ana Souza',
  background: 'Gestora pública',
  skills: { technical: 85, management: 80, integrity: 90 }
});

const meta = Executive.addGoal(gabinete, 'health', {
  title: 'Reduzir tempo de espera', indicator: 'Espera média',
  baseline: 90, target: 45, direction: 'decrease', unit: 'dias', deadlineMonth: 8
});

Executive.updateGoal(gabinete, 'health', meta.id, {
  current: 72, evidence: 'Boletim mensal da Saúde', source: 'health-module'
});

console.log(Executive.getSnapshot(gabinete).summary);
```

## Regras importantes de implementação

- Cada operação de escrita é transacional: valida em uma cópia, e só substitui o estado original se a operação inteira for válida.
- Como a transação substitui os objetos internos, **não guarde referências diretas** a secretarias, pessoas ou metas entre operações. Guarde IDs e consulte `getSnapshot()`.
- `getSnapshot()` devolve uma cópia. Alterar o snapshot não altera o estado do jogo.
- O relógio administrativo é mensal e não retrocede. `advanceMonth(state, n)` processa cada mês intermediário.
- Eventos ficam na outbox até o consumidor confirmar seu processamento com `acknowledgeEvents()`. O consumidor deve tratar o `id` do evento como chave de idempotência.
- O estado 1.0 deve passar por `migrateV1ToV2()` antes de ser usado no motor 2.0.

## Compatibilidade

Versão do módulo: `2.0.0`. Schema: `2`. Não carregue esta versão junto com a 1.0 no mesmo runtime. A integração na aplicação principal deve ocorrer somente após revisão do contrato por quem mantém o runtime.
