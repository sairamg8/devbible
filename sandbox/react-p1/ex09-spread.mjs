/**
 * ex09 — spreading props. Backs page 10.
 *
 * Three questions, all answered by output rather than assertion: what order
 * does, what a spread `key` does in React 19, and what unknown props do when
 * they land on a DOM node.
 */
import babel from '@babel/core';
import {createRequire} from 'node:module';
import {runApp, section, printLogs} from './harness.mjs';

const require = createRequire(import.meta.url);

section('1. what a spread compiles to');
console.log(
  babel.transformSync(
    `const a = <input {...props} />;
const b = <input type="text" {...props} />;
const c = <input {...props} type="text" />;
const d = <input {...a} {...b} />;
const e = <input {...{key: id, name: 'n'}} />;`,
    {
      filename: 'demo.jsx',
      configFile: false,
      babelrc: false,
      presets: [[require.resolve('@babel/preset-react'), {runtime: 'automatic'}]],
    },
  ).code,
);

const SRC = `
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';

const show = (label, element) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host, {onUncaughtError: (e) => console.log(label.padEnd(34) + 'THROWS ' + e.message.split('\\n')[0])});
  flushSync(() => root.render(element));
  console.log(label.padEnd(34) + host.innerHTML);
};

const props = {type: 'password', name: 'pw', placeholder: 'from spread'};

console.log('--- order decides the winner ---');
show('{...props} then type="text"',  <input {...props} type="text" />);
show('type="text" then {...props}',  <input type="text" {...props} />);
show('two spreads, second wins',     <input {...{name: 'first'}} {...{name: 'second'}} />);

console.log('--- what a rest spread carries into the DOM ---');
function Field({label, ...rest}) { return <input {...rest} />; }
show('<Field label onSelectRow>',    <Field label="L" name="n" onSelectRow={() => {}} isActive={true} />);
show('<Field label data-testid>',    <Field label="L" name="n" data-testid="t" />);

console.log('--- key inside a spread object ---');
const withKey = {key: 'k1', name: 'n'};
show('<input {...withKey} />',        <div>{[<input {...withKey} />]}</div>);
show('<input key={k} {...rest} />',   <div>{[<input key="k1" name="n" />]}</div>);

console.log('--- spreading onto a component is not the same thing ---');
function Passthrough(p) { return <b>{JSON.stringify(Object.keys(p))}</b>; }
show('<Passthrough {...allProps} />', <Passthrough label="L" isActive={true} onSelectRow={() => {}} />);
`;

section('2. rendered markup (production build)');
const prod = await runApp(SRC, {mode: 'production', wait: 400});
printLogs(prod.logs, {prefix: '  '});
console.log(`\n  engine: ${prod.ua}`);

section('3. development build — the warnings');
const dev = await runApp(SRC, {mode: 'development', wait: 400});
const noise = new Set(['timeStamp', 'info', 'debug']);
printLogs(dev.logs.filter((l) => !noise.has(l.type) && l.type !== 'log'), {prefix: '  '});
