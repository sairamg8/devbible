/**
 * ex04 — capitalization decides everything. Backs page 05.
 *
 * The point of the script is that the "bug" is silent: a lowercased component
 * name compiles, renders, and produces markup — just not yours.
 */
import babel from '@babel/core';
import {createRequire} from 'node:module';
import {runApp, section, printLogs} from './harness.mjs';

const require = createRequire(import.meta.url);

section('1. what the compiler emits for each spelling');
const out = babel.transformSync(
  `const a = <button />;
const b = <Button />;
const c = <ui.Button />;
const d = <my-widget />;
const e = <Ui.button />;
const f = <_private />;
const g = <$dollar />;`,
  {
    filename: 'demo.jsx',
    configFile: false,
    babelrc: false,
    presets: [[require.resolve('@babel/preset-react'), {runtime: 'automatic'}]],
  },
).code;
console.log(out);

const SRC = `
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';

function Button({label}) { return <b>COMPONENT: {label}</b>; }
function button({label}) { return <b>COMPONENT: {label}</b>; }
const ui = {Button};

const show = (label, element) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host, {onUncaughtError: (e) => console.log(label.padEnd(26) + 'THROWS ' + e.message.split('\\n')[0])});
  try { flushSync(() => root.render(element)); } catch (e) { console.log(label.padEnd(26) + 'THREW ' + e.message.split('\\n')[0]); return; }
  console.log(label.padEnd(26) + host.innerHTML);
};

show('<Button label="x"/>',   <Button label="x" />);
show('<button label="x"/>',   <button label="x" />);
show('<ui.Button label="x"/>', <ui.Button label="x" />);
show('<my-widget label="x"/>', <my-widget label="x" />);
show('<Div/> (undefined var)', (() => { let Div; return <Div />; })());
show('<Button/> as {Button}',  <div>{Button}</div>);
show('{Button()} — called',    <div>{Button({label: 'x'})}</div>);
`;

section('2. rendered markup (production build)');
const prod = await runApp(SRC, {mode: 'production', wait: 400});
printLogs(prod.logs, {prefix: '  '});

section('3. development build — the messages');
const dev = await runApp(SRC, {mode: 'development', wait: 400});
const noise = new Set(['timeStamp', 'info', 'debug']);
printLogs(dev.logs.filter((l) => !noise.has(l.type)), {prefix: '  '});
