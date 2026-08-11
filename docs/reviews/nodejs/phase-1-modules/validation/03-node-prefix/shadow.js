const bare   = require('path');
const scoped = require('node:path');
console.log('require("path")      →', bare.join('a', 'b'));
console.log('require("node:path") →', scoped.join('a', 'b'));
console.log('is the bare one the imposter?', bare.imposter === true);
