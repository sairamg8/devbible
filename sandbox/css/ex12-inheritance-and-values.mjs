/**
 * Phase 2 — inheritance, the global keywords, shorthand resets, and the value
 * stages a declaration passes through.
 */
import {launch, engine, section, rows} from './harness.mjs';

const HTML = `<!doctype html>
<html><head><style>
  :root { font-size: 16px; }
  .parent {
    color: navy; font-family: Georgia; font-size: 20px; line-height: 1.5;
    letter-spacing: 1px; text-align: center; visibility: visible; cursor: help;
    border: 2px solid red; padding: 10px; margin: 5px; background: yellow;
    width: 300px; opacity: 0.9;
  }
  .child { }

  .g-inherit { border: inherit; }
  .g-initial { color: initial; }
  .g-unset-i { color: unset; }        /* color inherits → behaves as inherit  */
  .g-unset-n { border-color: unset; } /* border-color does not → as initial   */
  .g-revert  { font-weight: revert; } /* back to the UA value                 */

  /* the shorthand trap */
  .sh-1 { border-color: green; border: 2px solid; }
  .sh-2 { border: 2px solid; border-color: green; }
  .sh-3 { background-image: linear-gradient(red, blue); background: yellow; }

  /* percentage resolution */
  .pct-parent { width: 400px; height: 200px; font-size: 10px; }
  .pct-child  { width: 50%; padding-top: 10%; margin-left: 25%; height: 50%; font-size: 150%; }
</style></head>
<body>
  <div class="parent">
    <b class="child">child</b>
    <b class="g-inherit">gi</b><b class="g-initial">gn</b>
    <b class="g-unset-i">gu1</b><b class="g-unset-n">gu2</b><b class="g-revert">gr</b>
  </div>
  <p class="sh-1">1</p><p class="sh-2">2</p><p class="sh-3">3</p>
  <div class="pct-parent"><div class="pct-child">pct</div></div>
</body></html>`;

const browser = await launch();
const page = await browser.newPage();
await page.setContent(HTML, {waitUntil: 'load'});
console.log('engine:', await engine(page));

section('Which properties inherit — parent vs untouched child');
const inherit = await page.evaluate(() => {
  const p = getComputedStyle(document.querySelector('.parent'));
  const c = getComputedStyle(document.querySelector('.child'));
  const props = ['color', 'fontFamily', 'fontSize', 'lineHeight', 'letterSpacing',
    'textAlign', 'visibility', 'cursor', 'borderTopWidth', 'padding', 'margin',
    'backgroundColor', 'width', 'opacity'];
  return props.map((k) => ({
    prop: k,
    parent: String(p[k]).slice(0, 22),
    child: String(c[k]).slice(0, 22),
    inherited: p[k] === c[k],
  }));
});
for (const r of inherit) {
  console.log(`  ${r.prop.padEnd(16)} ${r.inherited ? 'INHERITS    ' : 'does not    '} parent=${r.parent.padEnd(22)} child=${r.child}`);
}

section('The global keywords');
rows(
  await page.evaluate(() => {
    const g = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop];
    return {
      'border: inherit (parent 2px solid red)': g('.g-inherit', 'borderTopColor') + ' / ' + g('.g-inherit', 'borderTopWidth'),
      'color: initial (NOT the parent navy)': g('.g-initial', 'color'),
      'color: unset — color inherits, so →': g('.g-unset-i', 'color'),
      'border-color: unset — does not inherit, so →': g('.g-unset-n', 'borderTopColor'),
      'font-weight: revert on <b> → UA value': g('.g-revert', 'fontWeight'),
      'plain <b> UA font-weight for comparison': g('.child', 'fontWeight'),
    };
  }),
);

section('The shorthand reset trap');
rows(
  await page.evaluate(() => {
    const g = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop];
    return {
      '.sh-1 border-color: green THEN border: 2px solid': g('.sh-1', 'borderTopColor'),
      '.sh-2 border: 2px solid THEN border-color: green': g('.sh-2', 'borderTopColor'),
      '.sh-3 background-image THEN background: yellow': g('.sh-3', 'backgroundImage'),
      'green is': 'rgb(0, 128, 0)',
      'currentcolor here resolves to': g('.sh-1', 'color'),
    };
  }),
);

section('What a percentage resolves against');
rows(
  await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.pct-child'));
    return {
      'parent is': '400px wide, 200px tall, font-size 10px',
      'width: 50%  → 50% of parent WIDTH': cs.width,
      'padding-top: 10% → 10% of parent WIDTH (not height!)': cs.paddingTop,
      'margin-left: 25% → 25% of parent WIDTH': cs.marginLeft,
      'height: 50% → 50% of parent HEIGHT': cs.height,
      'font-size: 150% → 150% of parent FONT-SIZE': cs.fontSize,
    };
  }),
);

section('Specified vs computed vs used');
rows(
  await page.evaluate(() => {
    const el = document.querySelector('.pct-child');
    const cs = getComputedStyle(el);
    return {
      'specified width': '50%',
      'getComputedStyle().width (resolved/used)': cs.width,
      'getBoundingClientRect().width': el.getBoundingClientRect().width,
      'specified line-height on .parent': '1.5 (unitless)',
      'computed line-height (of 20px font)': getComputedStyle(document.querySelector('.parent')).lineHeight,
      'child inherits the NUMBER, not the length': getComputedStyle(document.querySelector('.child')).lineHeight,
    };
  }),
);

await browser.close();
