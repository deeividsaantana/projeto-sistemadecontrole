create table if not exists public.usage_telemetry (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id),
  day date not null,
  user_id uuid not null,
  user_label text not null,
  tabs jsonb not null default '{}'::jsonb,
  tab_labels jsonb not null default '{}'::jsonb,
  last_tab text,
  updated_at timestamptz not null default now(),
  unique (organization_id, day, user_id)
);
alter table public.usage_telemetry enable row level security;
