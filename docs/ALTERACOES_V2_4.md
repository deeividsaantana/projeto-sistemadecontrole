# Alterações — ERP v2.4

## Domínio de combustível

- competência derivada da data real do lançamento;
- custo por litro e custo total;
- capacidade de tanque e percentual abastecido;
- alertas de capacidade sem bloqueio;
- status de revisão no próprio abastecimento;
- preservação dos alertas originais de planilha e OneDrive.

## Operação diária

- a sugestão da bomba usa o último lançamento gravado do mesmo comboio, mesmo em digitação retroativa;
- a auditoria cronológica continua separando comboios por data e hora;
- prefixos desconhecidos permanecem lançáveis e seguem para conferência;
- KM e horímetro retroativos continuam gerando somente aviso;
- nenhuma linha é descartada por qualidade, duplicidade ou cadastro incompleto.

## Fila de conferência

- mapa de alertas reativado;
- qualidade calculada por registro;
- conferência manual com usuário e data;
- edição disponível antes da aprovação;
- registros aprovados permanecem no mesmo array `abastecimentos`.

## Integrações

- OneDrive reconhece custo por litro quando a coluna existir;
- importador Excel reconhece aliases de custo;
- análise por PDF/foto continua opcional, com parser local e serviço Netlify quando configurado;
- exportação Excel inclui competência, custo, tanque e revisão.

## Supabase

- migration `202607310004_v2_4_fuel_operations.sql`;
- tabela canônica `fueling_events`;
- fila `fuel_review_items`;
- RPC `stage_fuel_import`;
- visão `fuel_review_summary`;
- RLS, auditoria e isolamento por organização;
- envio em lotes de até 5.000 registros;
- nenhuma promoção automática para a tabela canônica.

## Compatibilidade

- nenhuma chave de `localStorage` foi criada;
- `renea_abastecimentos` e `renea_combustiveis` continuam sendo as fontes locais oficiais;
- novos campos são opcionais para registros históricos;
- reset explícito para vazio continua gravando `[]`;
- nenhum módulo anterior foi removido.
