/**
 * ex12 — form elements in JSX. Backs page 13.
 *
 * The claim that needs measuring is "React's onChange is the DOM's input
 * event". So the script dispatches real DOM events at a real input and counts
 * which React handlers fire, per keystroke. Everything else is warning text and
 * markup, captured the same way as the other scripts.
 */
import {runApp, section, printLogs} from './harness.mjs';

const SRC = `
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {useState} from 'react';

const show = (label, element) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host, {onUncaughtError: (e) => console.log(label.padEnd(38) + 'THROWS ' + e.message.split('\\n')[0])});
  flushSync(() => root.render(element));
  console.log(label.padEnd(38) + host.innerHTML);
  return host;
};

console.log('--- value, defaultValue and the warnings ---');
show('value, no onChange',        <input value="fixed" />);
show('value + readOnly',          <input value="fixed" readOnly />);
show('value + onChange',          <input value="fixed" onChange={() => {}} />);
show('defaultValue',              <input defaultValue="initial" />);
show('value={null}',              <input value={null} onChange={() => {}} />);
show('value={undefined}',         <input value={undefined} onChange={() => {}} />);
show('checked, no onChange',      <input type="checkbox" checked={true} />);
show('defaultChecked',            <input type="checkbox" defaultChecked />);
show('<textarea>children</textarea>', <textarea defaultValue="">text child</textarea>);
show('<textarea defaultValue>',   <textarea defaultValue="in the prop" />);

console.log('--- select ---');
show('selected on <option>',      <select defaultValue=""><option value="a">A</option><option value="b" selected>B</option></select>);
show('value on <select>',         <select value="b" onChange={() => {}}><option value="a">A</option><option value="b">B</option></select>);
show('defaultValue on <select>',  <select defaultValue="b"><option value="a">A</option><option value="b">B</option></select>);
show('multiple + array value',    <select multiple value={['a','b']} onChange={() => {}}><option value="a">A</option><option value="b">B</option></select>);

console.log('--- which DOM value the markup does NOT show ---');
{
  const host = show('defaultValue then typing', <input defaultValue="initial" />);
  const el = host.querySelector('input');
  el.value = 'typed by the user';
  console.log('  markup after typing:    ' + host.innerHTML);
  console.log('  el.value after typing:  ' + JSON.stringify(el.value));
  console.log('  el.getAttribute(value): ' + JSON.stringify(el.getAttribute('value')));
}

console.log('--- uncontrolled becomes controlled ---');
{
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() => root.render(<input value={undefined} onChange={() => {}} />));
  flushSync(() => root.render(<input value="now controlled" onChange={() => {}} />));
  flushSync(() => root.render(<input value={undefined} onChange={() => {}} />));
  console.log('  final markup: ' + host.innerHTML);
}

console.log('--- which events fire, and how often ---');
{
  const seen = [];
  function Probe() {
    const [v, setV] = useState('');
    return <input
      value={v}
      onChange={(e) => { seen.push('onChange:' + e.type + ':' + e.target.value); setV(e.target.value); }}
      onInput={(e) => seen.push('onInput:' + e.type)}
      onKeyDown={() => seen.push('onKeyDown')}
    />;
  }
  const host = document.createElement('div');
  document.body.appendChild(host);
  flushSync(() => createRoot(host).render(<Probe />));
  const el = host.querySelector('input');

  // Type "ab" the way a browser does: keydown, then the value change, then input.
  for (const ch of ['a', 'ab']) {
    el.dispatchEvent(new KeyboardEvent('keydown', {bubbles: true, key: ch.slice(-1)}));
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, ch);
    el.dispatchEvent(new Event('input', {bubbles: true}));
  }
  // A native 'change' event on top, to show it adds nothing.
  el.dispatchEvent(new Event('change', {bubbles: true}));
  setTimeout(() => {
    console.log('  handlers fired: ' + JSON.stringify(seen));
    console.log('  final value:    ' + JSON.stringify(el.value));
  }, 100);
}
`;

section('form elements — markup and behaviour (production build)');
const prod = await runApp(SRC, {mode: 'production', wait: 700});
printLogs(prod.logs, {prefix: '  '});
console.log(`\n  engine: ${prod.ua}`);

section('development build — every form warning React prints');
const dev = await runApp(SRC, {mode: 'development', wait: 700});
const noise = new Set(['timeStamp', 'info', 'debug']);
printLogs(
  dev.logs.filter((l) => !noise.has(l.type) && (l.type !== 'log' || /THROWS/.test(l.text))),
  {prefix: '  '},
);
