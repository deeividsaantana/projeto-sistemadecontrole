-- Fecha as 5 tabelas do módulo Solicitações e Compras que ficaram sem RLS
-- na 202611130001. Mesmo padrão das tabelas irmãs (erp_requests etc.):
-- RLS ligado, sem policy, e sem permissão para anon/authenticated.
-- O site acessa essas tabelas só pela API (api/procurement*.js e o job de
-- sincronização da planilha) com a chave service_role, que ignora RLS,
-- e pelas funções security definer create_erp_request/transition_erp_request.

alter table public.erp_request_items enable row level security;
alter table public.erp_request_comments enable row level security;
alter table public.erp_request_signatures enable row level security;
alter table public.erp_procurement_sheet_rows enable row level security;
alter table public.erp_procurement_sync_runs enable row level security;

revoke all on
  public.erp_request_items,
  public.erp_request_comments,
  public.erp_request_signatures,
  public.erp_procurement_sheet_rows,
  public.erp_procurement_sync_runs
from anon, authenticated;

notify pgrst, 'reload schema';
