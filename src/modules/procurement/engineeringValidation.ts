const REVISION_PATTERN = /(?:^|[._-])R([0-9]+)$/i;

export const validateDrawingRevision = (reference: string): string | null => {
  const value = String(reference || '').trim();
  const match = value.match(REVISION_PATTERN);
  if (!match) return 'Informe a referência do desenho com revisão R3 ou R4.';
  const revision = Number(match[1]);
  if (revision < 3) return `A revisão R${revision} está obsoleta; use a revisão executiva ativa R3 ou R4.`;
  if (revision > 4) return `A revisão R${revision} não está cadastrada como revisão executiva ativa.`;
  return null;
};

export const validateTheoreticalDeviation = (theoretical: number, actual: number, threshold = 0.05) => {
  if (!(theoretical > 0) || !Number.isFinite(theoretical) || !Number.isFinite(actual)) throw new Error('Valor teórico inválido.');
  const percentual = Math.round(((actual - theoretical) / theoretical) * 10000) / 100;
  return { percentual, alerta: Math.abs(percentual) / 100 > threshold };
};

export const reconcileThreeWay = ({ pedido, notaFiscal, rdoBalanca, tolerancia = 0.05 }: { pedido: number; notaFiscal: number; rdoBalanca: number; tolerancia?: number }) => {
  if (![pedido, notaFiscal, rdoBalanca].every(value => Number.isFinite(value) && value >= 0)) return { ok: false, motivo: 'Valores de conciliação inválidos.' };
  const base = Math.max(pedido, 1);
  const desvios = [Math.abs(notaFiscal - pedido) / base, Math.abs(rdoBalanca - pedido) / base, Math.abs(rdoBalanca - notaFiscal) / base];
  const maior = Math.max(...desvios);
  return maior <= tolerancia ? { ok: true } : { ok: false, motivo: `Divergência físico-financeira superior a ${tolerancia * 100}% no 3-way match.` };
};
