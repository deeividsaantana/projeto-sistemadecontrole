const normalize = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const REQUESTERS = new Set(['jose augusto', 'thiago', 'alvaro', 'jose augusto mineiro']);
const BUYERS = new Set(['cassia', 'sergio']);

export const procurementActorFromStaff = staff => {
  const name = String(staff?.name || staff?.email || '').trim();
  const normalized = normalize(name);
  const suppliedRole = String(staff?.procurementRole || '').trim();
  const role = suppliedRole || (normalized === 'bruno'
    ? 'aprovador'
    : BUYERS.has(normalized)
      ? 'suprimentos'
      : REQUESTERS.has(normalized)
        ? 'solicitante'
        : String(staff?.role || ''));
  return { id: staff?.uid || staff?.sub, name, role };
};

const deny = (message) => {
  const error = new Error(`[ERRO DE GOVERNANÇA 403 - ALÇADA EXCLUSIVA]: ${message}`);
  error.statusCode = 403;
  return error;
};

/** Autoridade única para ações de compras; não deve ser substituída por checks de UI. */
export const assertProcurementPermission = (actor, action) => {
  const role = String(actor?.role || '');
  const name = normalize(actor?.name);
  const allowed = action === 'approve'
    ? role === 'aprovador' && name === 'bruno'
    : action === 'receive'
      ? role === 'recebedor'
      : ['quote', 'reschedule', 'dispatch'].includes(action)
        ? role === 'suprimentos'
        : action === 'request'
          ? role === 'solicitante'
          : false;
  if (!allowed) throw deny(`Ação '${action}' não autorizada para este usuário.`);
  return actor;
};

export const procurementError = deny;
