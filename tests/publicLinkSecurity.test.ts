import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPublicTicketPath,
  getPublicTicketAccessToken,
  requirePublicTicketAccess,
} from '../netlify/functions/_shared/public-access.js';
import {
  isWeakPresenceToken,
  rotateWeakPublicLinkTokens,
} from '../src/utils/publicLinkSecurity';
import type { GrupoEquipe } from '../src/types';

const secureToken = 'ticket-1234567890abcdef1234567890abcdef';

test('protege ticket público com token forte em tempo constante', () => {
  const event = { headers: { 'x-renea-ticket-access': secureToken }, queryStringParameters: {} };
  assert.equal(getPublicTicketAccessToken(event), secureToken);
  assert.doesNotThrow(() => requirePublicTicketAccess(event, secureToken));
  assert.equal(buildPublicTicketPath(secureToken), `/ticket-link/${secureToken}`);
});

test('rejeita ticket público sem token, token incorreto ou segredo não configurado', () => {
  assert.throws(
    () => requirePublicTicketAccess({ headers: {}, queryStringParameters: {} }, secureToken),
    (error: Error & { statusCode?: number }) => error.statusCode === 403,
  );
  assert.throws(
    () => requirePublicTicketAccess({ headers: { 'x-renea-ticket-access': 'incorreto' } }, secureToken),
    (error: Error & { statusCode?: number }) => error.statusCode === 403,
  );
  assert.throws(
    () => requirePublicTicketAccess({ headers: { 'x-renea-ticket-access': secureToken } }, ''),
    (error: Error & { statusCode?: number }) => error.statusCode === 503,
  );
});

test('identifica tokens públicos previsíveis usados nas versões anteriores', () => {
  assert.equal(isWeakPresenceToken('renea-encarregado-terraplenagem-1'), true);
  assert.equal(isWeakPresenceToken('presenca-1234567890abcdef1234567890abcdef'), false);
});

test('rotaciona somente os links fracos, mantendo os já seguros intactos', () => {
  const grupos: GrupoEquipe[] = [{
    id: 'grupo-1',
    nome: 'Equipe 1',
    responsavel: 'Responsável',
    frenteServico: 'Frente',
    funcionarioIds: [],
    status: 'ativo',
    token: 'renea-equipe-1',
    linkAtivo: true,
    createdAt: '',
    updatedAt: '',
  }, {
    id: 'grupo-2',
    nome: 'Equipe 2',
    responsavel: 'Responsável',
    frenteServico: 'Frente',
    funcionarioIds: [],
    status: 'ativo',
    token: 'presenca-1234567890abcdef1234567890abcdef',
    linkAtivo: true,
    createdAt: '',
    updatedAt: '',
  }];
  let sequence = 0;
  const result = rotateWeakPublicLinkTokens(
    grupos,
    purpose => `${purpose}-token-seguro-${String(++sequence).padStart(20, '0')}`,
  );

  assert.equal(result.changed, true);
  assert.equal(result.rotatedPresence, 1);
  assert.notEqual(result.gruposEquipe[0].token, grupos[0].token);
  assert.equal(result.gruposEquipe[1].token, grupos[1].token);
});
