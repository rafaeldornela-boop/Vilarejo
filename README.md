# Serviços públicos e desenvolvimento 1.0.0

O pacote cria sete módulos registrados individualmente no Runtime, além de um módulo agregado para o painel do jogador:

- `saude`: acesso, capacidade assistencial, prevenção, resultados, força de trabalho e saúde mental;
- `educacao`: acesso, frequência, aprendizagem, infraestrutura e qualificação;
- `seguranca`: prevenção, resposta, investigação, capacidade de justiça e confiança pública;
- `ciencia`: pesquisa básica e aplicada, inovação, difusão tecnológica e talentos;
- `desenvolvimento`: infraestrutura, logística, habitação, produtividade e equilíbrio regional;
- `cultura`: acesso, patrimônio, economia criativa, participação e diversidade;
- `infraestrutura`: saneamento, água, eletricidade, petróleo e gás, mineração e governança de recursos.

## Contratos e limites

Os sete domínios são registrados no Core. O módulo agregado `servicos` mantém o estado compartilhado, fecha mês a mês com `economy:month-closed` e publica `services:month-closed`. A interface apresenta indicadores, prioridades e controles de intensidade de política.

Os valores iniciais são parâmetros de cenário, não dados empíricos. Os indicadores são índices abstratos de 0 a 100. Petróleo e minerais têm reservas finitas no modelo; água possui recarga simplificada; eletricidade possui geração, demanda e confiabilidade. A extração mineral aumenta pressão ambiental, moderada pela governança. Produção mineral e governança mineral são alavancas separadas.

As relações entre áreas são explícitas em `CROSS_EFFECTS`: saneamento e água afetam saúde; energia sustenta capacidade assistencial; educação forma talentos; ciência e qualificação afetam produtividade; cultura pode fortalecer participação e frequência escolar.

## O que ainda não está conectado

Os controles alteram prioridades/intensidade e os efeitos aparecem nos fechamentos mensais. Nesta versão, eles **não debitam dinheiro do caixa**, não contratam servidores, não criam obras físicas e não consomem insumos da Economia. O vínculo fiscal e operacional precisa ser feito depois, com contratos específicos de orçamento, folha, compras, estoque, infraestrutura e execução. Não se deve interpretar o índice de política como gasto realizado.

Também não há ainda simulação epidemiológica detalhada, rede escolar por unidade, criminalidade por tipo, sistema de patentes, portfólio de projetos de P&D, cadeia completa de petróleo/mineração ou gestão ambiental abrangente. Esses são aprofundamentos futuros.
