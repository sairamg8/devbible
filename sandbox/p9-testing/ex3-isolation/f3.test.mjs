import { test } from 'node:test';
test('file 3 pid ${process.pid}', () => {
  console.log('  file 3 pid=' + process.pid);
});
