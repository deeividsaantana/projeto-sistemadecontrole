-- Primeiro acesso: a pessoa cria a própria senha (18/11/2026).
--
-- Pedido do Deivid: quem cria o login só cria o usuário; a senha é da pessoa.
-- Ao criar o login (aba Dev ou Cadastros > Acessos), o sistema gera um link
-- /primeiro-acesso/<código>. A pessoa abre, digita a senha duas vezes e entra.
-- Ninguém mais vê essa senha.
--
-- Segurança:
-- - O código do link tem 256 bits aleatórios. O banco guarda só o resumo
--   (sha-256) do código, nunca o código nem a senha.
-- - Vale 7 dias e funciona uma vez só (used_at). Um link novo para a mesma
--   pessoa cancela os anteriores (revoked_at).
-- - Só a API (service_role) lê ou grava. Ninguém do app, nem logado, acessa.

begin;

create table if not exists public.erp_first_access_links (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  organization_id text not null,
  user_id uuid not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists erp_first_access_links_pessoa
  on public.erp_first_access_links (user_id) where used_at is null and revoked_at is null;

alter table public.erp_first_access_links enable row level security;
revoke all on public.erp_first_access_links from public, anon, authenticated;
grant select, insert, update on public.erp_first_access_links to service_role;

commit;
