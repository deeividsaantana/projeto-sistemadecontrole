# 🔧 GUIA DE INTEGRAÇÃO: Módulo Pessoas & Presença (Beta)

**Tempo estimado:** 10-15 minutos

---

## 📝 PASSO A PASSO

### **PASSO 1: Adicionar lazy import** (App.tsx, linha ~109)

Procure a seção onde estão os outros lazy imports:

```tsx
const ControlePresencaTab = lazy(() => import('./components/ControlePresencaTab'));
const ColaboradoresTab = lazy(() => import('./components/ColaboradoresTab'));
```

**ADICIONE LOGO ABAIXO:**

```tsx
// NOVO: Módulo unificado Pessoas & Presença (Beta paralela)
const PessoasPresencaBeta = lazy(() => import('./components/PessoasPresenca/PessoasPresencaWrapper'));
```

---

### **PASSO 2: Adicionar no menu/navegação**

Procure onde ficam os botões de aba. Provavelmente algo como:

```tsx
<button onClick={() => navigateTo('presenca')}>Presença</button>
<button onClick={() => navigateTo('colaboradores')}>Colaboradores</button>
```

**ADICIONE UM NOVO BOTÃO:**

```tsx
<button 
  onClick={() => navigateTo('pessoas-beta')}
  className="..." // Use as mesmas classes dos outros botões
>
  👥 Pessoas & Presença (Beta)
</button>
```

💡 **Dica:** Coloque "**[Beta]**" ou "**🧪**" para deixar claro que é versão de teste

---

### **PASSO 3: Renderizar quando aba ativa** (App.tsx, linha ~4790)

Procure onde renderiza `{activeTab === 'presenca' && (`

**ADICIONE LOGO ABAIXO (linha ~4792):**

```tsx
{activeTab === 'pessoas-beta' && (
  <PessoasPresencaBeta
    // Dados
    empresas={empresas}
    funcionarios={funcionarios}
    obras={obras}
    canteiros={canteirosNomes}
    gruposEquipe={gruposEquipe}
    presencasLink={presencasLinkAtivas}
    historicoPresencas={historicoPresencas}
    controlesEquipamentos={controleEquipamentosDiario}
    ticketsJazida={ticketsJazida}
    checklists={checklists}
    
    // Callbacks de equipes
    onSaveGrupoEquipe={handleSaveGrupoEquipe}
    onDeleteGrupoEquipe={podeExcluirCadastro ? handleDeleteGrupoEquipe : undefined}
    
    // Callbacks de presença
    onUpdatePresencaLink={handleUpdatePresencaLink}
    onLancarPresencaManual={handleLancarPresencaManual}
    onInativarPresencaLink={handleInativarPresencaLink}
    onReativarPresencaLink={handleReativarPresencaLink}
    onResetPresencaDia={handleResetPresencaDia}
    onSyncEquipesPlanilha={handleSyncEquipesPlanilha}
    onRestorePresenceHistory={handleRestorePresenceHistory}
    
    // Callbacks de colaboradores
    onAlterarSituacao={(proximo, descricao) => {
      handleSaveFuncionario(proximo, false);
      addNotification('Situação atualizada', descricao, 'info', 'Sistema Local');
    }}
    
    // Navegação
    onNavigate={navigateTo}
    podeAbrir={podeAbrir}
    responsavel={activeUserName}
  />
)}
```

---

### **PASSO 4: Testar no navegador**

```bash
# Terminal
npm run dev

# Navegador
http://localhost:3000
```

1. ✅ Clique na aba "Pessoas & Presença (Beta)"
2. ✅ Deve abrir o módulo novo
3. ✅ Navegue entre: Painel → Equipes → Colaboradores
4. ✅ Teste os filtros globais (busca, empresa, situação)
5. ✅ Clique em um colaborador (deve abrir ficha lateral)

---

## 🐛 SE DER ERRO

### **Erro 1: "Cannot find module..."**

**Causa:** Lazy import errado

**Solução:**
```tsx
// ❌ ERRADO:
const PessoasPresencaBeta = lazy(() => import('./components/PessoasPresenca'));

// ✅ CORRETO:
const PessoasPresencaBeta = lazy(() => import('./components/PessoasPresenca/PessoasPresencaWrapper'));
```

---

### **Erro 2: "X is not defined"**

**Causa:** Alguma prop faltando

**Solução:** Compare com as props de `ControlePresencaTab` e `ColaboradoresTab`. Use as mesmas.

---

### **Erro 3: Tela branca / nada aparece**

**Causa:** Aba não está sendo detectada

**Solução:** Verifique se `activeTab === 'pessoas-beta'` está correto (mesmo nome usado no `navigateTo`)

---

## ✅ CHECKLIST DE VALIDAÇÃO

Depois de integrar, valide:

- [ ] Aba aparece no menu
- [ ] Clique abre o módulo
- [ ] Painel mostra métricas (presentes, ausentes, equipes)
- [ ] Equipes mostra lista de equipes
- [ ] Colaboradores mostra tabela
- [ ] Filtro de busca funciona
- [ ] Filtro de empresa funciona
- [ ] Clique em colaborador abre ficha lateral
- [ ] Navegação entre abas (Painel/Equipes/Colaboradores) funciona
- [ ] Console sem erros (F12 → Console)

---

## 📸 EVIDÊNCIA

**Tire um print ou vídeo mostrando:**

1. ✅ Menu com aba "Pessoas & Presença (Beta)"
2. ✅ Dashboard aberto (cards de métricas)
3. ✅ Navegação funcionando (trocar entre visões)
4. ✅ Filtro funcionando (buscar um nome)
5. ✅ Ficha lateral aberta (clicar em colaborador)

**Aí me manda:** "Integrado e funcionando ✅" + print/vídeo

---

## 🚀 DEPOIS QUE FUNCIONAR

**EU farei (Fase 5):**

1. ⏸️ Red Team Test (atacar o próprio código)
2. ⏸️ Checklist 8 pontos (pessoa cansada, responsividade, etc)
3. ⏸️ Correções necessárias
4. ⏸️ Commit em branch `feat/pessoas-presenca-unificada`
5. ⏸️ Documentação final

**Total:** ~3h de trabalho

---

**AGUARDANDO SUA INTEGRAÇÃO!** 🎯

Qualquer dúvida, só chamar.
