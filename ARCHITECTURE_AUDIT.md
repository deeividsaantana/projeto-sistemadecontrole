# RENEA ERP — Auditoria Técnica da Arquitetura Atual

**Data:** 2026-09-19  
**Fase:** 0 — levantamento somente leitura  
**Base de evidências:** código, configuração, testes e artefatos rastreados no branch local atual. Documentos históricos foram tratados apenas como contexto, não como fonte de verdade.  
**Escopo excluído:** esta auditoria não verificou credenciais, regras ou dados efetivamente implantados no Firebase, Supabase, Render ou GitHub; esses pontos exigem validação em ambiente controlado.

---

## Resumo executivo

O RENEA ERP já tem uma base funcional relevante: React 19, Vite, TypeScript, módulos carregados sob demanda, persistência local resiliente, sincronização em nuvem, regras Firebase com *default deny*, APIs protegidas pelo Admin SDK, suporte a uso em campo e uma suíte ampla de testes de domínio.

O principal obstáculo para evolução segura não é falta de funcionalidades: é o acoplamento entre domínios. `src/App.tsx` centraliza autenticação, autorização da UI, armazenamento local, sincronização, filas offline, estado de dezenas de coleções, handlers CRUD, navegação e a renderização de mais de quarenta telas. Isso amplia o custo de qualquer mudança e dificulta testes de integração confiáveis.

A recomendação é uma evolução incremental, preservando as fontes atuais de dados e contratos de negócio. Antes de mudanças visuais amplas ou migrações de banco/roteamento, o projeto precisa recuperar uma linha-base de qualidade: o typecheck e a suíte de testes atuais falham por uma inconsistência de navegação introduzida no estado presente do código.

### Prioridades de negócio e engenharia

| Prioridade | Tema | Motivo |
|---|---|---|
| P0 | Restaurar gates de qualidade | `npm run lint` falha em `CentralOperacionalTab`; `npm test` falha em `sidebarNavigation.test`. Não é seguro iniciar refatoração estrutural sobre baseline quebrado. |
| P0 | Tratar possível segredo versionado | Scripts de auditoria visual contêm uma credencial literal. Ela não é repetida neste relatório. Deve ser tratada como potencialmente exposta até investigação e rotação. |
| P0 | Definir isolamento organizacional | O snapshot Firebase e o Storage usam acesso por `staff`, sem uma barreira de organização/obra nas regras do navegador. É aceitável somente se o produto for formalmente monotenante. |
| P0 | Corrigir autorização destrutiva em presença | O caminho de remoção/reset público deve exigir explicitamente o papel administrativo pretendido e receber testes de autorização. |
| P1 | Reduzir o God Component | Extrair composição do `App.tsx` por domínio, sem reescrever fluxos ou alterar persistência durante a primeira extração. |
| P1 | Consolidar CSS e acessibilidade | A cascata global está sendo usada como compatibilidade visual; há controles importantes que precisam de semântica e teclado equivalentes. |
| P1 | Tornar sincronização auditável por domínio | A fila offline atual reenvia snapshots completos, não comandos de negócio granulares. |
| P2 | Migrar navegação progressivamente para URLs | A navegação interna via `activeTab` não oferece deep link, histórico, restauração de contexto ou isolamento natural por rota. |

---

## 1. Linha-base verificada

### Estado do repositório

- Branch atual: `main`.
- Havia um commit local à frente de `origin/main`: `9f13b8f` (`test: P0-07 Authorization Boundary verification tests`).
- Arquivos não rastreados encontrados no levantamento: `.agents/`, `.claude/worktrees/` e um plano de trabalho anterior. Nenhum deles foi incluído em alteração durante a auditoria.
- O repositório rastreia arquivos que não pertencem ao fluxo normal de código, incluindo ZIPs, logs, screenshots Playwright, relatórios visuais, planilhas e backups em `artifacts/` e `tmp/`.

### Comandos executados

| Comando | Resultado |
|---|---|
| `npm run lint` | **Falhou** com 12 erros TypeScript em `src/components/CentralOperacionalTab.tsx`. O componente referencia props/variáveis que não estão no contrato atual e passa uma projeção reduzida onde `FrenteServico[]` é esperado. |
| `npm test` | **Falhou** em `tests/sidebarNavigation.test.ts`: a expectativa é 13 módulos primários, mas a navegação atual expõe 9. As demais suítes executadas antes da interrupção passaram. |
| Inspeção de `package.json`, CI, regras Firebase, Render, server e código fonte | Concluída sem modificações. |

> A saída de alguns testes antigos ainda imprime textos de falha de caracterização referentes a bugs já corrigidos. Como o processo retorna falha concreta somente no teste de navegação atual, essas mensagens devem ser revisadas para não gerar diagnóstico operacional enganoso.

---

## 2. Mapa da aplicação atual

```text
RENEA ERP
├── Bootstrap
│   ├── src/main.tsx
│   ├── src/app/providers/AppProviders.tsx
│   ├── src/App.tsx                 # app administrativo e composição atual
│   └── src/PublicLinksApp.tsx      # app leve para links públicos
│
├── Shell e navegação
│   ├── src/app/shell/
│   │   ├── DesktopSidebar.tsx
│   │   ├── DesktopTopBar.tsx
│   │   └── NavigationMenu.tsx
│   └── src/app/navigation/navigation.ts
│
├── Operação de campo
│   ├── Presença: ControlePresencaTab.tsx / PresencaTempoRealPublica.tsx
│   ├── Apontamentos: ApontamentosTab.tsx
│   ├── Equipamentos: ControleEquipamentosDiarioTab.tsx + components/fleet/
│   ├── Tickets: TicketsJazidaTab.tsx / TicketLinkExterno.tsx
│   └── Checklists: ChecklistTab.tsx
│
├── Obra
│   ├── Central Operacional: CentralOperacionalTab.tsx
│   ├── Diário: DiarioObraTab.tsx
│   ├── Produção: ProducaoTab.tsx
│   ├── Planejamento / Cronograma
│   ├── FVS / Inspeções / Não conformidades / Medições
│   └── Frentes, serviços e ocorrências
│
├── Frota
│   ├── Controle diário: ControleEquipamentosDiarioTab.tsx
│   ├── Consulta: FrotaTab.tsx
│   ├── Manutenção: ManutencaoTab.tsx
│   ├── Horas paradas / Combustível
│   └── Domínio especializado: src/fleet/
│
├── Gestão e administração
│   ├── Colaboradores / Equipes / Cadastros
│   ├── Materiais / Custos / Orçamento / Documentos
│   ├── Relatórios / Indicadores / Timeline / Pendências
│   └── Auditoria / Permissões / Master Data Review
│
├── Dados e infraestrutura
│   ├── Local: src/data/, localStorage, IndexedDB
│   ├── Firebase: src/firebase*.ts, firestore.rules, storage.rules
│   ├── Supabase: src/supabase/, supabase/migrations/
│   ├── Nuvem: src/cloud/, src/platform/cloudProvider.ts
│   └── APIs: netlify/functions/, server/index.js, functions/src/
│
└── Compartilhado
    ├── src/shared/ui/
    ├── src/shared/hooks/
    ├── src/services/
    ├── src/utils/
    └── src/types.ts
```

### Entrypoints e ciclo de bootstrap

1. `src/main.tsx` identifica links públicos antes de carregar o ERP administrativo e importa `PublicLinksApp` sob demanda.
2. Para o ERP administrativo, recupera a cópia resiliente do armazenamento local, monta `AppProviders`, renderiza `App` e inicia o espelhamento local.
3. `AppProviders` contém `QueryClientProvider` e uma Error Boundary. React Query está instalado, mas ainda não é o mecanismo predominante de estado remoto.
4. `App.tsx` hidrata coleções, autentica usuário, calcula permissões de UI, registra sync e filas offline, e compõe a tela ativa.

### Dependências entre domínios

- **Dashboard**, **Frota** e **Central Operacional** recalculam leituras semelhantes de equipamentos, presença, manutenção e operação a partir de arrays recebidos por props.
- O **controle diário de equipamentos** cria e vincula OS automaticamente no fluxo individual através de `garantirOrdemAutomaticaDaFrota` (`src/utils/manutencao.ts` e `src/App.tsx`). O fluxo de importação em lote, entretanto, não passa por esse mesmo vínculo hoje e deve ser coberto na fase de domínio de Frota.
- A **presença pública** é isolada visualmente do ERP, mas compartilha entidades e integrações com o painel administrativo.
- O **Master Data Review Center** é o precedente mais maduro de fronteira por serviço: usa React Query, React Hook Form, Zod, TanStack Table e `src/services/masterDataApi.ts`.

---

## 3. Diagnóstico arquitetural

### 3.1 `App.tsx` como God Component

`src/App.tsx` concentra responsabilidades incompatíveis no mesmo limite:

- Firebase Auth, claims e sessão;
- estado de UI e estado de dezenas de coleções;
- leitura, migração e gravação em `localStorage`;
- mirror IndexedDB, backup/restauração e snapshots;
- sincronização Firebase/Supabase, conflitos, retry e fila offline;
- handlers CRUD e auditoria de quase todos os módulos;
- renderização condicional de telas e shell responsivo;
- notificações, busca global e menus.

**Risco:** mudanças pequenas em um módulo exigem compreender e alterar uma cadeia transversal. O teste de um domínio depende com frequência da montagem indireta de todo o root.

**Direção recomendada:** extrair primeiro adaptadores e controladores de domínio sem mudar os contratos públicos dos componentes:

```text
src/app/
├── App.tsx                         # composição transitória
├── AppShell.tsx
├── AppRouter.tsx                   # ponte activeTab → rotas, inicialmente
├── providers/
│   ├── AppProviders.tsx
│   ├── AuthProvider.tsx
│   └── SyncProvider.tsx
└── state/
    └── applicationRegistry.ts      # registro único de coleções

src/modules/
├── fleet/
│   ├── FleetPage.tsx
│   ├── maintenance/
│   ├── control/
│   └── application/
├── presence/
├── master-data/
└── ...

src/domain/
├── equipment/
├── work-orders/
├── presence/
└── ...
```

Não criar essas pastas como casca vazia. Cada extração deve começar por uma fronteira existente e testada — Frota e Master Data são os candidatos mais seguros.

### 3.2 Navegação sem rotas administrativas

`src/app/navigation/navigation.ts` concentra metadados e permissões de menu, mas `App.tsx` usa `activeTab` local. Isso impede deep links administrativos, navegação de histórico, favoritos, abrir tela em nova aba e isolamento por rota.

**Estratégia segura:** introduzir um adaptador de URL que aceite o modelo atual e migre um grupo de módulos por vez. A metadata atual deve continuar sendo fonte de nomes, ícones e acesso, não ser duplicada em um router paralelo.

### 3.3 Registro de coleções fragmentado

As chaves `renea_*`, as coleções React, o backup, o snapshot cloud, o merge, a recuperação e as operações de reset são atualizados em locais diferentes, principalmente em `App.tsx`, `src/data/storageKeys.ts`, `src/utils/resilientStorage.ts` e `src/firebaseCloudSync.ts`.

**Risco:** uma coleção nova pode persistir localmente sem backup, ou entrar no backup sem sincronização/validação completa.

**Direção:** criar gradualmente um registro tipado por coleção contendo chave local, schema, função de parse, inclusão em snapshot, merge e retenção. Migrar uma coleção de cada vez e manter compatibilidade com chaves existentes.

### 3.4 Tipos e regras de domínio

- `src/types.ts` é o contrato transversal de quase todas as entidades.
- `src/utils/` contém regras reais de domínio de múltiplas áreas.
- `src/fleet/` já separa domínio, relatórios, reconciliação, importação e apresentação melhor que outras áreas.

**Direção:** não reescrever tipos. Mover somente grupos coesos para tipos de domínio quando o primeiro módulo consumidor for extraído; manter reexports transitórios até todos os consumidores migrarem.

---

## 4. Dados, sincronização e offline

### Fonte atual de dados

| Categoria | Fonte primária observada | Observações |
|---|---|---|
| Estado operacional imediato | React + `localStorage` | Aplicação é local-first; muitas coleções `renea_*`. |
| Recuperação local | IndexedDB | Mirror resiliente em `src/utils/resilientStorage.ts`. |
| Sincronização padrão | Firestore | Snapshot com manifesto e chunks via `src/firebaseCloudSync.ts`. |
| Anexos | Firebase Storage | Metadados no estado/snapshot; binários fora do Firestore. |
| Cadastros protegidos, usuários, auditoria e importações | Função `master-data` + Admin SDK | Browser não tem acesso direto a essas coleções. |
| Supabase | Caminho de migração | `firebase` é padrão; `dual-write` mantém Firebase autoritativo. |
| Preferências / fila offline | `localStorage` e IndexedDB | Fila atual reenvia backup agregado, não mutações individuais. |

### Riscos e decisões necessárias

1. **Backup agregado não equivale a log de comandos.** A fila offline tem foco em recuperar um snapshot remoto. Para módulos críticos, a evolução deve introduzir comandos idempotentes por entidade, sem desligar o comportamento atual até que reconciliação e rollback estejam comprovados.
2. **Cópia de dados em dispositivos.** Dados operacionais, pessoais e históricos vivem no navegador e no IndexedDB. É necessário definir política para dispositivos compartilhados, logout, prazo de retenção local e recuperação após limpeza de cache.
3. **Snapshot não é cópia forense completa.** Conteúdo extenso/anexos são tratados fora do documento do Firestore. A documentação de backup deve diferenciar metadados, anexos no Storage e conteúdo dependente do dispositivo.
4. **Firebase e Supabase ainda têm ciclo de identidade distinto.** Não foi comprovada uma reconciliação automática entre Firebase Auth/claims, Supabase Auth e `organization_members`. Não tornar Supabase autoritativo até haver provisionamento, offboarding e troca de papel auditáveis.

---

## 5. Segurança e autorização

### Controles positivos observados

- Firestore inicia em *default deny* (`firestore.rules`).
- Acesso de browser exige `staff: true`; escrita direta exige papéis de escrita definidos.
- Coleções de dados mestre, logs de auditoria e importações são server-only.
- Firebase Storage limita tamanho e tipo de arquivo, exige staff e bloqueia delete direto pelo navegador.
- APIs protegidas verificam Firebase ID token com Admin SDK (`netlify/functions/_shared/firebase-admin.js`).
- `master-data` centraliza autorização server-side e idempotência.
- Funções públicas usam validação de payload, headers de segurança, limites de corpo e proteção contra abuso.

### Achados prioritários

1. **Possível credencial literal em scripts de auditoria.**
   - Arquivos: `scripts/audit-fleet-reconstruction.mjs` e `scripts/audit-visual.mjs`.
   - Ação imediata: validar se a conta é ativa, revogar/trocar a senha, procurar o valor no histórico e nos logs de CI, mover autenticação de teste para variáveis secretas e habilitar secret scanning.
   - O segredo não é reproduzido neste documento.

2. **Escopo organizacional não é imposto no snapshot Firebase nem no Storage.**
   - `firestore.rules` permite a leitura do snapshot a qualquer usuário `staff`.
   - `storage.rules` usa `obraId` como segmento de caminho, não como verificação de autorização.
   - Decisão obrigatória antes de oferecer multiobra/multiorganização: declarar Firebase como monotenante e impedir onboarding externo, ou migrar para caminhos/documentos por organização e validar a claim correspondente nas regras.

3. **Operações destrutivas de presença pública precisam de teste de RBAC explícito.**
   - O endpoint `netlify/functions/public-presenca.js` deve garantir no servidor que reset/remoção usem somente os papéis previstos. Criar testes para `leitura`, `operador`, `gestor` e `admin` antes de alterar comportamento.

4. **Links públicos são capacidades bearer.**
   - Tokens de presença são rotacionáveis e validados, mas não há expiração temporal confirmada.
   - Implementar metadados de emissão, expiração, revogação, rotação e auditoria em uma fase própria; não invalidar links de campo existentes sem uma janela de migração.

5. **Revogação de token Firebase.**
   - O Admin SDK verifica tokens sem `checkRevoked: true` por decisão de runtime. Definir e documentar a janela aceitável de revogação para operações privilegiadas, ou implementar verificação reforçada onde for operacionalmente viável.

### Itens que exigem validação de ambiente

- Regras Firestore/Storage efetivamente publicadas.
- Configuração real de CORS, CSP, HSTS, TLS, cache e proxy no Render/Firebase Hosting.
- Contas com claims corretas e memberships Supabase válidas.
- Deploy automático do Render e aplicação de migrations/regras/functions.
- Agendamento protegido da limpeza remota.

---

## 6. Frontend, UX e design system

### Pontos fortes

- Identidade visual operacional consistente: branco, verde escuro e estados semânticos.
- Componentes compartilhados relevantes em `src/shared/ui/`: `Button`, `Modal`, `Drawer`, `PageHeader`, `TableShell`, `ConfirmDialog`, `EmptyState`, `LoadingState`, `ErrorState`, filtros e paginação.
- Links públicos carregam um app menor sem o ERP administrativo.
- Telas internas usam lazy loading.
- Há preocupação explícita com alvos móveis, foco, `prefers-reduced-motion`, formulários e tabelas responsivas.
- O fluxo público de presença é o exemplo mais próximo de mobile-first real.

### Pontos de atenção

1. **`src/index.css` é uma cascata de compatibilidade extensa.** Há redefinições sucessivas para shell, dashboard, sidebar, viewport e classes utilitárias históricas. A ordem do arquivo decide comportamentos que deveriam pertencer a tokens/componentes.
2. **Adoção parcial das primitives.** Há telas que ainda recriam localmente tabelas, cartões, filtros, menus e modais com contratos diferentes.
3. **Acessibilidade de interações.** Há elementos SVG e linhas clicáveis no Dashboard que precisam de equivalentes focáveis e acionáveis por teclado. `Drawer` precisa conter foco de modo completo e devolver o foco ao acionador. `Modal` deve associar título/descrição por IDs estáveis.
4. **Animações.** GSAP continua em áreas que poderiam usar CSS. Todas as animações JavaScript precisam de guarda real de `prefers-reduced-motion`, não apenas CSS global.
5. **Leitura em campo.** Rótulos de 9–11px em cartões móveis devem ser revisados para dados de decisão operacional.
6. **Manifest e splash.** O `manifest.webmanifest` usa fundo escuro, enquanto a interface atual é clara; ajustar após verificar experiência instalada em aparelho real.

### Direção de design system

Não adicionar biblioteca de UI. Consolidar o que já existe em `src/shared/ui/`:

```text
Fundação: tokens → base → layout → componentes → legado
Componentes: Button, IconButton, FormField, Modal, Drawer, Badge,
             StatusBadge, Card, StatCard, DataTable, Tabs, FilterBar,
             SearchInput, PageHeader, Empty/Loading/Error state
```

A migração deve ser módulo por módulo, acompanhada de validação visual em desktop, tablet e mobile. O CSS legado só deve ser removido após cada área ter sido migrada e aprovada.

---

## 7. Performance, ativos e bundle

### Situação observada

- `vite.config.ts` faz divisão manual para React, Firebase, Supabase, Excel, PDF, canvas e seeds.
- Há lazy loading de telas e importação dinâmica de bibliotecas pesadas de exportação.
- Há seeds muito grandes em `src/utils/importedAugust2026Seed.ts` (~50 mil linhas) e `src/utils/importedSpreadsheetSeed.ts` (~13 mil linhas).
- O repositório contém imagens de equipamento e editorial grandes, além de artefatos de auditoria visual de 10–13 MB cada, ZIPs e backups rastreados.
- O CI não mede orçamento de bundle, não executa E2E e não contém auditoria de performance/visual configurada.

### Recomendações

1. Criar baseline de `vite build` com tamanho dos chunks, tempo de interação e consumo inicial em desktop/Pixel 5 antes de otimizar.
2. Separar dados de desenvolvimento, fixtures e históricos do bundle de produção; manter os dados de produção sem exclusão automática.
3. Converter apenas os assets que forem realmente carregados pelo app e excederem o orçamento definido; preferir WebP/AVIF e `srcset` onde aplicável.
4. Não versionar novos logs, ZIPs, screenshots, builds, backups ou artefatos temporários. Atualizar `.gitignore`; para os já rastreados, propor remoção em commit separado e não destrutivo, após confirmar retenção necessária.
5. Não adicionar virtualização antes de medir tabelas reais; adotar onde volume e perfil de uso justificarem.

---

## 8. DevOps e qualidade de entrega

### Confirmado no repositório

| Área | Configuração atual |
|---|---|
| Aplicação | React 19, Vite 6, TypeScript 5.8 |
| Render | `npm ci && npm run build`, `npm start`, Node 22.11.0 (`render.yaml`) |
| Firebase Functions | Node 20 (`functions/package.json`) |
| CI | PR/push em `main`: `npm ci`, `npm run lint`, `npm test`, `npm run build` |
| Testes | runner Node customizado; Playwright em harness `preview/` |
| Package managers | `package-lock.json` e `pnpm-lock.yaml` coexistem; CI/Render usam npm |
| Hosting | compatibilidade Render/Express e Firebase/Netlify Functions |

### Lacunas

- `lint` é, na verdade, `tsc --noEmit`; não existe lint ESLint separado.
- CI não executa Playwright, verificação de regras Firebase, secret scanning, auditoria de dependências ou análises de bundle.
- Os E2E exercitam o harness de preview, não o bootstrap autenticado, o Firebase, a fila offline ou o service worker real.
- Os runtimes Node 20 e 22 precisam de política explícita.
- Há dois lockfiles; npm deve ser formalizado como padrão ou a mudança de gerenciador deve ocorrer em PR dedicado.

---

## 9. Estratégia incremental de refatoração

### Fase 0 — Auditoria (esta entrega)

- [x] Levantar arquitetura, dados, segurança, DevOps, testes e frontend.
- [x] Executar gates de baseline e registrar falhas atuais.
- [x] Identificar riscos e fronteiras de extração sem alterar código de aplicação.

### Fase 1 — Fundação e baseline recuperado

1. Corrigir os erros TypeScript em `CentralOperacionalTab` sem ampliar escopo visual.
2. Resolver o contrato de navegação: alinhar a expectativa de 13 módulos com a decisão atual de 9, ou restaurar os módulos previstos; essa é uma decisão de produto antes do código.
3. Investigar e rotacionar a possível credencial exposta.
4. Criar `lint` real com ESLint somente após estabilizar o typecheck; manter `typecheck` como script separado.
5. Formalizar npm como package manager oficial e planejar remoção do lockfile concorrente.
6. Adicionar registro de coleção/persistência começando por uma área semântica pequena e coberta por testes.

**Critério de saída:** `typecheck`, testes e build verdes; nenhuma credencial de teste versionada; decisão de navegação documentada.

### Fase 2 — Segurança, acessibilidade e design system

1. Testar e reforçar RBAC de operações públicas destrutivas.
2. Definir/implantar escopo organizacional antes de múltiplas organizações no Firebase.
3. Corrigir focus trap do Drawer e semântica do Modal.
4. Tornar controles interativos do dashboard acessíveis por teclado.
5. Instituir regressão visual/teclado em breakpoints-chave.
6. Extrair tokens e CSS de compatibilidade por componente, preservando o visual RENEA.

**Critério de saída:** controles críticos não dependem de ponteiro; CSS novo usa tokens/components; permissões destrutivas têm testes server-side.

### Fase 3 — Módulos e estado por domínio

1. Extrair primeiro **Frota/Manutenção**: já possui domínio especializado em `src/fleet/` e `src/utils/manutencao.ts`.
2. Corrigir paridade entre registro manual e importação do controle de equipamentos para criação/vínculo automático de OS.
3. Extrair **Presença** e **Cadastros** usando adaptadores de persistência compatíveis.
4. Introduzir providers de domínio sem migrar de uma vez toda a fonte de dados.
5. Reutilizar selectors de frota/operação no Dashboard, Central e Frota.

**Critério de saída:** pelo menos dois módulos podem ser montados/testados sem conhecer todos os estados do `App.tsx`.

### Fase 4 — Navegação e URLs

1. Adicionar URLs progressivas mantendo `navigation.ts` como fonte de metadata.
2. Começar pelas páginas primárias já presentes na sidebar.
3. Adicionar guards de autorização por rota no frontend, mantendo validação server-side como autoridade.
4. Preservar destinos auxiliares e migrá-los conforme forem agrupados nos módulos pais.

**Critério de saída:** Dashboard, Frota/Manutenção, Presença e Administração têm URLs, deep links e histórico funcional.

### Fase 5 — Sincronização, testes e performance

1. Evoluir a fila offline por comandos idempotentes nos módulos de maior valor.
2. Adicionar E2E autenticado controlado: login, claims, presença, manutenção, offline/retry e recuperação.
3. Executar Playwright no CI e adicionar secret scanning.
4. Aplicar orçamento de bundle e retirar artefatos rastreados em mudança separada e aprovada.
5. Revisar imagens, seeds e dados históricos com política explícita de retenção.

---

## 10. Decisões que precisam de confirmação antes da Fase 1

1. A navegação primária deve permanecer com **9 módulos** ou retornar aos **13 módulos** planejados? O código e o teste estão em conflito.
2. Firebase é oficialmente **monotenante** durante a transição, ou o projeto já deve suportar múltiplas organizações com isolamento técnico?
3. O `main` deve ser mantido como ramo de desenvolvimento direto ou a refatoração deve ocorrer em uma branch dedicada com PRs por fase?
4. Qual é o ambiente de homologação autorizado para E2E autenticado e validação de regras? Nenhuma interação com produção deve ocorrer sem autorização explícita.
5. Os arquivos rastreados de backup/ZIP/artefatos devem ser apenas ignorados daqui para frente, ou devem ser removidos do índice em um commit separado após cópia/retensão confirmada?

---

## Conclusão

O RENEA ERP não precisa ser reescrito. A aplicação já contém domínios, utilitários, padrões de segurança e componentes suficientes para uma modernização incremental. O caminho de menor risco é estabilizar os gates quebrados, resolver riscos de segurança e isolamento de dados, consolidar o design system existente e então extrair fronteiras por domínio — começando por Frota/Manutenção, onde a estrutura atual já oferece os melhores pontos de extensão.
