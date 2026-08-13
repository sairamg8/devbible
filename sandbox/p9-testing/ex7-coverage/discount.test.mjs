import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discount } from './discount.mjs';

test('HALF halves', () => assert.equal(discount(100, 'HALF'), 50));
test('TENOFF takes ten', () => assert.equal(discount(100, 'TENOFF'), 90));
test('no code is a no-op', () => assert.equal(discount(100, undefined), 100));
