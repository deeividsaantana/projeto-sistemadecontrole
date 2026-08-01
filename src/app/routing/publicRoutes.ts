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

export const getApontamentoTokenFromUrl = (location?: PublicLocation) => {
  const resolvedLocation = getLocation(location);
  if (!resolvedLocation) return '';
  const byQuery = new URLSearchParams(resolvedLocation.search).get('apontamento');
  if (byQuery) return decodeURIComponent(byQuery);
  const match = resolvedLocation.pathname.match(/\/apontamento-link\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

export const isTicketLinkUrl = (location?: PublicLocation) => {
  const resolvedLocation = getLocation(location);
  if (!resolvedLocation) return false;
  return resolvedLocation.pathname.startsWith('/ticket-link')
    || new URLSearchParams(resolvedLocation.search).has('tickets');
};

export const getTicketAccessTokenFromUrl = (location?: PublicLocation) => {
  const resolvedLocation = getLocation(location);
  if (!resolvedLocation) return '';
  const byQuery = new URLSearchParams(resolvedLocation.search).get('tickets');
  if (byQuery) return decodeURIComponent(byQuery);
  const match = resolvedLocation.pathname.match(/\/ticket-link\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};
