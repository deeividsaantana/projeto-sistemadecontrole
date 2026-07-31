# Alterações — ERP v2.2

## Cadastros mestres

- Central de análise integrada à tela de Cadastros.
- Leitura específica das seis abas mestre.
- Comparação com empresas, obras, funcionários, materiais, fornecedores textuais e ramos atuais.
- Chaves canônicas por CNPJ, matrícula, código ou nome.
- Classificação em novo, já cadastrado, duplicado ou inválido.
- Preservação de aliases e valores originais.
- Contagem explícita de abas operacionais e cadastros postergados.

## Banco e gateway

- Migration `202607310002_v2_2_master_data_review.sql`.
- Tabelas `master_data_aliases` e `master_data_review_items`.
- View `master_data_review_summary`.
- RPC transacional `stage_master_data_import`.
- Ação `stage-master-import` na função Netlify.
- Um lote por entidade, mantendo linha original, normalização, alertas e candidatos.

## Frontend

- React Hook Form para confirmação operacional.
- Zod para validação do envio.
- TanStack Table para busca, paginação e renderização da revisão.
- TanStack Query para diagnóstico e mutação do gateway.
- QueryClient global dentro do `AppProviders`.

## Compatibilidade

- Nenhum cadastro atual é alterado pela análise.
- Firebase e `localStorage` continuam operacionais.
- Nenhuma chave de persistência foi renomeada.
- Nenhuma base operacional é promovida como cadastro.
- O sistema continua funcionando sem Supabase.

## Dependências adicionadas

- `react-hook-form`
- `zod`
- `@tanstack/react-table`
- `@tanstack/react-query`

As versões e integridades foram registradas no `package-lock.json`.
