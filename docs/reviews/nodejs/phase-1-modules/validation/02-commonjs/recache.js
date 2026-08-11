const p = require.resolve('./logger');
const first = require('./logger');
delete require.cache[p];
const second = require('./logger');
console.log('same after delete?', first === second);
