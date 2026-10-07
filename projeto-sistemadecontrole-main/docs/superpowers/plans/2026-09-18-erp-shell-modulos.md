# RENEA ERP Shell and Module Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um ERP full white com sidebar compacta de 13 módulos, conteúdo em largura total, cabeçalhos internos invisíveis, Painel sem dados duplicados, Manutenção funcional com OS automática e Combustível local vazio.

**Architecture:** A navegação primária continua centralizada em `SIDEBAR_NAVIGATION_GROUPS`; fluxos auxiliares permanecem registrados e são acessados dentro dos módulos principais. O shell compartilhado controla largura, cabeçalho semântico e movimento seguro, enquanto Painel, Manutenção e Combustível recebem adaptações específicas e testáveis.

**Tech Stack:** React 19, TypeScript, Vite 6, Tailwind CSS 4, CSS global existente, GSAP, Lucide React, Node test runner e Playwright.

**Spec:** `docs/superpowers/specs/2026-09-18-erp-shell-modulos-design.md`

## Global Constraints

- Não migrar framework nem adicionar dependências.
- A sidebar mostra somente os 13 módulos definidos em `SIDEBAR_MODULE_IDS`.
- Fluxos auxiliares, dados, permissões, histórico e links públicos permanecem preservados.
- Branco é a superfície principal; verde, laranja, vermelho e cinza têm significado operacional.
- Ausência de dado não pode virar zero, horário ou status inventado.
- Animações nunca podem depender de `opacity: 0` para revelar informação.
- Zerar somente abastecimentos locais e sementes do checkout; não mutar produção ou dados remotos.
- Rodar `npm run verify` antes de concluir.

---

### Task 1: Contrato da navegação primária

**Files:**
- Modify: `src/app/navigation/navigation.ts`
- Create: `tests/sidebarNavigation.test.ts`
- Modify: `tests/run.ts`

**Interfaces:**
- Consumes: `NAVIGATION_GROUPS`, `SIDEBAR_NAVIGATION_GROUPS` e `ALL_NAVIGATION_ITEMS`.
- Produces: `PRIMARY_MODULE_IDS: readonly string[]` e `isPrimaryModule(id: string): boolean`.

- [ ] **Step 1: Write the failing navigation contract test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { PRIMARY_MODULE_IDS, SIDEBAR_NAVIGATION_GROUPS, isPrimaryModule } from '../src/app/navigation/navigation';

test('sidebar expõe somente os 13 módulos primários', () => {
  const rendered = SIDEBAR_NAVIGATION_GROUPS.flatMap(group => group.items.map(item => item.id));
  assert.deepEqual(rendered, [...PRIMARY_MODULE_IDS]);
  assert.equal(rendered.length, 13);
  assert.equal(isPrimaryModule('manutencao'), true);
  assert.equal(isPrimaryModule('tickets-jazida'), false);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node node_modules/tsx/dist/cli.mjs tests/sidebarNavigation.test.ts`

Expected: FAIL because `PRIMARY_MODULE_IDS` is not exported.

- [ ] **Step 3: Implement one ordered source of truth**

```ts
export const PRIMARY_MODULE_IDS = [
  'dashboard', 'modo-campo', 'central-operacional', 'planejamento',
  'diario-obra', 'controle-equipamentos', 'manutencao', 'lancamentos',
  'colaboradores', 'presenca', 'materiais', 'relatorios', 'administracao',
] as const;

const SIDEBAR_MODULE_IDS = new Set<string>(PRIMARY_MODULE_IDS);
export const isPrimaryModule = (id: string) => SIDEBAR_MODULE_IDS.has(id);
```

Build `SIDEBAR_NAVIGATION_GROUPS` in `PRIMARY_MODULE_IDS` order so tests and UI cannot drift.

- [ ] **Step 4: Register and run the test**

Add `import './sidebarNavigation.test';` to `tests/run.ts`.

Run: `node node_modules/tsx/dist/cli.mjs tests/sidebarNavigation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/navigation/navigation.ts tests/sidebarNavigation.test.ts tests/run.ts
git commit -m "refactor: fixar os modulos primarios do erp"
```

### Task 2: Sidebar compacta e viewport em largura total

**Files:**
- Modify: `src/app/shell/DesktopSidebar.tsx`
- Modify: `src/App.tsx:4449-4484`
- Modify: `src/index.css`
- Modify: `tests/e2e/telas.spec.ts`

**Interfaces:**
- Consumes: grupos derivados de `SIDEBAR_NAVIGATION_GROUPS`.
- Produces: shell com sidebar de `12.5rem`, recolhida em `4.5rem`, itens de 38 px e viewport sem `max-width`.

- [ ] **Step 1: Write the failing shell test**

```ts
test('shell usa sidebar compacta e viewport completo', async ({ page }) => {
  await page.goto('/?screen=painel');
  const sidebar = page.getByRole('complementary', { name: 'Navegação principal' });
  await expect(sidebar).toBeVisible();
  expect((await sidebar.boundingBox())!.width).toBeLessThanOrEqual(205);
  const viewport = page.locator('#main-tab-viewport');
  await expect(viewport).toHaveCSS('max-width', 'none');
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx playwright test tests/e2e/telas.spec.ts -g "shell usa sidebar" --project=desktop`

Expected: FAIL because the current expanded sidebar is about 244 px.

- [ ] **Step 3: Compact the sidebar**

Change the brand row to `min-h-[3.75rem]`, navigation vertical padding to `py-2`, group button padding to `py-1.5`, item height to `min-h-9`, and icon size to `1rem`. In `src/index.css`, set:

```css
#app-root .erp-sidebar { width: 12.5rem; min-width: 12.5rem; background: #0b4434; }
#app-root .erp-sidebar.erp-sidebar--recolhido { width: 4.5rem; min-width: 4.5rem; }
#main-tab-viewport { width: 100%; max-width: none; background: #fff; }
```

Remove the conditional `max-w-[1440px]` from `#main-tab-viewport` in `App.tsx` and keep responsive padding `p-3 sm:p-4 lg:p-5`.

- [ ] **Step 4: Run shell and screen smoke tests**

Run: `npx playwright test tests/e2e/telas.spec.ts -g "shell usa sidebar|monta sem erro" --project=desktop`

Expected: PASS with no horizontal overflow.

- [ ] **Step 5: Commit**

```bash
git add src/app/shell/DesktopSidebar.tsx src/App.tsx src/index.css tests/e2e/telas.spec.ts
git commit -m "feat: compactar shell e sidebar do erp"
```

### Task 3: Cabeçalho semântico sem faixa visual

**Files:**
- Modify: `src/shared/ui/PageHeader.tsx`
- Modify: `src/index.css`
- Modify: `tests/e2e/telas.spec.ts`

**Interfaces:**
- Consumes: `PageHeaderProps` existente.
- Produces: `PageHeader` com `h1` visualmente oculto e ações em `.renea-page-toolbar`.

- [ ] **Step 1: Write the failing header test**

```ts
test('modulo preserva h1 e remove o cabeçalho visual', async ({ page }) => {
  await page.goto('/?screen=producao');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('.renea-page-header__copy')).toBeHidden();
  await expect(page.locator('.renea-page-header')).toHaveCSS('min-height', '0px');
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx playwright test tests/e2e/telas.spec.ts -g "preserva h1"`

Expected: FAIL because the copy is visible.

- [ ] **Step 3: Render semantics and actions separately**

Use this structure in `PageHeader.tsx`:

```tsx
<header className={cn('renea-page-header', className)}>
  <div className="sr-only">
    {eyebrow && <span>{eyebrow}</span>}
    <h1>{title}</h1>
    {description && <p>{description}</p>}
  </div>
  {actions && <div className="renea-page-toolbar">{actions}</div>}
</header>
```

CSS must collapse an empty header and right-align actions without introducing a second title block.

- [ ] **Step 4: Verify representative modules**

Run: `npx playwright test tests/e2e/telas.spec.ts -g "preserva h1|producao monta|manutencao monta|combustivel monta"`

Expected: PASS on desktop and celular.

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/PageHeader.tsx src/index.css tests/e2e/telas.spec.ts
git commit -m "refactor: remover cabeçalhos visuais das abas"
```

### Task 4: Painel sem duplicação

**Files:**
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/index.css`
- Modify: `tests/e2e/telas.spec.ts`

**Interfaces:**
- Consumes: os cálculos atuais de `fleetSummary`, presença, produção e combustível.
- Produces: uma única faixa de ações/data e uma única instância de cada indicador.

- [ ] **Step 1: Write the failing uniqueness test**

```ts
test('painel mostra cada indicador executivo uma única vez', async ({ page }) => {
  await page.goto('/?screen=painel');
  await expect(page.getByText('Fechamento operacional')).toHaveCount(0);
  await expect(page.getByText('Pulso do dia')).toHaveCount(0);
  await expect(page.getByText('Combustível', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Pessoas em campo', { exact: true })).toHaveCount(1);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx playwright test tests/e2e/telas.spec.ts -g "cada indicador executivo"`

Expected: FAIL because the dashboard repeats the executive pulse.

- [ ] **Step 3: Remove duplicated regions**

Delete the complete `dashboard-command-deck` copy block and the duplicate KPI region. Keep one compact toolbar with date, `Registrar operação` and `Linha do tempo`, followed by a single responsive data grid. Keep `data-dashboard-section` animations transform-only.

- [ ] **Step 4: Verify dashboard interactions**

Run: `npx playwright test tests/e2e/telas.spec.ts -g "painel"`

Expected: all dashboard tests PASS in desktop and celular.

- [ ] **Step 5: Commit**

```bash
git add src/components/Dashboard.tsx src/index.css tests/e2e/telas.spec.ts
git commit -m "refactor: consolidar indicadores do painel"
```

### Task 5: Manutenção e OS automática

**Files:**
- Modify: `src/utils/manutencao.ts`
- Modify: `src/App.tsx:3470-3520`
- Modify: `src/components/ManutencaoTab.tsx`
- Modify: `tests/manutencao.test.ts`
- Modify: `tests/e2e/telas.spec.ts`

**Interfaces:**
- Consumes: `ControleEquipamentoDiario`, `OrdemServico` e `activeUserName`.
- Produces: `garantirOrdemAutomaticaDaFrota(registro, ordens, responsavel)` retornando `{ registro, ordens, criada }`.

- [ ] **Step 1: Run the existing automatic-OS tests as RED/characterization gate**

Run: `node node_modules/tsx/dist/cli.mjs tests/manutencao.test.ts`

Expected: the automatic creation and reuse cases must pass before visual work; if either fails, restore the helper behavior before proceeding.

- [ ] **Step 2: Add the equipment-icon accessibility test**

```ts
test('manutenção identifica a categoria do equipamento', async ({ page }) => {
  await page.goto('/?screen=manutencao');
  const icons = page.locator('[aria-label="Caminhão basculante"]');
  await expect(icons.first()).toBeVisible();
});
```

- [ ] **Step 3: Keep one maintenance summary and one order list**

Retain `Centro de manutenção`, `Fluxo das ordens` and `Ordens em acompanhamento`, but remove totals repeated between them. Use `apresentacaoEquipamento()` for basculante, escavadeira, máquina pesada, caminhão de apoio and generic equipment.

- [ ] **Step 4: Verify maintenance behavior**

Run: `node node_modules/tsx/dist/cli.mjs tests/manutencao.test.ts`

Run: `npx playwright test tests/e2e/telas.spec.ts -g "manutenção"`

Expected: unit tests and desktop/celular interaction tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/manutencao.ts src/App.tsx src/components/ManutencaoTab.tsx tests/manutencao.test.ts tests/e2e/telas.spec.ts
git commit -m "feat: integrar frota e manutencao automaticamente"
```

### Task 6: Combustível local vazio e estado inicial útil

**Files:**
- Modify: `src/utils/initialData.ts`
- Modify: `src/App.tsx:581-708`
- Modify: `src/components/LancamentosTab.tsx`
- Create: `src/utils/localFuelReset.ts`
- Create: `tests/localFuelReset.test.ts`
- Modify: `tests/run.ts`
- Modify: `tests/e2e/telas.spec.ts`

**Interfaces:**
- Produces: `LOCAL_FUEL_RESET_VERSION = '2026-09-18'` e `shouldResetLocalFuel(storedVersion?: string): boolean`.
- The reset only writes `[]` to local key `renea_abastecimentos`; it never calls Firebase deletion.

- [ ] **Step 1: Write the failing reset decision test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { LOCAL_FUEL_RESET_VERSION, shouldResetLocalFuel } from '../src/utils/localFuelReset';

test('zeragem local acontece uma vez por versão', () => {
  assert.equal(shouldResetLocalFuel(undefined), true);
  assert.equal(shouldResetLocalFuel(LOCAL_FUEL_RESET_VERSION), false);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node node_modules/tsx/dist/cli.mjs tests/localFuelReset.test.ts`

Expected: FAIL because `src/utils/localFuelReset.ts` does not exist.

- [ ] **Step 3: Implement the local-only reset boundary**

Create `src/utils/localFuelReset.ts`:

```ts
export const LOCAL_FUEL_RESET_VERSION = '2026-09-18';
export const shouldResetLocalFuel = (storedVersion?: string | null) =>
  storedVersion !== LOCAL_FUEL_RESET_VERSION;
```

During local hydration, if the reset is pending, persist `[]` in `renea_abastecimentos`, set state to `[]`, and store the version under `renea_local_fuel_reset_version`. Do not modify cloud gateways or delete remote documents. Set `INITIAL_ABASTECIMENTOS` to `[]` after seed hydration for this checkout.

- [ ] **Step 4: Add and test the empty state**

Show: `Nenhum abastecimento local` and actions `Novo abastecimento` and `Importar planilha` in `LancamentosTab.tsx`.

Run: `node node_modules/tsx/dist/cli.mjs tests/localFuelReset.test.ts`

Run: `npx playwright test tests/e2e/telas.spec.ts -g "combustivel"`

Expected: PASS; no remote deletion call exists in the diff.

- [ ] **Step 5: Commit**

```bash
git add src/utils/localFuelReset.ts src/utils/initialData.ts src/App.tsx src/components/LancamentosTab.tsx tests/localFuelReset.test.ts tests/run.ts tests/e2e/telas.spec.ts
git commit -m "feat: iniciar combustivel local sem lancamentos"
```

### Task 7: Consolidar acessos auxiliares nos módulos principais

**Files:**
- Modify: `src/components/CentralOperacionalTab.tsx`
- Modify: `src/components/ControleEquipamentosDiarioTab.tsx`
- Modify: `src/components/ColaboradoresTab.tsx`
- Modify: `src/components/ControlePresencaTab.tsx`
- Modify: `src/components/RelatoriosTab.tsx`
- Modify: `src/components/ConfiguracoesTab.tsx`
- Modify: `src/app/navigation/navigation.ts`
- Create: `tests/auxiliaryModuleDestinations.test.ts`
- Modify: `tests/run.ts`

**Interfaces:**
- Produces: `AUXILIARY_MODULE_DESTINATIONS: Readonly<Record<string, string>>` mapping every auxiliary screen to one primary module.

- [ ] **Step 1: Write the complete mapping test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALL_NAVIGATION_ITEMS,
  AUXILIARY_MODULE_DESTINATIONS,
  isPrimaryModule,
} from '../src/app/navigation/navigation';

test('todo módulo auxiliar tem destino primário', () => {
  const auxiliary = ALL_NAVIGATION_ITEMS.map(item => item.id).filter(id => !isPrimaryModule(id));
  assert.deepEqual(auxiliary.filter(id => !AUXILIARY_MODULE_DESTINATIONS[id]), []);
  assert.equal(AUXILIARY_MODULE_DESTINATIONS['tickets-jazida'], 'central-operacional');
  assert.equal(AUXILIARY_MODULE_DESTINATIONS['custos'], 'relatorios');
  assert.equal(AUXILIARY_MODULE_DESTINATIONS['permissoes'], 'administracao');
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node node_modules/tsx/dist/cli.mjs tests/auxiliaryModuleDestinations.test.ts`

Expected: FAIL because the mapping is not exported.

- [ ] **Step 3: Add the mapping and contextual launchers**

Add every mapping from the spec table to `navigation.ts`. Render compact subview launchers in each destination module using existing `onNavigate` callbacks. Do not remove any auxiliary component or route in this task.

- [ ] **Step 4: Verify navigation and permissions**

Run: `node node_modules/tsx/dist/cli.mjs tests/auxiliaryModuleDestinations.test.ts`

Run: `npx playwright test tests/e2e/telas.spec.ts -g "central-operacional|controle-equipamentos|colaboradores|presenca|relatorios|administracao"`

Expected: PASS and no dead launcher.

- [ ] **Step 5: Commit**

```bash
git add src/app/navigation/navigation.ts src/components/CentralOperacionalTab.tsx src/components/ControleEquipamentosDiarioTab.tsx src/components/ColaboradoresTab.tsx src/components/ControlePresencaTab.tsx src/components/RelatoriosTab.tsx src/components/ConfiguracoesTab.tsx tests/auxiliaryModuleDestinations.test.ts tests/run.ts
git commit -m "feat: consolidar fluxos auxiliares nos modulos primarios"
```

### Task 8: Verificação integral e revisão

**Files:**
- Review: all files changed by Tasks 1-7

**Interfaces:**
- Consumes: completed shell, modules, tests and local reset.
- Produces: verified local deliverable with no deployment.

- [ ] **Step 1: Run unit and integration verification**

Run: `npm test`

Expected: all suites PASS.

- [ ] **Step 2: Run TypeScript and production build**

Run: `npm run lint`

Run: `npm run build`

Expected: both commands exit 0. If the pre-existing `presence-dual-auth.spec.ts` signature error remains, fix or formally isolate it before claiming `npm run verify` success.

- [ ] **Step 3: Run all screen tests**

Run: `npx playwright test tests/e2e/telas.spec.ts`

Expected: all desktop and celular tests PASS; no page error or document overflow.

- [ ] **Step 4: Inspect authenticated localhost**

Verify the 13 sidebar items, compact width, hidden page headers, full-width content, unique dashboard KPIs, Manutenção flow and empty Combustível state at `http://127.0.0.1:3000/`.

- [ ] **Step 5: Review the diff**

Run: `git diff --check`

Run: `git diff --stat`

Review for lost actions, remote deletion code, duplicated KPIs, hidden content and unrelated edits.

- [ ] **Step 6: Run the repository gate**

Run: `npm run verify`

Expected: exit 0.

- [ ] **Step 7: Commit verification adjustments**

```bash
git add src tests
git commit -m "test: validar consolidacao do erp"
```
