import type { TicketJazida, TipoTicketJazida } from '../types';
import { getImportValue } from '../utils/importHelpers';
import { normalizeComparable } from '../utils/canonicalIdentity';
import { normalizeImportDateOrNull, normalizeImportDecimalOrNull, normalizeImportTextOrNull, normalizeImportTimeOrNull } from './normalizers';
import { ticketDuplicateKey } from '../utils/ticketDuplicateDetection';
import { normalizeTicketNumber } from '../utils/ticketNumberSequence';
import { stableId } from './stableId';
import { getRawImportValue } from './rawImportValue';
import type { ImportPreview } from './types';

/**
 * Mesmas colunas/convenções já em produção em TicketsJazidaTab.tsx
 * (handleImportTicketsFile / TICKET_COLUMN_SYNONYMS): "tipoMaterial" e
 * "destinoObra" são campos de união aberta (aceitam qualquer texto — ver
 * TipoMaterialJazida/DestinoObraJazida em src/types.ts), por isso o texto da
 * planilha é usado como está, sem precisar bater com uma lista fechada.
 */
const FIELD_ALIASES = {
  data: ['Data'], ticketNumero: ['Ticket Nº', 'Ticket'], prefixo: ['Prefixo'], placa: ['Placa'],
  quantidadeM3: ['Quantidade m³', 'Quantidade'], destinoObra: ['Destino / Obra', 'Destino'],
  ramoDescarga: ['Ramo de Descarga', 'Ramo'], tipoMaterial: ['Material', 'Tipo de Material'],
  empresa: ['Empresa'], estaca: ['Estaca'], familiaEquipamento: ['Família', 'Familia'],
  equipamentoNome: ['Equipamento'],
};

type ApplicationSkipped = { duplicate: number; review: number; reference: number; other: number };

// EmpresaTicketJazida é união fechada (sem fallback de texto livre, ao
// contrário de tipoMaterial/destinoObra) — mesma normalização de
// TicketsJazidaTab.normalizeEmpresaValue, para nunca gravar um valor fora
// das três opções válidas.
const normalizeEmpresa = (value: string): TicketJazida['empresa'] => {
  const normalized = normalizeComparable(value);
  if (normalized.includes('terce')) return 'Terceiro';
  if (normalized.includes('outro')) return 'Outros';
  return 'RENEA';
};

export const buildTravelImportApplication = (
  preview: ImportPreview<unknown>,
  currentTickets: readonly TicketJazida[],
  responsible: string,
) => {
  const tickets: TicketJazida[] = [];
  const skipped: ApplicationSkipped = { duplicate: 0, review: 0, reference: 0, other: 0 };
  const knownIds = new Set(currentTickets.map(item => item.id));
  const seenKeys = new Set(
    currentTickets.filter(item => normalizeTicketNumber(item.ticketNumero)).map(ticketDuplicateKey),
  );

  preview.rows.forEach(item => {
    if (item.disposition !== 'new') {
      if (item.disposition === 'duplicate-in-file' || item.disposition === 'unchanged') skipped.duplicate++;
      else if (item.disposition === 'review') skipped.review++;
      else skipped.other++;
      return;
    }
    const sheet = normalizeComparable(item.row.lineage.sourceSheet);
    if (!sheet.includes('liberacao') && !sheet.includes('recebimento')) {
      // Cadastro / Conferência / Resumo: reconhecidas pelo travelsAdapter,
      // mas são catálogo/consolidado, não geram ticket.
      skipped.reference++;
      return;
    }
    const tipo: TipoTicketJazida = sheet.includes('recebimento') ? 'Recebimento' : 'Liberação';
    const raw = item.row.rawRow || {};

    const data = normalizeImportDateOrNull(getImportValue(raw, FIELD_ALIASES.data));
    const ticketNumeroBruto = normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.ticketNumero));
    const quantidadeM3 = normalizeImportDecimalOrNull(getImportValue(raw, FIELD_ALIASES.quantidadeM3));
    // Nunca inventa ticket, data ou quantidade: sem um desses três, a linha
    // fica em conferência, mesmo que a chave operacional do adaptador (que
    // só exige ticket+via) já tenha marcado a linha como "new".
    if (!data || !ticketNumeroBruto || quantidadeM3 === null) { skipped.review++; return; }

    const ticketNumero = normalizeTicketNumber(ticketNumeroBruto);
    const key = ticketDuplicateKey({ ticketNumero, tipoTicket: tipo });
    if (seenKeys.has(key)) { skipped.duplicate++; return; }
    seenKeys.add(key);

    const id = stableId('ticket-import', `${preview.sourceHash}-${item.row.lineage.sourceSheet}-${item.row.lineage.sourceRow}`);
    if (knownIds.has(id)) return;
    knownIds.add(id);

    const horaAlias = tipo === 'Recebimento' ? ['Hora de chegada', 'Hora'] : ['Hora de saída', 'Hora'];
    const hora = normalizeImportTimeOrNull(getRawImportValue(raw, horaAlias)) || '';
    const destinoTexto = getImportValue(raw, tipo === 'Recebimento' ? FIELD_ALIASES.ramoDescarga : FIELD_ALIASES.destinoObra);

    tickets.push({
      id,
      data,
      tipoTicket: tipo,
      ticketNumero,
      prefixo: getImportValue(raw, FIELD_ALIASES.prefixo).toUpperCase(),
      placa: getImportValue(raw, FIELD_ALIASES.placa).toUpperCase(),
      familiaEquipamento: getImportValue(raw, FIELD_ALIASES.familiaEquipamento) || undefined,
      equipamentoNome: getImportValue(raw, FIELD_ALIASES.equipamentoNome) || undefined,
      horaChegada: tipo === 'Recebimento' ? hora : undefined,
      horaSaida: tipo === 'Liberação' ? hora : '',
      tipoMaterial: getImportValue(raw, FIELD_ALIASES.tipoMaterial) || 'Outros',
      quantidadeM3,
      destinoObra: destinoTexto || 'Outros',
      estaca: tipo === 'Recebimento' ? getImportValue(raw, FIELD_ALIASES.estaca) : '',
      responsavelLiberacao: responsible,
      nomeLegivel: '',
      empresa: normalizeEmpresa(getImportValue(raw, FIELD_ALIASES.empresa)),
      observacao: `Importado de ${preview.sourceFile} · ${item.row.lineage.sourceSheet} · linha ${item.row.lineage.sourceRow} · lote ${preview.batchId}`,
      statusFluxo: 'Rascunho',
      origemRegistro: 'Importação',
      criadoEm: preview.generatedAt,
      atualizadoEm: preview.generatedAt,
    });
  });

  return { tickets, skipped };
};
