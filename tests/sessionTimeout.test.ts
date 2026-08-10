import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appUrl = new URL('../src/App.tsx', import.meta.url);
const app = readFileSync(appUrl, 'utf8');

assert.match(app, /const inactivityMs = 30 \* 60 \* 1000/);
assert.match(app, /renea_session_last_activity/);
assert.match(app, /Sua sessão foi encerrada por inatividade/);
