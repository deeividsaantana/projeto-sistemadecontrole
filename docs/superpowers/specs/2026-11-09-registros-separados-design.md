# Registros separados no Supabase: design

Data: 2026-11-09. Origem: queda do banco de produção em 09/11, entre 00:43 e 01:35 UTC, durante testes do TestSprite que salvavam em paralelo.

## Problema

Toda a obra fica num jsonb só, em `public.erp_snapshots`: 41.856 registros, 26 MB em texto e 3,5 MB comprimido. O app manda só o que mudou (`apply_erp_snapshot_changes`), mas o banco tranca a organização inteira, refaz as coleções mudadas, confere as travas e regrava o bloco todo. Sob carga, cada salvamento levou de 12 a 23 s. Com dois salvamentos ao mesmo tempo, apareceram `lock timeout` e `statement timeout`, o login respondeu 504/522 e o banco parou de aceitar conexões.

Tamanho por coleção, medido às 01:45 UTC de 09/11:

| Coleção | Registros | Texto |
| --- | --- | --- |
| materiaisMovimentos | 17.394 | 10,7 MB |
| abastecimentos | 5.994 | 5,6 MB |
| exclusoes | 8.377 | 4,3 MB |
| controleEquipamentosDiario | 1.521 | 1,9 MB |
| presencasLink | 3.135 | 1,9 MB |
| historyLogs | 2.239 | 1,0 MB |
| ticketsJazida | 1.105 | 0,9 MB |

## Decisão

As coleções grandes saem do bloco, uma por vez, cada uma para uma tabela com uma linha por registro. A ordem segue o tamanho: materiaisMovimentos, depois abastecimentos, depois as demais.

Cada coleção passa pelas fases da skill `migration` (expandir, migrar, conferir, contrair), cada fase num PR próprio:

1. **Espelho (3a).** Tabela nova e gatilho em `erp_snapshots` que copia cada mudança da coleção. O bloco continua sendo a fonte da verdade e o app não muda. Para voltar atrás, basta remover o gatilho.
2. **Leitura (3b).** O download monta a coleção a partir da tabela, e o link público de materiais (`api/public-materiais.js`) também lê de lá. O bloco continua recebendo tudo.
3. **Conferência.** `erp_conferir_materiais_movimentos` precisa ficar zerada por uma semana de uso real.
4. **Contração (3c).** As funções de envio gravam a coleção na tabela e não mais no bloco, que encolhe. As travas de encolhimento e de perfil passam a valer para a tabela.

## Regras da tabela (AGENTS.md)

- Chave `(organization_id, id)`, RLS de leitura por membro da organização, e nenhuma escrita direta pelo app nesta fase.
- `registro jsonb` guarda o objeto inteiro, como está no bloco. Colunas próprias só quando alguma consulta precisar delas.
- `atualizado_em` vem do `atualizadoEm` do registro, que é a mesma regra de "o mais novo vence" do bloco (`erp_registro_momento`).
- Exclusão vira `excluido_em`: nenhuma linha é apagada, e restaurar zera a coluna.

## Custo medido (Postgres 16 local, bloco sintético de 21 MB)

| Salvamento | Antes | Com o espelho |
| --- | --- | --- |
| Outra coleção | 0,6 a 0,9 s | 0,6 a 0,7 s |
| Movimentos de materiais | 0,6 s | 0,66 a 0,74 s |

O espelho custa cerca de 0,06 s por salvamento que mexe nos movimentos e nada nos outros. O alívio de verdade vem na contração.

## Fora deste design

- O limite do histórico de versões (`erp_snapshot_history`) fica na frente "Auditar a aplicação inteira".
- A cópia do bloco no histórico a cada exclusão continua, porque protege contra perda de dados (A31).
