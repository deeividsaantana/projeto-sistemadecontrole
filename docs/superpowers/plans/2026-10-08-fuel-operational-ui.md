# Fuel Operational UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task‑by‑task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the *Combustível Operacional* screen with dynamic period tabs, summary cards, advanced filters, a clearer historic table, sync indicator, pending‑review highlights, and an export‑to‑Excel feature, while keeping all logic pure and test‑driven.

**Architecture:** Introduce a new pure‑logic module `fuelReport.ts` that aggregates, filters, and summarizes fuel data. The UI component `CombustivelOperacionalTab.tsx` consumes this module, adding UI elements (tabs, cards, filter panel, badge, export button). All new code follows existing Tailwind and React‑Query patterns; animations use GSAP as in other screens.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, React‑Query, GSAP, exceljs (already a dependency).

**Spec:** `docs/superpowers/specs/2026-10-08-fuel-operational-ui-design.md`

## Global Constraints
- Must compile with `npm run lint` (no TypeScript errors).
- All new functionality covered by unit tests (`npm test`).
- No changes to Supabase schema – UI‑only.
- Keep bundle size impact ≤ 5 KB (use dynamic imports for heavy UI parts if needed).
- Follow existing component naming conventions (`PascalCase` for components, camelCase for functions).

---

### Task 1: Create Pure‑Logic Report Module

**Files:**
- **Create:** `src/modules/frota/fuelReport.ts`
- **Create:** `tests/fuelReport.test.ts`

**Interfaces:**
- Consumes: `Abastecimento` type from `src/types.ts`.
- Produces:
  ```ts
  export type FuelMonthSummary = {
    month: string; // e.g., "2026-06"
    totalLiters: number;
    launchCount: number;
    equipmentCount: number;
    companyCount: number;
  };
  export type FuelFilters = {
    month?: string;
    companyIds?: string[];
    prefix?: string;
    convoyId?: string;
    fuelTypeId?: string;
    pendingReview?: boolean;
  };
  export function groupByMonth(data: Abastecimento[]): Record<string, Abastecimento[]>;
  export function summarizeMonth(data: Abastecimento[]): FuelMonthSummary;
  export function applyFilters(data: Abastecimento[], filters: FuelFilters): Abastecimento[];
  export function isPendingReview(record: Abastecimento): boolean; // UI‑only logic
  ```

- [ ] **Write failing tests** for each exported function (grouping, summarizing, filtering, pending flag).
- [ ] **Run tests** to confirm failures.
- [ ] **Implement minimal logic** to make tests pass.
- [ ] **Run tests** again; ensure all pass.
- [ ] **Commit** changes.

### Task 2: Add Export‑to‑Excel Helper

**Files:**
- **Modify:** `src/modules/frota/fuelReport.ts` – add `export function exportToExcel(filtered: Abastecimento[], fileName: string): Promise<Blob>` using `exceljs`.
- **Create:** `tests/fuelReportExport.test.ts` (mock ExcelJS workbook, verify column order and formatting).

- [ ] **Write failing test** that calls `exportToExcel` and checks that a Blob is returned and that the workbook contains the correct headers (`Data`, `Prefixo`, `Descrição`, …).
- [ ] **Run test** (expected failure).
- [ ] **Implement export logic** (create workbook, add worksheet, set columns with proper formats, populate rows, generate Blob).
- [ ] **Run test** to confirm pass.
- [ ] **Commit**.

### Task 3: Extend UI – CombustivelOperacionalTab Component

**Files:**
- **Modify:** `src/components/CombustivelOperacionalTab.tsx`

**Changes:**
1. Import functions from `fuelReport.ts`.
2. Add **dynamic month tabs** component at top of the screen.
3. Add **summary cards** that display the `FuelMonthSummary` for the selected month.
4. Add **collapsible filter panel** (GSAP slide‑down) with dropdowns/multi‑selects bound to a local `filters` state.
5. Replace the historic table body with data from `applyFilters` and mark rows with `isPendingReview` (yellow background + badge).
6. Add **sync badge** showing the timestamp of the last successful Supabase fetch (use the existing query’s `dataUpdatedAt` from React‑Query meta). If offline, show gray badge.
7. Add **Export → Excel** button that calls `exportToExcel` with current filtered data.
8. Ensure pagination (10 rows/page) using existing table pagination utilities.

- [ ] **Write failing UI test** (React Testing Library) that renders the component, selects a month tab, checks that summary cards update, and that the sync badge appears.
- [ ] **Run test** (fail).
- [ ] **Implement UI changes** step by step, using Tailwind classes for styling and GSAP for the filter panel animation.
- [ ] **Run UI test**; ensure pass.
- [ ] **Run full test suite** to ensure no regressions.
- [ ] **Commit**.

### Task 4: Add Filter Panel Component (optional split)

**Files:**
- **Create:** `src/components/FuelFilterPanel.tsx`
- **Create:** `tests/FuelFilterPanel.test.tsx`

If the filter UI grows large, extract it to its own component.
- [ ] Write failing test for rendering the panel and interacting with dropdowns.
- [ ] Implement component (GSAP slide‑down, Tailwind styling, callbacks to parent).
- [ ] Run test, commit.

### Task 5: Update Styling & Animation Consistency

**Files:**
- **Modify:** any relevant Tailwind utility files if new colors are needed (e.g., badge colors).
- **Check:** existing GSAP usage for consistency (duration, easing).

- [ ] Verify that all new UI elements follow the design system (spacing, typography).
- [ ] Run visual regression test (if present) or manually verify in dev mode.
- [ ] Commit.

### Task 6: Documentation

**Files:**
- **Create/Update:** `docs/superpowers/specs/2026-10-08-fuel-operational-ui-design.md` – brief spec that this plan implements (can be a short markdown copy of the design table).
- **Update:** `README.md` section for “Combustível Operacional” to mention new features.

- [ ] Write spec markdown.
- [ ] Update README.
- [ ] Commit.

### Task 7: Verification & Cleanup

- [ ] Run `npm run lint` – ensure no TypeScript errors.
- [ ] Run `npm run verify` – lint, tests, build, bundle‑size check.
- [ ] If bundle size exceeds limit, consider lazy‑loading the filter panel (`React.lazy` + `Suspense`).
- [ ] Ensure no console warnings.
- [ ] Commit final changes with version bump if needed.

---

## Self‑Review Checklist
- [ ] All spec requirements are covered by at least one task.
- [ ] No placeholders (TBD, TODO) remain.
- [ ] Types and signatures are consistent across tasks.
- [ ] Each task is independent and testable.
- [ ] Plan saved to `docs/superpowers/plans/2026-10-08-fuel-operational-ui.md`.

---

**Plan complete and saved.**

Two execution options:

1. **Subagent‑Driven (recommended)** – I can dispatch a fresh subagent per task and review after each commit.
2. **Inline Execution** – I can run the tasks sequentially in this session using the executing‑plans skill.

Which approach would you like to take?