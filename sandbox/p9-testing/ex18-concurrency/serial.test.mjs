import { test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
test('a', async () => { await sleep(300); });
test('b', async () => { await sleep(300); });
