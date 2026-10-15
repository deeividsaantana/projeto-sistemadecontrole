import type { Abastecimento, Empresa, Equipamento } from '../../types';
import { calcularConsumo } from '../../utils/fuelOperations';

/**
 * Relatório de diesel por máquina: quanto cada uma abasteceu no período, quanto
 * trabalhou (horas ou km entre um abastecimento e outro) e se está gastando
 * acima do que ela mesma costuma gastar. A comparação é com a própria máquina
 * porque o cadastro não separa os tipos de forma confiável ("Outro" na maioria).
 */

export type UnidadeConsumo = 'L/h' | 'km/L';
export type SituacaoConsumo = 'acima' | 'conferir' | 'sem-leitura' | 'normal';

export interface IntervaloConsumo {
  id: string;
  data: string;
  hora: string;
  litros: number;
  /** Horímetro ou km lido no abastecimento. */
  leitura: number;
  unidade?: UnidadeConsumo;
  valor?: number;
  /** Horas ou km desde o abastecimento anterior. */
  percorrido?: number;
  /** Litros usados na conta: os deste abastecimento e os de leitura errada logo antes. */
  litrosConta: number;
  /** A leitura voltou em relação ao abastecimento anterior. */
  leituraVoltou: boolean;
  /** Consumo deste abastecimento muito longe do que a máquina costuma gastar. */
  foraDoPadrao: boolean;
}

export interface ConsumoEquipamento {
  chave: string;
  equipamentoId?: string;
  prefixo: string;
  nome: string;
  empresa: string;
  abastecimentos: number;
  litros: number;
  unidade?: UnidadeConsumo;
  /** Horas (L/h) ou km (km/L) somados no período. */
  percorrido: number;
  consumoPeriodo?: number;
  /** Mediana do consumo da máquina em todo o histórico. */
  consumoHabitual?: number;
  /** Quanto gasta a mais (+) ou a menos (−) que o habitual, em fração. */
  desvio?: number;
  leiturasConferir: number;
  situacao: SituacaoConsumo;
  ultimoAbastecimento: string;
  intervalos: IntervaloConsumo[];
}

export interface FiltroConsumo {
  dataInicio?: string;
  dataFim?: string;
}

/** A partir de quanto acima do habitual a máquina é marcada. */
export const LIMITE_ACIMA = 0.2;
/** Um abastecimento sozinho só é marcado bem longe do habitual. */
const LIMITE_ABASTECIMENTO = 1.5;
/** Mínimo de leituras para dizer qual é o consumo habitual da máquina. */
const MINIMO_HISTORICO = 4;

const arredondar = (valor: number, casas = 2) => Math.round(valor * 10 ** casas) / 10 ** casas;

const mediana = (valores: number[]) => {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
};

const momento = (item: Pick<Abastecimento, 'data' | 'hora'>) => `${item.data}${item.hora || ''}`;
const dentro = (data: string, filtro: FiltroConsumo) => (!filtro.dataInicio || data >= filtro.dataInicio) && (!filtro.dataFim || data <= filtro.dataFim);
const chaveDe = (item: Abastecimento) => item.equipamentoId || `prefixo:${(item.prefixoInformado || 'SEM PREFIXO').trim().toUpperCase()}`;

const leituraVoltou = (atual: Abastecimento, anterior?: Abastecimento) => {
  if (!anterior) return false;
  const volta = (a: number, b: number) => a > 0 && b > 0 && a < b;
  return volta(Number(atual.horimetroInicial), Number(anterior.horimetroInicial))
    || volta(Number(atual.kmInicial), Number(anterior.kmInicial));
};

/** O consumo é pior quando sobe em L/h e quando cai em km/L. */
const gastoRelativo = (valor: number, habitual: number, unidade: UnidadeConsumo) => (
  unidade === 'L/h' ? valor / habitual : habitual / valor
);

const ORDEM_SITUACAO: Record<SituacaoConsumo, number> = { acima: 0, conferir: 1, 'sem-leitura': 2, normal: 3 };

export const montarConsumoPorEquipamento = ({
  registros, equipamentos, empresas, filtro = {},
}: {
  registros: readonly Abastecimento[];
  equipamentos: readonly Equipamento[];
  empresas: readonly Empresa[];
  filtro?: FiltroConsumo;
}): ConsumoEquipamento[] => {
  const porId = new Map(equipamentos.map(item => [item.id, item]));
  const nomeEmpresa = new Map(empresas.map(item => [item.id, item.nome]));
  const grupos = new Map<string, Abastecimento[]>();
  registros.forEach(item => {
    const chave = chaveDe(item);
    grupos.set(chave, [...(grupos.get(chave) || []), item]);
  });

  const resultado: ConsumoEquipamento[] = [];
  grupos.forEach((lista, chave) => {
    const ordenados = [...lista].sort((a, b) => momento(a).localeCompare(momento(b)));
    if (!ordenados.some(item => dentro(item.data, filtro))) return;

    // Uma leitura que voltou não serve de base para a próxima: a conta segue
    // do último abastecimento com leitura boa, senão o erro estraga dois.
    // O diesel desse abastecimento entra na conta do seguinte, que cobre o mesmo trecho.
    let ultimoBom: Abastecimento | undefined;
    let litrosPendentes = 0;
    const todos = ordenados.map(atual => {
      const voltou = leituraVoltou(atual, ultimoBom);
      if (voltou) {
        litrosPendentes += Number(atual.quantidadeLitros || 0);
        return { atual, voltou, consumo: undefined, litrosConta: 0 };
      }
      const litrosConta = Number(atual.quantidadeLitros || 0) + litrosPendentes;
      const consumo = calcularConsumo({ ...atual, quantidadeLitros: litrosConta }, ultimoBom);
      litrosPendentes = 0;
      ultimoBom = atual;
      return { atual, voltou, consumo, litrosConta };
    });

    const contagem = { 'L/h': 0, 'km/L': 0 };
    todos.forEach(({ consumo }) => { if (consumo) contagem[consumo.unidade] += 1; });
    const unidade: UnidadeConsumo | undefined = contagem['L/h'] + contagem['km/L'] === 0
      ? undefined
      : contagem['L/h'] >= contagem['km/L'] ? 'L/h' : 'km/L';
    const historico = todos.flatMap(({ consumo }) => (consumo && consumo.unidade === unidade ? [consumo.valor] : []));
    const habitual = unidade && historico.length >= MINIMO_HISTORICO ? mediana(historico) : undefined;

    const intervalos: IntervaloConsumo[] = todos
      .filter(({ atual }) => dentro(atual.data, filtro))
      .map(({ atual, voltou, consumo, litrosConta }) => {
        const valido = consumo && consumo.unidade === unidade ? consumo : undefined;
        return {
          id: atual.id,
          data: atual.data,
          hora: atual.hora || '',
          litros: Number(atual.quantidadeLitros || 0),
          leitura: Number(unidade === 'km/L' ? atual.kmInicial : atual.horimetroInicial) || 0,
          unidade: valido?.unidade,
          valor: valido?.valor,
          percorrido: valido?.percorrido,
          litrosConta: valido ? litrosConta : 0,
          leituraVoltou: voltou,
          foraDoPadrao: Boolean(valido && habitual && unidade && gastoRelativo(valido.valor, habitual, unidade) >= LIMITE_ABASTECIMENTO),
        };
      });

    const validos = intervalos.filter(item => item.valor !== undefined);
    const litrosValidos = validos.reduce((soma, item) => soma + item.litrosConta, 0);
    const percorrido = validos.reduce((soma, item) => soma + (item.percorrido || 0), 0);
    const consumoPeriodo = unidade && percorrido > 0 && litrosValidos > 0
      ? arredondar(unidade === 'L/h' ? litrosValidos / percorrido : percorrido / litrosValidos)
      : undefined;
    const desvio = consumoPeriodo && habitual && unidade
      ? arredondar(gastoRelativo(consumoPeriodo, habitual, unidade) - 1, 3)
      : undefined;
    const leiturasConferir = intervalos.filter(item => item.leituraVoltou).length;
    const situacao: SituacaoConsumo = desvio !== undefined && desvio >= LIMITE_ACIMA
      ? 'acima'
      : leiturasConferir > 0 ? 'conferir'
        : consumoPeriodo === undefined ? 'sem-leitura' : 'normal';

    const ultimo = ordenados[ordenados.length - 1];
    const equipamento = ultimo.equipamentoId ? porId.get(ultimo.equipamentoId) : undefined;
    resultado.push({
      chave,
      equipamentoId: equipamento?.id,
      prefixo: equipamento?.prefixo || ultimo.prefixoInformado?.trim() || 'Sem prefixo',
      nome: equipamento?.nome || 'Sem cadastro',
      empresa: (equipamento?.empresaId && nomeEmpresa.get(equipamento.empresaId)) || '',
      abastecimentos: intervalos.length,
      litros: arredondar(intervalos.reduce((soma, item) => soma + item.litros, 0), 1),
      unidade,
      percorrido: arredondar(percorrido, 1),
      consumoPeriodo,
      consumoHabitual: habitual === undefined ? undefined : arredondar(habitual),
      desvio,
      leiturasConferir,
      situacao,
      ultimoAbastecimento: intervalos[intervalos.length - 1]?.data || '',
      intervalos: intervalos.reverse(),
    });
  });

  return resultado.sort((a, b) => ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao]
    || (b.desvio ?? 0) - (a.desvio ?? 0)
    || b.litros - a.litros);
};

/** Texto do consumo na unidade da máquina, ou um traço quando não há leitura. */
export const textoConsumo = (valor: number | undefined, unidade: UnidadeConsumo | undefined) => (
  valor === undefined || !unidade ? '—' : `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${unidade}`
);

/** Datas do mês operacional (21 do mês anterior a 20 do mês), como na competência do diesel. */
export const periodoDaCompetencia = (competencia: string): FiltroConsumo => {
  if (!/^\d{4}-\d{2}$/.test(competencia)) return {};
  const [ano, mes] = competencia.split('-').map(Number);
  const anterior = mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, '0')}`;
  return { dataInicio: `${anterior}-21`, dataFim: `${competencia}-20` };
};
