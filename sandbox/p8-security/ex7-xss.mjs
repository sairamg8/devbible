// 1. JSON.stringify does NOT escape </script>
const user = {name: '</script><script>alert(1)</script>'};
console.log('embedded in a <script> block:');
console.log('  <script>window.__USER__ = ' + JSON.stringify(user) + ';</script>');
console.log('  -> the </script> above terminates the block early\n');
const safe = JSON.stringify(user).replace(/</g, '\\u003c');
console.log('with < escaped as \\u003c:');
console.log('  <script>window.__USER__ = ' + safe + ';</script>');
console.log('  JSON.parse still works:', JSON.parse(safe.replace(/\\u003c/g,'<')).name.slice(0,12), '\n');

// 2. JSON.stringify also leaves U+2028/2029 which are line terminators in JS
const sep = JSON.stringify({s: 'a b'});
console.log('U+2028 survives JSON.stringify:', JSON.stringify(sep));

// 3. Content-Type decides whether markup executes
import http from 'node:http';
const payload = '<script>alert(1)</script>';
const srv = http.createServer((req, res) => {
  if (req.url === '/html') { res.setHeader('content-type','text/html'); res.end(payload); }
  else if (req.url === '/plain') { res.setHeader('content-type','text/plain'); res.end(payload); }
  else { res.end(payload); }   // no content-type set
});
await new Promise(r => srv.listen(0, r));
const port = srv.address().port;
for (const p of ['/html','/plain','/none']) {
  const r = await fetch(`http://127.0.0.1:${port}${p}`);
  console.log(`  ${p.padEnd(7)} -> content-type: ${r.headers.get('content-type') ?? '(none)'}`);
}
srv.close();
