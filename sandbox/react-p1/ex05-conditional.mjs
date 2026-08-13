/**
 * ex05 — conditional rendering, and the `&&` trap measured rather than asserted.
 * Backs page 06.
 *
 * Part 2 is the part people miss: which branch you write decides whether the
 * component keeps its state, because a conditional is a position in the tree.
 */
import {runApp, section, printLogs} from './harness.mjs';

const SRC = `
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {useState} from 'react';

const show = (label, element) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  flushSync(() => createRoot(host).render(element));
  console.log(label.padEnd(34) + JSON.stringify(host.innerHTML));
};

console.log('--- what the left side of && leaves on screen ---');
for (const [label, v] of [
  ['[].length      (0)', [].length],
  ['[1,2].length   (2)', [1, 2].length],
  ["''             (empty string)", ''],
  ['"hi"', 'hi'],
  ['0', 0],
  ['NaN', NaN],
  ['null', null],
  ['undefined', undefined],
  ['false', false],
  ['-0', -0],
  ['0n (bigint)', 0n],
]) {
  show(label + ' && <b>YES</b>', <span>{v && <b>YES</b>}</span>);
}

console.log('--- the four ways to write the same condition ---');
const items = [];
show('items.length && <List/>',        <span>{items.length && <b>LIST</b>}</span>);
show('items.length > 0 && <List/>',    <span>{items.length > 0 && <b>LIST</b>}</span>);
show('!!items.length && <List/>',      <span>{!!items.length && <b>LIST</b>}</span>);
show('items.length ? <List/> : null',  <span>{items.length ? <b>LIST</b> : null}</span>);

console.log('--- does the conditional keep state? ---');
let mounts = 0;
function Box({tag}) {
  const [n] = useState(() => ++mounts);
  return <b data-n={n}>instance #{n}</b>;
}
function App({mode}) {
  return (
    <div>
      {mode === 'a' ? <Box /> : <Box />}
      {mode === 'a' ? <p><Box /></p> : <Box />}
      {mode === 'a' && <Box />}
      <hr />
      {mode === 'a' ? <Box /> : null}
    </div>
  );
}
const host = document.createElement('div');
document.body.appendChild(host);
const root = createRoot(host);
flushSync(() => root.render(<App mode="a" />));
console.log('  mode=a  -> ' + host.textContent);
flushSync(() => root.render(<App mode="b" />));
console.log('  mode=b  -> ' + host.textContent);
flushSync(() => root.render(<App mode="a" />));
console.log('  mode=a  -> ' + host.textContent);
console.log('  Box instances created: ' + mounts);
`;

section('conditional rendering (production build)');
const {logs, ua} = await runApp(SRC, {mode: 'production', wait: 500});
printLogs(logs, {prefix: '  '});
console.log(`\n  engine: ${ua}`);
