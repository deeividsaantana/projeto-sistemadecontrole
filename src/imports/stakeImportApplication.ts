import type { ControleEstacas, CravacaoEstaca, LoteEstaca, MovimentoEstaca, StatusEstaca } from '../types';
import { getImportValue } from '../utils/importHelpers';
import { normalizeComparable } from '../utils/canonicalIdentity';
import { normalizeImportDateOrNull, normalizeImportDecimalOrNull, normalizeImportTimeOrNull } from './normalizers';
import { suggestStakeLot } from '../utils/stakeOperations';
import { stableId } from './stableId';
import { getRawImportValue } from './rawImportValue';
import type { ImportPreview } from './types';

/**
 * Extração dos campos por aba replica EXATAMENTE as regras já em produção em
 * EstacasTab.tsx (`importWorkbook`): mesma ordem/nome de coluna, mesmo regex
 * de perfil, mesma fórmula de sobra. Isso não é redescoberto aqui — é
 * reaproveitado, só embrulhado no formato novo de lineage/lote/dry-run.
 */
const LOTE_ALIASES = {
  data: ['Data'], hora: ['Hora'], movimento: ['Movimento'], notaFiscal: ['NF'],
  materialCodigo: ['Código Material', 'Codigo Material'], descricao: ['Descrição', 'Descricao'],
  tipo: ['Tipo'], comprimentoM: ['Comprimento (m)', 'Comprimento'], unidade: ['Unidade'],
  pesoKg: ['Peso (kg)', 'Peso'], valorUnitario: ['Valor Unitário (R$)', 'Valor Unitario'],
  valorTotal: ['Valor Total (R$)', 'Valor Total'], placaCavalo: ['Cavalo / Placa', 'Cavalo'],
  placaCarreta: ['Carreta / Placa', 'Carreta'], transportadora: ['Transportadora'],
  destino: ['Destino / Obra', 'Destino'], tipoCarregamento: ['Tipo de Carregamento'], status: ['Status'],
};

const CRAVACAO_ALIASES = {
  data: ['Data'], item: ['Item'], servico: ['Serviço', 'Servico'], identificacao: ['Identificação', 'Identificacao'],
  perfil: ['Perfil'], comprimentoM: ['Comprimento (m)', 'Comprimento'],
  comprimentoCravadoM: ['Comprimento cravado (m)', 'Comprimento cravado'],
};

const PERFIL_MODELO_PATTERN = /\bAZ[0-9-]+\b/i;

type ApplicationSkipped = { duplicate: number; review: number; reference: number; other: number };

const emptySkipped = (): ApplicationSkipped => ({ duplicate: 0, review: 0, reference: 0, other: 0 });

const buildLote = (raw: Record<string, unknown>): Omit<LoteEstaca, 'id' | 'criadoEm'> | undefined => {
  const notaFiscal = getImportValue(raw, LOTE_ALIASES.notaFiscal);
  const descricao = getImportValue(raw, LOTE_ALIASES.descricao);
  const comprimentoM = normalizeImportDecimalOrNull(getImportValue(raw, LOTE_ALIASES.comprimentoM));
  // Mesmo gate de EstacasTab.importWorkbook: sem NF, descrição ou comprimento
  // válido, a linha não vira lote — fica em conferência, nunca com zero
  // inventado no comprimento.
  if (!notaFiscal || !descricao || !comprimentoM || comprimentoM <= 0) return undefined;
  return {
    data: normalizeImportDateOrNull(getImportValue(raw, LOTE_ALIASES.data)) || '',
    hora: normalizeImportTimeOrNull(getRawImportValue(raw, LOTE_ALIASES.hora)) || '',
    movimento: (getImportValue(raw, LOTE_ALIASES.movimento) || 'Entrada') as MovimentoEstaca,
    notaFiscal,
    materialCodigo: getImportValue(raw, LOTE_ALIASES.materialCodigo),
    descricao,
    tipo: getImportValue(raw, LOTE_ALIASES.tipo) || 'OUTROS',
    perfilModelo: descricao.match(PERFIL_MODELO_PATTERN)?.[0] || '',
    comprimentoM,
    unidade: getImportValue(raw, LOTE_ALIASES.unidade) || 'UN',
    pesoKg: normalizeImportDecimalOrNull(getImportValue(raw, LOTE_ALIASES.pesoKg)) || 0,
    // Sem coluna de quantidade física nesta planilha: cada linha de
    // Lançamentos é um movimento de uma peça, mesmo default (1) do
    // formulário manual (emptyLot()) quando o campo não é preenchido — não é
    // um número inventado, é o "vazio" já usado pelo próprio app.
    quantidadeFisica: 1,
    valorUnitario: normalizeImportDecimalOrNull(getImportValue(raw, LOTE_ALIASES.valorUnitario)) || 0,
    valorTotal: normalizeImportDecimalOrNull(getImportValue(raw, LOTE_ALIASES.valorTotal)) || 0,
    placaCavalo: getImportValue(raw, LOTE_ALIASES.placaCavalo),
    placaCarreta: getImportValue(raw, LOTE_ALIASES.placaCarreta),
    transportadora: getImportValue(raw, LOTE_ALIASES.transportadora),
    destino: getImportValue(raw, LOTE_ALIASES.destino),
    tipoCarregamento: getImportValue(raw, LOTE_ALIASES.tipoCarregamento) || '',
    status: (getImportValue(raw, LOTE_ALIASES.status) || 'Pendente') as StatusEstaca,
    nfConferida: false,
    divergenciaNF: '',
    responsavel: '',
    observacao: '',
    origem: 'Planilha',
  };
};

const buildCravacao = (raw: Record<string, unknown>): Omit<CravacaoEstaca, 'id' | 'criadoEm' | 'loteId'> | undefined => {
  const identificacao = getImportValue(raw, CRAVACAO_ALIASES.identificacao);
  const comprimentoM = normalizeImportDecimalOrNull(getImportValue(raw, CRAVACAO_ALIASES.comprimentoM));
  // Mesmo gate de EstacasTab.saveDriving/importWorkbook: sem identificação ou
  // comprimento válido, fica em conferência.
  if (!identificacao || !comprimentoM || comprimentoM <= 0) return undefined;
  const comprimentoCravadoM = normalizeImportDecimalOrNull(getImportValue(raw, CRAVACAO_ALIASES.comprimentoCravadoM)) || 0;
  return {
    data: normalizeImportDateOrNull(getImportValue(raw, CRAVACAO_ALIASES.data)) || '',
    item: getImportValue(raw, CRAVACAO_ALIASES.item) || identificacao,
    servico: getImportValue(raw, CRAVACAO_ALIASES.servico) || 'Cravação de estaca prancha',
    identificacao,
    perfil: getImportValue(raw, CRAVACAO_ALIASES.perfil),
    comprimentoM,
    comprimentoCravadoM,
    // perdaM não existe nesta planilha; mesmo default (0) do formulário
    // manual (emptyDriving()) quando a pessoa não informa perda.
    perdaM: 0,
    sobraM: Math.max(0, comprimentoM - comprimentoCravadoM),
    responsavel: '',
    observacao: '',
    origem: 'Planilha',
  };
};

export const buildStakeImportApplication = (
  preview: ImportPreview<unknown>,
  currentControle: ControleEstacas,
  responsible: string,
) => {
  const lotes: LoteEstaca[] = [];
  const cravacoes: CravacaoEstaca[] = [];
  const skipped = emptySkipped();
  const knownLoteIds = new Set(currentControle.lotes.map(item => item.id));
  const knownCravacaoIds = new Set(currentControle.cravacoes.map(item => item.id));

  preview.rows.forEach(item => {
    if (item.disposition !== 'new') {
      if (item.disposition === 'duplicate-in-file' || item.disposition === 'unchanged') skipped.duplicate++;
      else if (item.disposition === 'review') skipped.review++;
      else skipped.other++;
      return;
    }
    const sheet = normalizeComparable(item.row.lineage.sourceSheet);
    const raw = item.row.rawRow || {};
    const note = `Importado de ${preview.sourceFile} · ${item.row.lineage.sourceSheet} · linha ${item.row.lineage.sourceRow} · lote ${preview.batchId}`;

    if (sheet.includes('lancamento')) {
      const draft = buildLote(raw);
      if (!draft) { skipped.review++; return; }
      const id = stableId('lote-import', `${preview.sourceHash}-${item.row.lineage.sourceSheet}-${item.row.lineage.sourceRow}`);
      if (knownLoteIds.has(id)) return;
      knownLoteIds.add(id);
      lotes.push({ ...draft, id, responsavel: responsible, observacao: note, criadoEm: preview.generatedAt });
      return;
    }
    if (sheet.includes('cravac')) {
      const draft = buildCravacao(raw);
      if (!draft) { skipped.review++; return; }
      const id = stableId('cravacao-import', `${preview.sourceHash}-${item.row.lineage.sourceSheet}-${item.row.lineage.sourceRow}`);
      if (knownCravacaoIds.has(id)) return;
      knownCravacaoIds.add(id);
      const loteId = suggestStakeLot(draft, { lotes: [...lotes, ...currentControle.lotes], cravacoes: [...cravacoes, ...currentControle.cravacoes] })?.id;
      cravacoes.push({ ...draft, id, loteId, responsavel: responsible, observacao: note, criadoEm: preview.generatedAt });
      return;
    }
    // Aba reconhecida pelo stakesAdapter (Cadastro Materiais, Veículos,
    // Listas, Conferência, Resumo) mas que não corresponde a lote nem
    // cravação: não é erro, não é duplicata — é só catálogo/referência, sem
    // registro próprio neste domínio.
    skipped.reference++;
  });

  return { lotes, cravacoes, skipped };
};
