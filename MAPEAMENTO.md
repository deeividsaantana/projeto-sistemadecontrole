# 📋 MAPEAMENTO COMPLETO: Presença + Colaboradores

**Data:** 28/10/2026  
**Objetivo:** Documentar toda lógica existente antes da unificação  
**Fase:** 0 - Inspeção & Mapeamento

---

## 📊 ESTATÍSTICAS GERAIS

| Componente | Linhas | Tamanho | Props | Estados | Memos |
|------------|--------|---------|-------|---------|-------|
| **ControlePresencaTab** | 1.947 | 120.398 bytes | 17 | 14+ | 32+ |
| **ColaboradoresTab** | 412 | 22.063 bytes | 12 | 3 | 3 |
| **TOTAL** | **2.359** | **142.461 bytes** | **29** | **17** | **35** |

---

## 🔌 PROPS: ControlePresencaTab

### **Props de Dados (8)**
```typescript
empresas: Empresa[]
funcionarios: Funcionario[]
obras: ObraLocal[]
canteiros?: readonly string[]  // Opcional, default: ACTIVE_SITES
gruposEquipe: GrupoEquipe[]
presencasLink: PresencaApontamento[]
historicoPresencas: HistoricoPresenca[]
presencasInativas?: PresencaApontamento[]  // Opcional
```

### **Props de Callbacks (9)**
```typescript
// CRUD Equipes
onSaveGrupoEquipe: (grupo: GrupoEquipe, isNew: boolean) => void
onDeleteGrupoEquipe?: (id: string) => void  // Opcional (só admin)

// CRUD Presença
onUpdatePresencaLink: (id: string, status: PresencaStatus, observacao: string, motivo: string) => void
onLancarPresencaManual?: (
  grupo: GrupoEquipe,
  data: string,
  situacoes: SituacaoLancada[],
  observacaoDia: string
) => void

// Inativação/Reativação
onInativarPresencaLink?: (ids: string[]) => void
onReativarPresencaLink?: (ids: string[]) => void

// Reset e Sync
onResetPresencaDia?: (grupoId: string, data: string) => Promise<{ success: boolean; message: string }>
onSyncEquipesPlanilha?: (
  funcionarios: Funcionario[],
  gruposEquipe: GrupoEquipe[],
  resumo: TeamSyncPlan['resumo']
) => Promise<{ success: boolean; message: string }>

// Restauração de histórico
onRestorePresenceHistory?: () => Promise<{ success: boolean; message: string }>
```

### **Props Auxiliares (2)**
```typescript
pendingPublicSubmissionsCount?: number  // Contador de envios pendentes
viewInicial?: View  // Aba que abre primeiro ('ao-vivo' | 'relatorios' | 'equipes' | 'registros' | 'historico')
```

---

## 🔌 PROPS: ColaboradoresTab

### **Props de Dados (7)**
```typescript
funcionarios: Funcionario[]
empresas: Empresa[]
gruposEquipe: GrupoEquipe[]
presencasLink: PresencaApontamento[]
controlesEquipamentos: ControleEquipamentoDiario[]
ticketsJazida: TicketJazida[]
checklists?: ChecklistEquipamento[]  // Opcional
```

### **Props de Callbacks (3)**
```typescript
onNavigate: (tab: string) => void  // Navegação entre abas
podeAbrir?: (tab: string) => boolean  // Verificação de permissão
onAlterarSituacao?: (proximo: Funcionario, descricao: string) => void  // Alterar status (férias, afastado, etc)
```

### **Props Auxiliares (1)**
```typescript
responsavel?: string  // Nome do usuário logado
```

---

## 📍 ESTADOS: ControlePresencaTab (14+)

### **Navegação e Visualização (3)**
```typescript
view: View  // 'ao-vivo' | 'relatorios' | 'equipes' | 'registros' | 'historico'
referenceDate: string  // Data de referência do dashboard
filtrosAbertos: boolean  // Gaveta de filtros aberta/fechada
```

### **Filtros Dashboard (7)**
```typescript
dashboardCompany: string  // 'todas' ou ID da empresa
dashboardGroup: string  // 'todos' ou ID do grupo
dashboardRole: string  // 'todas' ou função
dashboardStatus: 'todos' | PresencaStatus
dashboardBranch: string  // 'todos' ou ramo
dashboardSite: string  // 'todos' ou canteiro
dashboardSearch: string  // Busca livre
```

### **Filtros Registros (3)**
```typescript
recordDate: string  // Data dos registros
recordGroup: string  // 'todos' ou ID do grupo
recordStatus: 'todos' | PresencaStatus
recordSearch: string  // Busca livre
```

### **Editor de Equipe (4)**
```typescript
teamSearch: string  // Busca de equipes
employeeSearch: string  // Busca de funcionários
employeeCompany: string  // Filtro por empresa
isGroupEditorOpen: boolean  // Modal aberto/fechado
editingGroupId: string | null  // ID da equipe sendo editada (null = nova)
membrosAoAbrir: string[] | null  // Backup dos membros ao abrir editor
```

### **Editor de Registro (3)**
```typescript
editingRecord: PresencaApontamento | null  // Registro sendo editado
editStatus: PresencaStatus  // Status do registro
selectedRecordIds: string[]  // IDs selecionados para ação em lote
```

### **Feedback e UI (3)**
```typescript
feedback: string  // Mensagem de feedback temporária
equipeExcluindo: GrupoEquipe | null  // Equipe sendo excluída (confirmação)
desfazerInativacao: string[]  // Stack de inativações para desfazer
```

---

## 📍 ESTADOS: ColaboradoresTab (3)

```typescript
busca: string  // Busca por nome/matrícula/função
situacao: 'Todas' | 'ATIVO' | 'INATIVO' | 'FÉRIAS' | 'AFASTADO' | 'DESMOBILIZADO'
selecionadoId: string | null  // ID do colaborador selecionado (abre ficha)
mudanca: {  // Alteração de situação em andamento
  situacao: SituacaoColaborador
  data: string
  motivo: string
} | null
```

---

## 🧮 MEMOS/CALLBACKS: ControlePresencaTab (32+)

### **Dados Normalizados (8)**
```typescript
safeFuncionarios: useMemo  // Funcionários com filtro de nulls
safeEmpresas: useMemo  // Empresas com filtro de nulls
teamCompanies: useMemo  // Empresas que fornecem colaboradores
safeObras: useMemo  // Obras com filtro de nulls
safeRecords: useMemo  // Registros normalizados
inativos: useMemo  // Registros inativos normalizados
safeGroups: useMemo  // Equipes recuperadas + normalizadas
safeHistory: useMemo  // Histórico normalizado
```

### **Listas Filtradas (10+)**
```typescript
activeGroups: useMemo  // Equipes ativas
dayRecords: useMemo  // Registros do dia selecionado
dashboardEmployees: useMemo  // Colaboradores filtrados no dashboard
dashboardGroups: useMemo  // Equipes filtradas no dashboard
recordList: useMemo  // Lista de registros filtrada
teamList: useMemo  // Lista de equipes para editor
employeeList: useMemo  // Lista de funcionários para editor
duplicates: useMemo  // Registros duplicados detectados
attendanceAlerts: useMemo  // Alertas de presença (não enviou)
repeatedAbsences: useMemo  // Faltas repetidas
```

### **Métricas e Agregações (8+)**
```typescript
totalPresentes: useMemo  // Total de presentes no dia
totalAusentes: useMemo  // Total de ausentes no dia
totalEquipesAtivas: useMemo  // Total de equipes ativas
totalEquipesPendentes: useMemo  // Equipes que não enviaram
efetivoPorEmpresa: useMemo  // Agrupamento por empresa
efetivoPorFrente: useMemo  // Agrupamento por frente
faltasRepetidas: useMemo  // Colaboradores com faltas recorrentes
diasComPresenca: useMemo  // Histórico dos últimos 7 dias
```

### **Handlers (6+)**
```typescript
handleSaveGroup: useCallback  // Salvar equipe
handleDeleteGroup: useCallback  // Deletar equipe
handleUpdateRecord: useCallback  // Atualizar registro
handleLancarPresencaManual: useCallback  // Lançamento manual
handleInativarRegistros: useCallback  // Inativar em lote
handleReativarRegistros: useCallback  // Reativar em lote
```

---

## 🧮 MEMOS/CALLBACKS: ColaboradoresTab (3)

```typescript
equipePorFuncionario: useMemo  // Map<funcionarioId, GrupoEquipe>
lista: useMemo  // Lista filtrada de colaboradores
nomeEmpresa: useMemo  // Map<empresaId, nome>
```

---

## 📦 DEPENDÊNCIAS COMPARTILHADAS

### **Types (10 compartilhados)**
```typescript
Empresa
Funcionario
GrupoEquipe
PresencaApontamento
HistoricoPresenca
ControleEquipamentoDiario
TicketJazida
ChecklistEquipamento
PresencaStatus
ObraLocal
```

### **Utils ControlePresencaTab (10 únicos)**
```typescript
teamSpreadsheetSync  // Sincronização com planilha
publicLinkSecurity  // Geração de tokens públicos
canonicalIdentity  // Normalização de strings
teamIdentity  // Lógica de identidade de equipes
presencaManual  // Lançamento manual
painelPresenca  // Métricas do painel
frenteServico  // Frentes e canteiros
excelCorporate  // Export Excel corporativo
exportarEquipesExcel  // Export planilha equipes
universalPdfReport  // Geração de PDF
```

### **Utils ColaboradoresTab (3 únicos)**
```typescript
canonicalIdentity  // Normalização (COMPARTILHADO com ControlePresencaTab)
displayText  // Formatação de texto
situacaoColaborador  // Lógica de situações
```

### **UI Compartilhados (8)**
```typescript
AbasDaTela  // Navegação entre abas
TelaCheia  // Layout fullscreen
TabelaPadrao  // Tabela paginada
PageHeader  // Cabeçalho de página
Modal  // Modais
Card  // Cards
EmptyState  // Estado vazio
TextInput  // Input de texto
```

---

## 🔄 FLUXOS CRÍTICOS

### **FLUXO 1: Lançamento de Presença (ControlePresencaTab)**

**Caminho Happy Path:**
```
1. Usuário abre aba "Ao vivo"
2. Seleciona data (default: hoje)
3. Aplica filtros (empresa, frente, canteiro)
4. Sistema mostra equipes pendentes em destaque
5. Clica "Lançar presença" na equipe
6. Modal abre com lista de colaboradores
7. Marca status de cada um (Presente, Ausente, etc)
8. Adiciona observação (opcional)
9. Clica "Salvar"
10. Sistema chama onLancarPresencaManual()
11. Feedback de sucesso
12. Dashboard atualiza métricas
```

**Validações:**
- Data não pode ser futura
- Pelo menos 1 colaborador deve ter status
- Não pode lançar 2x no mesmo dia (validado no backend)

---

### **FLUXO 2: CRUD de Equipe (ControlePresencaTab)**

**Criar nova equipe:**
```
1. Usuário clica "Nova equipe" (aba Equipes)
2. Modal abre com editingGroupId = null
3. Preenche: nome, encarregado, frente, obra
4. Busca colaboradores disponíveis
5. Seleciona funcionários
6. Clica "Salvar"
7. Sistema chama onSaveGrupoEquipe(grupo, isNew=true)
8. Modal fecha, lista atualiza
```

**Editar equipe existente:**
```
1. Usuário clica "Editar" na linha da equipe
2. Modal abre com editingGroupId = grupo.id
3. membrosAoAbrir salva lista atual (para detectar mudanças)
4. Altera dados (nome, membros, etc)
5. Clica "Salvar"
6. Sistema chama onSaveGrupoEquipe(grupo, isNew=false)
7. Modal fecha, lista atualiza
```

**Deletar equipe:**
```
1. Usuário clica "Excluir" (só admin)
2. equipeExcluindo armazena equipe
3. ConfirmDialog abre: "Tem certeza? Isso apaga registros de presença"
4. Usuário confirma
5. Sistema chama onDeleteGrupoEquipe(id)
6. Lista atualiza
```

---

### **FLUXO 3: Visualização de Ficha Individual (ColaboradoresTab)**

**Abrir ficha:**
```
1. Usuário clica em linha da tabela de colaboradores
2. selecionadoId = funcionario.id
3. Sistema computa:
   - Equipe atual (equipePorFuncionario.get(id))
   - Últimas presenças (presencasLink filtradas)
   - Equipamentos operados (controlesEquipamentos filtrados)
   - Viagens de jazida (ticketsJazida filtrados)
4. Ficha renderiza em modal fullscreen
5. Mostra 4 cards: Identificação, Presença, Frota, Viagens
```

**Alterar situação:**
```
1. Usuário clica "Alterar situação" na ficha
2. mudanca = { situacao: 'FÉRIAS', data: hoje, motivo: '' }
3. Modal abre solicitando data e motivo
4. Usuário preenche
5. Clica "Confirmar"
6. Sistema chama onAlterarSituacao(funcionarioAtualizado, descricaoMudanca)
7. Ficha atualiza status
```

**Fechar ficha:**
```
1. Usuário clica "Voltar" ou ESC
2. selecionadoId = null
3. Volta para lista de colaboradores
```

---

### **FLUXO 4: Filtros e Busca (ambos componentes)**

**ControlePresencaTab (7 filtros simultâneos):**
```
empresa + frente + canteiro + função + status + busca + data
→ dashboardEmployees recalcula (useMemo)
→ Lista re-renderiza com resultado
```

**ColaboradoresTab (2 filtros simultâneos):**
```
situacao + busca
→ lista recalcula (useMemo)
→ TabelaPadrao re-renderiza
```

**Performance:**
- Ambos usam `normalizeComparable()` para busca case-insensitive
- Busca aplica em múltiplos campos (nome, matrícula, cargo, área, líder)
- useMemo evita recalcular se filtros não mudaram

---

### **FLUXO 5: Exportação (ControlePresencaTab)**

**Excel corporativo:**
```
1. Usuário clica "Exportar Excel" (aba Relatórios)
2. Sistema cria workbook via excelCorporate
3. Adiciona sheet de resumo (totais, métricas)
4. Adiciona sheet por empresa (se filtrado)
5. Aplica estilos corporativos (logo RENEA, cores)
6. downloadCorporateWorkbook() força download
```

**PDF:**
```
1. Usuário clica "Exportar PDF"
2. Sistema chama generateUniversalPdfReport()
3. Monta documento com header RENEA
4. Adiciona tabelas de presença por equipe
5. Adiciona gráficos (se disponível)
6. Download automático
```

**Planilha de equipes:**
```
1. Usuário clica "Baixar equipes" (aba Equipes)
2. Sistema chama baixarPlanilhaEquipes()
3. Gera .xlsx com: nome, encarregado, membros, frente
4. Download automático
```

---

## 🚨 PONTOS DE ATENÇÃO (Potenciais Bugs)

### **⚠️ Duplicação de Lógica**

1. **Busca de colaboradores:**
   - ControlePresencaTab: `dashboardSearch` (linha ~282)
   - ColaboradoresTab: `busca` (linha ~68)
   - **RISCO:** Comportamentos diferentes (um busca em mais campos)

2. **Filtro por empresa:**
   - ControlePresencaTab: `dashboardCompany` (linha ~276)
   - ColaboradoresTab: não tem (só lista)
   - **RISCO:** Usuário espera consistência

3. **Normalização de dados:**
   - ControlePresencaTab: `normalizeGroup()`, `normalizeRecord()` (linhas 173-204)
   - ColaboradoresTab: usa direto
   - **RISCO:** Dados inconsistentes se não normalizados

---

### **⚠️ Performance**

1. **ControlePresencaTab - 32+ useMemos:**
   - **BÔNUS:** Otimização agressiva
   - **RISCO:** Complexidade de manutenção, difícil debugar dependências

2. **ColaboradoresTab - TabelaPadrao paginada:**
   - Paginação automática (50 por página)
   - **BÔNUS:** Mobile leve com 400+ pessoas
   - **RISCO:** ControlePresencaTab não usa paginação (pode travar com muitos registros)

3. **Ficha individual carrega tudo:**
   - Filtra presencas + equipamentos + viagens na renderização
   - **RISCO:** Lento com histórico grande (1 ano de dados)

---

### **⚠️ UX Inconsistente**

1. **Ficha do colaborador:**
   - ColaboradoresTab: modal fullscreen (linha ~150)
   - ControlePresencaTab: não tem ficha individual
   - **PROBLEMA:** Usuário tem que trocar de aba para ver ficha

2. **Ações inline:**
   - ControlePresencaTab: muitos botões inline (editar, excluir, lançar presença)
   - ColaboradoresTab: só clique na linha (abre ficha)
   - **PROBLEMA:** Inconsistência de padrão

3. **Feedback de ações:**
   - ControlePresencaTab: `feedback` state + fade out automático
   - ColaboradoresTab: sem feedback visual (depende do pai)
   - **PROBLEMA:** Usuário não sabe se ação salvou

---

### **⚠️ Segurança (para Red Team Test)**

1. **Geração de token público:**
   - `generateToken()` usa `crypto.getRandomValues()` ✅
   - Mas link é `${origin}/presenca-link/${token}` (sem HMAC)
   - **RISCO:** Token pode ser brute-forced se curto

2. **Validação de permissões:**
   - `onDeleteGrupoEquipe` é opcional (só admin)
   - Mas validação é NO FRONTEND (prop ausente)
   - **RISCO:** Backend DEVE validar, não confiar no frontend

3. **Dados em logs:**
   - Não encontrei `console.log` com dados sensíveis ✅
   - Mas não verificado em utils importados
   - **RISCO:** Utils podem logar CPF/telefone

---

## 📋 CÓDIGO COMPARTILHÁVEL (Candidatos a Extração)

### **Hooks Customizados Potenciais**

1. **useUnifiedSearch**
```typescript
// Compartilhado entre ambos componentes
const { filteredList } = useUnifiedSearch({
  items: funcionarios,
  searchTerm: busca,
  filters: { empresa, situacao, frente },
  searchFields: ['nome', 'matricula', 'cargo']
});
```

2. **usePresencaMetrics**
```typescript
// Lógica de métricas do dashboard
const { totalPresentes, totalAusentes, porcentagem } = usePresencaMetrics({
  registros: presencasLink,
  data: today
});
```

3. **useFichaColaborador**
```typescript
// Agrega dados de múltiplos módulos
const ficha = useFichaColaborador({
  funcionarioId,
  presencas,
  equipamentos,
  viagens
});
```

---

### **Componentes Reutilizáveis Potenciais**

1. **`<FiltrosPresenca />`**
   - Props: `empresa, frente, canteiro, data, situacao, busca`
   - Usado em: Painel Dashboard + Visão Colaboradores

2. **`<CardMetrica />`**
   - Props: `label, valor, detalhe, icon, cor`
   - Usado em: Dashboard + Ficha Individual

3. **`<TabelaColaboradores />`**
   - Props: `colaboradores, onSelect, actions[]`
   - Usado em: Lista principal + Editor de Equipe

4. **`<FichaColaboradorSidebar />`**
   - Props: `colaborador, presencas, equipamentos, viagens, onClose`
   - Substitui modal fullscreen atual

---

## 🎯 DECISÕES ARQUITETURAIS CRÍTICAS

### **1. Estado Compartilhado vs Props Drilling**

**Atual:**
- Ambos componentes recebem TODAS props do pai (App.tsx)
- Nenhum estado global (Zustand/Context)

**Problema na unificação:**
- 29 props no total
- Props drilling pode ficar pior se adicionar sub-componentes

**Decisão necessária:**
- Manter props drilling (simples, explícito)
- OU migrar para Context/Zustand (menos props, mais complexidade)

---

### **2. Roteamento Interno**

**Atual:**
- ControlePresencaTab: state `view` + switch case (5 visões)
- ColaboradoresTab: state `selecionadoId` (2 estados: lista vs ficha)

**Problema na unificação:**
- 3 visões principais (Painel, Equipes, Colaboradores)
- Cada visão pode ter sub-estados (ficha aberta, modal, etc)

**Decisão necessária:**
- URL routing (/pessoas/painel, /pessoas/equipes/123)
- OU state interno apenas (sem mudar URL)

---

### **3. Lazy Loading vs Bundle Único**

**Atual:**
- App.tsx importa com `lazy()`: `const ControlePresencaTab = lazy(...)`
- Bundle separado, carrega sob demanda

**Problema na unificação:**
- Componente unificado será ~3000 linhas
- Muito grande para bundle único

**Decisão necessária:**
- Manter lazy() para visões internas (Painel, Equipes, Colaboradores)?
- Code splitting manual com React.lazy()?

---

### **4. Migração Gradual vs Big Bang**

**Atual:**
- 2 abas funcionando em produção
- Usuários habituados ao fluxo

**Risco:**
- Quebrar fluxo de 100+ usuários ativos
- Perder funcionalidade por engano

**Decisão necessária:**
- Feature flag (novo módulo Beta paralelo)
- OU substituir diretamente (validar MUITO antes)

---

## ✅ PRÓXIMOS PASSOS (FASE 1)

Com este mapeamento completo, agora temos:

- [x] Props e callbacks documentados (29 total)
- [x] Estados mapeados (17 total)
- [x] Dependências identificadas (types + utils)
- [x] Fluxos críticos documentados (5 principais)
- [x] Pontos de atenção listados (duplicação, performance, UX, segurança)
- [x] Código compartilhável identificado (hooks + componentes)
- [x] Decisões arquiteturais pendentes (4 críticas)

**FASE 1: SPIKES (próxima etapa)**

Validar com protótipos descartáveis:
1. Arquitetura de estado (props vs Context)
2. Roteamento (URL vs state)
3. Code splitting (lazy load visões)

---

**Fim do mapeamento. Documento completo.**
