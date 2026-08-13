/**
 * ex02 — The element: what JSX compiles to, and what it evaluates to.
 *
 * Backs: pages/phase-0-how-react-runs/02-the-element.md
 */
import {section, rows} from './harness.mjs';
import {createRequire} from 'node:module';
import {transformSync} from '@babel/core';
import {inspect} from 'node:util';

const require = createRequire(import.meta.url);
const React = require('react');

const JSX = `const el = <button className="primary" onClick={save}>Save</button>;
const list = <ul>{items.map(i => <li key={i.id}>{i.name}</li>)}</ul>;`;

section('the JSX you write');
console.log(
  JSX.split('\n')
    .map((l) => '  ' + l)
    .join('\n'),
);

section('what the automatic runtime compiles it to (@babel/preset-react)');
const auto = transformSync(JSX, {
  presets: [['@babel/preset-react', {runtime: 'automatic', development: false}]],
  configFile: false,
}).code;
console.log(
  auto
    .split('\n')
    .map((l) => '  ' + l)
    .join('\n'),
);

section('what the classic runtime compiled it to (pre-17, still seen in old code)');
const classic = transformSync(JSX, {
  presets: [['@babel/preset-react', {runtime: 'classic'}]],
  configFile: false,
}).code;
console.log(
  classic
    .split('\n')
    .map((l) => '  ' + l)
    .join('\n'),
);

section('the value an element actually is');
const el = React.createElement('button', {className: 'primary'}, 'Save');
console.log(inspect(el, {depth: 4, colors: false}));

section('facts about that value');
rows({
  'typeof el': typeof el,
  'el.$$typeof': String(el.$$typeof),
  'el.type': JSON.stringify(el.type),
  'el.key': JSON.stringify(el.key),
  'el.props': JSON.stringify(el.props),
  'Object.isFrozen(el)': Object.isFrozen(el),
  'Object.isFrozen(el.props)': Object.isFrozen(el.props),
  'React.isValidElement(el)': React.isValidElement(el),
});

section('a component element holds the function, not its output');
function Greeting({name}) {
  return React.createElement('p', null, `Hello ${name}`);
}
const cel = React.createElement(Greeting, {name: 'Ada'});
rows({
  'typeof cel.type': typeof cel.type,
  'cel.type.name': cel.type.name,
  'cel.type === Greeting': cel.type === Greeting,
  'has Greeting run yet?': 'no — nothing called it',
  'cel.props': JSON.stringify(cel.props),
});

section('mutating a frozen element');
try {
  el.props.className = 'danger';
  console.log('  no error thrown; className is now', JSON.stringify(el.props.className));
} catch (e) {
  console.log(`  ${e.name}: ${e.message}`);
}

section('key and ref are not props');
const keyed = React.createElement('li', {key: 'a1', id: 'x'}, 'item');
rows({
  'keyed.key': JSON.stringify(keyed.key),
  "'key' in keyed.props": 'key' in keyed.props,
  'keyed.props': JSON.stringify(keyed.props),
});
