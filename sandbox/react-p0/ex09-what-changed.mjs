/**
 * ex09 — What React 19 and 19.2 added, derived by diffing real export lists.
 *
 * Installs React 18.3.1, 19.0.8 and 19.2.8 side by side and compares
 * Object.keys(). This is what actually changed in the public surface, rather
 * than what a blog post says changed.
 *
 * Backs: pages/phase-0-how-react-runs/09-what-changed-in-19.md
 */
import {section, rows} from './harness.mjs';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const VERSIONS = ['18.3.1', '19.0.8', '19.2.8'];

function exportsOf(version) {
  const dir = mkdtempSync(join(tmpdir(), `react-${version}-`));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({name: 'probe', private: true}));
  execFileSync('npm', ['install', '--silent', '--no-audit', '--no-fund',
                       `react@${version}`, `react-dom@${version}`], {cwd: dir, stdio: 'pipe'});
  const script = `
    const out = {};
    for (const e of ['react', 'react-dom', 'react-dom/client', 'react-dom/server', 'react-dom/static']) {
      try { out[e] = Object.keys(require(e)).filter(k => !k.startsWith('__')).sort(); }
      catch { out[e] = null; }
    }
    process.stdout.write(JSON.stringify(out));
  `;
  const json = execFileSync('node', ['-e', script], {cwd: dir, encoding: 'utf8'});
  rmSync(dir, {recursive: true, force: true});
  return JSON.parse(json);
}

const data = {};
for (const v of VERSIONS) {
  process.stderr.write(`installing react@${v}…\n`);
  data[v] = exportsOf(v);
}

const diff = (a, b) => ({
  added: b.filter((k) => !a.includes(k)),
  removed: a.filter((k) => !b.includes(k)),
});

section('surface size per entry point');
for (const entry of ['react', 'react-dom', 'react-dom/client', 'react-dom/server', 'react-dom/static']) {
  const line = VERSIONS.map((v) => `${v}: ${data[v][entry] ? data[v][entry].length : '—'}`).join('   ');
  console.log(`  ${entry.padEnd(18)} ${line}`);
}

section('React 18.3.1 -> 19.0.8');
for (const entry of ['react', 'react-dom', 'react-dom/server', 'react-dom/static']) {
  const a = data['18.3.1'][entry], b = data['19.0.8'][entry];
  if (!a || !b) { console.log(`  ${entry}: ${!a ? 'did not exist in 18' : 'gone in 19'}`); continue; }
  const d = diff(a, b);
  if (d.added.length) console.log(`  ${entry}  + ${d.added.join(' ')}`);
  if (d.removed.length) console.log(`  ${entry}  - ${d.removed.join(' ')}`);
}

section('React 19.0.8 -> 19.2.8');
for (const entry of ['react', 'react-dom', 'react-dom/server', 'react-dom/static']) {
  const d = diff(data['19.0.8'][entry], data['19.2.8'][entry]);
  if (d.added.length) console.log(`  ${entry}  + ${d.added.join(' ')}`);
  if (d.removed.length) console.log(`  ${entry}  - ${d.removed.join(' ')}`);
}

section('still exported in 19.2.8 but deprecated');
rows({
  'react-dom useFormState': data['19.2.8']['react-dom'].includes('useFormState')
    ? 'present — renamed to useActionState, which lives in `react`'
    : 'gone',
  'react useActionState': data['19.2.8']['react'].includes('useActionState'),
});
