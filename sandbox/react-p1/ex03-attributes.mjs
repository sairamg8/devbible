/**
 * ex03 — attributes vs props: what React renames, what it passes through, and
 * what it drops. Backs page 04 (attributes vs props).
 *
 * The method is deliberately blunt: render one element per case and print the
 * markup React actually produced (`outerHTML`), so the page never has to guess.
 * Run twice — production for the markup, development for the warning text.
 */
import {runApp, section, printLogs} from './harness.mjs';

const SRC = `
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';

const show = (label, element) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host, {onUncaughtError: (e) => console.log(label + ' THROWS ' + e.message.split('\\n')[0])});
  flushSync(() => root.render(element));
  console.log(label.padEnd(30) + host.innerHTML);
};

console.log('--- renamed by React ---');
show('className',      <div className="card" />);
show('htmlFor',        <label htmlFor="a" />);
show('tabIndex',       <div tabIndex={-1} />);
show('readOnly',       <input readOnly />);
show('maxLength',      <input maxLength={4} />);
show('crossOrigin',    <img crossOrigin="anonymous" src="x.png" />);
show('SVG strokeWidth', <svg><line strokeWidth={2} strokeLinecap="round" /></svg>);

console.log('--- passed straight through ---');
show('data-*',         <div data-test-id="x" data-userId="7" />);
show('aria-*',         <div aria-label="Close" aria-hidden={true} />);
show('lowercase custom', <div myattr="v" />);
show('role/id/title',  <div role="button" id="b" title="t" />);

console.log('--- what React 19 does with class/for ---');
show('class (raw)',    <div class="card" />);
show('for (raw)',      <label for="a" />);
show('onclick (raw)',  <button onclick="alert(1)" />);

console.log('--- booleans ---');
show('disabled={true}',   <button disabled={true} />);
show('disabled={false}',  <button disabled={false} />);
show('disabled="false"',  <button disabled="false" />);
show('hidden={true}',     <div hidden={true} />);
show('aria-hidden={false}', <div aria-hidden={false} />);
show('data-x={false}',    <div data-x={false} />);

console.log('--- empty values ---');
show('title={null}',      <div title={null} />);
show('title={undefined}', <div title={undefined} />);
show('title={0}',         <div title={0} />);
show('title={NaN}',       <div title={NaN} />);
show('width={100}',       <img width={100} src="x.png" />);

console.log('--- camelCased unknowns ---');
show('myAttr (camel)',    <div myAttr="v" />);
show('onFoo (camel)',     <div onFoo="v" />);

console.log('--- style must be an object ---');
show('style="color:red"', <div style="color:red" />);
`;

section('markup React produced (production build)');
const prod = await runApp(SRC, {mode: 'production', wait: 500});
printLogs(prod.logs, {prefix: '  '});
console.log(`\n  engine: ${prod.ua}`);

section('development build — the warnings production never prints');
const dev = await runApp(SRC, {mode: 'development', wait: 500});
const noise = new Set(['timeStamp', 'info', 'debug']);
printLogs(
  dev.logs.filter((l) => !noise.has(l.type) || /THROWS/.test(l.text)),
  {prefix: '  '},
);
