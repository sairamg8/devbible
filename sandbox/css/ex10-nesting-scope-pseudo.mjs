/**
 * Phase 1 — nesting, @scope, pseudo-elements, and what a selector costs.
 *
 * Four questions the pages need real answers to:
 *   1. what does a nested rule desugar to, and what specificity does it carry
 *   2. does @scope actually stop at its lower bound
 *   3. what is a pseudo-element, from the DOM's point of view
 *   4. is `:has()` measurably slower than a class, at a realistic size
 */
import {launch, engine, section, rows} from './harness.mjs';

const HTML = `<!doctype html>
<html><head><style id="s">
  .card {
    color: navy;
    & .title { font-weight: 700; }
    &:hover { color: teal; }
    .inner & { font-style: italic; }
    @media (min-width: 1px) { padding: 4px; }
  }

  @scope (.widget) to (.slot) {
    p { color: green; }
  }

  .quote::before { content: "\\201C"; color: red; }
  .quote::after  { content: "\\201D"; }
</style></head>
<body>
  <div class="inner">
    <div class="card"><span class="title">t</span></div>
  </div>
  <div class="widget">
    <p id="in-scope">inside the widget</p>
    <div class="slot"><p id="in-slot">inside the slot</p></div>
  </div>
  <blockquote class="quote">quoted</blockquote>
</body></html>`;

const browser = await launch();
const page = await browser.newPage();
await page.setContent(HTML, {waitUntil: 'load'});
console.log('engine:', await engine(page));

section('What a nested rule desugars to');
const nested = await page.evaluate(() => {
  const card = [...document.styleSheets[0].cssRules].find((r) => r.selectorText === '.card');
  return {
    'outer selector': card.selectorText,
    'nested rules': card.cssRules.length,
    desugared: [...card.cssRules].map((r) => r.selectorText ?? r.cssText.split('{')[0].trim()),
  };
});
rows(nested);

section('Nesting: computed results');
rows(
  await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.card'));
    return {
      'color (from .card)': cs.color,
      'padding (from nested @media)': cs.padding,
      'font-style (from .inner &)': cs.fontStyle,
      '.title weight (from & .title)': getComputedStyle(document.querySelector('.title')).fontWeight,
    };
  }),
);

section('@scope — does the lower bound hold?');
rows(
  await page.evaluate(() => ({
    'p inside .widget (in scope)': getComputedStyle(document.getElementById('in-scope')).color,
    'p inside .slot (below the bound)': getComputedStyle(document.getElementById('in-slot')).color,
    'green is': 'rgb(0, 128, 0)',
    'default is': 'rgb(0, 0, 0)',
  })),
);

section('Pseudo-elements are not in the DOM');
rows(
  await page.evaluate(() => {
    const q = document.querySelector('.quote');
    return {
      'childNodes of .quote': q.childNodes.length,
      'querySelector("::before")': (() => {
        try { return String(document.querySelector('.quote::before')); } catch (e) { return e.name; }
      })(),
      'getComputedStyle(el, "::before").content': getComputedStyle(q, '::before').content,
      'its colour': getComputedStyle(q, '::before').color,
      'textContent includes the quote mark?': q.textContent.includes('“'),
    };
  }),
);

section('Selector cost — :has() vs a class, 5000 elements');
rows(
  await page.evaluate(() => {
    const host = document.createElement('div');
    for (let i = 0; i < 5000; i++) {
      const row = document.createElement('div');
      row.className = 'row';
      const input = document.createElement('input');
      input.type = 'checkbox';
      if (i % 10 === 0) { input.checked = true; row.classList.add('is-checked'); }
      row.append(input);
      host.append(row);
    }
    document.body.append(host);

    const time = (fn) => {
      fn(); // warm
      const t0 = performance.now();
      for (let i = 0; i < 20; i++) fn();
      return +((performance.now() - t0) / 20).toFixed(3);
    };

    return {
      'querySelectorAll(".is-checked")': time(() => document.querySelectorAll('.is-checked').length),
      'querySelectorAll(".row:has(:checked)")': time(() => document.querySelectorAll('.row:has(:checked)').length),
      'both return': document.querySelectorAll('.row:has(:checked)').length,
      note: 'ms per call, mean of 20',
    };
  }),
);

await browser.close();
