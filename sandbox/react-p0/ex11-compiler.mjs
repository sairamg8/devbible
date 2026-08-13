/**
 * ex11 — The React Compiler: what it actually emits.
 *
 * Backs: pages/phase-0-how-react-runs/11-the-compiler.md
 */
import {section, rows} from './harness.mjs';
import {transformSync} from '@babel/core';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);

// `filename` is required: without it the plugin throws
// "Expected a filename but found none."
const compile = (code, filename = 'Component.jsx') =>
  transformSync(code, {
    filename,
    configFile: false,
    babelrc: false,
    plugins: [['babel-plugin-react-compiler', {}]],
    parserOpts: {plugins: ['jsx']},
  }).code;

section('versions');
rows({
  'babel-plugin-react-compiler': require('babel-plugin-react-compiler/package.json').version,
  '@babel/core': require('@babel/core/package.json').version,
});

const SOURCE = `
function ProductRow({product, onAdd}) {
  const price = formatPrice(product.cents);
  const handleClick = () => onAdd(product.id);
  return <li onClick={handleClick}>{product.name} — {price}</li>;
}
`;

section('you write');
console.log(SOURCE.trim().split('\n').map((l) => '  ' + l).join('\n'));

section('the compiler emits');
console.log(compile(SOURCE).split('\n').map((l) => '  ' + l).join('\n'));

section('a component it CANNOT safely memoize (mutates a prop)');
const IMPURE = `
function Broken({items}) {
  items.push('mutated during render');
  return <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>;
}
`;
console.log(IMPURE.trim().split('\n').map((l) => '  ' + l).join('\n'));
console.log('\n  --- output ---');
const out = compile(IMPURE);
console.log(out.split('\n').map((l) => '  ' + l).join('\n'));
// The emitted cache helper is `_c` imported from react/compiler-runtime, NOT
// `useMemoCache`. Grepping for the wrong name reports a bail-out that did not
// happen.
const slots = (code) => {
  const m = code.match(/_c\((\d+)\)/);
  return m ? Number(m[1]) : null;
};
rows({
  'compiled?': slots(out) === null ? 'no — bailed out' : `yes, ${slots(out)} cache slots`,
  'note': 'the mutation is NOT reported here; the linter is what flags it',
});

section('so what DOES make it bail out?');
const CONDITIONAL_HOOK = `
function Sometimes({flag}) {
  if (flag) { const [a] = useState(0); return <p>{a}</p>; }
  return null;
}
`;
try {
  const c = compile(CONDITIONAL_HOOK);
  rows({'conditional hook': slots(c) === null ? 'bailed out — left as written' : `compiled, ${slots(c)} slots`});
} catch (e) {
  rows({'conditional hook': `${e.constructor.name}: ${String(e.message).split('\n')[0]}`});
}

section('does it also memoize a custom hook?');
const HOOK = `
function useFilteredItems(items, query) {
  const filtered = items.filter((i) => i.name.includes(query));
  return {filtered, count: filtered.length};
}
`;
console.log(compile(HOOK).split('\n').map((l) => '  ' + l).join('\n'));

section('which functions does it treat as compilable at all?');
const KINDS = {
  'component (capitalised, returns JSX)': `function Row({a}){return <li>{a}</li>;}`,
  'hook that calls useState': `function useX(items,q){const [x]=useState(0);const f=items.filter(i=>i.includes(q));return {f,x};}`,
  'hook that calls useMemo': `function useX(items,q){const f=useMemo(()=>items.filter(i=>i.includes(q)),[items,q]);return f;}`,
  'use-prefixed fn calling NO hooks': `function useX(items,q){const f=items.filter(i=>i.includes(q));return {f,n:f.length};}`,
  'plain function, no use prefix': `function filt(items,q){const f=items.filter(i=>i.includes(q));return {f,n:f.length};}`,
};
for (const [label, src] of Object.entries(KINDS)) {
  const m = compile(src).match(/_c\((\d+)\)/);
  console.log(`  ${label.padEnd(38)} ${m ? m[1] + ' slots' : 'not compiled'}`);
}

section('cache slots allocated per function');
for (const [label, src] of [
  ['component: value + callback + JSX', SOURCE],
  ['component that mutates a prop', IMPURE],
  ['custom hook returning a new object', HOOK],
]) {
  const m = compile(src).match(/_c\((\d+)\)/);
  console.log(`  ${label.padEnd(36)} ${m ? m[1] + ' slots' : 'not compiled'}`);
}
