# 📸 GUIA DE TESTE VISUAL - Pessoas & Presença Beta

**Objetivo:** Validar funcionamento visual após login no sistema

---

## ✅ PRÉ-REQUISITO

1. ✅ Fazer login no sistema (http://localhost:3000)
2. ✅ Ver menu lateral esquerdo

---

## 🎯 TESTE 1: Botão aparece no menu

**Localização:** Menu lateral → seção "Pessoas"

**O que procurar:**

```
┌─────────────────────────┐
│ 🏠 Painel de Controle   │
│ ☀️ Meu dia              │
├─────────────────────────┤
│ Pessoas                 │
│  👤 Colaboradores       │
│  👥 Presença e Controle │
│  🧪 Pessoas & Presença  │ ← DEVE APARECER AQUI
├─────────────────────────┤
│ ...                     │
└─────────────────────────┘
```

**✅ Sucesso:** Botão "Pessoas & Presença 🧪" visível
**❌ Falha:** Botão não aparece → me avisar

---

## 🎯 TESTE 2: Clique abre o módulo

**Ação:** Clicar em "Pessoas & Presença 🧪"

**O que esperar:**

```
┌──────────────────────────────────────────────────┐
│ Pessoas & Presença                               │
│ Gestão unificada de equipes e colaboradores      │
├──────────────────────────────────────────────────┤
│ [📊 Painel] [👥 Equipes] [📋 Colaboradores]     │ ← 3 ABAS
├──────────────────────────────────────────────────┤
│ 🔍 [Buscar...]  [Empresa ▾]  [Situação ▾]       │ ← FILTROS
├──────────────────────────────────────────────────┤
│                                                  │
│  (Conteúdo - deve mostrar dashboard)            │
│                                                  │
└──────────────────────────────────────────────────┘
```

**✅ Sucesso:** Módulo abre com 3 abas + filtros
**❌ Falha:** Tela branca / erro → tirar print do console (F12)

---

## 🎯 TESTE 3: Dashboard mostra métricas

**Aba ativa:** Painel (primeira aba)

**O que esperar:**

```
┌────────────────────────────────────┐
│ 📅 28/10/2026                      │
├────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌─────┐│
│ │  45  │ │  3   │ │  2   │ │18/22││
│ │Prese.│ │Ausen.│ │Atras.│ │Equi.││
│ └──────┘ └──────┘ └──────┘ └─────┘│
├────────────────────────────────────┤
│ ⚠️ Equipes que não enviaram:       │
│ - Equipe 01 - Terraplenagem        │
│ - Equipe 03 - Drenagem             │
└────────────────────────────────────┘
```

**✅ Sucesso:** 4 cards com números aparecem
**❌ Falha:** Cards vazios / erro → screenshot

---

## 🎯 TESTE 4: Aba Equipes

**Ação:** Clicar em "👥 Equipes"

**O que esperar:**

```
┌──────────────────────────────────────────┐
│ Equipes (22)           [➕ Nova equipe]  │
├──────────────────────────────────────────┤
│ Equipe 01 - Terraplenagem                │
│ Encarregado: João Silva · 12 membros     │
│                         [✏️] [🗑️]        │
├──────────────────────────────────────────┤
│ Equipe 02 - Drenagem                     │
│ Encarregado: Maria Santos · 8 membros    │
│                         [✏️] [🗑️]        │
└──────────────────────────────────────────┘
```

**Teste interativo:**

1. ✅ Clicar "➕ Nova equipe" → modal abre
2. ✅ Clicar "✏️" (editar) → modal abre com dados
3. ✅ Clicar "🗑️" (excluir) → confirmação aparece

**✅ Sucesso:** Lista de equipes + modals funcionam
**❌ Falha:** Erro ao clicar → screenshot + console

---

## 🎯 TESTE 5: Aba Colaboradores

**Ação:** Clicar em "📋 Colaboradores"

**O que esperar:**

```
┌───────────────────────┬────────────────┐
│ Colaboradores (150)   │ Ficha Lateral  │
│                       │                │
│ Nome      Mat.  Função│ João Silva     │
│ Pedro     12345 Oper. │ Mat: 12345     │ ← SIDEBAR
│ Ana       12346 Ajud. │                │
│ Carlos    12347 Motor.│ 📊 Presença:   │
│                       │ 28 presentes   │
│ (clique abre ficha →) │ 2 ausentes     │
│                       │                │
│                       │ 🚛 Frota:      │
│                       │ Escavadeira 01 │
└───────────────────────┴────────────────┘
```

**Teste interativo:**

1. ✅ Clicar numa linha → ficha lateral abre
2. ✅ URL muda para `/pessoas/colaboradores/123`
3. ✅ Ficha mostra: presença, equipamentos, viagens

**✅ Sucesso:** Tabela + sidebar funcionam
**❌ Falha:** Clique não abre sidebar → screenshot

---

## 🎯 TESTE 6: Filtros Globais

**Ação:** Testar filtros no topo

**Passos:**

1. ✅ Digite "João" na busca
2. ✅ Vá para aba "Equipes" → busca deve MANTER "João"
3. ✅ Vá para aba "Colaboradores" → busca ainda "João"
4. ✅ Selecione uma empresa no dropdown
5. ✅ Troque de aba → empresa selecionada persiste

**✅ Sucesso:** Filtros persistem ao trocar aba
**❌ Falha:** Filtros resetam → me avisar

---

## 🎯 TESTE 7: Responsividade Mobile

**Ação:** Redimensionar janela para 375px (iPhone)

**Como:**

1. F12 (DevTools)
2. Ctrl+Shift+M (modo responsivo)
3. Selecionar "iPhone SE" ou "iPhone 12"

**O que esperar:**

⚠️ **ATENÇÃO:** Já sei que vai falhar (checklist nota 2/10)

**Problemas esperados:**

- ❌ Tabela quebrada (5 colunas não cabem)
- ❌ Sidebar 33% = 125px (ilegível)
- ❌ Filtros espremidos

**Tarefa:** Tirar screenshot dos problemas

---

## 🎯 TESTE 8: Console Errors

**Ação:** Abrir console (F12 → Console)

**O que procurar:**

```
❌ ERROS:
- "Cannot read property X of undefined"
- "Warning: Each child should have unique key"
- "Failed to fetch"

✅ OK:
- Sem erros vermelhos
- Warnings amarelos aceitáveis
```

**Tarefa:** Se tiver erros vermelhos → screenshot

---

## 📊 FORMULÁRIO DE RESULTADO

**Copie e preencha:**

```
TESTE 1 - Botão no menu: [ ] OK [ ] FALHOU
TESTE 2 - Módulo abre: [ ] OK [ ] FALHOU
TESTE 3 - Dashboard: [ ] OK [ ] FALHOU
TESTE 4 - Equipes: [ ] OK [ ] FALHOU
TESTE 5 - Colaboradores: [ ] OK [ ] FALHOU
TESTE 6 - Filtros persistem: [ ] OK [ ] FALHOU
TESTE 7 - Mobile: [ ] OK [ ] FALHOU (esperado ❌)
TESTE 8 - Console: [ ] SEM ERROS [ ] TEM ERROS

Screenshots anexados: [ ] SIM [ ] NÃO
```

---

## 🚀 DEPOIS DO TESTE

**Se TODOS passaram (exceto mobile):**
✅ Me avise: "Testes visuais OK ✅" + screenshots

**Se ALGUM falhou:**
❌ Me envie:
1. Print da tela com erro
2. Print do console (F12 → Console)
3. Qual teste falhou

**Aí eu:**
1. Corrijo o erro
2. Implemento correções críticas (mobile + LGPD)
3. Entrego 100%

---

**TEMPO ESTIMADO:** 10-15 minutos de teste
