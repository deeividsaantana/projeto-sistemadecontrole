import type { Abastecimento } from '../../types';
import { getFuelRecordCompetence } from './fuelReport';
import { periodoDaCompetencia } from './consumoPorEquipamento';

/**
 * Histórico do diesel no modelo da planilha: abas por mês, ordem por coluna,
 * agrupamento com subtotal e as colunas que cada pessoa escolhe ver. A tela
 * só desenha.
 */

/**
 * Abas do histórico, como as da planilha: uma por mês do diesel (21 a 20) e
 * "tudo". A aba do mês atual existe mesmo sem lançamento, para o histórico
 * sempre abrir nela.
 */
export type AbaHistorico = string;
export const ABA_TUDO = 'tudo';

export const abaDoDia = (dia: string): AbaHistorico => getFuelRecordCompetence({ data: dia });

export const abasDoHistorico = (itens: readonly Pick<Abastecimento, 'data' | 'competencia'>[], hoje: string): AbaHistorico[] => {
  const abas = new Set(itens.map(item => getFuelRecordCompetence(item)).filter(aba => /^\d{4}-\d{2}$/.test(aba)));
  abas.add(abaDoDia(hoje));
  return [...abas].sort();
};

/** Datas da aba: o mês do diesel vai de 21 do mês anterior a 20. */
export const intervaloDaAba = (aba: AbaHistorico): { dataInicio: string; dataFim: string } => {
  if (aba === ABA_TUDO) return { dataInicio: '', dataFim: '' };
  const { dataInicio = '', dataFim = '' } = periodoDaCompetencia(aba);
  return { dataInicio, dataFim };
};

/** As colunas da planilha FORNECIMENTO DIESEL, na ordem dela, e duas a mais que o app guarda. */
export type ColunaHistorico = 'data' | 'prefixo' | 'descricao' | 'km' | 'horimetro' | 'litros' | 'hora' | 'comboio' | 'combustivel' | 'empresa' | 'bombaInicial' | 'bombaFinal' | 'responsavel' | 'observacao';

export const COLUNAS_HISTORICO: ReadonlyArray<{ id: ColunaHistorico; rotulo: string; padrao: boolean; fixa?: boolean; ordenavel?: boolean }> = [
  { id: 'data', rotulo: 'Data', padrao: true, fixa: true, ordenavel: true },
  { id: 'prefixo', rotulo: 'Prefixo', padrao: true, fixa: true, ordenavel: true },
  { id: 'descricao', rotulo: 'Descrição do equipamento', padrao: true },
  { id: 'km', rotulo: 'KM inicial', padrao: true, ordenavel: true },
  { id: 'horimetro', rotulo: 'Horímetro', padrao: true, ordenavel: true },
  { id: 'litros', rotulo: 'Litros', padrao: true, fixa: true, ordenavel: true },
  { id: 'hora', rotulo: 'Hora', padrao: false },
  { id: 'comboio', rotulo: 'Comboio', padrao: true, ordenavel: true },
  { id: 'combustivel', rotulo: 'Tipo de combustível', padrao: true },
  { id: 'empresa', rotulo: 'Empresa', padrao: true, ordenavel: true },
  { id: 'bombaInicial', rotulo: 'Bomba inicial', padrao: false },
  { id: 'bombaFinal', rotulo: 'Bomba final', padrao: false },
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

export type ColunaOrdem = 'data' | 'prefixo' | 'empresa' | 'comboio' | 'litros' | 'horimetro' | 'km';
export interface OrdemHistorico { coluna: ColunaOrdem; direcao: 'asc' | 'desc' }
/** Como na planilha: do primeiro lançamento do mês para o último. */
export const ORDEM_PADRAO: OrdemHistorico = { coluna: 'data', direcao: 'asc' };

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
      case 'prefixo': return nomes.prefixo(item);
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

/** Clicar na mesma coluna inverte; numa nova, texto e data vão em ordem crescente e números começam do maior. */
export const proximaOrdem = (atual: OrdemHistorico, coluna: ColunaOrdem): OrdemHistorico => {
  if (atual.coluna === coluna) return { coluna, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' };
  return { coluna, direcao: ['data', 'prefixo', 'empresa', 'comboio'].includes(coluna) ? 'asc' : 'desc' };
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
