import type {
  Equipamento,
  OrdemServico,
  ParteDiariaEquipamento,
} from '../types';

export type FleetCategory = NonNullable<Equipamento['categoriaFrota']>;

export interface EquipmentValidationResult {
  errors: string[];
  warnings: string[];
}

export interface EquipmentOperationalSummary {
  equipment: Equipamento;
  availabilityPercent: number | null;
  availabilitySource: 'Cadastro' | 'Partes diárias' | 'Sem dados';
  targetPercent: number | null;
  belowTarget: boolean;
  openWorkOrders: number;
  pendingDailyParts: number;
  latestDailyPart: ParteDiariaEquipamento | null;
  responsibleOperator: string;
}

export interface WorkOrderOperationalMetrics {
  machineHours: number;
  equipmentHours: number;
  stoppedHours: number;
  availabilityPercent: number | null;
}

export interface MaintenanceFleetSummary extends EquipmentOperationalSummary {
  driverId: string;
  driverName: string;
  machineHours: number;
  equipmentHours: number;
  stoppedHours: number;
  maintenanceAvailabilityPercent: number | null;
  latestMaintenanceDate: string;
  activeWorkOrder: OrdemServico | null;
  workOrderCount: number;
}

const normalizeSearchText = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .trim();

export const normalizeAvailabilityTarget = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace('%', '').replace(',', '.'));
  if (!Number.isFinite(parsed)) return null;
  const percentage = parsed > 0 && parsed <= 1 ? parsed * 100 : parsed;
  return Number(Math.min(100, Math.max(0, percentage)).toFixed(2));
};

export const inferFleetCategory = (
  name: unknown,
  family: unknown,
  plate: unknown,
  sourceEntity: 'equipment' | 'vehicles' = 'equipment',
): FleetCategory => {
  if (sourceEntity === 'vehicles') return 'Veículo';
  const searchable = normalizeSearchText(`${name ?? ''} ${family ?? ''}`);
  if (/(carreta|prancha|semirreboque|reboque|implemento)/.test(searchable)) return 'Implemento';
  if (plate || /(caminhao|cavalo mecanico|veiculo|van|onibus|automovel)/.test(searchable)) return 'Veículo';
  return 'Equipamento';
};

export const calculateAvailabilityPercent = (
  availableHours: number,
  unavailableHours: number,
): number | null => {
  const available = Math.max(0, Number(availableHours) || 0);
  const unavailable = Math.max(0, Number(unavailableHours) || 0);
  const total = available + unavailable;
  return total > 0 ? Number(((available / total) * 100).toFixed(2)) : null;
};

const safePositiveNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

export const deriveWorkOrderMetrics = (
  workOrder: OrdemServico,
): WorkOrderOperationalMetrics => {
  const horimeterDifference = (
    Number.isFinite(Number(workOrder.horimetroEntrada))
    && Number.isFinite(Number(workOrder.horimetroSaida))
  )
    ? Math.max(0, Number(workOrder.horimetroSaida) - Number(workOrder.horimetroEntrada))
    : 0;
  const machineHours = safePositiveNumber(workOrder.horasMaquina) || horimeterDifference;
  const equipmentHours = safePositiveNumber(workOrder.horasEquipamento) || machineHours;
  const stoppedHours = safePositiveNumber(workOrder.horasParadas);
  const availableHours = Math.max(0, equipmentHours - stoppedHours);
  const calculatedAvailability = calculateAvailabilityPercent(availableHours, stoppedHours);
  const explicitAvailability = normalizeAvailabilityTarget(workOrder.disponibilidadePercentual);

  return {
    machineHours: Number(machineHours.toFixed(2)),
    equipmentHours: Number(equipmentHours.toFixed(2)),
    stoppedHours: Number(stoppedHours.toFixed(2)),
    availabilityPercent: equipmentHours > 0 ? calculatedAvailability : explicitAvailability,
  };
};

export const validateEquipmentMasterRecord = (
  equipment: Equipamento,
): EquipmentValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!equipment.prefixo.trim()) errors.push('Prefixo não informado.');
  if (!equipment.nome.trim()) errors.push('Descrição do equipamento não informada.');
  if (!equipment.empresaId) errors.push('Empresa proprietária não informada.');
  if (
    equipment.capacidadeTanqueLitros !== undefined
    && (!Number.isFinite(equipment.capacidadeTanqueLitros) || equipment.capacidadeTanqueLitros <= 0)
  ) {
    errors.push('A capacidade do tanque deve ser maior que zero.');
  }
  if (
    equipment.metaDisponibilidade !== undefined
    && (
      !Number.isFinite(equipment.metaDisponibilidade)
      || equipment.metaDisponibilidade < 0
      || equipment.metaDisponibilidade > 100
    )
  ) {
    errors.push('A meta de disponibilidade deve ficar entre 0% e 100%.');
  }
  if (
    equipment.dataMobilizacao
    && equipment.dataDesmobilizacao
    && equipment.dataDesmobilizacao < equipment.dataMobilizacao
  ) {
    errors.push('A data de desmobilização não pode ser anterior à mobilização.');
  }
  if (equipment.categoriaFrota === 'Veículo' && !equipment.placa) {
    warnings.push('Veículo sem placa; manter em revisão antes da promoção ao cadastro mestre.');
  }
  if (equipment.categoriaFrota === 'Implemento' && !equipment.equipamentoVinculadoId) {
    warnings.push('Implemento sem equipamento trator vinculado.');
  }
  if (equipment.mobilizado && !equipment.dataMobilizacao) {
    warnings.push('Item marcado como mobilizado sem data de mobilização.');
  }
  return { errors, warnings };
};

const latestDailyPart = (
  equipmentId: string,
  dailyParts: ParteDiariaEquipamento[],
) => dailyParts
  .filter(item => item.equipamentoId === equipmentId)
  .sort((first, second) => (
    `${second.data}|${second.atualizadoEm}`.localeCompare(`${first.data}|${first.atualizadoEm}`)
  ))[0] || null;

export const buildEquipmentOperationalSummaries = (
  equipment: Equipamento[],
  dailyParts: ParteDiariaEquipamento[],
  workOrders: OrdemServico[],
): EquipmentOperationalSummary[] => equipment.map(item => {
  const parts = dailyParts.filter(part => part.equipamentoId === item.id);
  const explicitAvailability = calculateAvailabilityPercent(
    item.horasDisponiveis || 0,
    item.horasIndisponiveis || 0,
  );
  const workedHours = parts.reduce((total, part) => total + Math.max(0, Number(part.totalHorasTrabalhadas) || 0), 0);
  const stoppedHours = parts.reduce(
    (total, part) => total + Math.max(0, (Number(part.jornada) || 0) - (Number(part.totalHorasTrabalhadas) || 0)),
    0,
  );
  const partsAvailability = calculateAvailabilityPercent(workedHours, stoppedHours);
  const availabilityPercent = explicitAvailability ?? partsAvailability;
  const targetPercent = normalizeAvailabilityTarget(item.metaDisponibilidade);
  const latestPart = latestDailyPart(item.id, parts);
  const openWorkOrders = workOrders.filter(order => (
    order.equipamentoId === item.id
    && order.status !== 'Concluída'
    && order.status !== 'Cancelada'
  )).length;
  return {
    equipment: item,
    availabilityPercent,
    availabilitySource: explicitAvailability !== null
      ? 'Cadastro'
      : partsAvailability !== null
        ? 'Partes diárias'
        : 'Sem dados',
    targetPercent,
    belowTarget: availabilityPercent !== null
      && targetPercent !== null
      && availabilityPercent < targetPercent,
    openWorkOrders,
    pendingDailyParts: parts.filter(part => part.status !== 'Conferido').length,
    latestDailyPart: latestPart,
    responsibleOperator: item.operadorResponsavelNome || latestPart?.operadorNome || '',
  };
});

export const buildMaintenanceFleetSummaries = (
  equipment: Equipamento[],
  dailyParts: ParteDiariaEquipamento[],
  workOrders: OrdemServico[],
): MaintenanceFleetSummary[] => {
  const operationalSummaries = buildEquipmentOperationalSummaries(equipment, dailyParts, workOrders);

  return operationalSummaries.map(summary => {
    const equipmentOrders = workOrders
      .filter(order => order.equipamentoId === summary.equipment.id)
      .sort((first, second) => (
        `${second.dataConclusao || second.dataAbertura}|${second.numero}`
          .localeCompare(`${first.dataConclusao || first.dataAbertura}|${first.numero}`)
      ));
    const totals = equipmentOrders.reduce(
      (accumulator, order) => {
        const metrics = deriveWorkOrderMetrics(order);
        return {
          machineHours: accumulator.machineHours + metrics.machineHours,
          equipmentHours: accumulator.equipmentHours + metrics.equipmentHours,
          stoppedHours: accumulator.stoppedHours + metrics.stoppedHours,
        };
      },
      { machineHours: 0, equipmentHours: 0, stoppedHours: 0 },
    );
    const maintenanceAvailabilityPercent = totals.equipmentHours > 0
      ? calculateAvailabilityPercent(
          Math.max(0, totals.equipmentHours - totals.stoppedHours),
          totals.stoppedHours,
        )
      : summary.availabilityPercent;
    const activeWorkOrder = equipmentOrders.find(order => (
      order.status !== 'Concluída' && order.status !== 'Cancelada'
    )) || null;

    return {
      ...summary,
      belowTarget: maintenanceAvailabilityPercent !== null
        && summary.targetPercent !== null
        && maintenanceAvailabilityPercent < summary.targetPercent,
      driverId: summary.equipment.operadorResponsavelId || summary.latestDailyPart?.operadorId || '',
      driverName: summary.responsibleOperator || 'Sem motorista definido',
      machineHours: Number(totals.machineHours.toFixed(2)),
      equipmentHours: Number(totals.equipmentHours.toFixed(2)),
      stoppedHours: Number(totals.stoppedHours.toFixed(2)),
      maintenanceAvailabilityPercent,
      latestMaintenanceDate: equipmentOrders[0]?.dataConclusao || equipmentOrders[0]?.dataAbertura || '',
      activeWorkOrder,
      workOrderCount: equipmentOrders.length,
    };
  });
};
