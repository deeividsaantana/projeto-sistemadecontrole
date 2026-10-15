import type { FuelReportExcelRow } from './fuelReport';
import { getFuelRecordCompetence } from './fuelReport';

/**
 * O modelo da planilha "FORNECIMENTO DIESEL" que a obra usa: uma aba por mês
 * do diesel (21 a 20), com as mesmas colunas na mesma ordem, mais o "Resumo
 * Geral". O histórico e o Excel do app seguem este modelo para quem vem da
 * planilha achar tudo no mesmo lugar.
 */

const MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

/** "2026-10" vira "OUTUBRO 2026", que é o mês em que o período de 21/09 a 20/10 fecha. */
export const nomeDoMes = (competencia: string) => {
  const [ano, mes] = competencia.split('-').map(Number);
  return ano && mes >= 1 && mes <= 12 ? `${MESES[mes - 1]} ${ano}` : 'SEM DATA';
};

export const tituloDaAba = (competencia: string) => `FORNECIMENTO DIESEL - ${nomeDoMes(competencia)}`;

/** As colunas da planilha, na ordem dela. */
export const COLUNAS_PLANILHA = [
  { chave: 'data', rotulo: 'Data' },
  { chave: 'prefixo', rotulo: 'Prefixo' },
  { chave: 'descricao', rotulo: 'Descrição do equipamento' },
  { chave: 'kmInicial', rotulo: 'KM inicial' },
  { chave: 'horimetro', rotulo: 'Horímetro' },
  { chave: 'litros', rotulo: 'Litros' },
  { chave: 'hora', rotulo: 'Hora' },
  { chave: 'comboio', rotulo: 'Comboio' },
  { chave: 'tipoCombustivel', rotulo: 'Tipo de combustível' },
  { chave: 'empresa', rotulo: 'Empresa' },
  { chave: 'bombaInicial', rotulo: 'Bomba inicial' },
  { chave: 'bombaFinal', rotulo: 'Bomba final' },
] as const;

export interface AbaDoMes {
  competencia: string;
  nome: string;
  titulo: string;
  litros: number;
  linhas: FuelReportExcelRow[];
}

const emOrdemDeLancamento = (a: FuelReportExcelRow, b: FuelReportExcelRow) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`);

/** Uma aba por mês do diesel, do mais antigo para o mais novo, cada uma na ordem em que foi lançada. */
export const separarPorMes = (linhas: readonly FuelReportExcelRow[]): AbaDoMes[] => {
  const porMes = new Map<string, FuelReportExcelRow[]>();
  linhas.forEach(linha => {
    const competencia = getFuelRecordCompetence({ data: linha.data, competencia: undefined });
    porMes.set(competencia, [...(porMes.get(competencia) ?? []), linha]);
  });
  return [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([competencia, itens]) => ({
      competencia,
      nome: nomeDoMes(competencia),
      titulo: tituloDaAba(competencia),
      litros: Math.round(itens.reduce((soma, linha) => soma + linha.litros, 0) * 10) / 10,
      linhas: [...itens].sort(emOrdemDeLancamento),
    }));
};

export interface ResumoGeral {
  totalLitros: number;
  lancamentos: number;
  comboios: number;
  equipamentos: number;
  porMes: Array<{ mes: string; litros: number; lancamentos: number; media: number }>;
  porComboio: Array<{ comboio: string; litros: number; lancamentos: number; ultimaData: string; ultimaBombaFinal: number | '' }>;
  topEquipamentos: Array<{ prefixo: string; equipamento: string; litros: number; lancamentos: number }>;
  porEmpresa: Array<{ empresa: string; litros: number }>;
}

const arredondar = (valor: number) => Math.round(valor * 10) / 10;

/** O "Resumo Geral" da planilha: totais, mês a mês, por comboio, as máquinas que mais gastam e por empresa. */
export const montarResumoGeral = (linhas: readonly FuelReportExcelRow[], topEquipamentos = 25): ResumoGeral => {
  const comboios = new Map<string, ResumoGeral['porComboio'][number]>();
  const maquinas = new Map<string, ResumoGeral['topEquipamentos'][number]>();
  const empresas = new Map<string, number>();

  [...linhas].sort(emOrdemDeLancamento).forEach(linha => {
    const nomeComboio = linha.comboio || 'Sem comboio';
    const comboio = comboios.get(nomeComboio) ?? { comboio: nomeComboio, litros: 0, lancamentos: 0, ultimaData: '', ultimaBombaFinal: '' as const };
    comboio.litros += linha.litros;
    comboio.lancamentos += 1;
    comboio.ultimaData = linha.data;
    if (linha.bombaFinal !== '') comboio.ultimaBombaFinal = linha.bombaFinal;
    comboios.set(nomeComboio, comboio);

    const prefixo = linha.prefixo || 'Sem prefixo';
    const maquina = maquinas.get(prefixo) ?? { prefixo, equipamento: linha.descricao || 'NÃO CADASTRADO', litros: 0, lancamentos: 0 };
    maquina.litros += linha.litros;
    maquina.lancamentos += 1;
    maquinas.set(prefixo, maquina);

    const empresa = linha.empresa || 'NÃO CADASTRADO';
    empresas.set(empresa, (empresas.get(empresa) ?? 0) + linha.litros);
  });

  const totalLitros = arredondar(linhas.reduce((soma, linha) => soma + linha.litros, 0));
  return {
    totalLitros,
    lancamentos: linhas.length,
    comboios: comboios.size,
    equipamentos: maquinas.size,
    porMes: separarPorMes(linhas).map(aba => ({
      mes: aba.nome,
      litros: aba.litros,
      lancamentos: aba.linhas.length,
      media: aba.linhas.length ? arredondar(aba.litros / aba.linhas.length) : 0,
    })),
    porComboio: [...comboios.values()].map(item => ({ ...item, litros: arredondar(item.litros) })).sort((a, b) => b.litros - a.litros),
    topEquipamentos: [...maquinas.values()].map(item => ({ ...item, litros: arredondar(item.litros) })).sort((a, b) => b.litros - a.litros).slice(0, topEquipamentos),
    porEmpresa: [...empresas.entries()].map(([empresa, litros]) => ({ empresa, litros: arredondar(litros) })).sort((a, b) => b.litros - a.litros),
  };
};

/** Dia da semana curto, como a coluna A da planilha ("ter"). */
export const diaDaSemana = (dia: string) => (
  /^\d{4}-\d{2}-\d{2}$/.test(dia)
    ? new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
    : ''
);
