/**
 * ex06 — createRoot: the entry point, and the React 19 removals people trip on.
 *
 * Every error string here is the real one, captured from the page.
 *
 * Backs: pages/phase-0-how-react-runs/06-createroot.md
 */
import {runApp, section, printLogs} from './harness.mjs';

const SRC = `
import React from 'react';
import * as ReactDOM from 'react-dom';
import {createRoot} from 'react-dom/client';

function App({who = 'world'}) { return <h1>hello {who}</h1>; }

const attempt = (label, fn) => {
  try { const r = fn(); console.log('  ' + label + ' -> ok', r === undefined ? '' : ''); }
  catch (e) { console.log('  ' + label + ' -> ' + e.name + ': ' + e.message); }
};

console.log('=== what react-dom still exports (19.2.8) ===');
console.log('  typeof ReactDOM.render        =', typeof ReactDOM.render);
console.log('  typeof ReactDOM.hydrate       =', typeof ReactDOM.hydrate);
console.log('  typeof ReactDOM.findDOMNode   =', typeof ReactDOM.findDOMNode);
console.log('  typeof ReactDOM.unmountComponentAtNode =', typeof ReactDOM.unmountComponentAtNode);

console.log('\\n=== calling the React 17 API on React 19 ===');
attempt('ReactDOM.render(<App/>, root)', () => ReactDOM.render(<App />, document.getElementById('root')));

console.log('\\n=== the container has to exist ===');
attempt("createRoot(document.getElementById('nope'))", () => createRoot(document.getElementById('nope')));

console.log('\\n=== the normal path ===');
const container = document.getElementById('root');
const root = createRoot(container);
console.log('  createRoot returned an object with:', Object.keys(root).length ? Object.keys(root).join(', ') : '(no own enumerable keys)');
console.log('  typeof root.render   =', typeof root.render);
console.log('  typeof root.unmount  =', typeof root.unmount);
root.render(<App who="Ada" />);

setTimeout(() => {
  console.log('  after render, DOM =', JSON.stringify(container.innerHTML));

  console.log('\\n=== rendering again on the SAME root updates, not remounts ===');
  root.render(<App who="Grace" />);
  setTimeout(() => {
    console.log('  after second render, DOM =', JSON.stringify(container.innerHTML));

    console.log('\\n=== calling createRoot twice on the same container ===');
    const second = createRoot(container);
    second.render(<App who="oops" />);

    setTimeout(() => {
      console.log('\\n=== unmount ===');
      root.unmount();
      second.unmount();
      console.log('  after unmount, DOM =', JSON.stringify(container.innerHTML));
      attempt('root.render(<App/>) after unmount', () => root.render(<App />));
    }, 120);
  }, 120);
}, 200);
`;

const {logs} = await runApp(SRC, {mode: 'development', wait: 1400});

section('createRoot, and what React 19 removed (development build)');
printLogs(logs.filter((l) => l.type !== 'timeStamp' && !l.text.includes('DevTools')));
