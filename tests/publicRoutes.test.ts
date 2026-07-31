import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getApontamentoTokenFromUrl,
  getPresenceTokenFromUrl,
  isTicketLinkUrl,
} from '../src/app/routing/publicRoutes';

test('resolve token de presença pela rota pública', () => {
  assert.equal(
    getPresenceTokenFromUrl({ pathname: '/presenca-link/equipe%201', search: '' }),
    'equipe 1',
  );
});

test('mantém compatibilidade com tokens públicos por query string', () => {
  assert.equal(
    getPresenceTokenFromUrl({ pathname: '/', search: '?presenca=geral' }),
    'geral',
  );
  assert.equal(
    getApontamentoTokenFromUrl({ pathname: '/', search: '?apontamento=ramo-700' }),
    'ramo-700',
  );
});

test('reconhece links públicos de ticket por rota ou query string', () => {
  assert.equal(isTicketLinkUrl({ pathname: '/ticket-link/novo', search: '' }), true);
  assert.equal(isTicketLinkUrl({ pathname: '/', search: '?tickets=1' }), true);
  assert.equal(isTicketLinkUrl({ pathname: '/', search: '' }), false);
});
