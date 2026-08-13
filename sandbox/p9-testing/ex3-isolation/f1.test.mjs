import { test } from 'node:test';
test('file 1 pid ${process.pid}', () => {
  console.log('  file 1 pid=' + process.pid);
});
