import { isDuplicateTicket } from '../../utils/ticketDuplicateDetection';
import { isoDay } from '../../shared/ui/PeriodFilter';
import type { TicketJazida, TipoTicketJazida } from '../../types';
import { tipoDoTicket } from './constantes';

/** Filtros da lista de tickets. A planilha exportada usa os mesmos. */
export interface FiltrosTickets {
  busca: string;
  dataInicial: string;
  dataFinal: string;
  ticketNumero: string;
  prefixo: string;
  placa: string;
  tipoMaterial: string;
  destinoObra: string;
  empresa: string;
  situacao: string;
}

export const FILTROS_VAZIOS: FiltrosTickets = {
  busca: '', dataInicial: '', dataFinal: '', ticketNumero: '', prefixo: '', placa: '',
  tipoMaterial: '', destinoObra: '', empresa: '', situacao: '',
};

/** Quantos filtros estão ligados (a busca conta como um). */
export const contarFiltros = (filtros: FiltrosTickets) => Object.values(filtros).filter(Boolean).length;

export const passaNosFiltros = (
  t: TicketJazida,
  tipo: TipoTicketJazida,
  filtros: FiltrosTickets,
  duplicateKeys: ReadonlySet<string>,
) => {
  if (tipoDoTicket(t) !== tipo) return false;
  const flowStatus = t.statusFluxo || 'Enviado';
  const qualityStatus = isDuplicateTicket(t, duplicateKeys) ? 'Duplicado' : t.status || 'OK';
  if (filtros.dataInicial && t.data < filtros.dataInicial) return false;
  if (filtros.dataFinal && t.data > filtros.dataFinal) return false;
  if (filtros.ticketNumero && !t.ticketNumero.toLowerCase().includes(filtros.ticketNumero.toLowerCase())) return false;
  if (filtros.prefixo && !t.prefixo.toLowerCase().includes(filtros.prefixo.toLowerCase())) return false;
  if (filtros.placa && !t.placa.toLowerCase().includes(filtros.placa.toLowerCase())) return false;
  if (filtros.tipoMaterial && t.tipoMaterial !== filtros.tipoMaterial) return false;
  if (filtros.destinoObra && t.destinoObra !== filtros.destinoObra) return false;
  if (filtros.empresa && t.empresa !== filtros.empresa) return false;
  if (filtros.situacao && !([String(flowStatus), String(qualityStatus)].includes(filtros.situacao))) return false;
  const q = filtros.busca.toLowerCase().trim();
  if (q) {
    const haystack = [
      t.ticketNumero, t.prefixo, t.placa, t.familiaEquipamento, t.equipamentoNome,
      t.tipoMaterial, t.destinoObra, t.destinoOutro, t.estaca, t.empresa, t.responsavelLiberacao,
      t.nomeLegivel, t.observacao, t.notaFiscalNumero, t.notaFiscalData, t.notaFiscalObservacao, t.data
    ].filter(Boolean).join(' ').toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
};

/** Período rápido: hoje, últimos 7 ou 30 dias (contando hoje). Sem dias, tira o período. */
export const periodoDosUltimos = (days?: number) => {
  if (!days) return { dataInicial: '', dataFinal: '' };
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { dataInicial: isoDay(start), dataFinal: isoDay(end) };
};
