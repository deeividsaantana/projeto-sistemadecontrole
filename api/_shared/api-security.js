const IDEMPOTENCY_KEY_PATTERN = /^[a-zA-Z0-9:_-]{12,128}$/;
const ENTITY_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export const SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
});

export const httpError = (message, statusCode = 400, extra = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
};

export const mergeSecurityHeaders = (extraHeaders = {}) => ({
  ...SECURITY_HEADERS,
  ...extraHeaders,
});

export const extractBearerToken = event => {
  const authorization = String(event?.headers?.authorization || event?.headers?.Authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
};

export const normalizeHttpMethod = event => String(event?.httpMethod || 'GET').toUpperCase();

export const allowHeader = allowedMethods => Array
  .from(new Set(allowedMethods.map(method => String(method).toUpperCase())))
  .join(', ');

export const assertHttpMethod = (event, allowedMethods) => {
  const method = normalizeHttpMethod(event);
  const allowed = new Set(allowedMethods.map(item => String(item).toUpperCase()));
  if (!allowed.has(method)) {
    throw httpError('Metodo nao permitido.', 405, { headers: { Allow: allowHeader(allowedMethods) } });
  }
  return method;
};

export const optionsResponse = allowedMethods => ({
  statusCode: 204,
  headers: mergeSecurityHeaders({
    Allow: allowHeader(allowedMethods),
    'Cache-Control': 'no-store',
  }),
  body: '',
});

export const assertIdempotencyKey = (event, { required = false } = {}) => {
  const value = String(
    event?.headers?.['x-idempotency-key']
      || event?.headers?.['X-Idempotency-Key']
      || '',
  ).trim();
  if (!value) {
    if (required) throw httpError('Informe a chave de idempotencia da operacao.', 400);
    return '';
  }
  if (!IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw httpError('Chave de idempotencia invalida.', 400);
  }
  return value;
};

export const assertValidEntityId = (value, label = 'Identificador') => {
  const id = String(value ?? '').trim().slice(0, 128);
  if (!ENTITY_ID_PATTERN.test(id)) {
    throw httpError(label + ' invalido.', 400);
  }
  return id;
};
