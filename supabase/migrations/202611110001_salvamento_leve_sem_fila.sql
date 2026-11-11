-- Salvamento mais leve e fila que não derruba o banco (11/11/2026).
--
-- Em 10 e 11/11/2026 o banco voltou a cair várias vezes por dia. Medido em
-- produção: o servidor é pequeno (CPU compartilhada) e cada salvamento regrava
-- o bloco inteiro da obra (14 MB). A mesma consulta que leva 0,7 s com a
-- máquina livre levou 9,8 s com ela ocupada, e até ler uma data (select
-- updated_at) chegou a demorar 15 s. Os salvamentos esperavam até 25 s na
-- fila (lock_timeout da 202610280001), cada um segurando uma das poucas
-- conexões da API. Com a fila cheia, login e leitura ficavam sem conexão
-- (erro 522) e o app ainda reenviava a cada 30 s.
--
-- 1. O bloco passa a ser comprimido com lz4: no mesmo bloco de 14 MB, reescrever
--    leva 134 ms em vez de 250 ms (medido localmente), e toda leitura
--    descomprime mais rápido. Só vale para o que for gravado daqui para frente,
--    e o próximo salvamento já regrava o bloco inteiro.
-- 2. Quem espera na fila desiste em 5 s, em vez de 25 s. O app guarda o que não
--    subiu e tenta de novo sozinho, então a espera longa só segurava conexão.
-- 3. As ordenações dos salvamentos usam 32 MB de memória, em vez de gravar
--    arquivos temporários em disco (os 2 MB padrão faziam a mesclagem gravar
--    21 MB em disco por coleção).
--
-- O corpo das funções de envio não muda. Voltar atrás:
--   alter table public.erp_snapshots alter column payload set compression pglz;
--   alter table public.erp_snapshot_history alter column payload set compression pglz;
--   alter function public.apply_erp_snapshot_changes(text, jsonb) set lock_timeout = '25s';
--   alter function public.apply_erp_snapshot_changes(text, jsonb) reset work_mem;
--   alter function public.publish_erp_snapshot(text, timestamptz, jsonb) set lock_timeout = '25s';
--   alter function public.publish_erp_snapshot(text, timestamptz, jsonb) reset work_mem;
--
-- Atenção: create or replace function refaz a configuração das funções. Quem
-- recriar apply_erp_snapshot_changes ou publish_erp_snapshot precisa repetir os
-- alter function abaixo (tests/salvamentoLeveSemFila.test.ts confere).

-- Se algum salvamento estiver gravando agora, desiste em vez de formar fila.
set lock_timeout = '5s';

alter table public.erp_snapshots alter column payload set compression lz4;
alter table public.erp_snapshot_history alter column payload set compression lz4;

reset lock_timeout;

alter function public.apply_erp_snapshot_changes(text, jsonb) set lock_timeout = '5s';
alter function public.apply_erp_snapshot_changes(text, jsonb) set work_mem = '32MB';
alter function public.publish_erp_snapshot(text, timestamptz, jsonb) set lock_timeout = '5s';
alter function public.publish_erp_snapshot(text, timestamptz, jsonb) set work_mem = '32MB';
