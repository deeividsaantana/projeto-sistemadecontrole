/**
 * Dashboard Metrics Calculation
 * Funções puras para calcular KPIs dos 3 níveis
 */

import type { ObraLocal, Equipamento, RegistroProducao } from '../types';
import type { DashboardLevel1, DashboardLevel2, DashboardLevel3 } from '../types/dashboard';

/**
 * Calcula métricas estratégicas (Nível 1)
 */
export function calculateLevel1(
  obras: ObraLocal[],
  equipamentos: Equipamento[],
  producao: RegistroProducao[],
  periodo: { inicio: string; fim: string }
): DashboardLevel1 {
  const obrasAbertas = obras.filter(o => o.status === 'Ativa').length;
  const equipamentosAtivos = equipamentos.filter(e => e.status === 'Ativo').length;
  const equipamentosParados = equipamentos.filter(e => e.status === 'Parado').length;

  const prodInPeriod = producao.filter(p => p.data >= periodo.inicio && p.data <= periodo.fim);
  const producaoMes = prodInPeriod.reduce((sum, p) => sum + (p.quantidade || 0), 0);
  const eficienciaMedia = obrasAbertas > 0 ? producaoMes / obrasAbertas : 0;
  const totalEquipamentos = equipamentosAtivos + equipamentosParados;
  const taxaAtividade = totalEquipamentos > 0 ? (equipamentosAtivos / totalEquipamentos) * 100 : 0;

  return {
    obrasAbertas,
    equipamentosAtivos,
    equipamentosParados,
    producaoMes,
    eficienciaMedia: Math.round(eficienciaMedia * 100) / 100,
    taxaAtividade: Math.round(taxaAtividade),
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Calcula dados operacionais real-time (Nível 2)
 * TODO: Implementar agregação completa
 */
export function calculateLevel2(
  _obras: ObraLocal[],
  _equipamentos: Equipamento[],
  _producao: RegistroProducao[],
  _periodo: { inicio: string; fim: string }
): DashboardLevel2 {
  return {
    obras: [],
    equipamentos: [],
    alertas: [],
  };
}

/**
 * Calcula insights e gráficos (Nível 3)
 * TODO: Implementar cálculos de tendência
 */
export function calculateLevel3(
  _producao: RegistroProducao[],
  _periodo: { inicio: string; fim: string }
): DashboardLevel3 {
  return {
    graficos: {
      producaoTrend: { data: [] },
      eficienciaTrend: { data: [] },
      equipamentoPorStatus: { data: [] },
      obraPorProgresso: { data: [] },
    },
    metricas: {
      producaoCompare: { atual: 0, anterior: 0, variacao: 0 },
      eficienciaCompare: { atual: 0, anterior: 0, variacao: 0 },
    },
  };
}
