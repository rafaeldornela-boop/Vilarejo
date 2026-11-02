# Contrato de módulos do Vilarejo

## Contrato mínimo

Todo módulo deve conter:

- `id`
- `version`
- `name`
- `description`
- `dependencies`

## Ciclo de vida sugerido

- registro
- sincronização do estado
- atualização de snapshot
- publicação de eventos
- desligamento ou remoção segura

## Regras

- Dependências devem ser verificadas antes do uso.
- O núcleo deve coordenar o estado global.
- Módulos de Economia e Núcleo devem se comunicar por eventos.
- Snapshot e estado interno devem ser serializáveis e auditáveis.

## Boas práticas

- documentar API pública
- evitar acoplamento direto entre módulos
- manter testes de regressão por contrato
- garantir compatibilidade com o runtime existente
