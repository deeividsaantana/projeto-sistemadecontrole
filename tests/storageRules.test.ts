import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rulesUrl = new URL('../storage.rules', import.meta.url);
const rules = readFileSync(rulesUrl, 'utf8');
const firebaseConfigUrl = new URL('../firebase.json', import.meta.url);
const firebaseConfig = JSON.parse(readFileSync(firebaseConfigUrl, 'utf8'));

assert.match(rules, /request\.auth\.token\.staff == true/);
assert.match(rules, /request\.auth\.token\.role != 'leitura'/);
assert.match(rules, /request\.resource\.size < 10 \* 1024 \* 1024/);
assert.match(rules, /match \/obras\/\{obraId\}\/\{modulo\}\/\{registroId\}\/\{arquivo\}/);
assert.doesNotMatch(rules, /allow read, write: if true/);
assert.equal(firebaseConfig.storage.rules, 'storage.rules');
assert.equal(firebaseConfig.firestore.indexes, 'firestore.indexes.json');
