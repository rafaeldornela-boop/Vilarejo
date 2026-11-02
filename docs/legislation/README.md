# Legislação — escopo não implementado

Não há módulo `src/legislation/` nem mecanismo de redação, tramitação, aprovação ou aplicação de leis identificado no código desta branch. Instituições fornece Câmara, bancadas, assentos, quórum, coalizão, oposição e mandato; não implementa votação legislativa. Política mantém grupos de interesse e impactos. Essas responsabilidades são relacionadas, mas não substituem um sistema jurídico.

O repositório não cria dados legais fictícios para preencher essa lacuna. Uma futura implementação deve definir domínio próprio, comandos/eventos, relação entre votação e Economia, efeitos verificáveis e ADR; mudanças fiscais devem ser executadas pela Economia com contabilidade correspondente. Consulte [contratos e eventos](../architecture/CONTRATOS_E_EVENTOS_V1.md).
