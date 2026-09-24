# Dashboard — Checklist Final com Rigor

**6 Critérios Obrigatórios (SEM EXCEÇÃO)**

---

## 1️⃣ GSAP — Animações Profissionais

**Obrigatório:** Todas animações devem usar GSAP, nunca CSS puro.

### Animações Requeridas

```typescript
// PageHeader: fade-in + slide-down
useGSAP(() => {
  gsap.from('[data-anim="header"]', {
    opacity: 0,
    y: -30,
    duration: 0.4,
    ease: 'power2.out',
  });
}, []);

// KPI Cards: stagger fade-in
useGSAP(() => {
  gsap.from('[data-anim="kpi-card"]', {
    opacity: 0,
    y: 20,
    duration: 0.5,
    stagger: 0.1,
    ease: 'back.out',
  });
}, [kpis]);

// DataTable: slide-up
useGSAP(() => {
  gsap.from('[data-anim="table-row"]', {
    opacity: 0,
    x: -30,
    duration: 0.4,
    stagger: 0.05,
    delay: 0.3,
    ease: 'power2.out',
  });
}, [obrasAtivas]);

// Button hover: scale + color
const handleButtonHover = (e) => {
  gsap.to(e.target, { scale: 0.95, duration: 0.2 });
};
const handleButtonHoverOut = (e) => {
  gsap.to(e.target, { scale: 1, duration: 0.2 });
};

// Filter change: fade transition
useGSAP(() => {
  gsap.to('[data-anim="content"]', { opacity: 1, duration: 0.3 });
}, [periodo]);
```

### Checklist GSAP

- [ ] PageHeader anima (fade-in + slide)
- [ ] KPI cards animam com stagger
- [ ] Tabela anima (slide-up com delay)
- [ ] Botões animam no hover (scale)
- [ ] Filtro muda (fade transition)
- [ ] Loading skeleton anima (pulsação)
- [ ] Tudo suave (< 600ms total)
- [ ] Sem jank (60fps smooth)

**Status:** ❌ NÃO IMPLEMENTADO

---

## 2️⃣ MOTION — Transições & Micro-interações

**Obrigatório:** Feedback visual em TODA interação.

### Transições Requeridas

```typescript
// Hover em card
className="transition-all duration-200 hover:shadow-lg hover:scale-102"

// Focus em input
className="focus-visible:ring-2 focus-visible:ring-[#f26a2e]/60 focus-visible:ring-offset-2"

// Clique em botão
onClick={async (e) => {
  const target = e.currentTarget;
  gsap.to(target, { scale: 0.95, duration: 0.1 });
  await handleClick();
  gsap.to(target, { scale: 1, duration: 0.2, ease: 'back.out' });
}}

// Loading state
<div className="animate-pulse bg-gray-200 h-12 rounded" />

// Toast/feedback
gsap.from('[data-anim="toast"]', {
  opacity: 0,
  y: -20,
  duration: 0.3,
  ease: 'back.out',
});
```

### Checklist MOTION

- [ ] Hover states em botões (scale + color)
- [ ] Hover states em cards (shadow + background)
- [ ] Focus states com ring + offset
- [ ] Click feedback (scale down + up)
- [ ] Loading skeleton com pulsação
- [ ] Toast/alert animation
- [ ] Transição de página (fade in/out)
- [ ] Todas com `transition-all duration-200` ou GSAP

**Status:** ❌ PARCIAL (só hover básico)

---

## 3️⃣ DESEMPENHO & OTIMIZAÇÃO

**Obrigatório:** Dashboard carrega < 1s, TTI < 2s, Lighthouse > 90.

### Otimizações Requeridas

```typescript
// Memoização agressiva
const kpis = useMemo(() => calculateDashboardKpis(...), deps);
const obrasAtivas = useMemo(() => filter(...), deps);
const obraColumns = useMemo(() => [...], []);

// Lazy loading
const DataTable = lazy(() => import('./DataTable'));

// Image optimization
<img loading="lazy" decoding="async" src={...} />

// Virtual scrolling para tabelas > 100 rows
<VirtualList rows={obrasAtivas} />

// Debounce filtros
const [periodo, setPeriodo] = useState(...);
const handlePeriodoChange = useMemo(
  () => debounce((value) => setPeriodo(value), 300),
  []
);
```

### Checklist DESEMPENHO

- [ ] First paint < 1s
- [ ] Time to Interactive < 2s
- [ ] Lighthouse score > 90
- [ ] Code split (lazy load DataTable)
- [ ] Agressivo memoization (useMemo todas funções puras)
- [ ] Virtual scrolling se > 100 rows
- [ ] Debounce em filtros
- [ ] Imagens otimizadas + lazy load
- [ ] Bundle size < 50KB (Dashboard code)
- [ ] Zero network waterfall

**Status:** ❌ NÃO OTIMIZADO

---

## 4️⃣ PADRÃO VISUAL — Cores, Espaçamento, Tipografia

**Obrigatório:** 100% consistente com RENEA brand guidelines.

### Paleta RENEA

```
Primary (verde):     #176b4d
Accent (laranja):    #f26a2e
Neutral (cinza):     #718087
Background:          #f7f8f6
Card BG:             #ffffff
Border:              #dce3df
Text dark:           #101c18
Text medium:         #172329
Text light:          #718087
```

### Tipografia Padrão

```
h1 (PageHeader title):
  - font-size: 28px (clamp(24px, 5vw, 32px))
  - font-weight: 900 (font-black)
  - line-height: 1.2
  - letter-spacing: -0.02em (tracking-tight)
  - color: #101c18

h2 (KPI label):
  - font-size: 12px
  - font-weight: 600 (font-semibold)
  - letter-spacing: 0.08em (uppercase)
  - color: #47555c

KPI value:
  - font-size: 32px
  - font-weight: 900 (font-black)
  - font-variant-numeric: tabular-nums
  - color: #101c18

Body text:
  - font-size: 14px
  - font-weight: 400
  - line-height: 1.5
  - color: #172329

Caption:
  - font-size: 12px
  - color: #718087
```

### Espaçamento Tailwind

```
gap: gap-4 (1rem) padrão entre componentes
gap: gap-6 (1.5rem) entre seções
p: p-4 sm:p-6 lg:p-8 em containers
m: m-0 (sem margins, usar gap em flex)
```

### Checklist VISUAL

- [ ] Paleta RENEA aplicada (colors.ts ou Tailwind config)
- [ ] h1 exactly 28px, font-black, tracking-tight
- [ ] KPI labels 12px, uppercase, font-semibold
- [ ] KPI values 32px, font-black, tabular-nums
- [ ] Body 14px, line-height 1.5
- [ ] Espaçamento: gap-4 entre items, gap-6 entre seções
- [ ] Sem margins (flex gap)
- [ ] Borders: #dce3df, 1px, rounded-lg
- [ ] Cards: white bg, padding p-4 sm:p-5
- [ ] Shadows: subtle (shadow-sm), nunca boxy

**Status:** ❌ PARCIAL (tamanhos inconsistentes)

---

## 5️⃣ PADRÃO DE CABEÇALHO — Tamanho, Layout, Ação

**Obrigatório:** PageHeader idêntico em TODAS 15 abas.

### Estrutura Padrão

```typescript
<PageHeader
  eyebrow="CONTEXTO ABA"      // 12px, uppercase, gray
  title="Nome da Aba"         // 28px, font-black
  description="Descrição"     // 14px, gray, abaixo do title
  actions={                   // Button à direita, alinhado ao title
    <button className="...">
      <Icon className="size-4" />
      Ação Principal
    </button>
  }
/>
```

### Layout

```
┌─────────────────────────────────────┐
│ EYEBROW (12px)                      │
│ Título Principal (28px)    [Botão]  │
│ Descrição secundária (14px)         │
└─────────────────────────────────────┘
```

### Botão Ação Principal

```typescript
<button
  className="inline-flex items-center gap-2 
             rounded-lg bg-[#176b4d] px-4 py-2
             text-sm font-semibold text-white
             transition-all duration-200
             hover:bg-[#0b4935] hover:scale-102
             focus-visible:ring-2 focus-visible:ring-[#f26a2e]/60
             focus-visible:ring-offset-2"
  onMouseEnter={(e) => gsap.to(e.target, { scale: 0.98, duration: 0.2 })}
  onMouseLeave={(e) => gsap.to(e.target, { scale: 1, duration: 0.2 })}
>
  <Icon className="size-4" />
  Ação
</button>
```

### Checklist CABEÇALHO

- [ ] Eyebrow presente e 12px, uppercase, gray
- [ ] Título exactly 28px, font-black, tracking-tight
- [ ] Descrição 14px, gray, abaixo
- [ ] Botão ação no topo direito
- [ ] Botão: verde #176b4d, hover escuro
- [ ] Botão: scale effect no hover
- [ ] Botão: focus ring with offset
- [ ] Padding: p-4 sm:p-6
- [ ] Responsive: flex-col em mobile, flex-row em desktop

**Status:** ❌ PARCIAL (descrição em data, não contextual)

---

## 6️⃣ INTERATIVIDADE — Estados, Feedback, Ações

**Obrigatório:** Feedback visual claro em TODA interação do usuário.

### Estados de Elementos

```typescript
// Card interativo
<div
  className="rounded-lg border border-[#dce3df] bg-white p-4
             transition-all duration-200
             hover:bg-gray-50 hover:shadow-md hover:cursor-pointer
             focus-visible:ring-2 focus-visible:ring-[#f26a2e]/60
             data-anim='card'"
  role="button"
  tabIndex={0}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
  onClick={handleClick}
>
  ...
</div>

// Tabela com hover de linha
<tr
  className="transition-colors duration-200
             hover:bg-[#f7f8f6] hover:cursor-pointer
             focus-visible:ring-2 focus-visible:ring-[#f26a2e]/60"
  onClick={() => openDetails(row)}
  role="button"
  tabIndex={0}
>
  ...
</tr>

// Loading state
{isLoading && <Skeleton count={5} />}

// Empty state
{obrasAtivas.length === 0 && (
  <div className="py-12 text-center">
    <Icon className="size-12 text-gray-300 mx-auto" />
    <p className="mt-4 text-gray-500">Nenhuma obra ativa</p>
  </div>
)}

// Error state
{error && (
  <div className="rounded-lg bg-red-50 p-4 border border-red-200">
    <p className="text-red-800 font-semibold">{error.message}</p>
    <button onClick={retry} className="mt-2 text-red-600 underline">
      Tentar novamente
    </button>
  </div>
)}
```

### Checklist INTERATIVIDADE

- [ ] Hover: card, button, row (visual feedback)
- [ ] Focus: ring-2 ring-[#f26a2e]/60 em TUDO interativo
- [ ] Click: scale + color feedback
- [ ] Keyboard: Tab navegação, Enter ativa, Escape fecha
- [ ] Loading: skeleton com pulsação GSAP
- [ ] Empty: ícone grande + mensagem amigável
- [ ] Error: ícone alerta + mensagem + retry button
- [ ] Disabled: opacity-50, cursor-not-allowed
- [ ] Selected: background color + check icon
- [ ] Tooltip: em hover de labels complexos

**Status:** ❌ CRÍTICO (zero feedback visual)

---

## 📊 SCORE FINAL

| Critério | Score | Status |
|----------|-------|--------|
| GSAP | 0% | ❌ NÃO IMPLEMENTADO |
| MOTION | 20% | ❌ PARCIAL |
| DESEMPENHO | 30% | ❌ NÃO OTIMIZADO |
| PADRÃO VISUAL | 50% | ⚠️ PARCIAL |
| PADRÃO CABEÇALHO | 60% | ⚠️ PARCIAL |
| INTERATIVIDADE | 10% | ❌ CRÍTICO |
| **TOTAL** | **28%** | **❌ FALHA** |

---

## 🚨 AÇÃO IMEDIATA

**Dashboard.tsx precisa de REESCRITA COMPLETA.**

Não é tweak — é implementação seria de todos os 6 critérios.

**Não prosseguir para Modo Campo até Dashboard = 100% em todos 6.**

### Próximas Etapas

1. ✏️ Reescrever Dashboard.tsx com rigor nos 6 critérios
2. ✅ Validar contra este checklist (100% em CADA critério)
3. ✅ Testes: GSAP animations, interactivity, performance
4. ✅ Deploy e verificar em produção
5. ➡️ SÓ ENTÃO: Começar Modo Campo

**Timeline:** 1 dia dedicado ao Dashboard
