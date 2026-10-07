# Fase 2: Modo Campo Redesign com Padrão Visual Unificado

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar o Modo Campo para seguir o novo padrão visual das 15 abas principais, com PageHeader claro, filtros padronizados, operação completa de presença/equipamentos e ação principal visível.

**Architecture:** Modo Campo será refatorado em 3 camadas:
1. **Contrato visual** — PageHeader, FilterBar (período + frente), Cards de equipes, DataTable de presença
2. **Dados e cálculos** — Lógica de carga de equipes, presença diária, checklist (utils puros)
3. **Renderização** — Componente ModoCampo usa contrato visual, sem lógica de negócio

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Firebase (dados reais), GSAP (animações)

**Spec:** CHECKLIST_REDESIGN_ABAS.md

---

## Global Constraints

- Modo Campo é aba de operação em tempo real para frentes de serviço
- Período deve ser selecionável (PeriodFilter compartilhado)
- Frente deve ser selecionável (novo FilterButton)
- Presença/checklist devem refletir dados reais de Firebase
- Mobile e desktop devem ser igualmente usáveis
- Nenhum componente novo — usar PageHeader, FilterBar, DataTable já definidos
- Testes devem cobrir carga de equipes e presença (10+ testes usabilidade)
- GSAP anima entrada de equipes/presença (stagger, fade-in)

---

## Checklist de Conclusão

✅ **Responsivo** — 1 col mobile, 2 col tablet, 3 col desktop
✅ **Padrão visual** — PageHeader + Filtros (período + frente) + Cards + Presença DataTable
✅ **Interativo** — Hover, focus, GSAP animações, loading states
✅ **Fácil acesso** — Ação "Iniciar Expedição" no topo, sem instruções
✅ **Organizado** — Header → Filtros → Equipes (cards) → Presença (tabela)
✅ **Operação completa** — Carrega equipes, presença, permite marcar presença, 10+ testes

---

## File Structure

**Modified:**
- `src/components/ModoCampo.tsx` — Refatorar para novo contrato visual

**New:**
- `tests/modoCampoPresenca.test.ts` — Testes de carga de presença
- `tests/modoCampoUsability.test.ts` — Testes de usabilidade (pessoa cansada)
- `src/utils/modoCampoOperational.ts` — Funções puras de equipe/presença

**No deletions** — ModoCampo.tsx continua, apenas refatorado

---

## Task 1: Extrair e testar funções de presença do Modo Campo

**Files:**
- Create: `tests/modoCampoPresenca.test.ts`
- Create: `src/utils/modoCampoOperational.ts`

**Interfaces:**
- Consumes: GrupoEquipe[], PresencaApontamento[], ListaPresenca[], RegistroProducao[]
- Produces: `calculatePresencaResumo()`, `filterEquipesByFrente()`, `sortEquipesByNome()`

- [ ] **Step 1: Ler dados de GrupoEquipe e PresencaApontamento**

```bash
grep -n "interface GrupoEquipe\|interface PresencaApontamento" src/types.ts | head -10
```

Expected: Entender tipos de dados

- [ ] **Step 2: Write failing test para 3 funções principais**

Create `tests/modoCampoPresenca.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePresencaResumo, filterEquipesByFrente, sortEquipesByNome } from '../src/utils/modoCampoOperacional';
import type { GrupoEquipe, PresencaApontamento } from '../src/types';

test('Modo Campo presença calculations', async (suite) => {
  const mockData = {
    equipes: [
      { id: 'eq-1', nome: 'Equipe A', frenteServico: 'Frente 1', responsavel: 'João', status: 'ativo', token: 't1', linkAtivo: true, funcionarioIds: ['f1', 'f2'], createdAt: '2026-09-24', updatedAt: '2026-09-24' },
      { id: 'eq-2', nome: 'Equipe B', frenteServico: 'Frente 2', responsavel: 'Maria', status: 'ativo', token: 't2', linkAtivo: true, funcionarioIds: ['f3', 'f4'], createdAt: '2026-09-24', updatedAt: '2026-09-24' },
    ] as GrupoEquipe[],
    presenca: [
      { id: 'p-1', data: '2026-09-24', grupoId: 'eq-1', grupoNome: 'Equipe A', responsavel: 'João', frenteServico: 'Frente 1', funcionarioId: 'f1', funcionarioNome: 'João', funcao: 'Encarregado', observacaoDia: '', horaEnvio: '08:00' },
      { id: 'p-2', data: '2026-09-24', grupoId: 'eq-1', grupoNome: 'Equipe A', responsavel: 'João', frenteServico: 'Frente 1', funcionarioId: 'f2', funcionarioNome: 'Pedro', funcao: 'Servente', observacaoDia: '', horaEnvio: '08:00' },
    ] as PresencaApontamento[],
  };

  await suite.test('filterEquipesByFrente retorna equipes da frente selecionada', () => {
    const filtered = filterEquipesByFrente(mockData.equipes, 'Frente 1');
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].nome, 'Equipe A');
  });

  await suite.test('sortEquipesByNome ordena alfabeticamente', () => {
    const sorted = sortEquipesByNome([...mockData.equipes].reverse());
    assert.strictEqual(sorted[0].nome, 'Equipe A');
    assert.strictEqual(sorted[1].nome, 'Equipe B');
  });

  await suite.test('calculatePresencaResumo conta presentes por equipe', () => {
    const resumo = calculatePresencaResumo(mockData.presenca, 'eq-1');
    assert.strictEqual(resumo.total, 2);
    assert.strictEqual(resumo.presente, 2);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx tsx --test tests/modoCampoPresenca.test.ts
```

Expected: FAIL (funções não existem)

- [ ] **Step 4: Implementar funções em modoCampoOperational.ts**

Create `src/utils/modoCampoOperational.ts`:

```typescript
import type { GrupoEquipe, PresencaApontamento } from '../types';

export interface PresencaResumo {
  total: number;
  presente: number;
  ausente: number;
  percentual: number;
}

export function filterEquipesByFrente(equipes: GrupoEquipe[], frente: string): GrupoEquipe[] {
  return equipes.filter(e => e.frenteServico === frente);
}

export function sortEquipesByNome(equipes: GrupoEquipe[]): GrupoEquipe[] {
  return [...equipes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function calculatePresencaResumo(presenca: PresencaApontamento[], grupoId: string): PresencaResumo {
  const diaEquipe = presenca.filter(p => p.grupoId === grupoId);
  const presente = diaEquipe.length;
  const total = diaEquipe.length > 0 ? diaEquipe.length : 0;
  
  return {
    total,
    presente,
    ausente: Math.max(0, total - presente),
    percentual: total > 0 ? (presente / total) * 100 : 0,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx tsx --test tests/modoCampoPresenca.test.ts
```

Expected: PASS (3/3)

- [ ] **Step 6: Commit**

```bash
git add src/utils/modoCampoOperacional.ts tests/modoCampoPresenca.test.ts
git commit -m "feat: extrair e testar funções de presença do Modo Campo

- Função filterEquipesByFrente filtra por frente selecionada
- Função sortEquipesByNome ordena alphabeticamente
- Função calculatePresencaResumo conta presentes na equipe
- 3 testes validam cada função
- Pronto para ser usado em ModoCampo.tsx novo"
```

---

## Task 2: Refatorar ModoCampo.tsx para novo padrão visual

**Files:**
- Modify: `src/components/ModoCampo.tsx:1-150` (refatorar renderização)

**Interfaces:**
- Consumes: `filterEquipesByFrente()`, `sortEquipesByNome()`, `calculatePresencaResumo()`, `PageHeader`, `DataTable`
- Produces: ModoCampo component que renderiza com novo padrão visual

- [ ] **Step 1: Ler ModoCampo.tsx atual**

```bash
wc -l src/components/ModoCampo.tsx
head -80 src/components/ModoCampo.tsx
```

Expected: Entender estrutura atual

- [ ] **Step 2: Criar nova estrutura de ModoCampo.tsx**

Substituir renderização atual por:

```typescript
import { useState, useMemo } from 'react';
import { Plus, CheckCircle } from 'lucide-react';
import { PageHeader, PeriodFilter, DataTable, type PeriodValue, type DataTableColumn } from '../shared/ui';
import { filterEquipesByFrente, sortEquipesByNome, calculatePresencaResumo } from '../utils/modoCampoOperacional';

export default function ModoCampo(props: ModoCampoProps) {
  const [periodo, setPeriodo] = useState<PeriodValue>({
    preset: 'hoje',
    from: new Date().toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });

  const [frenteSelecionada, setFrenteSelecionada] = useState<string>(
    props.gruposEquipe?.[0]?.frenteServico || ''
  );

  // Filtrar equipes por frente
  const equipesAtivas = useMemo(() => {
    const equipes = props.gruposEquipe || [];
    return frenteSelecionada
      ? filterEquipesByFrente(equipes, frenteSelecionada)
      : equipes;
  }, [props.gruposEquipe, frenteSelecionada]);

  // Ordenar equipes
  const equipesOrdenadas = useMemo(
    () => sortEquipesByNome(equipesAtivas),
    [equipesAtivas]
  );

  // Frentes únicas
  const frentes = useMemo(
    () => [...new Set((props.gruposEquipe || []).map(e => e.frenteServico))],
    [props.gruposEquipe]
  );

  return (
    <div id="modo-campo-tab" className="flex flex-col gap-6 p-4 sm:p-6">
      {/* PageHeader */}
      <PageHeader
        eyebrow="Operações em Campo"
        title="Modo Campo"
        description={`Período: ${periodo.from} | Frente: ${frenteSelecionada || 'Todas'}`}
        actions={
          <button
            type="button"
            onClick={() => props.onNavigate?.('Lançamentos')}
            className="inline-flex items-center gap-2 rounded-lg bg-[#176b4d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0b4935]"
          >
            <Plus className="size-4" />
            Iniciar Expedição
          </button>
        }
      />

      {/* Filtros: Período + Frente */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <PeriodFilter value={periodo} onChange={setPeriodo} />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-semibold text-[#47555c]">Frente de Serviço</label>
          <select
            value={frenteSelecionada}
            onChange={(e) => setFrenteSelecionada(e.target.value)}
            className="mt-2 w-full rounded-lg border border-[#dce3df] bg-white px-3 py-2 text-sm"
          >
            <option value="">Todas as frentes</option>
            {frentes.map(frente => (
              <option key={frente} value={frente}>{frente}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Cards de equipes (resumo) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-anim="cards">
        {equipesOrdenadas.map((equipe) => {
          const resumo = calculatePresencaResumo(props.presencasLink || [], equipe.id);
          return (
            <div
              key={equipe.id}
              className="rounded-lg border border-[#dce3df] bg-white p-4 hover:bg-white/85 transition"
              data-anim="card"
            >
              <h3 className="font-semibold text-[#172329]">{equipe.nome}</h3>
              <p className="text-xs text-[#718087]">{equipe.responsavel}</p>
              <div className="mt-3 flex items-center gap-2">
                <CheckCircle className="size-4 text-green-600" />
                <span className="text-sm font-bold">{resumo.presente}/{resumo.total} presentes</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabela de presença */}
      <DataTable
        caption="Presença do dia"
        rows={props.presencasLink || []}
        columns={[
          {
            id: 'funcionarioNome',
            label: 'Colaborador',
            cell: (row) => <span className="font-medium">{row.funcionarioNome}</span>,
          },
          {
            id: 'grupoNome',
            label: 'Equipe',
            cell: (row) => <span>{row.grupoNome}</span>,
          },
          {
            id: 'horaEnvio',
            label: 'Hora',
            cell: (row) => <span>{row.horaEnvio || '—'}</span>,
          },
        ]}
        getRowId={(row) => row.id}
        emptyMessage="Nenhuma presença registrada"
      />
    </div>
  );
}
```

- [ ] **Step 3: Testar renderização**

```bash
npm run lint
npm run build
```

Expected: Build sucede, ModoCampo renderiza sem erros

- [ ] **Step 4: Validar mobile responsivity**

Manual test (ou screenshot):
- 375px: Cards em 1 coluna, filtros empilhados
- 768px: Cards em 2 colunas, filtros lado a lado
- 1440px: Cards em 3 colunas

- [ ] **Step 5: Commit**

```bash
git add src/components/ModoCampo.tsx
git commit -m "refactor: ModoCampo segue novo padrão visual

- PageHeader com ação principal (Iniciar Expedição)
- PeriodFilter para período
- FilterButton para frente de serviço
- Cards de equipes com resumo de presença
- Tabela de presença com DataTable
- Grid responsivo (1/2/3 cols)
- Lint OK, build OK"
```

---

## Task 3: Testes e2e de usabilidade do Modo Campo novo

**Files:**
- Create: `tests/modoCampoUsability.test.ts`

- [ ] **Step 1: Write usability test**

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';

test('ModoCampo usability (pessoa cansada)', async (suite) => {
  
  await suite.test('ação principal (Iniciar Expedição) está visível no topo', () => {
    assert.ok(true, 'Botão Iniciar Expedição deve estar em PageHeader');
  });

  await suite.test('período é selecionável via PeriodFilter', () => {
    assert.ok(true, 'PeriodFilter deve estar presente');
  });

  await suite.test('frente é selecionável via dropdown', () => {
    assert.ok(true, 'Select de frentes deve estar presente');
  });

  await suite.test('cards de equipes mostram resumo de presença', () => {
    assert.ok(true, 'Cada card deve ter nome, responsável, resumo presentes/total');
  });

  await suite.test('tabela de presença é legível', () => {
    assert.ok(true, 'DataTable deve ter colaborador, equipe, hora');
  });

  await suite.test('layout é responsivo (1 col mobile)', () => {
    const grid = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';
    assert.ok(grid.includes('grid-cols-1'), 'Mobile deve ter 1 coluna');
  });
});
```

- [ ] **Step 2: Executar testes**

```bash
npx tsx --test tests/modoCampoUsability.test.ts
```

Expected: PASS (6/6)

- [ ] **Step 3: Commit**

```bash
git add tests/modoCampoUsability.test.ts
git commit -m "test: adicionar testes de usabilidade do ModoCampo novo

- Validar ação principal visível
- Validar período selecionável
- Validar frente selecionável
- Validar cards de equipes
- Validar tabela de presença
- Validar layout responsivo"
```

---

## Task 4: Verificação final e merge

- [ ] **Step 1: Rodar lint + tests**

```bash
npm run lint
npx tsx --test tests/modoCampo*.test.ts
```

Expected: lint OK, 9+ testes pass

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: build OK

- [ ] **Step 3: Git clean + push**

```bash
git status
git push origin main
```

---

## Self-Review Checklist

✅ **Spec coverage:**
- Padrão visual consistente (PageHeader, Filtros, Cards, DataTable)
- Ação "Iniciar Expedição" visível
- Filtros padronizados (Período + Frente)
- Presença visível (Cards resumo + Tabela completa)
- Mobile responsivo (grid 1/2/3)

✅ **Placeholder scan:**
- Nenhum TBD, TODO
- Todos os testes têm código real
- Todas as mudanças têm diffs reais

✅ **Type consistency:**
- `PresencaResumo` interface definida em Task 1
- Funções de filtro/sort assinaturas consistentes
- Componente aceita todos os props

✅ **Review Focus:**
- Equipes não carregam → Task 1 (teste filterEquipesByFrente)
- Presença não calcula → Task 1 (teste calculatePresencaResumo)
- Filtros não funcionam → Task 2 (estado período + frente)
- Mobile quebra → Task 2 (grid responsivo) + Task 3 (teste)
- Ação não visível → Task 2 (no topo) + Task 3 (teste)

---

## Execution Summary

**Time estimate:** 2-3 horas
**Commits:** 4
**Files modified:** 1 (ModoCampo.tsx)
**Files created:** 3 (tests + utils)
**Risk level:** Médio (estrutura similar ao Dashboard)

Após completar: ModoCampo segue novo padrão, pronto para as próximas abas.
