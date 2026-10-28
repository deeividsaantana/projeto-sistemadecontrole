/**
 * SPIKE 002: Shared State + Router
 * 
 * Conceito: Zustand store compartilhado + React Router + Lazy load por visão
 * Risco: Complexidade de sincronização de estado
 */

import { create } from 'zustand';
import type { 
  Empresa, 
  Funcionario, 
  GrupoEquipe, 
  PresencaApontamento,
  PresencaStatus 
} from '../../src/types';

// ==================== ZUSTAND STORE ====================

interface PessoasPresencaStore {
  // Dados (injetados pelo pai)
  empresas: Empresa[];
  funcionarios: Funcionario[];
  gruposEquipe: GrupoEquipe[];
  presencasLink: PresencaApontamento[];
  
  // Filtros globais (compartilhados entre TODAS visões)
  globalSearch: string;
  globalEmpresa: string;
  globalData: string;
  
  // Estado específico por visão
  colaboradorSelecionado: string | null;
  equipeEditando: string | null;
  
  // Actions
  setGlobalSearch: (search: string) => void;
  setGlobalEmpresa: (empresa: string) => void;
  setGlobalData: (data: string) => void;
  setColaboradorSelecionado: (id: string | null) => void;
  setEquipeEditando: (id: string | null) => void;
  
  // Injetar dados do pai
  setDados: (dados: {
    empresas: Empresa[];
    funcionarios: Funcionario[];
    gruposEquipe: GrupoEquipe[];
    presencasLink: PresencaApontamento[];
  }) => void;
}

export const usePessoasPresencaStore = create<PessoasPresencaStore>((set) => ({
  // Estado inicial
  empresas: [],
  funcionarios: [],
  gruposEquipe: [],
  presencasLink: [],
  
  globalSearch: '',
  globalEmpresa: 'todas',
  globalData: new Date().toISOString().slice(0, 10),
  
  colaboradorSelecionado: null,
  equipeEditando: null,
  
  // Actions
  setGlobalSearch: (search) => set({ globalSearch: search }),
  setGlobalEmpresa: (empresa) => set({ globalEmpresa: empresa }),
  setGlobalData: (data) => set({ globalData: data }),
  setColaboradorSelecionado: (id) => set({ colaboradorSelecionado: id }),
  setEquipeEditando: (id) => set({ equipeEditando: id }),
  
  setDados: (dados) => set({
    empresas: dados.empresas,
    funcionarios: dados.funcionarios,
    gruposEquipe: dados.gruposEquipe,
    presencasLink: dados.presencasLink,
  }),
}));

// ==================== HOOKS CUSTOMIZADOS ====================

// Hook para filtros globais (compartilhado entre visões)
export function useFiltragemGlobal() {
  const { 
    funcionarios, 
    gruposEquipe, 
    globalSearch, 
    globalEmpresa 
  } = usePessoasPresencaStore();
  
  const funcionariosFiltrados = funcionarios.filter(f => {
    const matchEmpresa = globalEmpresa === 'todas' || f.empresaId === globalEmpresa;
    const matchSearch = !globalSearch || 
      f.nome.toLowerCase().includes(globalSearch.toLowerCase()) ||
      f.matricula?.includes(globalSearch);
    return matchEmpresa && matchSearch;
  });
  
  const equipesFiltradas = gruposEquipe.filter(e => {
    const matchEmpresa = globalEmpresa === 'todas' || 
      e.funcionarioIds.some(id => {
        const func = funcionarios.find(f => f.id === id);
        return func?.empresaId === globalEmpresa;
      });
    return matchEmpresa;
  });
  
  return { funcionariosFiltrados, equipesFiltradas };
}

// Hook para métricas do painel
export function useMetricasPainel() {
  const { presencasLink, globalData } = usePessoasPresencaStore();
  const { equipesFiltradas } = useFiltragemGlobal();
  
  const registrosHoje = presencasLink.filter(p => p.data === globalData);
  const presentes = registrosHoje.filter(p => p.status === 'Presente').length;
  const ausentes = registrosHoje.filter(p => p.status === 'Ausente').length;
  const totalEquipes = equipesFiltradas.length;
  const equipesEnviaram = new Set(registrosHoje.map(p => p.grupoId)).size;
  
  return { presentes, ausentes, totalEquipes, equipesEnviaram };
}
