import type { ParteDiariaEquipamento } from '../types';

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

export const buildParteDiariaOperationalAnalysis = (
  registros: ParteDiariaEquipamento[],
): OperationalAnalysis => {
  const totalRegistros = registros.length;
  const horasTrabalhadas = registros.reduce((sum, item) => sum + Number(item.totalHorasTrabalhadas || 0), 0);
  const horasParadas = registros.reduce((sum, item) =>
    sum + item.atividades.filter(activity => activity.codigoPerda).reduce((subtotal, activity) => subtotal + Number(activity.totalHoras || 0), 0), 0);
  const semObra = registros.filter(item => !item.obraId && !item.obraNome?.trim()).length;
  const semEquipamento = registros.filter(item => !item.equipamentoId && !item.prefixo?.trim()).length;
  const semOperador = registros.filter(item => !item.operadorNome?.trim()).length;
  const inconsistentes = registros.filter(item => item.status === 'Inconsistente').length;
  const pendentes = registros.filter(item => item.status === 'Pendente').length;
  const deficientes = registros.filter(item => item.status === 'Com deficiência').length;
  const duplicidades = duplicateCount(registros, item =>
    item.numero ? `numero-${normalize(item.numero)}` : [item.data, normalize(item.prefixo), normalize(item.operadorNome)].join('|'),
  );

  const problemas = [
    semObra ? `${semObra} ficha(s) sem obra reconhecida.` : '',
    semEquipamento ? `${semEquipamento} ficha(s) sem equipamento/frota reconhecido.` : '',
    semOperador ? `${semOperador} ficha(s) sem operador/motorista.` : '',
    pendentes ? `${pendentes} ficha(s) pendente(s) de conferência.` : '',
    inconsistentes ? `${inconsistentes} ficha(s) inconsistente(s).` : '',
    deficientes ? `${deficientes} ficha(s) com deficiência de checklist.` : '',
    duplicidades ? `${duplicidades} possível(is) duplicidade(s) por número ou data/frota/operador.` : '',
  ].filter(Boolean);

  const aproveitamento = horasTrabalhadas + horasParadas > 0
    ? (horasTrabalhadas / (horasTrabalhadas + horasParadas)) * 100
    : 0;
  const confianca: OperationalAnalysis['confianca'] = !totalRegistros
    ? 'Baixa'
    : problemas.length > 3
      ? 'Média'
      : 'Alta';

  return {
    resumoExecutivo: totalRegistros
      ? [
        `A importação trouxe ${totalRegistros} parte(s) diária(s), com ${formatNumber(horasTrabalhadas, 1)} hora(s) trabalhada(s) e ${formatNumber(horasParadas, 1)} hora(s) parada(s).`,
        `O aproveitamento operacional calculado é ${formatNumber(aproveitamento, 1)}%, considerando apenas horas informadas.`,
        problemas.length ? 'Há fichas que precisam de conferência antes de uso gerencial.' : 'As fichas importadas não apresentaram problemas estruturais evidentes.',
      ]
      : ['Nenhuma parte diária foi reconhecida para análise.'],
    principaisProblemas: problemas.length
      ? problemas
      : ['Nenhum problema estrutural evidente foi encontrado nas fichas importadas.'],
    oportunidadesMelhoria: [
      'Padronizar número da ficha, frota, operador e obra para evitar duplicidade e retrabalho.',
      'Separar horas produtivas e códigos de perda para medir gargalos por motivo.',
      'Digitalizar checklist diário para reduzir ficha incompleta e facilitar auditoria.',
    ],
    automacoesRecomendadas: [
      'Importar partes por modelo padrão com validação de obra, frota e operador contra cadastros.',
      'Criar alerta de horímetro inconsistente, jornada acima do limite e duplicidade de ficha.',
      'Gerar dashboard de horas trabalhadas, horas paradas, aproveitamento e deficiências por frota.',
    ],
    indicadores: [
      { nome: 'Partes importadas', valor: String(totalRegistros), interpretacao: 'Volume de fichas entrando para conferência.' },
      { nome: 'Horas trabalhadas', valor: formatNumber(horasTrabalhadas, 1), interpretacao: 'Base para produtividade operacional.' },
      { nome: 'Horas paradas', valor: formatNumber(horasParadas, 1), interpretacao: 'Base para análise de perdas e gargalos.' },
      { nome: 'Aproveitamento', valor: `${formatNumber(aproveitamento, 1)}%`, interpretacao: 'Trabalho dividido por trabalho + parada, quando há horas suficientes.' },
      { nome: 'Possíveis duplicidades', valor: String(duplicidades), interpretacao: 'Fichas que podem representar lançamento repetido.' },
    ],
    planoAcao: [
      { acao: 'Conferir fichas sem obra, equipamento ou operador.', impacto: 'Alto', dificuldade: 'Baixa', tempoEstimado: 'Imediato', ganhoEsperado: 'Evita perda de rastreabilidade operacional.' },
      { acao: 'Revisar fichas pendentes, deficientes ou inconsistentes.', impacto: 'Alto', dificuldade: 'Média', tempoEstimado: 'No mesmo dia da importação', ganhoEsperado: 'Melhora qualidade dos KPIs de frota.' },
      { acao: 'Padronizar códigos de perda no apontamento.', impacto: 'Médio', dificuldade: 'Baixa', tempoEstimado: '1 hora', ganhoEsperado: 'Facilita atacar principais gargalos.' },
    ],
    proximosPassos: [
      'Revisar a amostra da importação.',
      'Corrigir cadastros não reconhecidos antes de confirmar quando houver muitos pendentes.',
      'Confirmar a importação e usar o painel de frota para acompanhar horas e deficiências.',
    ],
    confianca,
  };
};
