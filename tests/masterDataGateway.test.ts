import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const gatewayUrl = new URL('../netlify/functions/master-data.js', import.meta.url);
const gateway = readFileSync(gatewayUrl, 'utf8');

assert.match(gateway, /const staff = await requireStaffUser\(event\)/);
assert.match(gateway, /resolveOrganizationId\(staff, process\.env\.SUPABASE_DEFAULT_ORGANIZATION_ID\)/);
assert.match(gateway, /organization_id: `eq\.\$\{context\.organizationId\}`/);
assert.match(gateway, /organization_id: context\.organizationId/);
assert.match(gateway, /assertRoleCan\(context\.role, 'archive'\)/);
assert.match(gateway, /deleted_at: new Date\(\)\.toISOString\(\)/);
assert.match(gateway, /return await archiveRecord\(body, context\)/);
assert.match(gateway, /body\.action === 'stage-master-import'/);
assert.match(gateway, /rpc\/stage_master_data_import/);
assert.doesNotMatch(gateway, /body\.organization/i);
assert.doesNotMatch(gateway, /SUPABASE_SERVICE_ROLE_KEY/);
