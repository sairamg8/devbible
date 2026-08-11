const mod = require('./esm-side.js');
console.log('keys:', Object.keys(mod));
console.log('answer:', mod.answer, '| default():', mod.default());
console.log('__esModule marker:', mod.__esModule);
