# 🔴 FASE 5: RED TEAM TEST + CHECKLIST (Análise Estática)

**Data:** 28/10/2026  
**Método:** Análise de código fonte + Estrutura arquitetural  
**Razão:** Ambiente dev sem Supabase Auth configurado

---

## 🔴 RED TEAM TEST: 10 Vetores de Ataque

### **1. AUTHENTICATION BYPASS** ❌ VULNERÁVEL

**Teste:** Tentar acessar rotas sem autenticação

**Código analisado:**
```tsx
// App.tsx linha ~4710
{activeTab === 'pessoas-beta' && (
  <PessoasPresencaBeta
    // Props passadas direto sem verificação de auth
  />
)}
```

**Vulnerabilidade:**
- ✅ **App.tsx tem verificação de isLoggedIn global** (linha ~4335)
- ✅ Módulo só renderiza se usuário autenticado
- ✅ Sem rotas públicas expondo dados

**Resultado:** ✅ **PROTEGIDO** (Auth global do App.tsx)

---

### **2. AUTHORIZATION BYPASS (Privilege Escalation)** ⚠️ ATENÇÃO

**Teste:** Usuário operador tentando deletar equipes (ação de admin)

**Código analisado:**
```tsx
// App.tsx linha ~4725
onDeleteGrupoEquipe={podeExcluirCadastro ? handleDeleteGrupoEquipe : undefined}
```

**Análise:**
- ✅ Validação de permissão via `podeExcluirCadastro`
- ✅ Callback só é passado se usuário tem permissão
- ❌ **FALTA:** Validação no handleDeleteGrupoEquipe também (defesa em profundidade)

**Recomendação:**
```tsx
const handleDeleteGrupoEquipe = (equipeId: string) => {
  // ADICIONAR AQUI:
  if (!podeExcluirCadastro) {
    addNotification('Sem permissão', 'Você não pode excluir equipes', 'error');
    return;
  }
  // ... resto do código
};
```

**Resultado:** ⚠️ **PARCIALMENTE PROTEGIDO** (falta double-check)

---

### **3. SQL INJECTION** ✅ N/A

**Teste:** Injetar SQL via inputs de busca/filtros

**Código analisado:**
```tsx
// useFiltragemGlobal.ts linha ~30
const busca = globalSearch.toLowerCase();
funcionariosFiltrados = funcionarios.filter(f =>
  f.nome?.toLowerCase().includes(busca) ||
  f.matricula?.toLowerCase().includes(busca)
);
```

**Análise:**
- ✅ **Sem banco SQL direto** (usa localStorage + Supabase client-side)
- ✅ Filtros são JavaScript puro (string.includes)
- ✅ Supabase usa parametrização automática

**Resultado:** ✅ **PROTEGIDO** (sem SQL direto)

---

### **4. XSS (Cross-Site Scripting)** ✅ PROTEGIDO

**Teste:** Injetar `<script>alert('XSS')</script>` em nome de colaborador

**Código analisado:**
```tsx
// ColaboradoresView.tsx linha ~280
<td className="py-3 px-4">{func.nome}</td>
```

**Análise:**
- ✅ **React escapa HTML automaticamente**
- ✅ Não usa `dangerouslySetInnerHTML`
- ✅ Inputs controlados (value={...})

**Teste prático:**
```tsx
// Se alguém cadastrar:
nome: "<script>alert('xss')</script>"

// React renderiza como TEXTO:
&lt;script&gt;alert('xss')&lt;/script&gt;
```

**Resultado:** ✅ **PROTEGIDO** (React auto-escape)

---

### **5. DATA LEAKAGE (Vazamento de Dados)** ⚠️ ATENÇÃO

**Teste:** Console.log expondo dados sensíveis

**Código analisado:**
```tsx
// store.ts - SEM console.logs ✅
// hooks/* - SEM console.logs ✅
// views/* - SEM console.logs ✅
```

**MAS:**

**Vulnerabilidade no localStorage:**
```tsx
// App.tsx linha ~1600+ (código existente, não nosso)
localStorage.setItem('renea_funcionarios', JSON.stringify(funcionarios));
localStorage.setItem('renea_presencas_link', JSON.stringify(presencasLink));
```

**Análise:**
- ❌ **localStorage é acessível via DevTools**
- ❌ Dados pessoais (CPF, matrícula, endereço) podem estar expostos
- ❌ Sem criptografia em repouso

**Recomendação:**
```tsx
// Usar SessionStorage (apaga ao fechar aba)
// Ou criptografar dados sensíveis:
import CryptoJS from 'crypto-js';

const encrypt = (data: any) => {
  const key = import.meta.env.VITE_STORAGE_KEY;
  return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
};

sessionStorage.setItem('renea_funcionarios', encrypt(funcionarios));
```

**Resultado:** ⚠️ **VULNERÁVEL** (localStorage não criptografado)

---

### **6. MASS ASSIGNMENT** ✅ PROTEGIDO

**Teste:** Enviar payload com campos extras não autorizados

**Código analisado:**
```tsx
// EquipesView.tsx linha ~180 (modal salvar)
const handleSave = () => {
  const equipe: GrupoEquipe = {
    id: equipeEditando?.id || `equipe-${Date.now()}`,
    nome: formData.nome,
    encarregado: formData.encarregado,
    // ... apenas campos conhecidos
  };
  onSaveGrupoEquipe(equipe);
};
```

**Análise:**
- ✅ **Construtores explícitos** (não usa {...payload})
- ✅ Apenas campos conhecidos são atribuídos
- ✅ TypeScript força tipagem

**Resultado:** ✅ **PROTEGIDO** (atribuição explícita)

---

### **7. RATE LIMITING** ❌ VULNERÁVEL

**Teste:** Spam de requisições (salvar equipe 100x/segundo)

**Código analisado:**
```tsx
// EquipesView.tsx - botão Salvar
<button onClick={handleSave}>Salvar</button>

// SEM debounce, SEM throttle, SEM rate limit
```

**Vulnerabilidade:**
- ❌ Usuário pode clicar 100x em 1 segundo
- ❌ Cria 100 equipes duplicadas
- ❌ Sobrecarrega localStorage

**Recomendação:**
```tsx
import { useState } from 'react';

const [isSaving, setIsSaving] = useState(false);

const handleSave = async () => {
  if (isSaving) return; // Rate limit simples
  setIsSaving(true);
  
  try {
    await onSaveGrupoEquipe(equipe);
  } finally {
    setTimeout(() => setIsSaving(false), 1000); // Cooldown 1s
  }
};

<button onClick={handleSave} disabled={isSaving}>
  {isSaving ? 'Salvando...' : 'Salvar'}
</button>
```

**Resultado:** ❌ **VULNERÁVEL** (sem rate limit)

---

### **8. IDOR (Insecure Direct Object Reference)** ✅ PROTEGIDO

**Teste:** Mudar URL `/pessoas/colaboradores/123` para `/pessoas/colaboradores/999` (colaborador de outra empresa)

**Código analisado:**
```tsx
// ColaboradoresView.tsx linha ~85
useEffect(() => {
  if (colaboradorIdUrl) {
    const colaborador = funcionariosFiltrados.find(f => f.id === colaboradorIdUrl);
    if (colaborador) {
      setColaboradorSelecionado(colaborador.id);
    }
  }
}, [colaboradorIdUrl, funcionariosFiltrados]);
```

**Análise:**
- ✅ **Busca apenas em funcionariosFiltrados** (já filtrados por empresa)
- ✅ Se ID não existir nos filtrados, não abre
- ✅ Sem fetch direto por ID sem validação

**Resultado:** ✅ **PROTEGIDO** (filtragem por empresa)

---

### **9. FILE UPLOAD** ✅ N/A

**Teste:** Upload de arquivo malicioso

**Análise:**
- ✅ **Módulo não tem upload de arquivos**
- ✅ Sem inputs type="file"

**Resultado:** ✅ **N/A** (funcionalidade não existe)

---

### **10. LGPD / PRIVACY VIOLATION** ⚠️ ATENÇÃO

**Teste:** Acessar dados pessoais sem consentimento/necessidade

**Código analisado:**
```tsx
// useFichaColaborador.ts - agrega TODOS dados do colaborador
const colaborador = funcionarios.find(f => f.id === colaboradorId);
const presencas = historicoPresencas.filter(...); // Últimas 30
const equipamentos = controlesEquipamentos.filter(...); // Todos
const viagens = ticketsJazida.filter(...); // Todas
```

**Vulnerabilidades LGPD:**

1. **Coleta excessiva:**
   - ❌ Carrega TODOS equipamentos operados (pode ter anos de histórico)
   - ❌ Carrega TODAS viagens (sem limite de tempo)
   - ⚠️ Necessidade questionável (princípio da minimização)

2. **Sem logs de acesso:**
   - ❌ Não registra QUEM acessou ficha de QUEM e QUANDO
   - ❌ LGPD exige auditoria de acesso a dados pessoais

3. **Sem consentimento explícito:**
   - ❌ Colaborador não consente visualização de seus dados
   - ❌ Sem termo de aceite LGPD

**Recomendações LGPD:**
```tsx
// 1. Limitar dados por tempo (minimização)
const equipamentos = controlesEquipamentos.filter(
  c => c.funcionarioId === colaboradorId &&
  new Date(c.data) > subDays(new Date(), 90) // Últimos 90 dias apenas
);

// 2. Adicionar log de acesso
const handleVisualizarFicha = (colaboradorId: string) => {
  logAcesso({
    tipo: 'VISUALIZACAO_FICHA',
    usuarioId: currentUser.id,
    colaboradorId,
    timestamp: new Date().toISOString(),
  });
  setColaboradorSelecionado(colaboradorId);
};

// 3. Termo de consentimento (primeira abertura)
if (!colaborador.consentimentoLGPD) {
  mostrarModalConsentimento();
}
```

**Resultado:** ⚠️ **VULNERÁVEL** (não conformidade LGPD)

---

## 📊 RESUMO RED TEAM

| Vetor | Status | Criticidade |
|-------|--------|-------------|
| 1. Authentication Bypass | ✅ Protegido | Baixa |
| 2. Authorization Bypass | ⚠️ Parcial | **MÉDIA** |
| 3. SQL Injection | ✅ N/A | Baixa |
| 4. XSS | ✅ Protegido | Baixa |
| 5. Data Leakage | ⚠️ Vulnerável | **ALTA** |
| 6. Mass Assignment | ✅ Protegido | Baixa |
| 7. Rate Limiting | ❌ Vulnerável | **MÉDIA** |
| 8. IDOR | ✅ Protegido | Baixa |
| 9. File Upload | ✅ N/A | Baixa |
| 10. LGPD Privacy | ⚠️ Vulnerável | **CRÍTICA** |

**Total:**
- ✅ Protegido: 5/10
- ⚠️ Atenção: 3/10
- ❌ Vulnerável: 2/10

---

## 🔧 CORREÇÕES OBRIGATÓRIAS (antes de produção):

### **CRÍTICO (fazer AGORA):**

1. **LGPD - Log de acesso a dados pessoais**
2. **LGPD - Limitar histórico (90 dias)**
3. **Data Leakage - Criptografar localStorage**

### **IMPORTANTE (fazer antes de release):**

4. **Rate Limiting - Botões Salvar/Excluir**
5. **Authorization - Double-check em callbacks**

---

**Status:** 5 correções necessárias antes de produção
