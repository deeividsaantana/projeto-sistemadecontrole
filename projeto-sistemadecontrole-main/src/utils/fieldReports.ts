import type { MovimentoMaterial } from '../types';

/** Um envio do link do apontador, como o Painel mostra: onde, quando, quem e fotos. */
export interface FieldReport {
  id: string;
  ramo: string;
  data: string;
  enviadoEm: string;
  apontador: string;
  itens: number;
  fotos: string[];
}

/**
 * Junta os movimentos que vieram do mesmo envio do link. O dia é o que o
 * apontador escolheu (hoje ou ontem); a hora é a do envio. Envio desfeito no
 * escritório não aparece, e os mais recentes vêm primeiro.
 */
export const fieldReportsFromMovements = (
  movements: readonly MovimentoMaterial[],
  { from, to }: { from?: string; to?: string } = {},
): FieldReport[] => {
  const reports = new Map<string, FieldReport>();
  for (const movement of movements) {
    const id = movement.origemApontamentoId;
    if (!id || movement.canceladoEm) continue;
    if ((from && movement.data < from) || (to && movement.data > to)) continue;
    let report = reports.get(id);
    if (!report) {
      report = {
        id,
        ramo: movement.etapaServicoNome || movement.destino || 'Ramo sem nome',
        data: movement.data,
        enviadoEm: movement.criadoEm || '',
        apontador: movement.apontadoPor || movement.responsavel || '',
        itens: 0,
        fotos: [],
      };
      reports.set(id, report);
    }
    report.itens += 1;
    for (const foto of movement.fotos || []) if (!report.fotos.includes(foto)) report.fotos.push(foto);
  }
  return [...reports.values()].sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm) || b.data.localeCompare(a.data));
};

/** Hora do envio no fuso da obra, não no do servidor. */
export const fieldReportTime = (iso: string) => {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(date);
};
