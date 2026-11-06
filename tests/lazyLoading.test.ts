import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('Dashboard usa carregamento lazy como os demais módulos', () => {
  assert.match(appSource, /const Dashboard = lazy\(\(\) => import\('\.\/components\/Dashboard'\)\)/);
  assert.doesNotMatch(appSource, /import Dashboard from '\.\/components\/Dashboard';/);
});
