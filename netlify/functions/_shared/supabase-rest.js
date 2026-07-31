const configurationError = message => {
  const error = new Error(message);
  error.statusCode = 424;
  return error;
};

export const getSupabaseConfig = () => {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !serviceRoleKey) {
    throw configurationError('A fundação PostgreSQL/Supabase ainda não foi configurada no Netlify.');
  }
  if (!/^https?:\/\/[^/]+/i.test(url)) throw configurationError('SUPABASE_URL inválida.');
  return { url, serviceRoleKey };
};

export const isSupabaseConfigured = () => Boolean(
  String(process.env.SUPABASE_URL || '').trim()
  && String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
);

const safeSupabaseMessage = payload => {
  const message = payload?.message || payload?.details || payload?.hint || payload?.error;
  return String(message || 'O Supabase recusou a operação.').slice(0, 500);
};

export const supabaseRestRequest = async (
  resource,
  {
    method = 'GET',
    query = {},
    body,
    headers = {},
    timeoutMs = 15_000,
  } = {},
) => {
  if (!/^[a-zA-Z0-9_/-]+$/.test(resource) || resource.includes('..')) {
    const error = new Error('Recurso Supabase inválido.');
    error.statusCode = 500;
    throw error;
  }

  const { url, serviceRoleKey } = getSupabaseConfig();
  const endpoint = new URL(`${url}/rest/v1/${resource}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') endpoint.searchParams.set(key, String(value));
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Client-Info': 'renea-erp-netlify-v2.1',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const responseText = await response.text();
    let payload = null;
    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch {
        payload = { message: responseText };
      }
    }
    if (!response.ok) {
      const error = new Error(safeSupabaseMessage(payload));
      error.statusCode = response.status === 409 ? 409 : response.status >= 500 ? 502 : 400;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('O Supabase não respondeu dentro do tempo esperado.');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};
