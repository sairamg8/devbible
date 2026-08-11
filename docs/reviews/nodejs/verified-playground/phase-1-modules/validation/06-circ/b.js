console.log('b: start');
const a = require('./a.js');
console.log('b: a.aReady =', a.aReady, '| a.aDone =', a.aDone);
exports.bReady = true;
console.log('b: done');
