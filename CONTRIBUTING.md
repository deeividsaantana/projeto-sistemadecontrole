# Como trabalhar no RENEA ERP

Este guia vale para qualquer pessoa ou agente que mexa no repositório. As
regras técnicas de dados e migração estão em `AGENTS.md`. O padrão visual das
telas está em `docs/superpowers/CHECKLIST_REDESIGN_ABAS.md`.

## 1. Estrutura de pastas

| Pasta | O que guarda | Não guarda |
| --- | --- | --- |
| `src/components/` | Telas (`*Tab.tsx`) e fluxos de interface. Subpastas por módulo (`fleet/`, `dashboard/`, `cadastros/`). | Regra de negócio, acesso direto a banco. |
| `src/shared/ui/` | Componentes visuais reutilizáveis (PageHeader, DataTable, Modal...). | Componentes de uma tela só. |
| `src/shared/hooks/` | Hooks genéricos de interface. | Hooks de um módulo só. |
| `src/utils/` | Regras de domínio puras e testáveis. | JSX, `fetch`, SDK de banco. |
| `src/app/` | Shell, navegação, rotas e providers do app. | Telas. |
| `src/cloud/`, `src/supabase/`, `src/firebase*.ts` | Gateway de nuvem e implementações por provedor. | Lógica de tela. |
| `src/next/` | Novo frontend em construção, servido por `next.html`. | Código do app atual. |
| `api/` | Handlers HTTP da API, servidos em `/api/` pelo `server/`. | Código do navegador. |
| `server/` | Servidor Express da Render. | Regras de negócio (ficam em `api/`). |
| `functions/` | Empacotamento da API para o Cloud Functions. | Lógica própria. |
| `supabase/migrations/` | Migrations SQL versionadas. | SQL avulso. |
| `tests/` | Testes de contrato (`*.test.ts`) e E2E (`tests/e2e/`). | Scripts soltos. |
| `preview/` | Harness de telas sem login, usado pelo E2E. | Código de produção. |
| `scripts/` | Utilitários de manutenção. | Saídas geradas. |
| `docs/` | Arquitetura e guias vigentes. | Notas antigas (vão para `docs/historico/`). |
| `docs/superpowers/specs` e `plans` | Desenho e plano de cada frente, com data no nome. | |

Nunca versionar na raiz: `*.zip`, `*.log`, `tmp/`, `artifacts/`, backups,
prints, tokens ou `.env`. O `.gitignore` já barra esses itens, e o teste
`tests/repoHygiene.test.ts` falha se algum deles entrar.

## 2. Convenção de nomes

- Tela: `PascalCase` terminando em `Tab`, por exemplo `ManutencaoTab.tsx`. O id da aba em `src/app/navigation/navigation.ts` é `kebab-case` (`controle-equipamentos`).
- Componente: `PascalCase.tsx`. Hook: `useAlgumaCoisa.ts`. Regra de domínio: `camelCase.ts` em `src/utils/`.
- Teste: `tests/<assunto>.test.ts`. **Todo teste novo precisa ser importado em `tests/run.ts`**, senão o `npm test` não roda.
- Migration: `supabase/migrations/<AAAAMMDDHHMMSS>_<descricao>.sql`.
- Documento de frente: `docs/superpowers/specs/<AAAA-MM-DD>-<assunto>-design.md` e `plans/<AAAA-MM-DD>-<assunto>.md`.
- Branch: `tipo/descricao-curta` (por exemplo `fix/painel-navegacao`). Branches de agente seguem o padrão `claude/...`.
- Commit: `tipo: descrição em português`, com `tipo` entre `feat`, `fix`, `refactor`, `chore`, `docs` e `test`. Um assunto por commit.

## 3. Etapas de uma mudança

1. **Entender**: ler `README.md`, `AGENTS.md` e o documento da área. Conferir se outra frente já está mexendo na mesma tela.
2. **Planejar**: mudança grande ganha spec e plano em `docs/superpowers/`. Mudança pequena só precisa de uma descrição clara no PR.
3. **Branch**: sempre a partir da `main` atualizada. Nunca commitar direto na `main`.
4. **Implementar**: um assunto por PR. Nada de misturar redesenho, correção e limpeza.
5. **Testar**: teste para toda regra nova em `src/utils/` e `npm run verify` passando. O hook de pre-push roda o verify sozinho.
6. **Prints**: tela nova ou alterada mostra print no celular (390 px) e no computador. Preview sem login: `npx vite --config preview/vite.config.ts --port 4300` e abrir `/?screen=<aba>`.
7. **Abrir o PR**: preencher o modelo, com o checklist inteiro respondido.
8. **Revisar**: seguir a seção 5.
9. **Publicar**: o merge na `main` publica na Render (`render.yaml`). Conferir o app no ar depois do deploy.

## 4. Checklist antes de abrir o PR

- [ ] `npm run verify` passou (tipos, testes e build).
- [ ] Nenhum registro some sem aviso; dado ausente não vira zero nem status inventado.
- [ ] Exclusão operacional é inativação quando o domínio precisa de histórico.
- [ ] Links públicos seguem com token, idempotência e limite de requisições.
- [ ] Nenhum segredo em código, arquivo versionado ou variável `VITE_*`.
- [ ] Nenhum arquivo solto na raiz (zip, log, print, backup).
- [ ] Código sem uso foi removido, não comentado.
- [ ] Se mexeu em tela: checklist de tela abaixo respondido e prints anexados.

### Checklist de tela (obrigatório em toda aba nova ou alterada)

- [ ] **Pergunta obrigatória:** uma pessoa cansada e sem facilidade com aplicativos consegue cadastrar, lançar e consultar nesta tela sem travar?
- [ ] O visual bate com o Painel de Controle: `PageHeader` com a ação principal no topo, cartões `rounded-2xl border-slate-200`, paleta `#176b4d`, `#f26a2e` e `#718087`, e foco `ring-[#f26a2e]/60`.
- [ ] Entrada com GSAP pelos helpers comuns (`RouteMotion`, `useEntradaDeLista`), respeitando `prefers-reduced-motion`.
- [ ] A tela não pesa: biblioteca grande só carrega quando a ação pede (`import()` sob demanda).
- [ ] Funciona em 375 px, 768 px e 1440 px, sem rolagem horizontal, com botões de pelo menos 44 px.
- [ ] Estados de carregando, vazio e erro com mensagem clara, sem jargão técnico.
- [ ] As abas ocultas (fora do menu, em `AUXILIARY_MODULE_DESTINATIONS`) que usam a mesma tela ou componente também foram conferidas.
- [ ] Se o visual não bate com as outras abas, a tela não entra.
- [ ] As skills de design do projeto (seção 7) foram usadas no trabalho da tela.

## 7. Skills de design em toda tela

Todo trabalho de tela passa pelas skills de design em `.claude/skills/`:

| Etapa | Skills |
| --- | --- |
| Auditar a tela atual | `redesign-skill` |
| Definir direção e acabamento | `taste-skill`, `soft-skill`, `minimalist-skill`, `stitch-skill` |
| Animação GSAP | `gpt-tasteskill` |
| Referência visual antes do código | `imagegen-frontend-web`, `imagegen-frontend-mobile`, `image-to-code-skill` |
| Identidade e logo | `brandkit` |
| Painéis densos de dados | `brutalist-skill`, só como referência de grade e hierarquia |
| Conferir no navegador | `playwright-cli` |

Quando duas skills discordam, vale o padrão RENEA do Painel de Controle
(seção 4). Nenhuma skill autoriza trocar a paleta, o `PageHeader` ou os
cartões por outro estilo.

### Travas automáticas

Parte das regras acima é conferida pela máquina, e o PR não fica verde sem ela:

| Trava | Onde roda | O que reprova |
| --- | --- | --- |
| `tests/padraoAbas.test.ts` | `npm run verify` e CI | Aba sem `PageHeader`, sem GSAP, sem `prefers-reduced-motion` ou com cor hex fora da paleta; aba do menu sem tela no `App.tsx`; aba principal sem permissão; tela `*Tab.tsx` que nenhum arquivo abre. |
| `tests/repoHygiene.test.ts` | `npm run verify` e CI | Zip, log, `tmp/`, `artifacts/`, `netlify/` ou `.env` versionados; teste fora de `tests/run.ts`. |
| `scripts/check-pr-checklist.mjs` | CI (`Checklist do PR`) | PR sem a seção `## Checklist` toda marcada; PR que cria ou altera tela sem a seção `### Se mexeu em tela` toda marcada. |
| `scripts/check-bundle-size.mjs` | `npm run verify` e CI | Carregamento inicial acima de 600 kB; Excel, PDF, canvas, Storage ou cargas de planilha no carregamento inicial; pedaço de uma aba acima de 300 kB. |
| Hook de pre-push | Máquina de quem envia | Push com `npm run verify` falhando. |

As abas antigas que ainda não cumprem o padrão estão listadas em `PENDENCIAS`, no
`tests/padraoAbas.test.ts`. Essa lista só diminui: aba nova já nasce no
padrão, e quando uma aba antiga é redesenhada o próprio teste pede para tirar
o item da lista.

A máquina não consegue julgar se a tela é fácil para uma pessoa cansada, se
o visual está bonito ou se os prints batem. Isso continua sendo conferido na
revisão, com o checklist marcado pela pessoa que abriu o PR.

## 5. Revisão

1. Ler a descrição: o "Antes" e o "Depois" batem com o diff?
2. Conferir o checklist marcado, sem item em branco.
3. Ler o diff procurando dado que some, cálculo alterado sem teste, segredo e arquivo solto.
4. Abrir os prints ou o preview da tela.
5. CI verde (`Validacao ERP`). Pedidos pequenos de revisão entram no mesmo PR; os grandes viram outro PR.
6. Merge só com CI verde e sem conflito.

## 6. Auditoria periódica

Pendências conhecidas:

- `src/components/ConfiguracoesTab.tsx` (backup, arquivamento e exclusão por aba) só aparece no `preview/`. Nenhuma função do app está ligada a ela, e ela precisa de decisão: religar ou remover.
- `tests/materialsAnalytics.test.ts` falha porque a unidade `TON` não conta como tonelada. A correção é da frente de Materiais.

- Rodar `npx knip` para achar arquivos, exports e dependências sem uso. Toda remoção é conferida com busca por referências antes de apagar.
- Revisar as abas ocultas e decidir: voltam ao menu, viram atalho de outra aba, ou saem.
- Documentação que deixou de valer vai para `docs/historico/`.
