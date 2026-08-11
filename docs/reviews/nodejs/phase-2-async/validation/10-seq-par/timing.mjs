const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function seq() {
  const t = Date.now();
  await sleep(50); await sleep(50); await sleep(50);
  return Date.now() - t;
}
async function par() {
  const t = Date.now();
  await Promise.all([sleep(50), sleep(50), sleep(50)]);
  return Date.now() - t;
}
console.log('seq', await seq(), 'par', await par());
