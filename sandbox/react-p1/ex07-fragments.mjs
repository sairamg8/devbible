/**
 * ex07 — fragments. Backs page 08.
 *
 * Two things worth measuring: what a fragment does and does not put in the DOM,
 * and what React says when you try to give one a prop other than `key`.
 */
import {runApp, section, printLogs} from './harness.mjs';

const SRC = `
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Fragment} from 'react';

const show = (label, element) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host, {onUncaughtError: (e) => console.log(label.padEnd(30) + 'THROWS ' + e.message.split('\\n')[0])});
  flushSync(() => root.render(element));
  console.log(label.padEnd(30) + host.innerHTML);
};

const Two = () => <><b>one</b><i>two</i></>;
const TwoDiv = () => <div><b>one</b><i>two</i></div>;

console.log('--- what reaches the DOM ---');
show('<>…</>',            <section><Two /></section>);
show('<div>…</div>',      <section><TwoDiv /></section>);
show('<Fragment>…</Fragment>', <section><Fragment><b>one</b><i>two</i></Fragment></section>);
show('empty fragment',    <section><></></section>);
show('fragment with text', <section><>{'a'}{'b'}</></section>);

console.log('--- the case the shorthand cannot cover ---');
const pairs = [{id: 'p1', k: 'Name', v: 'Ada'}, {id: 'p2', k: 'Role', v: 'Eng'}];
show('keyed Fragment in a map', <dl>{pairs.map(p => <Fragment key={p.id}><dt>{p.k}</dt><dd>{p.v}</dd></Fragment>)}</dl>);
show('wrapper div in a map',    <dl>{pairs.map(p => <div key={p.id}><dt>{p.k}</dt><dd>{p.v}</dd></div>)}</dl>);

console.log('--- a fragment where the parent cares about its children ---');
const Cells = () => <><td>a</td><td>b</td></>;
const CellsDiv = () => <div><td>a</td><td>b</td></div>;
show('fragment inside <tr>', <table><tbody><tr><Cells /></tr></tbody></table>);
show('div inside <tr>',      <table><tbody><tr><CellsDiv /></tr></tbody></table>);

console.log('--- props other than key ---');
show('<Fragment className>', <Fragment className="x"><b>one</b></Fragment>);
show('<Fragment onClick>',   <Fragment onClick={() => {}}><b>one</b></Fragment>);
show('<Fragment key + children>', <Fragment key="k"><b>one</b></Fragment>);
`;

section('fragments — rendered markup (production build)');
const prod = await runApp(SRC, {mode: 'production', wait: 400});
printLogs(prod.logs, {prefix: '  '});
console.log(`\n  engine: ${prod.ua}`);

section('development build — the messages');
const noise = new Set(['timeStamp', 'info', 'debug']);
const dev = await runApp(SRC, {mode: 'development', wait: 400});
printLogs(dev.logs.filter((l) => !noise.has(l.type) && l.type !== 'log'), {prefix: '  '});

// Only `className` warned above. Is `onClick` allowed, or was the warning
// deduped? Run it on its own and find out — never guess from a silent log.
section('is the onClick warning missing, or just deduped?');
const solo = await runApp(
  `import {createRoot} from 'react-dom/client';
   import {Fragment} from 'react';
   const host = document.createElement('div');
   document.body.appendChild(host);
   createRoot(host).render(<Fragment onClick={() => {}}><b>one</b></Fragment>);`,
  {mode: 'development', wait: 400},
);
printLogs(solo.logs.filter((l) => !noise.has(l.type)), {prefix: '  '});
