import crypto from 'node:crypto';

const ACCESS_HEADER = 'x-renea-ticket-access';

export const constantTimeEquals = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const getPublicTicketAccessToken = (event, body = {}) => String(
  event.headers?.[ACCESS_HEADER]
    || event.headers?.[ACCESS_HEADER.toUpperCase()]
    || event.queryStringParameters?.access
    || body.accessToken
    || '',
).trim();

export const requirePublicTicketAccess = (event, expectedToken, body = {}) => {
  if (!expectedToken || String(expectedToken).length < 24) {
    const error = new Error('O link público de tickets ainda não foi configurado pelo administrador.');
    error.statusCode = 503;
    throw error;
  }
  if (!constantTimeEquals(getPublicTicketAccessToken(event, body), expectedToken)) {
    const error = new Error('Este link de tickets é inválido, expirou ou foi substituído.');
    error.statusCode = 403;
    throw error;
  }
};

export const buildPublicTicketPath = expectedToken => {
  if (!expectedToken || String(expectedToken).length < 24) {
    const error = new Error('O link público de tickets ainda não foi configurado.');
    error.statusCode = 503;
    throw error;
  }
  return `/ticket-link/${encodeURIComponent(expectedToken)}`;
};
