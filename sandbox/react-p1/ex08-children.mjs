/**
 * ex08 — `children`: the shape it actually has, and the four ways to pass it.
 * Backs page 09.
 *
 * Most of this runs in Node — `children` is a plain property on a plain object,
 * so no browser is needed to inspect it. The last block renders, because the
 * "which wins, the attribute or the nesting" question is answered by the DOM.
 */
import React, {Children, isValidElement, Fragment} from 'react';
import {section, rows} from './harness.mjs';
import {renderToStaticMarkup} from 'react-dom/server';
import {jsx, jsxs} from 'react/jsx-runtime';

const el = (type, props, ...kids) => React.createElement(type, props, ...kids);
const describe = (v) =>
  Array.isArray(v)
    ? `array(${v.length})`
    : v === undefined
      ? 'undefined'
      : isValidElement(v)
        ? `element <${typeof v.type === 'string' ? v.type : v.type.name}>`
        : `${typeof v}: ${JSON.stringify(v)}`;

section('1. the shape of props.children');
const cases = {
  'no children':            el('div', null),
  'one text child':         el('div', null, 'hi'),
  'one element child':      el('div', null, el('b', null, 'x')),
  'two children':           el('div', null, el('b', null, 'x'), el('i', null, 'y')),
  'text + expression':      el('div', null, 'a ', 'b'),
  'a mapped array':         el('div', null, [1, 2, 3].map((n) => el('li', {key: n}, n))),
  'array + sibling':        el('div', null, [el('li', {key: 1}, 1)], el('hr', null)),
  'null child':             el('div', null, null),
  'children as an attribute': el('div', {children: 'from-prop'}),
};
for (const [label, element] of Object.entries(cases)) {
  console.log(`  ${label.padEnd(26)} typeof=${(typeof element.props.children).padEnd(9)} ${describe(element.props.children)}`);
}

section('2. one child is NOT an array of one');
const one = el('div', null, el('b', null, 'x'));
const two = el('div', null, el('b', null, 'x'), el('i', null, 'y'));
rows({
  'Array.isArray(one.children)': String(Array.isArray(one.props.children)),
  'Array.isArray(two.children)': String(Array.isArray(two.props.children)),
  'one.children.map exists': String(typeof one.props.children.map),
  'Children.count(one)': Children.count(one.props.children),
  'Children.count(two)': Children.count(two.props.children),
  'Children.count(null)': Children.count(null),
  'Children.count(nested array)': Children.count([[1, 2], [3]]),
});

section('3. the compiler decides jsx vs jsxs, and that decides the shape');
const viaJsx = jsx('div', {children: el('b', null, 'x')});
const viaJsxs = jsxs('div', {children: [el('b', null, 'x'), el('i', null, 'y')]});
rows({
  'jsx  -> children': describe(viaJsx.props.children),
  'jsxs -> children': describe(viaJsxs.props.children),
});

section('4. Children.toArray — flattening and the keys it invents');
const mixed = [el('b', {key: 'k1'}, 'x'), null, [el('i', null, 'y'), el('u', {key: 'k2'}, 'z')], 'text', false];
const flat = Children.toArray(mixed);
console.log(`  input:  array(${mixed.length}) with a nested array, a null, a false and a string`);
console.log(`  output: array(${flat.length})`);
for (const c of flat) {
  console.log(`    ${isValidElement(c) ? `<${c.type}>`.padEnd(6) : 'text  '} key=${JSON.stringify(c.key ?? null)}`);
}

section('5. Children.map keys vs a plain .map');
const kids = [el('b', {key: 'a'}, 1), el('b', {key: 'b'}, 2)];
console.log('  Children.map:', Children.map(kids, (c) => c).map((c) => c.key).join(' '));
console.log('  plain .map:  ', kids.map((c) => c).map((c) => c.key).join(' '));

section('6. children as a function, and elements as props');
function Toggle({children}) {
  return children({on: true});
}
function Layout({header, children, footer}) {
  return el('main', null, header, el('div', null, children), footer);
}
console.log('  render-prop:', renderToStaticMarkup(el(Toggle, null, ({on}) => el('b', null, on ? 'ON' : 'OFF'))));
console.log('  slots:      ', renderToStaticMarkup(el(Layout, {header: el('h1', null, 'H'), footer: el('footer', null, 'F')}, 'body')));

section('7. attribute vs nesting — which children win');
console.log('  <div children="from-prop">from-nesting</div>');
console.log('   ->', renderToStaticMarkup(el('div', {children: 'from-prop'}, 'from-nesting')));
console.log('  <div children="from-prop" />');
console.log('   ->', renderToStaticMarkup(el('div', {children: 'from-prop'})));

section('8. a fragment child is still one child');
const withFragment = el('div', null, el(Fragment, null, el('b', null, 'x'), el('i', null, 'y')));
rows({
  'children': describe(withFragment.props.children),
  'Children.count': Children.count(withFragment.props.children),
  'markup': renderToStaticMarkup(withFragment),
});
