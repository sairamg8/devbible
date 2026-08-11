import path from 'node:path';
const ROOT = '/var/app/uploads';
const bad = path.resolve(ROOT, '../uploads-evil/x');
console.log('startsWith ROOT only', bad.startsWith(ROOT));
console.log('startsWith ROOT+sep', bad.startsWith(ROOT + path.sep));
console.log('resolved', bad);
