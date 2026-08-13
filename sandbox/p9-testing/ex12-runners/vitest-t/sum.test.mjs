import { test, expect } from 'vitest';
import { sum } from '../sum.mjs';
for (let i = 0; i < 50; i++) test(`sums ${i}`, () => expect(sum(1, 2, i)).toBe(3 + i));
