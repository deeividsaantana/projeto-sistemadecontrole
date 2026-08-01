import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPublicTicketPath,
  getPublicTicketAccessToken,
  requirePublicTicketAccess,
} from '../netlify/functions/_shared/public-access.js';
import {
  isWeakApontamentoToken,
  isWeakPresenceToken,
  rotateWeakPublicLinkTokens,
} from '../src/utils/publicLinkSecurity';
import type { ApontamentoRamo, GrupoEquipe } from '../src/types';

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
  assert.equal(isWeakApontamentoToken('apontamentos-renea'), true);
  assert.equal(isWeakApontamentoToken('apontamento-1234567890abcdef1234567890abcdef'), false);
});

test('rotaciona somente links fracos e mantém um link geral para os ramos', () => {
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
  const ramos: ApontamentoRamo[] = [{
    id: 'ramo-1',
    canteiroNome: 'Canteiro',
    ramoNome: 'Ramo 1',
    responsavel: 'Apontador',
    token: 'apontamentos-renea',
    status: 'ativo',
    linkAtivo: true,
  }, {
    id: 'ramo-2',
    canteiroNome: 'Canteiro',
    ramoNome: 'Ramo 2',
    responsavel: 'Apontador',
    token: 'apontamentos-renea',
    status: 'ativo',
    linkAtivo: true,
  }];
  let sequence = 0;
  const result = rotateWeakPublicLinkTokens(
    grupos,
    ramos,
    purpose => `${purpose}-token-seguro-${String(++sequence).padStart(20, '0')}`,
  );

  assert.equal(result.changed, true);
  assert.equal(result.rotatedPresence, 1);
  assert.equal(result.rotatedApontamento, 2);
  assert.notEqual(result.gruposEquipe[0].token, grupos[0].token);
  assert.equal(result.gruposEquipe[1].token, grupos[1].token);
  assert.equal(result.apontamentoRamos[0].token, result.apontamentoRamos[1].token);
});
