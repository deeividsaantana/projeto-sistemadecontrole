# RENEA SaaS Foundation Implementation Plan

> **For agentic workers:** Implement task by task in this checkout; preserve the existing authorization and data paths. This plan is approved for local execution; no commit, push or deploy is implied.

**Goal:** Establish a reusable SaaS frontend foundation and migrate Cadastros, then Materiais/Estoque, without interrupting existing operation.

**Architecture:** Introduce strict route/context contracts and extend the existing `src/shared/ui` library. Keep Firebase authoritative until per-domain Supabase migration reconciles. Extract `App.tsx` by domain, preserving its adapters during each cutover.

**Tech Stack:** React 19, TypeScript, Vite 6, Tailwind 4, Firebase, Supabase/PostgreSQL, node:test, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-23-renea-saas-foundation-design.md`

## Global constraints

- Real records, existing links and business calculations remain intact.
- No database SDK imports in screen components.
- New normalized tables require organization_id, RLS, authorship, migration and reconciliation test.
- No production write or provider switch in this plan.
- Every implementation slice runs `npm run verify` and local desktop/mobile validation when UI changes.

## Tasks

### 1. Baseline and audit

- [x] Confirm checkout, branch, remote and clean status; read README and migration architecture.
- [x] Inventory 45 `*Tab.tsx` screens, public routes, existing APIs, cloud paths and UI primitives.
- [x] Write classification and product specification.
- [ ] Expand each screen's flow sheet during its domain migration, including fields, permissions, data source and equivalence test.

### 2. Foundation contracts

**Files:** `src/app/routing/privateRoutes.ts`, `src/app/context/activeScope.ts`, corresponding tests.

- [x] Write failing tests for valid/invalid organization/project paths, public path exclusion and scope authorization.
- [x] Implement pure route parsing and scope validation. Do not infer organization from display name.
- [ ] Connect navigation only after membership source is available; keep legacy IDs reachable until then. The membership gateway, pure route authorization and first private route renderer are now connected; module navigation and functional screens remain open.

### 3. Shared design system

**Files:** `src/index.css`, `src/shared/ui/*`, registry reference and tests.

- [ ] Complete semantic tokens for color, spacing, typography, border, focus and motion. Initial color/spacing/radius/motion tokens are in `src/index.css`.
- [ ] Complete accessible FilterBar/DataTable contracts on top of current shared primitives. FilterBar is active in Cadastros/Materiais; DataTable sorts and paginates locally in Materiais, with remote pagination and preferences still open.
- [ ] Apply to Cadastros reference screen; search and small viewport verified, pagination/empty/editing still require equivalence checks.
- [x] Document the current component API and rule against module-local duplication in `docs/SAAS_DESIGN_SYSTEM.md`.

### 4. Cadastros vertical slice

**Files:** `src/shared/registry/*`, `src/components/CadastrosTab.tsx`, `src/masterData/*`, tests.

- [ ] Map each cadastro and consumer; preserve operational IDs and historical status.
- [ ] Separate queries/commands from `App.tsx` behind domain contracts.
- [ ] Add server-side authorization and audit only where commands are moved; do not mistake UI role filtering for security.
- [ ] Prove functional equivalence, desktop/mobile and rollback to old renderer.

### 5. Materiais/Estoque vertical slice

**Files:** `src/components/MateriaisTab.tsx`, `src/utils/materials*`, import services, future `src/modules/materials/*`, tests.

- [ ] Inventory cadastro, movements, balance, import and reports; detect all consumers.
- [ ] Extract domain operations and preserve source lineage and idempotency. First pure collection commands extracted; persistence/query and full lineage remain in legacy paths.
- [ ] Introduce Supabase normalized schema only with organization/project scope, RLS, author/version, reconciliation and rollback.
- [ ] Replace UI in sections, compare data/actions with old flow, then retire only unreachable code.

### 6. Release gate per slice

- [ ] Run `npm run verify`, affected Playwright tests, desktop/mobile inspection and security boundary tests.
- [ ] Review diff for data loss, tenant crossover, duplicate commands, dead links, accessibility and bundle regressions.
- [ ] Record actual evidence, migration impact, risk and rollback. Push/deploy only after separate authorization.

## Current execution boundary

This plan is intentionally decomposed by domain. A task is complete only when its checkboxes and acceptance evidence are satisfied; writing this plan does not mark the foundation or migration complete.
