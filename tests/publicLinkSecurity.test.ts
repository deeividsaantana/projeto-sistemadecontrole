import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPublicTicketPath,
  getPublicTicketAccessToken,
  requirePublicTicketAccess,
} from '../netlify/functions/_shared/public-access.js';
import {
  estabilizarLinksPublicos,
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

const equipe = (over: Partial<GrupoEquipe> = {}): GrupoEquipe => ({
  id: 'grupo-1',
  nome: 'Equipe 1',
  responsavel: 'Responsável',
  frenteServico: 'Ramo 100',
  funcionarioIds: [],
  status: 'ativo',
  token: 'presenca-1234567890abcdef1234567890abcdef',
  linkAtivo: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

test('o link de presença não muda sozinho depois que o aparelho já foi estabilizado', () => {
  const grupos = [equipe({ tokenGeral: 'geral-presenca-abcdef1234567890abcdef1234' })];
  const primeiraCarga = estabilizarLinksPublicos(grupos, false, () => 'nao-deveria-ser-usado');
  assert.equal(primeiraCarga.changed, false, 'token forte não é trocado nem na primeira carga');

  const segundaCarga = estabilizarLinksPublicos(primeiraCarga.gruposEquipe, true, () => 'nao-deveria-ser-usado');
  assert.equal(segundaCarga.changed, false);
  assert.equal(segundaCarga.rotatedPresence, 0);
  assert.equal(segundaCarga.gruposEquipe[0].token, grupos[0].token, 'o endereço da equipe continua o mesmo');
  assert.equal(segundaCarga.gruposEquipe[0].tokenGeral, grupos[0].tokenGeral, 'o link geral continua o mesmo');
  assert.equal(segundaCarga.gruposEquipe[0].updatedAt, grupos[0].updatedAt, 'nada foi marcado como alterado');
});

test('aparelho já estabilizado não troca nem token herdado vindo da nuvem', () => {
  // Este é o laço que fazia o link mudar sozinho: um aparelho publicava o grupo
  // com token antigo, o outro rotacionava no download e republicava.
  const daNuvem = [equipe({ token: 'renea-equipe-terraplenagem-1', tokenGeral: 'renea-geral-1' })];
  const resultado = estabilizarLinksPublicos(daNuvem, true, () => 'presenca-token-novo-000000000000000000');

  assert.equal(resultado.changed, false);
  assert.equal(resultado.gruposEquipe[0].token, 'renea-equipe-terraplenagem-1');
  assert.equal(resultado.gruposEquipe[0].tokenGeral, 'renea-geral-1');
});

test('a troca única dos tokens previsíveis ainda acontece no aparelho que nunca estabilizou', () => {
  let sequencia = 0;
  const grupos = [equipe({ token: 'renea-equipe-1', tokenGeral: 'renea-geral-1' })];
  const resultado = estabilizarLinksPublicos(
    grupos,
    false,
    purpose => `${purpose}-token-seguro-${String(++sequencia).padStart(20, '0')}`,
  );

  assert.equal(resultado.changed, true);
  assert.equal(resultado.rotatedPresence, 2, 'o link da equipe e o link geral foram protegidos');
  assert.equal(isWeakPresenceToken(resultado.gruposEquipe[0].token), false);
  assert.equal(isWeakPresenceToken(String(resultado.gruposEquipe[0].tokenGeral)), false);
});
