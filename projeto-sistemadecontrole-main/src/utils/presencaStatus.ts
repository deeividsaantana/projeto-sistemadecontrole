import type { PresencaStatus } from '../types';

export const PRESENCA_STATUS_PRINCIPAIS: PresencaStatus[] = [
  'Presente',
  'Ausente',
  'Falta justificada',
  'Atestado',
];

export const PRESENCA_STATUS_AFASTAMENTO: PresencaStatus[] = ['Baixada', 'Recesso', 'Férias'];
export const PRESENCA_STATUS_OUTROS: PresencaStatus[] = ['Atraso', 'Saída antecipada', 'Afastado', 'Desligado', 'Outro'];
export const PRESENCA_STATUS_SECUNDARIOS: PresencaStatus[] = [...PRESENCA_STATUS_AFASTAMENTO, ...PRESENCA_STATUS_OUTROS];

export type ResumoPresenca = {
  presentes: number;
  faltas: number;
  afastamentos: number;
  justificados: number;
  desligados: number;
  outros: number;
  previstos: number;
};

export const resumirPresencas = (statuses: Array<PresencaStatus | string | undefined>): ResumoPresenca => {
  const counts = statuses.reduce<Record<string, number>>((summary, status) => {
    if (status) summary[status] = (summary[status] || 0) + 1;
    return summary;
  }, {});
  const presentes = (counts.Presente || 0) + (counts.Atraso || 0) + (counts['Saída antecipada'] || 0);
  const afastamentos = PRESENCA_STATUS_AFASTAMENTO.reduce((total, status) => total + (counts[status] || 0), 0);
  const desligados = counts.Desligado || 0;
  return {
    presentes,
    faltas: counts.Ausente || 0,
    afastamentos,
    justificados: (counts['Falta justificada'] || 0) + (counts.Atestado || 0),
    desligados,
    outros: (counts.Afastado || 0) + (counts.Outro || 0),
    previstos: Math.max(0, statuses.filter(Boolean).length - desligados),
  };
};
