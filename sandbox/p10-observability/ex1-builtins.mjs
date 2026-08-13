import {monitorEventLoopDelay, PerformanceObserver} from 'node:perf_hooks';
import v8 from 'node:v8';
import os from 'node:os';

console.log('=== 13: memoryUsage() fields (bytes) ===');
console.log(process.memoryUsage());
console.log('memoryUsage.rss() ->', process.memoryUsage.rss());
console.log('resourceUsage keys:', Object.keys(process.resourceUsage()).slice(0,6).join(', '));

console.log('\n=== 09: event loop lag ===');
const h = monitorEventLoopDelay({resolution: 10});
h.enable();
await new Promise(r => setTimeout(r, 1000));
console.log(`idle -> min ${(h.min/1e6).toFixed(2)}ms p50 ${(h.percentile(50)/1e6).toFixed(2)}ms p99 ${(h.percentile(99)/1e6).toFixed(2)}ms max ${(h.max/1e6).toFixed(2)}ms`);
h.reset();
const t0 = Date.now(); while (Date.now() - t0 < 100) {}
await new Promise(r => setTimeout(r, 300));
console.log(`after 100ms sync block -> p50 ${(h.percentile(50)/1e6).toFixed(2)}ms p99 ${(h.percentile(99)/1e6).toFixed(2)}ms max ${(h.max/1e6).toFixed(2)}ms`);
h.disable();

console.log('\n=== 12: GC PerformanceObserver entry shape ===');
await new Promise((resolve) => {
  const obs = new PerformanceObserver((list) => {
    const e = list.getEntries()[0];
    console.log('entryType:', e.entryType, '| name:', e.name, '| duration:', e.duration.toFixed(3));
    console.log('detail:', JSON.stringify(e.detail));
    obs.disconnect(); resolve();
  });
  obs.observe({entryTypes: ['gc']});
  const junk = []; for (let i=0;i<2e6;i++) junk.push({i}); junk.length = 0;
  globalThis.gc?.();
  setTimeout(resolve, 2000);
});

console.log('\n=== 17: v8.writeHeapSnapshot return value ===');
const snap = v8.writeHeapSnapshot();
console.log('returns:', typeof snap, '->', snap);
console.log('heap_size_limit MB:', (v8.getHeapStatistics().heap_size_limit/1048576).toFixed(0));
console.log('\n=== 21: heap sizing ===');
console.log('os.totalmem MB:', (os.totalmem()/1048576).toFixed(0));

console.log('\n=== 23: enableCompileCache ===');
const mod = await import('node:module');
console.log('typeof enableCompileCache:', typeof mod.enableCompileCache);
if (typeof mod.enableCompileCache === 'function') {
  console.log('enableCompileCache() ->', JSON.stringify(mod.enableCompileCache()));
  console.log('getCompileCacheDir() ->', mod.getCompileCacheDir?.());
}
