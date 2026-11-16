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

export const COLUNAS_HISTORICO: ReadonlyArray<{ id: ColunaHistorico; rotulo: string; padrao: boolean; ordenavel?: boolean }> = [
  { id: 'data', rotulo: 'Data', padrao: true, ordenavel: true },
  { id: 'prefixo', rotulo: 'Prefixo', padrao: true, ordenavel: true },
  { id: 'descricao', rotulo: 'Descrição do equipamento', padrao: true },
  { id: 'km', rotulo: 'KM inicial', padrao: true, ordenavel: true },
  { id: 'horimetro', rotulo: 'Horímetro', padrao: true, ordenavel: true },
  { id: 'litros', rotulo: 'Litros', padrao: true, ordenavel: true },
  { id: 'hora', rotulo: 'Hora', padrao: false },
  { id: 'comboio', rotulo: 'Comboio', padrao: false, ordenavel: true },
  { id: 'combustivel', rotulo: 'Tipo de combustível', padrao: true },
  { id: 'empresa', rotulo: 'Empresa', padrao: true, ordenavel: true },
  { id: 'bombaInicial', rotulo: 'Bomba inicial', padrao: false },
  { id: 'bombaFinal', rotulo: 'Bomba final', padrao: false },
  { id: 'responsavel', rotulo: 'Quem lançou', padrao: false },
  { id: 'observacao', rotulo: 'Observação', padrao: false },
];

export type ColunaOrdem = 'data' | 'prefixo' | 'empresa' | 'comboio' | 'litros' | 'horimetro' | 'km';
export interface OrdemHistorico { coluna: ColunaOrdem; direcao: 'asc' | 'desc' }
/** Como na planilha: do primeiro lançamento do mês para o último. */
export const ORDEM_PADRAO: OrdemHistorico = { coluna: 'data', direcao: 'asc' };

/** Nomes que a tela resolve pelo cadastro; a ordem usa os mesmos. */
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
