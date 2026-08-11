import { Readable, Transform, pipeline } from 'node:stream';
import { promisify } from 'node:util';
const pipe = promisify(pipeline);
const src = Readable.from(['a','b','c']);
const boom = new Transform({
  transform(c,_,cb){ if (String(c)==='b') cb(new Error('mid')); else cb(null,c); }
});
try {
  await pipe(src, boom, new Transform({transform(c,_,cb){cb(null,c);}}));
} catch(e) { console.log('pipeline error', e.message, 'destroyed', boom.destroyed); }
