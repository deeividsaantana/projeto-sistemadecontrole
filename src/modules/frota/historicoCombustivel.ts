import type { Abastecimento } from '../../types';
import { getFuelRecordCompetence } from './fuelReport';
import { periodoDaCompetencia } from './consumoPorEquipamento';

/**
 * Histórico do diesel: período rápido, ordem por coluna, agrupamento com
 * subtotal e as colunas que cada pessoa escolhe ver. A tela só desenha.
 */

export type PeriodoRapido = 'hoje' | '7dias' | 'competencia' | 'competencia-anterior' | 'tudo' | 'personalizado';

export const PERIODOS_RAPIDOS: ReadonlyArray<{ id: PeriodoRapido; rotulo: string }> = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: '7dias', rotulo: '7 dias' },
  { id: 'competencia', rotulo: 'Mês atual' },
  { id: 'competencia-anterior', rotulo: 'Mês passado' },
  { id: 'tudo', rotulo: 'Tudo' },
];

const somarDias = (dia: string, dias: number) => {
  const data = new Date(`${dia}T12:00:00`);
  data.setDate(data.getDate() + dias);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
};

const competenciaAnterior = (competencia: string) => {
  const [ano, mes] = competencia.split('-').map(Number);
  return mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, '0')}`;
};

/** Datas do período rápido. "Mês" é o mês do diesel: 21 do mês anterior a 20. */
export const intervaloDoPeriodo = (periodo: PeriodoRapido, hoje: string): { dataInicio: string; dataFim: string } => {
  if (periodo === 'hoje') return { dataInicio: hoje, dataFim: hoje };
  if (periodo === '7dias') return { dataInicio: somarDias(hoje, -6), dataFim: hoje };
  if (periodo === 'competencia' || periodo === 'competencia-anterior') {
    const atual = getFuelRecordCompetence({ data: hoje });
    const { dataInicio = '', dataFim = '' } = periodoDaCompetencia(periodo === 'competencia' ? atual : competenciaAnterior(atual));
    return { dataInicio, dataFim };
  }
  return { dataInicio: '', dataFim: '' };
};

export type ColunaHistorico = 'data' | 'equipamento' | 'empresa' | 'comboio' | 'combustivel' | 'litros' | 'bomba' | 'km' | 'horimetro' | 'responsavel' | 'observacao';

export const COLUNAS_HISTORICO: ReadonlyArray<{ id: ColunaHistorico; rotulo: string; padrao: boolean; fixa?: boolean; ordenavel?: boolean }> = [
  { id: 'data', rotulo: 'Data e hora', padrao: true, fixa: true, ordenavel: true },
  { id: 'equipamento', rotulo: 'Máquina', padrao: true, fixa: true, ordenavel: true },
  { id: 'litros', rotulo: 'Litros', padrao: true, fixa: true, ordenavel: true },
  { id: 'empresa', rotulo: 'Empresa', padrao: true, ordenavel: true },
  { id: 'comboio', rotulo: 'Comboio', padrao: true, ordenavel: true },
  { id: 'combustivel', rotulo: 'Combustível', padrao: false },
  { id: 'bomba', rotulo: 'Bomba', padrao: true },
  { id: 'horimetro', rotulo: 'Horímetro', padrao: true, ordenavel: true },
  { id: 'km', rotulo: 'KM', padrao: true, ordenavel: true },
  { id: 'responsavel', rotulo: 'Quem lançou', padrao: false },
  { id: 'observacao', rotulo: 'Observação', padrao: false },
];

export const COLUNAS_PADRAO = COLUNAS_HISTORICO.filter(item => item.padrao).map(item => item.id);

/** Lê as colunas guardadas no aparelho; as fixas sempre aparecem e nada desconhecido entra. */
export const colunasValidas = (guardadas: unknown): ColunaHistorico[] => {
  if (!Array.isArray(guardadas)) return [...COLUNAS_PADRAO];
  const escolhidas = new Set(guardadas.filter((item): item is string => typeof item === 'string'));
  return COLUNAS_HISTORICO.filter(item => item.fixa || escolhidas.has(item.id)).map(item => item.id);
};

export type ColunaOrdem = 'data' | 'equipamento' | 'empresa' | 'comboio' | 'litros' | 'horimetro' | 'km';
export interface OrdemHistorico { coluna: ColunaOrdem; direcao: 'asc' | 'desc' }
export const ORDEM_PADRAO: OrdemHistorico = { coluna: 'data', direcao: 'desc' };

/** Nomes que a tela resolve pelo cadastro; a ordem e o agrupamento usam os mesmos. */
export interface NomesHistorico {
  prefixo: (item: Abastecimento) => string;
  empresa: (item: Abastecimento) => string;
  comboio: (item: Abastecimento) => string;
}

const momento = (item: Abastecimento) => `${item.data}${item.hora || ''}`;

export const ordenarHistorico = (itens: readonly Abastecimento[], ordem: OrdemHistorico, nomes: NomesHistorico) => {
  const valor = (item: Abastecimento): string | number => {
    switch (ordem.coluna) {
      case 'equipamento': return nomes.prefixo(item);
      case 'empresa': return nomes.empresa(item);
      case 'comboio': return nomes.comboio(item);
      case 'litros': return Number(item.quantidadeLitros || 0);
      case 'horimetro': return Number(item.horimetroInicial || 0);
      case 'km': return Number(item.kmInicial || 0);
      default: return momento(item);
    }
  };
  const sinal = ordem.direcao === 'asc' ? 1 : -1;
  return [...itens].sort((a, b) => {
    const va = valor(a);
    const vb = valor(b);
    const comparacao = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR', { numeric: true });
    // Empate fica do mais recente para o mais antigo.
    return comparacao * sinal || momento(b).localeCompare(momento(a));
  });
};

/** Clicar na mesma coluna inverte; numa nova, número e data começam do maior. */
export const proximaOrdem = (atual: OrdemHistorico, coluna: ColunaOrdem): OrdemHistorico => {
  if (atual.coluna === coluna) return { coluna, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' };
  return { coluna, direcao: ['equipamento', 'empresa', 'comboio'].includes(coluna) ? 'asc' : 'desc' };
};

export type AgrupamentoHistorico = 'nenhum' | 'dia' | 'maquina' | 'comboio' | 'empresa';

export const AGRUPAMENTOS_HISTORICO: ReadonlyArray<{ id: AgrupamentoHistorico; rotulo: string }> = [
  { id: 'nenhum', rotulo: 'Sem grupo' },
  { id: 'dia', rotulo: 'Por dia' },
  { id: 'maquina', rotulo: 'Por máquina' },
  { id: 'comboio', rotulo: 'Por comboio' },
  { id: 'empresa', rotulo: 'Por empresa' },
];

export interface GrupoHistorico {
  chave: string;
  rotulo: string;
  litros: number;
  itens: Abastecimento[];
}

/** Junta os itens já ordenados, mantendo a ordem em que cada grupo aparece pela primeira vez. */
export const agruparHistorico = (itens: readonly Abastecimento[], agrupamento: AgrupamentoHistorico, nomes: NomesHistorico): GrupoHistorico[] => {
  if (agrupamento === 'nenhum') {
    return [{ chave: 'todos', rotulo: '', litros: itens.reduce((soma, item) => soma + Number(item.quantidadeLitros || 0), 0), itens: [...itens] }];
  }
  const rotuloDe = (item: Abastecimento) => {
    if (agrupamento === 'dia') return item.data || 'Sem data';
    if (agrupamento === 'maquina') return nomes.prefixo(item) || 'Sem prefixo';
    if (agrupamento === 'comboio') return nomes.comboio(item) || 'Sem comboio';
    return nomes.empresa(item) || 'Sem empresa';
  };
  const grupos = new Map<string, GrupoHistorico>();
  itens.forEach(item => {
    const rotulo = rotuloDe(item);
    const grupo = grupos.get(rotulo) || { chave: rotulo, rotulo, litros: 0, itens: [] };
    grupo.litros += Number(item.quantidadeLitros || 0);
    grupo.itens.push(item);
    grupos.set(rotulo, grupo);
  });
  return [...grupos.values()].map(grupo => ({ ...grupo, litros: Math.round(grupo.litros * 10) / 10 }));
};
