import { test } from 'node:test';
import assert from 'node:assert/strict';
import { receiptId } from './hard.mjs';
import { makeReceiptId } from './easy.mjs';

test('HARD — env var set inside the test comes too late', () => {
  process.env.REGION = 'us-east-1';
  console.log('  process.env.REGION is now', process.env.REGION);
  console.log('  receiptId says          ', receiptId(42));
  assert.match(receiptId(42), /^eu-west-1/);   // still the import-time value
});

test('HARD — the year is whatever today is; cannot pin it', () => {
  assert.match(receiptId(42), new RegExp(`-${new Date().getFullYear()}-`));
});

test('EASY — both dependencies passed in', () => {
  const id = makeReceiptId({ region: 'us-east-1', clock: () => new Date('2019-06-01') });
  assert.equal(id(42), 'us-east-1-2019-42');
});
