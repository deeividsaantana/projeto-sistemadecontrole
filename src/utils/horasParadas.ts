import type { ControleEquipamentoDiario, Equipamento, OrdemServico } from '../types';

export interface Parada {
  id: string;
  data: string;
  equipamentoId: string;
  prefixo: string;
  categoria: string;
  inicio: string;
  fim: string;
  horas: number;
  motivo: string;
  frente: string;
  ordemNumero?: string;
  emCurso: boolean;
}

const STATUS_PARADO = ['Em manutenção', 'Aguardando manutenção', 'Parado', 'Aguardando equipamento'];

const minutos = (hora?: string) => {
  const [h, m] = String(hora || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

/**
 * Paradas medidas no controle diário: da entrada em manutenção até a liberação.
 * Registro parado sem horário fica de fora da conta em vez de virar estimativa —
 * some como pendência de preenchimento, não como hora inventada.
 */
export const listarParadas = (
  registros: Array<ControleEquipamentoDiario & { frenteServico?: string }>,
  ordens: OrdemServico[] = [],
  equipamentos: Equipamento[] = [],
): Parada[] => registros.flatMap(registro => {
  const inicio = minutos(registro.horaEntradaManutencao);
  if (inicio === null) return [];
  const fim = minutos(registro.horaLiberacao);
  const emCurso = fim === null;
  // Sem liberação a parada corre até o fim do dia do lançamento.
  const fimEfetivo = emCurso ? 24 * 60 : fim;
  if (fimEfetivo < inicio) return [];
  const equipamento = equipamentos.find(item => item.id === registro.equipamentoId || item.prefixo === registro.prefixo);
  return [{
    id: registro.id,
    data: registro.data,
    equipamentoId: registro.equipamentoId || registro.prefixo,
    prefixo: registro.prefixo,
    categoria: equipamento?.categoriaFrota || registro.familia || 'Não classificado',
    inicio: registro.horaEntradaManutencao,
    fim: emCurso ? '' : registro.horaLiberacao,
    horas: Number(((fimEfetivo - inicio) / 60).toFixed(2)),
    motivo: registro.motivoManutencao || registro.observacao || 'Sem motivo informado',
    frente: registro.frenteServico || '',
    ordemNumero: ordens.find(ordem => ordem.id === registro.ordemServicoId)?.numero,
    emCurso,
  }];
});

/** Total de horas por chave, da maior para a menor. */
export const somarPor = (paradas: Parada[], chave: (parada: Parada) => string) => {
  const mapa = new Map<string, { chave: string; horas: number; ocorrencias: number }>();
  paradas.forEach(parada => {
    const nome = chave(parada) || 'Não informado';
    const atual = mapa.get(nome) || { chave: nome, horas: 0, ocorrencias: 0 };
    atual.horas += parada.horas;
    atual.ocorrencias += 1;
    mapa.set(nome, atual);
  });
  return Array.from(mapa.values())
    .map(item => ({ ...item, horas: Number(item.horas.toFixed(2)) }))
    .sort((a, b) => b.horas - a.horas);
};

/** Registros parados que ninguém preencheu o horário: viram pendência, não hora. */
export const paradasSemHorario = (registros: ControleEquipamentoDiario[]) =>
  registros.filter(item => STATUS_PARADO.includes(item.status) && minutos(item.horaEntradaManutencao) === null).length;
