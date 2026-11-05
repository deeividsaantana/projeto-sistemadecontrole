-- Garantias que as APIs esperavam do Firestore e o adaptador sobre o Supabase
-- não dava (auditoria de 04/11/2026, achados 002 e 004). Usadas só pelo
-- servidor, com service_role.

-- Limite de requisições dos links públicos: um contador por chave e janela.
create table if not exists public.api_request_windows (
  chave text primary key,
  organization_id text not null default 'renea' references public.organizations(id),
  janela_inicio timestamptz not null default now(),
  contagem integer not null default 0
);
alter table public.api_request_windows enable row level security;
revoke all on table public.api_request_windows from anon, authenticated;

-- Conta a requisição e diz se ainda está dentro do limite. O insert com
-- on conflict é atômico: duas requisições juntas nunca leem o mesmo número.
create or replace function public.registrar_requisicao(p_chave text, p_limite integer, p_janela_segundos integer)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_contagem integer;
begin
  insert into public.api_request_windows as atual (chave, janela_inicio, contagem)
  values (p_chave, now(), 1)
  on conflict (chave) do update set
    contagem = case when atual.janela_inicio + make_interval(secs => p_janela_segundos) <= now() then 1 else atual.contagem + 1 end,
    janela_inicio = case when atual.janela_inicio + make_interval(secs => p_janela_segundos) <= now() then now() else atual.janela_inicio end
  returning contagem into v_contagem;
  return v_contagem <= p_limite;
end;
$$;

-- Lote de documentos numa transação só: tudo grava ou nada grava.
create or replace function public.aplicar_lote_documentos(p_gravar jsonb, p_apagar text[])
returns void
language plpgsql
set search_path = public
as $$
begin
  insert into public.legacy_documents (id, collection_path, path, organization_id, payload, updated_at)
  select doc.id, doc.collection_path, doc.path, coalesce(doc.organization_id, 'renea'), doc.payload, now()
  from jsonb_to_recordset(coalesce(p_gravar, '[]'::jsonb))
    as doc(id text, collection_path text, path text, organization_id text, payload jsonb)
  on conflict (path) do update set
    id = excluded.id,
    collection_path = excluded.collection_path,
    organization_id = excluded.organization_id,
    payload = excluded.payload,
    updated_at = excluded.updated_at;
  delete from public.legacy_documents where path = any(coalesce(p_apagar, array[]::text[]));
end;
$$;

revoke all on function public.registrar_requisicao(text, integer, integer) from public, anon, authenticated;
revoke all on function public.aplicar_lote_documentos(jsonb, text[]) from public, anon, authenticated;
grant execute on function public.registrar_requisicao(text, integer, integer) to service_role;
grant execute on function public.aplicar_lote_documentos(jsonb, text[]) to service_role;

-- O PostgREST precisa ver as funções novas; sem isso o limite fica liberado e o
-- lote volta a gravar um por um até o cache recarregar.
notify pgrst, 'reload schema';
