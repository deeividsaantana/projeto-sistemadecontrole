-- Movimentos de materiais em tabela própria, etapa 3a (expandir).
--
-- Em 09/11/2026 o banco de produção parou: toda a obra fica num jsonb só em
-- erp_snapshots (26 MB em texto, 41.856 registros), regravado inteiro a cada
-- salvamento. Os movimentos de materiais são 40% desse bloco (17.394
-- registros, 10,7 MB). Plano: docs/superpowers/specs/2026-11-09-registros-separados-design.md.
--
-- Esta etapa só ESPELHA: o bloco continua sendo a fonte da verdade, o app não
-- muda e nada sai do bloco. Um gatilho copia cada mudança dos movimentos para
-- a tabela nova, que é conferida com erp_conferir_materiais_movimentos antes
-- da etapa seguinte (o app passar a ler daqui).
--
-- Voltar atrás: drop trigger erp_snapshots_espelha_materiais_movimentos on
-- public.erp_snapshots; o bloco segue intacto.

create table if not exists public.erp_materiais_movimentos (
  organization_id text not null references public.organizations(id) on delete cascade,
  id text not null,
  registro jsonb not null,
  -- atualizadoEm do próprio registro (null quando o registro não tem).
  atualizado_em timestamptz,
  -- Quando o espelho gravou esta linha pela última vez.
  espelhado_em timestamptz not null default clock_timestamp(),
  -- Saiu do bloco: fica guardado, nunca é apagado por esta etapa.
  excluido_em timestamptz,
  primary key (organization_id, id),
  constraint erp_materiais_movimentos_registro_objeto check (jsonb_typeof(registro) = 'object')
);

create index if not exists erp_materiais_movimentos_espelhado_idx
  on public.erp_materiais_movimentos (organization_id, espelhado_em);

alter table public.erp_materiais_movimentos enable row level security;

-- Leitura só para membros da organização. Ninguém grava direto: só o gatilho.
do $$
begin
  create policy "membros leem movimentos de materiais"
    on public.erp_materiais_movimentos
    for select to authenticated
    using (exists (
      select 1 from public.organization_members member
      where member.organization_id = erp_materiais_movimentos.organization_id
        and member.user_id = auth.uid()
    ));
exception
  when duplicate_object then null;
end $$;

revoke all on public.erp_materiais_movimentos from anon;
revoke insert, update, delete, truncate on public.erp_materiais_movimentos from authenticated;
grant select on public.erp_materiais_movimentos to authenticated;

-- Lista do bloco, um registro por id (o último da lista vence, como no app).
create or replace function public.erp_movimentos_do_bloco(p_payload jsonb)
returns table (id text, registro jsonb)
language sql
immutable
set search_path = public
as $$
  select distinct on (item ->> 'id') item ->> 'id', item
  from jsonb_array_elements(
    case when jsonb_typeof(p_payload -> 'materiaisMovimentos') = 'array'
      then p_payload -> 'materiaisMovimentos' else '[]'::jsonb end
  ) with ordinality as linha(item, ordem)
  where jsonb_typeof(item) = 'object' and coalesce(item ->> 'id', '') <> ''
  order by item ->> 'id', ordem desc;
$$;

revoke all on function public.erp_movimentos_do_bloco(jsonb) from public, anon, authenticated;

create or replace function public.erp_espelhar_materiais_movimentos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes jsonb := case when tg_op = 'UPDATE' and jsonb_typeof(old.payload -> 'materiaisMovimentos') = 'array'
    then old.payload -> 'materiaisMovimentos' else '[]'::jsonb end;
  v_depois jsonb := case when jsonb_typeof(new.payload -> 'materiaisMovimentos') = 'array'
    then new.payload -> 'materiaisMovimentos' else '[]'::jsonb end;
  v_agora timestamptz := clock_timestamp();
begin
  -- Salvamento que não mexeu nos movimentos sai na hora.
  if v_antes = v_depois then
    return new;
  end if;

  -- Novos e alterados: o except compara por hash e devolve só o que mudou,
  -- sem ordenar a lista inteira (medido: 17 mil registros, ~0,15 s).
  insert into public.erp_materiais_movimentos as tabela (organization_id, id, registro, atualizado_em, espelhado_em, excluido_em)
  select distinct on (mudou.item ->> 'id')
    new.organization_id, mudou.item ->> 'id', mudou.item, public.erp_registro_momento(mudou.item), v_agora, null
  from (
    select item from jsonb_array_elements(v_depois) item
    except
    select item from jsonb_array_elements(v_antes) item
  ) mudou
  where jsonb_typeof(mudou.item) = 'object' and coalesce(mudou.item ->> 'id', '') <> ''
  order by mudou.item ->> 'id', public.erp_registro_momento(mudou.item) desc nulls last
  on conflict (organization_id, id) do update set
    registro = excluded.registro,
    atualizado_em = excluded.atualizado_em,
    espelhado_em = excluded.espelhado_em,
    excluido_em = null;

  -- Saíram do bloco: marca, não apaga.
  update public.erp_materiais_movimentos tabela
  set excluido_em = v_agora, espelhado_em = v_agora
  where tabela.organization_id = new.organization_id
    and tabela.excluido_em is null
    and tabela.id in (
      select item ->> 'id' from jsonb_array_elements(v_antes) item
      except
      select item ->> 'id' from jsonb_array_elements(v_depois) item
    );

  return new;
end;
$$;

revoke all on function public.erp_espelhar_materiais_movimentos() from public, anon, authenticated;

drop trigger if exists erp_snapshots_espelha_materiais_movimentos on public.erp_snapshots;
create trigger erp_snapshots_espelha_materiais_movimentos
after insert or update of payload on public.erp_snapshots
for each row execute function public.erp_espelhar_materiais_movimentos();

-- Cópia inicial do que já está no bloco.
insert into public.erp_materiais_movimentos (organization_id, id, registro, atualizado_em)
select snapshot.organization_id, bloco.id, bloco.registro, public.erp_registro_momento(bloco.registro)
from public.erp_snapshots snapshot
cross join lateral public.erp_movimentos_do_bloco(snapshot.payload) bloco
on conflict (organization_id, id) do update set
  registro = excluded.registro,
  atualizado_em = excluded.atualizado_em,
  espelhado_em = clock_timestamp(),
  excluido_em = null;

-- Conferência: tudo zero em faltando, sobrando e diferentes = espelho certo.
create or replace function public.erp_conferir_materiais_movimentos(p_organization_id text)
returns table (no_bloco integer, ativos_na_tabela integer, faltando integer, sobrando integer, diferentes integer)
language sql
stable
security definer
set search_path = public
as $$
  with bloco as (
    select b.id, b.registro
    from public.erp_snapshots s
    cross join lateral public.erp_movimentos_do_bloco(s.payload) b
    where s.organization_id = p_organization_id
  ),
  tabela as (
    select t.id, t.registro from public.erp_materiais_movimentos t
    where t.organization_id = p_organization_id and t.excluido_em is null
  )
  select
    (select count(*) from bloco)::integer,
    (select count(*) from tabela)::integer,
    (select count(*) from bloco where not exists (select 1 from tabela where tabela.id = bloco.id))::integer,
    (select count(*) from tabela where not exists (select 1 from bloco where bloco.id = tabela.id))::integer,
    (select count(*) from bloco join tabela using (id) where bloco.registro <> tabela.registro)::integer;
$$;

revoke all on function public.erp_conferir_materiais_movimentos(text) from public, anon, authenticated;
