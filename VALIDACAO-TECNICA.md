# Validação técnica do redesign + calendário

## Verificações executadas no pacote

- `node --check` em `scripts/install.js` e `src/ui/dashboard.js`.
- Instalação simulada em uma estrutura de repositório de teste; confirmou cópia dos arquivos e criação do backup.
- Teste DOM simulado da camada visual; confirmou a renderização de 30 dias no mês corrente, os marcadores econômicos e o avanço de 02/11/2026 para 03/11/2026 quando o dia da simulação muda de 149 para 150.
- Verificação estrutural do HTML: IDs únicos e presença dos dez gráficos e dos elementos do calendário.
- O calendário usa a data local no início de cada sessão e mantém a progressão gregoriana, incluindo fevereiro bissexto, independente do ciclo econômico de 30/360 dias.
- O relógio econômico continua separado: 30 dias por ciclo mensal e 360 dias por ano econômico.

## Pendente antes de publicar

A conexão GitHub disponível nesta sessão permitiu leitura, mas recusou gravações com HTTP 403. Por isso, nenhum commit foi feito no repositório remoto.

A suíte oficial deve ser executada na cópia local atualizada:

```bash
npm run build
npm test
```

Depois, validar visualmente no navegador Começar, Pausar, Acelerar, Reiniciar, eventos, políticas, calendário e gráficos após alguns fechamentos mensais.

## Limites dos indicadores

O histórico começa no primeiro fechamento após a instalação. O índice de desigualdade é uma aproximação per capita que distribui a renda familiar igualmente entre os integrantes de cada domicílio; não é uma medida individual observada. O salário real é um índice de referência baseado no salário modelado, no salário mínimo e no custo de vida local.
