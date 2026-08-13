/**
 * ex11 — `dangerouslySetInnerHTML`. Backs page 12.
 *
 * The threat model is demonstrated, not described: a payload that a real
 * attacker would use is rendered into a live page and the script checks whether
 * it executed. Two payloads are used because the obvious one does *not* fire.
 */
import {runApp, section, printLogs} from './harness.mjs';

const SRC = `
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';

window.__fired = [];

const show = (label, element) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host, {onUncaughtError: (e) => console.log(label.padEnd(38) + 'THROWS ' + e.message.split('\\n')[0])});
  flushSync(() => root.render(element));
  console.log(label.padEnd(38) + JSON.stringify(host.innerHTML));
};

const markup = '<em>from the CMS</em>';

console.log('--- text vs html ---');
show('{markup} as a child',        <div>{markup}</div>);
show('dangerouslySetInnerHTML',    <div dangerouslySetInnerHTML={{__html: markup}} />);

console.log('--- the API is exact ---');
show('__html missing',             <div dangerouslySetInnerHTML={{html: markup}} />);
show('__html: undefined',          <div dangerouslySetInnerHTML={{__html: undefined}} />);
show('__html: null',               <div dangerouslySetInnerHTML={{__html: null}} />);
show('__html: 42',                 <div dangerouslySetInnerHTML={{__html: 42}} />);
show('a string, not an object',    <div dangerouslySetInnerHTML={markup} />);
show('with children as well',      <div dangerouslySetInnerHTML={{__html: markup}}>child</div>);

console.log('--- what executes ---');
show('<script> payload',           <div dangerouslySetInnerHTML={{__html: '<script>window.__fired.push("script")</' + 'script>'}} />);
show('<img onerror> payload',      <div dangerouslySetInnerHTML={{__html: '<img src=x onerror=\\'window.__fired.push("img-onerror")\\'>'}} />);
show('<svg onload> payload',       <div dangerouslySetInnerHTML={{__html: '<svg onload=\\'window.__fired.push("svg-onload")\\'></svg>'}} />);
show('<iframe srcdoc> payload',    <div dangerouslySetInnerHTML={{__html: '<iframe srcdoc="&lt;script&gt;parent.__fired.push(1)&lt;/script&gt;"></iframe>'}} />);

setTimeout(() => {
  console.log('  payloads that executed: ' + JSON.stringify(window.__fired));
}, 300);

console.log('--- React escapes everything else ---');
show('user text with tags',        <div>{'<img src=x onerror="alert(1)">'}</div>);
show('user text in an attribute',  <div title={'"><script>alert(1)</' + 'script>'} />);
show('href="javascript:"',         <a href={'javascript:window.__fired.push("href")'}>click</a>);
`;

section('dangerouslySetInnerHTML (production build)');
const prod = await runApp(SRC, {mode: 'production', wait: 700});
printLogs(prod.logs, {prefix: '  '});
console.log(`\n  engine: ${prod.ua}`);

section('development build — the messages');
const dev = await runApp(SRC, {mode: 'development', wait: 700});
const noise = new Set(['timeStamp', 'info', 'debug']);
printLogs(
  dev.logs.filter((l) => !noise.has(l.type) && (l.type !== 'log' || /THROWS/.test(l.text))),
  {prefix: '  '},
);
