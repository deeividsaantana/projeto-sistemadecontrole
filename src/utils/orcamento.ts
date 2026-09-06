import type { CategoriaCusto, OrcamentoItem } from '../types';
import type { CustoConsolidado } from './custos';

const dinheiro = (valor: number) => Number(valor.toFixed(2));

export const competenciaDe = (data: string) => data.slice(0, 7);

export interface ComparativoOrcamento {
  competencia: string;
  categoria: CategoriaCusto;
  orcado: number;
  realizado: number;
  saldo: number;
  /** Percentual consumido do orçado; sem orçado não existe percentual. */
  consumo?: number;
  estourado: boolean;
}

/**
 * Orçado x realizado por competência e categoria. Categoria realizada sem
 * orçamento aparece com orçado zero em vez de sumir — gasto sem previsão é
 * exatamente o que precisa ser visto.
 */
export const compararOrcamento = (
  orcamentos: OrcamentoItem[],
  custos: CustoConsolidado[],
  competencia?: string,
): ComparativoOrcamento[] => {
  const chave = (comp: string, categoria: CategoriaCusto) => `${comp}|${categoria}`;
  const mapa = new Map<string, ComparativoOrcamento>();

  orcamentos
    .filter(item => item.ativo !== false && (!competencia || item.competencia === competencia))
    .forEach(item => {
      const atual = mapa.get(chave(item.competencia, item.categoria));
      mapa.set(chave(item.competencia, item.categoria), {
        competencia: item.competencia,
        categoria: item.categoria,
        orcado: dinheiro((atual?.orcado || 0) + (Number(item.valorOrcado) || 0)),
        realizado: atual?.realizado || 0,
        saldo: 0,
        estourado: false,
      });
    });

  custos
    .filter(item => !competencia || competenciaDe(item.data) === competencia)
    .forEach(item => {
      const comp = competenciaDe(item.data);
      const atual = mapa.get(chave(comp, item.categoria));
      mapa.set(chave(comp, item.categoria), {
        competencia: comp,
        categoria: item.categoria,
        orcado: atual?.orcado || 0,
        realizado: dinheiro((atual?.realizado || 0) + (Number(item.valor) || 0)),
        saldo: 0,
        estourado: false,
      });
    });

  return [...mapa.values()]
    .map(item => ({
      ...item,
      saldo: dinheiro(item.orcado - item.realizado),
      consumo: item.orcado > 0 ? Number(((item.realizado / item.orcado) * 100).toFixed(1)) : undefined,
      estourado: item.orcado > 0 && item.realizado > item.orcado,
    }))
    .sort((a, b) => b.competencia.localeCompare(a.competencia)
      || b.realizado - a.realizado
      || a.categoria.localeCompare(b.categoria, 'pt-BR'));
};

export const resumoOrcamento = (linhas: ComparativoOrcamento[]) => {
  const orcado = dinheiro(linhas.reduce((total, item) => total + item.orcado, 0));
  const realizado = dinheiro(linhas.reduce((total, item) => total + item.realizado, 0));
  return {
    orcado,
    realizado,
    saldo: dinheiro(orcado - realizado),
    consumo: orcado > 0 ? Number(((realizado / orcado) * 100).toFixed(1)) : undefined,
    estouradas: linhas.filter(item => item.estourado).length,
    semOrcamento: linhas.filter(item => item.orcado === 0 && item.realizado > 0).length,
  };
};

/** Competência no formato YYYY-MM e valor positivo; nada além disso é regra nossa. */
export const validarOrcamento = (
  candidato: Pick<OrcamentoItem, 'competencia' | 'valorOrcado'>,
): string | null => {
  if (!/^\d{4}-\d{2}$/.test(candidato.competencia || '')) return 'Informe a competência no formato AAAA-MM.';
  if (!(Number(candidato.valorOrcado) > 0)) return 'Informe um valor orçado maior que zero.';
  return null;
};
