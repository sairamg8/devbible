import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
const data = Buffer.alloc(100_000, 'x');
const t0=Date.now(); gzipSync(data); const g=Date.now()-t0;
const t1=Date.now(); brotliCompressSync(data); const b=Date.now()-t1;
const t2=Date.now(); brotliCompressSync(data,{params:{[constants.BROTLI_PARAM_QUALITY]:4}}); const b4=Date.now()-t2;
console.log('gzip ms', g, 'brotli default ms', b, 'brotli q4 ms', b4);
console.log('default quality is expensive:', b > g*2 || b > 50);
