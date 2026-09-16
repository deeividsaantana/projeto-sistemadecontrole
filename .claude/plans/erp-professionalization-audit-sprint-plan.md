# RENEA ERP Sprint 1: P0 Critical Path

## Plan Context
This is Sprint 1 of the ERP professionalization roadmap. Focus: Evidence reconciliation → P0 bug fixes + critical-path regression gate.

## Scope Lock
**Include ONLY P0-01 through P0-09** (9 tasks, 5 days):
- P0-01: Characterization tests for CadastrosTab create/edit/reload
- P0-02: Error callback fix (onSaveEmpresa → CadastrosTab validation error)
- P0-03: Unsubscribe leak fix (App.tsx onSnapshot try/finally)
- P0-04: Presence history index fix
- P0-05: Dual-presence sync E2E test
- P0-06: Offline queue recovery (pending badge + retry)
- P0-07: Authorization boundary integration tests
- P0-08: Performance baseline (CadastrosTab form → save → persist)
- P0-09: Critical-path regression suite (all P0 tests + release checklist)

**Excluded from Sprint 1:**
- Stack changes
- Package/dependency installs
- Data migrations
- Visual redesigns
- Component rewrites
- ERP expansions

## Global Constraints
- **Dev server**: http://localhost:3000 must remain active (Vite HMR)
- **Environment**: Isolated local Firebase (safe for test data)
- **Tests**: Run before every commit; critical path must pass
- **Code review**: Use silent-failure-hunter + code-reviewer after each task
- **Rollback**: Document rollback per task; git revert available
- **No commits to main**: All work in isolated branch; sprint completion uses finishing-a-development-branch

## Key Evidence Base (from audit)
- **EV-BUG-001**: CadastrosTab optimistic write + silent cloud failure (App.tsx:1594–1620)
- **EV-BUG-002**: No error callback from onSaveEmpresa
- **EV-BUG-003**: Unsubscribe listener leak (App.tsx:1369–1391)
- **EV-BUG-004**: Presence history composite index missing
- **EV-BUG-005**: Dual-presence implementations separate, no sync
- **EV-PERF-001**: App.tsx re-render cascade (60 children, no memo)
- **EV-SEC-001**: No authorization boundary tests

---

## Task P0-01: Characterization Tests

**Files:**
- Create: `tests/critical-path.test.ts` (characterization suite)
- Inspect: `src/App.tsx:1594–1620` (onSaveEmpresa)
- Inspect: `src/components/CadastrosTab.tsx:272–420` (handleSubmit, validation)
- Modify: `tests/run.ts` (add critical-path suite to runners)

**Interfaces:**
- Consumes: Existing Firebase test fixtures (STORAGE_KEYS, firestore rules)
- Produces: Test patterns for P0-02, P0-03, P0-05 (create/edit/reload/error scenarios)

**Steps:**

- [ ] 1. Read audit evidence for create/edit flows (EV-BUG-001, EV-BUG-002)
- [ ] 2. Write failing test: Create empresa with valid data, verify persists after reload
- [ ] 3. Write failing test: Create empresa, trigger cloud reject, verify error shown, modal stays open
- [ ] 4. Write failing test: Offline create, verify pending state, online recovery
- [ ] 5. Run tests, confirm all fail (no error callback yet)
- [ ] 6. Add test commands to package.json: `npm run test:critical-path`
- [ ] 7. Commit: "test(critical-path): add characterization tests for CadastrosTab create/edit"

---

## Task P0-02: Error Callback Fix

**Files:**
- Modify: `src/App.tsx:1594–1620` (onSaveEmpresa → add error callback parameter + invocation)
- Modify: `src/components/CadastrosTab.tsx:272–420` (handleSubmit → receive error callback, call setValidationError)
- Test: `tests/critical-path.test.ts` (P0-01 tests should now pass)

**Interfaces:**
- Consumes: onSaveEmpresa signature (App.tsx:1594)
- Produces: Standardized error callback pattern (reused in P1-02 for all entities)

**Steps:**

- [ ] 1. Modify onSaveEmpresa to accept error callback: `onError?: (error: Error) => void`
- [ ] 2. In onSaveEmpresa catch block, call `onError(error)` instead of just logging
- [ ] 3. In CadastrosTab handleSubmit, pass error callback: `onSaveEmpresa(item, isNew, (err) => setValidationError(err.message))`
- [ ] 4. Run `npm run test:critical-path` → verify "Create empresa: cloud reject" test passes
- [ ] 5. Manual test: Open CadastrosTab, trigger cloud error (force network fail), verify error toast shown
- [ ] 6. Commit: "fix: add error callback from onSaveEmpresa to CadastrosTab validation error"

---

## Task P0-03: Unsubscribe Leak Fix

**Files:**
- Modify: `src/App.tsx:1369–1391` (onSnapshot subscription setup)
- Test: Write integration test for subscription cleanup on error

**Interfaces:**
- Consumes: Firebase onSnapshot API
- Produces: Safe subscription cleanup pattern (used in P1 presence refactor)

**Steps:**

- [ ] 1. Read App.tsx lines 1369–1391; identify error paths
- [ ] 2. Wrap onSnapshot in try/finally: `let unsubscribe; try { unsubscribe = onSnapshot(...); } finally { if error cleanup }`
- [ ] 3. Write integration test: Trigger JSON.parse error mid-subscription → verify cleanup
- [ ] 4. Run test → verify passes (listener cleaned up)
- [ ] 5. Commit: "fix: wrap onSnapshot in try/finally to prevent listener leak"

---

## Task P0-04: Presence History Index Fix

**Files:**
- Modify: `public/presenca.js:369–385` (presence history query fallback)
- Test: Integration test for composite index missing scenario

**Interfaces:**
- Consumes: Firestore orderBy + limit API
- Produces: Fallback query that handles missing composite index gracefully

**Steps:**

- [ ] 1. Read public/presenca.js:379 orderBy query; understand error code 9 (composite index)
- [ ] 2. Improve fallback: instead of `.get()` unordered, use `.orderBy('payload.data', 'desc').get()` with fallback to no order
- [ ] 3. Or: pre-seed composite index in test; verify query works
- [ ] 4. Write E2E: Load presence history, verify last 30 days in order
- [ ] 5. Commit: "fix: handle missing presence history composite index gracefully"

---

## Task P0-05: Dual-Presence Sync E2E

**Files:**
- Create: `tests/presence-dual-auth.spec.ts` (E2E for admin + field sync)
- Inspect: `src/components/ControlePresencaTab.tsx` (admin implementation)
- Inspect: `public/presenca-tempo-real-publica.js` (field implementation)

**Interfaces:**
- Consumes: Both presence implementations' onSnapshot + mutation patterns
- Produces: E2E test ensuring admin changes reflect in field within 5s

**Steps:**

- [ ] 1. Write Playwright E2E: Admin adds employee to group
- [ ] 2. Field user loads presence → verify new employee visible (within 5s, no manual refresh)
- [ ] 3. Run test against localhost:3000 → currently fails (no sync)
- [ ] 4. Commit: "test(e2e): add presence dual-auth sync test (currently failing)"

---

## Task P0-06: Offline Queue Recovery

**Files:**
- Modify: `src/components/DesktopTopBar.tsx` (add pending badge)
- Modify: `src/hooks/useSyncContext.ts` or similar (expose pending count + retry callback)
- Modify: `src/App.tsx` (pass pending count to topbar, handle retry)
- Test: `tests/critical-path.test.ts` (add offline scenario)

**Interfaces:**
- Consumes: Offline queue state (from existing offlineQueue.ts)
- Produces: User-visible pending badge + manual retry button

**Steps:**

- [ ] 1. Add SyncContext (or enhance existing) with pendingCount
- [ ] 2. In DesktopTopBar, show badge: `Pending: ${pendingCount}` when > 0
- [ ] 3. Add retry button: calls `retryPendingCommands()`
- [ ] 4. Write test: Force offline, create empresa, verify badge, come online, verify auto-retry
- [ ] 5. Run test → passes
- [ ] 6. Commit: "feat: add offline queue pending badge and manual retry"

---

## Task P0-07: Authorization Boundary Tests

**Files:**
- Create: `tests/authorization-boundary.test.ts` (integration tests for Firebase rules)
- Inspect: `firestore.rules` (read/write guards)

**Interfaces:**
- Consumes: Firebase test SDK, Firestore rules
- Produces: Test suite verifying role-denied paths return 403

**Steps:**

- [ ] 1. Write test: User role A tries to read collection restricted to role B → expect 403
- [ ] 2. Write test: Public presence token expires → access denied
- [ ] 3. Write test: User modifies another org's data → expect 403
- [ ] 4. Run tests → all pass (or identify gaps in firestore.rules)
- [ ] 5. Commit: "test: add authorization boundary integration tests"

---

## Task P0-08: Performance Baseline

**Files:**
- Create: `tests/performance-baseline.ts` (measure CadastrosTab workflow)

**Interfaces:**
- Consumes: App startup, CadastrosTab route, Firebase latency
- Produces: Baseline metrics (form open time, save duration, reload confirmation)

**Steps:**

- [ ] 1. Measure 3 runs: form open → fill → save → close → reload → verify persisted
- [ ] 2. Record times: form open (target <200ms), save (target <800ms), reload (target <400ms)
- [ ] 3. Write baseline report: commit message with metrics
- [ ] 4. Commit: "perf: record CadastrosTab workflow baseline (form: XXms, save: XXms, reload: XXms)"

---

## Task P0-09: Critical-Path Regression Suite

**Files:**
- Create: `tests/critical-path-regression.test.ts` (consolidated suite)
- Modify: `package.json` (add `npm run test:critical-path:all` command)

**Interfaces:**
- Consumes: All P0-01 through P0-08 tests and fixes
- Produces: Gated regression suite for future PRs

**Steps:**

- [ ] 1. Consolidate all P0 tests into single suite
- [ ] 2. Run all: `npm run lint && npm run test:critical-path:all && npm run build`
- [ ] 3. Verify all pass (characterization + error callback + leak fix + presence index + dual-auth E2E + offline recovery + authz + perf baseline)
- [ ] 4. Document release checklist: console errors ✓, network requests correct ✓, manual walkthrough ✓
- [ ] 5. Commit: "test: critical-path regression gate ready for merge"

---

## Release Criteria

All P0 tests pass:
- ✅ No console errors
- ✅ No unhandled exceptions
- ✅ Network requests sequence correct
- ✅ Manual critical-path walkthrough succeeds
- ✅ Rollback documented (git revert available)
- ✅ Performance baseline recorded

## Rollback Plan

If regression detected:
1. `git revert <commit>` (or range)
2. `npm run test:critical-path:all` → verify rollback
3. Document issue for next sprint
