# Fundação Supabase — ERP v2.4

Esta pasta contém a fundação PostgreSQL opcional da evolução gradual do Sistema RENEA. Ela não substitui o Firebase, não migra dados automaticamente e não altera os fluxos operacionais atuais.

## Aplicação da migration

1. Crie um projeto no plano gratuito do Supabase.
2. Abra o SQL Editor do projeto.
3. Execute as migrations em ordem:
   - `migrations/202607310001_v2_1_foundation.sql`
   - `migrations/202607310002_v2_2_master_data_review.sql`
   - `migrations/202607310003_v2_3_equipment_operations.sql`
   - `migrations/202607310004_v2_4_fuel_operations.sql`
4. Gere um UUID para a organização e execute:

```sql
select public.bootstrap_organization(
  '8a6b34d6-3362-4da2-9a4f-16db27be1fb2'::uuid,
  'RENEA',
  'RENEA INFRAESTRUTURA S.A.'
);
```

5. No Netlify, configure:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_DEFAULT_ORGANIZATION_ID`
6. Faça uma nova publicação do site.
7. Entre como administrador e abra **Apoio e Configuração** para verificar o gateway.

Use o mesmo UUID em `SUPABASE_DEFAULT_ORGANIZATION_ID` e no cadastro criado por `bootstrap_organization`.

## Segurança

- A chave `SUPABASE_SERVICE_ROLE_KEY` existe somente nas variáveis protegidas do Netlify.
- O navegador chama `/.netlify/functions/master-data`; ele nunca acessa a chave de serviço.
- O Netlify valida o token Firebase e a claim `staff`.
- A organização vem da claim `organization_id` ou da variável padrão do servidor, nunca do corpo enviado pelo navegador.
- O gateway aplica os perfis atuais: `admin`, `gestor`, `operador` e `leitura`.
- Todas as tabelas possuem RLS. O acesso direto por usuário Supabase fica condicionado ao vínculo em `app_users`.
- Exclusões pelo gateway são arquivamentos lógicos com `deleted_at`; os registros não são apagados fisicamente.

## Importações

A RPC `ingest_import_batch` salva o lote e todas as linhas brutas em uma única transação. Linhas inválidas, duplicadas ou ainda não mapeadas permanecem em `import_rows` para conferência.

Nenhuma planilha operacional é enviada automaticamente nesta versão. A ativação deve ocorrer módulo por módulo, após homologação das regras correspondentes.

## Cadastros v2.2

A segunda migration acrescenta aliases e fila de revisão. A tela **Cadastros** consegue analisar a planilha mestre e preparar um lote separado para empresas, fornecedores, materiais, locais, ramos e colaboradores.

O envio preserva as linhas e os alertas, mas não promove automaticamente registros para as tabelas canônicas.

## Equipamentos v2.3

A terceira migration amplia equipamentos e veículos, aceita suas abas na fila mestre e cria históricos de identificadores SGE, mobilização, operador e eventos operacionais.

A visão `equipment_operational_overview` consolida disponibilidade, manutenção e última parte diária. A sincronização desses eventos deve ser ativada somente após homologação dos vínculos e dos registros revisados.

## Combustível v2.4

A quarta migration cria `fueling_events`, `fuel_review_items`, `fuel_review_summary` e a RPC `stage_fuel_import`.

A tela de combustível envia os registros filtrados em lotes de até 5.000 linhas. A RPC primeiro preserva todas as linhas em `import_rows` e depois abre a fila de combustível. Não existe promoção automática para `fueling_events`.

## Viagens v2.5

A quinta migration cria `travel_tickets`, `travel_ticket_events`, `travel_print_batches`, `travel_print_batch_items`, `travel_divergences`, `travel_review_items`, a visão `travel_operation_overview` e a RPC `stage_travel_import`.

A importação preserva liberações, recebimentos, registros incompletos e duplicidades antes de abrir a fila de revisão. O pareamento canônico e a promoção para `travel_tickets` permanecem manuais até a homologação.
