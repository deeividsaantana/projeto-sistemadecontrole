export type PublicLocation = {
  pathname: string;
  search: string;
};

const getLocation = (location?: PublicLocation): PublicLocation | null => {
  if (location) return location;
  if (typeof window === 'undefined') return null;
  return window.location;
};

export const getPresenceTokenFromUrl = (location?: PublicLocation) => {
  const resolvedLocation = getLocation(location);
  if (!resolvedLocation) return '';
  const byQuery = new URLSearchParams(resolvedLocation.search).get('presenca');
  if (byQuery) return decodeURIComponent(byQuery);
  const match = resolvedLocation.pathname.match(/\/presenca-link\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

export const isPublicLinkUrl = (location?: PublicLocation) => {
  const resolvedLocation = getLocation(location);
  if (!resolvedLocation) return false;
  return Boolean(getPresenceTokenFromUrl(resolvedLocation));
};

/** Token do link individual de um pedido: /contratacao-link/<token>. */
export const getContratacaoTokenFromUrl = (location?: PublicLocation) => {
  const resolvedLocation = getLocation(location);
  const match = resolvedLocation?.pathname.match(/^\/contratacao-link\/([^/?#]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : '';
};

/** Links da Solicitação de Contratação: abrem leves, como o de presença, mas pedem login. */
export const isContratacaoLinkUrl = (location?: PublicLocation) => {
  const resolvedLocation = getLocation(location);
  return Boolean(resolvedLocation && (/^\/contratacao\/?$/.test(resolvedLocation.pathname) || getContratacaoTokenFromUrl(resolvedLocation)));
};

/** Código do link de primeiro acesso: /primeiro-acesso/<código>, onde a pessoa cria a própria senha. */
export const getPrimeiroAcessoTokenFromUrl = (location?: PublicLocation) => {
  const resolvedLocation = getLocation(location);
  const match = resolvedLocation?.pathname.match(/^\/primeiro-acesso\/([A-Za-z0-9_-]{43})\/?$/);
  return match ? match[1] : '';
};

export const isPrimeiroAcessoUrl = (location?: PublicLocation) => {
  const resolvedLocation = getLocation(location);
  return Boolean(resolvedLocation && /^\/primeiro-acesso(\/|$)/.test(resolvedLocation.pathname));
};
