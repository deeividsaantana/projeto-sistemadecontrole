import type { Material, MovimentoMaterial } from '../types';
import { normalizeComparable } from '../utils/canonicalIdentity';
import type { ImportPreview } from './types';
import { stableId } from './stableId';

type Receipt = {
  data: string | null; material: string | null; especificacao?: string | null; codigo?: string | null;
  quantidadeNota?: number | null; quantidadeRecebida: number | null; unidade: string | null; notaFiscal: string | null;
  localAplicacao?: string | null; solicitacaoCompra?: string | null; diametroMm?: number | null; classe?: string | null; comprimentoPecaM?: number | null;
};
type Movement = {
  material: string; data: string | null; tipoMovimento?: string | null; origem?: string | null; destino: string | null; quantidade: number | null; unidade: string | null;
  placaOuPrefixo?: string | null; fornecedor?: string | null; notaFiscal?: string | null; valorUnitario?: number | null; valorTotal?: number | null;
};

/**
 * "Saída", "SAIDA", "saída de material": a planilha escreve do jeito dela.
 * Comparar com 'saida' cru fazia toda saída virar entrada.
 */
export const movementTypeFromSheet = (value: string | null | undefined): MovimentoMaterial['tipo'] => {
  const text = normalizeComparable(value);
  if (text.startsWith('said')) return 'Saída';
  if (text.startsWith('transf')) return 'Transferência';
  if (text.startsWith('ajust')) return 'Ajuste';
  return 'Entrada';
};

const pieceLabel = (meters: number) => `${meters.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;

/**
 * Tubo de concreto de 800 e de 1200 não é o mesmo material: o nome carrega
 * diâmetro, classe e peça para o saldo e o uso não misturarem bitolas.
 */
export const receiptMaterialDescription = (value: Receipt) => {
  const base = value.material || '';
  // Tubo de concreto com diâmetro vira sempre o mesmo nome. A especificação
  // da nota muda de fornecedor para fornecedor ("T.CONCR.ARM.PB800x1500-PA4")
  // e, se entrasse no nome, o mesmo tubo viraria vários materiais.
  if (value.diametroMm && normalizeComparable(base).startsWith('tubo de concreto')) {
    return ['TUBO DE CONCRETO', `Ø${value.diametroMm}`, value.classe || '', value.comprimentoPecaM ? pieceLabel(value.comprimentoPecaM) : '']
      .filter(Boolean).join(' ');
  }
  const parts = [base];
  if (value.especificacao && normalizeComparable(value.especificacao) !== normalizeComparable(base)) parts.push(value.especificacao);
  const text = normalizeComparable(parts.join(' '));
  const extras = [
    value.diametroMm && !text.includes(`ø${value.diametroMm}`) ? `Ø${value.diametroMm}` : '',
    value.classe && !text.includes(normalizeComparable(value.classe)) ? value.classe : '',
    value.comprimentoPecaM ? pieceLabel(value.comprimentoPecaM) : '',
  ].filter(Boolean).join(' ');
  return [parts.filter(Boolean).join(' · '), extras].filter(Boolean).join(' ');
};

export const buildMaterialImportApplication = (
  preview: ImportPreview<unknown>,
  currentMaterials: readonly Material[],
  currentMovements: readonly MovimentoMaterial[],
  responsible: string,
  branches: ReadonlyArray<{ id: string; nome: string }> = [],
) => {
  const materials: Material[] = [], movements: MovimentoMaterial[] = [];
  const skipped = { duplicate: 0, review: 0, other: 0 };
  const knownIds = new Set(currentMovements.map(item => item.id));
  preview.rows.forEach(item => {
    if (item.disposition !== 'new') {
      if (item.disposition === 'duplicate-in-file' || item.disposition === 'unchanged') skipped.duplicate++;
      else if (item.disposition === 'review') skipped.review++;
      else skipped.other++;
      return;
    }
    const value = item.row.value as Receipt | Movement;
    const receipt = 'quantidadeRecebida' in value;
    const description = receipt ? receiptMaterialDescription(value) : value.material;
    const quantity = receipt ? value.quantidadeRecebida : value.quantidade;
    if (!description || !value.data || quantity === null || !value.unidade || !item.row.operationalKey) { skipped.review++; return; }
    // "LIXO" em tonelada (Lara) e "LIXO" em viagem (São Bento) não somam: com
    // unidade diferente do material já existente, o nome leva a unidade.
    const sameName = [...currentMaterials, ...materials].find(entry => normalizeComparable(entry.descricao) === normalizeComparable(description));
    const name = !receipt && sameName && normalizeComparable(sameName.unidade) !== normalizeComparable(value.unidade)
      ? `${description} (${value.unidade})`
      : description;
    const key = normalizeComparable(name);
    let material = [...currentMaterials, ...materials].find(entry => normalizeComparable(entry.descricao) === key);
    if (!material) {
      material = {
        id: stableId('mat-import', key), codigo: receipt ? value.codigo || '' : '', descricao: name, categoria: item.row.lineage.sourceSheet, unidade: value.unidade,
        ...(receipt && value.diametroMm ? { diametroMm: value.diametroMm } : {}),
        ...(receipt && value.classe ? { classe: value.classe } : {}),
        ...(receipt && value.comprimentoPecaM ? { comprimentoPecaM: value.comprimentoPecaM } : {}),
        ativo: true, criadoEm: preview.generatedAt, atualizadoEm: preview.generatedAt,
      };
      materials.push(material);
    }
    const id = stableId('mov-import', `${preview.sourceHash}-${item.row.lineage.sourceSheet}-${item.row.lineage.sourceRow}`);
    if (knownIds.has(id)) return;
    knownIds.add(id);
    // O ramo só é vinculado quando o local da planilha tem exatamente o nome de
    // um ramo cadastrado; o resto fica como texto para quem confere vincular.
    const local = receipt ? value.localAplicacao || '' : '';
    const branch = local ? branches.find(entry => normalizeComparable(entry.nome) === normalizeComparable(local)) : undefined;
    // Agregado chega com fornecedor, nota, placa e valor da viagem; antes tudo
    // isso ficava só na planilha.
    const trip = receipt ? {} : {
      ...(value.fornecedor ? { fornecedorNome: value.fornecedor } : {}),
      ...(value.placaOuPrefixo ? { placa: value.placaOuPrefixo } : {}),
      ...(value.valorUnitario != null ? { valorUnitario: value.valorUnitario } : {}),
      ...(value.valorTotal != null ? { valorTotal: value.valorTotal } : {}),
    };
    movements.push({ id, data: value.data, tipo: receipt ? 'Entrada' : movementTypeFromSheet(value.tipoMovimento), ...trip,
      ...(branch ? { etapaServicoId: branch.id, etapaServicoNome: branch.nome } : {}),
      ...(receipt && value.solicitacaoCompra ? { solicitacaoCompra: value.solicitacaoCompra } : {}),
      materialId: material.id, materialDescricao: material.descricao, quantidade: quantity, unidade: value.unidade, quantidadeNota: receipt ? value.quantidadeNota ?? undefined : undefined, notaFiscal: value.notaFiscal || undefined, destino: receipt ? value.localAplicacao || undefined : value.destino || undefined, origem: receipt ? undefined : value.origem || undefined, responsavel: responsible, criadoEm: preview.generatedAt, observacao: `Importado de ${preview.sourceFile} · ${item.row.lineage.sourceSheet} · linha ${item.row.lineage.sourceRow}` });
  });
  return { materials, movements, skipped };
};
