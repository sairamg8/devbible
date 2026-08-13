/**
 * Phase 1 — selector families, combinators and attribute selectors.
 *
 * Prints, for each selector, exactly which elements it matched. Assertions of
 * the form "this selector matches that" are the easiest thing in CSS to get
 * subtly wrong, so nothing on the pages is claimed without this output.
 */
import {launch, engine, section} from './harness.mjs';

const HTML = `<!doctype html>
<html><body>
<main id="app" class="layout" data-state="ready" lang="en-GB">
  <h2 class="title heading">Heading</h2>
  <p class="lead">first</p>
  <p>second</p>
  <div class="wrap">
    <p class="lead">nested lead</p>
    <span class="tag" data-kind="alpha-1">a</span>
    <span class="tag" data-kind="beta">b</span>
    <span class="tag" data-kind="alpha-2">c</span>
  </div>
  <a href="/docs/index.html">doc</a>
  <a href="https://example.com/x.pdf">pdf</a>
  <a href="mailto:a@b.c">mail</a>
  <input type="text" required>
  <input type="checkbox" checked>
  <ul><li>1</li><li>2</li><li>3</li><li>4</li><li>5</li></ul>
</main>
</body></html>`;

const SELECTORS = [
  // families
  ['p', 'type'],
  ['.lead', 'class'],
  ['#app', 'id'],
  ['*', 'universal'],
  ['[data-state]', 'attribute presence'],
  // combinators
  ['main p', 'descendant'],
  ['main > p', 'child'],
  ['.title + p', 'next sibling'],
  ['.title ~ p', 'subsequent siblings'],
  ['.wrap > .tag + .tag', 'child + adjacent'],
  // attribute operators
  ['[data-kind="beta"]', 'exact ='],
  ['[data-kind^="alpha"]', 'starts with ^='],
  ['[data-kind$="-1"]', 'ends with $='],
  ['[data-kind*="lph"]', 'contains *='],
  ['[lang|="en"]', 'hyphen prefix |='],
  ['[href$=".pdf" i]', 'case-insensitive i'],
  ['[href^="mailto:"]', 'protocol match'],
  // structural
  ['li:first-child', 'first-child'],
  ['li:last-child', 'last-child'],
  ['li:nth-child(2n)', 'nth-child even'],
  ['li:nth-child(2n+1)', 'nth-child odd'],
  ['li:nth-child(-n+2)', 'first two'],
  ['p:nth-child(2)', 'nth-child counts ALL siblings'],
  ['p:nth-of-type(2)', 'nth-of-type counts P only'],
  ['.tag:nth-child(2 of .tag)', 'nth-child of S'],
  // state / form
  [':checked', 'checked'],
  [':required', 'required'],
  ['input:not([required])', 'not()'],
  // logical
  [':is(.lead, .title)', ':is()'],
  [':where(.lead, .title)', ':where()'],
  ['.wrap:has(.tag)', ':has() — parent selector'],
  ['p:has(+ p)', ':has() — followed by a sibling'],
];

const browser = await launch();
const page = await browser.newPage();
await page.setContent(HTML, {waitUntil: 'load'});
console.log('engine:', await engine(page));

section('What each selector actually matched');
const results = await page.evaluate((sels) =>
  sels.map(([sel, label]) => {
    let nodes;
    try {
      nodes = [...document.querySelectorAll(sel)];
    } catch (e) {
      return {sel, label, error: e.name};
    }
    return {
      sel,
      label,
      count: nodes.length,
      // a short readable identity for each match
      matched: nodes
        .map((n) => {
          const id = n.id ? `#${n.id}` : '';
          const cls = n.className ? `.${String(n.className).split(' ').join('.')}` : '';
          const txt = (n.textContent || '').trim().slice(0, 12);
          return `${n.tagName.toLowerCase()}${id}${cls}[${txt}]`;
        })
        .slice(0, 6),
    };
  }),
SELECTORS);

let group = '';
for (const r of results) {
  console.log(`  ${r.sel.padEnd(28)} ${String(r.count ?? r.error).padStart(3)}  ${r.label}`);
  if (r.matched?.length) console.log(`  ${''.padEnd(28)}      ${r.matched.join('  ')}`);
}

section('The two that people get wrong');
const compare = await page.evaluate(() => ({
  'p:nth-child(2)': [...document.querySelectorAll('p:nth-child(2)')].map((n) => n.textContent.trim()),
  'p:nth-of-type(2)': [...document.querySelectorAll('p:nth-of-type(2)')].map((n) => n.textContent.trim()),
}));
console.log('  p:nth-child(2)   →', JSON.stringify(compare['p:nth-child(2)']));
console.log('  p:nth-of-type(2) →', JSON.stringify(compare['p:nth-of-type(2)']));
console.log('  nth-child counts every sibling, then checks the type.');
console.log('  nth-of-type counts only siblings of that type.');

await browser.close();
