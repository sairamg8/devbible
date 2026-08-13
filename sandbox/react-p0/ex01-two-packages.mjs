/**
 * ex01 — What React is: two packages, and what each one contains.
 *
 * Backs: pages/phase-0-how-react-runs/01-what-react-is.md
 */
import {section, rows} from './harness.mjs';
import {readFileSync, statSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);

section('versions');
rows({
  react: require('react/package.json').version,
  'react-dom': require('react-dom/package.json').version,
  node: process.version,
});

section('react exports — the whole public surface');
const R = require('react');
console.log(
  '  ' +
    Object.keys(R)
      .filter((k) => !k.startsWith('__'))
      .sort()
      .join(' '),
);
console.log(`  (${Object.keys(R).filter((k) => !k.startsWith('__')).length} public exports)`);

section('does `react` know how to put anything on screen?');
rows({
  'typeof React.render': typeof R.render,
  'typeof React.createRoot': typeof R.createRoot,
  'typeof React.createElement': typeof R.createElement,
  // require.resolve() on this subpath throws ERR_PACKAGE_PATH_NOT_EXPORTED —
  // `exports` does not list ./cjs/*. Read the file directly.
  "'document.createElement' anywhere in react's source": readFileSync(
    join(process.cwd(), 'node_modules/react/cjs/react.development.js'),
    'utf8',
  ).includes('document.createElement'),
});

section('react-dom entry points');
for (const entry of ['react-dom', 'react-dom/client', 'react-dom/server', 'react-dom/static']) {
  const keys = Object.keys(require(entry))
    .filter((k) => !k.startsWith('__'))
    .sort();
  console.log(`  ${entry.padEnd(18)} ${keys.join(' ')}`);
}

section('installed size on disk');
function dirSize(dir) {
  let total = 0;
  for (const e of readdirSync(dir, {withFileTypes: true})) {
    const p = join(dir, e.name);
    total += e.isDirectory() ? dirSize(p) : statSync(p).size;
  }
  return total;
}
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
rows({
  'react/': kb(dirSize(join(process.cwd(), 'node_modules/react'))),
  'react-dom/': kb(dirSize(join(process.cwd(), 'node_modules/react-dom'))),
  ratio: (
    dirSize(join(process.cwd(), 'node_modules/react-dom')) /
    dirSize(join(process.cwd(), 'node_modules/react'))
  ).toFixed(1) + '×',
});

section('the version-match rule');
const pkg = require('react-dom/package.json');
rows({
  'react-dom peerDependencies.react': pkg.peerDependencies.react,
  'react-dom version': pkg.version,
});
