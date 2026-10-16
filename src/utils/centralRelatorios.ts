/**
 * Quanto dado cada relatório tem por trás: conta só o que está ativo e acha o
 * último dia lançado. A aba Relatórios usa isso para dizer, antes de abrir,
 * se o relatório tem número de verdade ou ainda está vazio.
 */
export interface BaseRelatorio {
  total: number;
  /** Último dia com lançamento (AAAA-MM-DD), vazio quando não há nenhum. */
  ultimoDia: string;
}

type RegistroComData = { data?: string; inativoEm?: string; ativo?: boolean };

export const resumirBase = (registros: ReadonlyArray<RegistroComData> = []): BaseRelatorio => {
  let total = 0;
  let ultimoDia = '';
  registros.forEach(registro => {
    if (!registro || registro.inativoEm || registro.ativo === false) return;
    total += 1;
    const dia = (registro.data || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dia) && dia > ultimoDia) ultimoDia = dia;
  });
  return { total, ultimoDia };
};

export const textoBase = (base: BaseRelatorio, singular: string, plural: string) => {
  if (base.total === 0) return 'Nenhum lançamento ainda';
  const quantidade = `${base.total.toLocaleString('pt-BR')} ${base.total === 1 ? singular : plural}`;
  if (!base.ultimoDia) return quantidade;
  return `${quantidade} · último em ${base.ultimoDia.split('-').reverse().join('/')}`;
};
