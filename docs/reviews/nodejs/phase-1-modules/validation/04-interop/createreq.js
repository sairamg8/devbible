import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pkg = require('./data.json');
console.log('via createRequire:', pkg.name, pkg.port);
console.log('resolve:', require.resolve('./legacy.cjs').split('/').pop());
