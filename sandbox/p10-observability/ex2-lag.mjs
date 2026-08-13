import {monitorEventLoopDelay} from 'node:perf_hooks';
const show = (label, h) => console.log(`${label.padEnd(28)} p50 ${(h.percentile(50)/1e6).toFixed(2)}ms  p99 ${(h.percentile(99)/1e6).toFixed(2)}ms  max ${(h.max/1e6).toFixed(2)}ms`);

// resolution 10 = sample every 10ms; the histogram's floor is the resolution itself
const h = monitorEventLoopDelay({resolution: 10});
h.enable();
await new Promise(r => setTimeout(r, 1000));
show('idle (resolution 10)', h);

// block WHILE it is running, then let it sample again
const t0 = Date.now(); while (Date.now() - t0 < 100) {}
await new Promise(r => setTimeout(r, 500));
show('after one 100ms block', h);

// repeated blocks
for (let i = 0; i < 5; i++) {
  const t = Date.now(); while (Date.now() - t < 100) {}
  await new Promise(r => setTimeout(r, 50));
}
show('after 5x 100ms blocks', h);
h.disable();

// finer resolution
const h2 = monitorEventLoopDelay({resolution: 1});
h2.enable();
await new Promise(r => setTimeout(r, 500));
show('idle (resolution 1)', h2);
const t2 = Date.now(); while (Date.now() - t2 < 200) {}
await new Promise(r => setTimeout(r, 300));
show('after one 200ms block', h2);
h2.disable();
