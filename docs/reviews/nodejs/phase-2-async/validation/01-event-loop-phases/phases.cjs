const fs = require('node:fs');
console.log('sync');
setTimeout(() => console.log('1 timers'), 0);
setImmediate(() => console.log('2 check'));
fs.readFile(__filename, () => {
  console.log('3 poll — I/O callback');
  process.nextTick(() => console.log('4 nextTick — before anything else'));
  Promise.resolve().then(() => console.log('5 microtask'));
  setImmediate(() => console.log('6 check — always next from poll'));
  setTimeout(() => console.log('7 timers — a full lap later'), 0);
});
