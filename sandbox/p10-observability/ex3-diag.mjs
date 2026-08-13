import dc from 'node:diagnostics_channel';
import http from 'node:http';

console.log('=== 07: tracingChannel ===');
console.log('typeof dc.tracingChannel:', typeof dc.tracingChannel);
const tc = dc.tracingChannel('my.op');
console.log('channels:', Object.keys(tc));
console.log('typeof tracePromise:', typeof tc.tracePromise, '| traceSync:', typeof tc.traceSync, '| traceCallback:', typeof tc.traceCallback);
tc.subscribe({
  start: () => console.log('  start'),
  end: () => console.log('  end'),
  asyncStart: () => console.log('  asyncStart'),
  asyncEnd: () => console.log('  asyncEnd'),
  error: (e) => console.log('  error', e.error?.message),
});
await tc.tracePromise(async () => 'done', {job: 1});

console.log('\n=== 07: which built-in channel names actually fire ===');
const seen = new Set();
for (const name of ['http.client.request.start','http.client.request.created','http.client.response.finish',
                    'undici:request:create','undici:request:headers','undici:request:trailers',
                    'http.server.request.start','http.server.response.finish','net.client.socket','dns.lookup.start']) {
  dc.subscribe(name, () => seen.add(name));
}
const srv = http.createServer((req,res)=>res.end('ok'));
await new Promise(r=>srv.listen(0,r));
await fetch(`http://127.0.0.1:${srv.address().port}/`).then(r=>r.text());
await new Promise(r=>setTimeout(r,150));
srv.close();
console.log('fired:', [...seen].sort().join('\n       ') || '(none)');
console.log('hasSubscribers("undici:request:create"):', dc.hasSubscribers('undici:request:create'));
