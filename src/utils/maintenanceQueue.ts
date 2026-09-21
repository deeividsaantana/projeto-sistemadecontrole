import type { ControleEquipamentoDiario, Equipamento, OrdemServico } from '../types';
import { calcularHorasParadas, isOrdemEncerrada } from './manutencao';
import { classifyEquipment, type EquipmentFamily } from './equipmentPresentation';

export interface MaintenanceQueueItem {
  ordemId: string;
  numero: string;
  equipamentoId: string;
  prefixo: string;
  equipamentoNome: string;
  familia: EquipmentFamily;
  status: OrdemServico['status'];
  prioridade: OrdemServico['prioridade'];
  motivo: string;
  desde: string;
  horasParadas: number | undefined;
  /** Indica a fonte do identificador exibido sem alterar o histórico original. */
  identificacaoOrigem: 'cadastro' | 'controle' | 'registro' | 'ausente';
}

const normalizarPrefixo = (valor?: string) => String(valor || '')
  .replace(/\s+/g, '')
  .toLocaleUpperCase('pt-BR');

/**
 * As OS automáticas registram o prefixo operacional na descrição. Ele é a
 * fonte mais confiável quando uma migração antiga deixou o equipamentoId
 * apontando para outro item do cadastro.
 */
const prefixoDocumentadoNaOrdem = (descricao: string): string | undefined => {
  const encontrado = descricao.match(/Entrada em manuten[çc][ãa]o registrada no controle operacional do\s+([A-Za-z]{1,8}[\s-]?\d[\w-]*)/i);
  return encontrado?.[1] ? normalizarPrefixo(encontrado[1]) : undefined;
};

/** A fila operacional mostra somente OS em curso, uma por ordem, sem ocultar equipamentos sem cadastro. */
export const buildMaintenanceQueue = (
  ordens: OrdemServico[],
  equipamentos: Equipamento[],
  agora: Date = new Date(),
  controlesEquipamentos: ControleEquipamentoDiario[] = [],
): MaintenanceQueueItem[] => {
  const equipamentoPorId = new Map(equipamentos.map(item => [item.id, item]));
  const controlePorOrdem = new Map(
    controlesEquipamentos
      .filter(item => Boolean(item.ordemServicoId))
      .map(item => [item.ordemServicoId as string, item]),
  );
  return ordens
    .filter(ordem => !isOrdemEncerrada(ordem.status))
    .map(ordem => {
      const equipamento = equipamentoPorId.get(ordem.equipamentoId);
      const vinculoDireto = controlePorOrdem.get(ordem.id);
      const controle = vinculoDireto?.equipamentoId === ordem.equipamentoId
        ? vinculoDireto
        : controlesEquipamentos.find(item => item.equipamentoId === ordem.equipamentoId && ['Em manutenção', 'Aguardando manutenção'].includes(item.status));
      const prefixoDocumentado = prefixoDocumentadoNaOrdem(ordem.descricao);
      const cadastroCompativel = equipamento && (!prefixoDocumentado || normalizarPrefixo(equipamento.prefixo) === prefixoDocumentado)
        ? equipamento
        : undefined;
      const controleCompativel = controle && (!prefixoDocumentado || normalizarPrefixo(controle.prefixo) === prefixoDocumentado)
        ? controle
        : undefined;
      const haDivergenciaDocumentada = Boolean(prefixoDocumentado && (
        (equipamento && !cadastroCompativel) || (controle && !controleCompativel)
      ));
      const identificacaoOrigem: MaintenanceQueueItem['identificacaoOrigem'] = haDivergenciaDocumentada || (prefixoDocumentado && !cadastroCompativel && !controleCompativel)
        ? 'registro'
        : cadastroCompativel
          ? 'cadastro'
          : controleCompativel
            ? 'controle'
            : 'ausente';
      const referencia: Pick<Equipamento, 'prefixo' | 'nome' | 'tipo' | 'familia'> | undefined = cadastroCompativel || (controleCompativel ? {
        prefixo: controle.prefixo,
        nome: controle.tipoEquipamento || '',
        tipo: controle.tipoEquipamento || '',
        familia: controle.familia,
      } : prefixoDocumentado ? {
        prefixo: prefixoDocumentado,
        nome: '',
        tipo: '',
        familia: '',
      } : undefined);
      return {
        ordemId: ordem.id,
        numero: ordem.numero,
        equipamentoId: ordem.equipamentoId,
        prefixo: prefixoDocumentado || cadastroCompativel?.prefixo || controleCompativel?.prefixo || 'Frota não localizada',
        equipamentoNome: identificacaoOrigem === 'registro'
          ? 'Registro operacional'
          : cadastroCompativel?.nome || cadastroCompativel?.tipo || controleCompativel?.tipoEquipamento || 'Cadastro não localizado',
        familia: classifyEquipment(referencia),
        status: ordem.status,
        prioridade: ordem.prioridade,
        motivo: (ordem.motivo || ordem.descricao || 'Sem motivo informado').trim(),
        desde: ordem.dataAbertura,
        horasParadas: calcularHorasParadas(ordem, agora),
        identificacaoOrigem,
      };
    })
    .sort((a, b) => (b.horasParadas || 0) - (a.horasParadas || 0) || a.desde.localeCompare(b.desde));
};
