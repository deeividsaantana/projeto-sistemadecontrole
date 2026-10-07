import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appUrl = new URL('../src/App.tsx', import.meta.url);
const authServiceUrl = new URL('../src/auth/authService.ts', import.meta.url);
const loginScreenUrl = new URL('../src/auth/LoginScreen.tsx', import.meta.url);
const app = readFileSync(appUrl, 'utf8');
const authService = readFileSync(authServiceUrl, 'utf8');
const loginScreen = readFileSync(loginScreenUrl, 'utf8');

assert.match(authService, /sendPasswordResetEmail/);
assert.match(app, /sendPasswordRecoveryEmail/);
assert.match(app, /const handlePasswordRecovery = async/);
assert.match(loginScreen, /Recuperar senha/);
