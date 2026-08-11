setTimeout(() => {
  console.log('--- inside a timer callback ---');
  Promise.resolve().then(() => console.log('promise.then'));
  queueMicrotask(() => console.log('queueMicrotask'));
  process.nextTick(() => console.log('nextTick'));
}, 0);
