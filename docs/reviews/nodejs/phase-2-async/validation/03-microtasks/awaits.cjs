console.log('1');
(async () => {
  console.log('2 — body runs synchronously up to the first await');
  await null;
  console.log('4 — resumed as a microtask');
})();
setTimeout(() => console.log('5 — a whole loop phase later'), 0);
console.log('3');
