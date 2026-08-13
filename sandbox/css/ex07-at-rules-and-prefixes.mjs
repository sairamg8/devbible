/**
 * Phase 0 — which at-rules the engine actually recognises, and what is left of
 * vendor prefixes in 2026.
 *
 * An unrecognised at-rule is dropped exactly like an unrecognised property, so
 * the CSSOM rule list is a direct read-out of what this engine understands.
 */
import {launch, engine, section, rows} from './harness.mjs';

const AT_RULES = [
  ['@media (min-width: 1px)', '{ .x { color: red } }'],
  ['@supports (color: red)', '{ .x { color: red } }'],
  ['@layer base', '{ .x { color: red } }'],
  ['@container (min-width: 1px)', '{ .x { color: red } }'],
  ['@scope (.a) to (.b)', '{ .x { color: red } }'],
  ['@property --p', '{ syntax: "<length>"; inherits: false; initial-value: 0px; }'],
  ['@font-face', '{ font-family: X; src: url(x.woff2); }'],
  ['@keyframes k', '{ from { opacity: 0 } to { opacity: 1 } }'],
  ['@page', '{ margin: 1cm; }'],
  ['@starting-style', '{ .x { opacity: 0 } }'],
  ['@counter-style c', '{ system: cyclic; symbols: "x"; }'],
  ['@nonsense foo', '{ .x { color: red } }'],
];

const css = AT_RULES.map(([head, body]) => `${head} ${body}`).join('\n');
const HTML = `<!doctype html><html><head><style>${css}</style></head><body><p class="x">x</p></body></html>`;

const browser = await launch();
const page = await browser.newPage();
await page.setContent(HTML, {waitUntil: 'load'});
const eng = await engine(page);
console.log('engine:', eng);

section('Which at-rules survived parsing');
const survived = await page.evaluate(() =>
  [...document.styleSheets[0].cssRules].map((r) => ({
    type: r.constructor.name,
    head: r.cssText.split('{')[0].trim(),
  })),
);
const heads = survived.map((s) => s.head);
for (const [head] of AT_RULES) {
  const name = head.split(/[\s(]/)[0];
  const kept = heads.some((h) => h.startsWith(name));
  console.log(`  ${head.padEnd(30)} ${kept ? 'kept   ' : 'DROPPED'} ${kept ? survived.find((s) => s.head.startsWith(name)).type : ''}`);
}

section('Vendor prefixes — what is still real');
rows(
  await page.evaluate(() => {
    const pairs = [
      ['line-clamp', '3'],
      ['-webkit-line-clamp', '3'],
      ['backdrop-filter', 'blur(4px)'],
      ['-webkit-backdrop-filter', 'blur(4px)'],
      ['user-select', 'none'],
      ['-webkit-user-select', 'none'],
      ['box-shadow', '0 0 1px red'],
      ['-webkit-box-shadow', '0 0 1px red'],
      ['border-radius', '4px'],
      ['-moz-border-radius', '4px'],
      ['appearance', 'none'],
      ['-webkit-appearance', 'none'],
      ['text-size-adjust', '100%'],
      ['-webkit-text-size-adjust', '100%'],
    ];
    return Object.fromEntries(pairs.map(([p, v]) => [p, CSS.supports(p, v)]));
  }),
);

section('The -webkit- prefix Firefox implements on purpose');
console.log('  Firefox supports several -webkit- properties for web compatibility:');
console.log('  sites shipped them for years, so refusing them broke real pages.');
console.log('  That is why a prefix check is not a browser check.');

await browser.close();
