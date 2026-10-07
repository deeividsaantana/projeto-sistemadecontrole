# Arquitetura do ERP v3.0

## Fonte única de verdade

| Domínio | Fonte principal |
|---|---|
| Empresas, obras, equipamentos e pessoas | cadastros mestres |
| Combustível | abastecimentos e lubrificações |
| Viagens | tickets de liberação e recebimento |
| Materiais | cadastro e movimentações |
| Estacas | `ControleEstacas` com lotes e cravações |
| Produção | RDO, apontamentos por ramo e partes diárias |
| Fechamentos | snapshots imutáveis por checksum |

## Fluxo de estacas

1. Registrar ou importar o recebimento por NF.
2. Identificar material, perfil, comprimento, peso, valor e veículo.
3. Conferir a NF e manter divergências explícitas.
4. Registrar cada item cravado.
5. Associar manualmente ou por sugestão ao lote.
6. Calcular recebido, cravado, perda e saldo confirmado.
7. Levar o resultado ao painel e ao fechamento do período.

## Fluxo de relatórios

1. Aplicar filtros operacionais.
2. Consultar as coleções mestres.
3. Exportar Excel, PDF, CSV ou impressão.
4. No fechamento, retirar o período da operação ativa.
5. Gravar versão e checksum.
6. Restaurar sem destruir o snapshot original.

## Fluxo offline

1. Dados operacionais são persistidos localmente.
2. Falha de sincronização gera comando idempotente.
3. A fila usa IndexedDB.
4. Ao reconectar, o sistema envia o snapshot local atual.
5. O comando é removido somente após confirmação.

## Inteligência documental

A extração é uma camada assistiva e não uma fonte de verdade. O usuário revisa os campos antes de enviá-los ao módulo operacional. O sistema permanece funcional sem IA.
