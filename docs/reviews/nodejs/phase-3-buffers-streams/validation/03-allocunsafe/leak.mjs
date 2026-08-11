for (let i = 0; i < 5000; i++) {
  Buffer.from(`{"password":"hunter2","token":"tok_live_${i}"}`);
}
let hits = 0, sample = null;
for (let i = 0; i < 5000; i++) {
  const scratch = Buffer.allocUnsafe(80).toString('latin1');
  if (scratch.includes('hunter2')) { hits++; sample ??= scratch; }
}
console.log('recovered', hits, 'of 5000 =>', sample && JSON.stringify(sample.slice(0, 60)));
