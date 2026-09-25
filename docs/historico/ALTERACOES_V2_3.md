# Alterações — ERP v2.3

## Cadastro operacional

- categoria da frota: equipamento, veículo ou implemento;
- código de integração SGE;
- família;
- mobilização e datas;
- meta de disponibilidade;
- operador responsável;
- combustível e capacidade do tanque;
- vínculo entre implemento e equipamento.

## Centro Operacional

- consolidação de disponibilidade;
- comparação com meta;
- ordens de serviço abertas;
- partes diárias pendentes;
- última parte diária;
- operador atual;
- filtros por categoria e busca.

## Importação mestre

- `CAD_EQUIPAMENTOS`, `CAD_VEICULOS` e `SGE` passam a ser reconhecidas;
- placas repetidas entram como duplicidade;
- linhas sem placa, prefixo ou descrição permanecem como inválidas para revisão;
- a aba `CBs` é preservada sem promoção automática;
- gateway e RPC aceitam equipamentos e veículos.

## Banco de dados

- migration `202607310003_v2_3_equipment_operations.sql`;
- campos adicionais em `equipment` e `vehicles`;
- identificadores externos;
- mobilizações;
- operadores por período;
- eventos operacionais;
- visão consolidada;
- auditoria, RLS e isolamento por organização.

## Compatibilidade

- nenhuma chave de `localStorage` foi criada;
- o array `equipamentos` existente continua sendo salvo, exportado, importado, restaurado e sincronizado como antes;
- todos os novos campos são opcionais;
- nenhum arquivo ou módulo anterior foi removido.
