/**
 * Hook: useMetricasPainel
 * 
 * Calcula métricas agregadas para o dashboard (Painel).
 * - Presentes/Ausentes do dia
 * - Equipes que enviaram presença
 * - Efetivo por empresa
 * - Alertas (quem não enviou)
 */

import { useMemo } from 'react';
import { usePessoasPresencaStore } from '../store';
import { useFiltragemGlobal } from './useFiltragemGlobal';
import type { PresencaStatus } from '../../../types';

export function useMetricasPainel() {
  const { 
    presencasLink, 
    globalData,
    funcionarios,
  } = usePessoasPresencaStore();
  
  const { equipesFiltradas } = useFiltragemGlobal();
  
  // Registros do dia selecionado
  const registrosDoDia = useMemo(() => {
    return presencasLink.filter(p => p.data === globalData);
  }, [presencasLink, globalData]);
  
  // Contadores por status
  const contadores = useMemo(() => {
    const presentes = registrosDoDia.filter(p => p.status === 'Presente').length;
    const ausentes = registrosDoDia.filter(p => p.status === 'Ausente').length;
    const atrasados = registrosDoDia.filter(p => p.status === 'Atraso').length;
    const justificados = registrosDoDia.filter(p => 
      p.status === 'Falta justificada' || 
      p.status === 'Atestado' ||
      p.status === 'Férias' ||
      p.status === 'Afastado'
    ).length;
    
    const total = registrosDoDia.length;
    
    return { presentes, ausentes, atrasados, justificados, total };
  }, [registrosDoDia]);
  
  // Equipes que enviaram presença
  const equipesStatus = useMemo(() => {
    const equipesEnviaram = new Set(registrosDoDia.map(p => p.grupoId));
    const enviaram = equipesEnviaram.size;
    const pendentes = equipesFiltradas.filter(e => !equipesEnviaram.has(e.id));
    
    return {
      enviaram,
      total: equipesFiltradas.length,
      pendentes,
      porcentagem: equipesFiltradas.length > 0 
        ? Math.round((enviaram / equipesFiltradas.length) * 100) 
        : 0,
    };
  }, [registrosDoDia, equipesFiltradas]);
  
  // Efetivo por empresa
  const efetivoPorEmpresa = useMemo(() => {
    const mapa = new Map<string, { presentes: number; total: number }>();
    
    registrosDoDia.forEach(reg => {
      const func = funcionarios.find(f => f.id === reg.funcionarioId);
      if (!func?.empresaId) return;
      
      const current = mapa.get(func.empresaId) || { presentes: 0, total: 0 };
      current.total++;
      if (reg.status === 'Presente') current.presentes++;
      mapa.set(func.empresaId, current);
    });
    
    return Array.from(mapa.entries()).map(([empresaId, dados]) => ({
      empresaId,
      ...dados,
      porcentagem: dados.total > 0 ? Math.round((dados.presentes / dados.total) * 100) : 0,
    }));
  }, [registrosDoDia, funcionarios]);
  
  // Histórico últimos 7 dias
  const historico7Dias = useMemo(() => {
    const hoje = new Date(globalData);
    const dias: { data: string; presentes: number; ausentes: number }[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const data = new Date(hoje);
      data.setDate(data.getDate() - i);
      const dataISO = data.toISOString().slice(0, 10);
      
      const registrosDia = presencasLink.filter(p => p.data === dataISO);
      const presentes = registrosDia.filter(p => p.status === 'Presente').length;
      const ausentes = registrosDia.filter(p => p.status === 'Ausente').length;
      
      dias.push({ data: dataISO, presentes, ausentes });
    }
    
    return dias;
  }, [presencasLink, globalData]);
  
  return {
    contadores,
    equipesStatus,
    efetivoPorEmpresa,
    historico7Dias,
    registrosDoDia,
  };
}
