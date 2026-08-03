import type {
  ApontamentoRamoRegistro,
  Empresa,
  Equipamento,
  Funcionario,
  GrupoEquipe,
  ListaPresenca,
  MaterialRegistro,
  ObraLocal,
  OrdemServico,
  ParteDiariaEquipamento,
  PresencaApontamento,
  RdoDiario,
  RdoDivergencia,
  RdoEquipamentoResumo,
  RdoFonteResumo,
  RdoMaterialResumo,
  RdoProducaoItem,
  RdoRevisao,
  RdoViagemResumo,
  StatusDocumentoRdo,
  TicketJazida,
} from '../types';

export interface RdoConsolidationInput {
  data: string;
  obraId: string;
  empresas: Empresa[];
  obras: ObraLocal[];
  equipamentos: Equipamento[];
  funcionarios: Funcionario[];
  listasPresenca: ListaPresenca[];
  gruposEquipe: GrupoEquipe[];
  presencasLink: PresencaApontamento[];
  apontamentos: ApontamentoRamoRegistro[];
  partesDiarias: ParteDiariaEquipamento[];
  tickets: TicketJazida[];
  materiais: MaterialRegistro[];
  ordensServico: OrdemServico[];
}

export interface RdoDailyConsolidation {
  quantidadeEquipe: number;
  efetivoFuncionarioIds: string[];
  equipamentosUtilizadosIds: string[];
  equipamentosResumo: RdoEquipamentoResumo[];
  viagensResumo: RdoViagemResumo[];
  materiaisResumo: RdoMaterialResumo[];
  producaoItens: RdoProducaoItem[];
  fontes: RdoFonteResumo;
  divergencias: RdoDivergencia[];
  clima: NonNullable<RdoDiario['clima']>;
  condicao: NonNullable<RdoDiario['condicao']>;
  servicoExecutado: string;
  ocorrencias: string;
  pendencias: string;
  custoMateriais: number;
  custoManutencao: number;
  custoTotal: number;
}

export interface RdoVersionPreparation {
  rdo: RdoDiario;
  revisionCreated: boolean;
}

const normalizeText = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const round = (value: number) => Number((Number(value) || 0).toFixed(2));

const unique = <T,>(values: T[]) => Array.from(new Set(values));

const sameDay = (value: string | undefined, data: string) => String(value || '').slice(0, 10) === data;

const matchesObraText = (obra: ObraLocal | undefined, ...values: unknown[]) => {
  const obraName = normalizeText(obra?.nome);
  if (!obraName) return false;
  return values.some(value => {
    const normalized = normalizeText(value);
    return normalized.length > 2 && (normalized.includes(obraName) || obraName.includes(normalized));
  });
};

const mostFrequent = <T extends string>(values: T[], fallback: T): T => {
  if (!values.length) return fallback;
  const counts = new Map<T, number>();
  values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
  return Array.from(counts.entries())
    .sort((first, second) => second[1] - first[1])[0]?.[0] || fallback;
};

const orderCostForDay = (
  orders: OrdemServico[],
  data: string,
  equipmentIds: Set<string>,
) => round(orders
  .filter(order => (
    equipmentIds.has(order.equipamentoId)
    && (sameDay(order.dataConclusao, data) || sameDay(order.dataAbertura, data))
  ))
  .reduce((total, order) => total + Number(order.custoFinal ?? order.custoEstimado ?? 0), 0));

const summarizeEquipment = (
  parts: ParteDiariaEquipamento[],
  pointings: ApontamentoRamoRegistro[],
  equipment: Equipamento[],
  divergences: RdoDivergencia[],
): RdoEquipamentoResumo[] => {
  const summaries = new Map<string, RdoEquipamentoResumo>();

  parts.forEach(part => {
    const current = summaries.get(part.equipamentoId);
    summaries.set(part.equipamentoId, {
      equipamentoId: part.equipamentoId,
      prefixo: part.prefixo,
      nome: part.tipoEquipamento,
      operador: part.operadorNome,
      horasTrabalhadas: round((current?.horasTrabalhadas || 0) + Math.max(0, Number(part.totalHorasTrabalhadas) || 0)),
      origem: 'Parte diária',
    });
    if (part.status !== 'Conferido') {
      divergences.push({
        codigo: `parte-${part.id}`,
        origem: 'Parte diária',
        mensagem: `${part.prefixo} possui parte diária com status "${part.status}".`,
        severidade: 'Atenção',
      });
    }
  });

  pointings.forEach(pointing => {
    pointing.equipamentos.forEach(item => {
      const key = normalizeText(item.nome);
      const matched = equipment.find(candidate => (
        normalizeText(candidate.prefixo) === key
        || normalizeText(candidate.nome) === key
        || normalizeText(candidate.tipo) === key
      ));
      if (!matched) {
        divergences.push({
          codigo: `equipamento-${pointing.id}-${key}`,
          origem: 'Apontamento',
          mensagem: `Equipamento "${item.nome}" foi apontado, mas não foi localizado no cadastro mestre.`,
          severidade: 'Atenção',
        });
        return;
      }
      if (!summaries.has(matched.id)) {
        summaries.set(matched.id, {
          equipamentoId: matched.id,
          prefixo: matched.prefixo,
          nome: matched.nome,
          operador: matched.operadorResponsavelNome || '',
          horasTrabalhadas: 0,
          origem: 'Apontamento',
        });
      }
    });
  });

  return Array.from(summaries.values()).sort((first, second) => first.prefixo.localeCompare(second.prefixo, 'pt-BR'));
};

const summarizeProduction = (
  pointings: ApontamentoRamoRegistro[],
  parts: ParteDiariaEquipamento[],
): RdoProducaoItem[] => {
  const indexed = new Map<string, RdoProducaoItem>();

  pointings.forEach(pointing => {
    const description = pointing.descricaoAtividade.trim();
    if (!description) return;
    const key = `apontamento|${pointing.ramoId}|${normalizeText(description)}`;
    const current = indexed.get(key);
    indexed.set(key, {
      id: current?.id || `prod-${pointing.id}`,
      origem: 'Apontamento',
      ramoId: pointing.ramoId,
      ramoNome: pointing.ramoNome,
      descricao: description,
      quantidade: (current?.quantidade || 0) + 1,
      unidade: 'registro',
    });
  });

  parts.forEach(part => {
    part.atividades.forEach(activity => {
      const description = activity.descricao.trim();
      if (!description) return;
      const key = `parte|${normalizeText(description)}|${normalizeText(activity.centroCusto)}`;
      const current = indexed.get(key);
      indexed.set(key, {
        id: current?.id || `prod-${part.id}-${activity.id}`,
        origem: 'Apontamento',
        ramoNome: activity.centroCusto || part.obraNome,
        descricao: description,
        quantidade: round((current?.quantidade || 0) + Math.max(0, Number(activity.totalHoras) || 0)),
        unidade: 'h',
      });
    });
  });

  return Array.from(indexed.values());
};

export const buildRdoDailyConsolidation = (
  input: RdoConsolidationInput,
): RdoDailyConsolidation => {
  const obra = input.obras.find(item => item.id === input.obraId);
  const singleOperationalObra = input.obras.filter(item => item.status !== 'Concluída').length === 1;
  const divergencias: RdoDivergencia[] = [];
  const directLists = input.listasPresenca.filter(item => item.data === input.data && item.obraId === input.obraId);
  const directPresentIds = unique(directLists.flatMap(list => (
    list.funcionarios.filter(item => item.presente).map(item => item.funcionarioId)
  )));
  const linkedPresence = input.presencasLink.filter(item => {
    if (item.data !== input.data || item.status !== 'Presente') return false;
    const group = input.gruposEquipe.find(candidate => candidate.id === item.grupoId);
    return group?.obraId === input.obraId || (!group?.obraId && singleOperationalObra);
  });
  const linkedPresentIds = unique(linkedPresence.map(item => item.funcionarioId));
  const effectiveIds = unique([...directPresentIds, ...linkedPresentIds]);

  const unmatchedPointingIds: string[] = [];
  const pointings = input.apontamentos.filter(item => {
    if (item.data !== input.data) return false;
    const matched = matchesObraText(obra, item.canteiroNome);
    if (!matched && singleOperationalObra) unmatchedPointingIds.push(item.id);
    return matched || singleOperationalObra;
  });
  unmatchedPointingIds.forEach(pointingId => divergencias.push({
    codigo: `apontamento-obra-${pointingId}`,
    origem: 'Apontamento',
    mensagem: 'Apontamento incluído por existir uma única obra operacional, mas o canteiro ou frente ainda não possui vínculo mestre confirmado.',
    severidade: 'Informativa',
  }));
  const pointedPeople = pointings.reduce(
    (total, pointing) => total + pointing.funcoes.reduce((subtotal, item) => subtotal + Math.max(0, Number(item.quantidade) || 0), 0),
    0,
  );
  const partes = input.partesDiarias.filter(item => item.data === input.data && item.obraId === input.obraId);

  const unmatchedTicketIds: string[] = [];
  const tickets = input.tickets.filter(ticket => {
    if (ticket.data !== input.data) return false;
    if (ticket.localDestinoId) return ticket.localDestinoId === input.obraId;
    const matched = matchesObraText(obra, ticket.destinoObra, ticket.destinoOutro);
    if (!matched && singleOperationalObra) unmatchedTicketIds.push(ticket.id);
    return matched || singleOperationalObra;
  });
  unmatchedTicketIds.forEach(ticketId => divergencias.push({
    codigo: `viagem-obra-${ticketId}`,
    origem: 'Viagens',
    mensagem: 'Viagem incluída por existir uma única obra operacional, mas o destino não possui vínculo mestre confirmado.',
    severidade: 'Informativa',
  }));

  const unmatchedMaterialIds: string[] = [];
  const materials = input.materiais.filter(material => {
    if (material.data !== input.data) return false;
    const matched = matchesObraText(obra, material.origem, material.destino, material.aba);
    if (!matched && singleOperationalObra) unmatchedMaterialIds.push(material.id);
    return matched || singleOperationalObra;
  });
  unmatchedMaterialIds.forEach(materialId => divergencias.push({
    codigo: `material-obra-${materialId}`,
    origem: 'Materiais',
    mensagem: 'Movimento de material incluído por existir uma única obra operacional, mas sem vínculo mestre confirmado.',
    severidade: 'Informativa',
  }));

  const sourcePeopleCounts = [directPresentIds.length, linkedPresentIds.length, pointedPeople].filter(value => value > 0);
  if (new Set(sourcePeopleCounts).size > 1) {
    divergencias.push({
      codigo: 'efetivo-divergente',
      origem: 'Efetivo',
      mensagem: `As fontes de efetivo divergem: lista ${directPresentIds.length}, link ${linkedPresentIds.length} e apontamento ${pointedPeople}. O RDO usa o maior total sem ocultar a diferença.`,
      severidade: 'Atenção',
    });
  }

  materials
    .filter(material => material.status === 'Divergência' || material.status === 'Pendente')
    .forEach(material => divergencias.push({
      codigo: `material-${material.id}`,
      origem: 'Materiais',
      mensagem: `${material.material} está com status "${material.status}".`,
      severidade: material.status === 'Divergência' ? 'Crítica' : 'Atenção',
    }));
  tickets
    .filter(ticket => !ticket.ticketPareadoId || ticket.statusFluxo === 'Rascunho')
    .forEach(ticket => divergencias.push({
      codigo: `ticket-${ticket.id}`,
      origem: 'Viagens',
      mensagem: `Ticket ${ticket.ticketNumero || 'sem número'} ainda possui pendência de pareamento ou conferência.`,
      severidade: 'Atenção',
    }));

  const equipamentosResumo = summarizeEquipment(partes, pointings, input.equipamentos, divergencias);
  const equipamentosUtilizadosIds = equipamentosResumo.map(item => item.equipamentoId);
  const equipmentIds = new Set(equipamentosUtilizadosIds);
  const viagensResumo: RdoViagemResumo[] = tickets.map(ticket => ({
    ticketId: ticket.id,
    ticketNumero: ticket.ticketNumero,
    prefixo: ticket.prefixo,
    material: ticket.tipoMaterial,
    quantidadeM3: Math.max(0, Number(ticket.quantidadeM3) || 0),
    destino: ticket.destinoOutro || ticket.destinoObra,
    status: ticket.statusFluxo || ticket.status || 'Pendente',
  }));
  const materiaisResumo: RdoMaterialResumo[] = materials.map(material => ({
    registroId: material.id,
    material: material.material,
    unidade: material.unidade,
    quantidade: Math.max(0, Number(material.quantidade) || 0),
    custo: round(Number(material.total ?? (material.quantidade * (material.valorUnitario || 0))) || 0),
    fornecedor: material.fornecedor || '',
    status: material.status || 'Pendente',
  }));
  const producaoItens = summarizeProduction(pointings, partes);
  const serviceDescriptions = unique([
    ...pointings.map(item => item.descricaoAtividade.trim()),
    ...partes.flatMap(part => part.atividades.map(activity => activity.descricao.trim())),
  ].filter(Boolean));
  const occurrenceDescriptions = unique([
    ...partes.map(item => item.outrosProblemas.trim()),
    ...partes.filter(item => item.status !== 'Conferido').map(item => item.observacao.trim()),
  ].filter(Boolean));
  const materialCost = round(materiaisResumo.reduce((total, item) => total + item.custo, 0));
  const maintenanceCost = orderCostForDay(input.ordensServico, input.data, equipmentIds);
  const fontes: RdoFonteResumo = {
    presencasDiretas: directPresentIds.length,
    presencasLink: linkedPresentIds.length,
    pessoasApontadas: pointedPeople,
    partesDiarias: partes.length,
    viagens: tickets.length,
    materiais: materials.length,
    apontamentos: pointings.length,
  };

  if (Object.values(fontes).every(value => value === 0)) {
    divergencias.push({
      codigo: 'sem-fontes',
      origem: 'Consolidação',
      mensagem: 'Nenhum registro operacional foi encontrado para a data e obra selecionadas.',
      severidade: 'Atenção',
    });
  }

  return {
    quantidadeEquipe: Math.max(effectiveIds.length, pointedPeople),
    efetivoFuncionarioIds: effectiveIds.filter(id => input.funcionarios.some(employee => employee.id === id)),
    equipamentosUtilizadosIds,
    equipamentosResumo,
    viagensResumo,
    materiaisResumo,
    producaoItens,
    fontes,
    divergencias,
    clima: {
      manha: mostFrequent(pointings.map(item => item.clima.Manhã), 'Nublado'),
      tarde: mostFrequent(pointings.map(item => item.clima.Tarde), 'Nublado'),
      noite: mostFrequent(pointings.map(item => item.clima.Noite), 'Nublado'),
    },
    condicao: {
      manha: mostFrequent(pointings.map(item => item.condicao.Manhã), 'Praticável'),
      tarde: mostFrequent(pointings.map(item => item.condicao.Tarde), 'Praticável'),
      noite: mostFrequent(pointings.map(item => item.condicao.Noite), 'Praticável'),
    },
    servicoExecutado: serviceDescriptions.join(' | '),
    ocorrencias: occurrenceDescriptions.join(' | '),
    pendencias: divergencias.map(item => item.mensagem).join(' | '),
    custoMateriais: materialCost,
    custoManutencao: maintenanceCost,
    custoTotal: round(materialCost + maintenanceCost),
  };
};

const operationalRdoSnapshot = (rdo: RdoDiario) => {
  const {
    statusDocumento,
    versao,
    revisoes,
    aprovadoPor,
    aprovadoEm,
    fechadoPor,
    fechadoEm,
    criadoEm,
    atualizadoEm,
    ...operational
  } = rdo;
  return operational;
};

export const prepareRdoVersion = (
  existing: RdoDiario | undefined,
  next: RdoDiario,
  userName: string,
  reason = 'Alteração dos dados operacionais após aprovação.',
): RdoVersionPreparation => {
  if (!existing || !['Aprovado', 'Fechado'].includes(existing.statusDocumento || 'Rascunho')) {
    return {
      rdo: {
        ...next,
        versao: next.versao || existing?.versao || 1,
        revisoes: next.revisoes || existing?.revisoes || [],
      },
      revisionCreated: false,
    };
  }
  const changed = JSON.stringify(operationalRdoSnapshot(existing)) !== JSON.stringify(operationalRdoSnapshot(next));
  if (!changed) return { rdo: next, revisionCreated: false };

  const revision: RdoRevisao = {
    versao: existing.versao || 1,
    statusAnterior: existing.statusDocumento || 'Aprovado',
    alteradoPor: userName,
    alteradoEm: new Date().toISOString(),
    motivo: reason,
    resumoAnterior: `${existing.servicoExecutado || 'Sem descrição'} | Efetivo ${existing.quantidadeEquipe} | ${existing.equipamentosUtilizadosIds.length} equipamento(s)`,
  };
  return {
    rdo: {
      ...next,
      statusDocumento: 'Em revisão',
      versao: (existing.versao || 1) + 1,
      revisoes: [...(existing.revisoes || []), revision],
      aprovadoPor: undefined,
      aprovadoEm: undefined,
      fechadoPor: undefined,
      fechadoEm: undefined,
    },
    revisionCreated: true,
  };
};

export const canTransitionRdo = (
  rdo: RdoDiario,
  target: StatusDocumentoRdo,
): { allowed: boolean; message: string } => {
  if (target === 'Aprovado' && (!rdo.responsavelRdo?.trim() || !rdo.servicoExecutado.trim())) {
    return { allowed: false, message: 'Informe o responsável do RDO e os serviços executados antes da aprovação.' };
  }
  if (target === 'Fechado' && rdo.statusDocumento !== 'Aprovado') {
    return { allowed: false, message: 'O RDO precisa ser aprovado antes do fechamento diário.' };
  }
  return { allowed: true, message: '' };
};

export const generateRdoNumber = (data: string, existingCount: number) => (
  `RDO-${data.replaceAll('-', '')}-${String(existingCount + 1).padStart(2, '0')}`
);
