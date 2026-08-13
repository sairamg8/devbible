/**
 * ex02 — what `{}` can hold, and what React does with each value.
 *
 * Backs page 02 (embedding expressions) and page 03 (what can be rendered).
 *
 * Every value is rendered into its own root with `flushSync`, so the render is
 * synchronous and the resulting markup — or the thrown error — is captured
 * immediately. `onUncaughtError` is React 19's supported way to intercept a
 * render error without the browser's console noise swallowing it.
 */
import {runApp, section, printLogs} from './harness.mjs';

const SRC = `
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';

const cases = [
  ['null',            null],
  ['undefined',       undefined],
  ['false',           false],
  ['true',            true],
  ["'' (empty string)", ''],
  ['0',               0],
  ['NaN',             NaN],
  ['-0',              -0],
  ['42',              42],
  ["'text'",          'text'],
  ['[] (empty array)', []],
  ["['a', 'b']",      ['a', 'b']],
  ["['a', null, 'b']", ['a', null, 'b']],
  ["[['a'], ['b']] nested", [['a'], ['b']]],
  ['<b>elem</b>',     <b>elem</b>],
  ['new Set(["x","y"])', new Set(['x', 'y'])],
  ['a generator',     (function* () { yield 'g1'; yield 'g2'; })()],
  ['{a: 1}',          {a: 1}],
  ['new Date()',      new Date(0)],
  ['new Map([["k","v"]])', new Map([['k', 'v']])],
  ['10n (bigint)',    10n],
  ['Symbol("s")',     Symbol('s')],
  ['() => "fn"',      () => 'fn'],
  ['Promise.resolve(1)', Promise.resolve(1)],
];

for (const [label, value] of cases) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  let err = null;
  const root = createRoot(host, {
    onUncaughtError: (e) => { err = e; },
    onRecoverableError: () => {},
  });
  try {
    flushSync(() => root.render(<span>{value}</span>));
  } catch (e) {
    err = e;
  }
  if (err) {
    console.log(label.padEnd(24) + ' THROWS  ' + err.message.split('\\n')[0]);
  } else {
    console.log(label.padEnd(24) + ' -> ' + JSON.stringify(host.innerHTML));
  }
  try { root.unmount(); } catch {}
}

// The && trap, rendered rather than described.
const host2 = document.createElement('div');
document.body.appendChild(host2);
const list = [];
const text = '';
createRoot(host2).render(
  <div>
    <p>{list.length && 'has items'}</p>
    <p>{list.length > 0 && 'has items'}</p>
    <p>{text && 'has text'}</p>
    <p>{list.length ? 'has items' : null}</p>
  </div>
);
setTimeout(() => console.log('&& trap: ' + host2.innerHTML), 50);
`;

section('what a JSX expression slot renders (production build)');
const {logs, ua} = await runApp(SRC, {mode: 'production', wait: 600});
printLogs(logs, {prefix: '  '});
console.log(`\n  engine: ${ua}`);

section('the same values in a development build — full messages and warnings');
const dev = await runApp(SRC, {mode: 'development', wait: 600});
const noise = new Set(['timeStamp', 'info', 'debug']);
printLogs(
  dev.logs.filter((l) => !noise.has(l.type) && !/^(null|undefined|false|true|'|0|NaN|-0|42|\[|<b|new |a gen|10n|Symbol|\(\)|Promise|&&)/.test(l.text)),
  {prefix: '  '},
);
section('dev: the three values that only complain in development');
printLogs(
  dev.logs.filter((l) => /^(\{a: 1\}|new Date|Symbol|\(\) =>|Promise)/.test(l.text)),
  {prefix: '  '},
);
