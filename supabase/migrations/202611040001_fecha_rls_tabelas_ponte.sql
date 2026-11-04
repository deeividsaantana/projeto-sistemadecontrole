-- Fecha a RLS das tabelas ponte da migração (auditoria de 04/11/2026, achado 001).
-- Elas tinham "for all to authenticated using (true) with check (true)": qualquer
-- conta logada, de qualquer organização e de qualquer perfil, lia, alterava e
-- apagava auditoria, usuários, chaves de idempotência, filas e tickets públicos.

-- legacy_documents é usada só pelas APIs, com service_role (que ignora a RLS).
-- Sem política e sem grant, o cliente não alcança a tabela.
drop policy if exists "authenticated can use legacy documents" on public.legacy_documents;
revoke all on table public.legacy_documents from anon, authenticated;

-- Fila de envios dos links públicos: o app lê os pendentes (e o tempo real, que
-- respeita a política de leitura) e marca como processado. Inserir e apagar
-- continuam só pelo servidor.
drop policy if exists "authenticated can use submissions" on public.erp_public_submissions;
create policy "members read organization submissions"
  on public.erp_public_submissions for select to authenticated
  using (public.is_organization_member(organization_id));
create policy "editors update organization submissions"
  on public.erp_public_submissions for update to authenticated
  using (public.has_organization_role(organization_id, array['admin', 'editor']))
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));
revoke all on table public.erp_public_submissions from anon;
revoke insert, delete, truncate on table public.erp_public_submissions from authenticated;

-- Tickets do link público: o app lê, grava (upsert) e apaga.
drop policy if exists "authenticated can use public tickets" on public.erp_public_tickets;
create policy "members read organization public tickets"
  on public.erp_public_tickets for select to authenticated
  using (public.is_organization_member(organization_id));
create policy "editors insert organization public tickets"
  on public.erp_public_tickets for insert to authenticated
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));
create policy "editors update organization public tickets"
  on public.erp_public_tickets for update to authenticated
  using (public.has_organization_role(organization_id, array['admin', 'editor']))
  with check (public.has_organization_role(organization_id, array['admin', 'editor']));
create policy "editors delete organization public tickets"
  on public.erp_public_tickets for delete to authenticated
  using (public.has_organization_role(organization_id, array['admin', 'editor']));
revoke all on table public.erp_public_tickets from anon;
revoke truncate on table public.erp_public_tickets from authenticated;
