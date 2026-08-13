import {exec, execFile, spawn} from 'node:child_process';
import {promisify} from 'node:util';
const execP = promisify(exec), execFileP = promisify(execFile);
const hostile = 'report.txt; id';

console.log('=== exec() — shell is involved ===');
try { const {stdout} = await execP(`cat /etc/hostname ${hostile}`); console.log(stdout.trim().split('\n').slice(0,3).join(' | ')); }
catch (e) { console.log('exec output:', (e.stdout||'').trim().split('\n').slice(0,3).join(' | '), '| stderr:', (e.stderr||'').trim().slice(0,60)); }

console.log('\n=== execFile() — no shell ===');
try { await execFileP('cat', ['/etc/hostname', hostile]); }
catch (e) { console.log('rejected ->', (e.stderr||e.message).trim().slice(0,80)); }

console.log('\n=== spawn with shell:true reintroduces it ===');
await new Promise((r) => {
  const p = spawn('cat', ['/etc/hostname', hostile], {shell: true});
  let out = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
  p.on('close', () => { console.log(out.trim().split('\n').slice(0,3).join(' | ')); r(); });
});
console.log('\n=== which metacharacters matter ===');
for (const payload of ['a; id', 'a && id', 'a | id', 'a $(id)', 'a `id`', 'a\nid']) {
  try { const {stdout} = await execP(`echo ${payload}`); console.log(`  ${JSON.stringify(payload).padEnd(12)} -> ${stdout.trim().replace(/\n/g,' / ').slice(0,60)}`); } catch(e) {}
}
