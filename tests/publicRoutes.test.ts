import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getApontamentoTokenFromUrl,
  getPresenceTokenFromUrl,
  getTicketAccessTokenFromUrl,
  isPublicLinkUrl,
  isTicketLinkUrl,
} from '../src/app/routing/publicRoutes';

test('resolve token de presença pela rota pública', () => {
  assert.equal(
    getPresenceTokenFromUrl({ pathname: '/presenca-link/equipe%201', search: '' }),
    'equipe 1',
  );
});

test('reconhece qualquer link publico antes de inicializar o ERP completo', () => {
  assert.equal(isPublicLinkUrl({ pathname: '/presenca-link/equipe-1', search: '' }), true);
  assert.equal(isPublicLinkUrl({ pathname: '/apontamento-link/ramo-700', search: '' }), true);
  assert.equal(isPublicLinkUrl({ pathname: '/ticket-link/ticket-seguro', search: '' }), true);
  assert.equal(isPublicLinkUrl({ pathname: '/', search: '' }), false);
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

test('extrai o token protegido do link público de tickets', () => {
  assert.equal(
    getTicketAccessTokenFromUrl({ pathname: '/ticket-link/ticket%2Dseguro', search: '' }),
    'ticket-seguro',
  );
  assert.equal(
    getTicketAccessTokenFromUrl({ pathname: '/', search: '?tickets=convite%20obra' }),
    'convite obra',
  );
});
