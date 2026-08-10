import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appUrl = new URL('../src/App.tsx', import.meta.url);
const app = readFileSync(appUrl, 'utf8');

assert.match(app, /sendPasswordResetEmail/);
assert.match(app, /const handlePasswordRecovery = async/);
assert.match(app, /Recuperar senha/);
