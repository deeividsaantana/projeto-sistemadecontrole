import type { Abastecimento, Comboio, Empresa, Equipamento } from '../../types';
import { chaveMaquina, idsRepetidos } from './repetidosDiesel';

/**
 * Números do relatório do diesel para um período: total, ritmo por dia,
 * comparação com o período anterior do mesmo tamanho e as quebras por
 * máquina, comboio e empresa. Tudo pronto para a tela e para o Excel.
 */
export interface LinhaRelatorio {
  chave: string;
  rotulo: string;
  detalhe: string;
  litros: number;
  lancamentos: number;
  /** Para abrir a lista já filtrada. */
  filtro: { equipamentoId?: string; comboioId?: string; empresaId?: string; texto?: string };
}

export interface DiaRelatorio {
  dia: string;
  litros: number;
  lancamentos: number;
}

export interface RelatorioDiesel {
  inicio: string;
  fim: string;
  litros: number;
  lancamentos: number;
  maquinas: number;
  diasComAbastecimento: number;
  mediaPorDia: number;
  maiorDia?: DiaRelatorio;
  anterior: { inicio: string; fim: string; litros: number; lancamentos: number };
  /** Variação dos litros contra o período anterior; undefined sem base para comparar. */
  variacao?: number;
  porDia: DiaRelatorio[];
  porMaquina: LinhaRelatorio[];
  porComboio: LinhaRelatorio[];
  porEmpresa: LinhaRelatorio[];
  repetidos: number;
  aConferir: number;
  semCadastro: number;
}

const DIA_MS = 86_400_000;
const paraData = (dia: string) => new Date(`${dia}T12:00:00Z`);
const paraDia = (data: Date) => data.toISOString().slice(0, 10);
const somarDias = (dia: string, dias: number) => paraDia(new Date(paraData(dia).getTime() + dias * DIA_MS));
const diasEntre = (inicio: string, fim: string) => Math.round((paraData(fim).getTime() - paraData(inicio).getTime()) / DIA_MS) + 1;
const litrosDe = (item: Pick<Abastecimento, 'quantidadeLitros'>) => Number(item.quantidadeLitros || 0);

export const precisaConferir = (item: Abastecimento) => (
  item.revisaoStatus === 'Pendente' || item.status === 'Pendente' || Boolean(item.alertas?.some(alerta => alerta.severidade !== 'info'))
);

const agrupar = (
  itens: readonly Abastecimento[],
  chave: (item: Abastecimento) => string,
  linha: (chave: string, item: Abastecimento) => Omit<LinhaRelatorio, 'litros' | 'lancamentos'>,
): LinhaRelatorio[] => {
  const grupos = new Map<string, LinhaRelatorio>();
  itens.forEach(item => {
    const id = chave(item);
    const atual = grupos.get(id) ?? { ...linha(id, item), litros: 0, lancamentos: 0 };
    atual.litros += litrosDe(item);
    atual.lancamentos += 1;
    grupos.set(id, atual);
  });
  return [...grupos.values()].sort((a, b) => b.litros - a.litros || a.rotulo.localeCompare(b.rotulo, 'pt-BR', { numeric: true }));
};

export const montarRelatorioDiesel = ({
  registros, equipamentos, empresas, comboios, inicio, fim, hoje,
}: {
  registros: readonly Abastecimento[];
  equipamentos: readonly Equipamento[];
  empresas: readonly Empresa[];
  comboios: readonly Comboio[];
  inicio: string;
  fim: string;
  /** Período em curso conta os dias só até hoje, para a média não cair. */
  hoje: string;
}): RelatorioDiesel => {
  const porId = new Map(equipamentos.map(item => [item.id, item]));
  const nomeEmpresa = new Map(empresas.map(item => [item.id, item.nome]));
  const nomeComboio = new Map(comboios.map(item => [item.id, item.nome]));
  const doPeriodo = registros.filter(item => item.data && item.data >= inicio && item.data <= fim);

  const ultimoDia = fim > hoje && inicio <= hoje ? hoje : fim;
  const totalDias = Math.max(1, diasEntre(inicio, ultimoDia));
  const litrosDoDia = new Map<string, DiaRelatorio>();
  doPeriodo.forEach(item => {
    const atual = litrosDoDia.get(item.data) ?? { dia: item.data, litros: 0, lancamentos: 0 };
    atual.litros += litrosDe(item);
    atual.lancamentos += 1;
    litrosDoDia.set(item.data, atual);
  });
  const porDia = Array.from({ length: totalDias }, (_, indice) => {
    const dia = somarDias(inicio, indice);
    return litrosDoDia.get(dia) ?? { dia, litros: 0, lancamentos: 0 };
  });

  const litros = doPeriodo.reduce((soma, item) => soma + litrosDe(item), 0);
  const anteriorFim = somarDias(inicio, -1);
  const anteriorInicio = somarDias(inicio, -totalDias);
  const doAnterior = registros.filter(item => item.data && item.data >= anteriorInicio && item.data <= anteriorFim);
  const litrosAnterior = doAnterior.reduce((soma, item) => soma + litrosDe(item), 0);

  const prefixoDe = (item: Abastecimento) => porId.get(item.equipamentoId)?.prefixo || item.prefixoInformado?.trim().toUpperCase() || 'Sem prefixo';
  const repetidos = idsRepetidos(doPeriodo);

  return {
    inicio,
    fim,
    litros,
    lancamentos: doPeriodo.length,
    maquinas: new Set(doPeriodo.map(chaveMaquina)).size,
    diasComAbastecimento: litrosDoDia.size,
    mediaPorDia: litros / totalDias,
    maiorDia: [...litrosDoDia.values()].sort((a, b) => b.litros - a.litros)[0],
    anterior: { inicio: anteriorInicio, fim: anteriorFim, litros: litrosAnterior, lancamentos: doAnterior.length },
    variacao: litrosAnterior > 0 ? (litros - litrosAnterior) / litrosAnterior : undefined,
    porDia,
    porMaquina: agrupar(doPeriodo, chaveMaquina, (_, item) => {
      const maquina = porId.get(item.equipamentoId);
      return {
        chave: chaveMaquina(item),
        rotulo: prefixoDe(item),
        detalhe: maquina ? `${maquina.nome}${nomeEmpresa.get(maquina.empresaId) ? ` · ${nomeEmpresa.get(maquina.empresaId)}` : ''}` : 'Sem cadastro',
        filtro: maquina ? { equipamentoId: maquina.id } : { texto: prefixoDe(item) },
      };
    }),
    porComboio: agrupar(doPeriodo, item => item.comboioId || 'sem', (id, item) => ({
      chave: id,
      rotulo: nomeComboio.get(item.comboioId) || 'Sem comboio',
      detalhe: '',
      filtro: item.comboioId ? { comboioId: item.comboioId } : {},
    })),
    porEmpresa: agrupar(doPeriodo, item => porId.get(item.equipamentoId)?.empresaId || 'sem', (id) => ({
      chave: id,
      rotulo: nomeEmpresa.get(id) || 'Sem empresa',
      detalhe: '',
      filtro: id !== 'sem' ? { empresaId: id } : {},
    })),
    repetidos: repetidos.size,
    aConferir: doPeriodo.filter(precisaConferir).length,
    semCadastro: doPeriodo.filter(item => !porId.has(item.equipamentoId)).length,
  };
};

/** Linha do relatório de fornecimento: um abastecimento, como sai no e-mail para a empresa. */
export interface LinhaFornecimento {
  data: string;
  hora: string;
  prefixo: string;
  descricao: string;
  comboio: string;
  horimetro?: number;
  km?: number;
  bombaInicial?: number;
  bombaFinal?: number;
  litros: number;
}

export interface FornecimentoEmpresa {
  /** Nome da empresa, ou "Todas as empresas". */
  empresa: string;
  /** Combustível mais lançado no período (ex.: "Diesel S10"). */
  combustivel: string;
  inicio: string;
  fim: string;
  litros: number;
  lancamentos: number;
  linhas: LinhaFornecimento[];
  porEquipamento: Array<{ prefixo: string; descricao: string; abastecimentos: number; litros: number }>;
}

const numeroOuNada = (valor: unknown) => {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : undefined;
};

/** As máquinas da empresa (vazio = todas) que abasteceram no período. */
export const doPeriodoEEmpresa = (
  registros: readonly Abastecimento[], equipamentos: readonly Equipamento[], inicio: string, fim: string, empresaId: string,
) => {
  const empresaDe = new Map(equipamentos.map(item => [item.id, item.empresaId]));
  return registros.filter(item => item.data && item.data >= inicio && item.data <= fim
    && (!empresaId || empresaDe.get(item.equipamentoId) === empresaId));
};

/**
 * Relatório de fornecimento de diesel para mandar à empresa dona das
 * máquinas: cada abastecimento por data e o total por equipamento.
 */
export const montarFornecimento = ({
  registros, equipamentos, empresas, comboios, combustiveis, inicio, fim, empresaId,
}: {
  registros: readonly Abastecimento[];
  equipamentos: readonly Equipamento[];
  empresas: readonly Empresa[];
  comboios: readonly Comboio[];
  combustiveis: readonly { id: string; nome: string }[];
  inicio: string;
  fim: string;
  empresaId: string;
}): FornecimentoEmpresa => {
  const porId = new Map(equipamentos.map(item => [item.id, item]));
  const nomeComboio = new Map(comboios.map(item => [item.id, item.nome]));
  const itens = doPeriodoEEmpresa(registros, equipamentos, inicio, fim, empresaId)
    .sort((a, b) => `${a.data}${a.hora || ''}`.localeCompare(`${b.data}${b.hora || ''}`));
  const linhas = itens.map(item => {
    const maquina = porId.get(item.equipamentoId);
    return {
      data: item.data,
      hora: item.hora || '',
      prefixo: maquina?.prefixo || item.prefixoInformado?.trim().toUpperCase() || 'Sem prefixo',
      descricao: maquina?.nome || 'Sem cadastro',
      comboio: nomeComboio.get(item.comboioId) || '',
      horimetro: numeroOuNada(item.horimetroInicial),
      km: numeroOuNada(item.kmInicial),
      bombaInicial: numeroOuNada(item.bombaInicial),
      bombaFinal: numeroOuNada(item.bombaFinal),
      litros: litrosDe(item),
    };
  });
  const grupos = new Map<string, FornecimentoEmpresa['porEquipamento'][number]>();
  linhas.forEach(linha => {
    const atual = grupos.get(linha.prefixo) ?? { prefixo: linha.prefixo, descricao: linha.descricao, abastecimentos: 0, litros: 0 };
    atual.abastecimentos += 1;
    atual.litros += linha.litros;
    grupos.set(linha.prefixo, atual);
  });
  const contagem = new Map<string, number>();
  itens.forEach(item => contagem.set(item.tipoCombustivelId, (contagem.get(item.tipoCombustivelId) ?? 0) + 1));
  const maisUsado = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return {
    empresa: empresaId ? empresas.find(item => item.id === empresaId)?.nome || 'Empresa sem nome' : 'Todas as empresas',
    combustivel: combustiveis.find(item => item.id === maisUsado)?.nome || 'Óleo Diesel',
    inicio,
    fim,
    litros: linhas.reduce((soma, linha) => soma + linha.litros, 0),
    lancamentos: linhas.length,
    linhas,
    porEquipamento: [...grupos.values()].sort((a, b) => b.litros - a.litros || a.prefixo.localeCompare(b.prefixo, 'pt-BR', { numeric: true })),
  };
};
