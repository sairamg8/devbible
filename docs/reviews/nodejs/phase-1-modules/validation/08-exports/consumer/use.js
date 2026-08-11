import { name } from 'toolkit';
import { parse } from 'toolkit/parse';
console.log(name, '|', parse('  a  b  c '));
try { await import('toolkit/src/secret.js'); }
catch (e) { console.log('deep import blocked →', e.code); }
try { await import('toolkit/src/index.js'); }
catch (e) { console.log('even the real path is blocked →', e.code); }
