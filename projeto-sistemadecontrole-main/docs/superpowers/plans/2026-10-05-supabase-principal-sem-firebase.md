# Supabase Principal Sem Firebase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Supabase the canonical backend for RENEA ERP and remove Firebase from runtime after data, auth, public links, attachments, and operational sync are reconciled.

**Architecture:** Keep the existing gateway boundary while replacing Firebase-backed implementations with Supabase-backed implementations one domain at a time. Do not delete Firebase paths until the equivalent Supabase path has migration, RLS, tests, reconciliation, and rollback evidence. The current `erp_snapshots` table is a transition bridge, not the final model for every domain.

**Tech Stack:** React 19, TypeScript, Vite, Supabase Auth/Postgres/RLS/Storage, Render API handlers, Node tests.

**Spec:** `docs/ARQUITETURA_MIGRACAO_SUPABASE.md`

## Global Constraints

- Preserve real operational data, routes, calculations, permissions, links, and public tokens.
- Do not expose `service_role`, private tokens, real `.env` values, or admin credentials in browser code or versioned files.
- No screen component may import database SDKs directly; provider-specific code stays behind `src/cloud`, `src/supabase`, API shared modules, or repositories.
- Every normalized Supabase table needs `organization_id`, RLS, authorship, versioned migration, TypeScript type, and reconciliation test.
- Never remove the Firebase path in the same task that introduces the first Supabase write for a module.
- Run `npm run lint`, `npm test`, `npm run build`, and `npm run check:bundle` before declaring each milestone ready.
- Production deploy, migration execution, credential creation, or Firebase decommissioning requires explicit user authorization.

## Review Focus

- Auth cutover: a staff user can sign in through Supabase and receives the same effective role/scope as Firebase claims.
- Public links: presence, tickets, and materials links keep token/idempotency/rate-limit behavior without loading administrative ERP data.
- Sync conflict: concurrent edits, soft deletes, and new records from two devices preserve both sides when Supabase is canonical.
- Attachments: photos, signatures, and documents migrate to Supabase Storage without exposing private files publicly.
- Rollback: while Firebase has not been removed, `dual-write` or export snapshots can restore operation if Supabase canonical reads fail.

---

## Current Dependency Map

Firebase is still runtime-critical in these areas:

- Browser auth and session: `src/firebase.ts`, `src/auth/authService.ts`, `src/App.tsx`, `src/next/app/organizations/OrganizationContext.tsx`.
- Operational cloud snapshot: `src/firebaseCloudSync.ts`, `src/cloud/cloudSyncGateway.ts`, `src/App.tsx`.
- Real-time/public queues: `src/firebasePublicSubmissions.ts`, `src/firebasePresenceRecovery.ts`, `src/firebaseTickets.ts`, `src/publicApi.ts`.
- Attachments: `src/firebaseStorage.ts`, `src/services/operationalAttachments.ts`, `src/utils/fotoDoCampo.ts`.
- Render APIs/Admin SDK: `api/_shared/firebase-admin.js`, `api/_shared/cloud-snapshot.js`, `api/master-data.js`, `api/public-presenca.js`, `api/public-tickets.js`, `api/public-materiais.js`, `api/usage-telemetry.js`, `api/cleanup-cloud-data.js`.
- Legacy Firebase Functions/config/rules: `functions/`, `firestore.rules`, `storage.rules`, `firebase.json`, `.firebaserc`.
- Build/deploy config: `.env.example`, `render.yaml`, `package.json`.

Supabase currently covers these areas:

- Provider switch and config: `src/platform/cloudProvider.ts`, `src/supabase/config.ts`, `src/supabase/client.ts`.
- Transitional snapshot: `src/supabase/cloudSync.ts`, `supabase/migrations/202609140001_initial_transition.sql`.
- Auth bridge: `src/supabase/authBridge.ts`.
- Membership/scope: `src/supabase/memberships.ts`, `src/app/routing/PrivateRouteApp.tsx`.
- Pilot normalized repositories: `src/next/services/repositories/*Repository.ts`.
- Pilot migrations: `supabase/migrations/202609150001_*` through `202610030002_*`.

## Task 1: Supabase Environment and Migration Baseline

**Files:**
- Modify: `docs/ARQUITETURA_MIGRACAO_SUPABASE.md`
- Modify: `.env.example`
- Modify: `render.yaml`
- Create: `tests/supabaseEnvironmentContract.test.ts`

**Interfaces:**
- Consumes: `resolveCloudProvider(environment)` from `src/platform/cloudProvider.ts`.
- Produces: documented required variables for browser and server Supabase use.

- [ ] **Step 1: Write the failing environment contract test**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Render config exposes Supabase public variables and keeps service role out of browser variables', () => {
  const render = readFileSync(new URL('../render.yaml', import.meta.url), 'utf8');
  assert.match(render, /VITE_CLOUD_PROVIDER/);
  assert.match(render, /VITE_SUPABASE_URL/);
  assert.match(render, /VITE_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(render, /VITE_SUPABASE_ORGANIZATION_ID/);
  assert.doesNotMatch(render, /VITE_SUPABASE_SERVICE_ROLE/);
});

test('env example documents server-only Supabase service role boundary', () => {
  const env = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
  assert.match(env, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(env, /Nunca exponha SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(env, /VITE_SUPABASE_SERVICE_ROLE_KEY/);
});
```

- [ ] **Step 2: Run the test and verify it fails until the server-only boundary is documented**

Run: `node --import tsx tests/supabaseEnvironmentContract.test.ts`

Expected: fails if `.env.example` or `render.yaml` omits the needed Supabase boundary.

- [ ] **Step 3: Update config docs only**

Add `SUPABASE_SERVICE_ROLE_KEY` as a server-only variable in `.env.example` and `render.yaml` with `sync: false`. Keep all public variables as `VITE_SUPABASE_*`.

- [ ] **Step 4: Verify**

Run: `node --import tsx tests/supabaseEnvironmentContract.test.ts`

Expected: pass.

## Task 2: Supabase Server Adapter for Render APIs

**Files:**
- Create: `api/_shared/supabase-admin.js`
- Create: `tests/supabaseAdminApiBoundary.test.ts`
- Modify later tasks to consume this adapter.

**Interfaces:**
- Produces: `getSupabaseAdminClient()`, `requireSupabaseStaffUser(event)`, `jsonResponse(statusCode, payload, extraHeaders?)`, and `enforceSupabaseRateLimit(client, event, bucket, limit, windowSeconds, identity?)`.

- [ ] **Step 1: Write the failing API boundary test**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Supabase admin helper never imports Firebase admin', () => {
  const source = readFileSync(new URL('../api/_shared/supabase-admin.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /firebase-admin|firebase\/admin|getAdminDb|getAdminAuth/);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /getSupabaseAdminClient/);
});
```

- [ ] **Step 2: Run the test and verify it fails because the helper does not exist**

Run: `node --import tsx tests/supabaseAdminApiBoundary.test.ts`

Expected: fails with missing file.

- [ ] **Step 3: Implement the adapter**

Create `api/_shared/supabase-admin.js` using `@supabase/supabase-js` with `SUPABASE_URL` or `VITE_SUPABASE_URL` and server-only `SUPABASE_SERVICE_ROLE_KEY`. Implement JWT verification through `client.auth.getUser(token)` and staff lookup through `organization_members`.

- [ ] **Step 4: Verify**

Run: `node --import tsx tests/supabaseAdminApiBoundary.test.ts`

Expected: pass.

## Task 3: Canonical Snapshot Cutover Safety

**Files:**
- Modify: `src/cloud/cloudSyncGateway.ts`
- Modify: `src/supabase/cloudSync.ts`
- Test: `tests/supabaseCloudProvider.test.ts`
- Test: `tests/cloudConcurrency.test.ts`

**Interfaces:**
- Consumes: `downloadSupabaseBackup()`, `uploadSupabaseBackup(data, knownCloudVersion, baseline)`.
- Produces: Supabase snapshot behavior that matches Firebase conflict semantics before any Firebase removal.

- [ ] **Step 1: Add a regression test for Supabase conflict/deletion preservation**

Add a test beside `tests/cloudConcurrency.test.ts` or extend it so the same `mergeCloudSnapshotsWithBaseline` behavior is asserted for Supabase upload retry paths.

- [ ] **Step 2: Run the focused test**

Run: `node --import tsx tests/cloudConcurrency.test.ts`

Expected: the existing pending case documents the unresolved simultaneous delete/create edge; do not promote Supabase until that case is either fixed or explicitly accepted.

- [ ] **Step 3: Fix conflict handling before canonical cutover**

Update shared merge behavior or Supabase retry flow so soft deletion and simultaneous creation are not regressed. Keep Firebase tests passing.

- [ ] **Step 4: Verify**

Run: `node --import tsx tests/cloudConcurrency.test.ts`

Expected: all active conflict tests pass and the simultaneous delete/create behavior is explicitly resolved.

## Task 4: Supabase Auth as Primary Login

**Files:**
- Modify: `src/auth/authService.ts`
- Modify: `src/firebase.ts` only after Firebase is no longer primary.
- Modify: `src/next/app/organizations/OrganizationContext.tsx`
- Create: `tests/supabasePrimaryAuth.test.ts`

**Interfaces:**
- Produces: `signInWithCorporateEmail` that uses Supabase as the primary credential path when `cloudProvider === 'supabase'`.

- [ ] **Step 1: Write failing source-level auth tests**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('supabase provider path does not require Firebase sign-in before Supabase auth', () => {
  const source = readFileSync(new URL('../src/auth/authService.ts', import.meta.url), 'utf8');
  assert.match(source, /cloudProvider === 'supabase'/);
  assert.match(source, /signInSupabaseBridge/);
  assert.doesNotMatch(source, /const firebaseCredential = await signInWithEmailAndPassword[\s\S]*if \(cloudProvider === 'supabase'\)/);
});
```

- [ ] **Step 2: Run the test and verify current Firebase-first behavior fails**

Run: `node --import tsx tests/supabasePrimaryAuth.test.ts`

Expected: fail while Firebase login is still mandatory first.

- [ ] **Step 3: Implement primary Supabase auth path**

For `cloudProvider === 'supabase'`, call `signInSupabaseBridge` first and return a local session shape used by the app. For `dual-write`, keep Firebase primary and Supabase secondary until migration is complete.

- [ ] **Step 4: Verify**

Run: `node --import tsx tests/supabasePrimaryAuth.test.ts && npm run lint`

Expected: pass.

## Task 5: Public Links on Supabase

**Files:**
- Create: `api/_shared/supabase-public-access.js`
- Modify: `api/public-presenca.js`
- Modify: `api/public-tickets.js`
- Modify: `api/public-materiais.js`
- Create: `tests/publicSupabaseBackend.test.ts`

**Interfaces:**
- Produces: public endpoints that read public configuration from Supabase and write submissions with idempotency and rate limits.

- [ ] **Step 1: Write failing public-backend boundary test**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('public endpoints can route through Supabase helper without Firebase admin dependency', () => {
  const helper = readFileSync(new URL('../api/_shared/supabase-public-access.js', import.meta.url), 'utf8');
  assert.match(helper, /loadPublicPresenceSnapshot/);
  assert.match(helper, /recordPublicSubmission/);
  assert.doesNotMatch(helper, /firebase-admin|getAdminDb/);
});
```

- [ ] **Step 2: Run the test and verify it fails because the helper does not exist**

Run: `node --import tsx tests/publicSupabaseBackend.test.ts`

Expected: fail with missing file.

- [ ] **Step 3: Implement public Supabase helper**

Use Supabase service role only server-side. Preserve token hashing, public token validation, idempotency keys, per-team/IP rate limits, and no-store responses.

- [ ] **Step 4: Migrate one endpoint at a time**

Start with `public-materiais`, then `public-tickets`, then `public-presenca`, because presence has the most history and team-member edge cases.

- [ ] **Step 5: Verify**

Run: `node --import tsx tests/publicPresenceBackend.test.ts && node --import tsx tests/publicPresenceEdit.test.ts && node --import tsx tests/publicPresenceHistory.test.ts`

Expected: pass.

## Task 6: Normalized Domain Cutovers

**Files:**
- Add migrations under `supabase/migrations/`.
- Modify repositories under `src/next/services/repositories/`.
- Modify legacy app data readers only after the domain has a Supabase contract.
- Add tests under `tests/*Repository.test.ts` and reconciliation tests.

**Interfaces:**
- Produces normalized Supabase repositories for the domain being cut over.

- [ ] **Step 1: Cut over organizations/projects/memberships first**

Use existing `organizations`, `organization_members`, and `projects` paths. Confirm RLS and tests in `tests/organizationRepository.test.ts`, `tests/worksiteRepository.test.ts`, and `tests/supabaseMemberships.test.ts`.

- [ ] **Step 2: Cut over cadastros mestres**

Promote `parceiros`, `materiais`, `funcionarios`, `etapas_servico`, and cost-center/project tables only after import reconciliation compares IDs and counts against Firebase/local snapshot.

- [ ] **Step 3: Cut over operational modules in order**

Use this order: frota/parte diária, presença, combustível, tickets, materiais movements, produção/planejamento, anexos/documentos.

- [ ] **Step 4: Verify each domain**

For every domain, run its focused test plus `npm run lint`. Do not advance to the next domain while the current one has unreconciled record counts, missing IDs, or RLS gaps.

## Task 7: Supabase Storage for Attachments

**Files:**
- Create: `src/supabase/storage.ts`
- Modify: `src/services/operationalAttachments.ts`
- Modify: `src/utils/fotoDoCampo.ts`
- Add migration/policies for private buckets.
- Create: `tests/supabaseStorageBoundary.test.ts`

**Interfaces:**
- Produces `uploadOperationalAttachment` and `getOperationalAttachmentUrl` backed by Supabase Storage for Supabase mode.

- [ ] **Step 1: Write failing storage boundary test**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Supabase storage helper keeps attachments behind app authorization', () => {
  const source = readFileSync(new URL('../src/supabase/storage.ts', import.meta.url), 'utf8');
  assert.match(source, /createSignedUrl|upload/);
  assert.doesNotMatch(source, /publicUrl/);
});
```

- [ ] **Step 2: Run the test and verify it fails until helper exists**

Run: `node --import tsx tests/supabaseStorageBoundary.test.ts`

Expected: fail with missing helper.

- [ ] **Step 3: Implement storage helper and policies**

Use private buckets scoped by `organization_id` and signed URLs. Never use public buckets for operational photos, signatures, or documents.

- [ ] **Step 4: Verify**

Run: `node --import tsx tests/supabaseStorageBoundary.test.ts && npm run lint`

Expected: pass.

## Task 8: Remove Firebase Runtime After Canonical Supabase Proof

**Files:**
- Modify: `package.json`
- Modify: `render.yaml`
- Modify: `.env.example`
- Remove or archive: `src/firebase.ts`, `src/firebaseCloudSync.ts`, `src/firebaseStorage.ts`, `src/firebasePublicSubmissions.ts`, `src/firebasePresenceRecovery.ts`, `src/firebaseTickets.ts`, `api/_shared/firebase-admin.js`, `firestore.rules`, `storage.rules`, `firebase.json`, `.firebaserc`, `functions/`.
- Modify tests that intentionally assert Firebase presence.

**Interfaces:**
- Consumes: all prior tasks completed with successful production-like reconciliation.
- Produces: runtime with no Firebase dependency.

- [ ] **Step 1: Write Firebase-removal guard test**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

test('runtime source no longer imports Firebase packages', () => {
  const output = execFileSync('rg', ['-n', 'firebase|Firebase|firestore|Firestore', 'src', 'api', 'server', '--glob', '!node_modules/**'], { encoding: 'utf8' });
  assert.equal(output.trim(), '');
});

test('package no longer ships Firebase runtime dependencies', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.dependencies.firebase, undefined);
  assert.equal(pkg.dependencies['firebase-admin'], undefined);
});
```

- [ ] **Step 2: Run the test and verify it fails while Firebase still exists**

Run: `node --import tsx tests/firebaseRemovalGuard.test.ts`

Expected: fail until final decommission.

- [ ] **Step 3: Remove Firebase only after explicit authorization**

Delete runtime imports, remove env vars, remove dependencies, and adjust tests/docs to Supabase-only semantics.

- [ ] **Step 4: Verify full gate**

Run: `npm run lint && npm test && npm run build && npm run check:bundle`

Expected: pass. Also perform browser validation on local Supabase mode before any deploy.

## Execution Recommendation

Use subagent-driven execution for Tasks 2 through 8. The blast radius is high: auth, public links, sync conflict handling, and attachments all have independent failure modes. Start with Task 1 only as documentation/config hardening, then pause for review before implementing code changes.
