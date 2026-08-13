import {scrypt} from 'node:crypto';
import {promisify} from 'node:util';
const s = promisify(scrypt);
const P = {N: 2**15, r: 8, p: 1, maxmem: 512*1024*1024};
const salt = Buffer.alloc(16);
console.log('UV_THREADPOOL_SIZE =', process.env.UV_THREADPOOL_SIZE ?? '(default 4)');
for (const n of [1, 4, 8, 20]) {
  const t = performance.now();
  await Promise.all(Array.from({length: n}, (_, i) => s('pw'+i, salt, 64, P)));
  const ms = performance.now() - t;
  console.log(`${String(n).padStart(2)} concurrent -> ${Math.round(ms)} ms total, ${(n/(ms/1000)).toFixed(1)} hashes/s`);
}
