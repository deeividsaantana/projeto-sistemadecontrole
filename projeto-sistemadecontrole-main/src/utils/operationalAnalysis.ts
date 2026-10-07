
export interface OperationalIndicator {
  nome: string;
  valor: string;
  interpretacao: string;
}

export interface OperationalAction {
  acao: string;
  impacto: string;
  dificuldade: string;
  tempoEstimado: string;
  ganhoEsperado: string;
}

export interface OperationalAnalysis {
  resumoExecutivo: string[];
  principaisProblemas: string[];
  oportunidadesMelhoria: string[];
  automacoesRecomendadas: string[];
  indicadores: OperationalIndicator[];
  planoAcao: OperationalAction[];
  proximosPassos: string[];
  confianca: 'Alta' | 'Média' | 'Baixa';
}

const formatNumber = (value: number, digits = 2) =>
  Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: digits });

const normalize = (value: string = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const duplicateCount = <T,>(items: T[], getKey: (item: T) => string) => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  items.forEach(item => {
    const key = getKey(item);
    if (!key) return;
    if (seen.has(key)) duplicates.add(key);
    else seen.add(key);
  });
  return duplicates.size;
};

