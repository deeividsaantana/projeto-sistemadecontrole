# 🔒 INTEGRAÇÃO LGPD - Sistema RENEA

**Versão:** 1.0  
**Data:** 2025-01-15  
**Responsável:** Sistema Pessoas & Presença  

---

## 📋 VISÃO GERAL

Esta documentação descreve as **medidas técnicas implementadas** para conformidade com a **Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)** no Sistema RENEA.

---

## ✅ MEDIDAS IMPLEMENTADAS

### 1. **CRIPTOGRAFIA DE DADOS SENSÍVEIS** (Art. 46 LGPD)

**Arquivo:** `src/utils/lgpdStorage.ts`

#### Recursos:
- ✅ Criptografia **AES-256-GCM** (padrão NIST)
- ✅ Hash **SHA-256** para chaves (ofuscação)
- ✅ Web Crypto API nativa (sem dependências externas)
- ✅ IV aleatório por operação (segurança adicional)

#### Uso Básico:

```typescript
import { lgpdStorage } from '@/utils/lgpdStorage';

// ✅ SALVAR (auto-criptografa)
await lgpdStorage.setItem('user_cpf', '123.456.789-00');

// ✅ BUSCAR (auto-descriptografa)
const cpf = await lgpdStorage.getItem('user_cpf'); // '123.456.789-00'

// ✅ REMOVER (Art. 16 LGPD - direito de exclusão)
await lgpdStorage.removeItem('user_cpf');

// ⚠️ LIMPAR TUDO (use com cuidado!)
lgpdStorage.clear();
```

---

### 2. **TERMO DE CONSENTIMENTO** (Art. 8º LGPD)

**Arquivo:** `src/components/LGPD/LGPDConsentModal.tsx`

#### Recursos:
- ✅ Modal responsivo (fullscreen mobile, centralizado desktop)
- ✅ Informa **dados coletados**, **finalidades** e **direitos**
- ✅ Registra **timestamp** e **versão** do consentimento
- ✅ Armazena consentimento **criptografado**
- ✅ Bloqueia acesso se usuário recusar

#### Integração no App.tsx:

```tsx
import LGPDConsentModal from '@/components/LGPD/LGPDConsentModal';
import { setupLGPDExpiry } from '@/utils/lgpdStorage';

function App() {
  useEffect(() => {
    // Configurar limpeza automática (90 dias)
    setupLGPDExpiry();
  }, []);

  return (
    <>
      <LGPDConsentModal />
      {/* Resto do app */}
    </>
  );
}
```

---

### 3. **LOGS DE ACESSO** (Art. 48 LGPD)

**Local:** Console do navegador (produção: enviar para servidor)

#### Logs automáticos:
- ✅ `[LGPD] Dado sensível armazenado: user_cpf...`
- ✅ `[LGPD] Dado sensível acessado: user_cpf...`
- ✅ `[LGPD] Dado sensível removido: user_cpf...`
- ✅ `[LGPD] Consentimento registrado: 2025-01-15T10:30:00Z`

#### Rastreabilidade:
- **Quem:** userId (capturado do Supabase Auth)
- **Quando:** timestamp ISO 8601
- **O quê:** chave ofuscada (primeiros 10 chars)

---

### 4. **RETENÇÃO LIMITADA** (Art. 16 LGPD)

**Função:** `setupLGPDExpiry()` em `lgpdStorage.ts`

#### Prazo legal:
- ⏰ **90 dias** para dados temporários (presença, logs)
- ♾️ **Ilimitado** para obrigações legais (folha de pagamento - 5 anos CLT)

#### Limpeza automática:
```typescript
// Executa a cada 90 dias automaticamente
setupLGPDExpiry();

// Você pode customizar lógica de limpeza:
// - Presencas com data > 90 dias → deletar
// - Logs de acesso > 90 dias → arquivar
```

---

### 5. **MIGRAÇÃO DE DADOS LEGADOS**

**Função:** `migrateLegacyStorage()` em `lgpdStorage.ts`

#### Uso (EXECUTAR UMA VEZ):

```typescript
import { migrateLegacyStorage } from '@/utils/lgpdStorage';

// No primeiro deploy pós-LGPD:
await migrateLegacyStorage();

// ✅ Move dados NÃO-criptografados para formato seguro
// ✅ Remove versões antigas do localStorage
// ✅ Registra migração concluída
```

⚠️ **IMPORTANTE:** Rodar em horário de baixo tráfego (madrugada).

---

## 🔐 CONFIGURAÇÃO DE PRODUÇÃO

### 1. **Variável de Ambiente: SECRET_KEY**

**Arquivo:** `.env.local`

```bash
# ⚠️ NUNCA VERSIONAR ESTA CHAVE NO GIT!
# Gerar chave forte: openssl rand -base64 32
VITE_STORAGE_SECRET=sua-chave-super-secreta-aqui-min-32-chars
```

**Fallback atual (DESENVOLVIMENTO APENAS):**
```typescript
const SECRET_KEY = import.meta.env.VITE_STORAGE_SECRET || 'renea-lgpd-2024-secure-key';
```

---

### 2. **Captura de IP Real (Backend)**

**Arquivo:** `LGPDConsentModal.tsx`

```typescript
// ❌ ATUAL (mock):
ip: '(capturado pelo backend)'

// ✅ PRODUÇÃO (via API):
const response = await fetch('/api/user-ip');
const { ip } = await response.json();

const consentData = {
  accepted: true,
  timestamp: new Date().toISOString(),
  version: '1.0',
  ip, // IP real do usuário
};
```

---

### 3. **Logs para Servidor (Produção)**

**Arquivo:** `lgpdStorage.ts`

```typescript
// ❌ ATUAL (desenvolvimento):
console.info('[LGPD] Dado sensível acessado:', key);

// ✅ PRODUÇÃO (enviar para API):
await fetch('/api/lgpd/log', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'ACCESS',
    key_hash: await hashKey(key),
    user_id: currentUserId,
    timestamp: new Date().toISOString(),
  }),
});
```

---

## 📊 CHECKLIST DE CONFORMIDADE

### **Artigo 46 - Segurança Técnica**
- ✅ Criptografia AES-256-GCM (dados em repouso)
- ✅ HTTPS/TLS (dados em trânsito - via Supabase)
- ✅ Hash SHA-256 para chaves
- ✅ IV aleatório por operação

### **Artigo 8º - Consentimento**
- ✅ Termo de consentimento **explícito**
- ✅ Informa dados coletados + finalidades
- ✅ Registro de **timestamp** + **versão**
- ✅ Possibilidade de **recusar** (bloqueia acesso)

### **Artigo 16 - Retenção**
- ✅ Prazo de 90 dias para dados temporários
- ✅ Limpeza automática configurada
- ⚠️ **PENDENTE:** Implementar lógica específica de limpeza (presença/logs)

### **Artigo 18 - Direitos do Titular**
- ✅ **Acesso:** `lgpdStorage.getItem()`
- ✅ **Exclusão:** `lgpdStorage.removeItem()`
- ⚠️ **PENDENTE:** UI para portabilidade de dados (exportar JSON)
- ⚠️ **PENDENTE:** UI para revogação de consentimento

### **Artigo 48 - Logs de Acesso**
- ✅ Logs automáticos (console)
- ⚠️ **PENDENTE:** Persistir logs no servidor (produção)

---

## 🚨 PRÓXIMAS AÇÕES (PRODUÇÃO)

### **CRÍTICO (antes do deploy):**
1. ⚠️ Configurar `VITE_STORAGE_SECRET` real
2. ⚠️ Implementar captura de IP via backend
3. ⚠️ Enviar logs para API (não console)

### **IMPORTANTE (30 dias):**
4. ⚠️ Implementar lógica de limpeza 90 dias (presença)
5. ⚠️ UI para portabilidade de dados (exportar JSON)
6. ⚠️ UI para revogação de consentimento

### **DESEJÁVEL (60 dias):**
7. ⚠️ Painel do DPO (relatórios de acesso)
8. ⚠️ Notificação de violação (Art. 48 § 1º)
9. ⚠️ Auditoria periódica (trimestral)

---

## 📞 CONTATO

**Encarregado de Dados (DPO):**
- 📧 Email: dpo@renea.com.br
- ⏱️ Prazo de resposta: até 15 dias úteis

**Desenvolvedores:**
- 👨‍💻 Equipe: Sistema Pessoas & Presença
- 📅 Última atualização: 2025-01-15

---

## 📚 REFERÊNCIAS

- [Lei nº 13.709/2018 (LGPD)](http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [Guia ANPD - Segurança de Dados](https://www.gov.br/anpd/pt-br/assuntos/guias)
- [Web Crypto API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [NIST AES-256-GCM](https://csrc.nist.gov/publications/detail/sp/800-38d/final)

---

**✅ DOCUMENTO VÁLIDO A PARTIR DE:** 2025-01-15  
**🔄 PRÓXIMA REVISÃO:** 2025-07-15 (semestral)
