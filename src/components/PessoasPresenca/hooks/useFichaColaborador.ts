/**
 * Hook: useFichaColaborador
 * 
 * Agrega TODOS os dados de um colaborador específico:
 * - Dados pessoais
 * - Equipe atual
 * - Últimas presenças
 * - Equipamentos operados
 * - Viagens de jazida
 * - Checklists
 */

import { useMemo } from 'react';
import { usePessoasPresencaStore } from '../store';
import type { Funcionario } from '../../../types';

export function useFichaColaborador(colaboradorId: string | null) {
  const {
    funcionarios,
    gruposEquipe,
    empresas,
    presencasLink,
    controlesEquipamentos,
    ticketsJazida,
    checklists,
  } = usePessoasPresencaStore();
  
  // Funcionário selecionado
  const colaborador = useMemo<Funcionario | null>(() => {
    if (!colaboradorId) return null;
    return funcionarios.find(f => f.id === colaboradorId) || null;
  }, [funcionarios, colaboradorId]);
  
  // Equipe atual
  const equipe = useMemo(() => {
    if (!colaboradorId) return null;
    return gruposEquipe.find(e => e.funcionarioIds.includes(colaboradorId)) || null;
  }, [gruposEquipe, colaboradorId]);
  
  // Empresa
  const empresa = useMemo(() => {
    if (!colaborador?.empresaId) return null;
    return empresas.find(e => e.id === colaborador.empresaId) || null;
  }, [empresas, colaborador]);
  
  // Presenças (últimas 30)
  const presencas = useMemo(() => {
    if (!colaboradorId) return [];
    return presencasLink
      .filter(p => p.funcionarioId === colaboradorId)
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 30);
  }, [presencasLink, colaboradorId]);
  
  // Estatísticas de presença
  const estatisticasPresenca = useMemo(() => {
    const total = presencas.length;
    const presentes = presencas.filter(p => p.status === 'Presente').length;
    const ausentes = presencas.filter(p => p.status === 'Ausente').length;
    const atrasados = presencas.filter(p => p.status === 'Atraso').length;
    
    return {
      total,
      presentes,
      ausentes,
      atrasados,
      porcentagemPresenca: total > 0 ? Math.round((presentes / total) * 100) : 0,
    };
  }, [presencas]);
  
  // Equipamentos operados
  const equipamentosOperados = useMemo(() => {
    if (!colaboradorId) return [];
    return controlesEquipamentos
      .filter(c => c.operadorId === colaboradorId)
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 20);
  }, [controlesEquipamentos, colaboradorId]);
  
  // Viagens de jazida
  const viagensJazida = useMemo(() => {
    if (!colaboradorId) return [];
    return ticketsJazida
      .filter(t => t.motoristaId === colaboradorId || t.ajudanteId === colaboradorId)
      .sort((a, b) => (b.dataCarregamento || '').localeCompare(a.dataCarregamento || ''))
      .slice(0, 20);
  }, [ticketsJazida, colaboradorId]);
  
  // Checklists realizados
  const checklistsRealizados = useMemo(() => {
    if (!colaboradorId) return [];
    return checklists
      .filter(c => c.operadorId === colaboradorId)
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
      .slice(0, 10);
  }, [checklists, colaboradorId]);
  
  return {
    colaborador,
    equipe,
    empresa,
    presencas,
    estatisticasPresenca,
    equipamentosOperados,
    viagensJazida,
    checklistsRealizados,
  };
}
