import type { ApontamentoRamo, GrupoEquipe } from '../types';

type TokenFactory = (purpose: 'presenca' | 'apontamento') => string;

const LEGACY_APONTAMENTO_TOKEN = 'apontamentos-renea';
const LEGACY_PRESENCE_TOKEN = /^renea-[a-z0-9-]+-\d+$/i;

export const generateSecurePublicToken = (purpose: 'presenca' | 'apontamento') => {
  const random = new Uint8Array(24);
  globalThis.crypto.getRandomValues(random);
  const entropy = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${purpose}-${entropy}`;
};

export const isWeakPresenceToken = (token: string) => {
  const normalized = String(token || '').trim();
  return normalized.length < 24 || LEGACY_PRESENCE_TOKEN.test(normalized);
};

export const isWeakApontamentoToken = (token: string) => {
  const normalized = String(token || '').trim();
  return normalized === LEGACY_APONTAMENTO_TOKEN || normalized.length < 24;
};

export const rotateWeakPublicLinkTokens = (
  gruposEquipe: GrupoEquipe[],
  apontamentoRamos: ApontamentoRamo[],
  createToken: TokenFactory = generateSecurePublicToken,
) => {
  let rotatedPresence = 0;
  let rotatedApontamento = 0;
  const generalTokenReplacements = new Map<string, string>();
  const grupos = gruposEquipe.map(group => {
    const nextToken = isWeakPresenceToken(group.token)
      ? createToken('presenca')
      : group.token;
    if (nextToken !== group.token) rotatedPresence += 1;

    let nextGeneralToken = group.tokenGeral;
    if (nextGeneralToken && isWeakPresenceToken(nextGeneralToken)) {
      if (!generalTokenReplacements.has(nextGeneralToken)) {
        generalTokenReplacements.set(nextGeneralToken, `geral-${createToken('presenca')}`);
      }
      nextGeneralToken = generalTokenReplacements.get(nextGeneralToken);
      rotatedPresence += 1;
    }

    return nextToken === group.token && nextGeneralToken === group.tokenGeral
      ? group
      : { ...group, token: nextToken, tokenGeral: nextGeneralToken, updatedAt: new Date().toISOString() };
  });

  const apontamentoReplacement = apontamentoRamos.some(ramo => isWeakApontamentoToken(ramo.token))
    ? createToken('apontamento')
    : '';
  const ramos = apontamentoRamos.map(ramo => {
    if (!isWeakApontamentoToken(ramo.token)) return ramo;
    rotatedApontamento += 1;
    return { ...ramo, token: apontamentoReplacement };
  });

  return {
    gruposEquipe: grupos,
    apontamentoRamos: ramos,
    rotatedPresence,
    rotatedApontamento,
    changed: rotatedPresence > 0 || rotatedApontamento > 0,
  };
};
