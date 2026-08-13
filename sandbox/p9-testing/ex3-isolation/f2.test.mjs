import { test } from 'node:test';
test('file 2 pid ${process.pid}', () => {
  console.log('  file 2 pid=' + process.pid);
});
