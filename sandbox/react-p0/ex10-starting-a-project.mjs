/**
 * ex10 — Starting a React project in 2026: what the tools actually produce.
 *
 * Really scaffolds a Vite app, really builds it, and reports the real output
 * sizes. Also checks what create-react-app does now.
 *
 * Backs: pages/phase-0-how-react-runs/10-starting-a-project.md
 */
import {section, rows} from './harness.mjs';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, rmSync, readdirSync, statSync, readFileSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, relative} from 'node:path';

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});

const root = mkdtempSync(join(tmpdir(), 'react-start-'));
const app = join(root, 'shop');

section('scaffolding: npm create vite@latest shop -- --template react-ts');
run('npm', ['create', 'vite@latest', 'shop', '--', '--template', 'react-ts', '--yes'], root);

function tree(dir, prefix = '', depth = 0) {
  if (depth > 2) return;
  for (const e of readdirSync(dir, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    console.log(`  ${prefix}${e.name}${e.isDirectory() ? '/' : ''}`);
    if (e.isDirectory()) tree(join(dir, e.name), prefix + '  ', depth + 1);
  }
}
console.log('  what you get:');
tree(app);

section('the dependencies it pins');
const pkg = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'));
rows({...pkg.dependencies, '--- dev ---': '', ...pkg.devDependencies});

section('installing and building for real');
run('npm', ['install', '--silent', '--no-audit', '--no-fund'], app);
const buildLog = run('npm', ['run', 'build'], app);
console.log(buildLog.trim().split('\n').map((l) => '  ' + l).join('\n'));

section('what actually ships');
const dist = join(app, 'dist');
let total = 0;
const walk = (d) => {
  for (const e of readdirSync(d, {withFileTypes: true})) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else { const s = statSync(p).size; total += s; console.log(`  ${relative(dist, p).padEnd(34)} ${(s / 1024).toFixed(1)} KB`); }
  }
};
walk(dist);
rows({'total dist/': `${(total / 1024).toFixed(1)} KB`});

section('is the production build really production?');
const jsFile = readdirSync(join(dist, 'assets')).find((f) => f.endsWith('.js'));
const js = readFileSync(join(dist, 'assets', jsFile), 'utf8');
rows({
  'bundle': jsFile,
  'occurrences of "Warning:"': (js.match(/Warning:/g) ?? []).length,
  'contains react-devtools message': js.includes('Download the React DevTools'),
  'verdict': (js.match(/Warning:/g) ?? []).length === 0 ? 'production build' : 'DEV BUILD SHIPPED',
});

section('what does create-react-app do now?');
try {
  const out = run('npm', ['view', 'create-react-app', 'time.modified', 'deprecated', '--json'], root);
  console.log('  ' + out.trim().split('\n').join('\n  '));
} catch (e) {
  console.log('  ' + String(e.stderr ?? e.message).trim().split('\n')[0]);
}

rmSync(root, {recursive: true, force: true});
