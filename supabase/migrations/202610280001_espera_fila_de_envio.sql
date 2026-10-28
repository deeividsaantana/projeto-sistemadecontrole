-- Fila de envio com 10 pessoas lançando ao mesmo tempo (28/10/2026).
--
-- Cada envio espera a vez numa trava por organização e leva de 2 a 4 s,
-- porque regrava o retrato inteiro. A sessão da API desiste de esperar uma
-- trava depois de 8 s (lock_timeout do papel authenticator): com 10 pessoas
-- salvando juntas, as últimas da fila recebiam erro 500 e o aparelho tentava
-- de novo, engrossando a fila. Em 28/10, entre 11h e 12h, 43 de 86 envios
-- falharam assim.
--
-- Aqui as duas funções de envio esperam até 25 s pela vez, abaixo dos 30 s
-- de statement_timeout do papel authenticated. Nada muda no que é gravado.

alter function public.apply_erp_snapshot_changes(text, jsonb) set lock_timeout = '25s';
alter function public.publish_erp_snapshot(text, timestamptz, jsonb) set lock_timeout = '25s';
