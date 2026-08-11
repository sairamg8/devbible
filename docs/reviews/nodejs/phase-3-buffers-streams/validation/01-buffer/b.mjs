import { Buffer } from 'node:buffer';
console.log('poolSize', Buffer.poolSize);
const a = Buffer.alloc(10, 1);
const u = Buffer.allocUnsafe(10);
console.log('alloc zeros?', [...a].every(x=>x===1));
console.log('allocUnsafe length', u.length);
// Readable.from string chunk count
import { Readable } from 'node:stream';
const chunks=[];
for await (const c of Readable.from('abc')) chunks.push(c);
console.log('Readable.from string chunks', chunks.length, chunks.map(String));
// highWaterMark default
const r = new Readable({ read(){} });
console.log('default hwm', r.readableHighWaterMark);
const r2 = Readable.from([1,2,3]);
console.log('Readable.from hwm', r2.readableHighWaterMark);
