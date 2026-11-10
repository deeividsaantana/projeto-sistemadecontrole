-- Materiais e Jazida saem do sistema (pedido do dono em 10/11/2026).
--
-- Em 09/11/2026 o banco de produção parou: toda a obra fica num jsonb só em
-- erp_snapshots (27 MB em texto), regravado inteiro a cada salvamento. Só os
-- movimentos de materiais são 10,6 MB; os tickets de jazida, 0,9 MB; e as
-- marcas de exclusão dos tickets de jazida, mais 1,5 MB. Tirar tudo isso deixa
-- o bloco com cerca de metade do tamanho.
--
-- Nenhum registro some (AGENTS.md): antes de sair do bloco, cada registro é
-- guardado em erp_colecoes_removidas, que só cresce. O histórico de versões
-- (erp_snapshot_history) também guarda o bloco anterior inteiro, porque a
-- contagem de registros cai.
--
-- Aparelho antigo que ainda mande essas coleções: o gatilho guarda o que veio
-- e tira do bloco antes de gravar. As travas de encolhimento e de perfil
-- rodam antes, dentro das funções de envio, e não mudam.
--
-- Voltar atrás: drop trigger erp_snapshots_tira_colecoes_removidas on
-- public.erp_snapshots; e devolver ao bloco o que está em
-- erp_colecoes_removidas (colecao = nome da chave no bloco; as marcas de
-- exclusão estão com colecao = 'exclusoes').

create table if not exists public.erp_colecoes_removidas (
  organization_id text not null references public.organizations(id) on delete cascade,
  colecao text not null,
  id text not null,
  registro jsonb not null,
  removido_em timestamptz not null default clock_timestamp(),
  primary key (organization_id, colecao, id),
  constraint erp_colecoes_removidas_registro_objeto check (jsonb_typeof(registro) = 'object')
);

alter table public.erp_colecoes_removidas enable row level security;

-- Arquivo: ninguém do app lê nem grava. Só o gatilho (security definer).
revoke all on public.erp_colecoes_removidas from anon, authenticated;

-- Coleções que saíram do sistema. Marcas de exclusão que apontam para elas
-- também saem do bloco.
create or replace function public.erp_colecoes_fora_do_bloco()
returns text[]
language sql
immutable
as $$
  select array['materiaisCadastro', 'materiaisMovimentos', 'materiaisPrevistos', 'ticketsJazida']::text[];
$$;

create or replace function public.erp_tirar_colecoes_removidas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fora text[] := public.erp_colecoes_fora_do_bloco();
  v_colecao text;
  v_marcas jsonb;
  v_marcas_antes jsonb;
begin
  if new.payload is null or jsonb_typeof(new.payload) <> 'object' then
    return new;
  end if;

  v_marcas := case when jsonb_typeof(new.payload -> 'exclusoes') = 'array' then new.payload -> 'exclusoes' end;
  v_marcas_antes := case when tg_op = 'UPDATE' and jsonb_typeof(old.payload -> 'exclusoes') = 'array'
    then old.payload -> 'exclusoes' end;

  -- Salvamento comum (nada das coleções removidas e marcas iguais) sai na hora.
  -- A limpeza inicial (fim deste arquivo) passa por tudo.
  if not (new.payload ?| v_fora)
     and (v_marcas is null or v_marcas is not distinct from v_marcas_antes)
     and coalesce(current_setting('erp.limpar_colecoes_removidas', true), '') <> 'on' then
    return new;
  end if;

  -- 1. Guarda as coleções que vieram no bloco e as tira dele.
  foreach v_colecao in array v_fora loop
    continue when not (new.payload ? v_colecao);
    if jsonb_typeof(new.payload -> v_colecao) = 'array' then
      insert into public.erp_colecoes_removidas as arquivo (organization_id, colecao, id, registro)
      select distinct on (item ->> 'id') new.organization_id, v_colecao, item ->> 'id', item
      from jsonb_array_elements(new.payload -> v_colecao) item
      where jsonb_typeof(item) = 'object' and coalesce(item ->> 'id', '') <> ''
      order by item ->> 'id', public.erp_registro_momento(item) desc nulls last
      on conflict (organization_id, colecao, id) do update set
        registro = excluded.registro,
        removido_em = excluded.removido_em
      where arquivo.registro is distinct from excluded.registro
        and coalesce(public.erp_registro_momento(excluded.registro) >= public.erp_registro_momento(arquivo.registro), true);
    end if;
    new.payload := new.payload - v_colecao;
  end loop;

  -- 2. Marcas de exclusão dessas coleções: guarda e tira do bloco.
  if v_marcas is not null and exists (
    select 1 from jsonb_array_elements(v_marcas) marca where marca ->> 'tabela' = any(v_fora)
  ) then
    insert into public.erp_colecoes_removidas as arquivo (organization_id, colecao, id, registro)
    select distinct on (marca ->> 'id') new.organization_id, 'exclusoes', marca ->> 'id', marca
    from jsonb_array_elements(v_marcas) marca
    where marca ->> 'tabela' = any(v_fora)
      and jsonb_typeof(marca) = 'object' and coalesce(marca ->> 'id', '') <> ''
    order by marca ->> 'id', public.erp_registro_momento(marca) desc nulls last
    on conflict (organization_id, colecao, id) do update set
      registro = excluded.registro,
      removido_em = excluded.removido_em
    where arquivo.registro is distinct from excluded.registro
      and coalesce(public.erp_registro_momento(excluded.registro) >= public.erp_registro_momento(arquivo.registro), true);

    new.payload := jsonb_set(new.payload, '{exclusoes}', coalesce((
      select jsonb_agg(marca order by ordem)
      from jsonb_array_elements(v_marcas) with ordinality as linha(marca, ordem)
      where not coalesce(marca ->> 'tabela' = any(v_fora), false)
    ), '[]'::jsonb));
  end if;

  -- A contagem segue o que ficou no bloco: sem isso o próximo salvamento
  -- pareceria encolher e copiaria o bloco inteiro no histórico.
  select coalesce(sum(jsonb_array_length(entry.value)), 0)::integer
    into new.record_count
    from jsonb_each(new.payload) entry
    where jsonb_typeof(entry.value) = 'array';

  return new;
end;
$$;

revoke all on function public.erp_tirar_colecoes_removidas() from public, anon, authenticated;

drop trigger if exists erp_snapshots_tira_colecoes_removidas on public.erp_snapshots;
create trigger erp_snapshots_tira_colecoes_removidas
before insert or update of payload on public.erp_snapshots
for each row execute function public.erp_tirar_colecoes_removidas();

-- Aplica no que já está gravado. O gatilho guarda e tira; o histórico guarda o
-- bloco anterior inteiro (a contagem cai).
select set_config('erp.limpar_colecoes_removidas', 'on', true);

update public.erp_snapshots
set payload = payload
where payload ?| public.erp_colecoes_fora_do_bloco()
   or exists (
     select 1 from jsonb_array_elements(
       case when jsonb_typeof(payload -> 'exclusoes') = 'array' then payload -> 'exclusoes' else '[]'::jsonb end
     ) marca
     where marca ->> 'tabela' = any(public.erp_colecoes_fora_do_bloco())
   );

select set_config('erp.limpar_colecoes_removidas', '', true);
