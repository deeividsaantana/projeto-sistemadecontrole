import type { Comboio, Empresa, Equipamento } from '../types';
import { normalizeConvoyCode } from './fuelMacroForm';

export interface FuelEquipmentRegistryRow {
  frota?: unknown;
  equipamento?: unknown;
  familia?: unknown;
  empresa?: unknown;
  status?: unknown;
  mobilizado?: unknown;
  dataMob?: unknown;
  dataDesmob?: unknown;
  metaDispMec?: unknown;
}

export interface FuelLaunchRegistryRow {
  prefixo?: unknown;
  descricao?: unknown;
  empresa?: unknown;
  comboio?: unknown;
}

export interface FuelImportedMasterData {
  empresas: Empresa[];
  equipamentos: Equipamento[];
  comboios: Comboio[];
}

const normalizeText = (value: unknown) => String(value ?? '').trim();

export const normalizeFuelMasterKey = (value: unknown) => normalizeText(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const idPart = (value: unknown, fallback: string) => normalizeFuelMasterKey(value) || fallback;

const isUnknownText = (value: unknown) => {
  const normalized = normalizeFuelMasterKey(value);
  return !normalized || normalized === 'naocadastrado' || normalized === 'semcadastro';
};

const titleCompany = (value: unknown) => {
  const text = normalizeText(value);
  if (!text) return '';
  const normalized = normalizeFuelMasterKey(text);
  if (normalized === 'renea') return 'RENEA INFRAESTRUTURA S.A.';
  return text.replace(/\s+/g, ' ');
};

const importedCompany = (nome: string, nowIso: string): Empresa => {
  const isRenea = normalizeFuelMasterKey(nome).startsWith('renea');
  return {
    id: `emp-fuel-${idPart(nome, 'empresa')}`,
    nome,
    cnpj: '',
    telefone: '',
    responsavel: '',
    tipos: isRenea ? ['EMPRESA'] : ['FORNECEDOR', 'LOCACAO_EQUIPAMENTOS'],
    status: 'ATIVO',
    criadoEm: nowIso,
    atualizadoEm: nowIso,
  };
};

const fleetStatus = (status: unknown, mobilizado: unknown): Equipamento['status'] => {
  const normalizedStatus = normalizeFuelMasterKey(status);
  if (normalizedStatus.includes('desmobil')) return 'Desmobilizado';
  if (normalizedStatus.includes('manut')) return 'Manutenção';
  if (normalizedStatus.includes('parad')) return 'Parado';
  if (normalizedStatus.includes('mobiliz')) return 'Mobilizado';
  const normalizedMobilized = normalizeFuelMasterKey(mobilizado);
  if (['false', 'nao', 'no', '0'].includes(normalizedMobilized)) return 'Desmobilizado';
  return 'Ativo';
};

const inferFleetCategory = (prefixo: string, familia: string): Equipamento['categoriaFrota'] => {
  const normalized = normalizeFuelMasterKey(`${prefixo} ${familia}`);
  if (/^(cb|cm|ct|ca|cp)/.test(prefixo.toLowerCase()) || normalized.includes('caminhao') || normalized.includes('veiculo')) return 'Veículo';
  if (normalized.includes('implemento') || normalized.includes('prancha') || normalized.includes('carreta')) return 'Implemento';
  return 'Equipamento';
};

const importedEquipment = ({
  prefixo,
  nome,
  familia,
  empresaId,
  status,
  mobilizado,
  metaDisponibilidade,
  dataMobilizacao,
  dataDesmobilizacao,
  nowIso,
}: {
  prefixo: string;
  nome: string;
  familia: string;
  empresaId: string;
  status?: unknown;
  mobilizado?: unknown;
  metaDisponibilidade?: unknown;
  dataMobilizacao?: unknown;
  dataDesmobilizacao?: unknown;
  nowIso: string;
}): Equipamento => ({
  id: `eq-fuel-${idPart(prefixo, 'equipamento')}`,
  prefixo,
  nome,
  tipo: familia || nome,
  marca: '',
  modelo: '',
  seriePlaca: '',
  empresaId,
  status: fleetStatus(status, mobilizado),
  localAtualId: '',
  observacao: 'Cadastro importado da macro de fornecimento de diesel.',
  categoriaFrota: inferFleetCategory(prefixo, familia),
  familia: familia || undefined,
  mobilizado: !['Desmobilizado'].includes(fleetStatus(status, mobilizado)),
  metaDisponibilidade: Number(metaDisponibilidade) || undefined,
  dataMobilizacao: normalizeText(dataMobilizacao) || undefined,
  dataDesmobilizacao: normalizeText(dataDesmobilizacao) || undefined,
  atualizadoEm: nowIso,
});

const importedConvoy = (code: string): Comboio => ({
  id: `comboio-fuel-${idPart(code, 'comboio')}`,
  nome: `Comboio ${code}`,
  placa: code,
  capacidadeLitros: 0,
  responsavel: '',
});

const upsertByKey = <T,>(items: T[], item: T, keyOf: (value: T) => string) => {
  const key = keyOf(item);
  const index = items.findIndex(current => keyOf(current) === key);
  if (index >= 0) items[index] = { ...items[index], ...item };
  else items.push(item);
};

export const buildFuelImportedMasterData = ({
  equipmentRows,
  launchRows,
  nowIso,
}: {
  equipmentRows: readonly FuelEquipmentRegistryRow[];
  launchRows: readonly FuelLaunchRegistryRow[];
  nowIso: string;
}): FuelImportedMasterData => {
  const empresas: Empresa[] = [];
  const equipamentos: Equipamento[] = [];
  const comboios: Comboio[] = [];
  const ensureEmpresa = (raw: unknown) => {
    const nome = titleCompany(raw);
    if (!nome || isUnknownText(nome)) return '';
    const empresa = importedCompany(nome, nowIso);
    upsertByKey(empresas, empresa, item => normalizeFuelMasterKey(item.nome));
    return empresa.id;
  };

  for (const row of equipmentRows) {
    const prefixo = normalizeText(row.frota).toUpperCase();
    if (!prefixo || isUnknownText(prefixo)) continue;
    const nome = normalizeText(row.equipamento);
    const familia = normalizeText(row.familia);
    const empresaId = ensureEmpresa(row.empresa);
    if (!empresaId) continue;
    upsertByKey(equipamentos, importedEquipment({
      prefixo,
      nome: nome && !isUnknownText(nome) ? nome : prefixo,
      familia: familia && !isUnknownText(familia) ? familia : '',
      empresaId,
      status: row.status,
      mobilizado: row.mobilizado,
      metaDisponibilidade: row.metaDispMec,
      dataMobilizacao: row.dataMob,
      dataDesmobilizacao: row.dataDesmob,
      nowIso,
    }), item => normalizeFuelMasterKey(item.prefixo));
  }

  for (const row of launchRows) {
    const companyId = ensureEmpresa(row.empresa);
    const prefixo = normalizeText(row.prefixo).toUpperCase();
    const descricao = normalizeText(row.descricao);
    if (prefixo && !isUnknownText(prefixo) && companyId && !equipamentos.some(item => normalizeFuelMasterKey(item.prefixo) === normalizeFuelMasterKey(prefixo))) {
      upsertByKey(equipamentos, importedEquipment({
        prefixo,
        nome: descricao && !isUnknownText(descricao) ? descricao : prefixo,
        familia: descricao && !isUnknownText(descricao) ? descricao : '',
        empresaId: companyId,
        status: 'Ativo',
        mobilizado: 'true',
        nowIso,
      }), item => normalizeFuelMasterKey(item.prefixo));
    }

    const comboioCode = normalizeConvoyCode(normalizeText(row.comboio));
    if (comboioCode) upsertByKey(comboios, importedConvoy(comboioCode), item => normalizeConvoyCode(item.placa || item.nome));
  }

  return { empresas, equipamentos, comboios };
};
