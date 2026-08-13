// Phase 8 page 24 — the Permission Model. Node 24.19.0. Run with plain `node ex22-permission-model.mjs`.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const line = (t) => console.log(`\n=== ${t} ===`);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'perm-'));
const write = (name, src) => { const p = path.join(dir, name); fs.writeFileSync(p, src); return p; };

const run = (args, label) => {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', cwd: dir });
  const out = (r.stdout || '').trim();
  const err = (r.stderr || '').trim();
  const code = (err.match(/code: '([A-Z_]+)'/) || [])[1]
    || (err.match(/Error: ([^\n]+)/) || [])[1]
    || '';
  console.log(String(label).padEnd(46), `exit ${r.status}`,
    out ? `| ${out.split('\n').join(' ')}` : '', code ? `| ${code.slice(0, 70)}` : '');
  return r;
};

line('1. process.permission — what the flag turns on');
const probe = write('probe.mjs', `
console.log(JSON.stringify({
  has: typeof process.permission,
  fsRead: process.permission?.has('fs.read'),
  fsWrite: process.permission?.has('fs.write'),
  child: process.permission?.has('child'),
  worker: process.permission?.has('worker'),
  net: process.permission?.has('net'),
  addon: process.permission?.has('addon'),
  wasi: process.permission?.has('wasi'),
}));
`);
run([probe], 'no flags');
run(['--permission', probe], '--permission');
run(['--permission', '--allow-fs-read=*', probe], '--permission --allow-fs-read=*');

line('2. reading a file');
fs.writeFileSync(path.join(dir, 'data.txt'), 'secret contents');
const reader = write('read.mjs', `
import fs from 'node:fs';
console.log('read ->', fs.readFileSync(process.argv[2], 'utf8').slice(0, 20));
`);
run([reader, path.join(dir, 'data.txt')], 'no --permission');
run(['--permission', reader, path.join(dir, 'data.txt')], '--permission, no allow');
run(['--permission', `--allow-fs-read=${dir}/data.txt`, reader, path.join(dir, 'data.txt')], 'allow that exact file');
run(['--permission', `--allow-fs-read=${dir}/data.txt`, reader, '/etc/passwd'], 'same allow, reads /etc/passwd');

line('3. --allow-fs-read is a path prefix, and * is a wildcard');
run(['--permission', `--allow-fs-read=${dir}/*`, reader, path.join(dir, 'data.txt')], `--allow-fs-read=${'<dir>'}/*`);
run(['--permission', `--allow-fs-read=${dir}`, reader, path.join(dir, 'data.txt')], '--allow-fs-read=<dir> (no slash)');

line('4. child processes and workers are separate switches');
const spawner = write('spawn.mjs', `
import { spawnSync } from 'node:child_process';
const r = spawnSync('/bin/echo', ['child ran'], { encoding: 'utf8' });
console.log('spawn ->', (r.stdout || '').trim() || r.error?.code);
`);
run(['--permission', `--allow-fs-read=${dir}/*`, spawner], 'spawn without --allow-child-process');
run(['--permission', `--allow-fs-read=${dir}/*`, '--allow-child-process', spawner], 'spawn with --allow-child-process');

line('5. THE POINT: network is NOT restricted on Node 24');
const fetcher = write('fetch.mjs', `
import net from 'node:net';
import dns from 'node:dns';
const r = await new Promise((resolve) => {
  const s = net.connect(80, 'example.com', () => { s.end(); resolve('TCP CONNECT SUCCEEDED'); });
  s.on('error', (e) => resolve('blocked: ' + e.code));
  setTimeout(() => { s.destroy(); resolve('timeout'); }, 4000);
});
console.log('outbound ->', r);
console.log('dns      ->', await dns.promises.resolve4('example.com').then((a) => a[0]).catch((e) => e.code));
`);
run(['--permission', `--allow-fs-read=${dir}/*`, fetcher], 'fully locked down except fs.read');
console.log('  There is no --allow-net on Node 24. Network access cannot be restricted,');
console.log('  so the Permission Model CANNOT contain SSRF (page 12) or data exfiltration.');

line('6. what else is not covered');
const envProbe = write('env.mjs', `
console.log('env vars readable ->', Object.keys(process.env).length);
console.log('process.env.HOME  ->', JSON.stringify(process.env.HOME));
console.log('argv readable     ->', process.argv.length > 1);
`);
run(['--permission', `--allow-fs-read=${dir}/*`, envProbe], 'environment under --permission');

line('7. the flags cannot be re-granted at runtime');
const escalate = write('escalate.mjs', `
import fs from 'node:fs';
try { process.permission.deny; } catch {}
console.log('has deny() ->', typeof process.permission.deny);
try { fs.readFileSync('/etc/hostname'); console.log('read /etc/hostname -> ALLOWED'); }
catch (e) { console.log('read /etc/hostname ->', e.code); }
`);
run(['--permission', `--allow-fs-read=${dir}/*`, escalate], 'runtime narrowing only');

line('8. addons and WASI are off by default');
const addonProbe = write('addon.mjs', `
try { process.dlopen({ exports: {} }, '/nonexistent.node'); }
catch (e) { console.log('dlopen ->', e.code || e.message.slice(0, 40)); }
`);
run(['--permission', `--allow-fs-read=${dir}/*`, addonProbe], 'process.dlopen under --permission');

fs.rmSync(dir, { recursive: true, force: true });
