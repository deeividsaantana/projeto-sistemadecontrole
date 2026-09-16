# SDD Ledger — Plan: erp-professionalization-audit-sprint-plan.md

## Pre-flight Review

### Task Conflict Scan

| Task Pair | Interface | Conflict | Ruling |
|-----------|-----------|----------|--------|
| P0-01 → P0-02 | CadastrosTab.tsx, onSaveEmpresa | P0-02 needs error callback defined in P0-01; but P0-01 only tests, doesn't implement | P0-01 writes tests that fail; P0-02 implements callback |
| P0-02 → P0-05 | Presence dual-auth | P0-02 fixes CadastrosTab only; P0-05 tests presence which is separate | No conflict; independent |
| P0-03 → P0-01 | App.tsx subscription | P0-03 fixes leak; P0-01 tests don't exercise subscription | No conflict; orthogonal |
| P0-06 → P0-02 | Error callback vs offline badge | P0-02 shows errors; P0-06 shows pending badge; both need UI feedback | Compatible; different feedback types |
| P0-07 → All | Authorization tests | Tests need Firebase rules to exist; no changes to rules proposed | No conflict; verification only |
| P0-08 → All | Performance baseline | Baseline measurement happens after fixes; uses P0-02 fixed code | No conflict; P0-02 must complete first for accurate baseline |

### Internal Task Consistency

- **P0-01**: Tests define what P0-02 must implement ✅
- **P0-02**: Error callback used in P0-01 tests ✅
- **P0-03**: No downstream dependencies ✅
- **P0-04**: Independent index fix ✅
- **P0-05**: E2E test; depends on no code changes (verifies existing behavior) ⚠️ — currently fails; will pass only with future changes (deferred to P1)
- **P0-06**: Depends on SyncContext (exists or will be created) ✅
- **P0-07**: Depends on firestore.rules existing (verified in audit) ✅
- **P0-08**: Depends on all fixes from P0-02 onward ✅
- **P0-09**: Consolidation task; depends on P0-01 through P0-08 ✅

**Ruling on P0-05**: E2E currently fails because dual-presence implementations are separate. The test is valid; it documents current state (broken) and will pass only after P1 merge/refactor. Accept as documented failure; mark as "Blocker: merged presence implementation required" in commit.

### Global Constraints Check

- ✅ Dev server http://localhost:3000 active
- ✅ Isolated Firebase (no production data risk)
- ✅ No stack changes
- ✅ No package installs (except test runners already present)
- ✅ No data migrations
- ✅ Rollback plan documented (git revert)

### Verdict

**Pre-flight scan: CLEAN** (8 rows checked, no blocking conflicts; 1 expected failure in P0-05 documented)

---

## Task TODOs

- [ ] P0-01: Characterization tests for CadastrosTab
- [ ] P0-02: Error callback fix
- [ ] P0-03: Unsubscribe leak fix
- [ ] P0-04: Presence history index fix
- [ ] P0-05: Dual-presence sync E2E (expected to fail; documents blocker)
- [ ] P0-06: Offline queue recovery
- [ ] P0-07: Authorization boundary tests
- [ ] P0-08: Performance baseline
- [ ] P0-09: Critical-path regression suite

---

## Execution Begin

**BASE commit (before P0-01 dispatch):**
BASE= bc931a6b3a804ffc3e0e9b4f5a0a046243d2e0f6

Task P0-01: complete (commits 1a813fb, review clean)

---

## Task P0-02: Error Callback Fix

**Status:** DISPATCHING

**Implementer:** [pending]

**Focus:** Add error callback mechanism from App.tsx → CadastrosTab to fix EV-BUG-001 and EV-BUG-002
