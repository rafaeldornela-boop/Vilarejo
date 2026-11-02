# Vilarejo | Refatoração do módulo Sociedade 1.0.0

Esta entrega substitui o acoplamento do antigo `sociedade_v03.js` por um módulo próprio, carregado depois do Core e da Economia.

## Arquivos

- `src/society/vilarejo_society.js`: módulo Sociedade 1.0.0.
- `src/test/society_test.js`: 11 testes automatizados independentes.
- `integration.patch`: inclusão do script na ordem correta em `index.html`.
- `docs/arquitetura/REFATORACAO_SOCIEDADE_V1.md`: contrato, limites e decisões arquiteturais.

## Aplicação

Na raiz do repositório:

```bash
# Copie a pasta src/society desta entrega para a raiz do projeto.
# Depois aplique o patch de integração:
git apply integration.patch

# Testes focados da Sociedade:
node src/test/society_test.js

# Depois, execute também a suíte de regressão econômica:
node src/test/test_runner.js
```

O módulo é carregado após `src/economy/script.js`, registra `sociedade` no Runtime e acompanha o evento `economy:month-closed`.

## O que ele não faz

Não altera `S.households`, empregos, `sectorJobs`, salários, caixa, contas, preços, empresas ou produção. Também não injeta dados demográficos na Economia. Ele mantém cadastro individual e entrega uma projeção explícita (`getEconomyProjection`) para uma futura integração controlada.
