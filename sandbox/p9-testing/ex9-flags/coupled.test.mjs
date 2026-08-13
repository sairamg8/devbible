import { test } from 'node:test';
import assert from 'node:assert/strict';

const cart = [];   // shared state between tests — the coupling

test('adds an item', () => { cart.push('widget'); assert.equal(cart.length, 1); });
test('adds a second item', () => { cart.push('gizmo'); assert.equal(cart.length, 2); });
test('cart totals two', () => { assert.equal(cart.length, 2); });
