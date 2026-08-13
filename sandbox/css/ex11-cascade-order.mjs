/**
 * Phase 2 — what the cascade actually compares, in order.
 *
 * Each case is a deliberate two-rule conflict where exactly one criterion
 * differs, so the winner names the criterion. Nothing here is asserted from the
 * specification; every winner is read back with getComputedStyle.
 */
import {renderAll, section} from './harness.mjs';

// Distinct colours so the winner is unambiguous in the output.
const C = {
  A: 'rgb(255, 0, 0)',    // red
  B: 'rgb(0, 128, 0)',    // green
  names: {'rgb(255, 0, 0)': 'A (red)', 'rgb(0, 128, 0)': 'B (green)', 'rgb(0, 0, 255)': 'C (blue)'},
};

const page = (css, html = '<p class="x" id="y">t</p>') =>
  `<!doctype html><html><head><style>${css}</style></head><body>${html}</body></html>`;

const readColor = () => {
  const cs = getComputedStyle(document.querySelector('.x'));
  return cs.color;
};

const CASES = [
  {
    name: '1. source order only (identical selectors)',
    expect: 'B — last wins',
    html: page(`.x { color: red } .x { color: green }`),
  },
  {
    name: '2. specificity beats source order',
    expect: 'A — #y is more specific, despite coming first',
    html: page(`#y { color: red } .x { color: green }`),
  },
  {
    name: '3. layer order beats specificity',
    expect: 'B — later layer wins even with a weaker selector',
    html: page(`@layer first, second;
                @layer first  { #y { color: red } }
                @layer second { .x { color: green } }`),
  },
  {
    name: '4. unlayered beats layered',
    expect: 'B — an unlayered rule beats ANY layer',
    html: page(`@layer a, b;
                @layer b { #y { color: red } }
                .x { color: green }`),
  },
  {
    name: '5. !important beats everything normal',
    expect: 'A — important in the FIRST layer wins',
    html: page(`@layer first, second;
                @layer first  { .x { color: red !important } }
                @layer second { #y { color: green } }`),
  },
  {
    name: '6. !important INVERTS layer order',
    expect: 'A — for important declarations the EARLIER layer wins',
    html: page(`@layer first, second;
                @layer first  { .x { color: red !important } }
                @layer second { .x { color: green !important } }`),
  },
  {
    name: '7. inline style beats normal author rules',
    expect: 'inline — element.style outranks the stylesheet',
    html: page(`#y { color: red }`, '<p class="x" id="y" style="color: blue">t</p>'),
  },
  {
    name: '8. !important in a stylesheet beats a normal inline style',
    expect: 'A — important author beats normal inline',
    html: page(`.x { color: red !important }`, '<p class="x" id="y" style="color: blue">t</p>'),
  },
];

const results = await renderAll(
  CASES.map((c) => ({name: c.name, html: c.html, probe: readColor})),
);

section('What the cascade compares — one criterion per case');
for (let i = 0; i < CASES.length; i++) {
  const got = results[i].result;
  console.log(`  ${CASES[i].name}`);
  console.log(`     winner: ${(C.names[got] ?? got).padEnd(12)}  expected: ${CASES[i].expect}`);
}

section('The order, as the cases prove it');
console.log('  1. origin + importance   (cases 5, 6, 8)');
console.log('  2. cascade layer         (cases 3, 4, 6)');
console.log('  3. specificity           (case 2)');
console.log('  4. source order          (case 1)');
console.log('  Inline styles sit between: above normal author rules, below important ones.');
