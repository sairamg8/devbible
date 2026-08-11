const started = Date.now();
const { setTimeout: sleep } = await import('node:timers/promises');
await sleep(50);
console.log('top-level await worked after', Date.now() - started >= 50 ? '>=50ms' : '<50ms');
export const ready = true;
