import type { Abastecimento } from '../../types';

export type DesvioSeveridade = 'info' | 'aviso' | 'alerta';

export interface DesvioAnalise {
  tipo: 'consumo' | 'sequencia_bomba' | 'km' | 'horimetro';
  severidade: DesvioSeveridade;
  mensagem: string;
  valor?: string | number;
  esperado?: string | number;
}

export interface AbastecimentoComDesvios extends Abastecimento {
  desvios: DesvioAnalise[];
}

// Baseline de consumo em L/dia
const CONSUMO_BASELINE = 50;
const CONSUMO_ALTO_THRESHOLD = 1.5; // 150% do baseline
const CONSUMO_BAIXO_THRESHOLD = 0.3; // 30% do baseline

// Tolerância de sequência de bomba
const BOMBA_SEQUENCE_TOLERANCE = 10;

/**
 * Calcula consumo diário baseado em litros e intervalo em dias
 */
const calcularConsumoDiario = (litros: number, diasIntervalo: number): number => {
  if (diasIntervalo <= 0) return 0;
  return litros / diasIntervalo;
};

/**
 * Valida consumo contra baseline
 */
const analisarConsumo = (
  consumoDiario: number,
  diasIntervalo: number,
): DesvioAnalise | null => {
  if (diasIntervalo < 2) return null; // Só analisa intervalos multi-dia

  const altoThreshold = CONSUMO_BASELINE * CONSUMO_ALTO_THRESHOLD;
  const baixoThreshold = CONSUMO_BASELINE * CONSUMO_BAIXO_THRESHOLD;

  if (consumoDiario > altoThreshold) {
    return {
      tipo: 'consumo',
      severidade: 'aviso',
      mensagem: `Consumo alto: ${consumoDiario.toFixed(1)} L/dia (esperado ~${CONSUMO_BASELINE} L/dia)`,
      valor: consumoDiario.toFixed(1),
      esperado: CONSUMO_BASELINE,
    };
  }

  if (consumoDiario < baixoThreshold) {
    return {
      tipo: 'consumo',
      severidade: 'info',
      mensagem: `Consumo baixo: ${consumoDiario.toFixed(1)} L/dia`,
      valor: consumoDiario.toFixed(1),
      esperado: CONSUMO_BASELINE,
    };
  }

  return null;
};

/**
 * Valida sequência de bomba (diferença entre final e inicial)
 */
const analisarSequenciaBomba = (
  bombaInicial: number,
  bombaFinal: number,
  litros: number,
): DesvioAnalise | null => {
  if (bombaInicial <= 0 || bombaFinal <= 0) return null;

  const diferenca = bombaFinal - bombaInicial;
  const tolerancia = BOMBA_SEQUENCE_TOLERANCE;

  if (Math.abs(diferenca - litros) > tolerancia) {
    return {
      tipo: 'sequencia_bomba',
      severidade: 'alerta',
      mensagem: `Sequência de bomba inconsistente: Final (${bombaFinal}) - Inicial (${bombaInicial}) = ${diferenca}L, mas informado ${litros}L`,
      valor: diferenca,
      esperado: litros,
    };
  }

  return null;
};

/**
 * Valida variação de KM
 */
const analisarKM = (
  kmAtual: number,
  kmAnterior: number,
  diasIntervalo: number,
): DesvioAnalise | null => {
  if (kmAtual <= 0 || kmAnterior <= 0) return null;
  if (kmAtual < kmAnterior) {
    return {
      tipo: 'km',
      severidade: 'alerta',
      mensagem: `KM regrediu: ${kmAtual}km (anterior: ${kmAnterior}km)`,
      valor: kmAtual,
      esperado: kmAnterior,
    };
  }

  // Se houve muita variação em pouco tempo
  if (diasIntervalo > 0 && diasIntervalo < 1) {
    const variacaoKm = kmAtual - kmAnterior;
    const kmPorDia = variacaoKm / diasIntervalo;
    if (kmPorDia > 500) {
      return {
        tipo: 'km',
        severidade: 'aviso',
        mensagem: `Variação de KM alta: ${variacaoKm}km em ${diasIntervalo.toFixed(1)} dias (${kmPorDia.toFixed(0)} km/dia)`,
        valor: kmPorDia.toFixed(0),
        esperado: '~200',
      };
    }
  }

  return null;
};

/**
 * Valida variação de horímetro
 */
const analisarHorimetro = (
  horimetroAtual: number,
  horimetroAnterior: number,
): DesvioAnalise | null => {
  if (horimetroAtual <= 0 || horimetroAnterior <= 0) return null;
  if (horimetroAtual < horimetroAnterior) {
    return {
      tipo: 'horimetro',
      severidade: 'alerta',
      mensagem: `Horímetro regrediu: ${horimetroAtual}h (anterior: ${horimetroAnterior}h)`,
      valor: horimetroAtual,
      esperado: horimetroAnterior,
    };
  }

  return null;
};

/**
 * Analisa um abastecimento contra o anterior para detectar anomalias
 */
export const analisarAbastecimento = (
  atual: Abastecimento,
  anterior?: Abastecimento,
): AbastecimentoComDesvios => {
  const desvios: DesvioAnalise[] = [];

  if (anterior) {
    // Calcula intervalo em dias
    const dataAtual = new Date(`${atual.data}T${atual.hora}:00`);
    const dataAnterior = new Date(`${anterior.data}T${anterior.hora}:00`);
    const diasIntervalo = (dataAtual.getTime() - dataAnterior.getTime()) / (1000 * 60 * 60 * 24);

    // Análise de consumo
    const consumoDiario = calcularConsumoDiario(atual.quantidadeLitros, diasIntervalo);
    const desvioConsumo = analisarConsumo(consumoDiario, diasIntervalo);
    if (desvioConsumo) desvios.push(desvioConsumo);

    // Análise de sequência de bomba
    const desvioSeq = analisarSequenciaBomba(atual.bombaInicial, atual.bombaFinal, atual.quantidadeLitros);
    if (desvioSeq) desvios.push(desvioSeq);

    // Análise de KM
    const desvioKM = analisarKM(atual.kmInicial, anterior.kmInicial, diasIntervalo);
    if (desvioKM) desvios.push(desvioKM);

    // Análise de horímetro
    const desvioHorimetro = analisarHorimetro(atual.horimetroInicial, anterior.horimetroInicial);
    if (desvioHorimetro) desvios.push(desvioHorimetro);
  }

  return { ...atual, desvios };
};

/**
 * Analisa lista de abastecimentos ordenados cronologicamente
 */
export const analisarHistoricoAbastecimentos = (
  registros: readonly Abastecimento[],
): AbastecimentoComDesvios[] => {
  const ordenado = [...registros].sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`));
  return ordenado.map((atual, idx) => analisarAbastecimento(atual, ordenado[idx - 1]));
};
