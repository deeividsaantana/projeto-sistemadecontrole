# Alterações — ERP v2.5

## Viagens e tickets

- pareamento integral por `Ticket Nº`;
- eventos derivados de liberação, recebimento, impressão e devolução;
- duração da viagem;
- divergências estruturadas de prefixo, placa, material e quantidade;
- pendências separadas para ausência de liberação ou recebimento;
- duplicidades preservadas para revisão;
- lotes de impressão mantidos.

## Cadastros mestres

- equipamento vinculado por `equipamentoId`;
- material vinculado por `materialId`;
- origem e destino vinculados por IDs de local;
- ramo vinculado por `ramoId`;
- opções do formulário passam a incorporar materiais, obras e ramos ativos;
- textos de origem permanecem quando o vínculo ainda não existe.

## Tela operacional

- novo painel `Conferência automática das viagens`;
- indicadores de pares, divergências, pendências, duplicidades e duração média;
- fila de revisão sem ocultar registros incompletos;
- fluxo atual de duas vias, impressão, checklist diário, notas e link externo preservado.

## Excel

- exportação mantém `LIBERAÇÃO` e `RECEBIMENTO`;
- adiciona `CONFERÊNCIA VIAGENS`;
- adiciona `CONTROLE TICKETS`;
- adiciona `INDICADORES`;
- elimina dependência de fórmulas com intervalos fixos e referências quebradas.

## Supabase

- migration `202607310005_v2_5_travel_operations.sql`;
- entidade `travel_tickets`;
- eventos `travel_ticket_events`;
- lotes `travel_print_batches` e `travel_print_batch_items`;
- divergências `travel_divergences`;
- fila `travel_review_items`;
- RPC `stage_travel_import`;
- visão `travel_operation_overview`;
- RLS, auditoria e isolamento por organização;
- nenhuma promoção automática para a entidade canônica.

## Compatibilidade

- `ticketsJazida` continua sendo a fonte local oficial;
- `renea_tickets_jazida` continua em `localStorage`;
- backup, Firebase, importação, exportação e reset permanecem no mesmo fluxo;
- nenhuma tela anterior foi removida;
- novos campos são opcionais.
