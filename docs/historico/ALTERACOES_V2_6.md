# Alterações v2.6 — Controle de Estacas

## Entregue

- módulo operacional de recebimentos, lotes, notas fiscais e cravações;
- importação das abas `Lançamentos` e `Cravações` sem descarte silencioso;
- associação assistida de cravação ao lote por perfil, comprimento e saldo;
- cálculo de recebido, cravado, sobra, perda e saldo confirmado;
- conferência consolidada por nota fiscal;
- persistência local, backup, Firebase, importação, reset e snapshot;
- tabelas e visão de saldo para Supabase.

## Regras preservadas

- valor total = peso x valor unitário quando não informado;
- cravação mantém comprimento original e comprimento efetivamente cravado;
- sobra e perda são controles distintos;
- linhas incompletas da planilha entram como pendentes para revisão;
- cravação nunca é apagada quando o lote é removido: fica disponível para reassociação.
