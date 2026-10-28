/**
 * Zustand Store - Estado Global do Módulo Pessoas & Presença
 * 
 * Centraliza estado compartilhado entre todas as visões:
 * - Filtros globais (busca, empresa, data)
 * - Dados injetados do pai (empresas, funcionarios, equipes, presencas)
 * - Estados de UI (modals, sidebars, seleções)
 */

import { create } from 'zustand';
import type { 
  Empresa, 
  Funcionario, 
  GrupoEquipe, 
  PresencaApontamento,
  HistoricoPresenca,
  ControleEquipamentoDiario,
  TicketJazida,
  ChecklistEquipamento,
  ObraLocal
} from '../../types';

// ==================== TYPES ====================

export interface PessoasPresencaStore {
  // Dados (injetados pelo componente pai via setDados)
  empresas: Empresa[];
  funcionarios: Funcionario[];
  gruposEquipe: GrupoEquipe[];
  presencasLink: PresencaApontamento[];
  historicoPresencas: HistoricoPresenca[];
  controlesEquipamentos: ControleEquipamentoDiario[];
  ticketsJazida: TicketJazida[];
  checklists: ChecklistEquipamento[];
  obras: ObraLocal[];
  
  // Filtros globais (compartilhados entre TODAS visões)
  globalSearch: string;
  globalEmpresa: string;
  globalData: string;
  globalSituacao: 'Todas' | 'ATIVO' | 'INATIVO' | 'FÉRIAS' | 'AFASTADO' | 'DESMOBILIZADO';
  
  // Estados de UI
  colaboradorSelecionado: string | null;
  equipeEditando: string | null;
  presencaEditando: string | null;
  
  // Actions - Filtros
  setGlobalSearch: (search: string) => void;
  setGlobalEmpresa: (empresa: string) => void;
  setGlobalData: (data: string) => void;
  setGlobalSituacao: (situacao: PessoasPresencaStore['globalSituacao']) => void;
  
  // Actions - UI
  setColaboradorSelecionado: (id: string | null) => void;
  setEquipeEditando: (id: string | null) => void;
  setPresencaEditando: (id: string | null) => void;
  
  // Actions - Dados
  setDados: (dados: Partial<Pick<
    PessoasPresencaStore,
    'empresas' | 'funcionarios' | 'gruposEquipe' | 'presencasLink' | 
    'historicoPresencas' | 'controlesEquipamentos' | 'ticketsJazida' | 'checklists' | 'obras'
  >>) => void;
  
  // Reset
  reset: () => void;
}

// ==================== INITIAL STATE ====================

const getInitialState = () => ({
  // Dados
  empresas: [],
  funcionarios: [],
  gruposEquipe: [],
  presencasLink: [],
  historicoPresencas: [],
  controlesEquipamentos: [],
  ticketsJazida: [],
  checklists: [],
  obras: [],
  
  // Filtros
  globalSearch: '',
  globalEmpresa: 'todas',
  globalData: new Date().toISOString().slice(0, 10),
  globalSituacao: 'Todas' as const,
  
  // UI
  colaboradorSelecionado: null,
  equipeEditando: null,
  presencaEditando: null,
});

// ==================== STORE ====================

export const usePessoasPresencaStore = create<PessoasPresencaStore>((set) => ({
  ...getInitialState(),
  
  // Filtros
  setGlobalSearch: (search) => set({ globalSearch: search }),
  setGlobalEmpresa: (empresa) => set({ globalEmpresa: empresa }),
  setGlobalData: (data) => set({ globalData: data }),
  setGlobalSituacao: (situacao) => set({ globalSituacao: situacao }),
  
  // UI
  setColaboradorSelecionado: (id) => set({ colaboradorSelecionado: id }),
  setEquipeEditando: (id) => set({ equipeEditando: id }),
  setPresencaEditando: (id) => set({ presencaEditando: id }),
  
  // Dados
  setDados: (dados) => set((state) => ({ ...state, ...dados })),
  
  // Reset
  reset: () => set(getInitialState()),
}));
