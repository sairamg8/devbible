/**
 * ex03 — Render, reconcile, commit: the order, and when the DOM is real.
 *
 * The question each probe answers is "at this moment, what does the DOM say?".
 * That is the only way to show that render produces no DOM and commit does.
 *
 * Backs: pages/phase-0-how-react-runs/03-render-reconcile-commit.md
 */
import {runApp, section, printLogs, rows} from './harness.mjs';

const SRC = `
import React, {useState, useEffect, useLayoutEffect} from 'react';
import {createRoot} from 'react-dom/client';

// What does the committed DOM say right now?
const dom = () => JSON.stringify(document.querySelector('#label')?.textContent ?? null);

function Child({n}) {
  console.log('  3. Child renders. DOM #label =', dom());
  useLayoutEffect(() => { console.log('  5. Child useLayoutEffect. DOM #label =', dom()); });
  useEffect(() => { console.log('  7. Child useEffect. DOM #label =', dom()); });
  // Inline arrow => new function identity every render => React detaches the old
  // ref and attaches the new one. Logging the argument is the only way to tell
  // the two calls apart.
  return <span id="label" ref={(node) =>
    console.log('  4. Child ref callback, arg =', node === null ? 'null (detach)' : '<span> (attach)', '. DOM #label =', dom())
  }>count {n}</span>;
}

function Parent() {
  const [n, setN] = useState(0);
  console.log('  2. Parent renders. DOM #label =', dom());
  useLayoutEffect(() => { console.log('  6. Parent useLayoutEffect. DOM #label =', dom()); });
  useEffect(() => {
    console.log('  8. Parent useEffect. DOM #label =', dom());
    if (n === 0) {
      console.log('--- second render, triggered by setN(1) ---');
      setN(1);
    }
  });
  return <div><Child n={n} /></div>;
}

console.log('  1. before render(). DOM #label =', dom());
createRoot(document.getElementById('root')).render(<Parent />);
console.log('  1b. immediately after render() returns. DOM #label =', dom());
`;

const {logs, html, ua} = await runApp(SRC, {mode: 'production'});

section('environment');
rows({browser: ua, mode: 'production build (StrictMode off, no double render)'});

section('ordering — number prefixes are written into the logs, not added here');
printLogs(logs.filter((l) => l.type !== 'timeStamp'));

section('final committed DOM');
console.log('  ' + html);
