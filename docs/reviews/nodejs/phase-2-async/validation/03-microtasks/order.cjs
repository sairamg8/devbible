console.log('1 sync start');
setTimeout(() => console.log('6 setTimeout 0'), 0);
setImmediate(() => console.log('7 setImmediate'));
Promise.resolve().then(() => console.log('5 promise.then'));
queueMicrotask(() => console.log('4 queueMicrotask'));
process.nextTick(() => console.log('3 nextTick'));
console.log('2 sync end');
