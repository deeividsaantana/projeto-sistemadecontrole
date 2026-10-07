-- Expande os tipos de parceiro usados pelo cadastro legado.
-- A migration inicial permitia FORNECEDOR, mas não suas subcategorias
-- LOCACAO_EQUIPAMENTOS e MATERIAIS, impedindo a classificação no piloto.

alter table public.parceiros
  drop constraint if exists parceiros_tipos_check;

alter table public.parceiros
  add constraint parceiros_tipos_check check (
    tipos <@ array[
      'EMPRESA',
      'FORNECEDOR',
      'GERADOR',
      'ACEITANTE',
      'TRANSPORTADORA',
      'LOCACAO_EQUIPAMENTOS',
      'MATERIAIS'
    ]::text[]
  );
