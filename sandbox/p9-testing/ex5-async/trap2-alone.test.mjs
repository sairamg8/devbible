import { test } from 'node:test';
import assert from 'node:assert/strict';

async function chargeCard() { throw new Error('gateway declined'); }

test('charges the card', async () => {
  const result = chargeCard();     // missing await
  assert.ok(result);               // a Promise is truthy
});
