export const DIAS_ALERTA_VENCIMENTO = 30;

export type SituacaoVencimento = 'Válido' | 'Vence em breve' | 'Vencido' | 'Sem vencimento';

/**
 * Regra única de vencimento do sistema — treinamento, documento, licença. Fica
 * num lugar só para não existirem dois critérios de "vence em breve".
 */
export const situacaoVencimento = (
  dataVencimento: string | undefined,
  hoje: string,
  diasAlerta: number = DIAS_ALERTA_VENCIMENTO,
): SituacaoVencimento => {
  const vencimento = dataVencimento?.slice(0, 10);
  if (!vencimento) return 'Sem vencimento';
  if (vencimento < hoje) return 'Vencido';
  const limite = new Date(`${hoje}T00:00:00`);
  limite.setDate(limite.getDate() + diasAlerta);
  const limiteDia = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`;
  return vencimento <= limiteDia ? 'Vence em breve' : 'Válido';
};

export const exigeAtencao = (situacao: SituacaoVencimento) =>
  situacao === 'Vencido' || situacao === 'Vence em breve';
