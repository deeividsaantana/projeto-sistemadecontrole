# 🧪 SPIKES: Validação de Arquitetura - Unificação Presença + Colaboradores

**Data:** 28/10/2026  
**Objetivo:** Validar 3 arquiteturas possíveis ANTES de implementar com TDD

---

## 📋 Spikes Planejados

| # | Nome | Conceito | Risco Validado | Status |
|---|------|----------|----------------|--------|
| 001 | Component Merger | Mesclar tudo num componente gigante | Manutenibilidade | 🔄 Em andamento |
| 002 | State + Router | Zustand + React Router + lazy load | Complexidade de estado | ⏳ Pendente |
| 003 | Compound Pattern | Componente raiz + sub-componentes compostos | Curva de aprendizado | ⏳ Pendente |

---

## 🎯 Critérios de Validação

Cada spike deve responder:

1. **✅ Funciona?** Protótipo roda sem erros críticos?
2. **📊 Performance?** Renderiza <100ms com 500 colaboradores?
3. **🛠️ Manutenibilidade?** Código fácil de entender e modificar?
4. **🔧 Testabilidade?** Consegue escrever testes unitários?
5. **📦 Bundle size?** Quanto aumenta o build final?

---

## 🚨 Regras dos Spikes

- ✅ Código descartável (não vai pra produção)
- ✅ Funcionalidade mínima (só o necessário pra validar)
- ✅ Sem testes (é protótipo)
- ✅ Sem polish de UI (pode ser feio)
- ❌ NÃO copiar código de spike pro TDD (reescrever do zero)

---

## 📝 Vereditos Possíveis

- **VALIDATED** ✅ — Arquitetura viável, pode seguir pro TDD
- **PARTIAL** ⚠️ — Funciona mas tem limitações/workarounds necessários
- **REJECTED** ❌ — Inviável, não usar

---

## 📂 Estrutura

```
spikes/
├── 001-component-merger/
│   ├── PessoasPresenca.tsx       # Componente único gigante
│   ├── VEREDICT.md               # Resultado + recomendação
│   └── package.json (se precisar deps extras)
│
├── 002-state-router/
│   ├── store.ts                  # Zustand store
│   ├── PessoasPresenca.tsx       # Componente raiz
│   ├── views/
│   │   ├── PainelView.tsx
│   │   ├── EquipesView.tsx
│   │   └── ColaboradoresView.tsx
│   ├── VEREDICT.md
│   └── package.json
│
└── 003-compound/
    ├── PessoasPresenca.tsx       # Componente raiz + Context
    ├── components/
    │   ├── Painel.tsx
    │   ├── Equipes.tsx
    │   └── Colaboradores.tsx
    ├── VEREDICT.md
    └── package.json
```

---

**Início:** 28/10/2026  
**Estimativa:** 3-4h
