import { isBuiltin } from 'node:module';
console.log(isBuiltin('fs'), isBuiltin('node:fs'), isBuiltin('express'));
