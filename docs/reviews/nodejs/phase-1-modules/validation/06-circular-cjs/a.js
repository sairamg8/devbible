console.log('a: start');
exports.aReady = true;
const b = require('./b.js');
console.log('a: b.bReady =', b.bReady);
exports.aDone = true;
console.log('a: done');
