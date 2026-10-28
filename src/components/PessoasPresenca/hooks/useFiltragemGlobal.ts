/**
 * Hook: useFiltragemGlobal
 * 
 * Aplica filtros globais (busca, empresa, situação) em funcionários e equipes.
 * Compartilhado entre TODAS as visões.
 */

import { useMemo } from 'react';
import { usePessoasPresencaStore } from '../store';
import { normalizeComparable } from '../../../utils/canonicalIdentity';

export function useFiltragemGlobal() {
  const { 
    funcionarios, 
    gruposEquipe, 
    empresas,
    globalSearch, 
    globalEmpresa,
    globalSituacao
  } = usePessoasPresencaStore();
  
  // Filtrar funcionários
  const funcionariosFiltrados = useMemo(() => {
    const termo = normalizeComparable(globalSearch).trim();
    
    return funcionarios.filter(f => {
      // Filtro por empresa
      const matchEmpresa = globalEmpresa === 'todas' || f.empresaId === globalEmpresa;
      
      // Filtro por situação
      const situacaoAtual = f.status || (f.ativo ? 'ATIVO' : 'INATIVO');
      const matchSituacao = globalSituacao === 'Todas' || situacaoAtual === globalSituacao;
      
      // Filtro por busca (nome, matrícula, cargo, área, líder)
      const matchSearch = !termo || normalizeComparable(
        `${f.nome} ${f.matricula || ''} ${f.cargo} ${f.area || ''} ${f.liderNome || ''}`
      ).includes(termo);
      
      return matchEmpresa && matchSituacao && matchSearch;
    }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [funcionarios, globalSearch, globalEmpresa, globalSituacao]);
  
  // Filtrar equipes
  const equipesFiltradas = useMemo(() => {
    const termo = normalizeComparable(globalSearch).trim();
    
    return gruposEquipe.filter(e => {
      // Filtro por empresa (se algum membro é da empresa)
      const matchEmpresa = globalEmpresa === 'todas' || 
        e.funcionarioIds.some(id => {
          const func = funcionarios.find(f => f.id === id);
          return func?.empresaId === globalEmpresa;
        });
      
      // Filtro por busca (nome equipe, encarregado, frente)
      const matchSearch = !termo || normalizeComparable(
        `${e.nome} ${e.responsavel} ${e.frenteServico || ''}`
      ).includes(termo);
      
      return matchEmpresa && matchSearch;
    }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [gruposEquipe, funcionarios, globalSearch, globalEmpresa]);
  
  // Nomes de empresas (para dropdowns)
  const empresasOpcoes = useMemo(() => {
    return empresas.map(emp => ({ id: emp.id, nome: emp.nome }));
  }, [empresas]);
  
  return { 
    funcionariosFiltrados, 
    equipesFiltradas,
    empresasOpcoes,
    totalFuncionarios: funcionarios.length,
    totalEquipes: gruposEquipe.length,
  };
}
