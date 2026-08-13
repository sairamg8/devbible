/**
 * Phase 0 — how CSS handles your mistakes.
 *
 * The claim under test: an invalid *declaration* is dropped and the rest of the
 * rule survives, but an invalid *selector* in a plain comma list discards the
 * entire rule — and nothing is reported anywhere.
 */
import {launch, engine, section, rows} from './harness.mjs';

const HTML = `<!doctype html>
<html><head><style id="s">
  /* 1. one bad declaration among good ones */
  .a { color: green; colour: red; font-size: notasize; padding: 10px; }

  /* 2. an unknown property with a valid-looking value */
  .b { text-size: 40px; color: blue; }

  /* 3. a bad selector in a plain comma list */
  .c, ::nonsense { color: green; }

  /* 4. the same list, forgiven by :is() */
  :is(.d, ::nonsense) { color: green; }

  /* 5. an unclosed brace swallows what follows */
  .e { color: green;
  .f { color: green; }
</style></head>
<body>
  <p class="a">a</p><p class="b">b</p><p class="c">c</p>
  <p class="d">d</p><p class="e">e</p><p class="f">f</p>
</body></html>`;

const browser = await launch();
const page = await browser.newPage();
await page.setContent(HTML, {waitUntil: 'load'});

// Anything the engine wanted to tell us would arrive here.
const consoleMessages = [];
page.on('console', (m) => consoleMessages.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => consoleMessages.push(`pageerror: ${e.message}`));

console.log('engine:', await engine(page));

section('An invalid declaration is dropped; its neighbours survive');
rows(
  await page.evaluate(() => {
    const rule = document.styleSheets[0].cssRules[0];
    const cs = getComputedStyle(document.querySelector('.a'));
    return {
      'authored declarations': '4 (color, colour, font-size, padding)',
      'longhands kept (padding expands to 4)': rule.style.length,
      'cssText as the engine stored it': rule.cssText,
      'color (valid, kept)': cs.color,
      'padding-left (valid, kept)': cs.paddingLeft,
      'font-size (invalid value, dropped → inherited)': cs.fontSize,
    };
  }),
);

section('An unknown property does not break the rule');
rows(
  await page.evaluate(() => ({
    'rule cssText': document.styleSheets[0].cssRules[1].cssText,
    'color still applied': getComputedStyle(document.querySelector('.b')).color,
  })),
);

section('An invalid SELECTOR discards the whole rule');
rows(
  await page.evaluate(() => {
    const sheet = document.styleSheets[0];
    const selectors = [...sheet.cssRules].map((r) => r.selectorText ?? r.cssText.slice(0, 30));
    return {
      'selectors that survived parsing': selectors,
      '.c color (rule was discarded)': getComputedStyle(document.querySelector('.c')).color,
      '.d color (:is() forgave the bad half)': getComputedStyle(document.querySelector('.d')).color,
      'green is': 'rgb(0, 128, 0)',
      'black (the default) is': 'rgb(0, 0, 0)',
    };
  }),
);

section('An unclosed brace swallows the rules after it');
rows(
  await page.evaluate(() => ({
    'total rules in the sheet': document.styleSheets[0].cssRules.length,
    '.e color': getComputedStyle(document.querySelector('.e')).color,
    '.f color': getComputedStyle(document.querySelector('.f')).color,
  })),
);

section('What the engine reported about any of it');
console.log(
  consoleMessages.length === 0
    ? '  (nothing — no console message, no error event, no exception)'
    : consoleMessages.map((m) => '  ' + m).join('\n'),
);

section('The one API that does tell you: CSS.supports');
rows(
  await page.evaluate(() => ({
    "CSS.supports('colour','red')": CSS.supports('colour', 'red'),
    "CSS.supports('color','red')": CSS.supports('color', 'red'),
    "CSS.supports('font-size','notasize')": CSS.supports('font-size', 'notasize'),
    'el.style.color = "notacolor" leaves': (() => {
      const d = document.createElement('div');
      d.style.color = 'notacolor';
      return JSON.stringify(d.style.color);
    })(),
  })),
);

await browser.close();
