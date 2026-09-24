-- Subáreas de fornecedor no cadastro de parceiros, espelhando o tipo Empresa
-- do app: TERCEIRA (já usada no Firestore e ausente do check original),
-- LOCACAO_EQUIPAMENTOS, MATERIAIS e SUBFORNECEDOR, mais o vínculo do
-- subfornecedor com o fornecedor principal.
--
-- Só amplia o conjunto aceito: nenhum registro existente deixa de passar.

alter table public.parceiros
  drop constraint if exists parceiros_tipos_check;

alter table public.parceiros
  add constraint parceiros_tipos_check
  check (tipos <@ array[
    'EMPRESA', 'FORNECEDOR', 'GERADOR', 'ACEITANTE', 'TRANSPORTADORA',
    'TERCEIRA', 'LOCACAO_EQUIPAMENTOS', 'MATERIAIS', 'SUBFORNECEDOR'
  ]);

alter table public.parceiros
  add column if not exists fornecedor_principal_id uuid
    references public.parceiros(id) on delete set null;

create index if not exists parceiros_fornecedor_principal_idx
  on public.parceiros(fornecedor_principal_id);
