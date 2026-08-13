/**
 * Phase 0 — the user-agent stylesheet, and what a reset actually changes.
 *
 * Every "default" on a bare page comes from somewhere. This prints the values
 * so the pages can name real numbers instead of saying "browsers add some
 * margin".
 */
import {renderAll, section, rows} from './harness.mjs';

const BARE = `<!doctype html><html><body>
  <h1>h1</h1><h2>h2</h2><p>p</p>
  <ul><li>li</li></ul>
  <button>button</button><input value="input">
  <a href="#x">a</a><em>em</em><strong>strong</strong>
  <table><tr><td>td</td></tr></table>
  <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" width="20" height="20" alt="">
</body></html>`;

const RESET = `<!doctype html><html><head><style>
  *, *::before, *::after { box-sizing: border-box; }
  * { margin: 0; }
  body { line-height: 1.5; -webkit-font-smoothing: antialiased; }
  img, picture, video, canvas, svg { display: block; max-width: 100%; }
  input, button, textarea, select { font: inherit; }
  p, h1, h2, h3, h4, h5, h6 { overflow-wrap: break-word; }
</style></head><body>
  <h1>h1</h1><h2>h2</h2><p>p</p>
  <ul><li>li</li></ul>
  <button>button</button><input value="input">
  <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" width="20" height="20" alt="">
</body></html>`;

const probe = () => {
  const read = (sel, props) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return Object.fromEntries(props.map((p) => [p, cs[p]]));
  };
  return {
    'html font-size': getComputedStyle(document.documentElement).fontSize,
    body: read('body', ['margin', 'lineHeight', 'fontFamily']),
    h1: read('h1', ['fontSize', 'marginBlockStart', 'fontWeight']),
    h2: read('h2', ['fontSize', 'marginBlockStart']),
    p: read('p', ['marginBlockStart', 'marginBlockEnd']),
    ul: read('ul', ['paddingInlineStart', 'marginBlockStart', 'listStyleType']),
    button: read('button', ['fontFamily', 'fontSize', 'padding', 'borderWidth', 'cursor']),
    input: read('input', ['fontFamily', 'fontSize', 'borderWidth']),
    a: read('a', ['color', 'textDecorationLine']),
    em: read('em', ['fontStyle']),
    strong: read('strong', ['fontWeight']),
    td: read('td', ['padding']),
    img: read('img', ['display', 'maxWidth']),
    'box-sizing (any element)': read('body', ['boxSizing']),
  };
};

const [bare, reset] = await renderAll([
  {name: 'bare', html: BARE, probe},
  {name: 'reset', html: RESET, probe},
]);

section('The user-agent stylesheet — a page with no CSS at all');
rows(bare.result);

section('The same page under a modern reset');
rows(reset.result);

section('What the reset actually changed');
const diff = {};
for (const key of Object.keys(bare.result)) {
  const a = JSON.stringify(bare.result[key]);
  const b = JSON.stringify(reset.result[key]);
  if (a !== b && reset.result[key] !== null) diff[key] = `${a}  →  ${b}`;
}
rows(diff);
