import { test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
test('slow 1', async () => { await sleep(500); });
