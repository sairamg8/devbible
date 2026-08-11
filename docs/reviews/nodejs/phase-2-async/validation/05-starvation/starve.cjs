let n = 0;
function recur() {
  n++;
  if (n < 5) process.nextTick(recur);
  else console.log('drained', n, 'nextTicks then timer can run');
}
process.nextTick(recur);
setTimeout(() => console.log('timer'), 0);
