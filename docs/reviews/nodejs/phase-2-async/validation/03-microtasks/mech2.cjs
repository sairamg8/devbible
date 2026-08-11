process.nextTick(() => {
  console.log('tick 1');
  process.nextTick(() => console.log('tick 3 (queued during tick 1)'));
});
process.nextTick(() => console.log('tick 2'));
Promise.resolve().then(() => console.log('micro (after ALL ticks)'));
