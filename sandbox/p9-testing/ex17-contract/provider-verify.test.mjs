import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProvider } from './provider.mjs';
import { UserResponse } from './contract.mjs';

async function verifyAgainst(drift) {
  const server = createProvider({ drift });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  try {
    const body = await (await fetch(`http://127.0.0.1:${port}/users/1`)).json();
    return UserResponse.safeParse(body);
  } finally { await new Promise((r) => server.close(r)); }
}

test('provider honours the consumer contract', async () => {
  const r = await verifyAgainst(false);
  assert.equal(r.success, true);
});

test('provider drift is caught before the frontend sees it', async () => {
  const r = await verifyAgainst(true);
  assert.equal(r.success, false);
  console.log(`  contract violated: ${r.error.issues[0].path.join('.')} — ${r.error.issues[0].message}`);
});
