import crypto from 'node:crypto';

const SENSITIVE_HEADER_PATTERN = /authorization|cookie|token|secret|key|password/i;

const cleanLogString = (value, maxLength = 240) => String(value ?? '').trim().slice(0, maxLength);

const hashValue = value => crypto.createHash('sha256').update(String(value || 'unknown')).digest('hex').slice(0, 24);

export const getRequestId = event => {
  const existing = cleanLogString(
    event?.headers?.['x-nf-request-id']
      || event?.headers?.['x-request-id']
      || event?.headers?.['X-Request-Id']
      || '',
    96,
  );
  return existing || crypto.randomUUID();
};

export const createApiRequestContext = (event, functionName) => {
  const forwardedFor = cleanLogString(
    event?.headers?.['x-forwarded-for']
      || event?.headers?.['client-ip']
      || '',
    200,
  ).split(',')[0];
  return {
    type: 'api',
    functionName,
    requestId: getRequestId(event),
    method: cleanLogString(event?.httpMethod || 'GET', 12).toUpperCase(),
    path: cleanLogString(event?.path || event?.rawUrl || '/', 240),
    ipHash: hashValue(forwardedFor),
    startedAtMs: Date.now(),
  };
};

export const sanitizeLogDetails = details => {
  if (!details || typeof details !== 'object') return {};
  return Object.fromEntries(Object.entries(details).map(([key, value]) => {
    if (SENSITIVE_HEADER_PATTERN.test(key)) return [key, '[redacted]'];
    if (value == null || ['number', 'boolean'].includes(typeof value)) return [key, value];
    return [key, cleanLogString(value, 500)];
  }));
};

export const logApiEvent = (level, message, context, details = {}) => {
  const entry = {
    type: 'api',
    level,
    message,
    functionName: context.functionName,
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    ipHash: context.ipHash,
    durationMs: Math.max(0, Date.now() - context.startedAtMs),
    timestamp: new Date().toISOString(),
    ...sanitizeLogDetails(details),
  };
  const writer = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  writer(JSON.stringify(entry));
};

export const withRequestIdHeader = (response, context) => ({
  ...response,
  headers: {
    ...(response?.headers || {}),
    'X-Request-Id': context.requestId,
  },
});

export const withApiTelemetry = async (event, functionName, operation) => {
  const context = createApiRequestContext(event, functionName);
  logApiEvent('info', 'api.request.started', context);
  const response = await operation(context);
  const statusCode = Number(response?.statusCode || 200);
  logApiEvent(statusCode >= 500 ? 'error' : 'info', 'api.request.finished', context, { statusCode });
  return withRequestIdHeader(response, context);
};
