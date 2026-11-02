# Arquitetura modular do Vilarejo

## Objetivo

Separar responsabilidades para preservar a Economia 3.0, manter o Núcleo Central consistente e preparar a base para novos módulos sem reescrever o sistema atual.

## Camadas principais

1. Núcleo central
   - calendário e tempo da simulação
   - estado da sessão e partida
   - registro de módulos
   - barramento de eventos
   - snapshots compartilhados

2. Economia
   - produção
   - mercado
   - salários e encargos
   - crédito e bancos
   - tesouro e contas nacionais

3. Módulos futuros
   - Sociedade
   - Política
   - Legislação
   - Infraestrutura e decisões institucionais

4. Interface e recursos
   - renderização da tela
   - controles do usuário
   - ativos visuais
   - mídia e recursos auxiliares

## Regras de integração

- O Núcleo Central deve ser a fonte de verdade para calendário e eventos.
- Módulos não devem alterar o estado bruto do outro módulo diretamente, sem contrato.
- Cada módulo deve publicar eventos relevantes e expor snapshot de estado.
- A criação de módulos novos deve seguir as dependências já declaradas no núcleo.

## Estado atual

A lógica funcional atual da Economia e do motor de eventos foi preservada. A reorganização se concentra em clareza estrutural, manutenção e evolução sem regressão.
