import type { Abastecimento, Comboio, Empresa, Equipamento, TipoCombustivel } from '../../types';
import { getOperationalFuelLiters } from '../../utils/fuelAnalyticsSafety';

export interface FuelReportFilters {
  competencias?: readonly string[];
  dataInicio?: string;
  dataFim?: string;
  empresaIds?: readonly string[];
  equipamentoIds?: readonly string[];
  comboioIds?: readonly string[];
  combustivelIds?: readonly string[];
  status?: readonly string[];
  apenasConferencia?: boolean;
  texto?: string;
}

export interface FuelReportSources {
  records: readonly Abastecimento[];
  equipamentos: readonly Equipamento[];
  empresas: readonly Empresa[];
  comboios: readonly Comboio[];
  combustiveis: readonly TipoCombustivel[];
}

export interface FuelReportGroup {
  chave: string;
  nome: string;
  registros: number;
  litros: number;
  percentual: number;
  conferencia: number;
}

export interface FuelReportExcelRow {
  aba: string;
  linha: number | '';
  dia: string;
  data: string;
  prefixo: string;
  descricao: string;
  kmInicial: number | '';
  horimetro: number | '';
  litros: number;
  hora: string;
  comboio: string;
  tipoCombustivel: string;
  empresa: string;
  bombaInicial: number | '';
  bombaFinal: number | '';
  status: string;
  observacao: string;
}

export interface FuelReport {
  totalRegistros: number;
  totalLitros: number;
  totalConferencia: number;
  porCompetencia: FuelReportGroup[];
  porEmpresa: FuelReportGroup[];
  porEquipamento: FuelReportGroup[];
  porComboio: FuelReportGroup[];
  porCombustivel: FuelReportGroup[];
  linhasExcel: FuelReportExcelRow[];
}

const removeAccents = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const toIsoMonth = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const getFuelRecordCompetence = (record: Pick<Abastecimento, 'competencia' | 'data'>) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(record.data || '')) {
    const date = new Date(`${record.data}T12:00:00`);
    if (date.getDate() >= 21) date.setMonth(date.getMonth() + 1);
    return toIsoMonth(date);
  }
  if (record.competencia && /^\d{4}-\d{2}$/.test(record.competencia)) return record.competencia;
  return 'sem-data';
};

export const getFuelCompetencePeriodLabel = (competence: string) => {
  if (!/^\d{4}-\d{2}$/.test(competence)) return '';
  const [year, month] = competence.split('-').map(Number);
  const start = new Date(year, month - 2, 21, 12);
  const end = new Date(year, month - 1, 20, 12);
  const format = (date: Date) => date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${format(start)} a ${format(end)}`;
};

const competenceLabel = (competence: string) => {
  if (!/^\d{4}-\d{2}$/.test(competence)) return 'Sem data';
  const month = new Date(`${competence}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
  return `${month} · ${getFuelCompetencePeriodLabel(competence)}`;
};

export const isFuelRecordReviewRequired = (record: Abastecimento) => {
  if (record.revisaoStatus === 'Pendente') return true;
  if (record.status && ['Pendente', 'Conferência necessária', 'Erro de importação'].includes(record.status)) return true;
  return Boolean(record.alertas?.some(alert => alert.severidade !== 'info'));
};

const isActiveFuelRecord = (record: Abastecimento) =>
  !record.inativoEm && String(record.status || '').toLowerCase() !== 'cancelado';

const idSet = (values?: readonly string[]) => new Set((values || []).filter(Boolean));

export const filterFuelReportRecords = (
  records: readonly Abastecimento[],
  filters: FuelReportFilters,
  sources: Omit<FuelReportSources, 'records'>,
) => {
  const equipamentos = new Map(sources.equipamentos.map(item => [item.id, item]));
  const empresas = new Map(sources.empresas.map(item => [item.id, item]));
  const comboios = new Map(sources.comboios.map(item => [item.id, item]));
  const combustiveis = new Map(sources.combustiveis.map(item => [item.id, item]));
  const competencias = idSet(filters.competencias);
  const empresaIds = idSet(filters.empresaIds);
  const equipamentoIds = idSet(filters.equipamentoIds);
  const comboioIds = idSet(filters.comboioIds);
  const combustivelIds = idSet(filters.combustivelIds);
  const status = idSet(filters.status);
  const term = removeAccents((filters.texto || '').trim());

  return records.filter(record => {
    if (!isActiveFuelRecord(record)) return false;
    if (filters.dataInicio && record.data < filters.dataInicio) return false;
    if (filters.dataFim && record.data > filters.dataFim) return false;
    const equipamento = equipamentos.get(record.equipamentoId);
    const empresaId = equipamento?.empresaId || '';
    if (competencias.size && !competencias.has(getFuelRecordCompetence(record))) return false;
    if (empresaIds.size && !empresaIds.has(empresaId)) return false;
    if (equipamentoIds.size && !equipamentoIds.has(record.equipamentoId)) return false;
    if (comboioIds.size && !comboioIds.has(record.comboioId)) return false;
    if (combustivelIds.size && !combustivelIds.has(record.tipoCombustivelId)) return false;
    if (status.size && !status.has(record.status || 'OK')) return false;
    if (filters.apenasConferencia && !isFuelRecordReviewRequired(record)) return false;
    if (!term) return true;
    const haystack = [
      record.data,
      record.hora,
      record.prefixoInformado,
      equipamento?.prefixo,
      equipamento?.nome,
      empresas.get(empresaId)?.nome,
      comboios.get(record.comboioId)?.nome,
      combustiveis.get(record.tipoCombustivelId)?.nome,
      record.responsavel,
      record.operadorNome,
      record.observacao,
      record.integracaoAba,
      record.integracaoLinha ? String(record.integracaoLinha) : '',
    ].filter(Boolean).join(' ');
    return removeAccents(haystack).includes(term);
  });
};

const addToGroup = (groups: Map<string, FuelReportGroup>, key: string, name: string, liters: number, review: boolean) => {
  const group = groups.get(key) ?? { chave: key, nome: name, registros: 0, litros: 0, percentual: 0, conferencia: 0 };
  group.registros += 1;
  group.litros += liters;
  if (review) group.conferencia += 1;
  groups.set(key, group);
};

const sortByLiters = (groups: Map<string, FuelReportGroup>) =>
  [...groups.values()].sort((a, b) => b.litros - a.litros || b.registros - a.registros || a.nome.localeCompare(b.nome, 'pt-BR'));

const sortCompetenceDesc = (groups: Map<string, FuelReportGroup>) =>
  [...groups.values()].sort((a, b) => b.chave.localeCompare(a.chave));

const withPercent = (groups: FuelReportGroup[], total: number) =>
  groups.map(group => ({ ...group, percentual: total > 0 ? Math.round((group.litros / total) * 1000) / 10 : 0 }));

export const buildFuelReport = (sources: FuelReportSources, filters: FuelReportFilters = {}): FuelReport => {
  const records = filterFuelReportRecords(sources.records, filters, sources);
  const equipamentos = new Map(sources.equipamentos.map(item => [item.id, item]));
  const empresas = new Map(sources.empresas.map(item => [item.id, item]));
  const comboios = new Map(sources.comboios.map(item => [item.id, item]));
  const combustiveis = new Map(sources.combustiveis.map(item => [item.id, item]));
  const porCompetencia = new Map<string, FuelReportGroup>();
  const porEmpresa = new Map<string, FuelReportGroup>();
  const porEquipamento = new Map<string, FuelReportGroup>();
  const porComboio = new Map<string, FuelReportGroup>();
  const porCombustivel = new Map<string, FuelReportGroup>();
  let totalLitros = 0;
  let totalConferencia = 0;

  const linhasExcel = records
    .map(record => {
      const equipamento = equipamentos.get(record.equipamentoId);
      const empresaId = equipamento?.empresaId || '';
      const empresa = empresas.get(empresaId);
      const litros = getOperationalFuelLiters(record) ?? 0;
      const review = isFuelRecordReviewRequired(record);
      const competencia = getFuelRecordCompetence(record);
      totalLitros += litros;
      if (review) totalConferencia += 1;
      addToGroup(porCompetencia, competencia, competenceLabel(competencia), litros, review);
      addToGroup(porEmpresa, empresaId || '__sem_empresa', empresa?.nome || 'Empresa não vinculada', litros, review);
      addToGroup(porEquipamento, equipamento?.id || record.prefixoInformado || '__sem_equipamento', equipamento?.prefixo || record.prefixoInformado || 'Sem cadastro', litros, review);
      addToGroup(porComboio, record.comboioId || '__sem_comboio', comboios.get(record.comboioId)?.nome || 'Comboio não informado', litros, review);
      addToGroup(porCombustivel, record.tipoCombustivelId || '__sem_combustivel', combustiveis.get(record.tipoCombustivelId)?.nome || 'Combustível não informado', litros, review);
      return {
        aba: record.integracaoAba || competenceLabel(competencia),
        linha: record.integracaoLinha || '',
        dia: record.data ? record.data.slice(8, 10) : '',
        data: record.data,
        prefixo: equipamento?.prefixo || record.prefixoInformado || '',
        descricao: equipamento?.nome || '',
        kmInicial: record.kmInicial > 0 ? record.kmInicial : '',
        horimetro: record.horimetroInicial > 0 ? record.horimetroInicial : '',
        litros,
        hora: record.hora || '',
        comboio: comboios.get(record.comboioId)?.nome || record.comboioId || '',
        tipoCombustivel: combustiveis.get(record.tipoCombustivelId)?.nome || record.tipoCombustivelId || '',
        empresa: empresa?.nome || '',
        bombaInicial: record.bombaInicial > 0 ? record.bombaInicial : '',
        bombaFinal: record.bombaFinal > 0 ? record.bombaFinal : '',
        status: review ? 'Conferência necessária' : record.status || 'OK',
        observacao: record.observacao || '',
      } satisfies FuelReportExcelRow;
    })
    .sort((a, b) => `${b.data}${b.hora}`.localeCompare(`${a.data}${a.hora}`));

  return {
    totalRegistros: records.length,
    totalLitros,
    totalConferencia,
    porCompetencia: withPercent(sortCompetenceDesc(porCompetencia), totalLitros),
    porEmpresa: withPercent(sortByLiters(porEmpresa), totalLitros),
    porEquipamento: withPercent(sortByLiters(porEquipamento), totalLitros),
    porComboio: withPercent(sortByLiters(porComboio), totalLitros),
    porCombustivel: withPercent(sortByLiters(porCombustivel), totalLitros),
    linhasExcel,
  };
};
