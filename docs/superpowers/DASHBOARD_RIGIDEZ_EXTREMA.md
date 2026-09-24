# Dashboard — RIGIDEZ EXTREMA

**REGRA OURO:** Qualquer desvio = FALHA. Sem exceções, sem "bom o suficiente", sem margem de interpretação.

**Score de Aprovação:** 100% ou REPROVADO.

---

## 1. GSAP — OBRIGATÓRIO EM 100%

### Requisito Exato

**TODAS as transições devem usar GSAP. NENHUMA CSS pura ou Tailwind `transition-`.**

```typescript
// ❌ PROIBIDO
className="transition-all duration-200 hover:scale-105"

// ✅ OBRIGATÓRIO
const handleHover = () => {
  gsap.to(ref.current, { scale: 1.05, duration: 0.2 });
};
```

### Animações Obrigatórias (SEM EXCEÇÃO)

| Elemento | Animação | Duração | Ease | Delay |
|----------|----------|---------|------|-------|
| PageHeader | fade-in + slide-y | 400ms | power2.out | 0ms |
| KPI Card 1 | fade-in + slide-y | 500ms | back.out | 0ms |
| KPI Card 2 | fade-in + slide-y | 500ms | back.out | 100ms |
| KPI Card 3 | fade-in + slide-y | 500ms | back.out | 200ms |
| KPI Card 4 | fade-in + slide-y | 500ms | back.out | 300ms |
| KPI Card 5 | fade-in + slide-y | 500ms | back.out | 400ms |
| Filter Bar | fade-in + slide-y | 400ms | power2.out | 300ms |
| DataTable Row 1 | fade-in + slide-x | 400ms | power2.out | 600ms |
| DataTable Row N | fade-in + slide-x | 400ms | power2.out | 600ms + (N*50ms) |
| Button Hover | scale-down | 200ms | power2.out | 0ms |
| Button Hover-Out | scale-up | 200ms | back.out | 0ms |
| Loading Skeleton | pulse (opacity) | 1000ms | sine.inOut | loop |
| Empty State | fade-in | 400ms | power2.out | 200ms |
| Error Toast | slide-up + fade-in | 300ms | back.out | 0ms |

### Verificação Exata

```bash
# Contar tags GSAP em Dashboard.tsx
grep -c "gsap\." src/components/Dashboard.tsx
# ✅ Mínimo obrigatório: 15 chamadas gsap

# Verificar ZERO uso de "transition-" em classes
grep -c "transition-" src/components/Dashboard.tsx
# ✅ Obrigatório: 0 (ZERO)

# Verificar ZERO animação CSS pura (@keyframes)
grep -c "@keyframes" src/components/Dashboard.tsx
# ✅ Obrigatório: 0 (ZERO)
```

### Teste de Animação

```bash
# Lighthouse Performance (sem GSAP jank)
lighthouse http://localhost:5173 --metrics-port=9222
# ✅ Score > 90 (Performance)
# ✅ CLS < 0.1
# ✅ Frame rate: 60fps (zero jank)
```

**Status ANTES:** ❌ 0 animações GSAP
**Alvo:** ✅ 15+ animações GSAP, 0 CSS transitions, 60fps

---

## 2. MOTION — FEEDBACK EM 100% DAS INTERAÇÕES

### Requisito Exato

**TODA interação do usuário DEVE ter feedback visual imediato (< 200ms).**

### Estados Obrigatórios (SEM EXCEÇÃO)

#### Button "Lançar Produção"
```typescript
// ✅ OBRIGATÓRIO: 3 estados
default: bg-[#176b4d] text-white
hover:   scale 0.95 + bg-[#0b4935] + shadow-md (GSAP)
focus:   ring-2 ring-[#f26a2e]/60 ring-offset-2 + color não muda
active:  scale 0.90 (200ms)
```

#### KPI Cards
```typescript
// ✅ OBRIGATÓRIO: 3 estados
default: cursor-pointer, border-[#dce3df]
hover:   bg-gray-50 + shadow-lg + scale 1.02 (GSAP)
focus:   ring-2 ring-[#f26a2e]/60 ring-offset-2
```

#### DataTable Rows
```typescript
// ✅ OBRIGATÓRIO: 3 estados
default: bg-white
hover:   bg-[#f7f8f6] + shadow-sm + cursor-pointer (GSAP)
active:  border-l-4 border-[#176b4d] + bg-green-50
```

#### PeriodFilter
```typescript
// ✅ OBRIGATÓRIO: feedback imediato
onClick: fade transition 300ms (GSAP)
change:  atualiza KPIs com fade-in (GSAP)
```

### Verificação Exata

```bash
# Contar elementos com role="button" ou tabIndex
grep -c "role=\"button\|tabIndex" src/components/Dashboard.tsx
# ✅ Mínimo: 8 (button principal + KPIs + 3 filtros)

# Verificar ZERO elementos sem hover state
grep -c "hover:" src/components/Dashboard.tsx
# ✅ Mínimo: 12 (todos elementos interativos)

# Verificar focus states
grep -c "focus-visible:ring" src/components/Dashboard.tsx
# ✅ Mínimo: 8 (todos elementos interativos)
```

### Teste de Motion

```bash
# Usar Chrome DevTools - Animations panel
# ✅ Todas animações visíveis
# ✅ Nenhuma animation > 600ms total
# ✅ Keyboard Tab navigation funciona
```

**Status ANTES:** ❌ Só hover básico em botão
**Alvo:** ✅ 8+ elementos com hover, 8+ com focus, 100% teclado acessível

---

## 3. DESEMPENHO & OTIMIZAÇÃO — MÉTRICAS EXATAS

### Requisito Exato

**Lighthouse > 90 em TODAS as categorias. Zero compromisso.**

### Métricas Obrigatórias (EXATAS)

| Métrica | Valor Obrigatório | Ferramenta |
|---------|-------------------|-----------|
| Lighthouse Performance | > 90 | Chrome DevTools Lighthouse |
| Lighthouse Accessibility | > 90 | Chrome DevTools Lighthouse |
| Lighthouse Best Practices | > 90 | Chrome DevTools Lighthouse |
| Lighthouse SEO | > 90 | Chrome DevTools Lighthouse |
| First Contentful Paint (FCP) | < 1.0s | Lighthouse / Web Vitals |
| Largest Contentful Paint (LCP) | < 2.5s | Lighthouse / Web Vitals |
| Cumulative Layout Shift (CLS) | < 0.1 | Lighthouse / Web Vitals |
| Time to Interactive (TTI) | < 2.5s | Lighthouse / Profiler |
| Bundle Size (Dashboard.tsx) | < 50KB minified | npm build + analyze |
| Frames Per Second (FPS) | 60 constant | Chrome DevTools Performance |
| Main Thread Blocking | < 50ms | Chrome DevTools Performance |

### Verificação Exata

```bash
# 1. Run Lighthouse
npm run lighthouse
# ✅ Score exato > 90 em TODAS categorias

# 2. Bundle analysis
npm run build && npm run analyze
# ✅ Dashboard.js < 50KB minified

# 3. Performance profiling
npm run profile
# ✅ FCP < 1.0s
# ✅ LCP < 2.5s
# ✅ CLS < 0.1
# ✅ TTI < 2.5s

# 4. Frame rate test
# Abrir Chrome DevTools > Rendering tab
# ✅ 60fps constant (zero dropped frames)
```

### Otimizações Obrigatórias

```typescript
// ✅ OBRIGATÓRIO: Memoização agressiva
const kpis = useMemo(() => calculateDashboardKpis(...), [periodo, props]);
const obrasAtivas = useMemo(() => filter(...), [props.obras]);
const obraColumns = useMemo(() => [...], []);

// ✅ OBRIGATÓRIO: Lazy loading
const DataTable = lazy(() => import('./DataTable'));

// ✅ OBRIGATÓRIO: Virtual scroll se > 50 rows
{obrasAtivas.length > 50 && <VirtualList rows={obrasAtivas} />}

// ✅ OBRIGATÓRIO: Image optimization
{/* Sem images, mas se houver: lazy + decode async */}

// ✅ OBRIGATÓRIO: Debounce
const handlePeriodoChange = useMemo(
  () => debounce(setPeriodo, 300),
  []
);
```

**Status ANTES:** ❌ Não otimizado
**Alvo:** ✅ Lighthouse 90+, FCP < 1s, LCP < 2.5s, 60fps

---

## 4. PADRÃO VISUAL — MEDIÇÕES PIXEL-PERFECT

### Requisito Exato

**ZERO tolerância para desvios. Cada cor, cada tamanho, cada espaçamento = EXATO.**

### Tipografia (EXATA, EM PIXELS)

| Elemento | Tamanho | Weight | Line-Height | Letter-Spacing | Cor |
|----------|---------|--------|-------------|-----------------|-----|
| PageHeader Title | 28px | 900 | 1.2 | -0.02em | #101c18 |
| PageHeader Eyebrow | 12px | 600 | 1 | +0.08em | #47555c |
| PageHeader Description | 14px | 400 | 1.5 | 0 | #718087 |
| KPI Label | 12px | 600 | 1 | +0.08em | #47555c |
| KPI Value | 32px | 900 | 1 | 0 (tabular) | #101c18 |
| KPI Unit | 12px | 400 | 1 | 0 | #8a969b |
| Table Header | 12px | 600 | 1 | +0.08em | #47555c |
| Table Body | 14px | 400 | 1.5 | 0 | #172329 |
| Table Caption | 11px | 400 | 1.4 | 0 | #718087 |
| Button Text | 14px | 600 | 1 | 0 | #ffffff |

### Verificação Exata

```bash
# Usar DevTools Computed Styles
# ✅ Cada elemento tem tamanho EXATO (pixel-perfect)
# ✅ Nenhum "clamp()" ou valor dinâmico em tipografia

# Para cada elemento, verificar:
window.getComputedStyle(element).fontSize
# ✅ 28px, 14px, 12px, 32px (valores exatos)

window.getComputedStyle(element).fontWeight
# ✅ 400, 600, 900 (valores exatos)
```

### Cores (EXATAS, HEX)

```
Primary:       #176b4d (verde RENEA)
Accent:        #f26a2e (laranja RENEA)
Neutral Dark:  #101c18 (preto)
Neutral Med:   #172329 (cinza escuro)
Neutral Light: #718087 (cinza médio)
Neutral Pale:  #8a969b (cinza claro)
Neutral:       #47555c (cinza labels)
Background:    #f7f8f6 (quase branco)
Card BG:       #ffffff (branco)
Border:        #dce3df (cinza borda)
```

**Verificação Exata:**
```bash
# Para cada elemento, verificar cor exata
window.getComputedStyle(element).backgroundColor
# ✅ rgb(...) que converte exatamente para #176b4d, #f26a2e, etc.
```

### Espaçamento (EXATO, EM REM)

| Espaço | Valor | Pixels |
|--------|-------|--------|
| Gap entre items | 1rem | 16px |
| Gap entre seções | 1.5rem | 24px |
| Padding interna (mobile) | 1rem | 16px |
| Padding interna (desktop) | 1.5rem | 24px |
| Border radius cards | 8px | 0.5rem |
| Border radius buttons | 8px | 0.5rem |

**Verificação Exata:**
```bash
# Para cada elemento container
window.getComputedStyle(element).gap
# ✅ 16px ou 24px (NUNCA 20px, 14px, etc.)

window.getComputedStyle(element).padding
# ✅ 16px ou 24px
```

### Borders (EXATAS)

```
Cards:      1px solid #dce3df
Buttons:    1px solid transparent (hover: #176b4d)
Inputs:     1px solid #dce3df
Focus:      2px solid #f26a2e (ring-offset: 2px)
```

**Status ANTES:** ⚠️ Parcial (tamanhos inconsistentes)
**Alvo:** ✅ 100% pixel-perfect em cores, tipografia, espaçamento

---

## 5. PADRÃO DE CABEÇALHO — ESTRUTURA IMUTÁVEL

### Requisito Exato

**Estrutura HTML IDÊNTICA em TODAS 15 abas. Zero variação.**

### Código Obrigatório

```typescript
// ✅ OBRIGATÓRIO: Exatamente assim
<PageHeader
  eyebrow="CONTEXTO ABA"
  title="Nome da Aba"
  description="Descrição secundária"
  actions={
    <button
      className="inline-flex items-center gap-2 
                 rounded-lg bg-[#176b4d] px-4 py-2
                 text-sm font-semibold text-white
                 hover:bg-[#0b4935]
                 focus-visible:ring-2 focus-visible:ring-[#f26a2e]/60
                 focus-visible:ring-offset-2"
    >
      <Icon className="size-4" />
      Ação Principal
    </button>
  }
/>
```

### Requisitos de Layout

```
┌─────────────────────────────────────────────┐
│ EYEBROW (12px, uppercase)                   │
│ Título Principal (28px, font-black)  [BTN]  │
│ Descrição (14px, gray)                      │
└─────────────────────────────────────────────┘
```

**Verificação Exata:**

```bash
# Para cada aba, rodar este teste
const header = document.querySelector('[data-testid="page-header"]');

// ✅ Verifica eyebrow existe
header.querySelector('[data-testid="eyebrow"]')
  .textContent.toUpperCase() === 'CONTEXTO ABA'

// ✅ Verifica título tamanho
getComputedStyle(header.querySelector('h1')).fontSize === '28px'
getComputedStyle(header.querySelector('h1')).fontWeight === '900'

// ✅ Verifica ação principal existe
header.querySelector('[data-testid="action-button"]').exists === true

// ✅ Verifica cor botão
getComputedStyle(header.querySelector('button')).backgroundColor 
  === 'rgb(23, 107, 77)' // #176b4d
```

**Status ANTES:** ⚠️ Parcial
**Alvo:** ✅ Idêntico em 100% das abas

---

## 6. INTERATIVIDADE — ACESSIBILIDADE TOTAL

### Requisito Exato

**Acessibilidade WCAG 2.1 AAA (nível máximo). Sem exceção.**

### Estados Obrigatórios (SEM EXCEÇÃO)

| Estado | Requisito | Teste |
|--------|-----------|-------|
| Default | Visível, clickable | Visual |
| Hover | Bg/scale change GSAP | Manual test |
| Focus | ring-2 ring-[#f26a2e]/60 | Tab key |
| Active | Color/scale change | Click test |
| Disabled | opacity-50 + cursor-not-allowed | Visual |
| Loading | Skeleton com pulsação GSAP | Temporal test |
| Empty | Ícone + mensagem amigável | Data test |
| Error | Ícone alerta + message + retry | Error test |

### Acessibilidade (WCAG 2.1 AAA)

```typescript
// ✅ OBRIGATÓRIO: ARIA labels
<button aria-label="Lançar produção para a obra">

// ✅ OBRIGATÓRIO: Role semântico
<div role="button" tabIndex={0}>

// ✅ OBRIGATÓRIO: Keyboard navigation
onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') handleClick();
  if (e.key === 'Escape') handleClose();
}}

// ✅ OBRIGATÓRIO: Color contrast > 4.5:1
// Verificar com acessibilityinsights.io

// ✅ OBRIGATÓRIO: Focus order lógico
// Tab deve seguir ordem visual
```

### Verificação Exata

```bash
# 1. Axe DevTools scan
axe-core scan Dashboard
# ✅ 0 violations
# ✅ 0 warnings

# 2. WAVE scan
WAVE Dashboard
# ✅ 0 errors
# ✅ 0 contrast errors

# 3. Manual keyboard test
# Tab → todos elementos clicáveis
# Enter → executa ação
# Escape → fecha modal
# ✅ TODOS funcionam

# 4. Screen reader test (NVDA ou JAWS)
# ✅ Anuncia titulo, labels, estados
```

**Status ANTES:** ❌ Sem labels ARIA
**Alvo:** ✅ WCAG 2.1 AAA, 0 violations

---

## 🚨 CHECKPOINT FINAL

### Checklist de Aceitação (SEM MARGEM)

- [ ] **GSAP:** 15+ animações, 0 CSS transitions, 60fps mantido
- [ ] **MOTION:** 8+ hover, 8+ focus, 100% keyboard accessible
- [ ] **DESEMPENHO:** Lighthouse > 90 (4 categorias), FCP < 1s, LCP < 2.5s, CLS < 0.1
- [ ] **VISUAL:** Tipografia pixel-perfect, cores exatas, espaçamento Tailwind rigoroso
- [ ] **CABEÇALHO:** Estrutura idêntica a PageHeader padrão, eyebrow + title + description + actions
- [ ] **INTERATIVIDADE:** WCAG 2.1 AAA, 0 violations, todos estados visuais implementados

### Teste Final (OBRIGATÓRIO)

```bash
# 1. Build & analyze
npm run build && npm run analyze
✅ Dashboard < 50KB

# 2. Lighthouse
npm run lighthouse
✅ Performance > 90
✅ Accessibility > 90
✅ Best Practices > 90
✅ SEO > 90

# 3. Axe scan
axe-core scan
✅ 0 violations

# 4. E2E tests (Playwright)
npm run test:e2e
✅ 100% animações GSAP
✅ 100% interatividade
✅ 100% responsividade

# 5. Performance profiling
Chrome DevTools Performance tab
✅ 60fps constant
✅ Main thread < 50ms
✅ CLS < 0.1
```

### Resultado Final

**Score:** 100% ou REPROVADO

**Não há meio termo. Não há "bom o suficiente".**

Cada critério DEVE estar em 100%. Se um estiver em 95%, é REPROVADO.

---

## 📋 AÇÃO AGORA

**Reescrever Dashboard.tsx com RIGIDEZ EXTREMA.**

Não é refactor — é reimplementação completa com precisão milimétrica.

**Timeline:** 1 dia (6-8 horas dedicadas)

**Aprovação:** 100% em TODOS os 6 critérios ou volta ao início.

**Depois:** Modo Campo com mesma rigidez.
