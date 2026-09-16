import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const presencaHandler = readFileSync(
  new URL('../netlify/functions/public-presenca.js', import.meta.url),
  'utf8'
);

/**
 * P0-07: Authorization Boundary Tests
 *
 * These tests document the current authorization guarantees and explicitly
 * mark two security gaps that require implementation in separate P0s:
 *
 * GUARANTEES (implemented):
 * 1. Default-deny: No access without explicit allow rule
 * 2. Staff claim required: Only authenticated users with staff=true can read
 * 3. Write role required: Only staff with role in [admin, gestor, operador] can write
 *
 * GAPS (not implemented, documented here for visibility):
 * - No token expiration: Public presence links never expire
 * - No organization isolation: Master data collection is blocked, but other
 *   collections don't enforce organizationId isolation (multi-org not supported)
 */

test('P0-07: Firestore Rules — Default Deny blocks unauthenticated read', () => {
  // First rule in firestore.rules must be a global default deny
  // Use lenient whitespace matching to handle reformatting
  assert.match(
    rules,
    /match\s+\/\{document=\*\*\}[\s\n]*\{[\s\n]*allow\s+read,\s*write:\s*if\s+false/,
    'Default deny rule must exist: match /{document=**} { allow read, write: if false; }'
  );
});

test('P0-07: Firestore Rules — Staff Claim Required for Read/Write', () => {
  // Every allowed operation must check isStaff()
  // Use lenient patterns to handle reformatting
  assert.match(
    rules,
    /function\s+isStaff\(\)[\s\n]*\{[\s\n]*return[\s\n]*request\.auth[\s\n]*!=[\s\n]*null[\s\n]*&&[\s\n]*request\.auth\.token\.staff[\s\n]*==[\s\n]*true/,
    'isStaff() must verify request.auth != null AND request.auth.token.staff == true'
  );

  // sistemarenea_cloud read requires isStaff
  assert.match(
    rules,
    /match\s+\/sistemarenea_cloud\/\{docId\}[\s\n]*\{[\s\S]*?allow\s+get:\s+if\s+isStaff\(\)/,
    'Read access to sistemarenea_cloud requires isStaff() check'
  );
});

test('P0-07: Firestore Rules — Write Role Must Be admin|gestor|operador', () => {
  // canWrite() must check both isStaff() AND role membership
  // Use lenient patterns to handle reformatting
  assert.match(
    rules,
    /function\s+canWrite\(\)[\s\n]*\{[\s\S]*?return[\s\n]*isStaff\(\)[\s\n]*&&[\s\n]*request\.auth\.token\.role[\s\n]*in[\s\n]*\['admin',[\s\n]*'gestor',[\s\n]*'operador'\]/,
    'canWrite() must check isStaff() AND role in [admin, gestor, operador]'
  );

  // Write operations must use canWrite()
  assert.match(
    rules,
    /allow\s+create,\s+update:\s+if\s+canWrite\(\)/,
    'Write operations (create, update) must require canWrite()'
  );
});

test('P0-07: GAP — No Token Expiration in Public Presence Links', () => {
  // Firestore rules don't validate token expiration
  assert.equal(
    rules.includes('expiresAt') || rules.includes('expirationDate'),
    false,
    'Firestore rules do not validate token expiration'
  );

  // activeGroupsForToken only checks status and linkAtivo, not timestamps
  const activeGroupsMatch = presencaHandler.match(
    /const activeGroupsForToken\s*=\s*\(snapshot,\s*token\)\s*=>\s*\{[^}]*filter\(group\s*=>\s*group\?\.\s*status\s*===\s*'ativo'\s*&&\s*group\?\.\s*linkAtivo\)/
  );
  assert.ok(
    activeGroupsMatch,
    'activeGroupsForToken filters only by status and linkAtivo, not expiration'
  );

  // Document the gap explicitly
  console.log(
    '\n⚠ GAP DOCUMENTED — Public Presence Link Tokens Never Expire:\n' +
    '  Links remain valid indefinitely once active (linkAtivo = true).\n' +
    '  No expiresAt field is checked in rules or handler.\n' +
    '  A future P0 must add timestamp-based token invalidation.\n'
  );
});

test('P0-07: GAP — No Organization Isolation in Data Collections', () => {
  // Master data is fully blocked (correct), but other collections lack org checks
  assert.match(
    rules,
    /match\s+\/sistemarenea_master_data\/\{organizationId\}\/\{document=\*\*\}[\s\n]*\{[\s\n]*allow\s+read,\s*write:\s*if\s+false/,
    'Master data collection is fully blocked (correct)'
  );

  // Extract the full sistemarenea_cloud rule block safely
  const cloudStart = rules.indexOf('match /sistemarenea_cloud/{docId}');
  assert.ok(cloudStart > -1, 'sistemarenea_cloud rule must exist');

  const nextRuleStart = rules.indexOf('match /', cloudStart + 1);
  const cloudRules = nextRuleStart > -1
    ? rules.substring(cloudStart, nextRuleStart)
    : rules.substring(cloudStart);

  assert.equal(
    cloudRules.includes('organizationId'),
    false,
    'sistemarenea_cloud does not enforce organizationId isolation'
  );

  // Document the gap explicitly
  console.log(
    '\n⚠ GAP DOCUMENTED — No Organization Isolation:\n' +
    '  Staff users from organization A can read/write organization B data.\n' +
    '  Collections lack organizationId field validation.\n' +
    '  A future P0 must add organizationId checks to all user-facing collections.\n'
  );
});
