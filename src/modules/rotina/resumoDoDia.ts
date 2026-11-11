/**
 * O que o sistema já sabe sobre o dia, para o Meu dia: equipamentos parados e
 * diesel. Só lê o que as outras telas gravaram; nada é guardado aqui.
 */
import type { Abastecimento, ControleEquipamentoDiario, Equipamento, StatusControleEquipamentoDiario } from '../../types';

const arredondar = (valor: number) => Number(valor.toFixed(3));

/** Status em que o equipamento não trabalhou e precisa de motivo. */
export const STATUS_PARADO: readonly StatusControleEquipamentoDiario[] = ['Em manutenção', 'Aguardando manutenção', 'Aguardando motorista', 'Aguardando equipamento', 'A confirmar'];

export interface EquipamentoParado {
  prefixo: string;
  status: StatusControleEquipamentoDiario;
  motivo: string;
}

export interface ResumoDoDia {
  equipamentos: {
    apontados: number;
    emOperacao: number;
    parados: EquipamentoParado[];
    /** Parados sem motivo escrito: o checklist pede justificativa. */
    semMotivo: number;
    /** Mesmo equipamento apontado mais de uma vez no dia. */
    repetidos: string[];
  };
  diesel: {
    litros: number;
    abastecimentos: number;
    /** Os que mais abasteceram no dia, do maior para o menor. */
    porEquipamento: Array<{ prefixo: string; litros: number }>;
    /** Lançamentos do dia que ainda pedem conferência. */
    aConferir: number;
  };
}

export const resumoDoDia = (entrada: {
  dia: string;
  abastecimentos: readonly Abastecimento[];
  controles: readonly ControleEquipamentoDiario[];
  equipamentos: readonly Equipamento[];
}): ResumoDoDia => {
  const { dia } = entrada;
  const controles = entrada.controles.filter(item => item.data === dia && item.status !== 'Desmobilizado');
  const vistos = new Map<string, number>();
  controles.forEach(item => vistos.set(item.prefixo, (vistos.get(item.prefixo) || 0) + 1));
  const parados = controles
    .filter(item => STATUS_PARADO.includes(item.status))
    .map(item => ({ prefixo: item.prefixo || 'Sem prefixo', status: item.status, motivo: (item.motivoManutencao || item.observacao || '').trim() }))
    .sort((a, b) => Number(Boolean(a.motivo)) - Number(Boolean(b.motivo)) || a.prefixo.localeCompare(b.prefixo, 'pt-BR', { numeric: true }));

  const prefixoDe = new Map(entrada.equipamentos.map(item => [item.id, item.prefixo]));
  const abastecimentos = entrada.abastecimentos.filter(item => item.data === dia && item.status !== 'Cancelado' && item.status !== 'Duplicado');
  const porEquipamento = new Map<string, number>();
  abastecimentos.forEach(item => {
    const prefixo = prefixoDe.get(item.equipamentoId) || item.prefixoInformado || 'Sem prefixo';
    porEquipamento.set(prefixo, arredondar((porEquipamento.get(prefixo) || 0) + (Number(item.quantidadeLitros) || 0)));
  });

  return {
    equipamentos: {
      apontados: vistos.size,
      emOperacao: new Set(controles.filter(item => item.status === 'Em operação').map(item => item.prefixo)).size,
      parados,
      semMotivo: parados.filter(item => !item.motivo).length,
      repetidos: [...vistos.entries()].filter(([, vezes]) => vezes > 1).map(([prefixo]) => prefixo).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })),
    },
    diesel: {
      litros: arredondar(abastecimentos.reduce((soma, item) => soma + (Number(item.quantidadeLitros) || 0), 0)),
      abastecimentos: abastecimentos.length,
      porEquipamento: [...porEquipamento.entries()].map(([prefixo, litros]) => ({ prefixo, litros })).sort((a, b) => b.litros - a.litros || a.prefixo.localeCompare(b.prefixo, 'pt-BR', { numeric: true })),
      aConferir: abastecimentos.filter(item => item.status && item.status !== 'OK').length,
    },
  };
};
