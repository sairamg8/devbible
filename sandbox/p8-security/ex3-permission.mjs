import {readFileSync} from 'node:fs';
try { readFileSync('/etc/passwd', 'utf8'); console.log('read /etc/passwd: ALLOWED'); }
catch (e) { console.log('read /etc/passwd ->', e.code, '|', e.message.split('\n')[0]); }
try { const r = await fetch('http://127.0.0.1:1/'); } 
catch (e) { console.log('fetch ->', e.code ?? e.name, '|', (e.message||'').split('\n')[0]); }
console.log('process.permission?', typeof process.permission);
if (process.permission) {
  for (const p of ['fs.read','fs.write','net','child','worker'])
    console.log(`  has(${p}) =`, process.permission.has(p));
  console.log('  has(fs.read, /tmp) =', process.permission.has('fs.read', '/tmp'));
}
