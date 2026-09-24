# Sprint 1 retomada (P0-06 → P0-09) + restauração P0-04 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retomar o sprint 1 a partir de P0-06: badge de pendências offline + retry manual, testes de fronteira de autorização, baseline de performance e suíte de regressão, restaurando antes o fix P0-04 que ficou fora do `main`.

**Architecture:** Sem Context novo e sem dependências novas. Um hook `useOfflineQueueCount` (padrão já usado em `ModoCampoTab.tsx:54-77`) alimenta badge + botão de retry no `DesktopTopBar` e no header mobile; o retry reutiliza `flushOfflineCommands` + `uploadLocalSnapshotToFirebase`. Testes seguem o padrão P0-03 (node:test + inspeção de fonte, sem Firebase).

**Tech Stack:** React 19 + TypeScript, `src/utils/offlineQueue.ts` (IndexedDB/localStorage), node:test via `tsx`, Playwright (só P0-08), `tsc --noEmit` como lint.

**Spec:** `.claude/plans/erp-professionalization-audit-sprint-plan.md` (tarefas P0-06 §151-170, P0-07 §174-190, P0-08 §194-208, P0-09 §212-228; release criteria §232-240)

## Global Constraints

- Dev server `http://localhost:3000` deve permanecer ativo (Vite HMR) — só exigido de fato na P0-08 (Playwright).
- Ambiente: Firebase local isolado, sem dados de produção.
- `npm test` antes de cada commit; caminho crítico deve passar.
- Sem mudanças de stack, sem instalar pacotes, sem migrations, sem redesign, sem rewrite de componente.
- Rollback por tarefa: `git revert` (um commit por tarefa, mensagem referenciando o EV/ID).
- Code review com silent-failure-hunter + code-reviewer após cada tarefa de código.
- Desvio herdado observado (não corrigir neste plano): o sprint está comittando direto no `main` (`main` 7 commits à frente de `origin/main`), embora o plano original pedisse branch isolada. Não reescrever histórico; P0-09 registra isso no checklist.
- Correção de rota do plano: a spec cita `src/components/DesktopTopBar.tsx` e `src/hooks/useSyncContext.ts` — os caminhos reais são `src/app/shell/DesktopTopBar.tsx` e `src/hooks/` **não existe**. Este plano cria `src/hooks/useOfflineQueue.ts` em vez de SyncContext.

---

## Task 0: Restaurar P0-04 no `main` (EV-BUG-004)

**Files:**
- Cherry-pick (sem editar à mão): `netlify/functions/public-presenca.js`, `tests/publicPresenceHistory.test.ts` a partir de `bc9e783` (branch `backup-bad-amend`)
- Verify: `tests/run.ts` (já importa `./publicPresenceHistory.test` na linha 18 — nenhuma edição necessária)

**Interfaces:**
- Consumes: commit `bc9e783` (pai `eeeaf6f`, que já está no `main` — cherry-pick deve aplicar limpo)
- Produces: fallback ordenado em memória (`loadGroupHistory`) + teste `fallback ordena documentos em memoria...` disponíveis para o portão P0-09

**Contexto (por que cherry-pick e não reimplementar):** o `main` não contém o fix — `grep -c "fallback ordena" tests/publicPresenceHistory.test.ts` retorna `0` e `netlify/functions/public-presenca.js:380-385` no `main` chama `indexGroupHistory(snapshot.docs)` sem ordenar. O conteúdo correto está em `git show bc9e783`. Reimplementar à mão arrisca divergir do que já foi revisado; cherry-pick preserva autoria e conteúdo.

- [ ] **Step 1: Confirmar o diagnóstico (prova antes de agir)**

```bash
grep -c "fallback ordena" tests/publicPresenceHistory.test.ts || echo "P0-04 AUSENTE no main"
grep -n "indexGroupHistory(snapshot.docs)" netlify/functions/public-presenca.js
git log --oneline -1 backup-bad-amend
```

Expected: `0` / AUSENTE; linha com `return indexGroupHistory(snapshot.docs);` sem sort; `bc9e783 fix: P0-04 ...`.

- [ ] **Step 2: Cherry-pick sem commitar e inspecionar**

```bash
git cherry-pick --no-commit bc9e783
git status -sb
git diff --cached --stat
```

Expected: 2 arquivos no índice (`netlify/functions/public-presenca.js`, `tests/publicPresenceHistory.test.ts`), nenhum outro. Se houver conflito ou arquivo extra, abortar com `git cherry-pick --abort` e reportar — não resolver na mão.

- [ ] **Step 3: Verificar o conteúdo trazido**

```bash
grep -n "localeCompare" netlify/functions/public-presenca.js
grep -n "fallback ordena" tests/publicPresenceHistory.test.ts
```

Expected: 1 match em cada (sort `dateB.localeCompare(dateA)` + `.slice(0, HISTORY_DOCS_LIMIT)`; teste com `datas` em ordem decrescente).

- [ ] **Step 4: Rodar verificação (lint + testes)**

```bash
npm run lint
npm test 2>&1 | tail -15
```

Expected: `tsc --noEmit` sem erros; suíte `publicPresenceHistory.test` inclusa e passando (inclui o teste de fallback).

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/public-presenca.js tests/publicPresenceHistory.test.ts
git commit -m "fix: P0-04 Presence History Index Fix - restore fallback sort order (EV-BUG-004)

Restaura bc9e783 no main (estava apenas em backup-bad-amend):
fallback ordena em memoria quando indice composto nao existe.

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 1: P0-06 — Offline Queue Recovery (badge + retry)

**Files:**
- Create: `src/hooks/useOfflineQueue.ts` (contagem da fila; ouve `renea-offline-queue-change`, `online`, `offline`; poll 30s — mesmo padrão de `ModoCampoTab.tsx:59-77`)
- Modify: `src/app/shell/DesktopTopBar.tsx:16-35` (props), `:166-174` (área de status — inserir badge após a pill)
- Modify: `src/App.tsx:80` (import do hook), após `:2575` (definir `handleRetryPending` depois de `uploadLocalSnapshotToFirebase`), `:4414-4433` (passar props ao `DesktopTopBar`), `:4336-4342` (mesmo badge no header mobile)
- Create: `tests/p0-06-offline-recovery.test.ts` (5 testes, padrão P0-03)
- Modify: `tests/run.ts` (adicionar `import './p0-06-offline-recovery.test';` após a linha do p0-03)
- Inspect (somente leitura): `src/utils/offlineQueue.ts:56-127`, `preview/main.tsx:120-145` (props novas são opcionais — preview continua compilando sem edição)

**Interfaces:**
- Consumes: `listOfflineCommands()`, `flushOfflineCommands(handlers)` de `src/utils/offlineQueue.ts`; `uploadLocalSnapshotToFirebase()` (`App.tsx:2567-2575`); `addNotification()` (`App.tsx:2522-2544`); evento `renea-offline-queue-change` (disparado em `offlineQueue.ts:91,106`)
- Produces: `useOfflineQueueCount(pollMs?: number): number`; props opcionais `pendingCount?: number; isRetryingPending?: boolean; onRetryPending?: () => void` no `DesktopTopBar`; `handleRetryPending: () => Promise<void>` no `App`

**Decisões trancadas:** (1) hook em vez de SyncContext — `src/hooks/` não existe e nada consome um contexto; hook é YAGNI-mínimo e testável por inspeção. (2) Não tocar em `OfflineStatusV29.tsx` (pill "Sem conexão" continua como está — escopo mínimo). (3) Não editar `tests/critical-path.test.ts` (documento de caracterização P0-01 fica intacto; P0-06 ganha arquivo próprio). (4) `handleRetryPending` definido **após** `uploadLocalSnapshotToFirebase` (linha ~2576) para não usar antes de definir.

- [ ] **Step 1: Escrever o teste que falha (TDD)**

Criar `tests/p0-06-offline-recovery.test.ts` com este conteúdo exato:

```typescript
/**
 * P0-06 Offline Queue Recovery Tests
 *
 * Verifica badge de pendencias + retry manual da fila offline.
 * Padrao P0-03: node:test + inspecao de fonte, sem Firebase.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('[P0-06-01] hook useOfflineQueueCount existe e ouve a fila offline', () => {
  const source = read('../src/hooks/useOfflineQueue.ts');
  assert.match(source, /listOfflineCommands/);
  assert.match(source, /renea-offline-queue-change/);
  assert.match(source, /export function useOfflineQueueCount/);
});

test('[P0-06-02] DesktopTopBar expoe badge de pendencias', () => {
  const source = read('../src/app/shell/DesktopTopBar.tsx');
  assert.match(source, /pendingCount/);
  assert.match(source, /Pendente: \{pendingCount\}|Pendente:/);
});

test('[P0-06-03] DesktopTopBar expoe botao de retry manual', () => {
  const source = read('../src/app/shell/DesktopTopBar.tsx');
  assert.match(source, /onRetryPending/);
  assert.match(source, /Tentar agora/);
});

test('[P0-06-04] App passa contagem e retry ao topbar', () => {
  const source = read('../src/App.tsx');
  assert.match(source, /useOfflineQueueCount/);
  assert.match(source, /handleRetryPending/);
  assert.match(source, /flushOfflineCommands/);
  assert.match(source, /pendingCount=\{[^}]*\}/);
});

test('[P0-06-05] drenagem automatica no online continua existindo', () => {
  const source = read('../src/App.tsx');
  assert.match(source, /window\.addEventListener\('online', flush\)/);
});
```

Registrar em `tests/run.ts`, logo após a linha `import './p0-03-listener-cleanup.test';`:

```typescript
import './p0-06-offline-recovery.test';
```

(atentar ao formato exigido por `scripts/run-tests.mjs`: `import './<nome>.test';` exato — é o regex que descobre as suítes.)

- [ ] **Step 2: Rodar o teste e confirmar falha**

```bash
npx tsx tests/p0-06-offline-recovery.test.ts
```

Expected: FAIL — `useOfflineQueueCount` não definido (arquivo `src/hooks/useOfflineQueue.ts` não existe). Os testes 2–5 também falham (props ainda não existem).

- [ ] **Step 3: Implementação mínima — o hook**

Criar `src/hooks/useOfflineQueue.ts` com este conteúdo exato:

```typescript
import { useEffect, useState } from 'react';
import { listOfflineCommands } from '../utils/offlineQueue';

/**
 * Conta comandos na fila offline (IndexedDB + fallback localStorage).
 * Ouve 'renea-offline-queue-change' (disparado por enqueue/remove),
 * mudanças de conexão e um poll de 30s — mesmo padrão de ModoCampoTab.
 */
export function useOfflineQueueCount(pollMs = 30_000): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      listOfflineCommands()
        .then(commands => { if (active) setCount(commands.length); })
        .catch(() => { if (active) setCount(0); });
    };
    refresh();
    const timer = window.setInterval(refresh, pollMs);
    window.addEventListener('renea-offline-queue-change', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('renea-offline-queue-change', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
    };
  }, [pollMs]);
  return count;
}
```

- [ ] **Step 4: Implementação mínima — `DesktopTopBar` props + badge**

Em `src/app/shell/DesktopTopBar.tsx`, estender a interface (após `lastCloudSync: string;`):

```typescript
pendingCount?: number;
isRetryingPending?: boolean;
onRetryPending?: () => void;
```

Desestruturar as três no componente e inserir após o bloco `erp-topbar__status` (após a linha 174, antes de `<NotificationCenter`):

```tsx
{typeof pendingCount === 'number' && pendingCount > 0 && (
  <div
    className="erp-topbar__pending"
    title={`${pendingCount} pendência(s) offline aguardando envio`}
  >
    <span aria-live="polite">Pendente: {pendingCount}</span>
    {onRetryPending && (
      <button
        type="button"
        onClick={onRetryPending}
        disabled={isRetryingPending}
        aria-label="Tentar enviar pendências agora"
      >
        {isRetryingPending ? 'Enviando…' : 'Tentar agora'}
      </button>
    )}
  </div>
)}
```

Regras: props opcionais (preview/main.tsx compila sem edição); **nenhum estilo inline novo** — reutilizar classes `erp-topbar__*` existentes; `aria-live="polite"` no contador; botão desabilita durante retry.

- [ ] **Step 5: Implementação mínima — `App.tsx` wiring**

a) Import (junto ao import de `offlineQueue`, linha 80):

```typescript
import { useOfflineQueueCount } from './hooks/useOfflineQueue';
```

b) Após `uploadLocalSnapshotToFirebase` (linha ~2576), inserir estado + retry. Posição obrigatória: depois da definição de `uploadLocalSnapshotToFirebase` e de `addNotification` (2522), pois ambos são usados:

```tsx
const pendingCount = useOfflineQueueCount();
const [isRetryingPending, setIsRetryingPending] = useState(false);
const handleRetryPending = useCallback(async () => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  if (isRetryingPending) return;
  setIsRetryingPending(true);
  try {
    const result = await flushOfflineCommands({
      'firebase-backup': async () => {
        const uploadResult = await uploadLocalSnapshotToFirebase();
        if (!uploadResult.success) throw new Error(uploadResult.message);
      },
    });
    if (result.processed > 0) {
      addNotification('Fila offline', `${result.processed} pendência(s) enviada(s).`, 'success', 'Sistema Local');
    } else if (result.failed > 0) {
      addNotification('Fila offline', `${result.failed} pendência(s) falharam; tente de novo.`, 'warning', 'Sistema Local');
    }
  } finally {
    setIsRetryingPending(false);
  }
}, [isRetryingPending, uploadLocalSnapshotToFirebase, addNotification]);
```

Nota: se `uploadLocalSnapshotToFirebase`/`addNotification` não forem estáveis entre renders (não são `useCallback`), incluí-los no array de deps recria o callback — aceitável e correto; **não** converter essas funções em `useCallback` neste plano (fora do escopo, risco de re-render cascade EV-PERF-001).

c) No `<DesktopTopBar` (após `lastCloudSync={lastCloudSync}`, linha 4425):

```tsx
pendingCount={pendingCount}
isRetryingPending={isRetryingPending}
onRetryPending={() => void handleRetryPending()}
```

d) No header mobile (após o bloco `Nuvem OK`/`Sem nuvem`, linhas 4336-4342), inserir o mesmo sinal — versão compacta sem botão (espaço de 4.25rem não comporta ação; o retry fica no desktop + drenagem automática no `online`):

```tsx
{pendingCount > 0 && (
  <span
    className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700"
    title={`${pendingCount} pendência(s) offline aguardando envio`}
    aria-live="polite"
  >
    Pendente: {pendingCount}
  </span>
)}
```

- [ ] **Step 6: Rodar testes e lint**

```bash
npx tsx tests/p0-06-offline-recovery.test.ts
npm run lint
```

Expected: 5/5 PASS; `tsc --noEmit` sem erros. Se o lint reclamar de `pendingCount` não usado no mobile quando `useOfflineQueueCount` estiver fora de escopo de render — não há esse caso: o hook é chamado no corpo do `App`, mesmo escopo do header mobile.

- [ ] **Step 7: Rodar a suíte completa (sem hanging)**

```bash
npm test 2>&1 | tail -20
```

Expected: todas as suítes passam, incluindo `critical-path.test` (P0-01), `p0-03-listener-cleanup.test`, `publicPresenceHistory.test` (P0-04 restaurado) e `p0-06-offline-recovery.test`.

- [ ] **Step 8: Review + commit**

Rodar silent-failure-hunter e code-reviewer no diff. Só então:

```bash
git add src/hooks/useOfflineQueue.ts src/app/shell/DesktopTopBar.tsx src/App.tsx tests/p0-06-offline-recovery.test.ts tests/run.ts
git commit -m "feat: P0-06 offline queue pending badge and manual retry

Badge Pendente:N + Tentar agora no topbar; retry drena via
flushOfflineCommands; contagem reativa ao evento
renea-offline-queue-change.

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 2: P0-07 — Authorization Boundary Tests

**Files:**
- Inspect: `firestore.rules` (raiz), `tests/firestoreRules.test.ts` (padrão existente — estender, não criar arquivo novo se o padrão servir)
- Create (só se o padrão existente não servir): `tests/authorization-boundary.test.ts`
- Modify: `tests/run.ts` (só se criar arquivo novo)

**Interfaces:**
- Consumes: regras em `firestore.rules`; padrão de teste estático já usado em P0-01/P0-03 (sem SDK de regras — `@firebase/rules-unit-testing` **não** está instalado e a constraint proíbe instalar)
- Produces: cobertura dos 3 cenários da spec (§174-190) como testes executáveis

- [ ] **Step 1: Ler as regras e o teste existente**

```bash
grep -n "allow" firestore.rules | head -30
grep -n "test(" tests/firestoreRules.test.ts | head -20
```

Anotar: quais collections exigem role, qual regra cobre `sistemarenea_public_submissions`, se há verificação de `request.auth.token.role` / org.

- [ ] **Step 2: Escrever os 3 testes de fronteira** (no arquivo existente ou novo, seguindo o estilo encontrado no Step 1 — `node:test` + `readFileSync` sobre `firestore.rules`):

1. role A lê collection restrita à role B → regra contém `deny`/ausência de `allow` para esse papel (assert na fonte da regra + comentário com o trecho);
2. token público de presença expirado → acesso negado (assert na regra de `sistemarenea_public_submissions` cobrindo validade/expiração);
3. escrita em org alheia → negada (assert em guarda de organização/ownership).

Cada teste cita o trecho da regra em comentário. Se alguma fronteira **não existir** na regra, o teste falha documentando o gap (mesma filosofia do P0-05: teste válido que expõe ausência) e o commit message marca `gap:` em vez de fingir cobertura.

- [ ] **Step 3: Verificar**

```bash
npx tsx tests/firestoreRules.test.ts
npm run lint
npm test 2>&1 | tail -8
```

Expected: PASS (ou falha documentada de gap — decisão explícita, não acidente).

- [ ] **Step 4: Commit**

```bash
git commit -m "test: P0-07 authorization boundary integration tests"
```

(com corpo listando as 3 fronteiras e eventuais gaps; + `Co-Authored-By: Claude Code <noreply@anthropic.com>`)

---

## Task 3: P0-08 — Performance Baseline

**Files:**
- Create: `tests/e2e/cadastros-perf.spec.ts` (Playwright; mede abrir formulário → preencher → salvar → fechar → reload → confirmar persistência; 3 runs; grava `artifacts/perf-baseline-p0-08.json`)
- Inspect: rota de Cadastros no preview harness (`preview/main.tsx:147-...`, screen `cadastros`) e `tests/e2e/presence-dual-auth.spec.ts` (padrão de spec E2E do repo)

**Interfaces:**
- Consumes: dev server `http://localhost:3000`, screen `cadastros` do preview
- Produces: `artifacts/perf-baseline-p0-08.json` + métricas no corpo do commit (form open alvo <200ms, save <800ms, reload <400ms — alvos da spec §194-208)

- [ ] **Step 1: Escrever a spec** (3 medições com `performance.now()` ao redor de: abrir formulário, salvar, reload + checar `renea_empresas` no localStorage; `expect` só no fluxo funcional — tempos são registrados, não asserted, para não tornar o gate flaky; flaky em CI é pior que baseline informativo).

- [ ] **Step 2: Rodar contra o dev server**

```bash
npx playwright test tests/e2e/cadastros-perf.spec.ts
cat artifacts/perf-baseline-p0-08.json
```

Expected: 3 runs verdes + JSON com medianas. Se `localhost:3000` estiver fora do ar, subir com `npm run dev` primeiro (constraint global).

- [ ] **Step 3: Commit com as métricas no corpo**

```bash
git commit -m "perf: P0-08 CadastrosTab workflow baseline (form: XXms, save: XXms, reload: XXms)"
```

(substituir XX pelas medianas reais do JSON; anexar o JSON no commit; + `Co-Authored-By: Claude Code <noreply@anthropic.com>`)

---

## Task 4: P0-09 — Critical-Path Regression Suite + Release Checklist

**Files:**
- Modify: `package.json` (adicionar `"test:critical-path:all": "npm run lint && npm test && npm run build"`)
- Create: `docs/superpowers/plans/2026-09-16-sprint-1-release-checklist.md` (ou seção no ledger `.claude/plans/workspace/progress.md` — escolher um, não duplicar)
- Verify: P0-05 E2E continua como falha documentada/bloqueador P1 (não "consertar" na P0-09)

**Interfaces:**
- Consumes: suítes P0-01, P0-03, P0-04, P0-06, P0-07; E2E P0-05; baseline P0-08
- Produces: gate único executável + checklist de release (spec §232-240)

- [ ] **Step 1: Adicionar o script gate**

```json
"test:critical-path:all": "npm run lint && npm test && npm run build"
```

- [ ] **Step 2: Rodar o gate completo e registrar evidência**

```bash
npm run test:critical-path:all 2>&1 | tail -25
```

Expected: lint 0 erros; `npm test` verde; `vite build` verde. P0-05 E2E **não** entra no gate automático (é documentador de blocker P1; rodar separado com `npx playwright test tests/e2e/presence-dual-auth.spec.ts` e anexar saída ao checklist).

- [ ] **Step 3: Preencher o checklist** (zero console errors, zero unhandled exceptions, sequência de network correta, walkthrough manual do caminho crítico, rollback `git revert` por tarefa, baseline P0-08 registrada, desvio "commits direto no main" declarado, P0-05 listado como blocker P1 esperado).

- [ ] **Step 4: Commit**

```bash
git commit -m "test: P0-09 critical-path regression gate ready for merge"
```

- [ ] **Step 5: Atualizar o ledger** (`.claude/plans/workspace/progress.md` — marcar P0-04 restaurado e P0-06→P0-09 completos, com os hashes dos commits).

---

## Ordem de execução e dependências

1. Task 0 (P0-04) primeiro — o portão P0-09 precisa dela; é cherry-pick de 2 arquivos, risco mínimo.
2. Task 1 (P0-06) em seguida — commit separado.
3. Task 2 (P0-07) e Task 3 (P0-08) independentes entre si — podem rodar em paralelo após P0-06.
4. Task 4 (P0-09) por último — consome todas.

## Riscos e rollback

- Cherry-pick sujo (Task 0): `git cherry-pick --abort`, reportar, não resolver na mão.
- `tsc` quebrar em `App.tsx` (Task 1): causa provável é posição do `handleRetryPending` antes das definições que ele usa — mover para após `uploadLocalSnapshotToFirebase`.
- E2E P0-05 "falhando" no gate (Task 4): comportamento esperado e documentado — não é regressão; manter fora do gate automático.
- Rollback universal: `git revert <hash-da-tarefa>` (um commit por tarefa, nunca amend em histórico compartilhado).
