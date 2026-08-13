/**
 * ex07 — StrictMode: what doubles, and the fact that it stops in production.
 *
 * The same source is bundled twice, changing only
 * `define: process.env.NODE_ENV`. Everything else is identical, so any
 * difference in the logs is StrictMode and nothing else.
 *
 * Backs: pages/phase-0-how-react-runs/07-strictmode.md
 */
import {runApp, section, printLogs, rows} from './harness.mjs';

const SRC = `
import React, {StrictMode, useState, useEffect, useRef} from 'react';
import {createRoot} from 'react-dom/client';

let renders = 0, setups = 0, cleanups = 0;

// A deliberately impure component: it mutates a module-level array during render.
const trail = [];

function Widget() {
  renders++;
  const [n] = useState(() => { console.log('  useState initialiser ran'); return 0; });
  trail.push('render');                       // <-- the bug StrictMode is looking for
  console.log('  render #' + renders);
  useEffect(() => {
    setups++;
    console.log('    effect SETUP #' + setups);
    return () => { cleanups++; console.log('    effect CLEANUP #' + cleanups); };
  }, []);
  return <p>{n}</p>;
}

createRoot(document.getElementById('root')).render(
  <StrictMode><Widget /></StrictMode>
);

setTimeout(() => {
  console.log('  TOTALS renders=' + renders + ' setups=' + setups + ' cleanups=' + cleanups);
  console.log('  trail (module array mutated during render) = [' + trail.join(', ') + ']');
}, 300);
`;

for (const mode of ['development', 'production']) {
  const {logs, bytes} = await runApp(SRC, {mode, wait: 700});
  section(`${mode} build — ${bytes.toLocaleString()} bytes`);
  printLogs(logs.filter((l) => l.type !== 'timeStamp'));
}

section('what changed between the two');
rows({
  'source code': 'identical — only process.env.NODE_ENV differs',
  'what selects the build': 'a dead-code branch inside react-dom, removed by the minifier',
});
