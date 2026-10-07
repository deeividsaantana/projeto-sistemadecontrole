import type { Abastecimento, Comboio, Empresa, Equipamento, TipoCombustivel } from '../../types';

export interface FuelHistoryGroup {
  chave: string;
  nome: string;
  registros: number;
  litros: number;
  percentual: number;
}

export interface FuelHistoryMonth extends FuelHistoryGroup {
  rotulo: string;
}

export interface FuelHistoryAnalytics {
  totalRegistros: number;
  totalLitros: number;
  porEmpresa: FuelHistoryGroup[];
  porEquipamento: FuelHistoryGroup[];
  porComboio: FuelHistoryGroup[];
  porCombustivel: FuelHistoryGroup[];
  porMes: FuelHistoryMonth[];
}

interface FuelHistorySources {
  records: readonly Abastecimento[];
  equipamentos: readonly Equipamento[];
  empresas: readonly Empresa[];
  comboios: readonly Comboio[];
  combustiveis: readonly TipoCombustivel[];
  referenceDate: string;
}

const ordenar = (grupos: Map<string, Omit<FuelHistoryGroup, 'percentual'>>) =>
  [...grupos.values()].sort((a, b) => b.litros - a.litros || b.registros - a.registros || a.nome.localeCompare(b.nome, 'pt-BR'));

const completarPercentuais = (grupos: readonly Omit<FuelHistoryGroup, 'percentual'>[], total: number): FuelHistoryGroup[] =>
  grupos.map(grupo => ({ ...grupo, percentual: total > 0 ? Math.round((grupo.litros / total) * 1000) / 10 : 0 }));

const chaveMes = (data: string) => /^\d{4}-\d{2}/.test(data) ? data.slice(0, 7) : '';

const rotuloMes = (chave: string) => new Date(`${chave}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');

export const buildFuelHistoryAnalytics = (source: FuelHistorySources): FuelHistoryAnalytics => {
  const equipamentos = new Map(source.equipamentos.map(item => [item.id, item]));
  const empresas = new Map(source.empresas.map(item => [item.id, item]));
  const comboios = new Map(source.comboios.map(item => [item.id, item]));
  const combustiveis = new Map(source.combustiveis.map(item => [item.id, item]));
  const porEmpresa = new Map<string, Omit<FuelHistoryGroup, 'percentual'>>();
  const porEquipamento = new Map<string, Omit<FuelHistoryGroup, 'percentual'>>();
  const porComboio = new Map<string, Omit<FuelHistoryGroup, 'percentual'>>();
  const porCombustivel = new Map<string, Omit<FuelHistoryGroup, 'percentual'>>();
  const porMes = new Map<string, Omit<FuelHistoryGroup, 'percentual'>>();
  let totalLitros = 0;

  const incluir = (grupos: Map<string, Omit<FuelHistoryGroup, 'percentual'>>, chave: string, nome: string, litros: number) => {
    const grupo = grupos.get(chave) ?? { chave, nome, registros: 0, litros: 0 };
    grupo.registros += 1;
    grupo.litros += litros;
    grupos.set(chave, grupo);
  };

  for (const registro of source.records) {
    const quantidade = Number(registro.quantidadeLitros);
    const litros = Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 0;
    totalLitros += litros;
    const equipamento = equipamentos.get(registro.equipamentoId);
    const empresaId = equipamento?.empresaId || '__sem_empresa';
    const equipamentoId = equipamento?.id || registro.prefixoInformado || '__sem_equipamento';
    incluir(porEmpresa, empresaId, empresas.get(empresaId)?.nome || 'Empresa não vinculada', litros);
    incluir(porEquipamento, equipamentoId, equipamento?.prefixo || registro.prefixoInformado || 'Equipamento não cadastrado', litros);
    incluir(porComboio, registro.comboioId || '__sem_comboio', comboios.get(registro.comboioId)?.nome || 'Comboio não informado', litros);
    incluir(porCombustivel, registro.tipoCombustivelId || '__sem_combustivel', combustiveis.get(registro.tipoCombustivelId)?.nome || 'Combustível não informado', litros);
    const mes = chaveMes(registro.data);
    if (mes) incluir(porMes, mes, rotuloMes(mes), litros);
  }

  const totalRegistros = source.records.length;
  const referência = /^\d{4}-\d{2}/.test(source.referenceDate) ? source.referenceDate.slice(0, 7) : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [anoRef, mesRef] = referência.split('-').map(Number);
  const meses: string[] = [];
  for (let deslocamento = 5; deslocamento >= 0; deslocamento -= 1) {
    const data = new Date(Date.UTC(anoRef, mesRef - 1 - deslocamento, 1));
    meses.push(`${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  const mesesCompletos = meses.map(mes => porMes.get(mes) ?? { chave: mes, nome: rotuloMes(mes), registros: 0, litros: 0 });

  return {
    totalRegistros,
    totalLitros,
    porEmpresa: completarPercentuais(ordenar(porEmpresa), totalLitros),
    porEquipamento: completarPercentuais(ordenar(porEquipamento), totalLitros),
    porComboio: completarPercentuais(ordenar(porComboio), totalLitros),
    porCombustivel: completarPercentuais(ordenar(porCombustivel), totalLitros),
    porMes: completarPercentuais(mesesCompletos, totalLitros).map(item => ({ ...item, rotulo: item.nome })),
  };
};
