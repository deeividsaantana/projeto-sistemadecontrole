# Security Specification: Renea Cloud Storage

This document describes the security invariants, data boundaries, and threat model for the Renea Cloud database.

## 1. Data Invariants
- The root document ID in `/sistemarenea_cloud` must be an alphanumeric, hyphenated, or underscored string up to 128 characters.
- A cloud snapshot must always have at least `empresas`, `obras`, `equipamentos` tables, and a valid ISO-8601 string for `updatedAt`.
- No orphan fields, shadow tables, or unapproved metadata can be written.

## 2. The "Dirty Dozen" Payloads (Anti-Vulnerability Test Vectors)
Below are 12 malicious or structurally compromised payloads designed to fail validation:

1. **Payload 1 (Resource Exhaustion / Large ID)**: Creating a document with a 2MB ID.
2. **Payload 2 (Ghost Field Attack)**: Writing unapproved fields (`isVerifiedAdmin: true`) to hijack roles.
3. **Payload 3 (Type Poisoning - String to Int)**: Sending `empresas` as an integer instead of a list.
4. **Payload 4 (Missing Required Tables)**: Omitting the `equipamentos` array.
5. **Payload 5 (Path Traversal in Doc ID)**: Writing to `../secret/doc`.
6. **Payload 6 (No timestamp)**: Omitting `updatedAt`.
7. **Payload 7 (Timestamp Type Poisoning)**: Sending `updatedAt` as a boolean.
8. **Payload 8 (Empty Data Payload)**: Sending `{}`.
9. **Payload 9 (Null Payload)**: Sending `null` values in database arrays.
10. **Payload 10 (SQL Injection String ID)**: ID containing `' OR '1'='1`.
11. **Payload 11 (XSS Payload in updatedAt)**: `<script>alert(1)</script>` inside timestamp.
12. **Payload 12 (HTML elements in data structures)**: Injected div objects inside arrays.

## 3. Firestore Rules Verification Plan
All "Dirty Dozen" payloads must be blocked by the Firestore rules.

```typescript
// firestore.rules.test.ts mock structure
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

// All Dirty Dozen attempts should fail
assertFails(setDoc(doc(db, 'sistemarenea_cloud', 'VERY_LONG_ID_超过_128_CHARACTERS...'), { ... }));
```
