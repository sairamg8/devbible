import { AsyncLocalStorage } from 'node:async_hooks';
const als = new AsyncLocalStorage();
async function work(id) {
  await Promise.resolve();
  console.log('id', als.getStore());
}
await Promise.all([
  als.run(1, () => work(1)),
  als.run(2, () => work(2)),
]);
