# Reconstrução do Cadastro (RegistryScreen) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir `src/components/CadastrosTab.tsx` (1725 linhas, 1 componente, 48 `useState`, 0 `useMemo`) por um componente de registro genérico (`RegistryScreen`) configurável por categoria, cobrindo as 10 categorias hoje na tela (empresas, fornecedores, terceiras, obras, equipamentos, veículos, colaboradores, comboios, combustíveis, lubrificantes, etapas) numa única entrega.

**Architecture:** Um motor genérico (`useRegistryState` + `duplicateDetection` + `RegistryScreen`) recebe uma `RegistryConfig<T>` por categoria (campos, colunas, chave operacional, modo de duplicidade) e renderiza cabeçalho, cards de resumo, filtro, tabela paginada com edição inline, lançamento em lote e exclusão. `CadastrosTab.tsx` vira um orquestrador fino que escolhe a config pela sub-aba ativa. Nenhum contrato entre `App.tsx` e a tela muda.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, `node:test` (via `tests/run.ts`), lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-22-cadastro-registry-rebuild-design.md`

## Global Constraints

- Nenhuma dependência nova, nenhuma mudança de framework.
- `App.tsx` continua chamando os mesmos handlers (`onSaveEmpresa`, `onDeleteEquipamento`, etc.) com a mesma assinatura de hoje.
- Ausência de campo nunca vira valor inventado (zero, data, status) — ver `AGENTS.md`.
- Duplicidade nunca funde ou apaga registro sozinha: `bloqueia` impede salvar um **novo** registro com a mesma chave; `avisa` só mostra aviso.
- `operationalKey` retorna `undefined` quando a chave está incompleta — nunca conta como duplicata.
- Guard de "nome de pessoa" (`src/utils/equipmentOperations.ts`) continua valendo para Equipamentos.
- `npx tsx tests/run.ts`, `npx tsc --noEmit` e `npm run build` devem passar antes de qualquer commit que feche uma tarefa.

---

## Task 1: Tipos e contratos do registro genérico

**Files:**
- Create: `src/shared/registry/registryTypes.ts`
- Test: `tests/registryTypes.test.ts`

**Interfaces:**
- Produces: `RegistryFieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox'`; `RegistryField<T>` (`key: keyof T & string`, `label: string`, `type: RegistryFieldType`, `required?: boolean`, `options?: readonly string[]`, `searchable?: boolean`, `quickEdit?: boolean`, `placeholder?: string`); `DuplicateMode = 'bloqueia' | 'avisa'`; `RegistryConfig<T extends { id: string }>` (`key: string`, `label: string`, `idPrefix: string`, `fields: readonly RegistryField<T>[]`, `operationalKey: (item: T) => string | undefined`, `duplicateMode: DuplicateMode`, `subFilter?: (item: T) => boolean`, `extraValidation?: (item: T) => string | undefined`, `emptyItem: () => Omit<T, 'id'>`); `buildEmptyDraft<T>(config: RegistryConfig<T>): Omit<T, 'id'>` (helper que só chama `config.emptyItem()`, existe para ter algo testável nesta tarefa sem depender de React).

- [ ] **Step 1: Write the failing test**

```ts
// tests/registryTypes.test.ts
import assert from 'node:assert/strict';
import { buildEmptyDraft, type RegistryConfig } from '../src/shared/registry/registryTypes';

type Exemplo = { id: string; nome: string; ativo: boolean };

const config: RegistryConfig<Exemplo> = {
  key: 'exemplos',
  label: 'Exemplos',
  idPrefix: 'EX',
  fields: [
    { key: 'nome', label: 'Nome', type: 'text', required: true, searchable: true },
    { key: 'ativo', label: 'Ativo', type: 'checkbox' },
  ],
  operationalKey: item => item.nome.trim().toLowerCase() || undefined,
  duplicateMode: 'avisa',
  emptyItem: () => ({ nome: '', ativo: true }),
};

assert.deepEqual(buildEmptyDraft(config), { nome: '', ativo: true });
assert.equal(config.operationalKey({ id: '1', nome: '', ativo: true }), undefined, 'chave vazia nunca é uma chave real');
assert.equal(config.operationalKey({ id: '1', nome: 'ACME', ativo: true }), 'acme');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/registryTypes.test.ts`
Expected: FAIL — `Cannot find module '../src/shared/registry/registryTypes'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/shared/registry/registryTypes.ts
export type RegistryFieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox';

export interface RegistryField<T> {
  readonly key: keyof T & string;
  readonly label: string;
  readonly type: RegistryFieldType;
  readonly required?: boolean;
  /** Só para type: 'select'. */
  readonly options?: readonly string[];
  /** Entra na busca textual da tela. */
  readonly searchable?: boolean;
  /** Editável direto na linha da tabela, sem abrir o formulário completo. */
  readonly quickEdit?: boolean;
  readonly placeholder?: string;
}

export type DuplicateMode = 'bloqueia' | 'avisa';

export interface RegistryConfig<T extends { id: string }> {
  readonly key: string;
  readonly label: string;
  readonly idPrefix: string;
  readonly fields: readonly RegistryField<T>[];
  /** Chave que identifica "isto é o mesmo registro do mundo real".
   *  Retorna undefined quando a chave está incompleta — nunca inventa. */
  readonly operationalKey: (item: T) => string | undefined;
  readonly duplicateMode: DuplicateMode;
  /** Para categorias que compartilham o mesmo cadastro (Empresa/Equipamento)
   *  filtradas por tipo, em vez de terem tabela própria. */
  readonly subFilter?: (item: T) => boolean;
  /** Validação extra além dos `required` dos fields (ex.: guard de nome de
   *  pessoa em Equipamentos). Retorna a mensagem de erro, ou undefined. */
  readonly extraValidation?: (item: T) => string | undefined;
  readonly emptyItem: () => Omit<T, 'id'>;
}

export const buildEmptyDraft = <T extends { id: string }>(config: RegistryConfig<T>): Omit<T, 'id'> =>
  config.emptyItem();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/registryTypes.test.ts`
Expected: PASS (sem saída, exit code 0)

- [ ] **Step 5: Register in the test runner and commit**

Add `import './registryTypes.test';` to `tests/run.ts` (mesmo padrão das linhas existentes).

```bash
git add src/shared/registry/registryTypes.ts tests/registryTypes.test.ts tests/run.ts
git commit -m "feat(registry): tipos e contrato de RegistryConfig"
```

---

## Task 2: Detecção de duplicidade

**Files:**
- Create: `src/shared/registry/duplicateDetection.ts`
- Test: `tests/duplicateDetection.test.ts`

**Interfaces:**
- Consumes: nenhuma (só tipos primitivos + a assinatura `operationalKey` de `RegistryConfig`, sem importar o tipo).
- Produces: `findDuplicateGroups<T>(items: readonly T[], operationalKey: (item: T) => string | undefined): ReadonlyMap<string, T[]>`; `countDuplicates<T>(items: readonly T[], operationalKey: (item: T) => string | undefined): number` (soma de itens em grupos com mais de 1 membro); `isDuplicateOfExisting<T>(candidate: T, existing: readonly T[], operationalKey: (item: T) => string | undefined): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/duplicateDetection.test.ts
import assert from 'node:assert/strict';
import { countDuplicates, findDuplicateGroups, isDuplicateOfExisting } from '../src/shared/registry/duplicateDetection';

type Item = { id: string; chave: string | null };
const key = (item: Item) => item.chave || undefined;

const items: Item[] = [
  { id: '1', chave: 'abc' },
  { id: '2', chave: 'abc' },
  { id: '3', chave: 'xyz' },
  { id: '4', chave: null },
  { id: '5', chave: null },
];

const groups = findDuplicateGroups(items, key);
assert.equal(groups.get('abc')?.length, 2);
assert.equal(groups.get('xyz')?.length, 1);
assert.equal(groups.has(''), false, 'chave vazia nunca vira grupo');

assert.equal(countDuplicates(items, key), 2, 'só os 2 itens de "abc" contam — chave ausente nunca conta');

assert.equal(isDuplicateOfExisting({ id: '9', chave: 'abc' }, items, key), true);
assert.equal(isDuplicateOfExisting({ id: '9', chave: 'novo' }, items, key), false);
assert.equal(isDuplicateOfExisting({ id: '9', chave: null }, items, key), false, 'candidato sem chave nunca é duplicata');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/duplicateDetection.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Write minimal implementation**

```ts
// src/shared/registry/duplicateDetection.ts
export const findDuplicateGroups = <T,>(
  items: readonly T[],
  operationalKey: (item: T) => string | undefined,
): ReadonlyMap<string, T[]> => {
  const groups = new Map<string, T[]>();
  items.forEach(item => {
    const key = operationalKey(item);
    if (!key) return;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  });
  return groups;
};

export const countDuplicates = <T,>(
  items: readonly T[],
  operationalKey: (item: T) => string | undefined,
): number => {
  let total = 0;
  findDuplicateGroups(items, operationalKey).forEach(group => {
    if (group.length > 1) total += group.length;
  });
  return total;
};

export const isDuplicateOfExisting = <T,>(
  candidate: T,
  existing: readonly T[],
  operationalKey: (item: T) => string | undefined,
): boolean => {
  const key = operationalKey(candidate);
  if (!key) return false;
  return existing.some(item => operationalKey(item) === key);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/duplicateDetection.test.ts`
Expected: PASS

- [ ] **Step 5: Register and commit**

Add `import './duplicateDetection.test';` to `tests/run.ts`.

```bash
git add src/shared/registry/duplicateDetection.ts tests/duplicateDetection.test.ts tests/run.ts
git commit -m "feat(registry): deteccao de duplicidade por chave operacional"
```

---

## Task 3: Hook de estado do registro (`useRegistryState`)

**Files:**
- Create: `src/shared/registry/useRegistryState.ts`
- Test: `tests/useRegistryState.test.ts` (testa a função pura interna, não o hook em si — ver Step 1)

**Interfaces:**
- Consumes: `RegistryConfig<T>` (Task 1), `countDuplicates`/`findDuplicateGroups` (Task 2).
- Produces: `computeRegistryView<T>(items: readonly T[], config: RegistryConfig<T>, search: string, selectFilters: Readonly<Record<string, string>>, page: number, pageSize: number): { scoped: T[]; filtered: T[]; paged: T[]; totalPages: number; duplicateCount: number }` (função pura, testável sem React); `useRegistryState<T>(items: readonly T[], config: RegistryConfig<T>)` (hook que usa `useState`/`useMemo` chamando `computeRegistryView`, consumido só pela Task 5).

Separar a lógica em uma função pura (`computeRegistryView`) e um hook fino por cima é o que permite testar a parte que mais importa (filtro + duplicidade) sem montar componente nenhum.

- [ ] **Step 1: Write the failing test**

```ts
// tests/useRegistryState.test.ts
import assert from 'node:assert/strict';
import { computeRegistryView } from '../src/shared/registry/useRegistryState';
import type { RegistryConfig } from '../src/shared/registry/registryTypes';

type Pessoa = { id: string; nome: string; cargo: string; ativo: boolean };

const config: RegistryConfig<Pessoa> = {
  key: 'pessoas',
  label: 'Pessoas',
  idPrefix: 'PES',
  fields: [
    { key: 'nome', label: 'Nome', type: 'text', required: true, searchable: true },
    { key: 'cargo', label: 'Cargo', type: 'text', searchable: true },
  ],
  operationalKey: item => item.nome.trim().toLowerCase() || undefined,
  duplicateMode: 'avisa',
  emptyItem: () => ({ nome: '', cargo: '', ativo: true }),
};

const items: Pessoa[] = [
  { id: '1', nome: 'Ana Souza', cargo: 'Encarregada', ativo: true },
  { id: '2', nome: 'Bruno Lima', cargo: 'Operador', ativo: true },
  { id: '3', nome: 'ana souza', cargo: 'Encarregada', ativo: false }, // mesma chave normalizada de "Ana Souza"
];

const view = computeRegistryView(items, config, 'souza', {}, 1, 50);
assert.equal(view.filtered.length, 2, 'busca por "souza" acha os dois registros de Ana');
assert.equal(view.duplicateCount, 2, 'os dois "Ana Souza" contam como duplicata pela chave operacional');

const paged = computeRegistryView(items, config, '', {}, 1, 2);
assert.equal(paged.paged.length, 2);
assert.equal(paged.totalPages, 2, '3 itens com pageSize 2 dá 2 páginas');

const withSubFilter = computeRegistryView(items, { ...config, subFilter: item => item.ativo }, '', {}, 1, 50);
assert.equal(withSubFilter.scoped.length, 2, 'subFilter tira os inativos antes de filtrar/paginar');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/useRegistryState.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Write minimal implementation**

```ts
// src/shared/registry/useRegistryState.ts
import { useMemo, useState } from 'react';
import type { RegistryConfig } from './registryTypes';
import { countDuplicates } from './duplicateDetection';

export const computeRegistryView = <T extends { id: string }>(
  items: readonly T[],
  config: RegistryConfig<T>,
  search: string,
  selectFilters: Readonly<Record<string, string>>,
  page: number,
  pageSize: number,
) => {
  const scoped = config.subFilter ? items.filter(config.subFilter) : [...items];

  const term = search.trim().toLowerCase();
  const filtered = scoped.filter(item => {
    for (const fieldKey of Object.keys(selectFilters)) {
      const value = selectFilters[fieldKey];
      if (!value || value === 'todos') continue;
      if (String((item as Record<string, unknown>)[fieldKey] ?? '') !== value) return false;
    }
    if (!term) return true;
    return config.fields.some(field =>
      field.searchable && String((item as Record<string, unknown>)[field.key] ?? '').toLowerCase().includes(term));
  });

  const duplicateCount = countDuplicates(scoped, config.operationalKey);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return { scoped, filtered, paged, totalPages, duplicateCount };
};

const PAGE_SIZE = 50;

export const useRegistryState = <T extends { id: string }>(items: readonly T[], config: RegistryConfig<T>) => {
  const [search, setSearch] = useState('');
  const [selectFilters, setSelectFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

  const view = useMemo(
    () => computeRegistryView(items, config, search, selectFilters, page, PAGE_SIZE),
    [items, config, search, selectFilters, page],
  );

  return { ...view, search, setSearch, selectFilters, setSelectFilters, page, setPage };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/useRegistryState.test.ts`
Expected: PASS

- [ ] **Step 5: Register and commit**

Add `import './useRegistryState.test';` to `tests/run.ts`.

```bash
git add src/shared/registry/useRegistryState.ts tests/useRegistryState.test.ts tests/run.ts
git commit -m "feat(registry): hook de filtro/paginacao/duplicidade generico"
```

---

## Task 4: Corrigir `PageHeader` (título/descrição visíveis)

**Files:**
- Modify: `src/shared/ui/PageHeader.tsx:17`
- Test: `tests/pageHeaderVisibility.test.ts`

**Interfaces:**
- Consumes: nada novo.
- Produces: mesma API pública de `PageHeader` (`title`, `description`, `actions`, `className`, `eyebrow`) — só o CSS interno muda.

O CSS de `src/index.css` (`.renea-page-header h1`, `.renea-page-header__copy > p`, `.renea-page-header__eyebrow`) já estiliza esses elementos para aparecer — só a classe `sr-only` no wrapper os esconde. Este é o único ponto de mudança.

- [ ] **Step 1: Write the failing test**

```ts
// tests/pageHeaderVisibility.test.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/shared/ui/PageHeader.tsx', import.meta.url), 'utf8');
assert.doesNotMatch(
  source,
  /renea-page-header__copy sr-only/,
  'título e descrição do módulo precisam ficar visíveis, não só para leitor de tela',
);
assert.match(source, /renea-page-header__copy/, 'a classe de estilo continua existindo, só sem sr-only');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/pageHeaderVisibility.test.ts`
Expected: FAIL — a asserção `doesNotMatch` falha porque `sr-only` ainda está lá

- [ ] **Step 3: Write minimal implementation**

Em `src/shared/ui/PageHeader.tsx:17`, trocar:

```tsx
<div className="renea-page-header__copy sr-only">
```

por:

```tsx
<div className="renea-page-header__copy">
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/pageHeaderVisibility.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full suite (this touches ~40 screens) and commit**

Run: `npx tsx tests/run.ts` — nenhum teste deve quebrar (nenhum teste existente hoje afirma que o título fica oculto; se algum afirmar, é ele que está desatualizado, não este conserto).

Run: `npm run build` — confirmar que compila.

```bash
git add src/shared/ui/PageHeader.tsx tests/pageHeaderVisibility.test.ts tests/run.ts
git commit -m "fix(ui): titulo e descricao do PageHeader deixam de ser sr-only"
```

---

## Task 5: Componente `RegistryScreen`

**Files:**
- Create: `src/shared/registry/RegistryScreen.tsx`
- Test: `tests/registryScreenUi.test.ts` (teste de fonte, no mesmo espírito de `tests/materiaisImportUi.test.ts` — confirma que os blocos certos existem no arquivo, sem precisar de ambiente de DOM)

**Interfaces:**
- Consumes: `RegistryConfig<T>`, `RegistryField<T>` (Task 1); `useRegistryState` (Task 3); `isDuplicateOfExisting` (Task 2); `PageHeader`, `Modal`, `TableShell`, `TableHead`, `TableBody`, `Pagination`, `EmptyState`, `Badge`, `ConfirmDialog` de `src/shared/ui`.
- Produces: `export default function RegistryScreen<T extends { id: string }>(props: { config: RegistryConfig<T>; items: readonly T[]; onSave: (item: T, isNew: boolean, onError?: (err: Error) => void) => void; onDelete: (id: string) => void; }): JSX.Element` — consumido pela Task 12 (`CadastrosTab.tsx`).

**Contexto de reaproveitamento:** `Modal` (`src/shared/ui/Modal.tsx`) já resolve foco preso/ESC/Ctrl+Enter — o formulário completo usa ele. `TableShell`/`TableHead`/`TableBody` (`src/shared/ui/TableShell.tsx`) já resolvem a rolagem horizontal com head fixo. `ConfirmDialog` já existe para a confirmação de exclusão — troca o `<div className="fixed inset-0 bg-white ...">` artesanal do Cadastro atual.

- [ ] **Step 1: Write the failing test**

```ts
// tests/registryScreenUi.test.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/shared/registry/RegistryScreen.tsx', import.meta.url), 'utf8');
assert.match(source, /useRegistryState/, 'usa o hook genérico de filtro/paginação/duplicidade');
assert.match(source, /from '..\/ui'/, 'reaproveita o kit de UI compartilhado (Modal, TableShell, etc.)');
assert.match(source, /ConfirmDialog/, 'usa o diálogo de confirmação compartilhado, não um overlay artesanal');
assert.match(source, /Pagination/, 'toda categoria pagina, não só uma');
assert.match(source, /Adicionar linha/i, 'tem o modo de lançamento em lote');
assert.match(source, /duplicateCount|duplicad/i, 'mostra a contagem de possíveis duplicados no cabeçalho');
assert.doesNotMatch(source, /from ['"](?:firebase|@supabase)/, 'não pode importar SDK de nuvem');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/registryScreenUi.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/shared/registry/RegistryScreen.tsx
import { useState } from 'react';
import { Plus, Search, Trash2, Edit } from 'lucide-react';
import { PageHeader, Modal, TableShell, TableHead, TableBody, Pagination, EmptyState, Badge, ConfirmDialog } from '../ui';
import type { RegistryConfig, RegistryField } from './registryTypes';
import { useRegistryState } from './useRegistryState';
import { isDuplicateOfExisting } from './duplicateDetection';

interface Props<T extends { id: string }> {
  config: RegistryConfig<T>;
  items: readonly T[];
  onSave: (item: T, isNew: boolean, onError?: (err: Error) => void) => void;
  onDelete: (id: string) => void;
}

const inputClass = 'w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500';

const fieldValue = (item: Record<string, unknown>, field: RegistryField<unknown>) => item[field.key] ?? (field.type === 'checkbox' ? false : field.type === 'number' ? 0 : '');

const FieldInput = <T,>({ field, value, onChange }: { field: RegistryField<T>; value: unknown; onChange: (value: unknown) => void }) => {
  if (field.type === 'checkbox') {
    return <input type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} className="h-4 w-4" />;
  }
  if (field.type === 'select') {
    return (
      <select value={String(value ?? '')} onChange={e => onChange(e.target.value)} className={inputClass}>
        <option value="">Selecione…</option>
        {(field.options || []).map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  }
  return (
    <input
      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
      value={value == null ? '' : String(value)}
      placeholder={field.placeholder}
      onChange={e => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)}
      className={inputClass}
      required={field.required}
    />
  );
};

export default function RegistryScreen<T extends { id: string }>({ config, items, onSave, onDelete }: Props<T>) {
  const state = useRegistryState(items, config);
  const [editing, setEditing] = useState<T | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formDraft, setFormDraft] = useState<Record<string, unknown>>({});
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [batchDrafts, setBatchDrafts] = useState<Record<string, unknown>[] | null>(null);
  const [batchErrors, setBatchErrors] = useState<Record<number, string>>({});

  const openNew = () => { setEditing(null); setFormDraft({ ...config.emptyItem() }); setFormError(''); setFormOpen(true); };
  const openEdit = (item: T) => { setEditing(item); setFormDraft({ ...item }); setFormError(''); setFormOpen(true); };

  const validate = (draft: Record<string, unknown>, ignoreId?: string): string | undefined => {
    for (const field of config.fields) {
      if (field.required && !fieldValue(draft, field)) return `${field.label} é obrigatório.`;
    }
    const candidate = draft as T;
    const others = state.scoped.filter(item => item.id !== ignoreId);
    if (isDuplicateOfExisting(candidate, others, config.operationalKey)) {
      if (config.duplicateMode === 'bloqueia') return `Já existe um registro com a mesma chave (${config.operationalKey(candidate)}).`;
    }
    return config.extraValidation?.(candidate);
  };

  const submitForm = (event: React.FormEvent) => {
    event.preventDefault();
    const error = validate(formDraft, editing?.id);
    if (error) { setFormError(error); return; }
    const isNew = !editing;
    const id = editing?.id ?? `${config.idPrefix}-${Date.now()}`;
    onSave({ ...(formDraft as T), id }, isNew, err => setFormError(err.message));
    setFormOpen(false);
  };

  const startBatch = () => { setBatchDrafts([{ ...config.emptyItem() }]); setBatchErrors({}); };
  const addBatchRow = () => setBatchDrafts(current => [...(current || []), { ...config.emptyItem() }]);
  const updateBatchRow = (index: number, key: string, value: unknown) =>
    setBatchDrafts(current => (current || []).map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  const saveBatch = () => {
    const drafts = batchDrafts || [];
    const nextErrors: Record<number, string> = {};
    const stillOpen: Record<string, unknown>[] = [];
    drafts.forEach((draft, index) => {
      const hasAnyValue = config.fields.some(field => fieldValue(draft, field));
      if (!hasAnyValue) return; // linha em branco não preenchida: ignora, não é erro
      const error = validate(draft);
      if (error) { nextErrors[stillOpen.length] = error; stillOpen.push(draft); return; }
      onSave({ ...(draft as T), id: `${config.idPrefix}-${Date.now()}-${index}` }, true);
    });
    setBatchErrors(nextErrors);
    setBatchDrafts(stillOpen.length > 0 ? stillOpen : null);
  };

  const columns = config.fields.filter(field => field.type !== 'checkbox' || field.quickEdit);

  return (
    <div className="space-y-4">
      <PageHeader
        title={config.label}
        description={`${state.filtered.length} registro(s)${state.duplicateCount > 0 ? ` · ${state.duplicateCount} em possível duplicidade` : ''}`}
        actions={<button type="button" onClick={openNew} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-xs font-black text-white"><Plus className="h-4 w-4" /> Novo</button>}
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[9px] font-black uppercase text-slate-500">Total</p><strong className="text-xl text-slate-800">{state.scoped.length}</strong></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[9px] font-black uppercase text-slate-500">Filtrados</p><strong className="text-xl text-slate-800">{state.filtered.length}</strong></div>
        <div className={`rounded-xl border p-3 ${state.duplicateCount > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}><p className="text-[9px] font-black uppercase text-slate-500">Possíveis duplicados</p><strong className="text-xl text-slate-800">{state.duplicateCount}</strong></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[9px] font-black uppercase text-slate-500">Página</p><strong className="text-xl text-slate-800">{state.page}/{state.totalPages}</strong></div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input value={state.search} onChange={e => { state.setSearch(e.target.value); state.setPage(1); }} placeholder="Buscar" className={`${inputClass} pl-8`} />
        </label>
        <button type="button" onClick={startBatch} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700">Adicionar linhas</button>
      </div>

      {batchDrafts && (
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
          {batchDrafts.map((draft, index) => (
            <div key={index} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-2 sm:grid-cols-4">
              {config.fields.map(field => (
                <FieldInput key={field.key} field={field} value={fieldValue(draft, field)} onChange={value => updateBatchRow(index, field.key, value)} />
              ))}
              {batchErrors[index] && <p className="sm:col-span-4 text-[10px] font-bold text-rose-600">{batchErrors[index]}</p>}
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setBatchDrafts(null)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700">Cancelar</button>
            <button type="button" onClick={addBatchRow} className="rounded-md border border-emerald-500 bg-white px-4 py-2 text-xs font-black text-emerald-700">+ linha</button>
            <button type="button" onClick={saveBatch} className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-black text-white">Salvar todas</button>
          </div>
        </div>
      )}

      <TableShell>
        <TableHead>
          <tr>
            {columns.map(field => <th key={field.key} className="py-3 px-4 text-left">{field.label}</th>)}
            <th className="py-3 px-4 text-right">Ações</th>
          </tr>
        </TableHead>
        <TableBody>
          {state.paged.length === 0 ? (
            <tr><td colSpan={columns.length + 1}><EmptyState title="Nenhum registro encontrado" /></td></tr>
          ) : state.paged.map(item => (
            <tr key={item.id} className="border-b border-slate-100">
              {columns.map(field => (
                <td key={field.key} className="py-2 px-4">
                  {field.quickEdit
                    ? <FieldInput field={field} value={fieldValue(item as Record<string, unknown>, field)} onChange={value => onSave({ ...item, [field.key]: value }, false)} />
                    : field.type === 'checkbox'
                      ? <Badge tone={fieldValue(item as Record<string, unknown>, field) ? 'success' : 'neutral'}>{fieldValue(item as Record<string, unknown>, field) ? 'Sim' : 'Não'}</Badge>
                      : String(fieldValue(item as Record<string, unknown>, field) ?? '—')}
                </td>
              ))}
              <td className="py-2 px-4 text-right">
                <button type="button" onClick={() => openEdit(item)} className="mr-2 text-slate-500 hover:text-emerald-700"><Edit className="h-4 w-4" /></button>
                <button type="button" onClick={() => setDeleteId(item.id)} className="text-slate-500 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </td>
            </tr>
          ))}
        </TableBody>
      </TableShell>

      <Pagination page={state.page} totalPages={state.totalPages} onChange={state.setPage} />

      <Modal open={formOpen} title={editing ? `Editar ${config.label}` : `Novo em ${config.label}`} onClose={() => setFormOpen(false)} onSubmit={submitForm}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {config.fields.map(field => (
            <label key={field.key} className="space-y-1 text-xxs font-bold uppercase tracking-wider text-slate-400">
              {field.label}{field.required ? ' *' : ''}
              <FieldInput field={field} value={fieldValue(formDraft, field)} onChange={value => setFormDraft(current => ({ ...current, [field.key]: value }))} />
            </label>
          ))}
        </div>
        {formError && <p className="mt-2 text-xs font-bold text-rose-600">{formError}</p>}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Excluir registro"
        description="Esta ação não pode ser desfeita."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) onDelete(deleteId); setDeleteId(null); }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/registryScreenUi.test.ts`
Expected: PASS

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit`. Se `Modal`/`ConfirmDialog`/`Badge`/`TableHead`/`TableBody` tiverem props com nomes diferentes dos usados acima, ajuste as chamadas para bater com a API real desses componentes em `src/shared/ui` (não renomeie os componentes compartilhados).

Add `import './registryScreenUi.test';` to `tests/run.ts`.

```bash
git add src/shared/registry/RegistryScreen.tsx tests/registryScreenUi.test.ts tests/run.ts
git commit -m "feat(registry): componente RegistryScreen generico"
```

---

## Task 6: Config de Empresas / Fornecedores / Terceiras

**Files:**
- Create: `src/registryConfigs/empresaConfig.ts`
- Test: `tests/empresaRegistryConfig.test.ts`

**Interfaces:**
- Consumes: `RegistryConfig` (Task 1); `Empresa` (`src/types.ts`); `isSupplier`, `isThirdPartyContractor` (`src/masterData/centralRegistry.ts`, já existem).
- Produces: `empresaConfig`, `fornecedorConfig`, `terceiraConfig: RegistryConfig<Empresa>` (três configs sobre o mesmo tipo, cada um com seu `subFilter`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/empresaRegistryConfig.test.ts
import assert from 'node:assert/strict';
import { empresaConfig, fornecedorConfig, terceiraConfig } from '../src/registryConfigs/empresaConfig';
import type { Empresa } from '../src/types';

const fornecedor: Empresa = { id: '1', nome: 'Pedraforte', cnpj: '11222333000144', telefone: '', responsavel: '', tipos: ['FORNECEDOR'] };
const terceira: Empresa = { id: '2', nome: 'Tecnogeo', cnpj: '55666777000188', telefone: '', responsavel: '', tipos: ['TERCEIRA'] };

assert.equal(fornecedorConfig.subFilter?.(fornecedor), true);
assert.equal(fornecedorConfig.subFilter?.(terceira), false);
assert.equal(terceiraConfig.subFilter?.(terceira), true);
assert.equal(terceiraConfig.subFilter?.(fornecedor), false);
assert.equal(empresaConfig.subFilter, undefined, 'Empresas mostra tudo, sem filtro de tipo');

assert.equal(empresaConfig.operationalKey(fornecedor), '11222333000144', 'CNPJ normalizado só com dígitos');
assert.equal(empresaConfig.operationalKey({ ...fornecedor, cnpj: '11.222.333/0001-44' }), '11222333000144', 'pontuação do CNPJ não muda a chave');
assert.equal(empresaConfig.operationalKey({ ...fornecedor, cnpj: '' }), undefined, 'CNPJ vazio nunca é chave');
assert.equal(empresaConfig.duplicateMode, 'bloqueia');

const fieldKeys = empresaConfig.fields.map(field => field.key);
assert.ok(fieldKeys.includes('nome'));
assert.ok(fieldKeys.includes('cnpj'));
assert.deepEqual(empresaConfig.emptyItem(), { nome: '', cnpj: '', telefone: '', responsavel: '', tipos: ['EMPRESA'] });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/empresaRegistryConfig.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Write minimal implementation**

```ts
// src/registryConfigs/empresaConfig.ts
import type { Empresa } from '../types';
import type { RegistryConfig } from '../shared/registry/registryTypes';
import { isSupplier, isThirdPartyContractor } from '../masterData/centralRegistry';

const normalizeCnpj = (value: string) => value.replace(/\D/g, '');

const baseFields: RegistryConfig<Empresa>['fields'] = [
  { key: 'nome', label: 'Nome Fantasia / Razão Social', type: 'text', required: true, searchable: true },
  { key: 'cnpj', label: 'CNPJ', type: 'text', required: true, searchable: true },
  { key: 'telefone', label: 'Telefone', type: 'text' },
  { key: 'responsavel', label: 'Responsável', type: 'text', searchable: true },
];

const operationalKey = (item: Empresa): string | undefined => {
  const normalized = normalizeCnpj(item.cnpj || '');
  return normalized || undefined;
};

export const empresaConfig: RegistryConfig<Empresa> = {
  key: 'empresas',
  label: 'Empresas',
  idPrefix: 'EMP',
  fields: baseFields,
  operationalKey,
  duplicateMode: 'bloqueia',
  emptyItem: () => ({ nome: '', cnpj: '', telefone: '', responsavel: '', tipos: ['EMPRESA'] }),
};

export const fornecedorConfig: RegistryConfig<Empresa> = {
  ...empresaConfig,
  key: 'fornecedores',
  label: 'Fornecedores',
  idPrefix: 'FOR',
  subFilter: isSupplier,
  emptyItem: () => ({ nome: '', cnpj: '', telefone: '', responsavel: '', tipos: ['FORNECEDOR'] }),
};

export const terceiraConfig: RegistryConfig<Empresa> = {
  ...empresaConfig,
  key: 'terceiras',
  label: 'Terceiras',
  idPrefix: 'TER',
  subFilter: isThirdPartyContractor,
  emptyItem: () => ({ nome: '', cnpj: '', telefone: '', responsavel: '', tipos: ['TERCEIRA'] }),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/empresaRegistryConfig.test.ts`
Expected: PASS

- [ ] **Step 5: Register and commit**

```bash
git add src/registryConfigs/empresaConfig.ts tests/empresaRegistryConfig.test.ts
echo "import './empresaRegistryConfig.test';" # adicionar manualmente em tests/run.ts, mesmo padrão
git add tests/run.ts
git commit -m "feat(registry): config de empresas/fornecedores/terceiras"
```

---

## Task 7: Config de Obras/Locais

**Files:**
- Create: `src/registryConfigs/obraConfig.ts`
- Test: `tests/obraRegistryConfig.test.ts`

**Interfaces:**
- Consumes: `RegistryConfig` (Task 1); `ObraLocal` (`src/types.ts`: `id`, `nome`, `endereco`, `responsavel`, `status: 'Ativa' | 'Concluída' | 'Planejada'`).
- Produces: `obraConfig: RegistryConfig<ObraLocal>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/obraRegistryConfig.test.ts
import assert from 'node:assert/strict';
import { obraConfig } from '../src/registryConfigs/obraConfig';

assert.equal(obraConfig.operationalKey({ id: '1', nome: 'Ramo 200', endereco: '', responsavel: '', status: 'Ativa' }), 'ramo 200');
assert.equal(obraConfig.operationalKey({ id: '1', nome: '', endereco: '', responsavel: '', status: 'Ativa' }), undefined);
assert.equal(obraConfig.duplicateMode, 'avisa');
assert.deepEqual(obraConfig.emptyItem(), { nome: '', endereco: '', responsavel: '', status: 'Planejada' });
const statusField = obraConfig.fields.find(field => field.key === 'status');
assert.deepEqual(statusField?.options, ['Ativa', 'Concluída', 'Planejada']);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/obraRegistryConfig.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Write minimal implementation**

```ts
// src/registryConfigs/obraConfig.ts
import type { ObraLocal } from '../types';
import type { RegistryConfig } from '../shared/registry/registryTypes';

export const obraConfig: RegistryConfig<ObraLocal> = {
  key: 'obras',
  label: 'Locais',
  idPrefix: 'OBR',
  fields: [
    { key: 'nome', label: 'Descrição do Local / Obra', type: 'text', required: true, searchable: true },
    { key: 'endereco', label: 'Endereço / Cidade', type: 'text', required: true, searchable: true },
    { key: 'responsavel', label: 'Encarregado / Engenheiro Responsável', type: 'text', searchable: true },
    { key: 'status', label: 'Status Operacional', type: 'select', options: ['Ativa', 'Concluída', 'Planejada'], quickEdit: true },
  ],
  operationalKey: item => item.nome.trim().toLowerCase() || undefined,
  duplicateMode: 'avisa',
  emptyItem: () => ({ nome: '', endereco: '', responsavel: '', status: 'Planejada' }),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/obraRegistryConfig.test.ts`
Expected: PASS

- [ ] **Step 5: Register and commit**

```bash
git add src/registryConfigs/obraConfig.ts tests/obraRegistryConfig.test.ts tests/run.ts
git commit -m "feat(registry): config de obras/locais"
```

---

## Task 8: Config de Equipamentos / Veículos

**Files:**
- Create: `src/registryConfigs/equipamentoConfig.ts`
- Test: `tests/equipamentoRegistryConfig.test.ts`

**Interfaces:**
- Consumes: `RegistryConfig` (Task 1); `Equipamento` (`src/types.ts`); `isVehicle` (`src/masterData/centralRegistry.ts`); `looksLikePersonName`/`validateEquipmentMasterRecord` (`src/utils/equipmentOperations.ts` — reaproveitado via `extraValidation`, sem duplicar a heurística).
- Produces: `equipamentoConfig`, `veiculoConfig: RegistryConfig<Equipamento>`.

Esta é a categoria com mais campos (ver `src/types.ts:29-59`). Só os campos realmente editáveis num cadastro entram em `fields` — os campos operacionais de uso diário (`horasDisponiveis`, `mobilizado`, `metaDisponibilidade`, etc.) continuam sendo escritos pelas telas operacionais (`ControleEquipamentosDiarioTab`), não pelo Cadastro; a chave `prefixo` normalizada é a mesma já usada em `centralRegistry.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/equipamentoRegistryConfig.test.ts
import assert from 'node:assert/strict';
import { equipamentoConfig, veiculoConfig } from '../src/registryConfigs/equipamentoConfig';
import type { Equipamento } from '../src/types';

const base: Equipamento = {
  id: '1', prefixo: 'CB-1005', nome: 'Basculante', tipo: 'Basculante', marca: 'Volvo', modelo: 'FH540',
  seriePlaca: '', empresaId: '', status: 'Ativo', localAtualId: '', observacao: '',
};

assert.equal(equipamentoConfig.operationalKey(base), 'cb1005', 'chave normaliza prefixo (sem hífen/maiúscula)');
assert.equal(equipamentoConfig.operationalKey({ ...base, prefixo: '' }), undefined);
assert.equal(equipamentoConfig.duplicateMode, 'bloqueia');

assert.equal(veiculoConfig.subFilter?.({ ...base, categoriaFrota: 'Veículo' }), true);
assert.equal(veiculoConfig.subFilter?.({ ...base, categoriaFrota: 'Equipamento' }), false);
assert.equal(equipamentoConfig.subFilter?.({ ...base, categoriaFrota: 'Veículo' }), false, 'Equipamentos exclui Veículos, não mostra os dois juntos');

assert.equal(equipamentoConfig.extraValidation?.({ ...base, nome: 'Genivaldo' }), 'Este nome parece ser de uma pessoa, não de um equipamento. Confira antes de salvar.');
assert.equal(equipamentoConfig.extraValidation?.(base), undefined, 'descrição legítima de equipamento não dispara o guard');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/equipamentoRegistryConfig.test.ts`
Expected: FAIL — módulo não encontrado (e confirme antes, lendo `src/utils/equipmentOperations.ts`, a mensagem de erro exata que `validateEquipmentMasterRecord` usa para o guard de nome de pessoa, e use a mesma string literal no `extraValidation` abaixo em vez de inventar uma nova)

- [ ] **Step 3: Write minimal implementation**

```ts
// src/registryConfigs/equipamentoConfig.ts
import type { Equipamento } from '../types';
import type { RegistryConfig } from '../shared/registry/registryTypes';
import { isVehicle } from '../masterData/centralRegistry';
import { looksLikePersonName } from '../utils/equipmentOperations';

const normalizePrefixo = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();

const baseFields: RegistryConfig<Equipamento>['fields'] = [
  { key: 'prefixo', label: 'Prefixo', type: 'text', required: true, searchable: true },
  { key: 'nome', label: 'Nome / Descrição', type: 'text', required: true, searchable: true },
  { key: 'tipo', label: 'Tipo', type: 'text', searchable: true },
  { key: 'marca', label: 'Marca', type: 'text' },
  { key: 'modelo', label: 'Modelo', type: 'text' },
  { key: 'seriePlaca', label: 'Série / Placa', type: 'text', searchable: true },
  { key: 'status', label: 'Status', type: 'select', options: ['Ativo', 'Parado', 'Manutenção', 'Mobilizado', 'Desmobilizado', 'Esperando motorista'], quickEdit: true },
  { key: 'observacao', label: 'Observação', type: 'text' },
];

const extraValidation = (item: Equipamento): string | undefined =>
  looksLikePersonName(item.nome) ? 'Este nome parece ser de uma pessoa, não de um equipamento. Confira antes de salvar.' : undefined;

const operationalKey = (item: Equipamento): string | undefined => {
  const normalized = normalizePrefixo(item.prefixo || '');
  return normalized || undefined;
};

export const equipamentoConfig: RegistryConfig<Equipamento> = {
  key: 'equipamentos',
  label: 'Equipamentos',
  idPrefix: 'EQ',
  fields: baseFields,
  operationalKey,
  duplicateMode: 'bloqueia',
  subFilter: item => !isVehicle(item),
  extraValidation,
  emptyItem: () => ({ prefixo: '', nome: '', tipo: '', marca: '', modelo: '', seriePlaca: '', empresaId: '', status: 'Ativo', localAtualId: '', observacao: '', categoriaFrota: 'Equipamento' }),
};

export const veiculoConfig: RegistryConfig<Equipamento> = {
  ...equipamentoConfig,
  key: 'veiculos',
  label: 'Veículos',
  idPrefix: 'VEI',
  subFilter: isVehicle,
  emptyItem: () => ({ prefixo: '', nome: '', tipo: '', marca: '', modelo: '', seriePlaca: '', empresaId: '', status: 'Ativo', localAtualId: '', observacao: '', categoriaFrota: 'Veículo' }),
};
```

Confirme, ao escrever este arquivo de verdade (não só copiar o snippet), que `looksLikePersonName` está exportado de `src/utils/equipmentOperations.ts` com esse nome exato (ela já existia antes deste plano — se o nome real for outro, use o nome real e ajuste o teste do Step 1 antes de rodá-lo, não depois).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/equipamentoRegistryConfig.test.ts`
Expected: PASS

- [ ] **Step 5: Register and commit**

```bash
git add src/registryConfigs/equipamentoConfig.ts tests/equipamentoRegistryConfig.test.ts tests/run.ts
git commit -m "feat(registry): config de equipamentos/veiculos com guard de nome de pessoa"
```

---

## Task 9: Config de Colaboradores

**Files:**
- Create: `src/registryConfigs/funcionarioConfig.ts`
- Test: `tests/funcionarioRegistryConfig.test.ts`

**Interfaces:**
- Consumes: `RegistryConfig` (Task 1); `Funcionario` (`src/types.ts:61-82`).
- Produces: `funcionarioConfig: RegistryConfig<Funcionario>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/funcionarioRegistryConfig.test.ts
import assert from 'node:assert/strict';
import { funcionarioConfig } from '../src/registryConfigs/funcionarioConfig';

assert.equal(funcionarioConfig.operationalKey({ id: '1', matricula: '001234', nome: 'Ana', cargo: 'Operadora', telefone: '', empresaId: '', ativo: true }), '001234');
assert.equal(funcionarioConfig.operationalKey({ id: '1', matricula: '', nome: 'Ana', cargo: 'Operadora', telefone: '', empresaId: '', ativo: true }), undefined, 'sem matrícula não bloqueia (nem todo colaborador tem matrícula ainda)');
assert.equal(funcionarioConfig.duplicateMode, 'bloqueia');
assert.deepEqual(funcionarioConfig.emptyItem(), { nome: '', matricula: '', cargo: '', telefone: '', empresaId: '', ativo: true, status: 'ATIVO' });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/funcionarioRegistryConfig.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Write minimal implementation**

```ts
// src/registryConfigs/funcionarioConfig.ts
import type { Funcionario } from '../types';
import type { RegistryConfig } from '../shared/registry/registryTypes';

export const funcionarioConfig: RegistryConfig<Funcionario> = {
  key: 'funcionarios',
  label: 'Colaboradores',
  idPrefix: 'COL',
  fields: [
    { key: 'nome', label: 'Nome', type: 'text', required: true, searchable: true },
    { key: 'matricula', label: 'Matrícula', type: 'text', searchable: true },
    { key: 'cargo', label: 'Cargo', type: 'text', required: true, searchable: true },
    { key: 'telefone', label: 'Telefone', type: 'text' },
    { key: 'status', label: 'Status', type: 'select', options: ['ATIVO', 'INATIVO', 'FÉRIAS', 'AFASTADO', 'DESMOBILIZADO'], quickEdit: true },
  ],
  operationalKey: item => (item.matricula || '').trim() || undefined,
  duplicateMode: 'bloqueia',
  emptyItem: () => ({ nome: '', matricula: '', cargo: '', telefone: '', empresaId: '', ativo: true, status: 'ATIVO' }),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/funcionarioRegistryConfig.test.ts`
Expected: PASS

- [ ] **Step 5: Register and commit**

```bash
git add src/registryConfigs/funcionarioConfig.ts tests/funcionarioRegistryConfig.test.ts tests/run.ts
git commit -m "feat(registry): config de colaboradores"
```

---

## Task 10: Config de Comboios

**Files:**
- Create: `src/registryConfigs/comboioConfig.ts`
- Test: `tests/comboioRegistryConfig.test.ts`

**Interfaces:**
- Consumes: `RegistryConfig` (Task 1); `Comboio` (`src/types.ts:84-90`: `id`, `nome`, `placa`, `capacidadeLitros`, `responsavel`).
- Produces: `comboioConfig: RegistryConfig<Comboio>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/comboioRegistryConfig.test.ts
import assert from 'node:assert/strict';
import { comboioConfig } from '../src/registryConfigs/comboioConfig';

const normalizePlaca = (value: string) => value.replace(/[^a-z0-9]/gi, '').toUpperCase();
assert.equal(comboioConfig.operationalKey({ id: '1', nome: 'Comboio 1', placa: 'abc-1234', capacidadeLitros: 5000, responsavel: '' }), normalizePlaca('abc-1234'));
assert.equal(comboioConfig.operationalKey({ id: '1', nome: 'Comboio 1', placa: '', capacidadeLitros: 5000, responsavel: '' }), undefined);
assert.equal(comboioConfig.duplicateMode, 'bloqueia');
assert.deepEqual(comboioConfig.emptyItem(), { nome: '', placa: '', capacidadeLitros: 0, responsavel: '' });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/comboioRegistryConfig.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Write minimal implementation**

```ts
// src/registryConfigs/comboioConfig.ts
import type { Comboio } from '../types';
import type { RegistryConfig } from '../shared/registry/registryTypes';

const normalizePlaca = (value: string) => value.replace(/[^a-z0-9]/gi, '').toUpperCase();

export const comboioConfig: RegistryConfig<Comboio> = {
  key: 'comboios',
  label: 'Comboios',
  idPrefix: 'COM',
  fields: [
    { key: 'nome', label: 'Nome / Identificação', type: 'text', required: true, searchable: true },
    { key: 'placa', label: 'Placa', type: 'text', required: true, searchable: true },
    { key: 'capacidadeLitros', label: 'Capacidade (litros)', type: 'number', required: true },
    { key: 'responsavel', label: 'Responsável', type: 'text', searchable: true },
  ],
  operationalKey: item => normalizePlaca(item.placa || '') || undefined,
  duplicateMode: 'bloqueia',
  emptyItem: () => ({ nome: '', placa: '', capacidadeLitros: 0, responsavel: '' }),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/comboioRegistryConfig.test.ts`
Expected: PASS

- [ ] **Step 5: Register and commit**

```bash
git add src/registryConfigs/comboioConfig.ts tests/comboioRegistryConfig.test.ts tests/run.ts
git commit -m "feat(registry): config de comboios"
```

---

## Task 11: Configs de Combustíveis, Lubrificantes e Etapas (catálogos simples)

**Files:**
- Create: `src/registryConfigs/combustivelConfig.ts`, `src/registryConfigs/lubrificanteConfig.ts`, `src/registryConfigs/etapaConfig.ts`
- Test: `tests/catalogRegistryConfigs.test.ts`

**Interfaces:**
- Consumes: `RegistryConfig` (Task 1); `TipoCombustivel`, `ProdutoLubrificacao`, `EtapaServico` (`src/types.ts:92-105`, todos só `{ id: string; nome: string }`).
- Produces: `combustivelConfig: RegistryConfig<TipoCombustivel>`; `lubrificanteConfig: RegistryConfig<ProdutoLubrificacao>`; `etapaConfig: RegistryConfig<EtapaServico>`.

Os três tipos são idênticos em formato (`id` + `nome`), então os três configs são o mesmo template.

- [ ] **Step 1: Write the failing test**

```ts
// tests/catalogRegistryConfigs.test.ts
import assert from 'node:assert/strict';
import { combustivelConfig } from '../src/registryConfigs/combustivelConfig';
import { lubrificanteConfig } from '../src/registryConfigs/lubrificanteConfig';
import { etapaConfig } from '../src/registryConfigs/etapaConfig';

for (const [config, label] of [[combustivelConfig, 'Combustíveis'], [lubrificanteConfig, 'Lubrificantes'], [etapaConfig, 'Ramos / Trechos']] as const) {
  assert.equal(config.label, label);
  assert.equal(config.duplicateMode, 'avisa');
  assert.equal(config.operationalKey({ id: '1', nome: 'Diesel S10' }), 'diesel s10');
  assert.equal(config.operationalKey({ id: '1', nome: '' }), undefined);
  assert.deepEqual(config.emptyItem(), { nome: '' });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/catalogRegistryConfigs.test.ts`
Expected: FAIL — módulos não encontrados

- [ ] **Step 3: Write minimal implementation**

```ts
// src/registryConfigs/combustivelConfig.ts
import type { TipoCombustivel } from '../types';
import type { RegistryConfig } from '../shared/registry/registryTypes';

export const combustivelConfig: RegistryConfig<TipoCombustivel> = {
  key: 'combustiveis',
  label: 'Combustíveis',
  idPrefix: 'CBT',
  fields: [{ key: 'nome', label: 'Nome', type: 'text', required: true, searchable: true }],
  operationalKey: item => item.nome.trim().toLowerCase() || undefined,
  duplicateMode: 'avisa',
  emptyItem: () => ({ nome: '' }),
};
```

```ts
// src/registryConfigs/lubrificanteConfig.ts
import type { ProdutoLubrificacao } from '../types';
import type { RegistryConfig } from '../shared/registry/registryTypes';

export const lubrificanteConfig: RegistryConfig<ProdutoLubrificacao> = {
  key: 'lubrificantes',
  label: 'Lubrificantes',
  idPrefix: 'LUB',
  fields: [{ key: 'nome', label: 'Nome', type: 'text', required: true, searchable: true }],
  operationalKey: item => item.nome.trim().toLowerCase() || undefined,
  duplicateMode: 'avisa',
  emptyItem: () => ({ nome: '' }),
};
```

```ts
// src/registryConfigs/etapaConfig.ts
import type { EtapaServico } from '../types';
import type { RegistryConfig } from '../shared/registry/registryTypes';

export const etapaConfig: RegistryConfig<EtapaServico> = {
  key: 'etapas',
  label: 'Ramos / Trechos',
  idPrefix: 'ETP',
  fields: [{ key: 'nome', label: 'Nome', type: 'text', required: true, searchable: true }],
  operationalKey: item => item.nome.trim().toLowerCase() || undefined,
  duplicateMode: 'avisa',
  emptyItem: () => ({ nome: '' }),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/catalogRegistryConfigs.test.ts`
Expected: PASS

- [ ] **Step 5: Register and commit**

```bash
git add src/registryConfigs/combustivelConfig.ts src/registryConfigs/lubrificanteConfig.ts src/registryConfigs/etapaConfig.ts tests/catalogRegistryConfigs.test.ts tests/run.ts
git commit -m "feat(registry): configs de combustiveis, lubrificantes e etapas"
```

---

## Task 12: `CadastrosTab.tsx` vira o orquestrador fino

**Files:**
- Modify: `src/components/CadastrosTab.tsx` (reescrita completa do corpo do componente — mantém o nome do arquivo e o `export default function CadastrosTab(...)`, já que é isso que `App.tsx` importa)
- Test: `tests/cadastrosTabOrchestration.test.ts`

**Interfaces:**
- Consumes: `RegistryScreen` (Task 5), todas as configs (Tasks 6-11), e os MESMOS props que `CadastrosTab` já recebe hoje de `App.tsx` (`empresas`, `equipamentos`, `funcionarios`, `obras`, `comboios`, `combustiveis`, `lubrificantes`, `etapas`, `onSaveEmpresa`, `onDeleteEmpresa`, `onSaveEquipamento`, `onDeleteEquipamento`, etc. — ler a lista completa de props em `src/components/CadastrosTab.tsx` ANTES de reescrever, na versão atual do arquivo, e preservar exatamente a mesma interface de props, já que `App.tsx` não muda).
- Produces: mesma exportação default de sempre.

Este é o único passo que troca o arquivo por inteiro — todas as tarefas anteriores só adicionaram arquivos novos, sem tocar em nada existente. Antes de escrever este passo, releia `src/components/CadastrosTab.tsx` na íntegra para capturar a lista exata de props (a interface de props não está reproduzida aqui de propósito, porque pode ter mudado entre a escrita deste plano e a execução desta tarefa — copie da fonte real, não deste texto).

- [ ] **Step 1: Write the failing test**

```ts
// tests/cadastrosTabOrchestration.test.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/CadastrosTab.tsx', import.meta.url), 'utf8');
assert.match(source, /RegistryScreen/, 'usa o componente genérico, não reimplementa tabela/formulário');
assert.match(source, /empresaConfig|fornecedorConfig|terceiraConfig/);
assert.match(source, /equipamentoConfig|veiculoConfig/);
assert.match(source, /funcionarioConfig/);
assert.match(source, /comboioConfig/);
assert.match(source, /combustivelConfig/);
assert.match(source, /lubrificanteConfig/);
assert.match(source, /etapaConfig/);
assert.match(source, /obraConfig/);
// Não pode sobrar nenhum dos 48 useState do arquivo antigo — a orquestração
// nova só guarda "qual sub-aba está ativa" e delega o resto ao RegistryScreen.
const useStateCount = (source.match(/useState/g) || []).length;
assert.ok(useStateCount <= 5, `esperado poucos useState no orquestrador, achou ${useStateCount}`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/cadastrosTabOrchestration.test.ts`
Expected: FAIL — o arquivo atual não referencia `RegistryScreen` nem as configs

- [ ] **Step 3: Write minimal implementation**

Reescrever `src/components/CadastrosTab.tsx`: manter a `interface CadastrosTabProps` exatamente como está hoje (copiada da versão atual do arquivo), e trocar o corpo do componente para escolher a config pela sub-aba e delegar a `RegistryScreen`:

A `CadastrosTabProps` real (confirmada em `src/components/CadastrosTab.tsx:62-91` na versão atual) inclui, além das 8 listas/16 handlers de CRUD das 10 categorias: `ordensServico: OrdemServico[]`, `onImportCadastros: (target: SubTab, rows: Record<string, string>[]) => { success: boolean; message: string }` e `onApplyMasterWorkbook: (analysis: MasterWorkbookAnalysis) => Promise<{ success: boolean; message: string }>`. Essas três não pertencem a nenhuma das 10 categorias — são de duas features à parte (importação de CSV legada por sub-aba, e o Master Workbook), hoje renderizadas sempre visíveis acima do seletor de sub-aba via `<CentralRegistryOverview>`, `<SpreadsheetImportReview>` (ligada a `pendingImport`/`confirmSpreadsheetImport`) e `<MasterDataReviewCenter>` (`src/components/CadastrosTab.tsx:747-773` na versão atual). Nenhuma delas faz parte do escopo deste plano (não são telas de "lançamento/edição" de uma categoria) — preserve as três seções **copiando o JSX e o estado local que elas usam (`pendingImport`, `isConfirmingImport`, `confirmSpreadsheetImport`, e a função que abre o file picker de importação) exatamente como estão na versão atual do arquivo**, sem reescrevê-las nem tentar encaixá-las no `RegistryScreen`.

```tsx
// src/components/CadastrosTab.tsx (estrutura do novo corpo)
import { useState } from 'react';
import RegistryScreen from '../shared/registry/RegistryScreen';
import { empresaConfig, fornecedorConfig, terceiraConfig } from '../registryConfigs/empresaConfig';
import { obraConfig } from '../registryConfigs/obraConfig';
import { equipamentoConfig, veiculoConfig } from '../registryConfigs/equipamentoConfig';
import { funcionarioConfig } from '../registryConfigs/funcionarioConfig';
import { comboioConfig } from '../registryConfigs/comboioConfig';
import { combustivelConfig } from '../registryConfigs/combustivelConfig';
import { lubrificanteConfig } from '../registryConfigs/lubrificanteConfig';
import { etapaConfig } from '../registryConfigs/etapaConfig';
// Mantidos da versão atual, sem alteração: MasterDataReviewCenter,
// CentralRegistryOverview, SpreadsheetImportReview, e os tipos usados por
// CadastrosTabProps (Empresa, ObraLocal, Equipamento, Funcionario, Comboio,
// TipoCombustivel, ProdutoLubrificacao, EtapaServico, OrdemServico,
// MasterWorkbookAnalysis).

type SubTab = 'empresas' | 'fornecedores' | 'terceiras' | 'obras' | 'equipamentos' | 'veiculos' | 'funcionarios' | 'comboios' | 'combustiveis' | 'lubrificantes' | 'etapas';

const TABS: { id: SubTab; label: string }[] = [
  { id: 'funcionarios', label: 'Colaboradores' },
  { id: 'equipamentos', label: 'Equipamentos' },
  { id: 'veiculos', label: 'Veículos' },
  { id: 'fornecedores', label: 'Fornecedores' },
  { id: 'terceiras', label: 'Terceiras' },
  { id: 'empresas', label: 'Empresas' },
  { id: 'obras', label: 'Locais' },
  { id: 'etapas', label: 'Ramos / Trechos' },
  { id: 'comboios', label: 'Comboios' },
  { id: 'combustiveis', label: 'Combustíveis' },
  { id: 'lubrificantes', label: 'Lubrificantes' },
];

export default function CadastrosTab(props: CadastrosTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('funcionarios');
  // pendingImport, isConfirmingImport e confirmSpreadsheetImport: copiados
  // tal como na versão atual (ligados a props.onImportCadastros), sem
  // alteração de comportamento — omitidos aqui só para não repetir código
  // que já existe e continua correto.

  return (
    <div className="space-y-4">
      <CentralRegistryOverview
        empresas={props.empresas}
        obras={props.obras}
        equipamentos={props.equipamentos}
        funcionarios={props.funcionarios}
        onSelectModule={module => setSubTab(module as SubTab)}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
        {TABS.map(tab => (
          <button key={tab.id} type="button" onClick={() => setSubTab(tab.id)} className={`py-3 px-2 rounded-xl border text-center text-[10px] font-bold uppercase ${subTab === tab.id ? 'bg-emerald-600/10 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200 text-slate-400'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'empresas' && <RegistryScreen config={empresaConfig} items={props.empresas} onSave={props.onSaveEmpresa} onDelete={props.onDeleteEmpresa} />}
      {subTab === 'fornecedores' && <RegistryScreen config={fornecedorConfig} items={props.empresas} onSave={props.onSaveEmpresa} onDelete={props.onDeleteEmpresa} />}
      {subTab === 'terceiras' && <RegistryScreen config={terceiraConfig} items={props.empresas} onSave={props.onSaveEmpresa} onDelete={props.onDeleteEmpresa} />}
      {subTab === 'obras' && <RegistryScreen config={obraConfig} items={props.obras} onSave={props.onSaveObra} onDelete={props.onDeleteObra} />}
      {subTab === 'equipamentos' && <RegistryScreen config={equipamentoConfig} items={props.equipamentos} onSave={props.onSaveEquipamento} onDelete={props.onDeleteEquipamento} />}
      {subTab === 'veiculos' && <RegistryScreen config={veiculoConfig} items={props.equipamentos} onSave={props.onSaveEquipamento} onDelete={props.onDeleteEquipamento} />}
      {subTab === 'funcionarios' && <RegistryScreen config={funcionarioConfig} items={props.funcionarios} onSave={props.onSaveFuncionario} onDelete={props.onDeleteFuncionario} />}
      {subTab === 'comboios' && <RegistryScreen config={comboioConfig} items={props.comboios} onSave={props.onSaveComboio} onDelete={props.onDeleteComboio} />}
      {subTab === 'combustiveis' && <RegistryScreen config={combustivelConfig} items={props.combustiveis} onSave={props.onSaveTipoCombustivel} onDelete={props.onDeleteTipoCombustivel} />}
      {subTab === 'lubrificantes' && <RegistryScreen config={lubrificanteConfig} items={props.lubrificantes} onSave={props.onSaveProdutoLubrificacao} onDelete={props.onDeleteProdutoLubrificacao} />}
      {subTab === 'etapas' && <RegistryScreen config={etapaConfig} items={props.etapas} onSave={props.onSaveEtapaServico} onDelete={props.onDeleteEtapaServico} />}

      {/* SpreadsheetImportReview (importação CSV legada) e MasterDataReviewCenter:
          copiados tal como na versão atual do arquivo (linhas 754-773 da
          versão pré-reescrita), sem alteração de props ou comportamento. */}
    </div>
  );
}
```

`CadastrosTabProps` em si (a interface, `src/components/CadastrosTab.tsx:62-91`) não muda nesta tarefa — só o corpo do componente. Antes de escrever o arquivo de verdade, releia a versão atual por inteiro (não só os trechos citados neste plano) para não perder nenhuma prop, estado ou efeito colateral que não seja puramente CRUD de uma das 10 categorias.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/cadastrosTabOrchestration.test.ts`
Expected: PASS

- [ ] **Step 5: Type-check, full suite, and commit**

Run: `npx tsc --noEmit` — corrige qualquer prop com nome diferente do assumido acima.
Run: `npx tsx tests/run.ts` — os testes de UI antigos que dependiam da estrutura interna de `CadastrosTab.tsx` (se algum existir) precisam ser removidos ou adaptados nesta tarefa, já que a estrutura interna mudou de propósito; testes que verificam comportamento observável via `App.tsx` (permissões, contagens) devem continuar passando sem alteração.

```bash
git add src/components/CadastrosTab.tsx tests/cadastrosTabOrchestration.test.ts tests/run.ts
git commit -m "refactor(cadastros): CadastrosTab vira orquestrador do RegistryScreen"
```

---

## Task 13: Verificação final e checagem manual no localhost

**Files:** nenhum arquivo novo — só verificação.

- [ ] **Step 1: Suite completa**

Run: `npx tsx tests/run.ts` — todos os testes (os antigos + os ~10 novos deste plano) devem passar.

- [ ] **Step 2: Tipos e build**

Run: `npx tsc --noEmit`
Run: `npm run build`

- [ ] **Step 3: E2E de Cadastros, se existir**

Rodar a suíte Playwright/E2E do repositório focada em Cadastros (verificar `tests/e2e/` por um spec de cadastros); comparar contra a baseline conhecida (218 passando / 6 falhas pré-existentes não relacionadas, registradas em sessão anterior) — nenhuma falha nova pode aparecer nas 10 categorias reconstruídas.

- [ ] **Step 4: Checagem manual no localhost**

Abrir `http://127.0.0.1:3000/`, entrar em Cadastro, e para pelo menos 3 categorias (Empresas, Equipamentos, Colaboradores): criar um registro novo, editar, tentar criar um duplicado pela chave operacional (confirmar que bloqueia ou avisa conforme a config), usar "Adicionar linhas" para lançar 2 registros de uma vez, excluir um registro. Confirmar visualmente que o título da tela aparece (Task 4) e que os cards de resumo mostram números corretos.

- [ ] **Step 5: Commit final (se houver ajuste) e relatório**

Relatar ao usuário: quantas categorias reconstruídas, resultado dos testes/build/E2E, e qualquer divergência encontrada durante a checagem manual que não estava prevista neste plano.
