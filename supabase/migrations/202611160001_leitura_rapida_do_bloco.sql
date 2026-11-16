-- Abrir o site sem esperar 25 s (16/11/2026).
--
-- Medido em produção depois de 202611150003: ler_erp_snapshot levava 25 s
-- (7 chamadas, pico 30,8 s). erp_montar_bloco perguntava "o bloco tem esta
-- coleção?" (p_payload ? colecao) linha por linha: o bloco de 4 MB era
-- descompactado 14 mil vezes (1,1 milhão de páginas lidas por chamada). A
-- mesma pergunta estava em erp_contar_separados.
--
-- Agora as coleções que faltam no bloco são vistas uma vez só (são 4), antes
-- de ler a tabela. O resultado é o mesmo; tests/sql/leituraRapidaDoBloco.sql
-- compara com a versão anterior.
--
-- Voltar atrás: rodar de novo as duas funções de
-- 202611150003_lancamentos_em_tabela_propria.sql.

create or replace function public.erp_colecoes_fora_do_payload(p_payload jsonb)
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_agg(colecao), array[]::text[])
  from unnest(public.erp_colecoes_separadas()) colecao
  where not coalesce(p_payload ? colecao, false);
$$;

revoke all on function public.erp_colecoes_fora_do_payload(jsonb) from public, anon, authenticated;

create or replace function public.erp_contar_separados(p_organization_id text, p_payload jsonb)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_fora text[] := public.erp_colecoes_fora_do_payload(p_payload);
begin
  if cardinality(v_fora) = 0 then
    return 0;
  end if;
  return (
    select count(*)::integer
    from public.erp_registros registro
    where registro.organization_id = p_organization_id
      and registro.colecao = any(v_fora)
  );
end;
$$;

revoke all on function public.erp_contar_separados(text, jsonb) from public, anon, authenticated;

create or replace function public.erp_montar_bloco(p_organization_id text, p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_fora text[];
begin
  if p_payload is null then
    return null;
  end if;
  v_fora := public.erp_colecoes_fora_do_payload(p_payload);
  if cardinality(v_fora) = 0 then
    return p_payload;
  end if;
  return p_payload || coalesce((
    select jsonb_object_agg(registro.colecao, registro.lista)
    from (
      select registro.colecao, jsonb_agg(registro.registro order by registro.ordem, registro.id) as lista
      from public.erp_registros registro
      where registro.organization_id = p_organization_id
        and registro.colecao = any(v_fora)
      group by registro.colecao
    ) registro
  ), '{}'::jsonb);
end;
$$;

revoke all on function public.erp_montar_bloco(text, jsonb) from public, anon, authenticated;
