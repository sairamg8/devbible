/**
 * ex04 — Reconciliation: what preserves state and what destroys it.
 *
 * Four toggles, one question each. State is the observable: a Counter that
 * counts its own mounts and holds a value nobody re-sets.
 *
 * Backs: pages/phase-0-how-react-runs/04-reconciliation.md
 */
import {runApp, section, printLogs} from './harness.mjs';

const SRC = `
import React, {useState, useEffect, useRef} from 'react';
import {createRoot} from 'react-dom/client';

let mounts = 0;
function Counter({label}) {
  const [n, setN] = useState(0);
  const id = useRef(null);
  if (id.current === null) id.current = ++mounts;
  useEffect(() => {
    console.log('       Counter MOUNTED   instance #' + id.current + ' (' + label + ')');
    return () => console.log('       Counter UNMOUNTED instance #' + id.current + ' (' + label + ')');
  }, []);
  window['bump' + label] = () => setN((x) => x + 1);
  window['read' + label] = () => n;
  return <b>{n}</b>;
}

function App() {
  const [mode, setMode] = useState('a');
  window.setMode = setMode;
  if (mode === 'a')       return <div><Counter label="X" /></div>;
  if (mode === 'b')       return <div><Counter label="X" /></div>;          // same tree, re-render
  if (mode === 'span')    return <span><Counter label="X" /></span>;        // parent type changed
  if (mode === 'moved')   return <div><section><Counter label="X" /></section></div>; // depth changed
  if (mode === 'keyed1')  return <div><Counter key="k1" label="X" /></div>;
  if (mode === 'keyed2')  return <div><Counter key="k2" label="X" /></div>; // key changed
  return null;
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);

const step = (title, fn) => { console.log(title); fn(); };
const flush = () => new Promise((r) => setTimeout(r, 60));

async function main() {
  await flush();
  step('  set count to 5:', () => { for (let i = 0; i < 5; i++) window.bumpX(); });
  await flush();
  console.log('     value now =', window.readX());

  step('\\n  A) re-render, same element type <div><Counter/>:', () => window.setMode('b'));
  await flush();
  console.log('     value survived? value =', window.readX());

  step('\\n  B) change the PARENT element type div -> span:', () => window.setMode('span'));
  await flush();
  console.log('     value now =', window.readX());

  step('\\n  C) back to div, count to 3, then wrap in <section> (same types, new depth):', () => {
    window.setMode('a');
  });
  await flush();
  for (let i = 0; i < 3; i++) window.bumpX();
  await flush();
  console.log('     value before move =', window.readX());
  window.setMode('moved');
  await flush();
  console.log('     value after move  =', window.readX());

  step('\\n  D) same type and position, only the KEY changes:', () => window.setMode('keyed1'));
  await flush();
  for (let i = 0; i < 7; i++) window.bumpX();
  await flush();
  console.log('     value with key k1 =', window.readX());
  window.setMode('keyed2');
  await flush();
  console.log('     value with key k2 =', window.readX());
  console.log('\\n  total Counter instances created:', mounts);
}
main();
`;

const {logs} = await runApp(SRC, {mode: 'production', wait: 1500});

section('reconciliation — does the component keep its state?');
printLogs(logs.filter((l) => l.type !== 'timeStamp'));
