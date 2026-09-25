import type {
  Abastecimento, ControleEquipamentoDiario, Equipamento, Funcionario, GrupoEquipe,
  OrdemServico, PresencaApontamento, RegistroProducao,
} from '../types';
import { fleetSnapshot, fleetSummary, withinPeriod } from './dashboardOperational';
import { recoverTeamGroups, teamRecordMatches } from './teamIdentity';

export interface DashboardGeneralFilters {
  obraId: string;
  from: string;
  to: string;
}

export interface DashboardGeneralSource {
  equipamentos?: Equipamento[];
  controlesEquipamentos?: ControleEquipamentoDiario[];
  producao?: RegistroProducao[];
  abastecimentos?: Abastecimento[];
  presencasLink?: PresencaApontamento[];
  funcionarios?: Funcionario[];
  gruposEquipe?: Array<Pick<GrupoEquipe, 'id' | 'obraId'> & Partial<Pick<GrupoEquipe, 'nome' | 'frenteServico' | 'status'>>>;
  ordensServico?: OrdemServico[];
}

export interface DashboardSeriesPoint {
  date: string;
  label: string;
  value: number | null;
  percent: number;
}

export interface DashboardMeasure {
  value: number | null;
  unit: string;
  series: DashboardSeriesPoint[];
}

export interface DashboardAttentionItem {
  id: string;
  title: string;
  detail: string;
  target: string;
  severity: 'critical' | 'warning';
  date: string;
}

export interface DashboardTeamSummary {
  total: number;
  withRecords: number;
  items: Array<{ id: string; name: string; front: string; reported: number; present: number; lastDate: string | null }>;
}

export interface DashboardGeneralViewModel {
  fleet: ReturnType<typeof fleetSummary>;
  availability: DashboardMeasure;
  production: DashboardMeasure;
  fuel: DashboardMeasure;
  presence: DashboardMeasure;
  maintenance: DashboardMeasure;
  attention: DashboardAttentionItem[];
  teams: DashboardTeamSummary;
}

const dayList = (from: string, to: string) => {
  const first = new Date(`${from}T12:00:00Z`);
  const last = new Date(`${to}T12:00:00Z`);
  if (!Number.isFinite(first.getTime()) || !Number.isFinite(last.getTime()) || first > last) return [];
  const dates: string[] = [];
  // Bound visual density and guard against malformed, very large intervals.
  for (let cursor = first; cursor <= last && dates.length < 366; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
};

const makeMeasure = (dates: string[], values: Map<string, number>, unit: string): DashboardMeasure => {
  const present = [...values.values()].filter(Number.isFinite);
  const max = Math.max(0, ...present);
  return {
    value: present.length ? present.reduce((sum, value) => sum + value, 0) : null,
    unit,
    series: dates.map(date => {
      const value = values.get(date) ?? null;
      return {
        date,
        label: `${date.slice(8, 10)}/${date.slice(5, 7)}`,
        value,
        percent: value === null || max === 0 ? 0 : Math.max(0, Math.min(100, value / max * 100)),
      };
    }),
  };
};

const countByDate = <T>(items: T[], dateOf: (item: T) => string, amount: (item: T) => number) => {
  const result = new Map<string, number>();
  items.forEach(item => {
    const date = dateOf(item);
    const value = amount(item);
    if (Number.isFinite(value)) result.set(date, (result.get(date) ?? 0) + value);
  });
  return result;
};

export function buildDashboardGeneralViewModel(filters: DashboardGeneralFilters, source: DashboardGeneralSource): DashboardGeneralViewModel {
  const dates = dayList(filters.from, filters.to);
  const inScope = (obraId?: string) => !filters.obraId || obraId === filters.obraId;
  const equipment = (source.equipamentos ?? []).filter(item => inScope(item.localAtualId));
  const equipmentIds = new Set(equipment.map(item => item.id));
  const controls = (source.controlesEquipamentos ?? []).filter(item => equipmentIds.has(item.equipamentoId));
  const fleet = fleetSummary(fleetSnapshot(equipment, controls, filters.to));
  const availabilitySeries = dates.map(date => {
    const value = fleetSummary(fleetSnapshot(equipment, controls, date)).availability;
    return { date, label: `${date.slice(8, 10)}/${date.slice(5, 7)}`, value, percent: value ?? 0 };
  });
  const availability: DashboardMeasure = { value: fleet.availability, unit: '%', series: availabilitySeries };

  const productionRows = (source.producao ?? []).filter(item =>
    item.ativo !== false && inScope(item.obraId) && withinPeriod(item.data, filters.from, filters.to)
    && item.unidade === 'm³');
  const fuelRows = (source.abastecimentos ?? []).filter(item =>
    (!filters.obraId || equipmentIds.has(item.equipamentoId)) && withinPeriod(item.data, filters.from, filters.to));
  const groups = (source.gruposEquipe ?? []).filter(item => item.status !== 'inativo' && inScope(item.obraId));
  const recoveredGroups = recoverTeamGroups(groups as GrupoEquipe[], source.presencasLink ?? [], source.funcionarios ?? []);
  const teamRecords = (source.presencasLink ?? []).filter(item =>
    !item.inativoEm && (!filters.obraId || recoveredGroups.some(group => teamRecordMatches(group, item)))
    && withinPeriod(item.data, filters.from, filters.to));
  const presenceRows = teamRecords.filter(item => ['Presente', 'Atraso', 'Saída antecipada'].includes(item.status));
  const teamItems = recoveredGroups.map(group => {
    const records = teamRecords.filter(item => teamRecordMatches(group, item));
    const present = records.filter(item => ['Presente', 'Atraso', 'Saída antecipada'].includes(item.status));
    return {
      id: group.id,
      name: group.nome || records[0]?.grupoNome || 'Equipe sem nome',
      front: group.frenteServico || records[0]?.frenteServico || 'Frente não informada',
      reported: records.length,
      present: present.length,
      lastDate: records.length ? records.map(item => item.data).sort().at(-1) ?? null : null,
    };
  }).sort((a, b) => b.reported - a.reported || a.name.localeCompare(b.name, 'pt-BR'));
  const teams: DashboardTeamSummary = { total: teamItems.length, withRecords: teamItems.filter(item => item.reported > 0).length, items: teamItems };
  const openOrders = (source.ordensServico ?? []).filter(item =>
    !['Concluída', 'Cancelada'].includes(item.status) && (!filters.obraId || equipmentIds.has(item.equipamentoId)));

  const production = makeMeasure(dates, countByDate(productionRows, item => item.data, item => Number(item.quantidade)), 'm³');
  const fuel = makeMeasure(dates, countByDate(fuelRows, item => item.data, item => Number(item.quantidadeLitros)), 'L');
  const presence = makeMeasure(dates, countByDate(presenceRows, item => item.data, () => 1), 'pessoas');
  const maintenance: DashboardMeasure = { value: openOrders.length, unit: 'OS abertas', series: [] };
  const attention: DashboardAttentionItem[] = openOrders.map(item => ({
    id: item.id,
    title: `${item.numero || 'Ordem de serviço'} · ${item.tipo}`,
    detail: `${item.status} · ${item.prioridade}`,
    target: 'Manutenção',
    severity: (item.prioridade === 'Urgente' || item.prioridade === 'Alta' ? 'critical' : 'warning') as DashboardAttentionItem['severity'],
    date: item.dataAbertura,
  })).sort((a, b) => Number(b.severity === 'critical') - Number(a.severity === 'critical') || a.date.localeCompare(b.date));

  return { fleet, availability, production, fuel, presence, maintenance, attention, teams };
}
