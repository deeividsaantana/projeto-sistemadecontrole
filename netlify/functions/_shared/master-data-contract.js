const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = new Set(['admin', 'gestor', 'operador', 'leitura']);

const text = (maxLength = 200) => ({ type: 'text', maxLength });
const number = (minimum = null, maximum = null) => ({ type: 'number', minimum, maximum });
const uuid = () => ({ type: 'uuid' });
const boolean = () => ({ type: 'boolean' });
const email = () => ({ type: 'email', maxLength: 320 });
const metadata = () => ({ type: 'metadata' });
const oneOf = values => ({ type: 'enum', values });

const commonFields = {
  legacy_id: text(160),
  code: text(80),
  active: boolean(),
  metadata: metadata(),
};

export const MASTER_DATA_ENTITIES = Object.freeze({
  companies: {
    table: 'companies',
    label: 'Empresas',
    required: ['name'],
    searchColumns: ['name', 'legal_name', 'tax_id', 'code'],
    fields: {
      ...commonFields,
      name: text(200),
      legal_name: text(240),
      tax_id: text(32),
      phone: text(40),
      responsible_name: text(200),
      company_type: oneOf(['owner', 'contractor', 'supplier', 'customer', 'other']),
    },
  },
  locations: {
    table: 'locations',
    label: 'Obras e locais',
    required: ['name'],
    searchColumns: ['name', 'address', 'responsible_name', 'code'],
    fields: {
      ...commonFields,
      name: text(200),
      address: text(500),
      responsible_name: text(200),
      status: text(80),
    },
  },
  work_branches: {
    table: 'work_branches',
    label: 'Ramos',
    required: ['name'],
    searchColumns: ['name', 'description', 'code'],
    fields: {
      ...commonFields,
      location_id: uuid(),
      name: text(200),
      description: text(1000),
    },
  },
  equipment: {
    table: 'equipment',
    label: 'Equipamentos',
    required: ['prefix', 'name'],
    searchColumns: ['prefix', 'name', 'equipment_type', 'brand', 'model', 'license_plate'],
    fields: {
      ...commonFields,
      company_id: uuid(),
      current_location_id: uuid(),
      prefix: text(80),
      name: text(240),
      equipment_type: text(120),
      brand: text(120),
      model: text(120),
      serial_number: text(120),
      license_plate: text(20),
      status: text(80),
      notes: text(2000),
      photo_url: text(1000),
      available_hours: number(0, 1_000_000),
      unavailable_hours: number(0, 1_000_000),
      fleet_kind: oneOf(['equipment', 'vehicle', 'implement']),
      external_sge_code: text(80),
      family: text(160),
      mobilized: boolean(),
      availability_target: number(0, 1),
      mobilized_at: text(10),
      demobilized_at: text(10),
      responsible_operator_id: uuid(),
      responsible_operator_name: text(240),
      fuel_type_id: uuid(),
      fuel_name: text(120),
      tank_capacity_liters: number(0.000001, 1_000_000),
      linked_equipment_id: uuid(),
    },
  },
  vehicles: {
    table: 'vehicles',
    label: 'Veículos',
    required: ['license_plate', 'name'],
    searchColumns: ['prefix', 'license_plate', 'name', 'vehicle_type', 'brand', 'model'],
    fields: {
      ...commonFields,
      company_id: uuid(),
      current_location_id: uuid(),
      prefix: text(80),
      license_plate: text(20),
      name: text(240),
      vehicle_type: text(120),
      brand: text(120),
      model: text(120),
      status: text(80),
      capacity: number(0.000001, 1_000_000_000),
      capacity_unit: text(40),
      external_sge_code: text(80),
      family: text(160),
      mobilized: boolean(),
      mobilized_at: text(10),
      demobilized_at: text(10),
      responsible_operator_id: uuid(),
      responsible_operator_name: text(240),
      linked_equipment_id: uuid(),
    },
  },
  collaborators: {
    table: 'collaborators',
    label: 'Colaboradores',
    required: ['name'],
    searchColumns: ['registration', 'name', 'job_title', 'area', 'email'],
    fields: {
      ...commonFields,
      company_id: uuid(),
      registration: text(80),
      name: text(240),
      job_title: text(160),
      phone: text(40),
      email: email(),
      leader_registration: text(80),
      leader_name: text(240),
      area: text(160),
      area_responsible: text(240),
    },
  },
  operational_drivers: {
    table: 'operational_drivers',
    label: 'Motoristas operacionais',
    required: ['registration', 'name'],
    searchColumns: ['registration', 'name', 'job_title', 'collaborator_id'],
    fields: {
      ...commonFields,
      collaborator_id: uuid(),
      company_id: uuid(),
      registration: text(80),
      name: text(240),
      job_title: text(160),
      phone: text(40),
    },
  },
  suppliers: {
    table: 'suppliers',
    label: 'Fornecedores',
    required: ['company_id'],
    searchColumns: ['code', 'contact_name', 'email', 'phone'],
    fields: {
      ...commonFields,
      company_id: uuid(),
      contact_name: text(240),
      phone: text(40),
      email: email(),
    },
  },
  materials: {
    table: 'materials',
    label: 'Materiais',
    required: ['name', 'default_unit'],
    searchColumns: ['name', 'category', 'default_unit', 'code'],
    fields: {
      ...commonFields,
      default_supplier_id: uuid(),
      name: text(240),
      category: text(120),
      default_unit: text(40),
      density: number(0.000001, 1_000_000),
      reference_value: number(0, 1_000_000_000),
      status: text(80),
      notes: text(2000),
    },
  },
  convoys: {
    table: 'convoys',
    label: 'Comboios',
    required: ['name', 'capacity_liters'],
    searchColumns: ['name', 'license_plate', 'responsible_name', 'code'],
    fields: {
      ...commonFields,
      responsible_collaborator_id: uuid(),
      name: text(240),
      license_plate: text(20),
      capacity_liters: number(0.000001, 100_000_000),
      responsible_name: text(240),
    },
  },
  fuel_types: {
    table: 'fuel_types',
    label: 'Tipos de combustível',
    required: ['name'],
    searchColumns: ['name', 'code'],
    fields: {
      ...commonFields,
      name: text(160),
    },
  },
  lubricant_products: {
    table: 'lubricant_products',
    label: 'Lubrificantes',
    required: ['name'],
    searchColumns: ['name', 'default_unit', 'code'],
    fields: {
      ...commonFields,
      name: text(160),
      default_unit: text(40),
    },
  },
  service_stages: {
    table: 'service_stages',
    label: 'Etapas de serviço',
    required: ['name'],
    searchColumns: ['name', 'code'],
    fields: {
      ...commonFields,
      work_branch_id: uuid(),
      name: text(200),
    },
  },
});

export const MASTER_DATA_ENTITY_NAMES = Object.freeze(Object.keys(MASTER_DATA_ENTITIES));
export const MASTER_DATA_REVIEW_ENTITIES = Object.freeze([
  'companies',
  'suppliers',
  'materials',
  'locations',
  'work_branches',
  'collaborators',
  'equipment',
  'vehicles',
]);

const roleActions = Object.freeze({
  admin: new Set(['read', 'create', 'update', 'archive', 'import']),
  gestor: new Set(['read', 'create', 'update', 'archive', 'import']),
  operador: new Set(['read', 'create', 'update', 'import']),
  leitura: new Set(['read']),
});

const contractError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const normalizeStaffRole = value => (
  VALID_ROLES.has(String(value || '').trim().toLowerCase())
    ? String(value).trim().toLowerCase()
    : 'admin'
);

export const assertRoleCan = (roleValue, action) => {
  const role = normalizeStaffRole(roleValue);
  if (!roleActions[role]?.has(action)) {
    throw contractError(`O perfil ${role} não possui permissão para ${action === 'archive' ? 'arquivar' : action}.`, 403);
  }
  return role;
};

export const assertMasterDataEntity = entityValue => {
  const entity = String(entityValue || '').trim();
  const definition = MASTER_DATA_ENTITIES[entity];
  if (!definition) throw contractError('Cadastro mestre inválido.');
  return { entity, definition };
};

export const assertUuid = (value, label = 'Identificador') => {
  const normalized = String(value || '').trim();
  if (!UUID_PATTERN.test(normalized)) throw contractError(`${label} inválido.`);
  return normalized.toLowerCase();
};

export const resolveOrganizationId = (claims = {}, fallbackOrganizationId = '') => {
  const claimValue = claims.organization_id || claims.organizationId || '';
  const candidate = String(claimValue || fallbackOrganizationId || '').trim();
  if (!candidate) {
    throw contractError('A organização do Firebase ainda não foi configurada.', 424);
  }
  if (!/^[a-zA-Z0-9_-]{2,128}$/.test(candidate)) {
    throw contractError(
      claimValue ? 'A organização vinculada ao usuário é inválida.' : 'A organização padrão do Firebase é inválida.',
      claimValue ? 403 : 424,
    );
  }
  return candidate;
};

const sanitizeMetadata = value => {
  if (value === null || value === undefined) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw contractError('O campo metadata deve ser um objeto JSON.');
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, 'utf8') > 50_000) throw contractError('O campo metadata excede 50 KB.');
  return JSON.parse(serialized);
};

const sanitizeField = (fieldName, definition, value) => {
  if (value === null || value === undefined) return null;

  if (definition.type === 'boolean') {
    if (typeof value !== 'boolean') throw contractError(`O campo ${fieldName} deve ser verdadeiro ou falso.`);
    return value;
  }

  if (definition.type === 'number') {
    const normalized = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    if (!Number.isFinite(normalized)) throw contractError(`O campo ${fieldName} deve ser numérico.`);
    if (definition.minimum !== null && normalized < definition.minimum) throw contractError(`O campo ${fieldName} está abaixo do mínimo permitido.`);
    if (definition.maximum !== null && normalized > definition.maximum) throw contractError(`O campo ${fieldName} excede o máximo permitido.`);
    return normalized;
  }

  if (definition.type === 'uuid') return assertUuid(value, `Campo ${fieldName}`);
  if (definition.type === 'metadata') return sanitizeMetadata(value);

  const normalized = String(value).trim();
  if (!normalized) return null;
  if (normalized.length > definition.maxLength) throw contractError(`O campo ${fieldName} excede ${definition.maxLength} caracteres.`);
  if (definition.type === 'email' && !EMAIL_PATTERN.test(normalized)) throw contractError(`O campo ${fieldName} contém um e-mail inválido.`);
  if (definition.type === 'enum' && !definition.values.includes(normalized)) throw contractError(`O campo ${fieldName} possui valor inválido.`);
  return normalized;
};

export const sanitizeMasterDataPayload = (entityValue, source, mode = 'create') => {
  const { definition } = assertMasterDataEntity(entityValue);
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw contractError('Os dados do cadastro devem ser um objeto JSON.');

  const unknownFields = Object.keys(source).filter(fieldName => !(fieldName in definition.fields));
  if (unknownFields.length > 0) throw contractError(`Campos não permitidos: ${unknownFields.join(', ')}.`);

  const sanitized = {};
  for (const [fieldName, value] of Object.entries(source)) {
    if (value === undefined) continue;
    sanitized[fieldName] = sanitizeField(fieldName, definition.fields[fieldName], value);
  }

  if (mode === 'create') {
    for (const fieldName of definition.required) {
      if (sanitized[fieldName] === null || sanitized[fieldName] === undefined || sanitized[fieldName] === '') {
        throw contractError(`O campo ${fieldName} é obrigatório.`);
      }
    }
  }

  if (Object.keys(sanitized).length === 0) throw contractError('Nenhum campo válido foi informado.');
  return sanitized;
};

export const sanitizeSearchTerm = value => String(value || '')
  .trim()
  .replace(/[,*()"'\\]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 80);

export const sanitizeListLimit = value => {
  const parsed = Number.parseInt(String(value || '100'), 10);
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(1, Math.min(500, parsed));
};

export const sanitizeImportRequest = source => {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw contractError('A importação deve ser um objeto JSON.');
  const rows = source.rows;
  if (!Array.isArray(rows)) throw contractError('A importação deve conter uma lista de linhas.');
  if (rows.length > 5000) throw contractError('Cada lote pode preservar no máximo 5000 linhas.');
  if (Buffer.byteLength(JSON.stringify(rows), 'utf8') > 3_500_000) throw contractError('O lote de importação excede 3,5 MB.');

  const sourceName = String(source.sourceName || '').trim().slice(0, 300);
  if (!sourceName) throw contractError('Informe o nome do arquivo ou da origem.');

  const entity = source.entity ? assertMasterDataEntity(source.entity).entity : null;
  return {
    sourceName,
    sourceType: String(source.sourceType || 'xlsx').trim().slice(0, 40) || 'xlsx',
    entity,
    worksheetName: String(source.worksheetName || '').trim().slice(0, 200) || null,
    rows,
    metadata: sanitizeMetadata(source.metadata),
  };
};

export const sanitizeMasterImportRequest = source => {
  const request = sanitizeImportRequest(source);
  if (!request.entity || !MASTER_DATA_REVIEW_ENTITIES.includes(request.entity)) {
    throw contractError('A entidade não pertence ao escopo de cadastros mestres da v2.2.');
  }
  if (!request.worksheetName) throw contractError('Informe a aba de origem do cadastro mestre.');
  return request;
};

export const sanitizeFuelImportRequest = source => {
  const request = sanitizeImportRequest({
    ...source,
    entity: null,
  });
  if (!request.worksheetName) request.worksheetName = 'ABASTECIMENTOS';
  return {
    ...request,
    entity: 'fueling_events',
    sourceType: 'fuel-system',
  };
};

export const sanitizeTravelImportRequest = source => {
  const request = sanitizeImportRequest({
    ...source,
    entity: null,
  });
  if (!request.worksheetName) request.worksheetName = 'LIBERAÇÃO + RECEBIMENTO';
  return {
    ...request,
    entity: 'travel_tickets',
    sourceType: 'travel-system',
  };
};
