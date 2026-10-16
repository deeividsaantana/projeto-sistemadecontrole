import type { ControleEquipamentoDiario } from '../types';
import { normalizePrefix } from '../utils/canonicalIdentity';
import { normalizeDriverCode, normalizeDriverName } from './operationalDriverReference';

/**
 * Trava de lançamento repetido no Controle de Frotas: cada equipamento tem um
 * lançamento por dia. Vale para o formulário, o Quadro da Frota e a gravação
 * no App, que antes só reconheciam o lançamento existente pela `chave` exata
 * (data|id) e criavam outro quando o mesmo prefixo chegava com id diferente.
 */

const ativo = (record: ControleEquipamentoDiario): boolean =>
  !(record as ControleEquipamentoDiario & { excluido?: unknown }).excluido;

const mesmoEquipamento = (
  record: ControleEquipamentoDiario,
  alvo: Pick<ControleEquipamentoDiario, 'equipamentoId' | 'prefixo'>,
): boolean => {
  if (record.equipamentoId && alvo.equipamentoId && record.equipamentoId === alvo.equipamentoId) return true;
  const prefixo = normalizePrefix(alvo.prefixo);
  return Boolean(prefixo) && normalizePrefix(record.prefixo) === prefixo;
};

/** O lançamento que o equipamento já tem nesse dia, fora o próprio registro (ao editar). */
export const lancamentoDoDia = (
  records: readonly ControleEquipamentoDiario[],
  alvo: Pick<ControleEquipamentoDiario, 'id' | 'data' | 'equipamentoId' | 'prefixo'>,
): ControleEquipamentoDiario | undefined =>
  records
    .filter(record => ativo(record) && record.id !== alvo.id && record.data === alvo.data && mesmoEquipamento(record, alvo))
    .sort((left, right) => String(right.atualizadoEm || right.criadoEm).localeCompare(String(left.atualizadoEm || left.criadoEm)))[0];

/** Outros equipamentos em que o mesmo operador já foi lançado nesse dia. */
export const operadorEmOutroEquipamento = (
  records: readonly ControleEquipamentoDiario[],
  alvo: Pick<ControleEquipamentoDiario, 'id' | 'data' | 'equipamentoId' | 'prefixo' | 'codigoFuncionario' | 'nomeMotorista'>,
): ControleEquipamentoDiario[] => {
  const codigo = normalizeDriverCode(alvo.codigoFuncionario);
  const nome = normalizeDriverName(alvo.nomeMotorista);
  if (!codigo && !nome) return [];
  return records.filter(record => {
    if (!ativo(record) || record.id === alvo.id || record.data !== alvo.data || mesmoEquipamento(record, alvo)) return false;
    const codigoRegistro = normalizeDriverCode(record.codigoFuncionario);
    if (codigo && codigoRegistro) return codigo === codigoRegistro;
    return Boolean(nome) && normalizeDriverName(record.nomeMotorista) === nome;
  });
};

/**
 * Última barreira, na gravação: um lançamento novo de equipamento que já tem
 * lançamento no dia vira atualização do existente (mantém id, criação e
 * histórico), em vez de entrar repetido.
 */
export const juntarComLancamentoDoDia = (
  records: readonly ControleEquipamentoDiario[],
  registro: ControleEquipamentoDiario,
): { registro: ControleEquipamentoDiario; novo: boolean } => {
  const existente = lancamentoDoDia(records, registro);
  if (!existente) return { registro, novo: true };
  return {
    novo: false,
    registro: {
      ...registro,
      id: existente.id,
      chave: existente.chave || registro.chave,
      criadoEm: existente.criadoEm || registro.criadoEm,
      eventos: [...(existente.eventos || []), ...(registro.eventos || [])],
    },
  };
};

/** Dias com equipamento lançado mais de uma vez, para o aviso do histórico. */
export const repetidosPorDia = (records: readonly ControleEquipamentoDiario[]): Map<string, string[]> => {
  const contagem = new Map<string, Map<string, number>>();
  records.filter(ativo).forEach(record => {
    const prefixo = normalizePrefix(record.prefixo);
    if (!prefixo || !record.data) return;
    const doDia = contagem.get(record.data) || new Map<string, number>();
    doDia.set(prefixo, (doDia.get(prefixo) || 0) + 1);
    contagem.set(record.data, doDia);
  });
  const saida = new Map<string, string[]>();
  contagem.forEach((doDia, data) => {
    const repetidos = [...doDia.entries()].filter(([, total]) => total > 1).map(([prefixo]) => prefixo);
    if (repetidos.length) saida.set(data, repetidos.sort((left, right) => left.localeCompare(right, 'pt-BR', { numeric: true })));
  });
  return saida;
};
