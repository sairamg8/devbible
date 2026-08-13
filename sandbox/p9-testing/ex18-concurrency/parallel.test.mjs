import { describe, test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
describe('group', { concurrency: true }, () => {
  test('a', async () => { await sleep(300); });
  test('b', async () => { await sleep(300); });
});
