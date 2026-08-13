import trace from 'node:trace_events';
console.log('getReport() returns:', typeof process.report.getReport());
console.log('top-level keys:', Object.keys(process.report.getReport()).join(', '));
for (const c of ['node','node.async_hooks','v8','node.perf','node.bootstrap','node.fs.sync','bogus.category']) {
  try { const t = trace.createTracing({categories: [c]}); t.enable(); console.log(`  ${c.padEnd(18)} enabled -> getEnabledCategories(): ${trace.getEnabledCategories()}`); t.disable(); }
  catch (e) { console.log(`  ${c.padEnd(18)} ${e.code}`); }
}
