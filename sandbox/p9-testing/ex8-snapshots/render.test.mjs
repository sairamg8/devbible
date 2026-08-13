import { test } from 'node:test';
import { invoiceLines } from './render.mjs';

const items = [
  { name: 'Widget', qty: 2, price: 9.99 },
  { name: 'Gizmo', qty: 1, price: 24.5 },
];

test('invoice rendering', (t) => {
  t.assert.snapshot(invoiceLines(items));
});
