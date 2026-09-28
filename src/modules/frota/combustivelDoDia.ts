/**
 * Liga o abastecimento ao lançamento do dia da frota. Quem lança o diesel não
 * precisa digitar de novo o que o Controle de Frotas e o Quadro já sabem:
 * operador, canteiro e frente vêm do lançamento do dia da máquina, e a última
 * leitura vem dos abastecimentos anteriores.
 */
import type { Abastecimento } from '../../types';
import { SEM_CANTEIRO, SEM_FRENTE, type CartaoFrota } from './quadroFrota';

export interface LeituraAnterior {
  data: string;
  hora: string;
  valor: number;
}

export interface ContextoAbastecimento {
  /** Situação do lançamento do dia; "Sem lançamento" quando ninguém lançou. */
  situacao: CartaoFrota['status'];
  grupo: CartaoFrota['grupo'];
  operador: string;
  canteiro: string;
  frente: string;
  ultimoHorimetro?: LeituraAnterior;
  ultimoKm?: LeituraAnterior;
  /** Litros já abastecidos nesta máquina no mesmo dia. */
  litrosNoDia: number;
}

const ativo = (item: Abastecimento) => !item.inativoEm && item.status !== 'Cancelado';

const antes = (item: Abastecimento, dia: string, hora: string) =>
  item.data < dia || (item.data === dia && (item.hora || '') <= hora);

const ultimaLeitura = (lista: readonly Abastecimento[], campo: 'horimetroInicial' | 'kmInicial'): LeituraAnterior | undefined => {
  let melhor: LeituraAnterior | undefined;
  lista.forEach(item => {
    const valor = Number(item[campo]);
    if (!Number.isFinite(valor) || valor <= 0) return;
    const chave = `${item.data}${item.hora || ''}`;
    if (!melhor || chave > `${melhor.data}${melhor.hora}`) melhor = { data: item.data, hora: item.hora || '', valor };
  });
  return melhor;
};

export const contextoDoAbastecimento = ({ dia, hora, cartao, abastecimentos, ignorarId }: {
  dia: string;
  hora: string;
  cartao: CartaoFrota;
  abastecimentos: readonly Abastecimento[];
  /** Abastecimento em edição, que não conta como leitura anterior. */
  ignorarId?: string;
}): ContextoAbastecimento => {
  const daMaquina = abastecimentos.filter(item => item.equipamentoId === cartao.equipamentoId && ativo(item) && item.id !== ignorarId);
  const anteriores = daMaquina.filter(item => antes(item, dia, hora));
  return {
    situacao: cartao.status,
    grupo: cartao.grupo,
    operador: cartao.operador || '',
    canteiro: cartao.canteiro === SEM_CANTEIRO ? '' : cartao.canteiro,
    frente: cartao.frente === SEM_FRENTE ? '' : cartao.frente,
    ultimoHorimetro: ultimaLeitura(anteriores, 'horimetroInicial'),
    ultimoKm: ultimaLeitura(anteriores, 'kmInicial'),
    litrosNoDia: daMaquina.filter(item => item.data === dia).reduce((soma, item) => soma + Number(item.quantidadeLitros || 0), 0),
  };
};

export type TomAviso = 'alerta' | 'info';

export interface AvisoAbastecimento {
  tom: TomAviso;
  texto: string;
}

/** Número digitado com vírgula ou ponto; vazio vira indefinido. */
export const lerNumero = (texto: string): number | undefined => {
  const limpo = texto.trim().replace(/\s/g, '');
  if (!limpo) return undefined;
  // "1.250,5" e "1250,5" usam vírgula decimal. Sem vírgula, "1.250" é milhar
  // (três dígitos depois do ponto) e "12.5" é decimal.
  const normal = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(limpo) ? limpo.replace(/\./g, '') : limpo;
  const valor = Number(normal);
  return Number.isFinite(valor) ? valor : undefined;
};

const numero = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/**
 * Avisos que não impedem salvar, mas pedem uma segunda olhada: leitura menor
 * que a anterior, máquina lançada em manutenção ou sem lançamento no dia.
 */
export const avisosDoAbastecimento = ({ contexto, horimetro, km }: {
  contexto: ContextoAbastecimento;
  horimetro?: number;
  km?: number;
}): AvisoAbastecimento[] => {
  const avisos: AvisoAbastecimento[] = [];
  if (horimetro !== undefined && contexto.ultimoHorimetro && horimetro < contexto.ultimoHorimetro.valor) {
    avisos.push({ tom: 'alerta', texto: `Horímetro menor que o último (${numero(contexto.ultimoHorimetro.valor)} h). Confira o número.` });
  }
  if (km !== undefined && contexto.ultimoKm && km < contexto.ultimoKm.valor) {
    avisos.push({ tom: 'alerta', texto: `Km menor que o último (${numero(contexto.ultimoKm.valor)} km). Confira o número.` });
  }
  if (contexto.grupo === 'manutencao') {
    avisos.push({ tom: 'alerta', texto: 'Esta máquina está lançada em manutenção hoje.' });
  } else if (contexto.grupo === 'sem-lancamento') {
    avisos.push({ tom: 'info', texto: 'Esta máquina ainda não tem lançamento hoje no Controle de Frotas.' });
  }
  if (contexto.litrosNoDia > 0) {
    avisos.push({ tom: 'info', texto: `Já abasteceu ${numero(contexto.litrosNoDia)} L hoje.` });
  }
  return avisos;
};

/** Máquinas operando no dia que ainda não receberam diesel, para lançar com um toque. */
export const operandoSemAbastecer = (cartoes: readonly CartaoFrota[], abastecimentos: readonly Abastecimento[], dia: string) => {
  const abastecidas = new Set(abastecimentos.filter(item => item.data === dia && ativo(item)).map(item => item.equipamentoId));
  return cartoes.filter(cartao => cartao.grupo === 'operando' && !abastecidas.has(cartao.equipamentoId));
};

/** Abastecidas no dia sem nenhum lançamento no Controle de Frotas. */
export const abastecidasSemLancamento = (cartoes: readonly CartaoFrota[], abastecimentos: readonly Abastecimento[], dia: string) => {
  const abastecidas = new Set(abastecimentos.filter(item => item.data === dia && ativo(item)).map(item => item.equipamentoId));
  return cartoes.filter(cartao => cartao.grupo === 'sem-lancamento' && abastecidas.has(cartao.equipamentoId));
};
