/**
 * Apoio da tela de Manutenção ao relatório do dia: o que entra na conta, os
 * dias que ainda pedem conferência, o nome de cada situação e o texto que vai
 * para o histórico quando alguém decide a conferência. Sem React, para ser
 * testado sozinho.
 */
import type { ConferenciaManutencao, ControleEquipamentoDiario, OrdemServico } from '../types';
import { formatarMinutos, type ParadaDoDia, type SituacaoParada } from './horasParadasDoDia';
import { montarRelatorioManutencaoDia, type LinhaRelatorioManutencao, type RelatorioManutencaoDia } from './relatorioManutencaoDia';

export const dataDeHoje = (agora: Date): string => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(agora);

export const diaAntes = (data: string, dias = 1): string => {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
};

/**
 * Lançamentos que têm algo de manutenção: entrada, liberação ou decisão de
 * conferência. Os outros não têm período parado e saem do relatório de
 * qualquer jeito; tirar antes só poupa conta. Lançamento excluído não conta.
 */
export const registrosDeManutencao = (registros: readonly ControleEquipamentoDiario[]): ControleEquipamentoDiario[] =>
  registros.filter(registro => !(registro as { excluido?: unknown }).excluido && Boolean(
    registro.horaEntradaManutencao
    || registro.horaLiberacao
    || registro.conferenciaManutencao
    || (registro.eventos || []).some(evento => evento.tipo === 'ENTRADA_MANUTENCAO' || evento.tipo === 'LIBERACAO_MANUTENCAO'),
  ));

/** Dias (do mais novo ao mais antigo) que ainda têm equipamento a conferir, dentro da janela. */
export const diasParaConferir = (
  registros: readonly ControleEquipamentoDiario[],
  ordens: readonly OrdemServico[],
  agora: Date,
  janelaDias = 31,
): Array<{ data: string; aConferir: number }> => {
  const hoje = dataDeHoje(agora);
  const inicio = diaAntes(hoje, janelaDias);
  const datas = [...new Set(registros.map(registro => registro.data))]
    .filter(data => data >= inicio && data <= hoje)
    .sort((a, b) => b.localeCompare(a));
  return datas
    .map(data => ({ data, aConferir: montarRelatorioManutencaoDia(data, registros, ordens, agora).aConferir }))
    .filter(dia => dia.aConferir > 0);
};

export type TomSituacao = 'parado' | 'liberado' | 'conferir';

/**
 * Nome da situação na tela. Vem da conta do dia, não do grupo do relatório,
 * com uma exceção: dia passado sem liberação e abaixo de 10 h está no grupo
 * do limite, mas não bateu 10 h; ali o nome é "Sem liberação".
 */
export const rotuloDaSituacao = (
  situacao: SituacaoParada,
  grupo?: LinhaRelatorioManutencao['grupo'],
): { texto: string; tom: TomSituacao } => {
  if (grupo === 'LIMITE' && situacao === 'PARADO') return { texto: 'Sem liberação', tom: 'conferir' };
  if (situacao === 'PARADO') return { texto: 'Parado', tom: 'parado' };
  if (situacao === 'LIBERADO') return { texto: 'Liberado', tom: 'liberado' };
  if (situacao === 'LIMITE_ATINGIDO') return { texto: 'Limite 10 h', tom: 'conferir' };
  return { texto: 'Inconsistente', tom: 'conferir' };
};

export const ROTULO_DECISAO: Record<ConferenciaManutencao['decisao'], string> = {
  CONFIRMADO_10H: 'Confirmou 10 h',
  LIBERACAO_INFORMADA: 'Informou a liberação real',
  CONTINUA_AMANHA: 'Continua parado amanhã',
};

const dataBr = (data: string) => data.split('-').reverse().join('/');

const resumoDaParada = (parada: ParadaDoDia) => (parada.situacao === 'INCONSISTENTE'
  ? `inconsistente${parada.motivoInconsistencia ? ` (${parada.motivoInconsistencia})` : ''}`
  : `${rotuloDaSituacao(parada.situacao).texto.toLowerCase()}, ${formatarMinutos(parada.totalMin)}`);

/** Texto do histórico para uma decisão da conferência, com o antes e o depois. */
export const descricaoDaConferencia = ({ prefixo, data, decisao, antes, depois, anterior, hora }: {
  prefixo: string;
  data: string;
  decisao: ConferenciaManutencao['decisao'];
  antes: ParadaDoDia;
  depois: ParadaDoDia;
  anterior?: ConferenciaManutencao;
  hora?: string;
}): string => [
  `Conferência de ${prefixo} em ${dataBr(data)}: ${ROTULO_DECISAO[decisao]}${hora ? ` às ${hora}` : ''}.`,
  `Antes: ${resumoDaParada(antes)}${anterior ? `; decisão anterior: ${ROTULO_DECISAO[anterior.decisao]} por ${anterior.decididoPor}` : ''}.`,
  `Depois: ${resumoDaParada(depois)}.`,
].join(' ');

/** Horas do dia somadas por motivo da parada, do maior para o menor. */
export const motivosDoDia = (
  relatorio: RelatorioManutencaoDia,
  registros: readonly ControleEquipamentoDiario[],
  ordens: readonly OrdemServico[],
): Array<{ motivo: string; totalMin: number; equipamentos: number }> => {
  const registroPorId = new Map(registros.map(registro => [registro.id, registro]));
  const ordemPorId = new Map(ordens.map(ordem => [ordem.id, ordem]));
  const agrupado = new Map<string, { motivo: string; totalMin: number; equipamentos: number }>();
  relatorio.linhas.forEach(linha => {
    const registro = registroPorId.get(linha.registroId);
    const ordem = registro?.ordemServicoId ? ordemPorId.get(registro.ordemServicoId) : undefined;
    const motivo = (ordem?.motivo || registro?.motivoManutencao || '').trim() || 'Sem motivo informado';
    const atual = agrupado.get(motivo) || { motivo, totalMin: 0, equipamentos: 0 };
    atual.totalMin += linha.parada.totalMin;
    atual.equipamentos += 1;
    agrupado.set(motivo, atual);
  });
  return [...agrupado.values()].sort((a, b) => b.totalMin - a.totalMin || a.motivo.localeCompare(b.motivo, 'pt-BR'));
};

/** Texto do histórico para a OS que fechou sozinha no limite de 10 h, com o antes e o depois. */
export const descricaoDoEncerramento = (antes: OrdemServico, depois: OrdemServico, prefixo: string): string => {
  const horas = depois.horasParadas === undefined ? '' : `, ${formatarMinutos(Math.round(depois.horasParadas * 60))} paradas no dia`;
  return `Encerrada pelo limite de 10 h: ${depois.numero} de ${prefixo}. `
    + `Antes: ${antes.status}, sem liberação. `
    + `Depois: ${depois.status} em ${dataBr(depois.dataConclusao || '')}${depois.horaConclusao ? ` às ${depois.horaConclusao}` : ''}${horas}.`;
};
