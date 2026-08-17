import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const gatewayUrl = new URL('../netlify/functions/master-data.js', import.meta.url);
const gateway = readFileSync(gatewayUrl, 'utf8');

assert.match(gateway, /const staff = await requireStaffUser\(event\)/);
assert.match(gateway, /resolveOrganizationId\(staff, process\.env\.FIREBASE_DEFAULT_ORGANIZATION_ID/);
assert.match(gateway, /const ROOT_COLLECTION = 'sistemarenea_master_data'/);
assert.match(gateway, /const AUDIT_COLLECTION = 'sistemarenea_audit_logs'/);
assert.match(gateway, /const writeAudit = async/);
assert.match(gateway, /buildAuditRecord\(context, action, entity, recordId, before, after, details\)/);
assert.match(gateway, /withIdempotency\(event, context, idempotencyKey/);
assert.match(gateway, /const listAudits = async/);
assert.match(gateway, /const sanitizeAuditFilters =/);
assert.match(gateway, /const matchesAuditFilters =/);
assert.match(gateway, /queryStringParameters\?\.action === 'audit'/);
assert.match(gateway, /const createUser = async/);
assert.match(gateway, /queryStringParameters\?\.action === 'users'/);
assert.match(gateway, /body\.action === 'create-user'/);
assert.match(gateway, /collection\(ROOT_COLLECTION\)/);
assert.match(gateway, /assertRoleCan\(context\.role, 'archive'\)/);
assert.match(gateway, /deletedAt: new Date\(\)\.toISOString\(\)/);
assert.match(gateway, /return await archiveRecord\(body, context\)/);
assert.match(gateway, /body\.action === 'stage-master-import'/);
assert.match(gateway, /const preserveImport = async/);
assert.doesNotMatch(gateway, /body\.organization/i);
