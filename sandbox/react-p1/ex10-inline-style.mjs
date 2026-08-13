/**
 * ex10 — inline `style`. Backs page 11.
 *
 * The interesting parts are the automatic `px`, the list of properties that do
 * NOT get it, and the vendor-prefix casing rule. Everything is read back off
 * the live element's `style` attribute, so the answer comes from the browser.
 */
import {runApp, section, printLogs} from './harness.mjs';

const SRC = `
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';

const show = (label, style) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host, {onUncaughtError: (e) => console.log(label.padEnd(34) + 'THROWS ' + e.message.split('\\n')[0])});
  flushSync(() => root.render(<div style={style} />));
  const el = host.firstChild;
  console.log(label.padEnd(34) + (el ? JSON.stringify(el.getAttribute('style')) : '(nothing rendered)'));
};

console.log('--- camelCase to CSS ---');
show('{backgroundColor}',      {backgroundColor: 'red'});
show('{fontSize: 12}',         {fontSize: 12});
show("{fontSize: '12px'}",     {fontSize: '12px'});
show("{fontSize: '12'}",       {fontSize: '12'});
show('{marginTop: 0}',         {marginTop: 0});

console.log('--- which numbers get px, and which do not ---');
for (const prop of ['width', 'margin', 'padding', 'top', 'borderWidth', 'fontSize',
                    'lineHeight', 'zIndex', 'opacity', 'flex', 'flexGrow', 'fontWeight',
                    'order', 'columnCount', 'gridRow', 'aspectRatio', 'scale', 'tabSize']) {
  show('{' + prop + ': 2}', {[prop]: 2});
}

console.log('--- vendor prefixes and custom properties ---');
show('{WebkitLineClamp: 2}',   {WebkitLineClamp: 2});
show('{msTransform}',          {msTransform: 'none'});
show('{MozBoxSizing}',         {MozBoxSizing: 'border-box'});
show("{'--brand': 'red'}",     {'--brand': 'red'});
show("{'--gap': 8}",           {'--gap': 8});
show("{color: 'var(--brand)'}", {color: 'var(--brand)'});

console.log('--- hyphenated and invalid keys ---');
show("{'font-size': 12}",      {'font-size': 12});
show("{'background-color': 'red'}", {'background-color': 'red'});
show('{notACssProperty: 1}',   {notACssProperty: 1});
show('{color: null}',          {color: null});
show('{color: undefined}',     {color: undefined});
show('{color: false}',         {color: false});
show('{} (empty object)',      {});
show('null',                   null);

console.log('--- what inline style cannot express ---');
show("{':hover'}",             {':hover': {color: 'red'}});
show("{'@media (max-width: 1px)'}", {'@media (max-width: 1px)': {color: 'red'}});
`;

section('inline style — the style attribute React produced (production)');
const prod = await runApp(SRC, {mode: 'production', wait: 500});
printLogs(prod.logs, {prefix: '  '});
console.log(`\n  engine: ${prod.ua}`);

section('development build — the warnings');
const dev = await runApp(SRC, {mode: 'development', wait: 500});
const noise = new Set(['timeStamp', 'info', 'debug']);
printLogs(dev.logs.filter((l) => !noise.has(l.type) && l.type !== 'log'), {prefix: '  '});
