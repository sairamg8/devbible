/**
 * Phase 0 — the rendering pipeline and the CSSOM.
 *
 * Shows that a stylesheet becomes an object model with a rule list, that the
 * declarations in it are normalised (not stored as typed), and which pipeline
 * stages a property change actually costs.
 */
import {launch, engine, section, rows} from './harness.mjs';

const HTML = `<!doctype html>
<html>
<head>
<style id="sheet">
  body { margin: 0; font: 16px/1.5 system-ui; }
  .card { color: #ff0000; padding: 1em 2em; border: 1px solid; }
  @media (min-width: 400px) { .card { color: rgb(0 128 0); } }
  .card:hover { color: blue; }
</style>
</head>
<body><div class="card">card</div></body>
</html>`;

const browser = await launch();
const page = await browser.newPage();
await page.setViewport({width: 900, height: 700});
await page.setContent(HTML, {waitUntil: 'load'});

console.log('engine:', await engine(page));

section('document.styleSheets — the CSSOM');
rows(
  await page.evaluate(() => {
    const sheet = document.styleSheets[0];
    return {
      sheetCount: document.styleSheets.length,
      ruleCount: sheet.cssRules.length,
      ruleTypes: [...sheet.cssRules].map((r) => r.constructor.name),
      firstSelector: sheet.cssRules[1].selectorText,
      mediaCondition: sheet.cssRules[2].conditionText,
    };
  }),
);

section('Declarations are normalised on parse, not stored verbatim');
rows(
  await page.evaluate(() => {
    const decl = document.styleSheets[0].cssRules[1].style;
    return {
      'authored #ff0000 reads back as': decl.getPropertyValue('color'),
      'shorthand padding expands to': decl.length,
      longhands: [...decl].join(','),
      'border 1px solid reads back as': decl.getPropertyValue('border'),
      'border-color with no author value': JSON.stringify(decl.getPropertyValue('border-color')),
    };
  }),
);

section('Computed value vs specified value');
rows(
  await page.evaluate(() => {
    const el = document.querySelector('.card');
    const cs = getComputedStyle(el);
    return {
      'specified padding': document.styleSheets[0].cssRules[1].style.padding,
      'computed padding-left (2em @16px)': cs.paddingLeft,
      'computed color (media query won)': cs.color,
      'computed font-size': cs.fontSize,
      'computed line-height (1.5 unitless)': cs.lineHeight,
    };
  }),
);

section('Which pipeline stage a change costs');
// Each mutation is applied, then a forced read shows what had to be recomputed.
// The element is `inline-block` so that its own box depends on its padding —
// a block-level `width: auto` box keeps the same border-box width when padding
// changes, which would make this measurement look like padding costs nothing.
rows(
  await page.evaluate(() => {
    const el = document.querySelector('.card');
    el.style.display = 'inline-block';
    const box = () => {
      const r = el.getBoundingClientRect();
      return {w: r.width, h: r.height, x: r.x};
    };
    const before = box();
    el.style.color = 'purple'; // paint only
    const afterPaint = box();
    el.style.padding = '3em'; // layout
    const afterLayout = box();
    el.style.transform = 'translateX(50px)'; // composite only
    const afterTransform = box();
    return {
      'before                 (w,h,x)': [before.w, before.h, before.x],
      'after color: purple    (w,h,x)': [afterPaint.w, afterPaint.h, afterPaint.x],
      'after padding: 3em     (w,h,x)': [afterLayout.w, afterLayout.h, afterLayout.x],
      'after translateX(50px) (w,h,x)': [afterTransform.w, afterTransform.h, afterTransform.x],
      'color changed the box?': JSON.stringify(before) === JSON.stringify(afterPaint) ? 'no' : 'yes',
      'padding changed the box?': afterPaint.w !== afterLayout.w || afterPaint.h !== afterLayout.h ? 'yes' : 'no',
      'transform changed w/h?': afterLayout.w === afterTransform.w && afterLayout.h === afterTransform.h ? 'no — only position' : 'yes',
    };
  }),
);

await browser.close();
