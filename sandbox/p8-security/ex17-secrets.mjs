// Phase 8 page 18 — secrets handling. Node 24.19.0.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import util from 'node:util';

const line = (t) => console.log(`\n=== ${t} ===`);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'secrets-'));
const envFile = path.join(dir, '.env');
fs.writeFileSync(envFile, [
  'DB_PASSWORD=hunter2',
  'QUOTED="with spaces"',
  "SINGLE='single quoted'",
  'EMPTY=',
  '# a comment',
  'SPACED = padded ',
  'EXPANDS=${DB_PASSWORD}-suffix',
  'MULTILINE="line1\nline2"',
  'export EXPORTED=yes',
  'NO_EQUALS_LINE',
].join('\n'));

const child = (args, env = {}) =>
  spawnSync(process.execPath, args, { env: { ...process.env, ...env }, encoding: 'utf8' });

line('1. what --env-file actually parses');
const probe = path.join(dir, 'probe.mjs');
fs.writeFileSync(probe, `
const keys = ['DB_PASSWORD','QUOTED','SINGLE','EMPTY','SPACED','EXPANDS','MULTILINE','EXPORTED','NO_EQUALS_LINE'];
for (const k of keys) console.log(k.padEnd(16), JSON.stringify(process.env[k]));
`);
console.log(child(['--env-file', envFile, probe]).stdout.trim());

line('2. precedence: does --env-file overwrite a real env var?');
const one = path.join(dir, 'one.mjs');
fs.writeFileSync(one, 'console.log(JSON.stringify(process.env.DB_PASSWORD));');
console.log('real env set to "from-shell" ->',
  child(['--env-file', envFile, one], { DB_PASSWORD: 'from-shell' }).stdout.trim());
console.log('real env unset               ->',
  child(['--env-file', envFile, one]).stdout.trim());

line('3. a missing file: --env-file vs --env-file-if-exists');
const missing = path.join(dir, 'nope.env');
const a = child(['--env-file', missing, one]);
console.log('--env-file           -> status', a.status, '|', (a.stderr.split('\n').find((l) => l.includes('Error')) || '').trim());
const b = child(['--env-file-if-exists', missing, one]);
console.log('--env-file-if-exists -> status', b.status, '| stdout', b.stdout.trim());

line('4. process.loadEnvFile() — the runtime equivalent');
const loader = path.join(dir, 'loader.mjs');
fs.writeFileSync(loader, `
console.log('before:', JSON.stringify(process.env.DB_PASSWORD));
process.loadEnvFile(${JSON.stringify(envFile)});
console.log('after: ', JSON.stringify(process.env.DB_PASSWORD));
try { process.loadEnvFile('/nope/.env'); } catch (e) { console.log('missing file ->', e.code); }
`);
console.log(child([loader]).stdout.trim());

line('5. the secret is visible to anyone who can read the process');
const leaky = path.join(dir, 'leaky.mjs');
fs.writeFileSync(leaky, `
import fs from 'node:fs';
const environ = fs.readFileSync('/proc/self/environ', 'utf8').split('\\0');
console.log('own /proc/self/environ ->', environ.find((l) => l.startsWith('DB_PASSWORD=')));
console.log('cmdline                ->', fs.readFileSync('/proc/self/cmdline','utf8').split('\\0').filter(Boolean).slice(0,3).join(' '));
`);
console.log(child(['--env-file', envFile, leaky]).stdout.trim());

line('6. children inherit everything by default');
const parent = path.join(dir, 'parent.mjs');
const kid = path.join(dir, 'kid.mjs');
fs.writeFileSync(kid, "console.log('  child sees DB_PASSWORD:', JSON.stringify(process.env.DB_PASSWORD));");
fs.writeFileSync(parent, `
import { spawnSync } from 'node:child_process';
const run = (env, label) => { console.log(label); console.log(spawnSync(process.execPath, [${JSON.stringify(kid)}], { env, encoding: 'utf8' }).stdout.trim()); };
run(process.env, 'default (env omitted / inherited):');
run({ PATH: process.env.PATH }, 'explicit allowlist:');
`);
console.log(child(['--env-file', envFile, parent]).stdout.trim());

line('7. how secrets escape into logs');
const conf = { db: { host: 'db.internal', password: 'hunter2' }, apiKey: 'sk-live-abc123' };
console.log('console.log(obj)      ->', util.inspect(conf, { depth: null }).replace(/\n\s*/g, ' '));
console.log('JSON.stringify(obj)   ->', JSON.stringify(conf));
console.log('template in a URL     ->', `postgres://app:${conf.db.password}@db.internal:5432/app`);

const REDACT = new Set(['password', 'apikey', 'token', 'secret', 'authorization', 'cookie']);
const redact = (v) => {
  if (Array.isArray(v)) return v.map(redact);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, val]) =>
      [k, REDACT.has(k.toLowerCase()) ? '[redacted]' : redact(val)]));
  }
  return v;
};
console.log('redacted              ->', JSON.stringify(redact(conf)));

line('8. a class that refuses to print itself');
class Secret {
  #value;
  constructor(v) { this.#value = v; }
  expose() { return this.#value; }
  toString() { return '[redacted]'; }
  toJSON() { return '[redacted]'; }
  [util.inspect.custom]() { return 'Secret([redacted])'; }
}
const s = new Secret('hunter2');
console.log('console.log      ->', util.inspect(s));
console.log('template literal ->', `${s}`);
console.log('JSON.stringify   ->', JSON.stringify({ pw: s }));
console.log('but .expose()    ->', s.expose());

line('9. errors carry more than the message');
try {
  const err = new Error('connect failed');
  err.config = { url: 'postgres://app:hunter2@db.internal/app' };
  throw err;
} catch (e) {
  console.log('e.message            ->', e.message);
  console.log('JSON.stringify(err)  ->', JSON.stringify({ message: e.message, ...e }));
  console.log('util.inspect(err)    ->', util.inspect(e, { depth: 1 }).split('\n').filter((l) => l.includes('url')).join('').trim());
}

line('10. git: the delete does not delete');
const repo = path.join(dir, 'repo');
fs.mkdirSync(repo);
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
git('init', '-q');
git('config', 'user.email', 'x@y.z'); git('config', 'user.name', 'x');
fs.writeFileSync(path.join(repo, '.env'), 'API_KEY=sk-live-abc123\n');
git('add', '-A'); git('commit', '-qm', 'oops');
fs.rmSync(path.join(repo, '.env'));
fs.writeFileSync(path.join(repo, '.gitignore'), '.env\n');
git('add', '-A'); git('commit', '-qm', 'remove the secret and gitignore it');
console.log('working tree      ->', fs.existsSync(path.join(repo, '.env')) ? '.env present' : '.env gone');
console.log('git log --all -S  ->', git('log', '--all', '--oneline', '-S', 'sk-live-abc123').split('\n').length, 'commit(s) still contain it');
console.log('git show HEAD~1   ->', git('show', 'HEAD~1:.env'));

fs.rmSync(dir, { recursive: true, force: true });
