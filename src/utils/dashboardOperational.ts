import type { ControleEquipamentoDiario, Equipamento, RegistroProducao } from '../types';

export type FleetState = 'operating' | 'available' | 'maintenance' | 'pending' | 'unknown';

export const fleetLabels: Record<FleetState, string> = {
  operating: 'Em operação',
  available: 'À disposição',
  maintenance: 'Em manutenção / parado',
  pending: 'A confirmar',
  unknown: 'Sem posição confirmada',
};

export interface FleetRow {
  id: string;
  prefix: string;
  name: string;
  state: FleetState;
  equipment?: Equipamento;
  record?: ControleEquipamentoDiario;
}

export function classifyFleet(status?: string): FleetState {
  if (status === 'Em operação') return 'operating';
  if (['À disposição', 'Disponível', 'Liberado'].includes(status || '')) return 'available';
  if (['Em manutenção', 'Aguardando manutenção', 'Indisponível', 'Parado'].includes(status || '')) return 'maintenance';
  if (['A confirmar', 'Aguardando motorista', 'Não classificado'].includes(status || '')) return 'pending';
  return 'unknown';
}

/** Daily position is never inferred from the equipment's master status. */
export function fleetSnapshot(
  equipment: Equipamento[],
  records: ControleEquipamentoDiario[],
  date: string,
): FleetRow[] {
  const byId = new Map(equipment.map(item => [item.id, item]));
  const byPrefix = new Map(equipment.map(item => [item.prefixo.trim().toUpperCase(), item]));
  const latest = new Map<string, { record: ControleEquipamentoDiario; equipment?: Equipamento }>();
  records.filter(item => item.data === date).forEach(record => {
    const matched = byId.get(record.equipamentoId) || byPrefix.get(record.prefixo?.trim().toUpperCase());
    const key = matched?.id || record.equipamentoId || record.prefixo || record.id;
    const previous = latest.get(key)?.record;
    if (!previous || String(record.atualizadoEm || record.criadoEm) >= String(previous.atualizadoEm || previous.criadoEm)) {
      latest.set(key, { record, equipment: matched });
    }
  });
  const rows: FleetRow[] = equipment
    .filter(item => item.status !== 'Desmobilizado' || latest.has(item.id))
    .map(item => {
      const record = latest.get(item.id)?.record;
      latest.delete(item.id);
      return {
        id: item.id,
        prefix: item.prefixo,
        name: item.nome || item.tipo,
        equipment: item,
        record,
        state: classifyFleet(record?.status),
      };
    });
  latest.forEach(({ record, equipment: matched }, id) => rows.push({
    id,
    prefix: record.prefixo || 'Sem prefixo',
    name: matched?.nome || record.familia || 'Cadastro não vinculado',
    equipment: matched,
    record,
    state: classifyFleet(record.status),
  }));
  return rows.sort((a, b) => a.prefix.localeCompare(b.prefix, 'pt-BR', { numeric: true }));
}

export function fleetSummary(rows: FleetRow[]) {
  const counts: Record<FleetState, number> = {
    operating: 0, available: 0, maintenance: 0, pending: 0, unknown: 0,
  };
  rows.forEach(row => counts[row.state]++);
  const confirmed = counts.operating + counts.available + counts.maintenance;
  return {
    ...counts,
    total: rows.length,
    confirmed,
    coverage: rows.length ? confirmed / rows.length * 100 : null,
    availability: confirmed ? (counts.operating + counts.available) / confirmed * 100 : null,
  };
}

export const withinPeriod = (date: string, start: string, end: string) =>
  Boolean(date && start && end && date >= start && date <= end);

export function periodStart(end: string, days: number) {
  const date = new Date(`${end}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return end;
  date.setUTCDate(date.getUTCDate() - days + 1);
  return date.toISOString().slice(0, 10);
}

export function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function aggregateProduction(records: RegistroProducao[]) {
  const groups = new Map<string, { id: string; label: string; unit: string; quantity: number; count: number }>();
  records.filter(item => item.ativo !== false).forEach(item => {
    const id = JSON.stringify([item.servicoId || item.servicoDescricao, item.unidade]);
    const group = groups.get(id) || {
      id, label: item.servicoDescricao, unit: item.unidade, quantity: 0, count: 0,
    };
    group.quantity += Number(item.quantidade) || 0;
    group.count++;
    groups.set(id, group);
  });
  return [...groups.values()];
}

export function sumBy<T>(items: T[], key: (item: T) => string, value: (item: T) => number) {
  const result = new Map<string, number>();
  items.forEach(item => {
    const label = key(item) || 'Não informado';
    result.set(label, (result.get(label) || 0) + value(item));
  });
  return [...result].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}
