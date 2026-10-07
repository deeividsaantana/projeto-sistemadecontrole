# RENEA ERP: guia para agentes de código

## Antes de alterar

1. Leia `README.md` e o documento de arquitetura relacionado à tarefa.
2. Confirme `git status`, branch e remote. Há outros checkouts RENEA na máquina.
3. Preserve dados reais, rotas, cálculos, permissões e links públicos.
4. Rode `npm run verify` antes de entregar.

## Stack e limites

- Frontend: React 19, TypeScript, Vite 6 e Tailwind CSS 4.
- Operação atual: cache local resiliente e sincronização Firebase.
- Destino gradual: Supabase, conforme `docs/ARQUITETURA_MIGRACAO_SUPABASE.md`.
- Não migre framework nem reescreva o app inteiro.
- Não importe SDKs de banco diretamente em componentes de tela.
- Nunca exponha conta de serviço, `service_role`, token privado ou credencial em
  código cliente, arquivo versionado ou variável `VITE_*`.

## Invariantes operacionais

- Um registro fornecido nunca deve sumir silenciosamente.
- Ausência de dado não pode virar zero, status ou horário inventado.
- Exclusão operacional é inativação quando o domínio exige histórico.
- Escritas concorrentes devem preservar novidades dos dois lados e respeitar a
  base de sincronização que diferencia exclusão de criação.
- Links públicos precisam manter token, idempotência, limite de requisições e
  caminho leve sem carregar o ERP administrativo.

## Migração de dados

- `firebase`: estado de produção padrão.
- `dual-write`: Firebase autoritativo e Supabase como espelho de homologação.
- `supabase`: somente depois de provisionar Auth, RLS e reconciliar os dados.
- Toda tabela normalizada nova precisa de `organization_id`, RLS, autoria,
  migration versionada, tipo TypeScript e teste de reconciliação.
- Não remova o caminho antigo na mesma mudança que inicia a primeira escrita de
  um módulo no provedor novo.

## Organização do código

- `src/components`: telas e fluxos de interface.
- `src/utils`: regras de domínio puras e testáveis.
- `src/cloud`: contratos e gateway independente de provedor.
- `src/supabase`: implementação exclusiva do Supabase.
- `src/firebase*.ts`: implementação Firebase ainda ativa.
- `supabase/migrations`: evolução versionada do banco PostgreSQL.
- `tests`: contratos operacionais e redes de proteção.

