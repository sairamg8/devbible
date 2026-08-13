import {monitorEventLoopDelay} from 'node:perf_hooks';
const h = monitorEventLoopDelay({resolution: 1}); h.enable();
const line = JSON.stringify({level:'info', msg:'x'.repeat(500)}) + '\n';
const t0 = performance.now();
for (let i = 0; i < 20000; i++) process.stdout.write(line);
const ms = performance.now() - t0;
await new Promise(r => setTimeout(r, 200));
process.stderr.write(`\n20000 writes took ${Math.round(ms)} ms | loop max lag ${(h.max/1e6).toFixed(1)} ms | stdout isTTY=${!!process.stdout.isTTY}\n`);
h.disable();
