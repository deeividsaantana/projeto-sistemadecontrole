/**
 * Dashboard Types — 3 Níveis
 * Nível 1: KPIs estratégicos
 * Nível 2: Operacional real-time
 * Nível 3: Insights e gráficos
 */

export interface KPIMetric {
  label: string;
  value: number;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
  trendPercent?: number;
  onClick?: () => void;
}

export interface DashboardLevel1 {
  obrasAbertas: number;
  equipamentosAtivos: number;
  equipamentosParados: number;
  producaoMes: number;
  eficienciaMedia: number;
  taxaAtividade: number;
  lastUpdated: string;
}

export interface DashboardLevel2Obra {
  id: string;
  nome: string;
  responsavel: string;
  status: 'Ativa' | 'Pausada' | 'Concluída';
  progresso: number;
  producaoHoje: number;
  atraso: number; // dias
}

export interface DashboardLevel2Equipamento {
  id: string;
  nome: string;
  obra: string;
  status: 'Ativo' | 'Parado' | 'Manutenção';
  utilizacao: number; // %
  lastActivity: string;
}

export interface DashboardLevel2Alerta {
  id: string;
  tipo: 'atraso' | 'falha' | 'seguranca';
  mensagem: string;
  severidade: 'baixa' | 'media' | 'alta';
  timestamp: string;
}

export interface DashboardLevel2 {
  obras: DashboardLevel2Obra[];
  equipamentos: DashboardLevel2Equipamento[];
  alertas: DashboardLevel2Alerta[];
}

export interface DashboardLevel3Grafico {
  data: Array<{ data: string; valor: number }>;
}

export interface DashboardLevel3 {
  graficos: {
    producaoTrend: DashboardLevel3Grafico;
    eficienciaTrend: DashboardLevel3Grafico;
    equipamentoPorStatus: { data: Array<{ status: string; count: number }> };
    obraPorProgresso: { data: Array<{ obra: string; progresso: number }> };
  };
  metricas: {
    producaoCompare: { atual: number; anterior: number; variacao: number };
    eficienciaCompare: { atual: number; anterior: number; variacao: number };
  };
}
