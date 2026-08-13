/**
 * ex12 — The Profiler API, and the Performance Tracks marks React 19.2 emits.
 *
 * `<Profiler>` is the only part of React's measurement story that is a real API
 * rather than a browser extension, so it is the only part that can be measured
 * from a script.
 *
 * Backs: pages/phase-0-how-react-runs/12-devtools-and-profiler.md
 */
import {runApp, section, printLogs, rows} from './harness.mjs';

const SRC = `
import React, {Profiler, useState, memo} from 'react';
import {createRoot} from 'react-dom/client';

const rows = Array.from({length: 400}, (_, i) => ({id: i, name: 'Item ' + i}));

function Cell({row}) {
  // deliberately not free, so the numbers are not all 0.1ms
  let s = 0; for (let i = 0; i < 400; i++) s += Math.sqrt(i * row.id);
  return <li>{row.name} {s.toFixed(0)}</li>;
}
const MemoCell = memo(Cell);

function List({useMemoised, tick}) {
  const C = useMemoised ? MemoCell : Cell;
  return <ul>{rows.map((r) => <C key={r.id} row={r} />)}</ul>;
}

function App() {
  const [state, setState] = useState({memoised: false, tick: 0});
  window.rerender = (memoised) => setState((s) => ({memoised, tick: s.tick + 1}));
  return (
    <Profiler id="list" onRender={(id, phase, actual, base, start, commit) => {
      console.log(
        '  id=' + id,
        'phase=' + phase.padEnd(6),
        'actualDuration=' + actual.toFixed(1) + 'ms',
        'baseDuration=' + base.toFixed(1) + 'ms'
      );
    }}>
      <List useMemoised={state.memoised} tick={state.tick} />
    </Profiler>
  );
}

createRoot(document.getElementById('root')).render(<App />);

setTimeout(() => {
  console.log('\\n  -- re-render, same props, WITHOUT memo --');
  window.rerender(false);
  setTimeout(() => {
    console.log('\\n  -- re-render, same props, WITH memo --');
    window.rerender(true);
    setTimeout(() => {
      console.log('\\n  -- another re-render, still memoised --');
      window.rerender(true);
    }, 200);
  }, 200);
}, 300);
`;

for (const mode of ['development', 'production']) {
  const {logs} = await runApp(SRC, {mode, wait: 1600});

  section(`<Profiler onRender> — ${mode} build, Firefox 153`);
  const app = logs.filter((l) => l.type !== 'timeStamp' && !l.text.includes('DevTools'));
  if (app.some((l) => l.text.includes('actualDuration'))) printLogs(app);
  else {
    printLogs(app);
    console.log('  (no onRender calls at all — see below)');
  }

  section(`console.timeStamp marks emitted — ${mode}`);
  const marks = logs.filter((l) => l.type === 'timeStamp');
  rows({
    'timeStamp entries captured': marks.length,
    'distinct track names': [...new Set(marks.map((m) => m.text))].join(', ') || '(none)',
  });
}
