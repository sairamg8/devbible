import circumference, { PI, area } from './math.js';
import * as math from './math.js';

console.log(PI, area(2).toFixed(3), circumference(2).toFixed(3));
console.log(Object.keys(math));
console.log(typeof math.default);
