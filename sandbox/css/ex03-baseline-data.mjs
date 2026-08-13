/**
 * Phase 0 — deciding whether a feature is safe to ship.
 *
 * Two different questions, deliberately answered by two different sources:
 *   "does this engine support it"  → CSS.supports, in the local Firefox
 *   "is it safe to ship"           → web-features (Baseline), for all engines
 *
 * The interesting output is where the two DISAGREE: things this Firefox
 * supports happily that are not Baseline at all.
 */
import {launch, engine, section} from './harness.mjs';
import {WEB_FEATURES_VERSION, FEATURE_COUNT, baseline, table} from './baseline.mjs';

console.log('web-features', WEB_FEATURES_VERSION, '·', FEATURE_COUNT, 'features');

section('Baseline status, straight from web-features');
console.log(
  table([
    'has', 'container-queries', 'subgrid', 'nesting', 'cascade-layers',
    'color-mix', 'oklab', 'logical-properties', 'aspect-ratio',
    'light-dark', 'scope', 'popover', 'content-visibility', 'view-transitions',
    'starting-style', 'field-sizing', 'details-content', 'scrollbar-gutter',
    'anchor-positioning', 'scroll-driven-animations', 'masonry',
    'calc-size', 'interpolate-size', 'line-clamp', 'text-wrap-pretty',
    'accent-color', 'marker', 'relative-color',
  ])
    .map((l) => '  ' + l)
    .join('\n'),
);

// Now ask the engine the same questions.
const PROBES = {
  has: 'selector(:has(a))',
  'container-queries': 'container-type: inline-size',
  subgrid: 'grid-template-columns: subgrid',
  nesting: 'selector(&)',
  'cascade-layers': null, // at-rule, not testable with CSS.supports
  'color-mix': 'color: color-mix(in oklch, red, blue)',
  oklab: 'color: oklch(70% 0.1 200)',
  'light-dark': 'color: light-dark(white, black)',
  'field-sizing': 'field-sizing: content',
  'anchor-positioning': 'position-area: top',
  'scroll-driven-animations': 'animation-timeline: scroll()',
  masonry: 'grid-template-rows: masonry',
  'calc-size': 'height: calc-size(auto, size)',
  'interpolate-size': 'interpolate-size: allow-keywords',
  'line-clamp': 'line-clamp: 3',
  'text-wrap-pretty': 'text-wrap: pretty',
  'accent-color': 'accent-color: red',
  'content-visibility': 'content-visibility: auto',
  'relative-color': 'color: oklch(from red l c h)',
};

const browser = await launch();
const page = await browser.newPage();
await page.setContent('<!doctype html><p>x', {waitUntil: 'load'});
const eng = await engine(page);

const support = await page.evaluate((probes) => {
  const out = {};
  for (const [key, decl] of Object.entries(probes)) {
    if (decl === null) { out[key] = null; continue; }
    out[key] = decl.startsWith('selector(')
      ? CSS.supports(decl)
      : CSS.supports(decl.split(':')[0].trim(), decl.slice(decl.indexOf(':') + 1).trim());
  }
  return out;
}, PROBES);
await browser.close();

section(`${eng} support vs Baseline — where they disagree`);
console.log(`  ${'feature'.padEnd(28)} ${eng.padEnd(14)} Baseline`);
for (const [key, supported] of Object.entries(support)) {
  if (supported === null) continue;
  const b = baseline(key);
  const flag = supported && b.baseline === false ? '   ← ships here, NOT Baseline' : '';
  console.log(`  ${key.padEnd(28)} ${String(supported).padEnd(14)} ${b.label}${flag}`);
}

section('The point');
console.log('  A green CSS.supports() in one engine is not a shipping decision.');
console.log('  Everything flagged above renders correctly on this machine and');
console.log('  would still break for a share of real users.');
