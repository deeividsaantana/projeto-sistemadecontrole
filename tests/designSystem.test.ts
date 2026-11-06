import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const card = readFileSync(new URL('../src/shared/ui/Card.tsx', import.meta.url), 'utf8');
const button = readFileSync(new URL('../src/shared/ui/Button.tsx', import.meta.url), 'utf8');
const pageHeader = readFileSync(new URL('../src/shared/ui/PageHeader.tsx', import.meta.url), 'utf8');
const launchForm = readFileSync(new URL('../src/components/fleet/DailyRecordForm.tsx', import.meta.url), 'utf8');

assert.match(css, /--renea-color-primary:\s*#176b4d/i);
assert.match(css, /--renea-radius-card:\s*0\.75rem/i);
assert.match(css, /\.renea-card\s*\{/);
assert.match(css, /\.renea-control\s*\{/);
assert.match(css, /\.renea-button-primary\s*\{/);
assert.match(card, /className=\{cn\('renea-card/);
assert.match(button, /renea-button/);
assert.match(pageHeader, /compact\?/);
assert.match(pageHeader, /renea-page-header--compact/);
assert.match(launchForm, /renea-launch-layout/);
assert.match(launchForm, /renea-launch-summary/);
