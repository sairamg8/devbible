/**
 * ex01 — JSX is a function call.
 *
 * Backs page 01 (JSX is a function call) and page 15 (the classic runtime).
 * Everything here is real compiler output: Babel with the automatic runtime,
 * Babel with the classic runtime, Babel in development mode (`jsxDEV`), and the
 * `@jsxImportSource` pragma. Plus the real export list of `react/jsx-runtime`.
 */
import babel from '@babel/core';
import {createRequire} from 'node:module';
import {section, rows} from './harness.mjs';

const require = createRequire(import.meta.url);

const compile = (code, opts) =>
  babel.transformSync(code, {
    filename: 'demo.jsx',
    configFile: false,
    babelrc: false,
    presets: [[require.resolve('@babel/preset-react'), opts]],
  }).code;

const SRC_ONE = `const el = <h1 className="title">Hello</h1>;`;
const SRC_MANY = `const el = <ul><li>a</li><li>b</li></ul>;`;
const SRC_KEY = `const el = <li key={id} className="row">{name}</li>;`;
const SRC_COMPONENT = `const el = <Greeting name="Ada" />;`;
const SRC_FRAGMENT = `const el = <><a /><b /></>;`;

section('1. automatic runtime (the default since React 17)');
console.log(compile(SRC_ONE, {runtime: 'automatic'}));

section('2. one child vs many children — jsx vs jsxs');
console.log(compile(SRC_MANY, {runtime: 'automatic'}));

section('3. where `key` goes');
console.log(compile(SRC_KEY, {runtime: 'automatic'}));

section('4. a component: the function itself is the type');
console.log(compile(SRC_COMPONENT, {runtime: 'automatic'}));

section('5. a fragment');
console.log(compile(SRC_FRAGMENT, {runtime: 'automatic'}));

section('6. development mode — jsxDEV and its extra arguments');
console.log(compile(SRC_ONE, {runtime: 'automatic', development: true}));

section('7. classic runtime — what React 16 and earlier emitted');
console.log(compile(SRC_MANY, {runtime: 'classic'}));

section('8. classic runtime with a custom pragma');
console.log(
  compile(`/** @jsx h */\n/** @jsxFrag Frag */\n` + SRC_FRAGMENT, {runtime: 'classic'}),
);

section('9. automatic runtime pointed at another library');
console.log(compile(`/** @jsxImportSource preact */\n` + SRC_ONE, {runtime: 'automatic'}));

section('10. what react/jsx-runtime actually exports');
const rt = await import('react/jsx-runtime');
const dev = await import('react/jsx-dev-runtime');
rows({
  'react/jsx-runtime': Object.keys(rt).sort().join(' '),
  'react/jsx-dev-runtime': Object.keys(dev).sort().join(' '),
  'jsx === jsxs': String(rt.jsx === rt.jsxs),
  'jsx === React.createElement': String(rt.jsx === (await import('react')).createElement),
  'jsx.length (declared args)': rt.jsx.length,
  'jsxDEV.length (declared args)': dev.jsxDEV.length,
});

section('11. the two calls produce the same element');
const React = (await import('react')).default;
const a = rt.jsx('h1', {className: 'title', children: 'Hello'});
const b = React.createElement('h1', {className: 'title'}, 'Hello');
rows({
  'jsx()   type/key': `${a.type} / ${String(a.key)}`,
  'createElement() type/key': `${b.type} / ${String(b.key)}`,
  'same props?': String(JSON.stringify(a.props) === JSON.stringify(b.props)),
  'props of jsx()': JSON.stringify(a.props),
});

section('12. createElement is still exported in 19.2.8');
rows({
  'React.createElement': typeof React.createElement,
  'React.Fragment': String(React.Fragment.toString?.() ?? React.Fragment),
  'react version': require('react/package.json').version,
  '@babel/preset-react': require('@babel/preset-react/package.json').version,
});
