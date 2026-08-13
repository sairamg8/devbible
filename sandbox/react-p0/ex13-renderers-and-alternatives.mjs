/**
 * ex13 — Other renderers, and the size of the alternatives.
 *
 * Backs: pages/phase-0-how-react-runs/13-other-renderers.md
 *        pages/phase-0-how-react-runs/14-react-vs-alternatives.md
 *
 * The size table bundles the SAME counter app with each library, minified,
 * through the same esbuild settings — so the numbers are comparable.
 */
import {section, rows} from './harness.mjs';
import * as esbuild from 'esbuild';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const npm = (args) => {
  const raw = JSON.parse(execFileSync('npm', [...args, '--json'], {encoding: 'utf8'}));
  return Array.isArray(raw) ? Object.assign({}, ...raw) : raw;
};

section('renderers that drive the same `react` package');
for (const p of ['react-native', '@react-three/fiber', 'ink', 'react-reconciler', 'react-test-renderer']) {
  try {
    const t = npm(['view', p, 'dist-tags']);
    const time = npm(['view', p, 'time']);
    console.log(`  ${p.padEnd(22)} latest=${String(t.latest).padEnd(12)} published=${(time[t.latest] ?? '').slice(0, 10)}`);
  } catch {
    console.log(`  ${p.padEnd(22)} not published / not found`);
  }
}

section('is react-test-renderer still usable?');
try {
  const d = npm(['view', 'react-test-renderer', 'deprecated']);
  rows({'deprecated field': JSON.stringify(d) === '{}' ? '(none)' : JSON.stringify(d)});
} catch (e) {
  rows({'lookup failed': String(e.message).split('\n')[0]});
}
try {
  const peers = npm(['view', 'react-test-renderer@latest', 'peerDependencies']);
  rows({'peerDependencies': JSON.stringify(peers)});
} catch { /* ignore */ }

// ---------------------------------------------------------------------------

const APPS = {
  react: {
    deps: ['react@19.2.8', 'react-dom@19.2.8'],
    entry: `
      import {useState} from 'react';
      import {createRoot} from 'react-dom/client';
      function Counter(){ const [n,setN]=useState(0);
        return <button onClick={()=>setN(n+1)}>count {n}</button>; }
      createRoot(document.getElementById('root')).render(<Counter/>);`,
    jsx: 'automatic', jsxImportSource: 'react',
  },
  preact: {
    deps: ['preact@latest'],
    entry: `
      import {render} from 'preact';
      import {useState} from 'preact/hooks';
      function Counter(){ const [n,setN]=useState(0);
        return <button onClick={()=>setN(n+1)}>count {n}</button>; }
      render(<Counter/>, document.getElementById('root'));`,
    jsx: 'automatic', jsxImportSource: 'preact',
  },
  // Solid is deliberately absent: it cannot be built with esbuild's JSX
  // transform alone. Its JSX compiles to fine-grained DOM operations via
  // babel-preset-solid, so `jsxImportSource: 'solid-js'` fails with
  // "No matching export in solid-js/dist/solid.js for import jsx".
  // Adding a second toolchain would make the comparison unequal, so the page
  // states that limitation instead of guessing a number.
};

section('the same counter app, minified, one bundler, three libraries');
for (const [name, cfg] of Object.entries(APPS)) {
  const dir = mkdtempSync(join(tmpdir(), `size-${name}-`));
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({name: 'sz', private: true, type: 'module'}));
    execFileSync('npm', ['install', '--silent', '--no-audit', '--no-fund', ...cfg.deps], {cwd: dir, stdio: 'pipe'});
    writeFileSync(join(dir, 'app.jsx'), cfg.entry);
    const out = await esbuild.build({
      entryPoints: [join(dir, 'app.jsx')],
      bundle: true, write: false, format: 'iife', target: 'es2022', minify: true,
      jsx: cfg.jsx, jsxImportSource: cfg.jsxImportSource,
      define: {'process.env.NODE_ENV': '"production"'},
      absWorkingDir: dir,
    });
    const code = out.outputFiles[0].contents;
    const installed = JSON.parse(execFileSync('npm', ['ls', '--json', '--depth=0'], {cwd: dir, encoding: 'utf8'}));
    const versions = Object.entries(installed.dependencies ?? {}).map(([k, v]) => `${k}@${v.version}`).join(' ');
    console.log(
      `  ${name.padEnd(10)} ${(code.length / 1024).toFixed(1).padStart(7)} KB min` +
      `  ${(gzipSync(code).length / 1024).toFixed(1).padStart(6)} KB gzip   ${versions}`,
    );
  } catch (e) {
    console.log(`  ${name.padEnd(10)} failed: ${String(e.message).split('\n')[0]}`);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}
