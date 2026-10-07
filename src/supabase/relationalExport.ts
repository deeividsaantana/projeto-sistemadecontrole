import type {
  Abastecimento,
  Empresa,
  Equipamento,
  Funcionario,
  Material,
  MovimentoMaterial,
  ObraLocal,
} from '../types';

type SnapshotArrayKey =
  | 'empresas'
  | 'obras'
  | 'equipamentos'
  | 'funcionarios'
  | 'materiaisCadastro'
  | 'materiaisMovimentos'
  | 'abastecimentos';

type SnapshotWithArrays = Partial<Record<SnapshotArrayKey, unknown>>;

export interface SupabaseRelationalExportInput {
  organizationId: string;
  snapshot: SnapshotWithArrays;
}

export interface SupabaseExportRow {
  legacy_id: string;
  organization_id: string;
  payload: Record<string, unknown>;
}

export interface SupabaseEmpresaRow extends SupabaseExportRow {
  nome: string;
  cnpj: string;
  telefone: string;
  responsavel: string;
  tipos: string[];
  status: string;
}

export interface SupabaseObraRow extends SupabaseExportRow {
  nome: string;
  endereco: string;
  responsavel: string;
  status: string;
}

export interface SupabaseEquipamentoRow extends SupabaseExportRow {
  prefixo: string;
  nome: string;
  tipo: string;
  empresa_legacy_id: string;
  obra_legacy_id: string;
  status: string;
}

export interface SupabaseFuncionarioRow extends SupabaseExportRow {
  matricula: string;
  nome: string;
  cargo: string;
  empresa_legacy_id: string;
  status: string;
}

export interface SupabaseMaterialRow extends SupabaseExportRow {
  codigo: string;
  descricao: string;
  categoria: string;
  unidade: string;
  fornecedor_legacy_id: string;
  ativo: boolean;
}

export interface SupabaseMovimentoMaterialRow extends SupabaseExportRow {
  data: string;
  tipo: string;
  material_legacy_id: string;
  obra_legacy_id: string;
  fornecedor_legacy_id: string;
  quantidade: number;
  unidade: string;
}

export interface SupabaseAbastecimentoRow extends SupabaseExportRow {
  data: string;
  hora: string;
  equipamento_legacy_id: string;
  quantidade_litros: number;
  tipo_combustivel_legacy_id: string;
  comboio_legacy_id: string;
}

export interface SupabaseRelationalExport {
  empresas: SupabaseEmpresaRow[];
  obras: SupabaseObraRow[];
  equipamentos: SupabaseEquipamentoRow[];
  funcionarios: SupabaseFuncionarioRow[];
  materiais: SupabaseMaterialRow[];
  movimentos_materiais: SupabaseMovimentoMaterialRow[];
  abastecimentos: SupabaseAbastecimentoRow[];
}

export interface SupabaseOrphanReference {
  table: keyof SupabaseRelationalExport;
  legacyId: string;
  field: string;
  referencedTable: keyof SupabaseRelationalExport;
  referencedLegacyId: string;
}

export interface SupabaseRelationalExportSummary {
  totalRows: number;
  tableCounts: Record<keyof SupabaseRelationalExport, number>;
  orphanReferences: SupabaseOrphanReference[];
}

const asArray = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

const asPayload = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' ? { ...value as Record<string, unknown> } : {}
);

const compactText = (value: unknown): string => String(value || '').trim();

const comparableText = (value: unknown): string => compactText(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ');

const toFiniteNumber = (value: unknown): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : 0
);

export const buildSupabaseRelationalExport = ({
  organizationId,
  snapshot,
}: SupabaseRelationalExportInput): SupabaseRelationalExport => {
  const empresas = asArray<Empresa>(snapshot.empresas);
  const empresaIds = new Set(empresas.map(item => item.id));
  const empresaIdByName = new Map(
    empresas
      .map(item => [comparableText(item.nome), item.id] as const)
      .filter(([name]) => name),
  );
  const resolveEmpresaReference = (legacyId: unknown, name?: unknown) => {
    const id = compactText(legacyId);
    if (!id || empresaIds.has(id)) return id;
    return empresaIdByName.get(comparableText(name)) || id;
  };
  const scoped = (item: { id: string }) => ({
    legacy_id: item.id,
    organization_id: organizationId,
    payload: asPayload(item),
  });

  return {
    empresas: empresas.map(item => ({
      ...scoped(item),
      nome: compactText(item.nome),
      cnpj: compactText(item.cnpj),
      telefone: compactText(item.telefone),
      responsavel: compactText(item.responsavel),
      tipos: Array.isArray(item.tipos) ? item.tipos : ['EMPRESA'],
      status: item.status || 'ATIVO',
    })),
    obras: asArray<ObraLocal>(snapshot.obras).map(item => ({
      ...scoped(item),
      nome: compactText(item.nome),
      endereco: compactText(item.endereco),
      responsavel: compactText(item.responsavel),
      status: item.status,
    })),
    equipamentos: asArray<Equipamento>(snapshot.equipamentos).map(item => ({
      ...scoped(item),
      prefixo: compactText(item.prefixo),
      nome: compactText(item.nome),
      tipo: compactText(item.tipo),
      empresa_legacy_id: compactText(item.empresaId),
      obra_legacy_id: compactText(item.localAtualId),
      status: item.status,
    })),
    funcionarios: asArray<Funcionario>(snapshot.funcionarios).map(item => ({
      ...scoped(item),
      matricula: compactText(item.matricula),
      nome: compactText(item.nome),
      cargo: compactText(item.cargo),
      empresa_legacy_id: compactText(item.empresaId),
      status: item.status || (item.ativo ? 'ATIVO' : 'INATIVO'),
    })),
    materiais: asArray<Material>(snapshot.materiaisCadastro).map(item => ({
      ...scoped(item),
      codigo: compactText(item.codigo),
      descricao: compactText(item.descricao),
      categoria: compactText(item.categoria),
      unidade: compactText(item.unidade),
      fornecedor_legacy_id: resolveEmpresaReference(item.fornecedorPadraoId),
      ativo: item.ativo !== false,
    })),
    movimentos_materiais: asArray<MovimentoMaterial>(snapshot.materiaisMovimentos).map(item => ({
      ...scoped(item),
      data: compactText(item.data),
      tipo: item.tipo,
      material_legacy_id: compactText(item.materialId),
      obra_legacy_id: compactText(item.obraId),
      fornecedor_legacy_id: resolveEmpresaReference(item.fornecedorId, item.fornecedorNome),
      quantidade: toFiniteNumber(item.quantidade),
      unidade: compactText(item.unidade),
    })),
    abastecimentos: asArray<Abastecimento>(snapshot.abastecimentos).map(item => ({
      ...scoped(item),
      data: compactText(item.data),
      hora: compactText(item.hora),
      equipamento_legacy_id: compactText(item.equipamentoId),
      quantidade_litros: toFiniteNumber(item.quantidadeLitros),
      tipo_combustivel_legacy_id: compactText(item.tipoCombustivelId),
      comboio_legacy_id: compactText(item.comboioId),
    })),
  };
};

const hasLegacyId = (
  exported: SupabaseRelationalExport,
  table: keyof SupabaseRelationalExport,
  legacyId: string,
) => legacyId ? exported[table].some(row => row.legacy_id === legacyId) : true;

const addOrphan = (
  orphans: SupabaseOrphanReference[],
  exported: SupabaseRelationalExport,
  table: keyof SupabaseRelationalExport,
  legacyId: string,
  field: string,
  referencedTable: keyof SupabaseRelationalExport,
  referencedLegacyId: string,
) => {
  if (referencedLegacyId && !hasLegacyId(exported, referencedTable, referencedLegacyId)) {
    orphans.push({ table, legacyId, field, referencedTable, referencedLegacyId });
  }
};

export const summarizeSupabaseRelationalExport = (
  exported: SupabaseRelationalExport,
): SupabaseRelationalExportSummary => {
  const tableCounts = Object.fromEntries(
    Object.entries(exported).map(([table, rows]) => [table, rows.length]),
  ) as Record<keyof SupabaseRelationalExport, number>;
  const orphanReferences: SupabaseOrphanReference[] = [];

  exported.equipamentos.forEach(row => {
    addOrphan(orphanReferences, exported, 'equipamentos', row.legacy_id, 'empresa_legacy_id', 'empresas', row.empresa_legacy_id);
    addOrphan(orphanReferences, exported, 'equipamentos', row.legacy_id, 'obra_legacy_id', 'obras', row.obra_legacy_id);
  });
  exported.funcionarios.forEach(row => {
    addOrphan(orphanReferences, exported, 'funcionarios', row.legacy_id, 'empresa_legacy_id', 'empresas', row.empresa_legacy_id);
  });
  exported.materiais.forEach(row => {
    addOrphan(orphanReferences, exported, 'materiais', row.legacy_id, 'fornecedor_legacy_id', 'empresas', row.fornecedor_legacy_id);
  });
  exported.movimentos_materiais.forEach(row => {
    addOrphan(orphanReferences, exported, 'movimentos_materiais', row.legacy_id, 'material_legacy_id', 'materiais', row.material_legacy_id);
    addOrphan(orphanReferences, exported, 'movimentos_materiais', row.legacy_id, 'obra_legacy_id', 'obras', row.obra_legacy_id);
    addOrphan(orphanReferences, exported, 'movimentos_materiais', row.legacy_id, 'fornecedor_legacy_id', 'empresas', row.fornecedor_legacy_id);
  });
  exported.abastecimentos.forEach(row => {
    addOrphan(orphanReferences, exported, 'abastecimentos', row.legacy_id, 'equipamento_legacy_id', 'equipamentos', row.equipamento_legacy_id);
  });

  return {
    totalRows: Object.values(tableCounts).reduce((total, count) => total + count, 0),
    tableCounts,
    orphanReferences,
  };
};
