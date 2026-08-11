const { builtinModules } = require('node:module');
const bare = builtinModules.filter(m => !m.startsWith('node:'));
const prefixed = builtinModules.filter(m => m.startsWith('node:')).map(m => m.slice(5));
const prefixOnly = prefixed.filter(p => !bare.includes(p));
console.log(builtinModules.filter(m => m.startsWith('node:')).join(', '));
console.log('total builtins:', builtinModules.length);
console.log('prefix-only:', prefixOnly.join(', '));
