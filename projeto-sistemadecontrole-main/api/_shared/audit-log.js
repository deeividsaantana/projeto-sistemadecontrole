import { cleanString, serverTimestamp } from './firebase-admin.js';

const SENSITIVE_FIELD_PATTERN = /authorization|cookie|password|secret|token|api[_-]?key|serviceaccount/i;
const MAX_AUDIT_DEPTH = 4;
const MAX_AUDIT_ARRAY_ITEMS = 25;
const MAX_AUDIT_OBJECT_KEYS = 80;
const MAX_AUDIT_STRING_LENGTH = 1_000;

export const sanitizeAuditValue = (value, depth = 0) => {
  if (value == null) return null;
  if (['number', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'string') return cleanString(value, MAX_AUDIT_STRING_LENGTH);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_AUDIT_ARRAY_ITEMS)
      .map(item => sanitizeAuditValue(item, depth + 1));
    if (value.length > MAX_AUDIT_ARRAY_ITEMS) {
      items.push({ truncatedItems: value.length - MAX_AUDIT_ARRAY_ITEMS });
    }
    return items;
  }
  if (typeof value !== 'object') return cleanString(value, 120);
  if (depth >= MAX_AUDIT_DEPTH) return '[max-depth]';
  return Object.fromEntries(Object.entries(value).slice(0, MAX_AUDIT_OBJECT_KEYS).map(([key, entry]) => {
    if (SENSITIVE_FIELD_PATTERN.test(key)) return [key, '[redacted]'];
    return [key, sanitizeAuditValue(entry, depth + 1)];
  }));
};

export const changedAuditFields = (before, after) => {
  const beforeData = before && typeof before === 'object' ? before : {};
  const afterData = after && typeof after === 'object' ? after : {};
  return Array
    .from(new Set([...Object.keys(beforeData), ...Object.keys(afterData)]))
    .filter(key => JSON.stringify(beforeData[key] ?? null) !== JSON.stringify(afterData[key] ?? null))
    .sort()
    .slice(0, 120);
};

export const buildAuditRecord = (context, action, entity, recordId, before, after, details = {}) => ({
  organizationId: context.organizationId,
  module: entity,
  recordId: cleanString(recordId, 160) || null,
  action,
  userId: context.userId,
  userEmail: cleanString(context.staff?.email, 320).toLowerCase() || null,
  userRole: context.role || 'leitura',
  requestId: context.requestId || null,
  before: sanitizeAuditValue(before),
  after: sanitizeAuditValue(after),
  details: sanitizeAuditValue(details),
  changedFields: changedAuditFields(before, after),
  createdAt: serverTimestamp(),
  createdAtIso: new Date().toISOString(),
});
