import legacy from './legacy.cjs';
import { greet } from './legacy.cjs';
console.log(legacy.greet('world'), '|', legacy.VERSION);
console.log(greet('again'));
