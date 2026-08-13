/**
 * ex13 — whitespace and text in JSX. Backs page 14.
 *
 * JSX's whitespace rules are a compile-time transform, so the honest way to
 * show them is to compile the source and print the children array, then render
 * the same source and print the text that reached the DOM.
 */
import babel from '@babel/core';
import {createRequire} from 'node:module';
import {runApp, section, printLogs} from './harness.mjs';

const require = createRequire(import.meta.url);

const compile = (code) =>
  babel
    .transformSync(code, {
      filename: 'demo.jsx',
      configFile: false,
      babelrc: false,
      presets: [[require.resolve('@babel/preset-react'), {runtime: 'automatic'}]],
    })
    .code.split('\n')
    .slice(1)
    .join('\n');

section('1. what the compiler does with the whitespace you typed');
const SOURCES = {
  'one line': `<p><b>a</b> <i>b</i></p>`,
  'elements on separate lines': `<p>
  <b>a</b>
  <i>b</i>
</p>`,
  'text on separate lines': `<p>
  Hello
  world
</p>`,
  'text then element, newline between': `<p>
  Hello
  <b>you</b>
</p>`,
  'explicit {" "}': `<p>
  <b>a</b>{" "}
  <i>b</i>
</p>`,
  'a string literal of spaces': `<p><b>a</b>{"   "}<i>b</i></p>`,
  'trailing spaces on one line': `<p>Hello   <b>you</b></p>`,
  'blank line between': `<p>
  <b>a</b>

  <i>b</i>
</p>`,
  'entity': `<p>a&nbsp;&amp;&nbsp;b</p>`,
};
for (const [label, src] of Object.entries(SOURCES)) {
  console.log(`\n  ${label}:`);
  console.log(
    src
      .split('\n')
      .map((l) => '    | ' + l)
      .join('\n'),
  );
  // Printed verbatim, never whitespace-normalised: a `.replace(/\s+/g, ' ')`
  // for display turned `{"   "}` into `" "` and flattened a template literal,
  // which would have made the page claim the opposite of the truth.
  const kids = compile(`const x = ${src};`).match(/children: (\[[\s\S]*\]|"[^"]*")/);
  console.log('    => children: ' + (kids ? kids[1].replace(/\/\*#__PURE__\*\/|\n\s*/g, '') : '?'));
}

const RENDER_SRC = `
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';

const show = (label, element) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  flushSync(() => createRoot(host).render(element));
  console.log(label.padEnd(34) + JSON.stringify(host.textContent));
};

show('one line',            <p><b>a</b> <i>b</i></p>);
show('separate lines',      <p>
  <b>a</b>
  <i>b</i>
</p>);
show('separate lines + {" "}', <p>
  <b>a</b>{" "}
  <i>b</i>
</p>);
show('text over two lines',  <p>
  Hello
  world
</p>);
show('text then element',    <p>
  Hello
  <b>you</b>
</p>);
show('entities',             <p>a&nbsp;&amp;&nbsp;b</p>);
show('{"   "} literal',      <p><b>a</b>{"   "}<i>b</i></p>);
show('template literal',     <p>{\`a
  b\`}</p>);
show('{" "} vs &nbsp;',      <p>a{" "}b&nbsp;c</p>);
`;

section('2. the text that actually reached the DOM (production build)');
const prod = await runApp(RENDER_SRC, {mode: 'production', wait: 400});
printLogs(prod.logs, {prefix: '  '});
console.log(`\n  engine: ${prod.ua}`);

section('3. the two space characters, by code point');
const NBSP = ' ';
console.log(`  {" "}   -> U+0020 SPACE      collapsed by CSS: yes`);
console.log(`  &nbsp;  -> U+${NBSP.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')} NO-BREAK SPACE  collapsed by CSS: no`);
