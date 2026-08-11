import { count, bump } from './counter.js';
console.log('before', count);
bump();
console.log('after ', count);
