import type { ControleEquipamentoDiario, OrdemServico } from '../types';
import { formatarMinutos, horasParadasDoDia, type ParadaDoDia } from './horasParadasDoDia';
import { vemParadoDeOntem } from './manutencaoLimite';

export interface LinhaRelatorioManutencao {
  registroId: string;
  equipamentoId: string;
  prefixo: string;
  tipo: string;
  ordemNumero: string;
  parada: ParadaDoDia;
  grupo: 'OK' | 'LIMITE' | 'INCONSISTENTE';
  conferido: boolean;
}

export interface RelatorioManutencaoDia {
  data: string;
  linhas: LinhaRelatorioManutencao[];
  totalMin: number;
  equipamentos: number;
  emConferencia: number;
  conferidos: number;
  aConferir: number;
  porTipo: Array<{ tipo: string; totalMin: number; equipamentos: number }>;
  /** Paradas de hoje ainda abertas: não entram na conferência, mas impedem fechar o dia. */
  parados: number;
  fechado: boolean;
}

const ORDEM_GRUPO = { LIMITE: 0, INCONSISTENTE: 1, OK: 2 } as const;

const dataHoje = (agora: Date): string => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(agora);

export const montarRelatorioManutencaoDia = (
  data: string,
  registros: readonly ControleEquipamentoDiario[],
  ordens: readonly OrdemServico[],
  agora: Date,
): RelatorioManutencaoDia => {
  const numeroDa = new Map(ordens.map(ordem => [ordem.id, ordem.numero]));
  const hoje = dataHoje(agora);
  const linhas = registros
    .filter(registro => registro.data === data)
    .map(registro => {
      const parada = horasParadasDoDia(registro, agora, { vemParadoDeOntem: vemParadoDeOntem(registros, registro) });
      // Dia passado ainda aberto (sem liberação, abaixo de 10 h) precisa de decisão: liberação real ou continua amanhã.
      const passado = registro.data < hoje;
      const grupo: LinhaRelatorioManutencao['grupo'] = parada.situacao === 'LIMITE_ATINGIDO'
        || (passado && parada.situacao === 'PARADO') ? 'LIMITE'
        : parada.situacao === 'INCONSISTENTE' ? 'INCONSISTENTE' : 'OK';
      return {
        registroId: registro.id,
        equipamentoId: registro.equipamentoId,
        prefixo: registro.prefixo,
        tipo: registro.familia || registro.tipoEquipamento || 'Sem tipo',
        ordemNumero: (registro.ordemServicoId && numeroDa.get(registro.ordemServicoId)) || '',
        parada,
        grupo,
        // Inconsistente só sai do grupo quando a liberação informada corrige o dado, então nunca conta como conferido.
        conferido: grupo === 'OK' || (grupo === 'LIMITE' && Boolean(registro.conferenciaManutencao)),
      };
    })
    .filter(linha => linha.parada.periodos.length > 0 || linha.grupo === 'INCONSISTENTE')
    .sort((a, b) => ORDEM_GRUPO[a.grupo] - ORDEM_GRUPO[b.grupo] || a.prefixo.localeCompare(b.prefixo));

  const porTipoMapa = new Map<string, { tipo: string; totalMin: number; equipamentos: number }>();
  linhas.forEach(linha => {
    const atual = porTipoMapa.get(linha.tipo) || { tipo: linha.tipo, totalMin: 0, equipamentos: 0 };
    atual.totalMin += linha.parada.totalMin;
    atual.equipamentos += 1;
    porTipoMapa.set(linha.tipo, atual);
  });

  const emConferencia = linhas.filter(linha => linha.grupo !== 'OK').length;
  const aConferir = linhas.filter(linha => !linha.conferido).length;
  const parados = linhas.filter(linha => linha.grupo === 'OK' && linha.parada.situacao === 'PARADO').length;
  return {
    data,
    linhas,
    totalMin: linhas.reduce((total, linha) => total + linha.parada.totalMin, 0),
    equipamentos: linhas.length,
    emConferencia,
    conferidos: linhas.length - aConferir,
    aConferir,
    porTipo: [...porTipoMapa.values()].sort((a, b) => b.totalMin - a.totalMin),
    parados,
    fechado: aConferir === 0 && parados === 0 && data < hoje,
  };
};

const SITUACAO_TEXTO = { LIBERADO: 'Liberado', PARADO: 'Parado', LIMITE_ATINGIDO: 'Limite 10 h', INCONSISTENTE: 'Inconsistente' } as const;

export const linhasExcelManutencaoDia = (relatorio: RelatorioManutencaoDia): Array<Record<string, string | number>> =>
  relatorio.linhas.flatMap(linha => {
    const base = {
      Data: relatorio.data,
      Prefixo: linha.prefixo,
      Tipo: linha.tipo,
      OS: linha.ordemNumero,
      Situação: SITUACAO_TEXTO[linha.parada.situacao],
      Conferido: linha.conferido ? 'Sim' : 'Não',
    };
    if (linha.parada.periodos.length === 0) {
      return [{ ...base, Entrada: '', Liberação: '', Descontos: '', 'Horas do período': '', 'Horas paradas': '', Observação: linha.parada.motivoInconsistencia || '' }];
    }
    return linha.parada.periodos.map((periodo, indice) => ({
      ...base,
      Entrada: periodo.inicio,
      Liberação: periodo.fim ?? 'em aberto',
      Descontos: formatarMinutos(periodo.descontoMin),
      'Horas do período': formatarMinutos(periodo.liquidoMin),
      'Horas paradas': indice === 0 ? formatarMinutos(linha.parada.totalMin) : '',
      Observação: '',
    }));
  });
