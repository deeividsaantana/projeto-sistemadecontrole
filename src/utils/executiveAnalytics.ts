import type {
  Abastecimento,
  ApontamentoRamoRegistro,
  ControleEstacas,
  Equipamento,
  ListaPresenca,
  MaterialRegistro,
  OrdemServico,
  ParteDiariaEquipamento,
  PresencaApontamento,
  RdoDiario,
  TicketJazida,
} from '../types';
import { buildStakeSummary } from './stakeOperations';

export type ExecutiveFilters = {
  dataInicio?: string;
  dataFim?: string;
  obraId?: string;
  empresaId?: string;
  ramo?: string;
};

export type ExecutiveAnalyticsInput = {
  equipamentos: Equipamento[];
  abastecimentos: Abastecimento[];
  ticketsJazida: TicketJazida[];
  estacas: ControleEstacas;
  rdos: RdoDiario[];
  listasPresenca: ListaPresenca[];
  presencasLink: PresencaApontamento[];
  apontamentos: ApontamentoRamoRegistro[];
  materiais: MaterialRegistro[];
  ordensServico: OrdemServico[];
  partesDiarias: ParteDiariaEquipamento[];
  filters?: ExecutiveFilters;
};

const inRange = (date: string, filters: ExecutiveFilters) =>
  (!filters.dataInicio || date >= filters.dataInicio)
  && (!filters.dataFim || date <= filters.dataFim);

const sum = (values: number[]) => values.reduce((total, value) => total + (Number(value) || 0), 0);
const round = (value: number) => Math.round(value * 100) / 100;

export const buildExecutiveAnalytics = ({
  equipamentos,
  abastecimentos,
  ticketsJazida,
  estacas,
  rdos,
  listasPresenca,
  presencasLink,
  apontamentos,
  materiais,
  ordensServico,
  partesDiarias,
  filters = {},
}: ExecutiveAnalyticsInput) => {
  const equipmentIds = new Set(
    equipamentos
      .filter(item => !filters.empresaId || item.empresaId === filters.empresaId)
      .filter(item => !filters.obraId || item.localAtualId === filters.obraId)
      .map(item => item.id)
  );
  const filteredFuel = abastecimentos
    .filter(item => inRange(item.data, filters))
    .filter(item => equipmentIds.has(item.equipamentoId) || (!filters.empresaId && !filters.obraId));
  const filteredTickets = ticketsJazida
    .filter(item => inRange(item.data, filters))
    .filter(item => !filters.ramo || item.destinoObra === filters.ramo || item.ramoId === filters.ramo);
  const filteredRdos = rdos
    .filter(item => inRange(item.data, filters))
    .filter(item => !filters.empresaId || item.empresaId === filters.empresaId)
    .filter(item => !filters.obraId || item.obraLocalId === filters.obraId);
  const filteredPresenceLists = listasPresenca
    .filter(item => inRange(item.data, filters))
    .filter(item => !filters.obraId || item.obraId === filters.obraId);
  const filteredPresence = presencasLink.filter(item => inRange(item.data, filters));
  const filteredPointings = apontamentos
    .filter(item => inRange(item.data, filters))
    .filter(item => !filters.ramo || item.ramoId === filters.ramo || item.ramoNome === filters.ramo);
  const filteredMaterials = materiais
    .filter(item => inRange(item.data, filters))
    .filter(item => !filters.ramo || item.destino === filters.ramo);
  const filteredParts = partesDiarias
    .filter(item => inRange(item.data, filters))
    .filter(item => equipmentIds.has(item.equipamentoId) || (!filters.empresaId && !filters.obraId));
  const filteredOrders = ordensServico
    .filter(item => inRange(item.dataAbertura, filters))
    .filter(item => equipmentIds.has(item.equipamentoId) || (!filters.empresaId && !filters.obraId));
  const filteredStakes: ControleEstacas = {
    lotes: estacas.lotes
      .filter(item => inRange(item.data, filters))
      .filter(item => !filters.obraId || item.obraLocalId === filters.obraId),
    cravacoes: estacas.cravacoes
      .filter(item => inRange(item.data, filters))
      .filter(item => !filters.obraId || item.obraLocalId === filters.obraId)
      .filter(item => !filters.ramo || item.ramoId === filters.ramo),
  };
  const stakeSummary = buildStakeSummary(filteredStakes);
  const directPresence = sum(filteredPresenceLists.map(list => list.funcionarios.filter(item => item.presente).length));
  const linkedPresence = filteredPresence.filter(item => item.status === 'Presente').length;
  const apontadoPeople = sum(filteredPointings.flatMap(item => item.funcoes.map(entry => entry.quantidade)));
  const apontadoEquipment = sum(filteredPointings.flatMap(item => item.equipamentos.map(entry => entry.quantidade)));
  const materialCost = sum(filteredMaterials.map(item => item.total ?? item.quantidade * (item.valorUnitario || 0)));
  const maintenanceCost = sum(filteredOrders.map(item => item.custoFinal ?? item.custoEstimado ?? 0));
  const stakeCost = stakeSummary.valorTotal;

  return {
    equipamentos: {
      total: equipmentIds.size,
      ativos: equipamentos.filter(item => equipmentIds.has(item.id) && ['Ativo', 'Mobilizado'].includes(item.status)).length,
      manutencao: equipamentos.filter(item => equipmentIds.has(item.id) && item.status === 'Manutenção').length,
      partes: filteredParts.length,
      partesPendentes: filteredParts.filter(item => item.status !== 'Conferido').length,
    },
    combustivel: {
      litros: round(sum(filteredFuel.map(item => item.quantidadeLitros))),
      lancamentos: filteredFuel.length,
      pendencias: filteredFuel.filter(item => item.status && !['Conferido', 'Aprovado'].includes(item.status)).length,
    },
    viagens: {
      registros: filteredTickets.length,
      volumeM3: round(sum(filteredTickets.map(item => item.quantidadeM3))),
      pendencias: filteredTickets.filter(item => !item.ticketPareadoId || item.statusFluxo === 'Rascunho').length,
    },
    estacas: stakeSummary,
    producao: {
      rdos: filteredRdos.length,
      concluidos: filteredRdos.filter(item => item.statusAtividade === 'Concluído').length,
      apontamentos: filteredPointings.length,
      pessoasApontadas: apontadoPeople,
      equipamentosApontados: apontadoEquipment,
    },
    efetivo: {
      presentes: Math.max(directPresence, linkedPresence, apontadoPeople),
      listas: filteredPresenceLists.length,
      apontamentos: filteredPresence.length,
    },
    materiais: {
      registros: filteredMaterials.length,
      quantidade: round(sum(filteredMaterials.map(item => item.quantidade))),
      custo: round(materialCost),
      divergencias: filteredMaterials.filter(item => item.status === 'Divergência').length,
    },
    custos: {
      materiais: round(materialCost),
      manutencao: round(maintenanceCost),
      estacas: round(stakeCost),
      total: round(materialCost + maintenanceCost + stakeCost),
    },
  };
};
