import type {
  Empresa,
  Equipamento,
  Funcionario,
  ObraLocal,
} from '../types';
import { normalizeAvailabilityTarget } from '../utils/equipmentOperations';
import {
  normalizeMasterText,
  type MasterWorkbookAnalysis,
  type MasterWorkbookReviewRow,
} from './masterWorkbook';

export interface MasterDataCollections {
  empresas: Empresa[];
  obras: ObraLocal[];
  funcionarios: Funcionario[];
  equipamentos: Equipamento[];
}

export interface MasterDataPromotionCount {
  created: number;
  updated: number;
  preservedForReview: number;
}

export interface MasterDataPromotionResult extends MasterDataCollections {
  counts: Record<string, MasterDataPromotionCount>;
  reviewRows: MasterWorkbookReviewRow[];
}

const newCount = (): MasterDataPromotionCount => ({
  created: 0,
  updated: 0,
  preservedForReview: 0,
});

const text = (value: unknown) => String(value ?? '').trim();

const optionalNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const optionalDate = (value: unknown) => {
  const raw = text(value);
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const brazilian = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brazilian) return `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}`;
  const serial = Number(raw);
  if (Number.isFinite(serial) && serial > 20_000) {
    return new Date(Date.UTC(1899, 11, 30 + serial)).toISOString().slice(0, 10);
  }
  return undefined;
};

const deterministicId = (entity: string, row: MasterWorkbookReviewRow) => {
  const legacyId = text(row.normalized.legacy_id);
  if (legacyId) return `master-${entity}-${normalizeMasterText(legacyId).replace(/\s+/g, '-')}`;
  const suffix = row.canonicalKey.replace(/\s+/g, '-').slice(0, 80) || `${row.sheetName}-${row.rowNumber}`;
  return `master-${entity}-${suffix}`;
};

const appendReviewIssue = (row: MasterWorkbookReviewRow, issue: string): MasterWorkbookReviewRow => ({
  ...row,
  issues: [...row.issues, issue],
  reviewNote: [...row.issues, issue].join(' '),
});

const findCandidate = <T extends { id: string }>(items: T[], row: MasterWorkbookReviewRow) => (
  items.find(item => row.candidateRecordIds.includes(item.id))
);

const companyByName = (empresas: Empresa[], value: unknown) => {
  const key = normalizeMasterText(value);
  return key ? empresas.find(item => normalizeMasterText(item.nome) === key) : undefined;
};

const employeeByName = (funcionarios: Funcionario[], value: unknown) => {
  const key = normalizeMasterText(value);
  return key ? funcionarios.find(item => normalizeMasterText(item.nome) === key) : undefined;
};

const equipmentStatus = (row: MasterWorkbookReviewRow): Equipamento['status'] => {
  const source = normalizeMasterText(row.normalized.status);
  if (source.includes('desmobil')) return 'Desmobilizado';
  if (source.includes('manut')) return 'Manutenção';
  if (source.includes('parado')) return 'Parado';
  if (source.includes('esperando') || source.includes('motorista')) return 'Esperando motorista';
  if (source.includes('mobilizado')) return 'Mobilizado';
  return 'Ativo';
};

const upsertById = <T extends { id: string }>(items: T[], value: T, existing: T | undefined) => {
  if (!existing) return [...items, value];
  return items.map(item => item.id === existing.id ? value : item);
};

const promotionPriority: Record<MasterWorkbookReviewRow['entity'], number> = {
  companies: 1,
  locations: 2,
  collaborators: 3,
  equipment: 4,
  vehicles: 5,
  suppliers: 6,
};

export const promoteMasterWorkbook = (
  analysis: MasterWorkbookAnalysis,
  current: MasterDataCollections,
): MasterDataPromotionResult => {
  let empresas = [...current.empresas];
  let obras = [...current.obras];
  let funcionarios = [...current.funcionarios];
  let equipamentos = [...current.equipamentos];
  const reviewRows: MasterWorkbookReviewRow[] = [];
  const counts: Record<string, MasterDataPromotionCount> = {};
  const countFor = (entity: string) => {
    counts[entity] ||= newCount();
    return counts[entity];
  };

  const applicableRows = analysis.rows
    .filter(row => {
      if (row.status === 'invalid' || row.status === 'duplicate') {
        reviewRows.push(row);
        countFor(row.entity).preservedForReview += 1;
        return false;
      }
      return true;
    })
    .sort((first, second) => promotionPriority[first.entity] - promotionPriority[second.entity]);

  for (const row of applicableRows) {
    const normalized = row.normalized;
    const count = countFor(row.entity);

    if (row.entity === 'companies') {
      const existing = findCandidate(empresas, row)
        || empresas.find(item => normalizeMasterText(item.nome) === normalizeMasterText(normalized.name));
      const importedCompanyTypes = text(normalized.company_type_text)
        .split(',')
        .map(item => item.trim().toUpperCase())
        .filter((item): item is NonNullable<Empresa['tipos']>[number] => (
          ['EMPRESA', 'FORNECEDOR', 'GERADOR', 'ACEITANTE', 'TRANSPORTADORA'].includes(item)
        ));
      const value: Empresa = {
        id: existing?.id || deterministicId('empresa', row),
        nome: text(normalized.name),
        cnpj: text(normalized.tax_id) || existing?.cnpj || '',
        telefone: existing?.telefone || '',
        responsavel: existing?.responsavel || '',
        tipos: existing?.tipos || (importedCompanyTypes.length > 0 ? importedCompanyTypes : ['EMPRESA']),
        status: normalized.active === false ? 'INATIVO' : 'ATIVO',
        criadoEm: existing?.criadoEm || new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };
      empresas = upsertById(empresas, value, existing);
      existing ? count.updated += 1 : count.created += 1;
      continue;
    }

    if (row.entity === 'suppliers') {
      const supplierName = text(normalized.company_name);
      const existing = findCandidate(empresas, row)
        || empresas.find(item => normalizeMasterText(item.nome) === normalizeMasterText(supplierName));
      const now = new Date().toISOString();
      const value: Empresa = {
        id: existing?.id || deterministicId('fornecedor', row),
        nome: supplierName,
        cnpj: text(normalized.tax_id) || existing?.cnpj || '',
        telefone: existing?.telefone || '',
        responsavel: existing?.responsavel || '',
        tipos: Array.from(new Set([...(existing?.tipos || []), 'FORNECEDOR' as const])),
        status: normalized.active === false ? 'INATIVO' : 'ATIVO',
        criadoEm: existing?.criadoEm || now,
        atualizadoEm: now,
      };
      empresas = upsertById(empresas, value, existing);
      existing ? count.updated += 1 : count.created += 1;
      continue;
    }

    if (row.entity === 'locations') {
      const existing = findCandidate(obras, row)
        || obras.find(item => normalizeMasterText(item.nome) === normalizeMasterText(normalized.name));
      const value: ObraLocal = {
        id: existing?.id || deterministicId('local', row),
        nome: text(normalized.name),
        endereco: existing?.endereco || '',
        responsavel: existing?.responsavel || '',
        status: normalized.active === false ? 'Concluída' : 'Ativa',
      };
      obras = upsertById(obras, value, existing);
      existing ? count.updated += 1 : count.created += 1;
      continue;
    }

    if (row.entity === 'collaborators') {
      const existing = findCandidate(funcionarios, row)
        || funcionarios.find(item => (
          normalizeMasterText(item.matricula) === normalizeMasterText(normalized.registration)
          || normalizeMasterText(item.nome) === normalizeMasterText(normalized.name)
        ));
      const companyName = text(normalized.company_name);
      const company = companyByName(empresas, companyName);
      const value: Funcionario = {
        id: existing?.id || deterministicId('colaborador', row),
        matricula: text(normalized.registration) || existing?.matricula,
        nome: text(normalized.name),
        cargo: text(normalized.job_title) || existing?.cargo || '',
        telefone: existing?.telefone || '',
        empresaId: company?.id || existing?.empresaId || '',
        ativo: normalized.active !== false,
        liderMatricula: text(normalized.leader_registration) || existing?.liderMatricula,
        liderNome: text(normalized.leader_name) || existing?.liderNome,
        area: text(normalized.area) || existing?.area,
        responsavelArea: text(normalized.area_responsible) || existing?.responsavelArea,
        divisao: text((normalized.metadata as Record<string, unknown> | undefined)?.division) || existing?.divisao,
        secao: text((normalized.metadata as Record<string, unknown> | undefined)?.section) || existing?.secao,
        status: normalized.active === false ? 'INATIVO' : existing?.status || 'ATIVO',
        dataMobilizacao: optionalDate((normalized.metadata as Record<string, unknown> | undefined)?.mobilizationDate) || existing?.dataMobilizacao,
        dataDesmobilizacao: optionalDate((normalized.metadata as Record<string, unknown> | undefined)?.demobilizationDate) || existing?.dataDesmobilizacao,
        situacaoRh: text((normalized.metadata as Record<string, unknown> | undefined)?.hrStatus) || existing?.situacaoRh,
        observacao: text((normalized.metadata as Record<string, unknown> | undefined)?.notes) || existing?.observacao,
        criadoEm: existing?.criadoEm || new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };
      funcionarios = upsertById(funcionarios, value, existing);
      existing ? count.updated += 1 : count.created += 1;
      if (companyName && !company) {
        reviewRows.push(appendReviewIssue(row, `Empresa "${companyName}" ainda não foi localizada para vínculo do colaborador.`));
        count.preservedForReview += 1;
      }
      continue;
    }

    if (row.entity === 'equipment' || row.entity === 'vehicles') {
      const prefix = text(normalized.prefix);
      const existing = findCandidate(equipamentos, row)
        || equipamentos.find(item => normalizeMasterText(item.prefixo) === normalizeMasterText(prefix));
      const metadata = normalized.metadata as Record<string, unknown> | undefined;
      const companyName = text(metadata?.companyName);
      const company = companyByName(empresas, companyName);
      const operatorName = text(normalized.responsible_operator_name);
      const operator = employeeByName(funcionarios, operatorName);
      const fleetKind = text(normalized.fleet_kind);
      const value: Equipamento = {
        id: existing?.id || deterministicId('equipamento', row),
        prefixo: prefix,
        nome: text(normalized.name) || existing?.nome || prefix,
        tipo: text(normalized.equipment_type) || text(normalized.vehicle_type) || existing?.tipo || text(normalized.family),
        marca: existing?.marca || '',
        modelo: existing?.modelo || '',
        seriePlaca: text(normalized.license_plate) || existing?.seriePlaca || '',
        placa: text(normalized.license_plate) || existing?.placa,
        empresaId: company?.id || existing?.empresaId || '',
        status: equipmentStatus(row),
        localAtualId: existing?.localAtualId || obras[0]?.id || '',
        observacao: existing?.observacao || '',
        foto: existing?.foto,
        horasDisponiveis: existing?.horasDisponiveis,
        horasIndisponiveis: existing?.horasIndisponiveis,
        categoriaFrota: row.entity === 'vehicles' || fleetKind === 'vehicle'
          ? 'Veículo'
          : fleetKind === 'implement'
            ? 'Implemento'
            : existing?.categoriaFrota || 'Equipamento',
        codigoSge: text(normalized.external_sge_code) || existing?.codigoSge,
        familia: text(normalized.family) || existing?.familia,
        mobilizado: typeof normalized.mobilized === 'boolean' ? normalized.mobilized : existing?.mobilizado,
        metaDisponibilidade: normalizeAvailabilityTarget(normalized.availability_target)
          ?? existing?.metaDisponibilidade,
        dataMobilizacao: optionalDate(normalized.mobilized_at) || existing?.dataMobilizacao,
        dataDesmobilizacao: optionalDate(normalized.demobilized_at) || existing?.dataDesmobilizacao,
        operadorResponsavelId: operator?.id || existing?.operadorResponsavelId,
        operadorResponsavelNome: operatorName || existing?.operadorResponsavelNome,
        combustivelId: existing?.combustivelId,
        capacidadeTanqueLitros: optionalNumber(normalized.tank_capacity_liters) || existing?.capacidadeTanqueLitros,
        equipamentoVinculadoId: existing?.equipamentoVinculadoId,
      };
      equipamentos = upsertById(equipamentos, value, existing);
      existing ? count.updated += 1 : count.created += 1;
      if (companyName && !company) {
        reviewRows.push(appendReviewIssue(row, `Empresa "${companyName}" ainda não foi localizada para vínculo do equipamento.`));
        count.preservedForReview += 1;
      }
      if (operatorName && !operator) {
        reviewRows.push(appendReviewIssue(row, `Motorista ou operador "${operatorName}" não foi localizado no cadastro de colaboradores.`));
        count.preservedForReview += 1;
      }
    }
  }

  return {
    empresas,
    obras,
    funcionarios,
    equipamentos,
    counts,
    reviewRows,
  };
};
