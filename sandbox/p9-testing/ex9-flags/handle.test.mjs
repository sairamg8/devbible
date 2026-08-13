import { test } from 'node:test';
import net from 'node:net';
test('leaves a server listening', () => {
  net.createServer().listen(0);   // never closed
});
