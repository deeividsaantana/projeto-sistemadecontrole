import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  recordSessionActivity,
  SESSION_ACTIVITY_EVENTS,
  SESSION_INACTIVITY_MS,
} from '../src/auth/sessionActivity';

const appUrl = new URL('../src/App.tsx', import.meta.url);
const app = readFileSync(appUrl, 'utf8');

assert.equal(SESSION_INACTIVITY_MS, 30 * 60 * 1000);
assert.deepEqual(SESSION_ACTIVITY_EVENTS, ['click', 'keydown', 'pointerdown', 'touchstart']);
assert.match(app, /Sua sess/);
assert.match(app, /SESSION_INACTIVITY_MS/);
assert.match(app, /SESSION_ACTIVITY_EVENTS/);

const writes = new Map<string, string>();
const storage = {
  getItem: (key: string) => writes.get(key) ?? null,
  setItem: (key: string, value: string) => { writes.set(key, value); },
  removeItem: (key: string) => { writes.delete(key); },
};

recordSessionActivity(storage, new Date('2026-08-15T12:00:00.000Z'));
assert.equal(writes.get('renea_session_last_activity'), '2026-08-15T12:00:00.000Z');
