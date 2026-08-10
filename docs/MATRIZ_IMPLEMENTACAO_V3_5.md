# Matriz de implementação v3.5

Esta matriz separa o que já existe no projeto do que precisa ser concluído.
Ela evita prometer módulos que ainda dependem de integração com o banco real.

| Requisito | Situação atual | Próxima entrega segura |
| --- | --- | --- |
| Login por e-mail e senha | Firebase Authentication, recuperação de senha e expiração por inatividade estão integrados. | Confirmar e-mail quando houver serviço transacional configurado. |
| Perfis de acesso | Menu e regras Firestore possuem papéis de staff; auditoria é exclusiva do administrador. | Centralizar permissões por ação em todos os módulos. |
| Cadastros | Empresas, obras, equipamentos, funcionários e materiais já existem. | Completar ramo, trecho, frente, fornecedor e inativação/restauração uniforme. |
| Estacas | Lotes, cravações, saldo, resumo e anexos protegidos de lote existem. | Chave única por obra/ramo/trecho/número e operações em lote. |
| Materiais | Cadastro e registros existem. | Modelar entrada, saída e ajuste como movimentações imutáveis com saldo por material. |
| Tickets e viagens | Liberação, recebimento, pareamento e impressão existem. | Reservas e pareamentos transacionais no servidor, sem duplicidade concorrente. |
| Abastecimento | Validação de hora, bomba, prefixo e anomalias existe. | Persistência segmentada e justificativa obrigatória de correções. |
| Equipamentos | Cadastro, manutenção e parte diária existem. | Histórico de utilização por equipamento e alertas de manutenção por prazo. |
| Efetivo | Listas, grupos e links públicos já existem. | Chave única funcionário/data e filtros por ramo, trecho e frente. |
| Pendências | Página central derivada de tickets, combustível, materiais, estacas, manutenção e partes diárias. | Persistir responsável, prazo e observação sem duplicar os alertas de origem. |
| Auditoria | Histórico operacional local e trilha protegida no Firebase para ações administrativas. | Registrar também operações de todos os módulos já existentes. |
| Importação | Importadores e preservação de linhas para revisão existem em módulos. | Fluxo único de prévia, mapeamento, erros exportáveis e confirmação. |
| Relatórios | Excel, PDF, CSV e dashboards já existem. | Cabeçalho corporativo unificado, filtros globais e paginação. |
| Fotos/documentos | Storage protegido, limite de 10 MB e vínculo de anexos de lote de estacas. | Conectar anexos aos demais módulos operacionais. |
| Dados reais | Firebase já recebe os snapshots operacionais. | Migrar por módulo para coleções auditáveis após backup e reconciliação; publicar frontend e funções na Netlify. |
| RDO | Removido do produto ativo. | Não reintroduzir dados, páginas, campos ou sincronização desse módulo. |

## Ordem de execução

1. Criar a camada de persistência segmentada, sem desligar a sincronização atual.
2. Migrar cadastros e tickets para a nova camada com comparação de contagens e checksum.
3. Migrar abastecimentos, materiais e estacas, mantendo importação não destrutiva.
4. Adicionar pendências, auditoria completa e anexos protegidos.
5. Rodar testes funcionais, exportar backup e publicar somente após homologação.

## Critérios de aceite da migração de cada módulo

- A contagem de registros antigo e novo deve ser conciliada.
- Registros inválidos, duplicados ou desconhecidos devem ficar disponíveis para revisão.
- Nenhum importador pode sobrescrever informação existente sem confirmação.
- O usuário sem permissão deve receber bloqueio também no Firestore, não apenas na tela.
- Exportação deve reproduzir os dados filtrados e informar data, usuário e filtros.
