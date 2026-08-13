import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withVat } from './vat.mjs';
test('adds VAT', () => assert.equal(withVat(100), 120));
