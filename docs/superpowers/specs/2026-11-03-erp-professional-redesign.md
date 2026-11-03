# RENEA ERP: Redesign Profissional da Arquitetura de Informação

**Data:** 2026-11-03  
**Status:** Spec (aprovação necessária)  
**Prioridade:** Crítica — Usabilidade operacional

## Problema

Auditoria atual revela:
- **ControlePresencaTab:** 1.979 linhas (monolítico, sem separação de responsabilidades)
- **LancamentosTab:** 1.058 linhas
- **Navegação:** 16 abas, muitas sem propósito claro
- **Fluxo de Trabalho:** Entrada de dados, edição e consulta misturadas na mesma interface
- **Filtros:** Espalhados, sem padrão, difíceis de descobrir
- **Dashboards:** Sem resumo operacional por domínio
- **Busca:** Sem search global, sem autocomplete
- **Hierarquia Visual:** Confusa, sem scanability

**Impacto:** Um usuário operacional não consegue:
1. Cadastrar/lançar dados com rapidez (muitos cliques, fluxo confuso)
2. Encontrar dados históricos (sem filtros/busca)
3. Ver resumo de operações do dia (sem dashboard)
4. Entender o que cada aba faz (nomes genéricos, funções sobrepostas)

## Solução (Visão 2-3 semanas)

### Fase 1: Reorganização Estrutural
**Objetivo:** Reorganizar 16 abas em 5 domínios operacionais claros com fluxo de trabalho definido.

#### Estrutura Nova:
```
MENU PRINCIPAL
├─ 📊 Operações (novo)
│  ├─ Presença       (hoje: controle-presenca)
│  ├─ Frotas         (hoje: controle-equipamentos)
│  ├─ Materiais      (hoje: lançamentos)
│  └─ Estacas        (hoje: estacas)
│
├─ 📅 Planejamento (mantém)
│  ├─ Planejamento
│  ├─ Diário de Obra
│  └─ Manutenção
│
├─ 📚 Cadastros (novo — consolidar)
│  ├─ Pessoas        (funcionários + colaboradores)
│  ├─ Locais         (frentes + canteiros)
│  ├─ Equipamentos   (máquinas + ferramentas)
│  └─ Estrutura      (estacas + elementos)
│
├─ ⚙️ Administração (novo — consolidar)
│  ├─ Combustível    (hoje: combustivel)
│  ├─ Tickets/RDO    (hoje: tickets-jazida)
│  ├─ Configurações
│  └─ Usuários
│
└─ 📈 Relatórios (mantém + expande)
```

### Fase 2: Padrão de Fluxo Operacional
**Objetivo:** Cada aba de operação segue: ENTRADA → EDIÇÃO → VISUALIZAÇÃO → RELATÓRIOS

#### Exemplo: Presença
```
┌─────────────────────────────────┐
│ Presença                        │  ← PageHeader com ações principais
├─────────────────────────────────┤
│ [Buscar] [Data] [Filtros ▼]    │  ← Barra unificada (padrão)
├─────────────────────────────────┤
│                                 │
│ Dashboard (sticky):             │  ← Resumo visual 3 métricas
│ Presentes: 45 | Ausentes: 8 │ 
│ Últimas atualizações            │
│                                 │
├─────────────────────────────────┤
│                                 │
│ TABELA com histórico            │  ← Rola por dentro
│ (coluna: check, nome, status,   │
│  equipe, hora, ações)           │
│                                 │
├─────────────────────────────────┤
│ Total: 53 | Página 1 de 5      │  ← Rodapé fixo
└─────────────────────────────────┘
```

**Ações rápidas (lado direito do header):**
- ✕ Lançar Presença (modal ou página dedicada)
- ⊞ Relatórios
- ⬇ Exportar

### Fase 3: Padrão de Filtro/Busca Unificado
**Objetivo:** Todo domínio usa o mesmo padrão de busca + filtros avançados.

```
[Buscar por nome/ID] [Data: from-to] [Status ▼] [Mais ▼] [Limpar]
```

**Filtros "Mais" por domínio:**
- Presença: Equipe, Frente, Empresa, Status
- Frotas: Canteiro, Situação, Equipamento, Operador
- Materiais: Tipo, Local, Período, Responsável

### Fase 4: Dashboard Operacional
**Objetivo:** Cada aba começa com resumo visual de hoje + ações necessárias.

```
PRESENÇA
┌─ Hoje (selectable date)           │ Ações urgentes
├─────────────────────────────────  │ ├─ 3 equipes sem envio
│ ✓ 45 Presentes                    │ ├─ 5 pessoas ausentes
│ ✕ 8 Ausentes                      │ └─ 2 atestados pendentes
│ ⊙ 5 Atrasos                       │
│ ≈ 2 Atestados                     │
└─────────────────────────────────  │
```

### Fase 5: Componentes Estruturais
**Objetivo:** Quebrar monólitos em componentes reutilizáveis.

**ControlePresencaTab (1979 → ~300 linhas):**
- `PresencaDashboard.tsx` — Resumo do dia
- `PresencaBusca.tsx` — Busca + filtros
- `PresencaTabela.tsx` — Lista com paginação
- `PresencaModal.tsx` — Lançar/editar
- `PresencaRelatorios.tsx` — Análises (lazy load)

## Casos de Uso — Fluxo Real

### UC-1: Lançar presença (hoje vs. depois)
**HOJE:** 8 cliques
1. Abrir Presença
2. Scroll até lançamento manual
3. Clique em "Nova presença"
4. Preencher form
5. Salvar
6. Atualizar página manualmente

**DEPOIS:** 3 cliques
1. Abrir Presença
2. Clique em "+ Lançar"
3. Preencher 3 campos (pessoa, status, equipe) → autocomplete

### UC-2: Encontrar histórico de motorista (impossível → 2 minutos)
**HOJE:** Impossível (sem filtro por motorista)

**DEPOIS:**
1. Presença → Buscar "João"
2. Filtro Motorista
3. Ver 30 dias de histórico

## Padrão Visual (Mantém)
- Paleta: #176b4d (verde), #f26a2e (laranja), #718087 (cinza)
- Componentes: PageHeader, TelaCheia, AbasDaTela
- Tipografia: 12px min, sem ellipsis sem truncate, Geist font
- Cards: rounded-2xl border-slate-200
- Foco: 2px solid green-dark

## Dependências de Outras Frentes
- **Supabase:** RLS policies para presença, frotas, materiais (conferir permissões)
- **Dados:** Confirmar schema de `presenca_apontamento`, `controle_equipamento`, `movimento_material`
- **Integração:** Público links de presença precisam de token refresh (UC de Presença Pública)

## Cronograma (2-3 semanas)
1. Semana 1: Reorganização estrutural + Dashboard Presença
2. Semana 2: Padrão de Busca/Filtro + Frotas
3. Semana 3: Materiais + Relatórios + Cleanup
