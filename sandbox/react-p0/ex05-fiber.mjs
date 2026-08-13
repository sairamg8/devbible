/**
 * ex05 — Fiber: the structure React actually keeps, read off a real DOM node.
 *
 * Nothing here is a public API. The point is that the internals are visible and
 * concrete, not that you should reach for them.
 *
 * Backs: pages/phase-0-how-react-runs/05-fiber.md
 */
import {runApp, section, printLogs} from './harness.mjs';

const SRC = `
import React, {useState, useEffect} from 'react';
import {createRoot} from 'react-dom/client';

function Row({label}) { return <li className="row">{label}</li>; }
function List() {
  const [items, setItems] = useState(['a', 'b']);
  window.addItem = () => setItems((x) => [...x, 'c']);
  return <ul id="list">{items.map((i) => <Row key={i} label={i} />)}</ul>;
}
function App() { return <main><List /></main>; }

createRoot(document.getElementById('root')).render(<App />);

const tagName = (t) => ({0:'FunctionComponent',3:'HostRoot',5:'HostComponent',6:'HostText'}[t] ?? 'tag ' + t);
const typeName = (f) => typeof f.type === 'function' ? f.type.name : JSON.stringify(f.type);

function fiberOf(el) {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
  return el[key];
}

setTimeout(() => {
  const li = document.querySelector('.row');

  console.log('  keys React adds to a DOM node:');
  for (const k of Object.keys(li)) console.log('    ' + k);

  console.log('\\n  walking UP from the first <li> via fiber.return:');
  let f = fiberOf(li), depth = 0;
  while (f && depth < 8) {
    console.log('    ' + '  '.repeat(depth) + tagName(f.tag) + '  type=' + typeName(f));
    f = f.return; depth++;
  }

  const listFiber = fiberOf(document.getElementById('list'));
  console.log('\\n  children of <ul> via child/sibling (a linked list, not an array):');
  let c = listFiber.child, i = 0;
  while (c) { console.log('    [' + i++ + '] ' + tagName(c.tag) + ' type=' + typeName(c)); c = c.sibling; }

  console.log('\\n  double buffering — before any update:');
  console.log('    ul.alternate =', listFiber.alternate === null ? 'null' : 'a second fiber');

  window.addItem();
  setTimeout(() => {
    const after = fiberOf(document.getElementById('list'));
    const count = (f) => { let n = 0, x = f && f.child; while (x) { n++; x = x.sibling; } return n; };
    console.log('\\n  after one update (list went from 2 items to 3):');
    console.log('    ul.alternate =', after.alternate === null ? 'null' : 'a second fiber');
    console.log('    alternate.alternate === itself ?', after.alternate?.alternate === after);
    console.log('    <li> elements actually in the DOM =', document.querySelectorAll('.row').length);
    console.log('    children on the fiber the DOM node points at =', count(after));
    console.log('    children on its alternate                    =', count(after.alternate));
    console.log('    => the DOM node\\'s __reactFiber$ pointer is NOT re-pointed each render;');
    console.log('       one of the two alternates is the current tree, the other is last render.');
  }, 100);
}, 200);
`;

const {logs} = await runApp(SRC, {mode: 'development', wait: 900});

section('fiber, read off a real DOM node (development build)');
printLogs(logs.filter((l) => l.type !== 'timeStamp' && !l.text.includes('DevTools')));
