import trace from 'node:trace_events';
console.log('=== 08: process.report ===');
console.log('writeReport() returns:', typeof process.report.writeReport(), '->', process.report.writeReport());
console.log('report.directory:', JSON.stringify(process.report.directory));
console.log('report.filename:', JSON.stringify(process.report.filename), '(empty = auto-generated)');
console.log('reportOnFatalError:', process.report.reportOnFatalError, '| reportOnSignal:', process.report.reportOnSignal, '| reportOnUncaughtException:', process.report.reportOnUncaughtException);
const r = JSON.parse(process.report.getReport());
console.log('getReport() top-level keys:', Object.keys(r).join(', '));
console.log('\n=== 08: trace_events categories ===');
for (const cats of [['node'],['node.async_hooks'],['v8'],['node.perf'],['node.bootstrap'],['node.fs.sync'],['bogus.category']]) {
  try { const t = trace.createTracing({categories: cats}); t.enable(); t.disable(); console.log(`  ${cats[0].padEnd(20)} OK`); }
  catch (e) { console.log(`  ${cats[0].padEnd(20)} ${e.code}: ${e.message.slice(0,50)}`); }
}
console.log('getEnabledCategories():', JSON.stringify(trace.getEnabledCategories()));
