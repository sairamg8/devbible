import { enableCompileCache, getCompileCacheDir } from 'node:module';
const r = enableCompileCache();
console.log('status:', r.status === 1 ? 'ENABLED' : r.status, '| dir:', getCompileCacheDir()?.includes('node-compile-cache'));
