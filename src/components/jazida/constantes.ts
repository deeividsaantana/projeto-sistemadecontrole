import type {
  DestinoObraJazida,
  EmpresaTicketJazida,
  Equipamento,
  TicketJazida,
  TipoMaterialJazida,
  TipoTicketJazida,
} from '../../types';

/** Listas e conversões comuns às partes de Viagens da jazida. */
export const TIPOS_MATERIAL: TipoMaterialJazida[] = ['Solo', 'Rachão', 'BGS', 'Brita', 'Areia', 'Argila', 'Mataco', 'Solo mole', 'Outros'];
export const DESTINOS_OBRA: DestinoObraJazida[] = [
  'Marginal', 'Ramo 200', 'Ramo 300', 'Ramo 500', 'Ramo 600', 'Ramo 800', 'Ramo 900', 'Ramo 1000',
  'Ramo 2000', 'Agulha', 'Ramo 200 Alargamento', 'Ramo 500 Marginal', 'Ramo 600 Ferradura',
  'Rua Padre Eustáquio', 'Padre Eustáquio', 'SP066 Ibar', 'Canteiro da Marginal',
  'Ferradura', 'Coluna de Brita', 'Apoio', 'Jazida', 'Outros'
];
export const EMPRESAS_TICKET: EmpresaTicketJazida[] = ['RENEA', 'Terceiro', 'Outros'];

export const normalizeMasterLabel = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .trim()
  .toUpperCase();

export const normalizeEquipmentKey = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
export const equipmentPlate = (equipment: Equipamento) => (equipment.placa || equipment.seriePlaca || '').trim().toUpperCase();

export type PrintedTicketBatch = {
  id: string;
  inicio: number;
  fim: number;
  criadoEm: string;
  numeros?: string[];
  modo?: 'Em branco' | 'Pré-preenchido';
};

/** O que as outras partes precisam para achar caminhão e local pelo nome. */
export interface CadastrosDaJazida {
  findEquipmentByPrefix: (value: string) => Equipamento | undefined;
  resolveDestinationIds: (value: string) => { localDestinoId?: string };
  originLocationId?: string;
}

export const tipoDoTicket = (ticket: Pick<TicketJazida, 'tipoTicket'>): TipoTicketJazida => ticket.tipoTicket || 'Liberação';

/** 2026-10-21 → 21/10/2026. */
export const dataBr = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');

export const formatEventDateTime = (value: string) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('pt-BR');
};

/**
 * Nomes do dia a dia da obra. No papel continuam "Liberação" e
 * "Recebimento"; na tela vêm junto de onde a via fica.
 */
export const NOME_DA_VIA: Record<TipoTicketJazida, string> = {
  Liberação: 'Liberação (saída da jazida)',
  Recebimento: 'Recebimento (chegada na obra)',
};
