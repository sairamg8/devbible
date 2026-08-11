Promise.resolve().then(() => {
  console.log('A: in microtask');
  process.nextTick(() => console.log('C: nextTick scheduled from microtask'));
  Promise.resolve().then(() => console.log('B: microtask scheduled from microtask'));
});
