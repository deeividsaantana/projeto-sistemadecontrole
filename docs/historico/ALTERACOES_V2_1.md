# Alterações — ERP v2.1

## Objetivo

Criar uma fundação de banco profissional e opcional sem substituir Firebase, armazenamento local, importações atuais ou regras operacionais.

## Implementado

- Migration Supabase/PostgreSQL com UUIDs, chaves estrangeiras, índices, RLS, soft delete e timestamps.
- Doze cadastros mestres expostos pelo contrato seguro.
- Estrutura para organizações, usuários e perfis.
- Catálogo unificado `master_data_catalog`.
- Auditoria automática em `audit_events`.
- Lotes, linhas e problemas de importação sem descarte silencioso.
- RPC transacional `ingest_import_batch`.
- Gateway Netlify protegido pelo token Firebase.
- Isolamento por organização definido pelo servidor.
- Permissões equivalentes aos quatro perfis existentes.
- Cliente TypeScript opcional para status, consulta, criação, edição, arquivamento e preservação de importações.
- Cartão de diagnóstico no painel administrativo.
- Claim opcional `organization_id` no provisionamento de usuários.

## Compatibilidade preservada

- Firebase continua ativo.
- Nenhuma coleção ou chave de `localStorage` foi removida ou renomeada.
- Nenhum lançamento operacional foi convertido automaticamente.
- Nenhuma tela existente depende do Supabase para funcionar.
- A ausência das variáveis Supabase aparece apenas como modo opcional não ativado.
- Exclusões do novo gateway são lógicas, não físicas.

## Arquivos principais

- `supabase/migrations/202607310001_v2_1_foundation.sql`
- `supabase/README.md`
- `netlify/functions/master-data.js`
- `netlify/functions/_shared/master-data-contract.js`
- `netlify/functions/_shared/supabase-rest.js`
- `src/services/masterDataApi.ts`
- `src/components/ConfiguracoesTab.tsx`
- `docs/ARQUITETURA_DADOS_V2_1.md`
- `tests/masterDataContract.test.ts`
- `tests/supabaseSchema.test.ts`
