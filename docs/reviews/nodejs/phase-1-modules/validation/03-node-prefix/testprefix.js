const bare = require('test');
const core = require('node:test');
console.log('require("test")      → third-party package?', bare.thirdParty === true);
console.log('require("node:test") → has .describe?', typeof core.describe === 'function');
