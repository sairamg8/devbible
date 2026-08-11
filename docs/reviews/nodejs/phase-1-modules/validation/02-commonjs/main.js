const logger = require('./logger');
const fromA = require('./a');
logger.log('from main');
console.log('same object?', logger === fromA, '| calls:', logger.calls);
