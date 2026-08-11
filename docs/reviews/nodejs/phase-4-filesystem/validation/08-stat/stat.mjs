import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'p4-'));
const target = path.join(dir, 't.txt');
await fs.writeFile(target, 'hi');
const link = path.join(dir, 'l.txt');
await fs.symlink(target, link);
const broken = path.join(dir, 'broken');
await fs.symlink(path.join(dir, 'nope'), broken);
const s = await fs.stat(link);
const l = await fs.lstat(link);
console.log('stat isFile', s.isFile(), 'isSymbolicLink', s.isSymbolicLink());
console.log('lstat isSymbolicLink', l.isSymbolicLink());
try { await fs.stat(broken); console.log('stat broken ok?'); }
catch(e){ console.log('stat broken', e.code); }
const lb = await fs.lstat(broken);
console.log('lstat broken isSymbolicLink', lb.isSymbolicLink());
