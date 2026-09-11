import type { GrupoEquipe } from '../types';

const LEGACY_PRESENCE_TOKEN = /^renea-[a-z0-9-]+-\d+$/i;

export const generateSecurePublicToken = (purpose: 'presenca') => {
  const random = new Uint8Array(24);
  globalThis.crypto.getRandomValues(random);
  const entropy = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${purpose}-${entropy}`;
};

export const isWeakPresenceToken = (token: string) => {
  const normalized = String(token || '').trim();
  return normalized.length < 24 || LEGACY_PRESENCE_TOKEN.test(normalized);
};

export const rotateWeakPublicLinkTokens = (
  gruposEquipe: GrupoEquipe[],
  createToken: (purpose: 'presenca') => string = generateSecurePublicToken,
) => {
  let rotatedPresence = 0;
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

  return {
    gruposEquipe: grupos,
    rotatedPresence,
    changed: rotatedPresence > 0,
  };
};

/**
 * O endereço de presença que o encarregado guardou no celular só muda quando
 * alguém manda mudar. A troca dos tokens previsíveis herdados das versões
 * antigas acontece uma única vez por aparelho: depois disso `jaEstabilizado`
 * fica verdadeiro e a lista volta intacta, mesmo em atualização do sistema ou
 * quando a nuvem devolve o grupo. Renovar link continua sendo um botão.
 */
export const estabilizarLinksPublicos = (
  gruposEquipe: GrupoEquipe[],
  jaEstabilizado: boolean,
  createToken: (purpose: 'presenca') => string = generateSecurePublicToken,
) => (
  jaEstabilizado
    ? { gruposEquipe, rotatedPresence: 0, changed: false }
    : rotateWeakPublicLinkTokens(gruposEquipe, createToken)
);
