import assert from 'node:assert/strict';
import test from 'node:test';
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
  prependNotifications,
} from '../src/notifications/notificationService';
import type { AppNotification } from '../src/types';

const makeNotification = (id: string, read = false): AppNotification => ({
  id,
  title: `Titulo ${id}`,
  message: `Mensagem ${id}`,
  type: 'info',
  timestamp: '10:00',
  read,
  source: 'Sistema Local',
});

test('notificacoes novas entram no topo e respeitam limite operacional', () => {
  const current = Array.from({ length: 49 }, (_, index) => makeNotification(`old-${index}`));
  const next = prependNotifications(current, [
    makeNotification('new-1'),
    makeNotification('new-2'),
  ]);

  assert.equal(next.length, 50);
  assert.deepEqual(next.slice(0, 2).map(item => item.id), ['new-1', 'new-2']);
  assert.equal(next.some(item => item.id === 'old-48'), false);
});

test('marcacao de leitura preserva os demais registros', () => {
  const notifications = [
    makeNotification('a'),
    makeNotification('b'),
    makeNotification('c', true),
  ];

  assert.deepEqual(
    markNotificationAsRead(notifications, 'b').map(item => [item.id, item.read]),
    [['a', false], ['b', true], ['c', true]],
  );
  assert.deepEqual(
    markAllNotificationsAsRead(notifications).map(item => item.read),
    [true, true, true],
  );
});
