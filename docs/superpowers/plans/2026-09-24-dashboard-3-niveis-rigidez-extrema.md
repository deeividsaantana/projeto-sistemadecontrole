# Dashboard RENEA — 3 Níveis com Rigidez Extrema

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar o Dashboard para oferecer 3 níveis completos (KPIs estratégicos + Operacional real-time + Insights) com RIGIDEZ EXTREMA em todos 6 critérios (GSAP, Motion, Performance Lighthouse > 90, Visual Pattern, Header Pattern, Accessibility).

**Architecture:** 
- Nível 1 (KPIs): Resumo estratégico com cards animados GSAP, responsivo, memoizado
- Nível 2 (Operacional): DataGrid de obras + equipamentos com status real-time, filtros, sorting
- Nível 3 (Insights): Gráficos de tendência, comparativos período-a-período, alertas
- Performance: Lazy-load dos níveis 2 e 3, virtual scrolling, code-split de gráficos
- SEO: Meta-tags, robots.txt, structured data

**Tech Stack:**
- React 19, TypeScript, GSAP 3, Tailwind CSS 4, Vite 6
- Recharts (gráficos), Tanstack Table (DataGrid)
- Firebase (dados real-time)
- Playwright E2E tests

**Spec:** `docs/superpowers/DASHBOARD_RIGIDEZ_EXTREMA.md` + `docs/superpowers/GATE_RIGIDEZ_EXTREMA.md`

---

## Global Constraints

- Dashboard.tsx final deve passar **Lighthouse > 90 em 4 categorias** (Performance, Accessibility, Best Practices, SEO)
- **ZERO CSS transitions** — apenas GSAP
- **WCAG 2.1 AAA** — ARIA labels, keyboard nav, focus states em tudo
- **Tipografia pixel-perfect**: 28px (title), 32px (KPI value), 14px (body), 12px (labels)
- **Cores RENEA exatas**: #176b4d (primary), #f26a2e (accent), #dce3df (border), #718087 (text)
- **Espaçamento Tailwind**: gap-4 (16px) entre items, gap-6 (24px) entre seções
- **Header pattern imutável**: PageHeader com eyebrow/title/description/actions
- **Performance metrics**: FCP < 1s, LCP < 2.5s, CLS < 0.1, TBT < 50ms (quando possível)
- Bundle size: Dashboard.js < 100KB minified (gráficos lazy-loaded)

---

## Review Focus

1. **Carregamento de dados em cascata**: Nível 1 pronto rápido, Níveis 2 e 3 lazy-loaded sem bloquear FCP
2. **Gráficos não causar jank**: Recharts renderizado com suspense, não bloqueia thread principal
3. **Filtros e sorting real-time**: Mudanças refletem sem re-renderizar níveis acima
4. **Estados vazios/erro/loading**: Cada nível tem seus próprios estados com mensagens claras
5. **Responsividade em mobile**: Layout adequado em 375px (1 col), 768px (2 col), 1440px (3 col)

---

## File Structure

**Files to Create:**
- `src/components/Dashboard/index.tsx` — Componente raiz com 3 níveis
- `src/components/Dashboard/Level1_KPIs.tsx` — KPIs estratégicos
- `src/components/Dashboard/Level2_Operational.tsx` — Grid de obras/equipamentos
- `src/components/Dashboard/Level3_Insights.tsx` — Gráficos e trending
- `src/utils/dashboardLevels.ts` — Lógica pura para calcular dados de cada nível
- `src/utils/dashboardMetrics.ts` — Métricas e agregações
- `src/types/dashboard.ts` — Tipos TypeScript para Dashboard
- `tests/dashboardLevels.test.ts` — Testes de lógica pura
- `tests/dashboardE2E.test.ts` — E2E de todos 3 níveis

**Files to Modify:**
- `src/App.tsx` — Importar novo Dashboard (já é lazy-loaded)
- `public/robots.txt` — Criar se não existe
- `src/index.html` — Adicionar meta-tags (description, og:, structured data)

---

## Task Breakdown

### Task 1: Arquitetura e Tipos — Nível 1 (KPIs)

**Files:**
- Create: `src/types/dashboard.ts`
- Create: `src/utils/dashboardMetrics.ts`
- Create: `src/components/Dashboard/Level1_KPIs.tsx`
- Modify: `src/utils/dashboardOperational.ts` (estender com novos cálculos)
- Test: `tests/dashboardLevels.test.ts`

**Interfaces:**
- Consumes: 
  - `props.obras: ObraLocal[]`
  - `props.equipamentos: Equipamento[]`
  - `props.producao: RegistroProducao[]`
  - `props.periodo: { from: string, to: string }`
- Produces:
  - `interface DashboardLevel1 { obrasAbertas, equipamentosAtivos, equipamentosParados, producaoMes, eficienciaMedia, taxaAtividade }`
  - `function calculateLevel1Metrics(obras, equipamentos, producao, periodo): DashboardLevel1`

**Steps:**

- [ ] **Step 1: Create types/dashboard.ts with interfaces**

```typescript
// src/types/dashboard.ts
export interface KPIMetric {
  label: string;
  value: number;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
  trendPercent?: number;
  onClick?: () => void;
}

export interface DashboardLevel1 {
  obrasAbertas: number;
  equipamentosAtivos: number;
  equipamentosParados: number;
  producaoMes: number;
  eficienciaMedia: number;
  taxaAtividade: number;
  lastUpdated: string;
}

export interface DashboardLevel2 {
  obras: {
    id: string;
    nome: string;
    responsavel: string;
    status: 'Ativa' | 'Pausada' | 'Concluída';
    progresso: number;
    producaoHoje: number;
    atraso: number; // dias
  }[];
  equipamentos: {
    id: string;
    nome: string;
    obra: string;
    status: 'Ativo' | 'Parado' | 'Manutenção';
    utilizacao: number; // %
    lastActivity: string;
  }[];
  alertas: {
    id: string;
    tipo: 'atraso' | 'falha' | 'seguranca';
    mensagem: string;
    severidade: 'baixa' | 'media' | 'alta';
    timestamp: string;
  }[];
}

export interface DashboardLevel3 {
  graficos: {
    producaoTrend: { data: Array<{ data: string; valor: number }> };
    eficienciaTrend: { data: Array<{ data: string; valor: number }> };
    equipamentoPorStatus: { data: Array<{ status: string; count: number }> };
    obraPorProgresso: { data: Array<{ obra: string; progresso: number }> };
  };
  metricas: {
    producaoCompare: { atual: number; anterior: number; variacao: number };
    eficienciaCompare: { atual: number; anterior: number; variacao: number };
  };
}
```

- [ ] **Step 2: Create dashboardMetrics.ts with calculation functions**

```typescript
// src/utils/dashboardMetrics.ts
import type { ObraLocal, Equipamento, RegistroProducao } from '../types';
import type { DashboardLevel1, DashboardLevel2, DashboardLevel3 } from '../types/dashboard';

export function calculateLevel1(
  obras: ObraLocal[],
  equipamentos: Equipamento[],
  producao: RegistroProducao[],
  periodo: { from: string; to: string }
): DashboardLevel1 {
  const obrasAbertas = obras.filter(o => o.status === 'Ativa').length;
  const equipamentosAtivos = equipamentos.filter(e => e.status === 'Ativo').length;
  const equipamentosParados = equipamentos.filter(e => e.status === 'Parado').length;
  
  const prodInPeriod = producao.filter(p => 
    p.data >= periodo.from && p.data <= periodo.to
  );
  const producaoMes = prodInPeriod.reduce((sum, p) => sum + (p.volume || 0), 0);
  const eficienciaMedia = obrasAbertas > 0 ? producaoMes / obrasAbertas : 0;
  const taxaAtividade = equipamentosAtivos / (equipamentosAtivos + equipamentosParados) * 100;

  return {
    obrasAbertas,
    equipamentosAtivos,
    equipamentosParados,
    producaoMes,
    eficienciaMedia: Math.round(eficienciaMedia * 100) / 100,
    taxaAtividade: Math.round(taxaAtividade),
    lastUpdated: new Date().toISOString(),
  };
}

export function calculateLevel2(
  obras: ObraLocal[],
  equipamentos: Equipamento[],
  producao: RegistroProducao[],
  periodo: { from: string; to: string }
): DashboardLevel2 {
  // Implementar agregação de obras com progresso, equipamentos por obra, alertas
  return {
    obras: [],
    equipamentos: [],
    alertas: [],
  };
}

export function calculateLevel3(
  producao: RegistroProducao[],
  periodo: { from: string; to: string }
): DashboardLevel3 {
  // Implementar gráficos de tendência e comparativos
  return {
    graficos: {
      producaoTrend: { data: [] },
      eficienciaTrend: { data: [] },
      equipamentoPorStatus: { data: [] },
      obraPorProgresso: { data: [] },
    },
    metricas: {
      producaoCompare: { atual: 0, anterior: 0, variacao: 0 },
      eficienciaCompare: { atual: 0, anterior: 0, variacao: 0 },
    },
  };
}
```

- [ ] **Step 3: Write failing test for Level1 calculation**

```typescript
// tests/dashboardLevels.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateLevel1 } from '../src/utils/dashboardMetrics';

test('Dashboard Level1: calculateLevel1', async (suite) => {
  await suite.test('should calculate KPIs from obras, equipamentos, producao', () => {
    const obras = [
      { id: '1', nome: 'Obra A', status: 'Ativa' },
      { id: '2', nome: 'Obra B', status: 'Pausada' },
    ];
    const equipamentos = [
      { id: '1', nome: 'Escavadeira', status: 'Ativo' },
      { id: '2', nome: 'Trator', status: 'Parado' },
    ];
    const producao = [
      { id: '1', data: '2026-09-20', volume: 100 },
      { id: '2', data: '2026-09-21', volume: 150 },
    ];
    const periodo = { from: '2026-09-01', to: '2026-09-30' };

    const result = calculateLevel1(obras, equipamentos, producao, periodo);

    assert.strictEqual(result.obrasAbertas, 1, 'Should count Ativa obras');
    assert.strictEqual(result.equipamentosAtivos, 1, 'Should count Ativo equipamentos');
    assert.strictEqual(result.equipamentosParados, 1, 'Should count Parado equipamentos');
    assert.strictEqual(result.producaoMes, 250, 'Should sum production in period');
    assert.strictEqual(result.taxaAtividade, 50, 'Should calculate activity rate');
  });
});
```

- [ ] **Step 4: Run test (should FAIL)**

Run: `npm test`
Expected: FAIL "calculateLevel1 is not defined"

- [ ] **Step 5: Implement calculateLevel1 function (already done in Step 2)**

- [ ] **Step 6: Run test (should PASS)**

Run: `npm test -- dashboardLevels.test.ts`
Expected: PASS 1/1

- [ ] **Step 7: Create Level1_KPIs component with GSAP animations**

```typescript
// src/components/Dashboard/Level1_KPIs.tsx
import { useState, useMemo, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Plus } from 'lucide-react';
import { PageHeader, PeriodFilter, type PeriodValue } from '../../shared/ui';
import { calculateLevel1 } from '../../utils/dashboardMetrics';
import type { ObraLocal, Equipamento, RegistroProducao } from '../../types';

interface Level1Props {
  obras: ObraLocal[];
  equipamentos: Equipamento[];
  producao: RegistroProducao[];
  periodo: PeriodValue;
  onPeriodoChange: (value: PeriodValue) => void;
  onNavigate: (tab: string) => void;
}

export default function Level1_KPIs(props: Level1Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const kpiRefs = useRef<(HTMLDivElement | null)[]>([]);

  const kpis = useMemo(() => 
    calculateLevel1(props.obras, props.equipamentos, props.producao, {
      inicio: props.periodo.from,
      fim: props.periodo.to,
    }),
    [props.obras, props.equipamentos, props.producao, props.periodo]
  );

  // GSAP: Header fade-in
  useGSAP(() => {
    gsap.from(headerRef.current, {
      opacity: 0,
      y: -30,
      duration: 0.4,
      ease: 'power2.out',
    });
  }, { scope: containerRef });

  // GSAP: KPI cards stagger
  useGSAP(() => {
    gsap.from(kpiRefs.current.filter(Boolean), {
      opacity: 0,
      y: 20,
      duration: 0.5,
      stagger: 0.1,
      ease: 'back.out',
    });
  }, { scope: containerRef, dependencies: [kpis] });

  return (
    <div ref={containerRef} className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div ref={headerRef}>
        <PageHeader
          eyebrow="Painel de Controle"
          title="Dashboard"
          description={`Período: ${props.periodo.from} a ${props.periodo.to}`}
          actions={
            <button
              onClick={() => props.onNavigate('Lançamentos')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#176b4d] px-4 py-2 text-14px font-semibold text-white hover:bg-[#0b4935] focus-visible:ring-2 focus-visible:ring-[#f26a2e]/60"
            >
              <Plus className="size-4" />
              Lançar Produção
            </button>
          }
        />
      </div>

      {/* Period Filter */}
      <PeriodFilter value={props.periodo} onChange={props.onPeriodoChange} />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: 'Obras Ativas', value: kpis.obrasAbertas, unit: 'unidades' },
          { label: 'Equipamentos Ativos', value: kpis.equipamentosAtivos, unit: 'unidades' },
          { label: 'Equipamentos Parados', value: kpis.equipamentosParados, unit: 'unidades' },
          { label: 'Produção do Período', value: Math.round(kpis.producaoMes), unit: 'm³' },
          { label: 'Eficiência Média', value: kpis.eficienciaMedia, unit: 'm³/eq' },
          { label: 'Taxa de Atividade', value: kpis.taxaAtividade, unit: '%' },
        ].map((kpi, i) => (
          <div
            key={i}
            ref={(el) => { kpiRefs.current[i] = el; }}
            className="rounded-lg border border-[#dce3df] bg-white p-4 sm:p-5 hover:border-[#176b4d] focus-visible:ring-2 focus-visible:ring-[#f26a2e]/60"
          >
            <span className="block text-12px font-semibold uppercase tracking-widest text-[#47555c]">
              {kpi.label}
            </span>
            <strong className="mt-2 block text-32px font-black leading-none text-[#101c18]">
              {kpi.value.toLocaleString('pt-BR')}
            </strong>
            <span className="mt-1 block text-11px text-[#8a969b]">{kpi.unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Commit Level 1 (KPIs)**

```bash
git add src/types/dashboard.ts src/utils/dashboardMetrics.ts src/components/Dashboard/Level1_KPIs.tsx tests/dashboardLevels.test.ts
git commit -m "feat: Dashboard Level 1 - KPIs estratégicos com GSAP animations"
```

---

### Task 2: Nível 2 — Operacional Real-time

**Files:**
- Create: `src/components/Dashboard/Level2_Operational.tsx`
- Modify: `src/utils/dashboardMetrics.ts` (implementar calculateLevel2)
- Modify: `tests/dashboardLevels.test.ts` (adicionar testes para Level2)

**Interfaces:**
- Consumes: `DashboardLevel1` (da Task 1), `calculateLevel1` function
- Produces: `DashboardLevel2`, `calculateLevel2(obras, equipamentos, producao, periodo): DashboardLevel2`

**Steps:**

- [ ] **Step 1: Implement calculateLevel2 function**

```typescript
// src/utils/dashboardMetrics.ts - expandir com calculateLevel2
export function calculateLevel2(
  obras: ObraLocal[],
  equipamentos: Equipamento[],
  producao: RegistroProducao[],
  periodo: { from: string; to: string }
): DashboardLevel2 {
  const obrasList = obras.map(o => {
    const prodObra = producao.filter(p => 
      p.obraId === o.id && p.data >= periodo.from && p.data <= periodo.to
    );
    return {
      id: o.id,
      nome: o.nome,
      responsavel: o.responsavel || '—',
      status: o.status as 'Ativa' | 'Pausada' | 'Concluída',
      progresso: Math.random() * 100, // TODO: get from real data
      producaoHoje: prodObra.reduce((sum, p) => sum + (p.volume || 0), 0),
      atraso: 0, // TODO: calculate from schedule
    };
  });

  const equipsList = equipamentos.map(e => ({
    id: e.id,
    nome: e.nome,
    obra: 'N/A', // TODO: get from assignment
    status: e.status as 'Ativo' | 'Parado' | 'Manutenção',
    utilizacao: Math.random() * 100,
    lastActivity: new Date().toISOString(),
  }));

  return {
    obras: obrasList,
    equipamentos: equipsList,
    alertas: [],
  };
}
```

- [ ] **Step 2: Write failing tests for Level2**

```typescript
await suite.test('should calculate Level2 operational data', () => {
  const result = calculateLevel2(obras, equipamentos, producao, periodo);
  assert(Array.isArray(result.obras), 'Should have obras array');
  assert(Array.isArray(result.equipamentos), 'Should have equipamentos array');
  assert.strictEqual(result.obras.length, 2, 'Should have 2 obras');
});
```

- [ ] **Step 3: Run tests (should FAIL for Level2)**

Run: `npm test -- dashboardLevels.test.ts`
Expected: FAIL "calculateLevel2"

- [ ] **Step 4: Run tests (should PASS after calculateLevel2 implementation)**

Run: `npm test -- dashboardLevels.test.ts`
Expected: PASS 2/2

- [ ] **Step 5: Create Level2_Operational component with DataTable**

```typescript
// src/components/Dashboard/Level2_Operational.tsx
import { useState, useMemo, Suspense } from 'react';
import { calculateLevel2 } from '../../utils/dashboardMetrics';
import { DataTable, type DataTableColumn } from '../../shared/ui';
import type { ObraLocal, Equipamento, RegistroProducao } from '../../types';

interface Level2Props {
  obras: ObraLocal[];
  equipamentos: Equipamento[];
  producao: RegistroProducao[];
  periodo: { from: string; to: string };
}

export default function Level2_Operational(props: Level2Props) {
  const [selectedTab, setSelectedTab] = useState<'obras' | 'equipamentos'>('obras');

  const level2 = useMemo(
    () => calculateLevel2(props.obras, props.equipamentos, props.producao, props.periodo),
    [props.obras, props.equipamentos, props.producao, props.periodo]
  );

  const obraColumns: DataTableColumn<typeof level2.obras[0]>[] = [
    {
      id: 'nome',
      label: 'Obra',
      cell: (row) => <span className="font-medium">{row.nome}</span>,
      sortValue: (row) => row.nome,
    },
    {
      id: 'status',
      label: 'Status',
      cell: (row) => (
        <span className={`inline-flex rounded-full px-2 py-1 text-11px font-semibold ${
          row.status === 'Ativa' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
        }`}>
          {row.status}
        </span>
      ),
    },
    {
      id: 'producaoHoje',
      label: 'Produção Hoje',
      cell: (row) => <span>{row.producaoHoje.toFixed(1)} m³</span>,
      sortValue: (row) => row.producaoHoje,
    },
    {
      id: 'progresso',
      label: 'Progresso',
      cell: (row) => (
        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-green-500" style={{ width: row.progresso + '%' }} />
        </div>
      ),
    },
  ];

  return (
    <Suspense fallback={<div>Carregando operacional...</div>}>
      <div className="space-y-4">
        {/* Tab Selection */}
        <div className="flex gap-2 border-b border-[#dce3df]">
          <button
            onClick={() => setSelectedTab('obras')}
            className={`px-4 py-2 text-14px font-semibold ${
              selectedTab === 'obras' ? 'border-b-2 border-[#176b4d] text-[#176b4d]' : 'text-[#718087]'
            }`}
          >
            Obras Ativas
          </button>
          <button
            onClick={() => setSelectedTab('equipamentos')}
            className={`px-4 py-2 text-14px font-semibold ${
              selectedTab === 'equipamentos' ? 'border-b-2 border-[#176b4d] text-[#176b4d]' : 'text-[#718087]'
            }`}
          >
            Equipamentos
          </button>
        </div>

        {/* Content */}
        {selectedTab === 'obras' && (
          <DataTable
            rows={level2.obras}
            columns={obraColumns}
            getRowId={(row) => row.id}
            caption="Obras em operação"
          />
        )}
        {selectedTab === 'equipamentos' && (
          <div className="text-center text-[#718087] py-8">
            Grid de equipamentos será implementado em Task 3
          </div>
        )}
      </div>
    </Suspense>
  );
}
```

- [ ] **Step 6: Commit Level 2**

```bash
git add src/components/Dashboard/Level2_Operational.tsx tests/dashboardLevels.test.ts
git commit -m "feat: Dashboard Level 2 - Operacional real-time com DataTable"
```

---

### Task 3: Nível 3 — Insights e Gráficos

**Files:**
- Create: `src/components/Dashboard/Level3_Insights.tsx`
- Create: `src/components/Dashboard/Charts/ProductionTrend.tsx`
- Modify: `src/utils/dashboardMetrics.ts` (implementar calculateLevel3)

**Interfaces:**
- Consumes: `calculateLevel2` (da Task 2), RegistroProducao[]
- Produces: `DashboardLevel3`, `calculateLevel3(producao, periodo): DashboardLevel3`

**Steps:**

- [ ] **Step 1: Implement calculateLevel3 (gráficos)**

```typescript
// src/utils/dashboardMetrics.ts - adicionar calculateLevel3
export function calculateLevel3(
  producao: RegistroProducao[],
  periodo: { from: string; to: string }
): DashboardLevel3 {
  // Gerar dados de tendência por dia
  const prodByDay = new Map<string, number>();
  producao.forEach(p => {
    if (p.data >= periodo.from && p.data <= periodo.to) {
      prodByDay.set(p.data, (prodByDay.get(p.data) || 0) + (p.volume || 0));
    }
  });

  const producaoTrend = {
    data: Array.from(prodByDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, valor]) => ({ data, valor })),
  };

  return {
    graficos: {
      producaoTrend,
      eficienciaTrend: { data: [] },
      equipamentoPorStatus: { data: [] },
      obraPorProgresso: { data: [] },
    },
    metricas: {
      producaoCompare: { atual: 0, anterior: 0, variacao: 0 },
      eficienciaCompare: { atual: 0, anterior: 0, variacao: 0 },
    },
  };
}
```

- [ ] **Step 2: Create ProductionTrend chart component**

```typescript
// src/components/Dashboard/Charts/ProductionTrend.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ProductionTrendProps {
  data: Array<{ data: string; valor: number }>;
}

export default function ProductionTrend(props: ProductionTrendProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={props.data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#dce3df" />
        <XAxis dataKey="data" stroke="#718087" />
        <YAxis stroke="#718087" />
        <Tooltip 
          contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #dce3df' }}
          cursor={{ stroke: '#176b4d', strokeWidth: 2 }}
        />
        <Line 
          type="monotone" 
          dataKey="valor" 
          stroke="#176b4d" 
          strokeWidth={2}
          dot={{ fill: '#f26a2e', r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 3: Create Level3_Insights component**

```typescript
// src/components/Dashboard/Level3_Insights.tsx
import { Suspense, useMemo } from 'react';
import { calculateLevel3 } from '../../utils/dashboardMetrics';
import ProductionTrend from './Charts/ProductionTrend';
import type { RegistroProducao } from '../../types';

interface Level3Props {
  producao: RegistroProducao[];
  periodo: { from: string; to: string };
}

export default function Level3_Insights(props: Level3Props) {
  const level3 = useMemo(
    () => calculateLevel3(props.producao, props.periodo),
    [props.producao, props.periodo]
  );

  return (
    <Suspense fallback={<div>Carregando insights...</div>}>
      <div className="space-y-6">
        <h3 className="text-20px font-semibold text-[#101c18]">Tendências e Insights</h3>
        
        {/* Production Trend */}
        <div className="rounded-lg border border-[#dce3df] bg-white p-6">
          <h4 className="mb-4 text-14px font-semibold text-[#172329]">Produção por Dia</h4>
          <ProductionTrend data={level3.graficos.producaoTrend.data} />
        </div>
      </div>
    </Suspense>
  );
}
```

- [ ] **Step 4: Write and run tests for Level3**

```typescript
await suite.test('should calculate Level3 insights', () => {
  const result = calculateLevel3(producao, periodo);
  assert(result.graficos.producaoTrend.data.length > 0, 'Should have production trend data');
});
```

- [ ] **Step 5: Commit Level 3**

```bash
git add src/components/Dashboard/Level3_Insights.tsx src/components/Dashboard/Charts/ProductionTrend.tsx tests/dashboardLevels.test.ts
git commit -m "feat: Dashboard Level 3 - Insights com gráficos Recharts"
```

---

### Task 4: Integração dos 3 Níveis no Dashboard Principal

**Files:**
- Create: `src/components/Dashboard/index.tsx` (reescrever completamente)
- Modify: nenhum

**Interfaces:**
- Consumes: `Level1_KPIs`, `Level2_Operational`, `Level3_Insights` (da Task 1-3), `DashboardProps` original
- Produces: Componente `Dashboard` final com todos 3 níveis + GSAP

**Steps:**

- [ ] **Step 1: Rewrite Dashboard/index.tsx to orchestrate 3 levels**

```typescript
// src/components/Dashboard/index.tsx
import { useState, useRef, lazy, Suspense } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import Level1_KPIs from './Level1_KPIs';
import Level2_Operational from './Level2_Operational';
import { PeriodFilter, type PeriodValue, type DataTableColumn } from '../../shared/ui';
import type {
  Empresa, ObraLocal, Equipamento, RegistroProducao, Funcionario,
  Comboio, TipoCombustivel, ProdutoLubrificacao, // ... outras imports
} from '../../types';

const Level3_Insights = lazy(() => import('./Level3_Insights'));

interface DashboardProps {
  // ... props existentes
}

export default function Dashboard(props: DashboardProps) {
  const [periodo, setPeriodo] = useState<PeriodValue>({
    preset: 'mes',
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const level2Ref = useRef<HTMLDivElement>(null);
  const level3Ref = useRef<HTMLDivElement>(null);

  // GSAP: Level2 appears after Level1
  useGSAP(() => {
    gsap.from(level2Ref.current, {
      opacity: 0,
      y: 30,
      duration: 0.5,
      delay: 0.6,
      ease: 'power2.out',
    });
  }, { scope: containerRef });

  // GSAP: Level3 appears last
  useGSAP(() => {
    gsap.from(level3Ref.current, {
      opacity: 0,
      y: 30,
      duration: 0.5,
      delay: 1.0,
      ease: 'power2.out',
    });
  }, { scope: containerRef });

  return (
    <div
      ref={containerRef}
      id="dashboard-tab"
      className="flex flex-col gap-8 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto"
    >
      {/* Nível 1: KPIs */}
      <Level1_KPIs
        obras={props.obras || []}
        equipamentos={props.equipamentos || []}
        producao={props.producao || []}
        periodo={periodo}
        onPeriodoChange={setPeriodo}
        onNavigate={props.onNavigate}
      />

      {/* Nível 2: Operacional */}
      <div ref={level2Ref} className="space-y-4">
        <h2 className="text-20px font-semibold text-[#101c18]">Operação em Tempo Real</h2>
        <Level2_Operational
          obras={props.obras || []}
          equipamentos={props.equipamentos || []}
          producao={props.producao || []}
          periodo={{ from: periodo.from, to: periodo.to }}
        />
      </div>

      {/* Nível 3: Insights */}
      <div ref={level3Ref}>
        <Suspense fallback={<div className="h-64 bg-gray-100 rounded-lg animate-pulse" />}>
          <Level3_Insights
            producao={props.producao || []}
            periodo={{ from: periodo.from, to: periodo.to }}
          />
        </Suspense>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run E2E test to verify all 3 levels render**

```bash
npm run e2e
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Dashboard/index.tsx
git commit -m "feat: Dashboard integrado - 3 níveis com cascata de GSAP"
```

---

### Task 5: Performance Optimization — Lazy-Load & Code-Split

**Files:**
- Modify: `src/components/Dashboard/index.tsx` (já tem lazy Level3_Insights)
- Create: `src/components/Dashboard/useDashboardData.ts` (hook customizado)

**Steps:**

- [ ] **Step 1: Add Suspense boundaries for each level**

```typescript
// Já feito no Dashboard/index.tsx — Level3_Insights está em Suspense
```

- [ ] **Step 2: Verify bundle size for gráficos**

```bash
npm run build && npm run analyze | grep -i recharts
```

Expected: Recharts bundle separado, não bloqueando FCP

- [ ] **Step 3: Add virtual scrolling para Nível 2 if > 100 rows**

```typescript
// Se level2.obras.length > 100, usar VirtualizedTable ao invés de DataTable
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Dashboard/index.tsx
git commit -m "perf: Dashboard lazy-load Level3, Suspense boundaries"
```

---

### Task 6: SEO Fixes

**Files:**
- Create: `public/robots.txt`
- Modify: `src/index.html` (adicionar meta-tags e structured data)

**Steps:**

- [ ] **Step 1: Create robots.txt**

```txt
# public/robots.txt
User-agent: *
Allow: /
Disallow: /admin
Disallow: /private

Sitemap: https://seu-dominio.com/sitemap.xml
```

- [ ] **Step 2: Update index.html with meta-tags**

```html
<!-- src/index.html -->
<meta name="description" content="RENEA ERP - Painel de Controle de Obras, Equipamentos e Produção">
<meta property="og:title" content="RENEA ERP">
<meta property="og:description" content="Controle completo de obras em tempo real">
<meta property="og:type" content="application/x-www-form-urlencoded">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "RENEA ERP",
  "description": "Sistema de gestão de obras e equipamentos",
  "applicationCategory": "BusinessApplication"
}
</script>
```

- [ ] **Step 3: Commit**

```bash
git add public/robots.txt src/index.html
git commit -m "docs: Add robots.txt and meta-tags for SEO"
```

---

### Task 7: Final Validation — Lighthouse > 90

**Files:**
- Modify: nenhum (validação apenas)

**Steps:**

- [ ] **Step 1: Build for production**

```bash
npm run build
```

- [ ] **Step 2: Run preview server**

```bash
npm run preview
```

- [ ] **Step 3: Run Lighthouse validation**

```bash
node scripts/lighthouse-validate.mjs
```

Expected output:
```
✅ Performance     > 90
✅ Accessibility  > 90
✅ Best Practices > 90
✅ SEO            > 90
```

- [ ] **Step 4: If any < 90, debug and fix**

Log all issues and prioritize by impact

- [ ] **Step 5: Run full E2E test suite**

```bash
npm run e2e
```

Expected: 100% pass

- [ ] **Step 6: Commit (se houver fixes)**

```bash
git commit -m "perf: Dashboard final - Lighthouse validação > 90 em todas categorias"
```

---

## Summary

| Task | Deliverable | Status |
|------|-------------|--------|
| 1 | Level 1 KPIs + Types + Tests | 📋 |
| 2 | Level 2 Operational + DataTable | 📋 |
| 3 | Level 3 Insights + Charts | 📋 |
| 4 | Dashboard Integration 3 Níveis | 📋 |
| 5 | Performance Optimization | 📋 |
| 6 | SEO (robots.txt, meta-tags) | 📋 |
| 7 | Lighthouse Validation > 90 | 📋 |

**Timeline:** 6-8 horas (pode ir para amanhã)
**Execution:** Native (você implementa no seu próprio contexto)
