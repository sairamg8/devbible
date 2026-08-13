const data = Array.from({length: 1000}, (_, i) => ({qty: (i % 5) + 1, priceMinor: 1000 + i}));
function total(lines) { let t = 0; for (const l of lines) t += l.qty * l.priceMinor; return t; }

// Naive: time one run, cold
let t0 = performance.now(); total(data); let cold = performance.now() - t0;

// After warm-up
for (let i = 0; i < 20000; i++) total(data);
t0 = performance.now(); total(data); const warm = performance.now() - t0;
console.log(`cold: ${cold.toFixed(4)}ms  warm: ${warm.toFixed(4)}ms  ratio: ${(cold/warm).toFixed(1)}x`);

// The loop the engine can delete entirely
function deadWork() { let x = 0; for (let i = 0; i < 1e7; i++) x += i; }
t0 = performance.now(); deadWork(); const dead = performance.now() - t0;
function keptWork() { let x = 0; for (let i = 0; i < 1e7; i++) x += i; return x; }
t0 = performance.now(); const r = keptWork(); const kept = performance.now() - t0;
console.log(`result discarded: ${dead.toFixed(2)}ms   result returned: ${kept.toFixed(2)}ms  (sum ${r})`);
