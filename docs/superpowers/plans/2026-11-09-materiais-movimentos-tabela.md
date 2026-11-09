# Movimentos de materiais em tabela própria: plano de implementação

> **Para agentes:** use superpowers:executing-plans, tarefa por tarefa. Os passos usam caixas (`- [ ]`).

**Objetivo:** tirar os movimentos de materiais (40% do bloco `erp_snapshots`) para a tabela `erp_materiais_movimentos`, sem perder registro e podendo voltar atrás em cada fase.

**Arquitetura:** na fase 3a, um gatilho em `erp_snapshots` espelha a coleção numa tabela. Na 3b, o app e o link público passam a ler da tabela. Na 3c, as funções de envio deixam de gravar a coleção no bloco.

**Stack:** Supabase (Postgres 15+, RLS), TypeScript/React, `node:test` via `tests/run.ts`.

**Spec:** `docs/superpowers/specs/2026-11-09-registros-separados-design.md`

## Restrições globais

- Nenhum registro some (AGENTS.md). Exclusão é `excluido_em`, nunca `delete`.
- Toda tabela nova tem `organization_id`, RLS, migration versionada, tipo TypeScript (quando o app lê) e teste de reconciliação.
- Não remover o caminho antigo na mesma mudança que inicia a primeira leitura do caminho novo.
- Migration em produção só com aprovação do dono, uma fase por vez.
- Testes de escrita em produção nunca em paralelo enquanto a fase 3c não entrar.

## Foco de revisão

- Movimento com `id` repetido no bloco: o espelho fica com o de `atualizadoEm` mais novo.
- Movimento sem `atualizadoEm`: entra com `atualizado_em` nulo e não trava o envio.
- Exclusão seguida de restauração no mesmo dia: `excluido_em` volta a nulo.
- Envio inteiro (`publish_erp_snapshot`), além do envio por mudança: o gatilho cobre os dois.
- Operador sem permissão: nada muda, porque o espelho roda depois da trava de perfil, dentro da mesma transação.

---

### Tarefa 1 (3a): tabela, espelho e conferência — FEITA neste PR

**Arquivos:**
- Criar: `supabase/migrations/202611090001_materiais_movimentos_tabela.sql`
- Criar: `tests/sql/espelhoMateriaisMovimentos.sql` (cenários no banco de teste)
- Criar: `tests/materiaisMovimentosTabela.test.ts` (em `tests/run.ts`)

**Interfaces:**
- Produz: tabela `public.erp_materiais_movimentos(organization_id, id, registro, atualizado_em, espelhado_em, excluido_em)`, função `public.erp_conferir_materiais_movimentos(text) → (no_bloco, ativos_na_tabela, faltando, sobrando, diferentes)`.

- [x] Escrever os cenários (novo, edição, outra coleção, exclusão com marca, restauração, conferência zerada, sem escrita direta).
- [x] Rodar num Postgres 16 local com todas as migrações: os 7 cenários passaram, duas vezes seguidas.
- [x] Medir: +0,06 s por salvamento que mexe nos movimentos.
- [ ] **Com aprovação:** aplicar em produção e rodar `select * from erp_conferir_materiais_movimentos('renea')`. Esperado: `faltando = sobrando = diferentes = 0`.

### Tarefa 2 (3b): leitura pela tabela

**Arquivos:**
- Modificar: `src/supabase/cloudSync.ts` (`downloadSupabaseBackup`)
- Modificar: `api/public-materiais.js` (lista de movimentos)
- Criar: `src/supabase/materiaisMovimentos.ts`
- Teste: `tests/materiaisMovimentosLeitura.test.ts`

**Interfaces:**
- Produz: `lerMateriaisMovimentos(organizationId: string): Promise<MovimentoMaterial[]>`, que lê da tabela as linhas com `excluido_em is null`, paginando de 1.000 em 1.000.

- [ ] Teste: o download devolve em `materiaisMovimentos` exatamente o que a tabela tem de ativo, e devolve o bloco quando a tabela falha (cai para o caminho antigo, com aviso no console).
- [ ] Implementar e rodar `npm run verify`.
- [ ] Commit `feat: download lê movimentos de materiais da tabela própria`.

### Tarefa 3: uma semana de conferência

- [ ] A conferência diária fica zerada por 7 dias seguidos. Qualquer diferença volta para a Tarefa 1.

### Tarefa 4 (3c): contração

**Arquivos:**
- Criar: migration nova com `apply_erp_snapshot_changes` e `publish_erp_snapshot` gravando `materiaisMovimentos` na tabela (upsert por id, vencendo o `atualizado_em` mais novo, e marcas de exclusão virando `excluido_em`), e tirando a coleção do bloco.
- Modificar: `erp_recusar_encolhimento` e `erp_recusar_por_perfil` para comparar a tabela.
- Teste: cenários SQL da contração, incluindo um aparelho antigo mandando o bloco inteiro com a coleção.

- [ ] Escrever os cenários, rodar no Postgres local, medir o salvamento (meta: abaixo de 0,3 s com o bloco de ~15 MB).
- [ ] **Com aprovação:** aplicar em produção.
