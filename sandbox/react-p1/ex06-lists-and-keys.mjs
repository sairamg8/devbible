/**
 * ex06 — lists and `key`, measured three ways. Backs page 07.
 *
 *  1. DOM state (what the user typed) after the list is reordered — index keys
 *     vs stable keys, side by side, same data, same operation.
 *  2. The DOM operations React performed, counted with a MutationObserver.
 *  3. Every warning React prints about keys, with its exact text.
 *
 * The DOM-state test uses an *uncontrolled* input on purpose: the typed value
 * lives in the DOM node, so it moves exactly when React moves the node.
 */
import babel from '@babel/core';
import {createRequire} from 'node:module';
import {runApp, section, printLogs} from './harness.mjs';

const require = createRequire(import.meta.url);

const SRC = `
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {useState, useEffect, useRef, Fragment} from 'react';

let mounts = 0;
function Row({item}) {
  const id = useRef(null);
  if (id.current === null) id.current = ++mounts;
  useEffect(() => {
    console.log('    Row MOUNT   #' + id.current + ' (' + item.name + ')');
    return () => console.log('    Row UNMOUNT #' + id.current + ' (' + item.name + ')');
  }, []);
  return <li><input defaultValue="" data-name={item.name} /> {item.name}</li>;
}

const DATA = [{id: 'a', name: 'Ada'}, {id: 'b', name: 'Bob'}, {id: 'c', name: 'Cy'}];

function List({items, keyed}) {
  return <ul>{items.map((item, i) =>
    keyed ? <Row key={item.id} item={item} /> : <Row key={i} item={item} />
  )}</ul>;
}

function runCase(keyed) {
  console.log('  --- ' + (keyed ? 'key={item.id}' : 'key={index}') + ' ---');
  mounts = 0;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() => root.render(<List items={DATA} keyed={keyed} />));

  // The user types into each row, in order.
  const inputs = [...host.querySelectorAll('input')];
  inputs.forEach((el, i) => { el.value = 'typed-' + DATA[i].name; });
  console.log('    before: ' + inputs.map(el => el.dataset.name + '=' + el.value).join(', '));

  // Tag the DOM nodes themselves, so we can see which physical <li> ends up
  // where. A tag survives a *move*; it cannot survive a destroy-and-recreate.
  [...host.querySelectorAll('li')].forEach((el, i) => { el.__tag = 'li' + i; });

  // Count the DOM operations React performs for the reorder. flushSync is
  // synchronous, so the records are still pending — takeRecords() must be
  // *counted*, not merely drained.
  let adds = 0, removes = 0, chars = 0, attrs = 0;
  const tally = (records) => {
    for (const r of records) {
      if (r.type === 'childList') { adds += r.addedNodes.length; removes += r.removedNodes.length; }
      else if (r.type === 'characterData') chars++;
      else attrs++;
    }
  };
  const obs = new MutationObserver(tally);
  obs.observe(host, {childList: true, subtree: true, characterData: true, attributes: true});

  // Move the last item to the front. Same data, same operation, both cases.
  const moved = [DATA[2], DATA[0], DATA[1]];
  flushSync(() => root.render(<List items={moved} keyed={keyed} />));
  tally(obs.takeRecords());
  obs.disconnect();

  const after = [...host.querySelectorAll('input')];
  console.log('    after:  ' + after.map(el => el.dataset.name + '=' + (el.value || '(empty)')).join(', '));
  console.log('    DOM node order: ' + [...host.querySelectorAll('li')].map(el => el.__tag ?? 'NEW').join(' '));
  console.log('    mutations: added=' + adds + ' removed=' + removes + ' text=' + chars + ' attr=' + attrs
    + ', Row instances created=' + mounts);
}

runCase(false);
runCase(true);

console.log('  --- the warnings ---');
// Each case gets its OWN component, because React dedupes the key warning per
// owner: a second offending list inside the same owner prints nothing.
const NoKey      = () => <ul>{DATA.map((d) => <li>{d.name}</li>)}</ul>;
const DupKey     = () => <ul>{[{id: 'x', name: 'One'}, {id: 'x', name: 'Two'}].map((d) => <li key={d.id}>{d.name}</li>)}</ul>;
const InnerKey   = () => <ul>{DATA.map((d) => <li><span key={d.id}>{d.name}</span></li>)}</ul>;
const FragKey    = () => <div>{DATA.map((d) => <Fragment key={d.id}><dt>{d.name}</dt><dd>x</dd></Fragment>)}</div>;
const StaticKids = () => <ul><li>one</li><li>two</li></ul>;
const ArrayLit   = () => <ul>{[<li>one</li>, <li>two</li>]}</ul>;
const TwoLists   = () => <div><ul>{DATA.map((d) => <li>{d.name}</li>)}</ul><ol>{DATA.map((d) => <li>{d.name}</li>)}</ol></div>;

const warn = (label, element) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host, {onUncaughtError: (e) => console.log('  ' + label + ' THROWS ' + e.message.split('\\n')[0])});
  console.log('  case: ' + label);
  flushSync(() => root.render(element));
};
const CASES = {
  'no key at all': <NoKey />,
  'duplicate keys': <DupKey />,
  'key on the inner element, none on the outer': <InnerKey />,
  'keyed Fragment': <FragKey />,
  'static children, no keys': <StaticKids />,
  'array literal, no keys': <ArrayLit />,
  'two bad lists in one component': <TwoLists />,
};
const ORDER = ORDER_PLACEHOLDER;
for (const name of ORDER) warn(name, CASES[name]);
`;

const FORWARD = [
  'no key at all',
  'duplicate keys',
  'key on the inner element, none on the outer',
  'keyed Fragment',
  'static children, no keys',
  'array literal, no keys',
  'two bad lists in one component',
];
const REVERSED = [...FORWARD].reverse();
const withOrder = (order) => SRC.replace('ORDER_PLACEHOLDER', JSON.stringify(order));

section('index keys vs stable keys — same data, same reorder (production)');
const prod = await runApp(withOrder(FORWARD), {mode: 'production', wait: 700});
printLogs(prod.logs, {prefix: ''});
console.log(`\n  engine: ${prod.ua}`);

const noise = new Set(['timeStamp', 'info', 'debug']);
const keyLogs = (logs) =>
  logs.filter((l) => !noise.has(l.type) && (l.type !== 'log' || /^  case:/.test(l.text)));

section('development build — every key warning React prints');
const dev = await runApp(withOrder(FORWARD), {mode: 'development', wait: 700});
printLogs(keyLogs(dev.logs), {prefix: '  '});

section('the same cases in the opposite order — which ones warn now');
const dev2 = await runApp(withOrder(REVERSED), {mode: 'development', wait: 700});
printLogs(keyLogs(dev2.logs), {prefix: '  '});

section('the one thing the shorthand fragment cannot do');
const compile = (code) =>
  babel.transformSync(code, {
    filename: 'demo.jsx',
    configFile: false,
    babelrc: false,
    presets: [[require.resolve('@babel/preset-react'), {runtime: 'automatic'}]],
  }).code;

for (const src of [`const x = <key={d.id}><dt/><dd/></>;`, `const x = <Fragment key={d.id}><dt/><dd/></Fragment>;`]) {
  try {
    console.log(`  ${src}\n    -> ${compile(src).split('\n').slice(1).join(' ').trim()}`);
  } catch (e) {
    console.log(`  ${src}\n    -> ${e.message.split('\n')[0].replace(/^.*demo\.jsx: /, 'SyntaxError: ')}`);
  }
}
