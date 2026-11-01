# VILAREJO | Catálogo legislativo expandido

**Versão:** proposta conceitual v0.5.0  
**Status:** laboratório de desenho e validação. Não implementado, não integrado ao ciclo mensal e não publicado no GitHub.  
**Escopo:** 100 propostas de normas, distribuídas em seis segmentos.

---

## 1. Objetivo desta versão

A versão 0.4 organiza a arquitetura do sistema legal e contém 18 modelos de políticas públicas. Esses modelos não equivalem a um catálogo jurídico completo. Uma política como “educação básica” pode depender de várias normas diferentes: acesso obrigatório, financiamento, padrões de qualidade, direitos dos estudantes, carreira dos profissionais e fiscalização.

Esta versão amplia o universo legislativo sem transformar cada ideia em código. O objetivo é criar uma biblioteca de normas que possa ser debatida, classificada, combinada, testada e, só depois, convertida em regras executáveis.

As 100 propostas são abstrações de design para o Vilarejo. Não são minutas legais, não reproduzem integralmente a legislação brasileira e não pressupõem que todas possam ser aprovadas pelo governo local. A competência legislativa precisa ser definida para cada norma.

## 2. Regra de arquitetura: norma não é execução

O sistema deve respeitar quatro camadas distintas:

1. **Norma jurídica:** estabelece direito, dever, limite, proibição, competência, incentivo ou sanção.
2. **Política pública:** organiza objetivos, público-alvo, critérios, metas, orçamento e forma de atendimento.
3. **Executor setorial:** contrata pessoas, compra insumos, constrói ativos, fiscaliza, presta serviços e entrega resultados físicos.
4. **Núcleo SFC:** registra caixa, compromissos, pagamentos, receitas, passivos, ativos, estoques e contrapartidas patrimoniais.

A aprovação de uma lei não deve criar automaticamente uma escola, hospital, estrada, emprego, receita, transferência paga ou redução de poluição. Ela cria uma regra ou obrigação. O resultado só aparece quando houver capacidade operacional, recursos, comportamento dos agentes e tempo de execução.

## 3. Como ler o catálogo

Cada proposta contém:

- **Regra proposta:** o que a norma estabelece.
- **Efeito esperado no jogo:** por qual canal a regra altera o comportamento ou o estado da sociedade.
- **Dependências e riscos:** quais outros sistemas precisam existir e quais efeitos colaterais devem ser testados.

### Prioridade conceitual

- **Fundacional:** regras necessárias para a sociedade operar com direitos, mercados e administração minimamente estruturados.
- **Expansão:** regras que se tornam relevantes com maior população, diversidade de empresas e infraestrutura.
- **Maturidade:** regras para economia diversificada, instituições complexas e problemas sistêmicos.

A prioridade não significa que a norma será desbloqueada por nível. Significa apenas que sua utilidade e viabilidade dependem do estágio real de desenvolvimento da sociedade.

---

# 4. Segmento econômico

**Foco:** relações de mercado, empresas, trabalho, consumo, crédito, tributos, concorrência e propriedade econômica. O segmento não deve assumir competências que pertençam a outra esfera de governo.

### ECO-01 | Liberdade de entrada e exercício de atividade econômica
**Prioridade:** Fundacional.  
**Regra proposta:** permitir abertura e encerramento de negócios mediante requisitos proporcionais ao risco da atividade, evitando licenças desnecessárias.  
**Efeito esperado:** reduz custo e tempo de entrada, favorece criação de empresas e concorrência.  
**Dependências e riscos:** precisa de cadastro empresarial, fiscalização baseada em risco e regras ambientais, sanitárias e territoriais. Desregulamentação indiscriminada pode aumentar acidentes e externalidades.

### ECO-02 | Registro empresarial e identificação dos responsáveis
**Prioridade:** Fundacional.  
**Regra proposta:** exigir registro mínimo da atividade, responsáveis, propriedade, setor e situação operacional.  
**Efeito esperado:** melhora a informação econômica, a arrecadação, a fiscalização e a análise de crédito.  
**Dependências e riscos:** integração com cadastro de agentes e proteção de dados. Não deve impor custo fixo excessivo a microempreendimentos.

### ECO-03 | Proteção das relações de trabalho
**Prioridade:** Fundacional.  
**Regra proposta:** definir requisitos básicos de contratação, remuneração, formalização, registros e encerramento do vínculo.  
**Efeito esperado:** altera custo de contratação, renda disponível, segurança do trabalhador e formalização.  
**Dependências e riscos:** a folha deve separar salário bruto, descontos, encargos e salário líquido. Não contabilizar a mesma despesa duas vezes na produção e na DRE.

### ECO-04 | Piso remuneratório e proteção do salário
**Prioridade:** Fundacional.  
**Regra proposta:** estabelecer remuneração mínima aplicável e regras de pagamento pontual, descontos e proteção contra retenção indevida.  
**Efeito esperado:** eleva a renda de trabalhadores abrangidos e o custo de empresas com salários inferiores ao piso.  
**Dependências e riscos:** testar emprego, horas trabalhadas, produtividade, preços, informalidade e capacidade de pagamento das empresas. O efeito depende do nível do piso em relação à produtividade.

### ECO-05 | Jornada, descanso e horas extraordinárias
**Prioridade:** Fundacional.  
**Regra proposta:** definir limites de jornada, descanso, banco de horas e remuneração adicional quando aplicável.  
**Efeito esperado:** afeta oferta efetiva de trabalho, fadiga, custo unitário e necessidade de novas contratações.  
**Dependências e riscos:** não reduzir automaticamente a produção na mesma proporção da jornada sem considerar produtividade, turnos, tecnologia e reorganização.

### ECO-06 | Saúde e segurança no trabalho
**Prioridade:** Fundacional.  
**Regra proposta:** exigir prevenção de riscos ocupacionais, equipamentos adequados, treinamento, registro de acidentes e reparação conforme responsabilidade.  
**Efeito esperado:** gera custos de adequação e fiscalização, mas reduz acidentes, afastamentos e perda de produtividade.  
**Dependências e riscos:** precisa de fiscalização, capacidade técnica e dados de acidentes. Evitar tratar todo investimento preventivo como despesa improdutiva: parte pode reduzir custos futuros.

### ECO-07 | Sistema tributário e princípios de tributação
**Prioridade:** Fundacional.  
**Regra proposta:** definir quais bases podem ser tributadas, quem é o contribuinte, fato gerador, alíquota, isenções, competência e procedimento de cobrança.  
**Efeito esperado:** modifica renda disponível, custos, preços relativos, decisões de consumo, investimento e arrecadação.  
**Dependências e riscos:** cada tributo precisa de base, competência, período de apuração, devedor, credor e regra de inadimplência. Tributo devido não pago deve virar passivo, não receita de caixa.

### ECO-08 | Tributação da propriedade e da terra
**Prioridade:** Expansão.  
**Regra proposta:** estabelecer tributação periódica de imóveis e terrenos, com critérios de avaliação, isenções e eventual progressividade.  
**Efeito esperado:** cria receita pública recorrente e altera custo de manter imóveis vagos ou subutilizados.  
**Dependências e riscos:** depende de cadastro imobiliário, avaliação minimamente confiável e execução fiscal. Evitar confiscar bem acima do valor da obrigação e considerar capacidade de pagamento.

### ECO-09 | Tributação do consumo e dos serviços
**Prioridade:** Fundacional.  
**Regra proposta:** definir incidência, alíquota, créditos, responsáveis e tratamento de operações entre empresas e consumidores.  
**Efeito esperado:** altera preços finais, custos intermediários, formalização e composição da demanda.  
**Dependências e riscos:** escolher arquitetura de imposto cumulativo ou não cumulativo. O mesmo tributo não pode ser cobrado duas vezes em etapas incompatíveis nem desaparecer sem contrapartida contábil.

### ECO-10 | Tributação do lucro e distribuição de resultados
**Prioridade:** Expansão.  
**Regra proposta:** definir apuração do lucro tributável, compensação de prejuízos, retenção, distribuição e incidência sobre dividendos.  
**Efeito esperado:** altera investimento, poupança empresarial, distribuição aos proprietários e receita pública.  
**Dependências e riscos:** separar lucro contábil de caixa disponível. Distribuição não pode criar dinheiro; retenção de lucro não deve ser tratada como saída de caixa.

### ECO-11 | Defesa da concorrência e controle de abuso de poder econômico
**Prioridade:** Expansão.  
**Regra proposta:** coibir cartel, discriminação injustificada, abuso de posição dominante e práticas que fechem artificialmente o mercado.  
**Efeito esperado:** influencia concentração, margens, entrada de concorrentes, inovação e variedade de produtos.  
**Dependências e riscos:** exige definição de mercado relevante, capacidade de investigação e sanções proporcionais. Empresa grande não deve ser punida apenas por ser eficiente ou ter participação elevada.

### ECO-12 | Defesa do consumidor, qualidade e informação
**Prioridade:** Fundacional.  
**Regra proposta:** exigir informação clara, segurança, garantia, reparação e regras contra práticas comerciais abusivas.  
**Efeito esperado:** reduz assimetria de informação, aumenta confiança e pode elevar custo de conformidade dos fornecedores.  
**Dependências e riscos:** precisa de canais de reclamação, fiscalização e mecanismos de reparação. Sanções devem considerar gravidade, reincidência e dano comprovado.

### ECO-13 | Transparência e responsabilidade no crédito ao consumidor
**Prioridade:** Expansão.  
**Regra proposta:** exigir informação sobre taxa, prazo, encargos, custo total, garantias e consequências do atraso antes da contratação.  
**Efeito esperado:** melhora a comparação de ofertas e pode reduzir endividamento impulsivo e inadimplência.  
**Dependências e riscos:** exige contratos, cadastro de dívidas e proteção de dados. Não deve impedir crédito solvente por restrições genéricas.

### ECO-14 | Garantias, recuperação de crédito e cadastro de risco
**Prioridade:** Maturidade.  
**Regra proposta:** disciplinar garantias, prioridade de recebimento, execução, renegociação e compartilhamento controlado de informações de crédito.  
**Efeito esperado:** altera recuperação esperada dos bancos, custo do crédito, exigência de garantias e acesso de empresas.  
**Dependências e riscos:** precisa de sistema de contratos, garantias e processo de cobrança. Regras excessivamente favoráveis ao credor podem reduzir consumo e investimento após choques.

### ECO-15 | Recuperação empresarial e insolvência
**Prioridade:** Maturidade.  
**Regra proposta:** estabelecer procedimentos de renegociação, recuperação, liquidação, prioridade de credores e encerramento ordenado.  
**Efeito esperado:** reduz incerteza, permite reorganização de empresas viáveis e libera recursos de negócios inviáveis.  
**Dependências e riscos:** requer balanços confiáveis, separação entre principal e juros vencidos, baixa de ativos e reconhecimento de perdas por credores.

### ECO-16 | Empresas públicas, concessões e parcerias
**Prioridade:** Expansão.  
**Regra proposta:** definir quando o governo pode operar diretamente, contratar operador privado, conceder serviço, manter participação societária ou privatizar ativo.  
**Efeito esperado:** altera investimento, eficiência, risco fiscal, qualidade e distribuição de resultados.  
**Dependências e riscos:** separar propriedade do ativo, operação, regulação e financiamento. Concessão não é venda do patrimônio; privatização não é simples mudança de operador.

### ECO-17 | Regulação excepcional de preços e abastecimento
**Prioridade:** Maturidade.  
**Regra proposta:** permitir medidas temporárias em crises definidas, com escopo, prazo, critérios de saída e compensações explícitas quando houver.  
**Efeito esperado:** pode conter picos imediatos, mas também reduzir oferta, reposição e investimento se o preço ficar abaixo do custo sustentável.  
**Dependências e riscos:** testar estoques, elasticidade, importação, produção, margem, subsídio e mercado paralelo. Tabelamento não deve zerar automaticamente a produção.

### ECO-18 | Comércio exterior e operações cambiais
**Prioridade:** Maturidade.  
**Regra proposta:** disciplinar importações, exportações, tarifas, câmbio, pagamentos externos e reservas conforme a competência da jurisdição simulada.  
**Efeito esperado:** influencia preços domésticos, disponibilidade de bens, competitividade, moeda e reservas.  
**Dependências e riscos:** requer setor externo e balanço próprio da autoridade monetária. Importação, exportação e movimento de reservas precisam de contrapartidas explícitas; não confundir reserva internacional com moeda doméstica.

---

# 5. Segmento social

**Foco:** direitos sociais, proteção de grupos, acesso a serviços essenciais e redução de vulnerabilidades. O segmento define garantias e critérios; os serviços precisam de capacidade física e financeira para acontecer.

### SOC-01 | Acesso básico à saúde
**Prioridade:** Fundacional.  
**Regra proposta:** estabelecer cobertura mínima, critérios de acesso, responsabilidades de atendimento e continuidade do cuidado.  
**Efeito esperado:** altera demanda por serviços, saúde da população, faltas ao trabalho e expectativa de vida.  
**Dependências e riscos:** exige unidades, equipes, insumos, orçamento e filas. Aprovar a norma não cria profissionais nem leitos.

### SOC-02 | Prevenção, vacinação e atenção primária
**Prioridade:** Fundacional.  
**Regra proposta:** estabelecer ações preventivas e calendário de imunização conforme riscos e evidências sanitárias.  
**Efeito esperado:** reduz incidência de doenças evitáveis e demanda futura por atendimento de maior complexidade.  
**Dependências e riscos:** necessita de estoque, cadeia de frio, equipes e cobertura real. Os ganhos aparecem com defasagem e podem variar por adesão.

### SOC-03 | Atendimento de urgência e emergência
**Prioridade:** Expansão.  
**Regra proposta:** definir cobertura territorial, tempo-alvo, triagem, encaminhamento e integração com unidades de saúde.  
**Efeito esperado:** reduz mortalidade evitável e consequências de acidentes, mas gera custos fixos e variáveis relevantes.  
**Dependências e riscos:** depende de equipes, instalações, transporte, equipamentos e demanda. Não confundir capacidade instalada com atendimentos realizados.

### SOC-04 | Vigilância epidemiológica e resposta a surtos
**Prioridade:** Expansão.  
**Regra proposta:** criar deveres de notificação, monitoramento, investigação e resposta proporcional a riscos de saúde coletiva.  
**Efeito esperado:** reduz propagação de doenças e permite intervenção mais rápida.  
**Dependências e riscos:** exige dados, capacidade laboratorial ou de diagnóstico, comunicação e protocolos. Medidas restritivas podem afetar atividade econômica e devem ter proporcionalidade e prazo.

### SOC-05 | Acesso à educação básica
**Prioridade:** Fundacional.  
**Regra proposta:** garantir acesso, matrícula, permanência e condições mínimas para educação básica.  
**Efeito esperado:** aumenta escolarização e capital humano no longo prazo; pode reduzir trabalho infantil e desigualdades de oportunidade.  
**Dependências e riscos:** exige escolas, docentes, transporte, alimentação, materiais e capacidade de vagas. Matrícula não é sinônimo de aprendizagem.

### SOC-06 | Padrões de qualidade e avaliação educacional
**Prioridade:** Expansão.  
**Regra proposta:** definir padrões de infraestrutura, formação docente, acompanhamento de aprendizagem e transparência de resultados.  
**Efeito esperado:** influencia produtividade futura, mobilidade social e qualidade da força de trabalho.  
**Dependências e riscos:** precisa de métricas que não incentivem manipulação ou exclusão de alunos com maior dificuldade.

### SOC-07 | Educação infantil e primeira infância
**Prioridade:** Expansão.  
**Regra proposta:** organizar acesso a creches, pré-escola, proteção integral e apoio ao desenvolvimento infantil.  
**Efeito esperado:** melhora desenvolvimento futuro e pode ampliar participação dos responsáveis no mercado de trabalho.  
**Dependências e riscos:** custo recorrente elevado por vaga, necessidade de profissionais e instalações adequadas. O efeito econômico é de longo prazo.

### SOC-08 | Alfabetização de jovens e adultos
**Prioridade:** Expansão.  
**Regra proposta:** oferecer oportunidades de alfabetização, conclusão escolar e aprendizagem ao longo da vida.  
**Efeito esperado:** amplia empregabilidade, produtividade e acesso a serviços e informação.  
**Dependências e riscos:** depende de adesão, horários compatíveis com trabalho e oferta docente. Não atribuir aumento imediato de produtividade após matrícula.

### SOC-09 | Renda mínima e proteção contra pobreza extrema
**Prioridade:** Fundacional.  
**Regra proposta:** definir público elegível, critérios de renda, valor, duração, atualização e condições de revisão do benefício.  
**Efeito esperado:** aumenta renda disponível, reduz pobreza e estabiliza consumo em famílias vulneráveis.  
**Dependências e riscos:** exige cadastro, orçamento, controle de elegibilidade e pagamento efetivo. Testar efeitos sobre oferta de trabalho e retirada gradual do benefício.

### SOC-10 | Segurança alimentar e nutricional
**Prioridade:** Fundacional.  
**Regra proposta:** estabelecer ações para prevenir fome, insegurança alimentar e deficiências nutricionais.  
**Efeito esperado:** melhora saúde, aprendizagem, produtividade e resiliência das famílias.  
**Dependências e riscos:** precisa de oferta de alimentos, logística, armazenamento, compras públicas e critérios de atendimento. Transferir dinheiro e distribuir alimentos são instrumentos distintos.

### SOC-11 | Assistência social e proteção em situações de vulnerabilidade
**Prioridade:** Fundacional.  
**Regra proposta:** organizar atendimento a famílias e indivíduos em risco social, com benefícios, acompanhamento e encaminhamento.  
**Efeito esperado:** reduz danos de desemprego, doença, abandono, violência e perda de moradia.  
**Dependências e riscos:** precisa de equipes, cadastro, serviços e coordenação com saúde, educação e habitação. Evitar contar o mesmo benefício em dois programas.

### SOC-12 | Inclusão de pessoas com deficiência
**Prioridade:** Expansão.  
**Regra proposta:** garantir não discriminação, acesso a serviços, adaptações razoáveis e inclusão em educação e trabalho.  
**Efeito esperado:** amplia participação social e econômica e reduz barreiras de acesso.  
**Dependências e riscos:** exige acessibilidade territorial, adaptações físicas, tecnologia assistiva e fiscalização. Não limitar a política a pagamentos monetários.

### SOC-13 | Proteção de crianças e adolescentes
**Prioridade:** Fundacional.  
**Regra proposta:** definir proteção contra violência, exploração, negligência e trabalho inadequado, com deveres de notificação e atendimento.  
**Efeito esperado:** melhora segurança e desenvolvimento humano, com efeitos sobre escolarização e saúde.  
**Dependências e riscos:** necessita de rede de atendimento, órgãos de proteção, investigação e acolhimento. O jogo deve representar custos e capacidade institucional.

### SOC-14 | Proteção e cuidado da população idosa
**Prioridade:** Expansão.  
**Regra proposta:** organizar proteção contra abandono e violência, acesso a serviços e apoio a cuidados de longa duração.  
**Efeito esperado:** eleva demanda por saúde, cuidadores, acessibilidade e transferências; melhora bem-estar e participação.  
**Dependências e riscos:** depende da estrutura etária e da rede de cuidados. O envelhecimento deve afetar despesas e oferta de trabalho de forma gradual.

### SOC-15 | Habitação social e proteção habitacional
**Prioridade:** Fundacional.  
**Regra proposta:** definir critérios para acesso a moradia social, subsídios, aluguel assistido, melhorias habitacionais e reassentamento seguro.  
**Efeito esperado:** reduz déficit e vulnerabilidade habitacional, mas pode alterar aluguel, preço da terra e mercado de construção.  
**Dependências e riscos:** exige terreno, infraestrutura, orçamento e critérios transparentes. Subsídio à demanda pode elevar preços se a oferta for rígida.

### SOC-16 | Proteção de locatários e equilíbrio contratual
**Prioridade:** Expansão.  
**Regra proposta:** estabelecer transparência contratual, garantias, responsabilidades por manutenção, reajustes e solução de conflitos locatícios.  
**Efeito esperado:** altera risco de locação, oferta de imóveis para aluguel e segurança de famílias e proprietários.  
**Dependências e riscos:** deve ser compatível com direito de propriedade e contratos. Teto de aluguel sem análise de oferta pode reduzir manutenção e oferta.

### SOC-17 | Prevenção da violência e segurança comunitária
**Prioridade:** Expansão.  
**Regra proposta:** organizar prevenção, iluminação, ocupação de espaços, proteção de vítimas e cooperação entre serviços competentes.  
**Efeito esperado:** influencia vitimização, confiança, atividade econômica noturna e atratividade residencial.  
**Dependências e riscos:** não substitui legislação penal ou competências policiais de outras esferas. Precisa de dados, efetivo e avaliação de resultados.

### SOC-18 | Cultura, esporte e convivência comunitária
**Prioridade:** Maturidade.  
**Regra proposta:** garantir acesso equitativo a equipamentos, eventos e atividades culturais, esportivas e comunitárias.  
**Efeito esperado:** influencia saúde, coesão social, atratividade local e economia de serviços.  
**Dependências e riscos:** exige instalações, programação e manutenção. Benefício social não deve ser confundido com retorno financeiro direto.

---

# 6. Segmento de desenvolvimento

**Foco:** elevar capacidade produtiva, capital humano aplicado, tecnologia, infraestrutura econômica e diversificação. O desenvolvimento deve resultar em produtividade e oportunidades reais, não em bônus abstratos.

### DES-01 | Planejamento integrado do desenvolvimento local
**Prioridade:** Fundacional.  
**Regra proposta:** estabelecer diagnóstico, metas, prioridades, prazos e indicadores para desenvolvimento econômico e infraestrutura.  
**Efeito esperado:** coordena investimento público e privado e reduz projetos desconectados.  
**Dependências e riscos:** exige dados, participação e revisão periódica. Metas não podem garantir crescimento independentemente da execução.

### DES-02 | Formação e manutenção da infraestrutura econômica
**Prioridade:** Fundacional.  
**Regra proposta:** disciplinar planejamento, execução, manutenção e avaliação de infraestrutura que sustenta produção e circulação.  
**Efeito esperado:** aumenta capacidade produtiva, reduz gargalos e cria demanda temporária por trabalho e materiais.  
**Dependências e riscos:** investimento precisa formar ativo físico, passar por implantação e sofrer depreciação e manutenção. Desembolso não equivale a obra concluída.

### DES-03 | Transporte coletivo e mobilidade produtiva
**Prioridade:** Expansão.  
**Regra proposta:** estabelecer critérios de cobertura, frequência, integração, acessibilidade, financiamento e qualidade do transporte coletivo.  
**Efeito esperado:** amplia mercado de trabalho acessível, reduz custo de deslocamento e altera localização de empresas e moradias.  
**Dependências e riscos:** demanda, densidade, frota, vias, combustível, tarifa e subsídio precisam ser considerados.

### DES-04 | Rede viária, pontes e logística local
**Prioridade:** Fundacional.  
**Regra proposta:** definir padrões de implantação, conservação e operação de vias e ligações logísticas.  
**Efeito esperado:** reduz tempo e custo de transporte, amplia acesso a fornecedores e mercados.  
**Dependências e riscos:** construção afeta orçamento, solo e ambiente. Vias sem manutenção depreciam e podem perder capacidade.

### DES-05 | Segurança e confiabilidade do fornecimento de energia
**Prioridade:** Fundacional.  
**Regra proposta:** estabelecer metas de continuidade, expansão de rede, conexão e contingência energética.  
**Efeito esperado:** aumenta capacidade produtiva e residencial, reduz perdas e melhora atração de negócios.  
**Dependências e riscos:** requer infraestrutura, geração, combustível ou fontes renováveis, regulação e demanda. Não gerar energia sem insumos ou capacidade instalada.

### DES-06 | Conectividade digital e telecomunicações
**Prioridade:** Expansão.  
**Regra proposta:** criar diretrizes para cobertura, acesso, qualidade e compartilhamento de infraestrutura digital.  
**Efeito esperado:** reduz custos de informação, facilita comércio, educação, serviços e produtividade.  
**Dependências e riscos:** requer rede, equipamentos, energia e competências digitais; cobertura nominal não significa uso efetivo.

### DES-07 | Qualificação profissional e requalificação de trabalhadores
**Prioridade:** Fundacional.  
**Regra proposta:** organizar cursos e certificações ligados a necessidades verificáveis dos setores produtivos.  
**Efeito esperado:** reduz incompatibilidade entre vagas e competências e pode elevar produtividade e salários.  
**Dependências e riscos:** precisa de demanda empresarial, instrutores, infraestrutura e tempo de aprendizagem. Curso concluído não garante colocação.

### DES-08 | Pesquisa, desenvolvimento e inovação
**Prioridade:** Maturidade.  
**Regra proposta:** estabelecer instrumentos de fomento à pesquisa, experimentação, adoção tecnológica e difusão de conhecimento.  
**Efeito esperado:** aumenta produtividade e pode criar novas atividades econômicas com defasagem.  
**Dependências e riscos:** resultados são incertos. Exigir adicionalidade e entregas verificáveis, sem garantir sucesso de cada projeto.

### DES-09 | Empreendedorismo e apoio a micro e pequenas empresas
**Prioridade:** Expansão.  
**Regra proposta:** simplificar procedimentos, oferecer assistência técnica e instrumentos de apoio condicionados à viabilidade.  
**Efeito esperado:** pode ampliar entrada, sobrevivência e formalização de empresas.  
**Dependências e riscos:** assistência técnica, crédito e subsídios são ferramentas diferentes. Não perpetuar negócios inviáveis apenas para manter empregos.

### DES-10 | Financiamento produtivo e garantias de desenvolvimento
**Prioridade:** Maturidade.  
**Regra proposta:** permitir instrumentos de crédito, garantias ou fundos para investimento produtivo, com governança e critérios de risco.  
**Efeito esperado:** reduz restrições de financiamento quando há projetos viáveis sem crédito privado suficiente.  
**Dependências e riscos:** exige análise de risco, provisões, inadimplência, custo de capital e transparência fiscal. Empréstimo é ativo e obrigação, não despesa integral no momento da concessão.

### DES-11 | Desenvolvimento agropecuário e extensão rural
**Prioridade:** Expansão.  
**Regra proposta:** apoiar assistência técnica, produtividade sustentável, acesso a insumos, armazenagem e gestão rural.  
**Efeito esperado:** melhora produção, renda rural, estabilidade de oferta e integração com mercados.  
**Dependências e riscos:** considerar clima, solo, água, sazonalidade, preços e risco de concentração em monocultura.

### DES-12 | Diversificação produtiva e cadeias locais
**Prioridade:** Expansão.  
**Regra proposta:** orientar infraestrutura e capacitação para ampliar variedade de setores e fornecedores.  
**Efeito esperado:** reduz dependência de uma atividade, amplia empregos e melhora resiliência a choques setoriais.  
**Dependências e riscos:** não escolher empresas vencedoras por decreto. A diversificação deve responder a demanda, vantagens locais e custos.

### DES-13 | Comércio, feiras e mercados de produtores
**Prioridade:** Expansão.  
**Regra proposta:** disciplinar espaços, horários, infraestrutura e regras de acesso para mercados, feiras e comércio local.  
**Efeito esperado:** reduz custo de transação, aproxima produtores e consumidores e pode ampliar concorrência.  
**Dependências e riscos:** requer espaço, higiene, logística, fiscalização e concorrência justa com estabelecimentos existentes.

### DES-14 | Turismo e economia de visitantes
**Prioridade:** Maturidade.  
**Regra proposta:** estabelecer planejamento, padrões de serviços, proteção de patrimônio e diretrizes para atividade turística.  
**Efeito esperado:** gera demanda externa por hospedagem, alimentação, transporte, cultura e comércio.  
**Dependências e riscos:** avaliar sazonalidade, capacidade ambiental, custo de infraestrutura e vazamento de renda para fornecedores externos.

### DES-15 | Armazenagem, distribuição e redução de perdas
**Prioridade:** Expansão.  
**Regra proposta:** estimular capacidade de armazenagem, conservação, distribuição e integração logística.  
**Efeito esperado:** reduz perdas, volatilidade de oferta e custos de abastecimento.  
**Dependências e riscos:** exige estoque físico, capacidade de armazenagem, energia, transporte e gestão. Estoque não é receita nem riqueza líquida por si só.

### DES-16 | Cooperação entre empresas, ensino e pesquisa
**Prioridade:** Maturidade.  
**Regra proposta:** criar mecanismos para cooperação, formação aplicada, transferência tecnológica e projetos conjuntos.  
**Efeito esperado:** acelera difusão de conhecimento e melhora adequação da formação às necessidades produtivas.  
**Dependências e riscos:** precisa de instituições, pessoal qualificado e governança sobre propriedade intelectual e resultados.

---

# 7. Segmento ambiental

**Foco:** recursos naturais, poluição, conservação, resíduos, clima e responsabilização por danos. O segmento deve afetar custos e limites físicos da economia, não apenas produzir um indicador de “meio ambiente”.

### AMB-01 | Padrões de emissão e poluição atmosférica
**Prioridade:** Fundacional.  
**Regra proposta:** estabelecer limites, monitoramento e obrigações de adequação para fontes poluidoras.  
**Efeito esperado:** aumenta custos de controle e pode reduzir poluição, doenças e danos ambientais.  
**Dependências e riscos:** requer medição, fiscalização e tecnologia disponível. Limites inexequíveis podem fechar atividades sem ganho ambiental proporcional.

### AMB-02 | Licenciamento ambiental proporcional ao risco
**Prioridade:** Fundacional.  
**Regra proposta:** exigir avaliação e autorização prévia de atividades conforme potencial de impacto, porte e localização.  
**Efeito esperado:** reduz risco de dano e adiciona custo e prazo regulatório à implantação.  
**Dependências e riscos:** precisa de competência legal, capacidade técnica e prazos previsíveis. Evitar tanto licenciamento automático quanto burocracia sem relação com risco.

### AMB-03 | Avaliação de impacto e medidas mitigadoras
**Prioridade:** Expansão.  
**Regra proposta:** exigir estudo de impactos relevantes e medidas de prevenção, mitigação, compensação ou recuperação.  
**Efeito esperado:** altera custo de projetos e pode evitar danos de longo prazo.  
**Dependências e riscos:** precisa de linha de base, análise de alternativas e fiscalização do cumprimento das medidas.

### AMB-04 | Uso sustentável e alocação de recursos hídricos
**Prioridade:** Fundacional.  
**Regra proposta:** definir critérios de captação, prioridade em escassez, medição, conservação e proteção de mananciais.  
**Efeito esperado:** limita produção quando há escassez, incentiva eficiência e reduz conflito entre usuários.  
**Dependências e riscos:** exige estoque físico de água, renovação, clima e qualidade. Não permitir que vários agentes usem o mesmo volume simultaneamente.

### AMB-05 | Controle de efluentes e proteção da qualidade da água
**Prioridade:** Fundacional.  
**Regra proposta:** estabelecer padrões de lançamento, tratamento, monitoramento e responsabilização por contaminação.  
**Efeito esperado:** reduz doenças, danos a ecossistemas e custos futuros de tratamento.  
**Dependências e riscos:** depende de redes, estações, capacidade de tratamento e fiscalização. Saneamento é também serviço e infraestrutura, não apenas regra ambiental.

### AMB-06 | Gestão integrada de resíduos sólidos
**Prioridade:** Fundacional.  
**Regra proposta:** definir coleta, separação, tratamento, reciclagem, destinação final e responsabilidades dos geradores.  
**Efeito esperado:** reduz poluição e perdas materiais, mas exige logística, instalações e custeio recorrente.  
**Dependências e riscos:** volume gerado depende da população e da produção. A coleta não deve eliminar automaticamente resíduos sem capacidade de tratamento.

### AMB-07 | Responsabilidade pós-consumo e logística reversa
**Prioridade:** Expansão.  
**Regra proposta:** atribuir responsabilidades de retorno, recolhimento ou destinação a fabricantes, importadores, comerciantes e consumidores conforme o produto.  
**Efeito esperado:** pode reduzir resíduos públicos e alterar custos e preços de produtos.  
**Dependências e riscos:** exige cadeia reversa, pontos de coleta, rastreabilidade e definição de custos para evitar dupla cobrança.

### AMB-08 | Responsabilidade por contaminação e recuperação de áreas
**Prioridade:** Expansão.  
**Regra proposta:** definir responsabilidade, investigação, reparação e recuperação de solo ou água contaminados.  
**Efeito esperado:** internaliza parte do custo ambiental e pode recuperar áreas para uso futuro.  
**Dependências e riscos:** precisa de inventário de passivos, estimativa de dano, garantias e regra para agente insolvente ou dano histórico.

### AMB-09 | Conservação da biodiversidade e áreas protegidas
**Prioridade:** Expansão.  
**Regra proposta:** delimitar áreas de conservação e disciplinar usos compatíveis, manejo e fiscalização.  
**Efeito esperado:** preserva serviços ecossistêmicos e pode restringir expansão de atividades em determinadas áreas.  
**Dependências e riscos:** requer mapa, dados ecológicos, fiscalização e tratamento de usos preexistentes e direitos afetados.

### AMB-10 | Proteção de vegetação, nascentes e solo
**Prioridade:** Fundacional.  
**Regra proposta:** estabelecer proteção de áreas sensíveis, controle de desmatamento e práticas de conservação do solo.  
**Efeito esperado:** reduz erosão, assoreamento e risco hídrico, podendo limitar expansão produtiva em áreas frágeis.  
**Dependências e riscos:** precisa de cadastro territorial, fiscalização e restauração efetiva.

### AMB-11 | Controle de ruído, odor e poluição local
**Prioridade:** Expansão.  
**Regra proposta:** estabelecer limites por horário, localização e tipo de atividade.  
**Efeito esperado:** influencia localização de empresas, qualidade residencial e custo de mitigação.  
**Dependências e riscos:** precisa distinguir incômodo pontual de dano recorrente e considerar zoneamento e fiscalização.

### AMB-12 | Eficiência energética e transição de fontes
**Prioridade:** Expansão.  
**Regra proposta:** criar padrões graduais de eficiência e instrumentos de incentivo à adoção de fontes menos poluentes.  
**Efeito esperado:** altera investimento inicial, custo operacional, demanda de energia e emissões.  
**Dependências e riscos:** considerar vida útil dos equipamentos, custo de capital, disponibilidade de tecnologia e origem da energia.

### AMB-13 | Adaptação climática e redução de riscos
**Prioridade:** Expansão.  
**Regra proposta:** exigir avaliação de riscos climáticos e planos de adaptação para infraestrutura e áreas vulneráveis.  
**Efeito esperado:** reduz perdas esperadas em enchentes, secas, ondas de calor e eventos extremos.  
**Dependências e riscos:** trabalha com probabilidades e incerteza. Investimentos preventivos precisam ser avaliados por risco evitado, não apenas por retorno financeiro imediato.

### AMB-14 | Extração de recursos naturais e mineração
**Prioridade:** Maturidade.  
**Regra proposta:** disciplinar licenças, limites, compensações, recuperação e fiscalização da extração de recursos.  
**Efeito esperado:** pode gerar empregos e receitas, mas cria custos ambientais, desgaste de infraestrutura e passivos.  
**Dependências e riscos:** competência pode ser de esfera superior. A simulação precisa contabilizar exaustão de recursos e passivos ambientais.

### AMB-15 | Educação ambiental e informação pública
**Prioridade:** Maturidade.  
**Regra proposta:** promover informação, participação e educação sobre consumo, resíduos, água, energia e conservação.  
**Efeito esperado:** pode alterar hábitos e reduzir externalidades com defasagem.  
**Dependências e riscos:** não atribuir efeito automático à campanha. Medir adesão e mudança real de comportamento.

### AMB-16 | Princípio do poluidor-pagador e fundos de reparação
**Prioridade:** Maturidade.  
**Regra proposta:** estabelecer mecanismos de responsabilização, garantias e financiamento da reparação de danos ambientais.  
**Efeito esperado:** muda decisões de prevenção e internaliza custos que poderiam recair sobre a coletividade.  
**Dependências e riscos:** precisa evitar que multas sejam tratadas como licença para poluir. Receita de multa deve ser distinguida de compensação e custo de reparação.

---

# 8. Segmento territorial

**Foco:** localização, propriedade da terra, uso e ocupação do solo, desenho urbano, mobilidade espacial e segurança da ocupação. A área territorial define onde e como a cidade pode se desenvolver; não executa obras por si só.

### TER-01 | Plano diretor e planejamento territorial
**Prioridade:** Fundacional.  
**Regra proposta:** estabelecer diretrizes de expansão, adensamento, infraestrutura, proteção de áreas e distribuição de atividades.  
**Efeito esperado:** coordena uso do solo e investimentos, alterando preço da terra e localização dos agentes.  
**Dependências e riscos:** precisa de mapas, projeções, participação e revisão. Plano sem investimento e fiscalização pode não produzir mudança física.

### TER-02 | Zoneamento e compatibilidade de usos
**Prioridade:** Fundacional.  
**Regra proposta:** definir usos permitidos, condicionados ou proibidos por zona, com critérios transparentes.  
**Efeito esperado:** muda oferta de terrenos por uso, proximidade entre atividades, externalidades e valor imobiliário.  
**Dependências e riscos:** interage com normas ambientais e econômicas. Restrições excessivas podem encarecer moradia e afastar negócios.

### TER-03 | Densidade e parâmetros de ocupação
**Prioridade:** Expansão.  
**Regra proposta:** definir coeficientes de aproveitamento, altura, taxa de ocupação, recuos e densidade conforme capacidade urbana.  
**Efeito esperado:** altera quantidade potencial de unidades e área construída e pressiona infraestrutura.  
**Dependências e riscos:** precisa de capacidade viária, água, esgoto, energia e equipamentos sociais. Densidade não deve ser tratada como sinônimo automático de congestionamento.

### TER-04 | Parcelamento e loteamento do solo
**Prioridade:** Fundacional.  
**Regra proposta:** estabelecer requisitos para subdivisão, abertura de vias, áreas públicas e infraestrutura mínima.  
**Efeito esperado:** amplia oferta formal de lotes, mas pode gerar custos futuros de urbanização e manutenção.  
**Dependências e riscos:** não liberar loteamento sem capacidade de atendimento ou garantias de implantação das redes.

### TER-05 | Código de obras e segurança das edificações
**Prioridade:** Fundacional.  
**Regra proposta:** definir requisitos estruturais, sanitários, de segurança, acessibilidade e aprovação de projetos.  
**Efeito esperado:** aumenta custo de construção, mas reduz acidentes, defeitos e riscos à vida.  
**Dependências e riscos:** exige fiscalização e padrões proporcionais. Construção informal deve ser modelada como resposta a custo, demora e falta de oferta, não como comportamento aleatório.

### TER-06 | Cadastro imobiliário e endereçamento territorial
**Prioridade:** Fundacional.  
**Regra proposta:** organizar identificação de lotes, imóveis, proprietários, ocupantes, edificações e endereços.  
**Efeito esperado:** melhora tributação, regularização, serviços, transações e planejamento.  
**Dependências e riscos:** precisa de dados atualizados e proteção de informações pessoais. Cadastro não prova, sozinho, domínio jurídico.

### TER-07 | Regularização fundiária e segurança da posse
**Prioridade:** Expansão.  
**Regra proposta:** criar procedimentos para reconhecer ocupações, titularizar quando cabível e integrar áreas à cidade.  
**Efeito esperado:** reduz insegurança, facilita acesso a serviços e pode liberar investimento em moradia.  
**Dependências e riscos:** exige análise de risco, infraestrutura, origem da ocupação e direitos de terceiros. Titularização não resolve déficit de serviços automaticamente.

### TER-08 | Função social da propriedade e imóveis subutilizados
**Prioridade:** Maturidade.  
**Regra proposta:** definir critérios objetivos para identificar subutilização e instrumentos graduais para induzir uso adequado.  
**Efeito esperado:** pode ampliar oferta de terrenos e reduzir retenção especulativa em áreas servidas.  
**Dependências e riscos:** requer cadastro, critérios de utilização, devido processo e coordenação com tributação. Não presumir que todo imóvel vazio esteja disponível para uso.

### TER-09 | Habitação inclusiva e mistura de faixas de renda
**Prioridade:** Expansão.  
**Regra proposta:** estabelecer mecanismos para integrar habitação de diferentes faixas de renda em áreas com infraestrutura e oportunidades.  
**Efeito esperado:** influencia composição social, deslocamentos, preço dos imóveis e segregação espacial.  
**Dependências e riscos:** precisa de estudo de viabilidade, oferta de solo e compensações proporcionais. Obrigações excessivas podem reduzir lançamentos.

### TER-10 | Desenvolvimento orientado ao transporte
**Prioridade:** Maturidade.  
**Regra proposta:** coordenar adensamento, uso misto, serviços e financiamento urbano em áreas com transporte coletivo estruturante.  
**Efeito esperado:** pode reduzir deslocamentos longos, apoiar transporte coletivo e aumentar produtividade urbana.  
**Dependências e riscos:** exige transporte real, frequência, capacidade e segurança. Não antecipar valorização como se fosse garantida.

### TER-11 | Sistema viário e desenho do espaço público
**Prioridade:** Fundacional.  
**Regra proposta:** definir padrões de hierarquia viária, calçadas, iluminação, drenagem, arborização e uso do espaço público.  
**Efeito esperado:** muda segurança, acessibilidade, caminhabilidade e custo de deslocamento.  
**Dependências e riscos:** implantação e manutenção precisam de orçamento e ativo físico; a regra não constrói a rua.

### TER-12 | Acessibilidade e desenho universal no ambiente construído
**Prioridade:** Expansão.  
**Regra proposta:** exigir acessibilidade progressiva em edifícios, calçadas, transporte e serviços públicos.  
**Efeito esperado:** amplia participação e acesso a trabalho, consumo e serviços.  
**Dependências e riscos:** requer inventário de barreiras, cronograma, custos e fiscalização; deve conversar com a política de inclusão social.

### TER-13 | Proteção do patrimônio histórico e paisagístico
**Prioridade:** Maturidade.  
**Regra proposta:** identificar bens e áreas protegidas, disciplinar intervenções e apoiar conservação.  
**Efeito esperado:** preserva identidade, cultura e atratividade, mas pode limitar reformas e usos econômicos.  
**Dependências e riscos:** precisa de inventário, critérios, incentivos e repartição de custos de conservação.

### TER-14 | Limites urbano-rurais e proteção de áreas produtivas
**Prioridade:** Expansão.  
**Regra proposta:** definir transição entre áreas urbanas, rurais e de expansão, protegendo atividades produtivas e ecossistemas.  
**Efeito esperado:** afeta preço da terra, custo de expansão, oferta de alimentos e deslocamentos.  
**Dependências e riscos:** depende de zoneamento, meio ambiente e logística. Expansão urbana não deve consumir solo produtivo sem custo.

### TER-15 | Zoneamento de risco e restrição de ocupação insegura
**Prioridade:** Fundacional.  
**Regra proposta:** mapear riscos de enchente, deslizamento, erosão, contaminação e outros perigos, definindo regras de ocupação e reassentamento.  
**Efeito esperado:** reduz exposição e perdas futuras, mas pode restringir solo disponível e gerar necessidade de reassentamento.  
**Dependências e riscos:** exige mapa de risco, atualização, fiscalização, moradia alternativa e compensação quando aplicável.

### TER-16 | Banco de terras, aquisição pública e captura de valorização
**Prioridade:** Maturidade.  
**Regra proposta:** permitir aquisição, reserva e destinação de terras públicas e instrumentos para recuperar parte da valorização gerada por investimentos coletivos.  
**Efeito esperado:** amplia capacidade de planejar equipamentos e habitação e pode financiar infraestrutura.  
**Dependências e riscos:** exige avaliação de imóveis, registro, transparência e regras de compensação. Aquisição pública consome caixa e cria ativo; não é receita.

---

# 9. Segmento institucional

**Foco:** estrutura do Estado, competências, processo decisório, orçamento, administração, integridade, transparência, controle e solução de conflitos. O segmento define como as demais normas são criadas e cumpridas.

### INS-01 | Constituição ou carta fundamental do Vilarejo
**Prioridade:** Fundacional.  
**Regra proposta:** definir direitos fundamentais, organização do poder, limites do governo, propriedade, garantias e princípios de convivência.  
**Efeito esperado:** estabelece limites e previsibilidade para todas as demais normas.  
**Dependências e riscos:** precisa de procedimento de alteração qualificado e proteção contra normas inferiores incompatíveis.

### INS-02 | Separação de poderes e competências institucionais
**Prioridade:** Fundacional.  
**Regra proposta:** distribuir funções legislativas, executivas, judiciais, regulatórias e de controle, incluindo competências por nível de governo.  
**Efeito esperado:** reduz concentração de poder e define quem pode criar, executar e revisar normas.  
**Dependências e riscos:** competências devem ser verificadas por matéria e território; hierarquia formal não substitui análise de competência.

### INS-03 | Processo legislativo, consulta e aprovação de normas
**Prioridade:** Fundacional.  
**Regra proposta:** disciplinar iniciativa, tramitação, debate, quórum, votação, sanção, veto, publicação e início de vigência.  
**Efeito esperado:** define velocidade, custo político e previsibilidade de mudança legislativa.  
**Dependências e riscos:** precisa de atores políticos, agenda, registro histórico e regras de maioria. Aprovação deve ser distinta da publicação e da vigência.

### INS-04 | Sistema eleitoral, mandatos e representação
**Prioridade:** Expansão.  
**Regra proposta:** definir eleição, duração de mandatos, representação e substituição de governantes e legisladores.  
**Efeito esperado:** cria incentivos políticos, ciclos de decisão e alternância de poder.  
**Dependências e riscos:** exige partidos ou candidaturas, preferências, informação e apuração. Evitar transformar eleições em eventos aleatórios sem ligação com desempenho e preferências.

### INS-05 | Participação social e conselhos comunitários
**Prioridade:** Expansão.  
**Regra proposta:** criar formas de consulta, conselhos, audiências, iniciativa popular e participação no planejamento.  
**Efeito esperado:** pode aumentar legitimidade, revelar preferências e reduzir assimetria de informação.  
**Dependências e riscos:** participação não equivale a unanimidade; considerar representatividade, custos de coordenação e captura por grupos organizados.

### INS-06 | Responsabilidade fiscal e limites de endividamento
**Prioridade:** Fundacional.  
**Regra proposta:** estabelecer limites, transparência, metas fiscais, condições de crédito, garantias e consequências para desequilíbrios persistentes.  
**Efeito esperado:** afeta custo de financiamento, investimento público, risco soberano local e sustentabilidade da dívida.  
**Dependências e riscos:** dívida é estoque; déficit é fluxo. Regras rígidas em recessão podem amplificar crise se não houver mecanismos de estabilização.

### INS-07 | Planejamento orçamentário e autorização de despesas
**Prioridade:** Fundacional.  
**Regra proposta:** organizar orçamento anual, planejamento plurianual, prioridades, fontes e limites para compromissos e pagamentos.  
**Efeito esperado:** conecta escolhas políticas a capacidade de gasto e prioridades públicas.  
**Dependências e riscos:** dotação orçamentária não é caixa nem pagamento. Distinguir autorização, empenho/compromisso, liquidação e pagamento na representação do jogo.

### INS-08 | Compras públicas, licitações e gestão contratual
**Prioridade:** Fundacional.  
**Regra proposta:** definir planejamento da contratação, competição, critérios de seleção, gestão de riscos, fiscalização e responsabilização contratual.  
**Efeito esperado:** influencia preço, qualidade, prazo e integridade do gasto público.  
**Dependências e riscos:** exige fornecedores, contratos, entregas físicas e fiscalização. Pagamento não deve ocorrer apenas porque o contrato foi assinado.

### INS-09 | Regime de pessoal e serviço público
**Prioridade:** Expansão.  
**Regra proposta:** disciplinar ingresso, remuneração, avaliação, capacitação, estabilidade ou vínculo, progressão e responsabilização dos agentes públicos.  
**Efeito esperado:** altera folha de pagamento, capacidade administrativa, produtividade e qualidade dos serviços.  
**Dependências e riscos:** separar custo de pessoal, número de servidores, horas disponíveis e qualidade da execução. Contratação deve respeitar orçamento e capacidade de gestão.

### INS-10 | Transparência, acesso à informação e dados abertos
**Prioridade:** Fundacional.  
**Regra proposta:** exigir divulgação de orçamento, contratos, decisões, indicadores, dados e justificativas, respeitando sigilos legítimos.  
**Efeito esperado:** reduz assimetria de informação e pode elevar confiança, controle e qualidade das decisões.  
**Dependências e riscos:** exige sistemas de informação, qualidade de dados e proteção de dados pessoais. Publicar dados ruins não equivale a transparência efetiva.

### INS-11 | Integridade, conflito de interesses e combate à corrupção
**Prioridade:** Fundacional.  
**Regra proposta:** estabelecer prevenção, declaração de conflitos, controles, canais de denúncia, investigação e sanções.  
**Efeito esperado:** reduz desvios, sobrepreços e perda de confiança; melhora eficiência do gasto.  
**Dependências e riscos:** precisa de controles independentes e devido processo. Aumentar fiscalização pode elevar detecção inicialmente, sem significar que a corrupção aumentou.

### INS-12 | Simplificação administrativa e governo digital
**Prioridade:** Expansão.  
**Regra proposta:** simplificar procedimentos, integrar cadastros e permitir serviços públicos digitais acessíveis.  
**Efeito esperado:** reduz custo de conformidade, tempo de atendimento e custo administrativo.  
**Dependências e riscos:** exige infraestrutura, segurança da informação, pessoal capacitado e alternativa para pessoas sem acesso digital.

### INS-13 | Processo administrativo, fiscalização e direito de defesa
**Prioridade:** Fundacional.  
**Regra proposta:** definir notificação, prazos, provas, decisão motivada, recurso e revisão de sanções administrativas.  
**Efeito esperado:** aumenta previsibilidade e legitimidade da fiscalização, mas adiciona tempo e custo processual.  
**Dependências e riscos:** precisa de agentes fiscalizadores e autoridade revisora. Não permitir multa ou perda patrimonial sem procedimento definido.

### INS-14 | Justiça, mediação e resolução de conflitos
**Prioridade:** Expansão.  
**Regra proposta:** organizar mecanismos judiciais e extrajudiciais para resolver conflitos civis, comerciais, trabalhistas e administrativos conforme a jurisdição.  
**Efeito esperado:** reduz incerteza contratual e custo de conflitos, podendo melhorar investimento e confiança.  
**Dependências e riscos:** exige capacidade decisória, prazos, custos e execução das decisões. Justiça lenta gera passivos e incerteza econômica.

### INS-15 | Cooperação entre níveis de governo e transferências
**Prioridade:** Maturidade.  
**Regra proposta:** disciplinar convênios, consórcios, transferências, repartição de competências e execução compartilhada.  
**Efeito esperado:** permite financiar serviços e infraestrutura que ultrapassam capacidade local.  
**Dependências e riscos:** transferências devem ter origem, destino, finalidade e contrapartida identificados. Não criar receita consolidada por dupla contagem entre governos.

### INS-16 | Estado de emergência e gestão de crises
**Prioridade:** Maturidade.  
**Regra proposta:** definir hipóteses, poderes temporários, transparência, revisão e encerramento de medidas excepcionais.  
**Efeito esperado:** melhora coordenação diante de desastres, epidemias ou crises econômicas graves.  
**Dependências e riscos:** poderes extraordinários precisam de limites temporais e controle. Testar impacto em direitos, gasto público, abastecimento e atividade econômica.

---

# 10. Regras transversais para evitar duplicidade

A mesma matéria pode aparecer em vários segmentos, mas cada norma deve ter um responsável principal e vínculos explícitos com as demais áreas.

| Tema | Norma principal | Módulos que recebem efeitos | Risco de duplicidade |
|---|---|---|---|
| Trabalho | Econômico | Empresas, famílias, contabilidade | Folha e custo de produção computados duas vezes |
| Tributação | Econômico | Governo, empresas, famílias, SFC | Imposto lançado como receita antes de ser pago ou cobrado duas vezes |
| Orçamento | Institucional | Governo, políticas públicas, SFC | Autorização tratada como caixa disponível |
| Saúde e educação | Social | Executores setoriais, famílias, desenvolvimento | Lei confundida com serviço prestado ou resultado imediato |
| Infraestrutura | Desenvolvimento | Territorial, empresas, Governo, SFC | Desembolso confundido com ativo construído |
| Poluição | Ambiental | Empresas, saúde, território | Multa confundida com redução física de poluição |
| Zoneamento | Territorial | Habitação, empresas, ambiente, infraestrutura | Restrição de solo ignorada em decisões de localização |
| Concessões | Econômico | Institucional, infraestrutura, SFC | Propriedade, operação e financiamento tratados como a mesma coisa |
| Crédito público | Desenvolvimento | Banco, Governo, empresas, SFC | Empréstimo contabilizado como despesa integral ou como receita |
| Transferência de renda | Social | Famílias, Governo, SFC | Benefício autorizado contado como pagamento efetivo |

## 11. Contrato mínimo de dados para cada futura norma

Antes de transformar uma proposta em código, cada norma deverá ter, no mínimo, estes campos:

```text
id
name
domain
subdomain
legalType
jurisdiction
competenceBasis
status
approvalDate
effectiveFrom
effectiveUntil
regulatedActors
objective
rule
triggers
exceptions
instrument
complianceRequirements
sanctions
fiscalEffects
physicalEffects
behavioralChannels
indicators
linkedPolicies
linkedExecutors
conflictKeys
supersedes
supersededBy
sourceBasis
maturityStatus
```

Campos ainda não aplicáveis podem ficar vazios, mas não devem ser inventados. A norma precisa indicar se cria despesa, obrigação privada, receita, restrição física, direito individual, incentivo ou apenas procedimento.

## 12. Matriz mínima de avaliação de cada norma

Uma proposta não será considerada madura apenas porque seu texto parece razoável. Ela precisa responder às perguntas abaixo:

1. **Competência:** qual nível de governo pode criar essa regra? Existe norma superior que limita sua atuação?
2. **Agentes:** quem ganha um direito, assume uma obrigação, recebe um incentivo ou passa a ser fiscalizado?
3. **Mecanismo causal:** qual decisão dos agentes muda e por quê?
4. **Efeito fiscal:** há receita, despesa, renúncia, garantia, passivo ou custo administrativo? Em que momento?
5. **Efeito físico:** altera estoque, capacidade, infraestrutura, recursos naturais, vagas, leitos ou produção?
6. **Efeito distributivo:** quais grupos são beneficiados, onerados ou excluídos?
7. **Tempo:** o efeito é imediato, gradual ou depende de investimento e aprendizagem?
8. **Cumprimento:** quem fiscaliza, com qual capacidade e custo?
9. **Interações:** quais normas podem reforçar, neutralizar ou contradizer esta?
10. **Reversibilidade:** como a norma pode ser alterada, suspensa ou revogada sem apagar obrigações já constituídas?
11. **Teste de estresse:** o que acontece em recessão, inflação, insolvência, escassez ou choque demográfico?
12. **Indicadores:** que dado observável mostrará o efeito real, sem confundir execução com resultado?

## 13. Conflitos que precisam entrar na bateria de testes

- Piso salarial elevado em relação à produtividade, combinado com recessão e crédito caro.
- Redução de tributos combinada com expansão de benefícios permanentes e limite de endividamento.
- Tabelamento de preços combinado com escassez de insumos, estoque baixo e restrição de importações.
- Subsídio habitacional combinado com zoneamento restritivo e oferta inelástica de terrenos.
- Incentivo ambiental combinado com subsídio a atividade poluidora.
- Exigência de acessibilidade e segurança combinada com fiscalização fraca e informalidade.
- Crédito público subsidiado combinado com inadimplência e capital bancário insuficiente.
- Concessão privada combinada com tarifa regulada abaixo do custo e obrigação de universalização.
- Investimento em infraestrutura combinado com atraso de obra, sobrepreço e custo futuro de manutenção.
- Benefício social condicionado combinado com queda brusca de renda e demora de atualização cadastral.
- Regra de responsabilidade fiscal pró-cíclica combinada com queda de arrecadação e aumento automático de despesas sociais.
- Execução fiscal combinada com imóvel de valor inferior à dívida, copropriedade ou bem essencial.
- Norma ambiental restritiva combinada com ausência de alternativa tecnológica para empresas pequenas.
- Zoneamento que reduz área industrial combinado com crescimento populacional e deslocamento de empregos.
- Transparência ampliada combinada com dados pessoais e informações comerciais protegidas.

## 14. Sequência recomendada de amadurecimento

**Etapa A - Revisão conceitual:** revisar os 100 itens, remover duplicidades, ajustar escopo e identificar normas que são políticas ou regulamentos, não leis autônomas.

**Etapa B - Competências e hierarquia:** marcar jurisdição e autoridade competente para cada item. No modo brasileiro, usar a Constituição e legislação nacional como referência de distribuição de competências, sem presumir que o governo municipal pode legislar sobre tudo.

**Etapa C - Especificação causal:** detalhar regra, agentes, gatilhos, exceções, comportamento esperado e indicadores.

**Etapa D - Especificação contábil e física:** identificar lançamentos SFC, passivos, ativos, estoques, custos de execução e atrasos.

**Etapa E - Testes isolados:** testar cada regra com valores normais, limites, inadimplência, falta de caixa, ausência de capacidade e mudança de vigência.

**Etapa F - Testes cruzados:** executar cenários com várias leis simultâneas e verificar conflito, sobreposição e efeitos cumulativos.

**Etapa G - Integração simulada:** conectar as normas a executores fictícios e ao SFC em uma sandbox, sem alterar o jogo principal.

Só depois dessas etapas uma norma poderá ser marcada como pronta para integração.

## 15. Referências brasileiras para inspiração e verificação

As referências abaixo ajudam a manter realismo institucional. Elas não significam que cada proposta do jogo reproduza o texto legal ou que toda norma seja de competência local. A legislação deve ser consultada em sua versão oficial e atualizada durante a especificação de cada item.

- Constituição Federal de 1988: princípios, direitos, competências dos entes, ordem econômica, políticas urbanas, saúde, educação e meio ambiente.
- Lei nº 8.078/1990: Código de Defesa do Consumidor.
- Decreto-Lei nº 5.452/1943: Consolidação das Leis do Trabalho.
- Lei nº 8.080/1990: organização e funcionamento das ações e serviços de saúde.
- Lei nº 9.394/1996: diretrizes e bases da educação nacional.
- Lei nº 10.257/2001: Estatuto da Cidade.
- Lei nº 6.766/1979: parcelamento do solo urbano.
- Lei nº 12.305/2010: Política Nacional de Resíduos Sólidos.
- Lei nº 11.445/2007, com alterações posteriores: diretrizes nacionais para o saneamento básico.
- Lei nº 14.133/2021: licitações e contratos administrativos.
- Lei Complementar nº 101/2000: responsabilidade na gestão fiscal.
- Lei nº 6.938/1981: Política Nacional do Meio Ambiente, em conjunto com alterações posteriores.
- Lei nº 15.190/2025: Lei Geral do Licenciamento Ambiental.
- Lei nº 15.432/2026: marco legal do transporte público coletivo urbano, com alterações no Estatuto da Cidade e na legislação de mobilidade.

**Fontes oficiais para consulta:**

- Constituição Federal: https://www4.planalto.gov.br/legislacao/legis-federal/constituicao
- Código de Defesa do Consumidor: https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm
- CLT: https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm
- Lei do SUS: https://www.planalto.gov.br/ccivil_03/leis/l8080.htm
- LDB: https://planalto.gov.br/ccivil_03/leis/l9394.htm
- Estatuto da Cidade: https://www.planalto.gov.br/ccivil_03/leis/leis_2001/l10257.htm
- Parcelamento do Solo: https://www.planalto.gov.br/ccivil_03/leis/l6766.htm
- Política Nacional de Resíduos Sólidos: https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/lei/l12305.htm
- Lei de Licitações: https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm
- Lei Geral do Licenciamento Ambiental: https://www2.camara.leg.br/legin/fed/lei/2025/lei-15190-8-agosto-2025-797833-normaatualizada-pl.html
- Marco Legal do Transporte Público Coletivo Urbano: https://legis.senado.leg.br/norma/43403974/publicacao/43407070
- Lei de Responsabilidade Fiscal: https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp101.htm

---

## 16. Decisão pendente antes de codificar

O Vilarejo precisa decidir se sua ordem jurídica será:

1. **Municipal ampliada:** o jogador controla principalmente o governo local, sujeito às leis e transferências de níveis superiores.
2. **Estado autônomo simplificado:** o jogador controla um ente com competências amplas, com níveis federal, regional e local representados de forma abstrata.
3. **Sandbox institucional:** o jogador define a própria Constituição e distribui competências, mantendo coerência interna e limites econômicos.

Essa decisão muda quais normas podem ser propostas pelo jogador, quais vêm de níveis superiores e quais apenas podem ser executadas localmente. Não é necessário decidir agora para discutir o conteúdo, mas será obrigatório antes de implementar o processo legislativo e validar competências.

**Conclusão:** esta biblioteca é um inventário inicial de 100 propostas. Ela amplia o universo de legislação, mas não declara nenhuma delas aprovada, juridicamente validada ou pronta para execução. O próximo trabalho deve ser revisar o catálogo segmento por segmento e aprofundar os mecanismos antes de criar código.
