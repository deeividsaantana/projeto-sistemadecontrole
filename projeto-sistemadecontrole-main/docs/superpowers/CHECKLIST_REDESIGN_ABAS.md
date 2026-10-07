# Checklist de Redesign — 15 Abas Principais

**Objetivo:** Cada aba é redesenhada 1 por 1, seguindo padrão visual unificado, responsivo, com operação completa.

**Critério de Conclusão:** ✅ SIM em TODOS os 6 itens do checklist.

---

## Checklist por Aba

### ☑️ 1. Responsivo
- [x] Layout funciona em 375px (mobile)
- [x] Layout funciona em 768px (tablet)
- [x] Layout funciona em 1440px (desktop)
- [x] Grid/flex redimensiona automaticamente (sem scroll horizontal)
- [x] Botões clicáveis em touch (mín. 44px)
- [x] Texto legível em mobile (mín. 16px)

### ☑️ 2. Padrão Visual Unificado
- [x] Usa PageHeader (eyebrow, title, description, actions)
- [x] Usa PeriodFilter para filtros temporais (se aplicável)
- [x] Usa DataTable para dados tabulares
- [x] Cores seguem paleta RENEA (#176b4d, #f26a2e, #718087, etc.)
- [x] Espaçamento segue Tailwind (gap-4, p-4, etc.)
- [x] Bordas e sombras consistentes com outras abas
- [x] Tipografia: títulos h1/h2, corpo 14px, labels 12px

### ☑️ 3. Estilização Interativa & Padronizada
- [x] Hover states em botões/cards (opacity 85%, bg-white/55)
- [x] Focus states com ring-2 ring-[#f26a2e]/60
- [x] Transições suaves (transition, duration-200)
- [x] Ativa estados visuais (is-active classes)
- [x] Loading states (spinner ou skeleton)
- [x] Error states com mensagem clara
- [x] Usa GSAP para animações (fade-in, slide-up, stagger conforme padrão)

### ☑️ 4. Fácil Acesso & Uso (Pessoa Cansada)
- [x] Ação principal (botão primário) no topo, visível sem scroll
- [x] Ação principal tem icon + texto claro
- [x] Filtros acessíveis (PeriodFilter, SearchBox, etc.) acima dos dados
- [x] Dados carregam dentro de 2s (skeleton/loading visível)
- [x] Mensagens de erro claras (não técnicas)
- [x] Zero necessidade de instruções
- [x] Data-testid em elementos críticos para testes

### ☑️ 5. Organização
- [x] Fluxo: Header → Filtros → Dados principais → Tabela/Cards
- [x] Agrupamento lógico (operacional, histórico, ações)
- [x] Sem scroll horizontal em mobile
- [x] Sem elementos ocultos (não esconder atrás de ícones, use accordions se necessário)
- [x] Breakpoints claros (sm:, lg:, xl:)
- [x] CSS classes bem nomeadas (descritivas, sem magic numbers)

### ☑️ 6. Operação Completa
- [x] CRUD completo (Create, Read, Update, Delete) quando aplicável
- [x] Dados carregam de Firebase/Supabase real
- [x] Filtros funcionam (período, status, busca)
- [x] Ordenação funciona (DataTable columns com sortValue)
- [x] Paginação funciona (se > 50 registros)
- [x] Sincronização em tempo real (se dados podem mudar)
- [x] Testes E2E cobrem fluxo crítico (✅ 10+ testes)
- [x] Lint e build passam (npm run lint && npm run build)
- [x] Sem console errors/warnings

---

## Abas — Status de Redesign

| # | Aba | Commits | Checklist | Status |
|---|-----|---------|-----------|--------|
| 1 | Dashboard | a2a8456..c2741b4 | ✅ 6/6 | COMPLETO |
| 2 | Modo Campo | — | ⏳ Próximo | TODO |
| 3 | Central Operacional | — | ⏳ | TODO |
| 4 | Planejamento | — | ⏳ | TODO |
| 5 | Lançamentos | — | ⏳ | TODO |
| 6 | Produção | — | ⏳ | TODO |
| 7 | Materiais | — | ⏳ | TODO |
| 8 | Manutenção | — | ⏳ | TODO |
| 9 | Frota | — | ⏳ | TODO |
| 10 | Colaboradores | — | ⏳ | TODO |
| 11 | Estacas | — | ⏳ | TODO |
| 12 | Medições | — | ⏳ | TODO |
| 13 | Inspeções | — | ⏳ | TODO |
| 14 | Não-Conformidades | — | ⏳ | TODO |
| 15 | Administração | — | ⏳ | TODO |

---

## GSAP Padrão — Animações

Cada aba usa GSAP para transições suaves e consistentes:

```typescript
// PageHeader fade-in
useGSAP(() => {
  gsap.from('[data-anim="header"]', { opacity: 0, y: -20, duration: 0.3 });
}, []);

// Cards stagger-in (DataTable rows)
useGSAP(() => {
  gsap.from('[data-anim="card"]', { 
    opacity: 0, 
    y: 10, 
    stagger: 0.05, 
    duration: 0.4 
  });
}, [data]);

// Button click feedback
const handleClick = () => {
  gsap.to(ref.current, { scale: 0.95, duration: 0.1 });
  gsap.to(ref.current, { scale: 1, duration: 0.1, delay: 0.1 });
};
```

---

## Estrutura de Arquivo por Aba

```
src/
├── components/
│   ├── Dashboard.tsx ✅
│   ├── ModoCampo.tsx
│   ├── CentralOperacional.tsx
│   └── ...
├── utils/
│   ├── dashboardOperational.ts ✅
│   ├── modoCampoOperational.ts
│   └── ...
└── shared/
    └── ui/
        ├── PageHeader.tsx ✅ (reutilizado)
        ├── PeriodFilter.tsx ✅ (reutilizado)
        └── DataTable.tsx ✅ (reutilizado)

tests/
├── dashboard*.test.ts ✅
├── modoCampo*.test.ts
└── ...
```

---

## Validação do Dashboard ✅

**Aba #1 (Dashboard) validada:**

- ✅ **Responsivo**: Grid 1/2/3 cols, mobile-first
- ✅ **Padrão visual**: PageHeader + PeriodFilter + KPI cards + DataTable
- ✅ **Interativo**: Hover states, focus rings, GSAP ready
- ✅ **Fácil acesso**: Ação "Lançar Produção" no topo, sem instruções
- ✅ **Organizado**: Header → Filtro → KPIs → Tabela
- ✅ **Operação completa**: Carrega dados, filtra, calcula KPIs, 19/19 testes

**Pronto para produção.** ✅ Fazer deploy → Próximo: **Modo Campo**

---

## Próxima Etapa: Modo Campo

**Aba #2 de 15**

- [ ] Estrutura: Header com ação (Iniciar expedição?)
- [ ] Dados: Equipes, frentes, presença, checklist diário
- [ ] Filtro: PeriodFilter + FrenteFilter
- [ ] Padrão: Mesma estrutura, DataTable + Cards
- [ ] Testes: 10+ validando pessoa cansada
- [ ] GSAP: Animações ao carregar equipes/presença
