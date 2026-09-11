import type { CondicaoClimatica, DiarioObra } from '../types';

/**
 * Mapa de chuvas: o quadro que a obra usa para justificar prazo em contrato.
 * Ele não inventa nada — lê o que foi lançado no diário do dia. Um dia sem
 * diário é diferente de um dia sem chuva, e o mapa precisa mostrar essa
 * diferença, senão vira prova a favor de quem não apontou.
 */
export interface DiaDeChuva {
  data: string; // YYYY-MM-DD
  dia: number;
  /** Ausente quando não houve diário naquele dia. */
  milimetros: number | null;
  horasParadas: number;
  climaManha?: CondicaoClimatica;
  climaTarde?: CondicaoClimatica;
  /** O clima lançado indica que não se trabalhou. */
  impraticavel: boolean;
}

export interface MesDeChuva {
  ano: number;
  mes: number; // 1-12
  rotulo: string;
  dias: DiaDeChuva[];
  totalMm: number;
  diasComChuva: number;
  diasSemDiario: number;
  diasImpraticaveis: number;
  horasParadas: number;
  maiorMm: number;
}

const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const CLIMAS_IMPRATICAVEIS: readonly string[] = ['Impraticável'];

export const diasNoMes = (ano: number, mes: number) => new Date(ano, mes, 0).getDate();

const numero = (valor: unknown): number => {
  const convertido = Number(valor);
  return Number.isFinite(convertido) && convertido > 0 ? convertido : 0;
};

export const montarMesDeChuva = (
  diarios: DiarioObra[],
  ano: number,
  mes: number,
): MesDeChuva => {
  const doMes = new Map<string, DiarioObra>();
  (Array.isArray(diarios) ? diarios : []).forEach(diario => {
    // Diário inativado não conta: ele foi retirado da obra, não do calendário.
    if (!diario?.data || diario.ativo === false) return;
    const [a, m] = diario.data.split('-').map(Number);
    if (a === ano && m === mes) doMes.set(diario.data, diario);
  });

  const dias: DiaDeChuva[] = Array.from({ length: diasNoMes(ano, mes) }, (_, indice) => {
    const dia = indice + 1;
    const data = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const diario = doMes.get(data);
    if (!diario) {
      return { data, dia, milimetros: null, horasParadas: 0, impraticavel: false };
    }
    return {
      data,
      dia,
      milimetros: numero(diario.precipitacaoMm),
      horasParadas: numero(diario.horasParadasClima),
      climaManha: diario.climaManha,
      climaTarde: diario.climaTarde,
      impraticavel: CLIMAS_IMPRATICAVEIS.includes(String(diario.climaManha))
        || CLIMAS_IMPRATICAVEIS.includes(String(diario.climaTarde)),
    };
  });

  const comDiario = dias.filter(dia => dia.milimetros !== null);
  return {
    ano,
    mes,
    rotulo: `${NOMES_MES[mes - 1]} de ${ano}`,
    dias,
    totalMm: Number(comDiario.reduce((soma, dia) => soma + (dia.milimetros || 0), 0).toFixed(1)),
    diasComChuva: comDiario.filter(dia => (dia.milimetros || 0) > 0).length,
    diasSemDiario: dias.length - comDiario.length,
    diasImpraticaveis: dias.filter(dia => dia.impraticavel).length,
    horasParadas: Number(dias.reduce((soma, dia) => soma + dia.horasParadas, 0).toFixed(1)),
    maiorMm: comDiario.reduce((maior, dia) => Math.max(maior, dia.milimetros || 0), 0),
  };
};

/**
 * Faixas de intensidade da chuva. Uma cor por faixa, do claro ao escuro, que é
 * como se lê grandeza — nunca arco-íris. "Sem diário" tem tratamento próprio,
 * porque ausência de dado não é ausência de chuva.
 */
export type FaixaChuva = 'sem-diario' | 'seco' | 'fraca' | 'moderada' | 'forte' | 'muito-forte';

export const faixaDaChuva = (milimetros: number | null): FaixaChuva => {
  if (milimetros === null) return 'sem-diario';
  if (milimetros <= 0) return 'seco';
  if (milimetros < 5) return 'fraca';
  if (milimetros < 25) return 'moderada';
  if (milimetros < 50) return 'forte';
  return 'muito-forte';
};

export const ROTULO_FAIXA: Record<FaixaChuva, string> = {
  'sem-diario': 'Sem diário',
  seco: 'Sem chuva',
  fraca: 'Fraca (até 5 mm)',
  moderada: 'Moderada (5 a 25 mm)',
  forte: 'Forte (25 a 50 mm)',
  'muito-forte': 'Muito forte (50 mm ou mais)',
};

export const mesesComDiario = (diarios: DiarioObra[]): Array<{ ano: number; mes: number }> => {
  const chaves = new Set<string>();
  (Array.isArray(diarios) ? diarios : []).forEach(diario => {
    if (!diario?.data || diario.ativo === false) return;
    chaves.add(diario.data.slice(0, 7));
  });
  return [...chaves]
    .sort()
    .reverse()
    .map(chave => {
      const [ano, mes] = chave.split('-').map(Number);
      return { ano, mes };
    });
};
