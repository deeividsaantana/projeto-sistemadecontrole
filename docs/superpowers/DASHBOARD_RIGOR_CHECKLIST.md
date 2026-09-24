# Dashboard — Checklist de Rigor MÁXIMO

**Objetivo:** Dashboard EXCELENTE — não aceitamos "bom o suficiente"

**Status:** ❌ FALHA em múltiplos critérios. Reescrever com rigor.

---

## ✅ TIER 1: Funcionalidade Base (PASSANDO)

- [x] KPIs calculados corretamente (4/4 testes)
- [x] Período selecionável (PeriodFilter)
- [x] Tabela de obras (DataTable)
- [x] Responsivo (1/2/3 cols)
- [x] Lint + build OK

---

## ❌ TIER 2: Padrão Visual Unificado (FALHA)

- [ ] **GSAP animações**
  - [ ] KPIs: fade-in + stagger (0.1s delay entre cards)
  - [ ] Tabela: slide-up + fade (delay 0.3s após KPIs)
  - [ ] Total: < 800ms end-to-end
  - [ ] Suave (ease-out ou power2.out)
  - **Status:** ❌ ZERO animações

- [ ] **Hierarquia visual clara**
  - [ ] PageHeader: destaque maior que KPIs
  - [ ] KPIs: ênfase em valor (não label)
  - [ ] Tabela: menor destaque (dados secundários)
  - [ ] Espaçamento consistente (Tailwind gap-4, gap-6)
  - **Status:** ❌ Tudo tem mesmo destaque

- [ ] **Cores padrão RENEA**
  - [ ] Primary: #176b4d (verde)
  - [ ] Accent: #f26a2e (laranja)
  - [ ] Neutral: #718087 (cinza)
  - [ ] Background: #f7f8f6 (quase branco)
  - [ ] Cards: #ffffff com border #dce3df
  - **Status:** ❌ Cores inconsistentes (KPI cards sem variação de cor por tipo)

- [ ] **Tipografia profissional**
  - [ ] h1 (title): 28px, font-black, tracking-tight
  - [ ] h2/label: 14px, font-semibold, uppercase
  - [ ] body: 14px, font-normal
  - [ ] valor KPI: 32px, font-bold, tabular-nums
  - [ ] Consistent line-height (1.5)
  - **Status:** ❌ Falta variação de tamanho (todos 14px/16px)

---

## ❌ TIER 3: Interatividade & Feedback Visual (FALHA)

- [ ] **Hover states em TODOS os elementos interativos**
  - [ ] Botão "Lançar Produção": scale-down + color shift
  - [ ] KPI cards: bg-white/85 + cursor-pointer (se clicável)
  - [ ] Tabela rows: bg-gray-50 + cursor-pointer
  - [ ] Todos com `transition duration-200`
  - **Status:** ❌ Só botão tem hover, cards não

- [ ] **Focus states para acessibilidade**
  - [ ] ring-2 ring-offset-1 ring-[#f26a2e]/60 em TODOS os botões
  - [ ] Focus trap em modal (se houver)
  - [ ] Teclado navegável (Tab, Enter, Escape)
  - **Status:** ❌ Só botão tem focus, PeriodFilter sem focus

- [ ] **Feedback visual de ação**
  - [ ] Clique em KPI: muda cor + icon aparece
  - [ ] Clique em obra: abre modal/detalhes
  - [ ] Carregamento: skeleton loader, não vazio
  - [ ] Erro: mensagem clara + botão retry
  - **Status:** ❌ Sem feedback de ação nenhum

- [ ] **Estados de dados**
  - [ ] Vazio: ícone grande + mensagem amigável
  - [ ] Carregando: skeleton com pulsação (GSAP)
  - [ ] Erro: ícone alerta + mensagem técnica (log) + retry
  - [ ] Sucesso: toast ou badge confirmação
  - **Status:** ❌ Sem tratamento nenhum (assume dados sempre existem)

---

## ❌ TIER 4: Dados & Formatação (FALHA)

- [ ] **Formatação de números**
  - [ ] KPI: números > 999 com separador (1.234 ou 1,234)
  - [ ] Percentual: com % no final
  - [ ] Duração: em dias, semanas, meses (não apenas número)
  - **Status:** ❌ Números crus sem formatação

- [ ] **Formatação de datas**
  - [ ] Período na descrição: DD/MM/YYYY (não YYYY-MM-DD)
  - [ ] Hover: tooltip com data completa
  - **Status:** ❌ Data em formato ISO (confuso para usuário)

- [ ] **Validação de dados**
  - [ ] Dados null/undefined: mostrar "—" ou "Sem dados"
  - [ ] Arrays vazios: mensagem específica
  - [ ] Valores inválidos: log + fallback visual
  - **Status:** ❌ Assume dados sempre válidos

- [ ] **Operações avançadas**
  - [ ] Eficiência por obra (não só média)
  - [ ] Trending (produção sobe/desce)
  - [ ] Alerta de atraso (obras > 30 dias sem produção)
  - [ ] Meta vs realizado
  - **Status:** ❌ Só métricas simples

---

## ❌ TIER 5: Testes & Qualidade (FALHA)

- [ ] **Testes unitários**
  - [ ] calculateDashboardKpis: 4/4 ✅
  - [ ] Formatação números: 3+ casos
  - [ ] Formatação datas: 3+ casos
  - [ ] Casos vazios: 3+ casos
  - **Status:** ⚠️ Só KPI calculations testado

- [ ] **Testes de componente (RTL)**
  - [ ] Renderiza sem erro
  - [ ] KPIs visíveis com valores corretos
  - [ ] Tabela renderiza com dados
  - [ ] Filtro de período funciona
  - [ ] Clique em KPI filtra tabela
  - [ ] Clique em obra abre detalhes
  - [ ] Responsivo: 375px, 768px, 1440px
  - **Status:** ❌ Sem testes de componente

- [ ] **Testes E2E (Playwright)**
  - [ ] Load page → verificar todos elementos
  - [ ] Change period → KPIs atualizam
  - [ ] Click KPI → table filters
  - [ ] Click row → details open
  - [ ] Mobile: tap elements work
  - [ ] Acessibilidade: keyboard navigate
  - **Status:** ❌ Zero testes E2E

- [ ] **Performance**
  - [ ] First paint < 1s
  - [ ] TTI < 2s
  - [ ] Lighthouse score > 90
  - [ ] Bundle size: < 50KB (Dashboard code)
  - **Status:** ❓ Não medido

- [ ] **Acessibilidade (a11y)**
  - [ ] ARIA labels em TODOS os elementos
  - [ ] Color contrast > 4.5:1 para texto
  - [ ] Focus order logical
  - [ ] Screen reader friendly
  - [ ] Keyboard navigation completa
  - **Status:** ❌ Sem labels ARIA

---

## ❌ TIER 6: Integração com Dados Reais (FALHA)

- [ ] **Firebase integration**
  - [ ] Dados carregam de Firebase (não mockados)
  - [ ] Atualização em tempo real (listener)
  - [ ] Cache local (offline support)
  - [ ] Retry automático em erro
  - **Status:** ❌ Props passados, sem integração real

- [ ] **Sincronização**
  - [ ] Período reflete em URL (deep link)
  - [ ] Estado persiste em localStorage
  - [ ] Múltiplas abas sincronizam
  - **Status:** ❌ Estado em memória

- [ ] **Segurança**
  - [ ] Dados filtrados por role (empresa/frente)
  - [ ] Sem exposição de dados sensíveis
  - [ ] Validação de entrada
  - **Status:** ❌ Sem validação

---

## 📊 Score: 18% (REPROVADO)

| Tier | Score | Status |
|------|-------|--------|
| Base | 100% | ✅ OK |
| Visual | 20% | ❌ CRÍTICO |
| Interatividade | 10% | ❌ CRÍTICO |
| Dados | 15% | ❌ CRÍTICO |
| Testes | 5% | ❌ CRÍTICO |
| Integração | 0% | ❌ CRÍTICO |
| **TOTAL** | **18%** | **❌ REPROVADO** |

---

## 🛠️ Ação Necessária

**Reescrever Dashboard.tsx com rigor.**

Não é ajuste — é redesenho completo que atenda TODOS os Tiers.

**Tempo estimado:** 6-8 horas (1 dia de trabalho dedicado)

**Não prosseguir para Modo Campo até Dashboard = 100%**
