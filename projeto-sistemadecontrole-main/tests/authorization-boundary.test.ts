import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const publicPresence = readFileSync(new URL('../api/public-presenca.js', import.meta.url), 'utf8');

/**
 * P0-07 Authorization Boundary Tests
 *
 * Firestore direct access is default-deny. Public presence is intentionally
 * served only through the API handler, which validates the link token
 * against active groups before it reads or mutates operational data.
 */
test('[P0-07-01] non-staff users cannot read staff-only cloud collections', () => {
  assert.match(rules, /match \/sistemarenea_cloud\/\{docId\}/);
  assert.match(rules, /allow get: if isStaff\(\) && isValidId\(docId\)/);
  assert.match(rules, /function isStaff\(\) \{[\s\S]*request\.auth\.token\.staff == true/);
});

test('[P0-07-02] public presence never receives direct Firestore access', () => {
  assert.match(rules, /match \/sistemarenea_public_submissions\/\{docId\}/);
  assert.match(rules, /allow create, delete: if false/);
  assert.match(publicPresence, /if \(tokenGroupIds\.length === 0\) \{[\s\S]*jsonResponse\(404/);
  assert.match(publicPresence, /if \(!group\) return jsonResponse\(403, \{ success: false, message: 'O link não autoriza o grupo selecionado\.'/);
});

test('[P0-07-03] a browser cannot read or write another organization directly', () => {
  assert.match(rules, /match \/sistemarenea_master_data\/\{organizationId\}\/\{document=\*\*\} \{[\s\S]*allow read, write: if false;/);
  assert.match(rules, /match \/sistemarenea_organizations\/\{organizationId\} \{[\s\S]*allow read, write: if false;/);
});

test('[P0-07-04] presence tokens have no time-based expiry guard yet', () => {
  assert.doesNotMatch(publicPresence, /expiresAt|expiresIn|tokenExpires|tokenExpiration/i);
});
