require('./logger');
require('node:path');
console.log(Object.keys(require.cache).filter(k => !k.includes('node_modules')).map(k => k.split('/').pop()));
console.log('is node:path in require.cache?', Object.keys(require.cache).some(k => k.includes('path')));
