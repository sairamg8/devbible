/**
 * Phase 0 — reproducing the DevTools Styles pane from the CSSOM.
 *
 * DevTools is not magic: "which rules match this element, in which order, and
 * which declarations lost" is answerable from the same APIs a page has. Building
 * it once is the fastest way to understand what the panel is telling you.
 */
import {launch, engine, section} from './harness.mjs';

const HTML = `<!doctype html>
<html><head><style>
  p                    { color: black; margin: 1em 0; }
  .note                { color: blue; padding: 4px; }
  #lead                { color: green; }
  .note                { color: rebeccapurple; }
  article p.note       { font-weight: 700; }
  :where(.note)        { letter-spacing: 1px; }
</style></head>
<body><article><p id="lead" class="note" style="text-indent: 2px">text</p></article></body></html>`;

const browser = await launch();
const page = await browser.newPage();
await page.setContent(HTML, {waitUntil: 'load'});
console.log('engine:', await engine(page));

section('Every rule that matches #lead, in source order');
const matched = await page.evaluate(() => {
  const el = document.getElementById('lead');

  // Specificity as the cascade counts it: (id, class-ish, type).
  // Good enough for a demonstration; :where() contributes zero, which is the
  // part worth seeing.
  const specificity = (sel) => {
    if (sel.startsWith(':where(')) return [0, 0, 0];
    const ids = (sel.match(/#[\w-]+/g) || []).length;
    const classes = (sel.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+\([^)]*\)|:(?!:)[\w-]+/g) || []).length;
    const types = (sel.match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length;
    return [ids, classes, types];
  };

  return [...document.styleSheets[0].cssRules]
    .filter((r) => r.selectorText && el.matches(r.selectorText))
    .map((r, i) => ({
      index: i,
      selector: r.selectorText,
      specificity: specificity(r.selectorText).join(','),
      declares: [...r.style].join(' '),
      color: r.style.getPropertyValue('color') || '—',
    }));
});
for (const m of matched) {
  console.log(
    `  ${m.selector.padEnd(18)} spec ${m.specificity}   color: ${String(m.color).padEnd(14)} sets: ${m.declares}`,
  );
}

section('What actually won');
const won = await page.evaluate(() => {
  const el = document.getElementById('lead');
  const cs = getComputedStyle(el);
  return {
    color: cs.color,
    fontWeight: cs.fontWeight,
    letterSpacing: cs.letterSpacing,
    textIndent: cs.textIndent,
    padding: cs.padding,
  };
});
for (const [k, v] of Object.entries(won)) console.log(`  ${k.padEnd(14)} ${v}`);

section('Reading it');
console.log('  #lead sets green with the highest specificity (1,0,0), so green wins');
console.log('  even though .note { color: rebeccapurple } comes LATER in the file.');
console.log('  This is what the Styles pane shows as struck-through declarations:');
console.log('  every losing rule is still listed, in the order it was beaten.');
console.log('  :where(.note) contributed letter-spacing at specificity 0,0,0 —');
console.log('  it applied because nothing else set letter-spacing at all.');
console.log('  text-indent came from the inline style attribute, which is why');
console.log('  DevTools shows it in its own "element.style" block at the top.');

await browser.close();
