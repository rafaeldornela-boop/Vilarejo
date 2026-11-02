# Vilarejo

## Visão geral

O Vilarejo é um simulador econômico didático em JavaScript com núcleo central, integração de eventos e sincronização de estado entre módulos.

## Estrutura atual

- `src/` — base arquitetural do projeto, organizada por responsabilidade.
- `docs/` — documentação ativa, arquitetura, releases e publicações.
- `index.html` — camada visual e carregamento de runtime.
- `vilarejo_core.js` — núcleo central (compatibilidade preservada).
- `eventos_v3.js` — motor de eventos (compatibilidade preservada).
- `script.js` — lógica econômica principal (compatibilidade preservada).
- `server.js` — servidor HTTP estático.
- `test_runner.js` — suíte automatizada.

## Organização profissional adotada

- `src/core/` — calendário, sessão, runtime, eventos e infraestrutura do núcleo.
- `src/economy/` — produção, crédito, contas nacionais, mercado e finanças.
- `src/modules/` — módulos futuros e integrações do sistema.
- `src/shared/` — utilitários, helpers e contratos compartilhados.
- `src/tests/` — testes de integração e regressão.
- `src/ui/` — componentes visuais e renderização.
- `src/assets/` — recursos visuais e mídias.

## Documentação ativa

- [docs/README.md](docs/README.md)
- [docs/arquitetura/ARQUITETURA_MODULAR_V0.1.md](docs/arquitetura/ARQUITETURA_MODULAR_V0.1.md)
- [docs/arquitetura/CONTRATO_DE_MODULOS_V1.md](docs/arquitetura/CONTRATO_DE_MODULOS_V1.md)
- [docs/publicacao/GUIA_PUBLICACAO_GITHUB.md](docs/publicacao/GUIA_PUBLICACAO_GITHUB.md)
- [docs/releases/RELEASE_ECONOMIA_3_0_E_NUCLEO_0_1.md](docs/releases/RELEASE_ECONOMIA_3_0_E_NUCLEO_0_1.md)

## Validação

A aplicação e os testes devem continuar sendo executados a partir dos scripts existentes no repositório, enquanto a estrutura modular entra em fase de organização e compatibilidade.

## Regras de manutenção

- A documentação ativa deve ficar em `docs/`.
- A lógica de runtime deve respeitar o núcleo central e o barramento de eventos.
- A Economia deve continuar sendo a referência funcional do projeto.
- Alterações de arquitetura não devem quebrar os contratos existentes.
