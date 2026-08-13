import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sum } from '../sum.mjs';
for (let i = 0; i < 50; i++) test(`sums ${i}`, () => assert.equal(sum(1, 2, i), 3 + i));
