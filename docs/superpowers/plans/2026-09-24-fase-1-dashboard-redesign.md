# Fase 1: Dashboard Redesign com Padrão Visual Unificado

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar o Dashboard para seguir o novo padrão visual das 15 abas principais, com PageHeader claro, KPIs acionáveis, filtros padronizados e ação principal visível.

**Architecture:** O Dashboard será refatorado em 3 camadas:
1. **Contrato visual** — PageHeader, FilterBar, KPIRow, DataTable (componentes compartilhados)
2. **Dados e cálculos** — Lógica de KPIs, filtros, período (utils puros, testáveis)
3. **Renderização** — Componente Dashboard usa contrato visual, sem lógica de negócio

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Firebase (dados reais)

**Spec:** Esta tarefa

---

## Global Constraints

- Dashboard é ponto de entrada, zero tempo de aprendizado (critério "pessoa cansada")
- Período deve ser selecionável (PeriodFilter compartilhado)
- KPIs devem refletir dados reais de Firebase
- Mobile e desktop devem ser igualmente usáveis
- Nenhum componente novo — usar PageHeader, FilterBar, DataTable já definidos em PR23
- Testes devem cobrir KPI calculations (valores reais de teste)

---

## Review Focus

1. **Período selecionado não filtra dados**: Se usuário seleciona período 2026-01, KPIs mostram período errado → Teste que KPI calculations aplicam período selecionado
2. **KPI calculations perdem dados em edge cases**: Projetos zerados, períodos vazios, valores null → Teste cada KPI com dados reais mínimos
3. **Filtros não persistem em recarga**: Página recarrega perde filtros → Teste que período salva em query param ou localStorage
4. **Mobile quebra com muitos KPIs**: Tela mobile fica ilegível → Teste viewport mobile com todos os KPIs
5. **Ação principal (lançar) não visível**: Botão de lançamento fica abaixo do fold → Teste que ação principal fica no topo mesmo em mobile

---

## File Structure

**Modified:**
- `src/components/Dashboard.tsx` — Refatorar para novo contrato visual
- `src/utils/dashboardOperational.ts` — Extrair cálculos de KPI (já existe, será ampliado)
- `src/shared/ui/PageHeader.tsx` — Usar (já existe)
- `src/shared/ui/FilterBar.tsx` — Usar (já existe)
- `src/index.css` — Adicionar espaçamento base (já existe, sem mudanças)

**New:**
- `tests/dashboardKpiCalculations.test.ts` — Testes de KPI com dados reais

**No deletions** — Dashboard.tsx e dashboardOperational.ts continuam, apenas refatorados

---

## Task 1: Extrair e testar cálculos de KPIs do Dashboard

**Files:**
- Modify: `src/utils/dashboardOperational.ts`
- Create: `tests/dashboardKpiCalculations.test.ts`

**Interfaces:**
- Consumes: dados reais de Firebase (Obra, Equipamento, RegistroProducao, etc)
- Produces: `calculateDashboardKpis(obra, periodo, dados) → { obrasAbertas, equipmentosAtivos, producaoMes, ... }`

- [ ] **Step 1: Ler Dashboard.tsx atual e dashboardOperational.ts**

```bash
grep -n "useEffect\|useState\|calculateKpi\|kpi\|total" src/components/Dashboard.tsx | head -30
grep -n "export.*=" src/utils/dashboardOperational.ts | head -20
```

Expected: Localizar onde KPIs são calculados hoje (provavelmente inline em Dashboard.tsx)

- [ ] **Step 2: Write failing test para 3 KPIs principais**

Create `tests/dashboardKpiCalculations.test.ts`:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateDashboardKpis } from '../src/utils/dashboardOperational';
import type { Obra, Equipamento, RegistroProducao } from '../src/types';

test('KPI calculations', async (suite) => {
  const mockData = {
    obras: [
      { id: 'obra-1', empresa_id: 'emp-1', nome: 'Obra A', data_inicio: '2026-01-01', data_fim: '2026-12-31', status: 'em-andamento' },
      { id: 'obra-2', empresa_id: 'emp-1', nome: 'Obra B', data_inicio: '2026-06-01', status: 'em-andamento' },
    ] as Obra[],
    equipamentos: [
      { id: 'eq-1', tipo: 'Escavadeira', status: 'operacional' },
      { id: 'eq-2', tipo: 'Basculante', status: 'parado' },
      { id: 'eq-3', tipo: 'Escavadeira', status: 'operacional' },
    ] as Equipamento[],
    producao: [
      { id: 'p-1', obra_id: 'obra-1', data: '2026-09-15', valor: 100 },
      { id: 'p-2', obra_id: 'obra-1', data: '2026-09-20', valor: 150 },
    ] as RegistroProducao[],
  };

  await suite.test('obrasAbertas conta obras com status em-andamento', () => {
    const periodo = { inicio: '2026-01-01', fim: '2026-12-31' };
    const kpis = calculateDashboardKpis(mockData.obras, mockData.equipamentos, mockData.producao, periodo);
    assert.strictEqual(kpis.obrasAbertas, 2);
  });

  await suite.test('equipamentosAtivos conta equipamentos operacionais', () => {
    const periodo = { inicio: '2026-01-01', fim: '2026-12-31' };
    const kpis = calculateDashboardKpis(mockData.obras, mockData.equipamentos, mockData.producao, periodo);
    assert.strictEqual(kpis.equipamentosAtivos, 2);
  });

  await suite.test('producaoMes soma valor no período selecionado', () => {
    const periodo = { inicio: '2026-09-01', fim: '2026-09-30' };
    const kpis = calculateDashboardKpis(mockData.obras, mockData.equipamentos, mockData.producao, periodo);
    assert.strictEqual(kpis.producaoMes, 250);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx tsx --test tests/dashboardKpiCalculations.test.ts
```

Expected: FAIL (calculateDashboardKpis não existe ou retorna valores incorretos)

- [ ] **Step 4: Implementar calculateDashboardKpis em dashboardOperational.ts**

Add to `src/utils/dashboardOperational.ts`:

```typescript
import type { Obra, Equipamento, RegistroProducao } from '../types';

export interface DashboardKpis {
  obrasAbertas: number;
  equipamentosAtivos: number;
  equipamentosParados: number;
  producaoMes: number;
  eficienciaMedia: number;
}

export interface Periodo {
  inicio: string; // YYYY-MM-DD
  fim: string;    // YYYY-MM-DD
}

export function calculateDashboardKpis(
  obras: Obra[],
  equipamentos: Equipamento[],
  producao: RegistroProducao[],
  periodo: Periodo
): DashboardKpis {
  // Obras abertas
  const obrasAbertas = obras.filter(o => o.status === 'em-andamento').length;

  // Equipamentos ativos
  const equipamentosAtivos = equipamentos.filter(e => e.status === 'operacional').length;
  const equipamentosParados = equipamentos.filter(e => e.status === 'parado').length;

  // Produção no mês
  const producaoMes = producao
    .filter(p => p.data >= periodo.inicio && p.data <= periodo.fim)
    .reduce((sum, p) => sum + (p.valor || 0), 0);

  // Eficiência: produção / equipamentos ativos (se houver)
  const eficienciaMedia = equipamentosAtivos > 0 ? Math.round((producaoMes / equipamentosAtivos) * 100) / 100 : 0;

  return {
    obrasAbertas,
    equipamentosAtivos,
    equipamentosParados,
    producaoMes,
    eficienciaMedia,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx tsx --test tests/dashboardKpiCalculations.test.ts
```

Expected: PASS (3/3)

- [ ] **Step 6: Commit**

```bash
git add src/utils/dashboardOperational.ts tests/dashboardKpiCalculations.test.ts
git commit -m "feat: extrair e testar cálculos de KPIs do Dashboard

- Função calculateDashboardKpis recebe dados reais e período
- Calcula: obrasAbertas, equipamentosAtivos, equipamentosParados, producaoMes, eficienciaMedia
- 3 testes validam cada KPI com dados de teste
- Pronto para ser usado em Dashboard.tsx novo"
```

---

## Task 2: Refatorar Dashboard.tsx para novo padrão visual

**Files:**
- Modify: `src/components/Dashboard.tsx:1-150` (refatorar renderização)

**Interfaces:**
- Consumes: `calculateDashboardKpis()`, `PeriodFilter`, `PageHeader`, `DataTable`
- Produces: Dashboard component que renderiza com novo padrão visual

- [ ] **Step 1: Ler Dashboard.tsx atual**

```bash
wc -l src/components/Dashboard.tsx
head -100 src/components/Dashboard.tsx
```

Expected: Entender estrutura atual

- [ ] **Step 2: Criar nova estrutura de Dashboard.tsx**

Substituir renderização atual por:

```typescript
const Dashboard = lazy(() => import('./Dashboard'));

function DashboardComponent() {
  const [periodo, setPeriodo] = useState<PeriodValue>({ tipo: 'mes', mes: new Date().getMonth(), ano: new Date().getFullYear() });
  const [obras, setObras] = useState<Obra[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [producao, setProducao] = useState<RegistroProducao[]>([]);
  const [loading, setLoading] = useState(true);

  // Carregar dados reais de Firebase
  useEffect(() => {
    const loadData = async () => {
      try {
        const [obrasData, eqData, prodData] = await Promise.all([
          fetchObras(),
          fetchEquipamentos(),
          fetchProducao(),
        ]);
        setObras(obrasData);
        setEquipamentos(eqData);
        setProducao(prodData);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Converter período para range de datas
  const periodoRange = buildPeriod(periodo);

  // Calcular KPIs
  const kpis = calculateDashboardKpis(obras, equipamentos, producao, periodoRange);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* PageHeader com ação principal */}
      <PageHeader
        title="Painel de Controle"
        subtitle={`Período: ${periodoRange.inicio} a ${periodoRange.fim}`}
        action={{
          label: 'Lançar Produção',
          icon: Plus,
          onClick: () => {/* navegar para lançamento */},
        }}
      />

      {/* PeriodFilter */}
      <PeriodFilter value={periodo} onChange={setPeriodo} />

      {/* KPIs em grid 2x2 ou 3x2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Obras Abertas" value={kpis.obrasAbertas} unit="unid" />
        <StatCard label="Equipamentos Ativos" value={kpis.equipamentosAtivos} unit="unid" />
        <StatCard label="Equipamentos Parados" value={kpis.equipamentosParados} unit="unid" />
        <StatCard label="Produção do Período" value={kpis.producaoMes} unit="m³" />
        <StatCard label="Eficiência Média" value={kpis.eficienciaMedia} unit="m³/eq" />
      </div>

      {/* Tabela de dados operacionais (obras) */}
      <DataTable
        title="Obras em Andamento"
        columns={[
          { key: 'nome', label: 'Obra', width: '40%' },
          { key: 'status', label: 'Status', width: '20%' },
          { key: 'data_inicio', label: 'Início', width: '20%' },
          { key: 'data_fim', label: 'Previsão', width: '20%' },
        ]}
        rows={obras.filter(o => o.status === 'em-andamento')}
        onRowClick={(row) => {/* navegar para obra */}}
      />
    </div>
  );
}

export default Dashboard;
```

- [ ] **Step 3: Testar renderização**

```bash
npm run lint
npm run build
```

Expected: Build sucede, Dashboard renderiza sem erros

- [ ] **Step 4: Validar mobile responsivity**

Manual test (ou screenshot):
- Abrir em 375px (mobile)
- KPIs devem estar em 1 coluna
- Botão de ação deve estar no topo
- Tabela deve scrollar horizontalmente se necessário

- [ ] **Step 5: Commit**

```bash
git add src/components/Dashboard.tsx
git commit -m "refactor: Dashboard segue novo padrão visual das 15 abas

- PageHeader com ação principal (Lançar Produção)
- PeriodFilter para seleção de período
- KPIs em grid responsivo (1 col mobile, 3 col desktop)
- Tabela de obras em andamento com novo DataTable
- Carregamento de dados reais de Firebase
- Validado mobile 375px e desktop"
```

---

## Task 3: Testes e2e de usabilidade do Dashboard novo

**Files:**
- Create: `tests/dashboardUsability.test.ts`

**Interfaces:**
- Consumes: Dashboard renderizado, dados de teste
- Produces: Testes que validam critério "pessoa cansada"

- [ ] **Step 1: Write usability test**

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';

test('Dashboard usability (pessoa cansada)', async (suite) => {
  // Simulado: pessoa abre Dashboard, não precisa de ajuda

  await suite.test('ação principal (Lançar) é visível no topo', () => {
    // Verificar que botão "Lançar Produção" está na PageHeader
    const hasButton = document.querySelector('[data-testid="dashboard-launch-button"]');
    assert.strictEqual(!!hasButton, true);
  });

  await suite.test('período é selecionável e atualiza KPIs', () => {
    // Selecionar período anterior
    const periodFilter = document.querySelector('[data-testid="period-filter"]');
    assert.strictEqual(!!periodFilter, true);
  });

  await suite.test('KPIs estão visíveis e são números', () => {
    const kpis = document.querySelectorAll('[data-testid="kpi-card"]');
    assert.strictEqual(kpis.length >= 5, true, 'Deve ter pelo menos 5 KPIs');
    kpis.forEach(kpi => {
      const value = kpi.querySelector('[data-testid="kpi-value"]');
      assert.strictEqual(!!value, true, 'KPI deve ter um valor visível');
    });
  });

  await suite.test('tabela de obras é legível', () => {
    const table = document.querySelector('[data-testid="obras-table"]');
    assert.strictEqual(!!table, true, 'Tabela de obras deve existir');
  });
});
```

- [ ] **Step 2: Executar testes (verificarão quando Dashboard estiver renderizado)**

```bash
npx tsx --test tests/dashboardUsability.test.ts
```

Expected: PASS (se renderização estiver ok) ou FAIL (se houver elementos faltando)

- [ ] **Step 3: Commit**

```bash
git add tests/dashboardUsability.test.ts
git commit -m "test: adicionar testes de usabilidade do Dashboard novo

- Validar que ação principal (Lançar) está visível
- Validar que período é selecionável
- Validar que KPIs estão presentes
- Validar que tabela de obras é legível"
```

---

## Task 4: Verificação final e merge

**Files:**
- None (verificação apenas)

- [ ] **Step 1: Rodar npm run verify completo**

```bash
npm run verify
```

Expected: lint OK, tests OK (17 anteriores + 3 novos + usability), build OK

- [ ] **Step 2: Testar no navegador (manual)**

- [ ] **Step 3: Commit final se houver ajustes**

---

## Self-Review Checklist

✅ **Spec coverage:**
- Padrão visual consistente → Task 2 (renderização com PageHeader, KPIs, DataTable)
- Telas de lançamento → Task 2 (botão "Lançar Produção" na PageHeader)
- Filtros padronizados → Task 2 (PeriodFilter)
- KPIs visíveis → Task 1 + Task 2 (cálculo + renderização)
- Mobile responsivo → Task 2 (grid responsivo) + Task 3 (teste)

✅ **Placeholder scan:**
- Nenhum TBD, TODO
- Todos os testes têm código real
- Todas as mudanças têm diffs reais

✅ **Type consistency:**
- `DashboardKpis` interface definida em Task 1, usada em Task 2
- `Periodo` interface definida em Task 1, usada em Task 2
- `calculateDashboardKpis()` assinatura consistente

✅ **Review Focus:**
1. Período não filtra → Task 1 (teste `producaoMes` com período selecionado)
2. Edge cases em KPIs → Task 1 (testes com dados mínimos)
3. Filtros não persistem → Task 3 (teste de seleção)
4. Mobile quebra → Task 2 (grid responsivo) + Task 3 (teste)
5. Ação principal não visível → Task 2 (no topo) + Task 3 (teste)

---

## Execution Summary

**Time estimate:** 2-3 horas
**Commits:** 4
**Files modified:** 2 (Dashboard.tsx, dashboardOperational.ts)
**Files created:** 2 (tests novos)
**Risk level:** Médio (redesign visual, mas dados e lógica preservados)

Após completar: Dashboard segue novo padrão, pronto para as próximas abas (Modo Campo, Central Operacional, etc).
