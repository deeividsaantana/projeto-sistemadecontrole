# 🧪 SPIKE 003: Compound Component Pattern

## ⚠️ VEREDITO: PARTIAL

---

## 📊 Resultados

| Critério | Avaliação | Nota |
|----------|-----------|------|
| ✅ Funciona? | Perfeitamente | 10/10 |
| 📦 Performance? | Boa (mas sem lazy load) | 7/10 |
| 🛠️ Manutenibilidade? | Boa | 8/10 |
| 🔧 Testabilidade? | Média (mockar Context) | 6/10 |
| 📦 Bundle size? | Média (sem code splitting) | 6/10 |
| 📚 Curva aprendizado? | **ALTA** (padrão avançado) | **4/10** |

**Média: 6.8/10** ⭐⭐⭐

---

## ✅ Pontos Fortes

### **1. Composição Flexível**

```tsx
<PessoasPresenca {...props}>
  <PessoasPresenca.Header>
    <nav>Abas</nav>
  </PessoasPresenca.Header>
  
  <PessoasPresenca.Filtros />
  
  {view === 'painel' && <PessoasPresenca.Painel />}
  {view === 'equipes' && <PessoasPresenca.Equipes />}
</PessoasPresenca>
```

**Vantagens:**
- ✅ Extremamente flexível
- ✅ Fácil adicionar novos sub-componentes
- ✅ API clara e auto-documentada

---

### **2. Context Interno (Sem Props Drilling)**

```tsx
function Painel() {
  const { presencasLink, globalData } = usePessoasPresenca();
  // Sem props drilling!
}
```

---

### **3. Encapsulamento**

Estado e lógica ficam encapsulados no Context:
- Sub-componentes não recebem props
- Tudo vem do `usePessoasPresenca()`

---

## ❌ Pontos Fracos

### **1. Curva de Aprendizado ALTA**

**Compound Pattern é avançado:**
- Precisa entender Context API
- Precisa entender `Object.assign` para compound
- Precisa entender pattern de composition

**Tempo de aprendizado:** 4-6h (vs 1-2h do Zustand)

---

### **2. Sem Lazy Load Automático**

Todos sub-componentes no MESMO arquivo:

```tsx
// Tudo carrega de uma vez
export const PessoasPresenca = Object.assign(PessoasPresencaRoot, {
  Header,   // +50 linhas
  Filtros,  // +50 linhas
  Painel,   // +100 linhas
  Equipes,  // +150 linhas
  Colaboradores, // +200 linhas
});
```

**Resultado:**
- Bundle inicial carrega TUDO
- Sem code splitting automático
- Precisa implementar lazy load MANUAL

---

### **3. Testabilidade Média**

Cada teste precisa mockar Context:

```tsx
test('Painel renderiza métricas', () => {
  // Precisa mockar Context inteiro
  const mockContext = {
    presencasLink: [...],
    globalData: '2026-10-28',
    // ... todos outros valores
  };
  
  render(
    <PessoasPresencaContext.Provider value={mockContext}>
      <Painel />
    </PessoasPresencaContext.Provider>
  );
});
```

**Problema:**
- Mock verboso
- Difícil manter sincronizado com Context real

---

### **4. Sem URL Routing Nativo**

Roteamento precisa ser implementado FORA:

```tsx
// Pai precisa gerenciar view
const [view, setView] = useState('painel');

<PessoasPresenca {...props}>
  {view === 'painel' && <PessoasPresenca.Painel />}
  {view === 'equipes' && <PessoasPresenca.Equipes />}
</PessoasPresenca>
```

**Problema:**
- Sem deep linking
- Sem histórico do navegador
- Refresh volta pro início

---

## 🎯 Quando Usar Este Padrão?

### ✅ **BOM PARA:**

1. **Design Systems** (Radix UI, Reach UI)
   ```tsx
   <Accordion>
     <Accordion.Item>
       <Accordion.Trigger />
       <Accordion.Content />
     </Accordion.Item>
   </Accordion>
   ```

2. **Componentes de UI reutilizáveis**
   - Tabs, Accordion, Dialog, Dropdown
   - Onde flexibilidade > performance

3. **Equipe experiente**
   - Já conhece Compound Pattern
   - Aprecia composição avançada

---

### ❌ **NÃO IDEAL PARA:**

1. **Features de aplicação** (como Pessoas & Presença)
   - Precisa de lazy load
   - Precisa de URL routing
   - Manutenibilidade > flexibilidade

2. **Equipe júnior/média**
   - Curva de aprendizado alta
   - Padrão menos conhecido

---

## 📐 Comparação com Spike 002

| Aspecto | Spike 002 (Router) | Spike 003 (Compound) |
|---------|-------------------|---------------------|
| Curva aprendizado | 1-2h (Zustand) | 4-6h (Compound) |
| Lazy load | ✅ Automático | ❌ Manual |
| URL routing | ✅ Sim | ❌ Não |
| Testabilidade | Excelente | Média |
| Flexibilidade | Boa | **Excelente** |
| Code splitting | ✅ Sim | ❌ Não |
| Bundle inicial | 40% | 100% |

---

## 🎯 Conclusão

**⚠️ PARTIAL** - Funciona, mas NÃO É A MELHOR opção para este caso.

**Motivos:**
- ❌ Curva de aprendizado ALTA
- ❌ Sem lazy load automático
- ❌ Sem URL routing
- ⚠️ Testabilidade média

**Melhor usar Spike 002 (State + Router):**
- ✅ Lazy load automático
- ✅ URL routing
- ✅ Curva de aprendizado BAIXA
- ✅ Testabilidade excelente

---

## 💡 Recomendação

**⚠️ NÃO usar para Pessoas & Presença.**

**✅ Reservar para:**
- Design System da RENEA (futuro)
- Componentes de UI compartilhados
- Quando flexibilidade for CRÍTICA

**✅ Para esta feature:**
- Usar **Spike 002 (State + Router)**

---

**Data:** 28/10/2026  
**Tempo gasto:** 45min  
**Veredito final:** ⚠️ PARTIAL (não recomendado para este caso)
