# Base evolutiva: React, TypeScript e Supabase

## Objetivo

Evoluir o sistema sem uma reescrita arriscada. O frontend continua em React e
TypeScript. Firebase permanece operacional enquanto o Supabase entra por etapas,
atrás de contratos estáveis que podem ser entendidos por pessoas e por agentes de IA.

## Regra principal

Componentes de tela não devem importar um SDK de banco novo. Toda troca de
provedor passa por um gateway em `src/cloud`. Código específico fica isolado em
`src/firebase*` ou `src/supabase`.

## Modos de execução

| `VITE_CLOUD_PROVIDER` | Leitura | Gravação | Uso |
| --- | --- | --- | --- |
| `firebase` | Firebase | Firebase | padrão seguro atual |
| `dual-write` | Firebase | Firebase + espelho Supabase | comparação e homologação |
| `supabase` | Supabase | Supabase | virada controlada |

O modo `dual-write` nunca marca uma gravação Firebase confirmada como perdida se
somente o espelho falhar. A falha do espelho aparece no console para diagnóstico.

Durante a transição, o login Firebase continua validando as claims `staff` e
`role`, pois as Functions existentes dependem desse token. Em `dual-write`, o
mesmo login tenta abrir também uma sessão Supabase. Contas ainda não provisionadas
no Supabase não perdem acesso ao sistema; apenas o espelho fica pendente. Em modo
`supabase`, a ausência dessa segunda sessão bloqueia o login para impedir acesso
parcial. A remoção definitiva do Firebase Auth pertence a uma etapa posterior,
depois que Functions e permissões também tiverem adaptadores Supabase.

## Primeira migração

`supabase/migrations/202609140001_initial_transition.sql` cria:

- organizações e membros;
- um retrato JSONB transicional por organização;
- RLS por usuário e organização;
- publicação atômica com detecção de conflito de versão.

O retrato não é o modelo final. Ele permite validar autenticação, RLS, volume,
integridade e operação em paralelo antes de normalizar cada módulo.

## Preparação do ambiente

1. Criar um projeto Supabase de homologação.
2. Executar a migration com a CLI do Supabase ou pelo fluxo SQL controlado da equipe.
3. Criar o usuário no Supabase Auth.
4. Associar o UUID do usuário à organização:

```sql
insert into public.organization_members (organization_id, user_id, role)
values ('renea', '<uuid-do-usuario>', 'admin');
```

5. Configurar as variáveis descritas em `.env.example`.
6. Começar com `VITE_CLOUD_PROVIDER=dual-write` em homologação.
7. Comparar contagem, IDs e hashes por tabela antes de qualquer virada.

## Ordem de migração recomendada

1. Autenticação e perfis de organização.
2. Cadastros mestres: empresas, obras, pessoas e equipamentos.
3. Frota e parte diária.
4. Presença.
5. Combustível.
6. Tickets, materiais, produção e demais módulos.
7. Anexos para Supabase Storage.
8. Remoção do retrato transicional somente após reconciliação completa.

Cada etapa deve ter migration SQL versionada, tipos TypeScript, RLS, teste de
reconciliação e caminho de rollback. Nunca remover o caminho Firebase na mesma
entrega que introduz a primeira escrita Supabase de um módulo.

## Convenções para trabalho com IA

- Ler este documento e `README.md` antes de alterar persistência.
- Não colocar `service_role` em variáveis `VITE_*` nem no navegador.
- Não criar tabelas sem `organization_id`, RLS e trilha de autoria.
- Não renomear chaves operacionais durante transporte de dados.
- Não declarar uma etapa concluída sem `npm run verify` e reconciliação dos dados.
- Registrar decisões novas em `docs/` junto da alteração de código.
