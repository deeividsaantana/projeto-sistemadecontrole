# RENEA Shell e Pluviômetro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Atualizar o shell do RENEA, simplificar Dashboard/login, reorganizar a navegação e entregar o Pluviômetro como módulo principal sem duplicar dados.

**Architecture:** A navegação continuará centralizada em `src/app/navigation/navigation.ts` e o `App.tsx` continuará sendo o orquestrador de estado/persistência. O Pluviômetro será uma tela fina sobre `DiarioObra`, `montarMesDeChuva` e o callback existente de salvamento; nenhuma nova fonte de verdade será criada.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, GSAP, lucide-react, testes Node/Playwright.

**Spec:** `docs/superpowers/specs/2026-11-11-renea-shell-pluviometro-design.md`

## Global Constraints

- Preservar dados persistidos, permissões, rotas públicas e links antigos.
- `lancamentos` continua sendo Combustível; `pluviometro` será o novo módulo principal.
- Ausência de diário continua diferente de zero milímetro.
- Exclusão operacional continua sendo inativação.
- Não importar SDK de banco em componentes.
- Toda tela deve usar `TelaCheia`, `PageHeader`, foco acessível e `prefers-reduced-motion`.
- Rodar `npm run verify` antes de abrir ou atualizar o PR.

---

### Task 1: Atualizar contratos de navegação e compatibilidade

**Files:**
- Modify: `src/app/navigation/navigation.ts`
- Modify: `src/App.tsx`
- Test: `tests/navigation.test.ts`
- Test: `tests/sidebarNavigation.test.ts`
- Test: `tests/navegacaoDestinos.test.ts`

**Interfaces:**
- Produces the `pluviometro` primary module id and its role access entries.
- Keeps `destinoDaAba(tab, abasPermitidas)` as the compatibility boundary for old URLs.

- [ ] **Step 1: Add failing assertions for the new module contract**

Add assertions that `pluviometro` is in `PRIMARY_MODULE_IDS`, appears in
`ALL_NAVIGATION_ITEMS`, and is available for the same operational roles as
the former daily operational flow. Assert that `meu-dia` and `diario-obra`
are absent from the sidebar while old destinations resolve to
`pluviometro` (or the explicitly chosen compatible destination).

- [ ] **Step 2: Run the focused navigation tests**

Run:

```powershell
npm test -- navigation sidebarNavigation navegacaoDestinos
```

Expected: the new assertions fail against the current navigation.

- [ ] **Step 3: Implement the minimum navigation change**

Add the `Pluviômetro` item and icon to the appropriate group, remove the two
old primary ids from the menu, update role arrays without granting
administration access, and add redirects for bookmarked `meu-dia` and
`diario-obra`. Keep `lancamentos` unchanged.

- [ ] **Step 4: Wire the new active tab in `App.tsx`**

Render `PluviometroTab` when `activeTab === 'pluviometro'`, pass the existing
`diariosObra`, `obras`, `responsavel`, edit permission and
`handleSaveDiarioObra`, and make old route entries land on the compatible
screen without deleting or rewriting saved records.

- [ ] **Step 5: Re-run focused tests**

Run:

```powershell
npm test -- navigation sidebarNavigation navegacaoDestinos
```

Expected: PASS.

- [ ] **Step 6: Commit the navigation slice**

```powershell
git add src/app/navigation/navigation.ts src/App.tsx tests/navigation.test.ts tests/sidebarNavigation.test.ts tests/navegacaoDestinos.test.ts
git commit -m "feat: reorganiza navegacao do pluviometro"
```

### Task 2: Redesenhar sidebar desktop e menu mobile

**Files:**
- Modify: `src/app/shell/DesktopSidebar.tsx`
- Modify: `src/app/shell/NavigationMenu.tsx`
- Modify: `src/app/shell/DesktopTopBar.tsx`
- Modify: `src/index.css`
- Test: `tests/sidebarScreenStandard.test.ts`
- Test: `tests/sidebarNavigation.test.ts`

**Interfaces:**
- `DesktopSidebar` keeps `activeTab`, `groups`, and `onNavigate`.
- `NavigationMenu` remains the mobile/search menu boundary.

- [ ] **Step 1: Add contract checks for always-open groups and visual state**

Assert that group expand/collapse controls and chevrons are not rendered,
active items use the light-green state with a left green marker, and the
footer still exposes `Cintravyse v3.5.1`.

- [ ] **Step 2: Implement the white sidebar state**

Replace dark-surface classes with the existing RENEA light palette, remove
`closedGroups`, `CLOSED_GROUPS_KEY`, `ChevronDown` and group toggle handlers,
keep the collapse preference, and render collapsed mode as icon-only with
accessible titles.

- [ ] **Step 3: Apply the same active state to mobile**

Remove the mobile trailing navigation chevron, retain the search field,
apply the same light-green active background and left marker, and keep
44-pixel touch targets. Preserve group labels and all current navigation
callbacks.

- [ ] **Step 4: Emphasize the environment card and fix branding**

Update the existing project/environment surface to visually prioritize
“Ambiente RENEA”, render the Cintravyse mark directly on white without a
green square, and keep the exact footer label `Cintravyse v3.5.1`.

- [ ] **Step 5: Run focused shell tests**

Run:

```powershell
npm test -- sidebarScreenStandard sidebarNavigation
```

Expected: PASS.

- [ ] **Step 6: Commit the shell slice**

```powershell
git add src/app/shell/DesktopSidebar.tsx src/app/shell/NavigationMenu.tsx src/app/shell/DesktopTopBar.tsx src/index.css tests/sidebarScreenStandard.test.ts tests/sidebarNavigation.test.ts
git commit -m "feat: aplica identidade clara na navegacao"
```

### Task 3: Simplificar login, Dashboard e identidade do cabeçalho

**Files:**
- Modify: `src/auth/LoginScreen.tsx`
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/app/shell/DesktopTopBar.tsx`
- Modify: `src/auth/supabaseAuth.ts`
- Test: `tests/dashboardUsability.test.ts`
- Test: `tests/contasIguais.test.ts`

**Interfaces:**
- `DesktopTopBar` continues receiving the current authenticated `User`.
- Profile name resolution must return a display string without replacing a
  real name with the email when metadata contains a name.

- [ ] **Step 1: Add failing checks for requested copy and filters**

Assert that the login no longer contains the restricted-access footer copy,
Dashboard has no obra selector or duplicate content title, and the header
does not render visible synchronization status text.

- [ ] **Step 2: Implement the minimal UI removals**

Remove only the login footer text, remove the Dashboard `obraId` state and
selector while keeping `PeriodFilter`, and keep all indicator calculations
and click navigation intact.

- [ ] **Step 3: Resolve the real authenticated name**

Use the existing profile/user metadata fields in priority order, then
`displayName`, then a safe generic RENEA label. Keep the email as fallback
only when no real name exists. Render the cloud state as one colored dot with
`aria-label`/`title` containing the full status and last-sync information.

- [ ] **Step 4: Run focused UI contracts**

Run:

```powershell
npm test -- dashboardUsability contasIguais
```

Expected: PASS.

- [ ] **Step 5: Commit the UI slice**

```powershell
git add src/auth/LoginScreen.tsx src/components/Dashboard.tsx src/app/shell/DesktopTopBar.tsx src/auth/supabaseAuth.ts tests/dashboardUsability.test.ts tests/contasIguais.test.ts
git commit -m "feat: simplifica acesso e cabecalho do erp"
```

### Task 4: Criar a tela principal de Pluviômetro

**Files:**
- Create: `src/components/PluviometroTab.tsx`
- Modify: `src/components/MapaChuva.tsx`
- Modify: `src/utils/mapaChuva.ts`
- Modify: `src/App.tsx`
- Test: `tests/mapaChuva.test.ts`
- Test: `tests/moldeDemaisTelas.test.ts`
- Test: `tests/run.ts`

**Interfaces:**
- `PluviometroTabProps` includes `diarios: DiarioObra[]`, `obras:
  ObraLocal[]`, `responsavel: string`, `podeEditar: boolean`, and
  `onSave(diario: DiarioObra, isNew: boolean): void`.
- The existing `montarMesDeChuva` and `mesesComDiario` remain pure and retain
  their distinction between missing records and zero precipitation.

- [ ] **Step 1: Add failing tests for monthly selection and launch data**

Cover a selected month/year with no records, a zero-millimeter record, an
inactivated record, monthly totals, and the presence of the two internal tab
labels `Resumo mensal` and `Lançamentos`.

- [ ] **Step 2: Extract the reusable daily launch form**

Move the climate/pluviometer fields and save behavior into the new
Pluviometer screen using the existing `DiarioObra` shape. Preserve
`horasParadasClima`, `precipitacaoMm`, climate fields, `obraId`, timestamps,
responsible user and active state.

- [ ] **Step 3: Implement the internal tabs**

Use `AbasDaTela` in `PageHeader`. The summary tab renders the existing
calendar/export and the five required monthly totals. The launches tab
filters records by selected month/year, lets authorized users create/update
the selected day, and provides clear empty/loading/error states.

- [ ] **Step 4: Preserve on-demand export**

Keep the dynamic import of `universalPdfReport` and the existing monthly
filename/columns. Ensure export uses the selected month rather than the
current date.

- [ ] **Step 5: Wire and run focused tests**

Run:

```powershell
npm test -- mapaChuva moldeDemaisTelas
```

Expected: PASS.

- [ ] **Step 6: Commit the Pluviômetro slice**

```powershell
git add src/components/PluviometroTab.tsx src/components/MapaChuva.tsx src/utils/mapaChuva.ts src/App.tsx tests/mapaChuva.test.ts tests/moldeDemaisTelas.test.ts tests/run.ts
git commit -m "feat: cria modulo de pluviometro"
```

### Task 5: Atualizar testes de integração e validar a entrega

**Files:**
- Modify: `tests/e2e/telas.spec.ts`
- Modify: `tests/padraoAbas.test.ts`
- Modify: `tests/repoHygiene.test.ts` only if a directly related fixture requires it
- Modify: `tests/run.ts`
- Modify: `CONTRIBUTING.md` only if the final navigation checklist changes

**Interfaces:**
- E2E selectors use stable `data-testid` values on the new module and tabs.
- Existing public routes and access restrictions remain covered.

- [ ] **Step 1: Update E2E coverage**

Add a desktop/mobile scenario for `?screen=pluviometro&shell=1` or the
repository's equivalent preview route, assert the monthly totals and tab
switching, and keep the old diary data visible through the compatible path.

- [ ] **Step 2: Run the targeted E2E and contract tests**

Run:

```powershell
npm test
npx playwright test tests/e2e/telas.spec.ts -g "pluvi|relatorio|sidebar"
```

Expected: PASS, with no new hygiene or pattern failures.

- [ ] **Step 3: Run the required full verification**

Run:

```powershell
npm run verify
```

Expected: TypeScript, tests, production build and bundle-size checks all
pass.

- [ ] **Step 4: Inspect responsive previews**

Start the documented preview server:

```powershell
npx vite --config preview/vite.config.ts --port 4300
```

Inspect desktop expanded, desktop collapsed, mobile menu and 390-pixel
viewport. Confirm no horizontal overflow, visible focus, readable labels,
and the first data row/summary is visible without unnecessary scrolling.

- [ ] **Step 5: Commit validation updates**

```powershell
git add tests/e2e/telas.spec.ts tests/padraoAbas.test.ts tests/run.ts CONTRIBUTING.md
git commit -m "test: valida shell e pluviometro"
```

### Task 6: Preparar PR e acompanhar checks

**Files:**
- Inspect: `.github/pull_request_template.md`
- Inspect: `.github/PULL_REQUEST_TEMPLATE/`
- Modify: none unless the template requires generated evidence

- [ ] **Step 1: Confirm the worktree and verification output**

Run:

```powershell
git status --short --branch
npm run verify
```

Expected: clean intended changes and a successful verify result.

- [ ] **Step 2: Push the work branch**

Push the current work branch without exposing credentials or changing
unrelated branches.

- [ ] **Step 3: Open the PR using the repository template**

Include exact `npm run verify` and E2E results, responsive preview evidence,
compatibility notes for old routes, and the required checklist sections.

- [ ] **Step 4: Wait for GitHub checks**

Do not merge while any required check is pending or failing. If a check
fails, fix the narrow cause, rerun `npm run verify`, and update the PR.

- [ ] **Step 5: Merge only after approval and green checks**

Merge to `main` only after all required checks pass, then confirm that Render
started the deployment and report the PR link, verification result and
deployment status.
