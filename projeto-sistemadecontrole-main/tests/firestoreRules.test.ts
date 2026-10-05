import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rulesUrl = new URL('../firestore.rules', import.meta.url);
const rules = readFileSync(rulesUrl, 'utf8');

assert.match(rules, /match \/\{document=\*\*\}/);
assert.match(rules, /allow read, write: if false/);
assert.match(rules, /request\.auth\.token\.staff == true/);
// Escrita exige perfil explicito: conta sem role nao pode gravar.
assert.match(rules, /request\.auth\.token\.role in \['admin', 'gestor', 'operador'\]/);
assert.doesNotMatch(rules, /role != 'leitura'/);
assert.match(rules, /match \/sistemarenea_cloud\/\{docId\}/);
assert.match(rules, /match \/sistemarenea_public_submissions\/\{docId\}/);
assert.match(rules, /match \/sistemarenea_rate_limits\/\{docId\}/);
assert.match(rules, /allow create, delete: if false/);
assert.doesNotMatch(rules, /allow read, write: if true/);
