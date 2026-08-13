import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UserResponse } from './contract.mjs';

const check = (label, payload) => {
  const r = UserResponse.safeParse(payload);
  console.log(`  ${r.success ? 'COMPATIBLE  ' : 'BREAKING    '} ${label}` +
    (r.success ? '' : ` :: ${r.error.issues[0].path.join('.')}: ${r.error.issues[0].message}`));
  return r.success;
};

const v1 = { id: 1, name: 'Ada', email: 'ada@example.com', createdAt: '2026-01-01T00:00:00Z' };

test('the compatibility matrix', () => {
  assert.ok(check('v1 baseline', v1));
  assert.ok(check('ADD an optional field', { ...v1, nickname: 'A' }));
  assert.ok(check('WIDEN a value (new enum member in a free string)', { ...v1, name: 'Ada Lovelace' }));
  assert.ok(!check('REMOVE a field', (({ email, ...rest }) => rest)(v1)));
  assert.ok(!check('RENAME a field', { ...(({ createdAt, ...r }) => r)(v1), created_at: v1.createdAt }));
  assert.ok(!check('NARROW a type (number id -> string id)', { ...v1, id: '1' }));
  assert.ok(!check('NULL a required field', { ...v1, email: null }));
});
