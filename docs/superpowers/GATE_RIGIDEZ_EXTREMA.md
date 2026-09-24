# Gate — Rigidez Extrema (Bloqueio de Progressão)

**Regra Ouro:** Próxima aba BLOQUEADA até aba atual = 100% em TODOS 6 critérios.

---

## 🚨 Critérios de Aprovação (Binary)

Cada aba tem 6 critérios. Para PASSAR:

```
✅ GSAP Animações         = 100% ou BLOQUEADO
✅ Motion/Interatividade   = 100% ou BLOQUEADO
✅ Desempenho             = 100% ou BLOQUEADO
✅ Padrão Visual          = 100% ou BLOQUEADO
✅ Padrão Header          = 100% ou BLOQUEADO
✅ Acessibilidade         = 100% ou BLOQUEADO

RESULTADO: APROVADO (6/6) ou REPROVADO (< 6/6)
```

**SEM EXCEÇÕES. SEM "BOM O SUFICIENTE".**

---

## 📊 Status das Abas

### Aba 1: Dashboard
- **Status**: ✅ VALIDAÇÃO EM ANDAMENTO (Dia 2026-09-24)
- **Checklist**: 
  - [ ] Lighthouse > 90 (4 categorias)
  - [ ] Performance: FCP < 1s, LCP < 2.5s, CLS < 0.1
  - [ ] Bundle < 50KB
  - [ ] E2E: 33/33 testes ✅
  - [ ] Axe: 0 violations
  - [ ] Smoke test: PASS
  - [ ] Deploy Render: LIVE
- **Bloqueio**: Próxima aba (Materiais) está BLOQUEADA até Dashboard = APROVADO

### Aba 2: Materiais
- **Status**: 📋 BLOQUEADO (aguarda Dashboard aprovação)
- **Data Planejada**: 2026-09-25 (se Dashboard aprovado hoje)
- **Checklist**: Mesmos 6 critérios

### Abas 3-15: (Ordem a definir)
- **Status**: 📋 BLOQUEADO
- **Progressão**: Cada aba desbloqueia após anterior = APROVADO

---

## ✅ Checklist de Aprovação — Dashboard

**Validator**: Deploy + verificação em produção

| Item | Target | Status | Evidence |
|------|--------|--------|----------|
| Lighthouse Performance | > 90 | ⏳ | (rodando) |
| Lighthouse Accessibility | > 90 | ⏳ | (rodando) |
| Lighthouse Best Practices | > 90 | ⏳ | (rodando) |
| Lighthouse SEO | > 90 | ⏳ | (rodando) |
| FCP | < 1.0s | ⏳ | (rodando) |
| LCP | < 2.5s | ⏳ | (rodando) |
| CLS | < 0.1 | ⏳ | (rodando) |
| TTI | < 2.5s | ⏳ | (rodando) |
| Bundle | < 50KB | ⏳ | (rodando) |
| E2E Tests | 33/33 ✅ | ✅ | 19/19 rigor + 10/10 usability + 4/4 kpi |
| Axe Violations | 0 | ⏳ | (rodando) |
| Smoke Test | PASS | ⏳ | (rodando) |
| Produção | LIVE | ⏳ | (fazendo deploy) |

---

## 🔒 Bloqueio Automático

**Regra**: Se Dashboard ≠ APROVADO, Materiais não pode começar.

**Checklist de Gate**:
```
[ ] Lighthouse: 4/4 > 90? SIM
[ ] Performance: FCP, LCP, CLS, TTI OK? SIM
[ ] Bundle: < 50KB? SIM
[ ] E2E: 33/33 pass? SIM
[ ] Axe: 0 violations? SIM
[ ] Smoke: PASS? SIM
[ ] Deploy: LIVE em Render? SIM

SE TUDO SIM → Dashboard APROVADO → Materiais DESBLOQUEADO
SE ALGUM NÃO → Dashboard REPROVADO → Redo + revalidar
```

---

## 📍 Próximas Etapas

**AGORA (Dia 2026-09-24)**:
1. Rodar Lighthouse
2. Performance profiling
3. Axe scan
4. Smoke test
5. Deploy Render
6. **Decisão**: Dashboard aprovado?

**SE SIM** → Materiais desbloqueado para amanhã
**SE NÃO** → Fix + revalidar até 100%

---

## 📝 Notas

- Este gate PERMANECE para todas 15 abas
- Cada aba precisa 100% em 6 critérios antes de próxima
- Não há "próxima semana fix" — tudo deve ser 100% antes de deploy
- Checklist é verificado em produção (não local)

**Vamos começar Dashboard agora.**
