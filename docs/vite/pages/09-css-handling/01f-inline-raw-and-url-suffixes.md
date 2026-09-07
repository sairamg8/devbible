---
title: "`?inline`, `?raw` and `?url` are three different exits from the CSS pipeline — one returns processed text without injecting it, one bypasses processing entirely, and one emits a standalone stylesheet and hands you its address"
sidebar_label: "?inline, ?raw and ?url"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Features › Disabling CSS injection into the page](https://vite.dev/guide/features.md), [Static Asset Handling › Explicit URL Imports / Explicit Inline Handling / Importing Asset as String](https://vite.dev/guide/assets.md) — plus `packages/vite/src/node/plugins/css.ts` and `constants.ts` at tag `v8.2.2` (`inlineRE`, the `?url` guard and `__VITE_CSS_URL__` emit path, `transformOnlyRE`, `SPECIAL_QUERY_RE`). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ `?inline`, `?raw` and `?url` on Stylesheets

**By default, importing CSS is a side effect: the stylesheet is processed and applied, and the import binding is worthless. The three query suffixes each break one part of that sentence** — `?inline` keeps the processing and drops the application, `?raw` drops the processing entirely, and `?url` keeps the processing but ships the result as a separate file you address yourself. Picking the wrong one is how people end up shipping unprefixed, un-rebased CSS into a shadow root.

## 1. Under-The-Hood Mechanics

### `?inline` — processed, returned, not injected

> *"The automatic injection of CSS contents can be turned off via the `?inline` query parameter. In this case, the processed CSS string is returned as the module's default export as usual, but the styles aren't injected to the page."*
> — [Features › Disabling CSS injection into the page](https://vite.dev/guide/features.md)

```js
import './foo.css' // will be injected into the page
import otherStyles from './bar.css?inline' // will not be injected
```

The word doing the work is **processed**. `?inline` sits at the *end* of the pipeline: preprocessors have run, `@import` has been inlined, `url()` has been rebased, PostCSS (or Lightning CSS) has run. In a production build the string is also minified when `build.cssMinify` is truthy, and the file is deliberately **not** added to the extracted stylesheet — it exists only as the string you asked for.

> *"Default and named imports from CSS files (e.g `import style from './foo.css'`) are removed since Vite 5. Use the `?inline` query instead."* — same page

That is why a tutorial older than Vite 5 showing `import style from './foo.css'` gives you `undefined` today.

### `?raw` — the file's text, untouched

> *"Assets can be imported as strings using the `?raw` suffix."* — [Static Asset Handling](https://vite.dev/guide/assets.md)

The documentation describes `?raw` for assets generally and says nothing specific about CSS. The mechanism does: the `vite:css` transform's id filter is

```js
filter: { id: { include: CSS_LANGS_RE, exclude: [commonjsProxyRE, SPECIAL_QUERY_RE] } }
```

and `SPECIAL_QUERY_RE` is `/[?&](?:worker|sharedworker|raw|url)\b/`. **A `?raw` request never reaches the CSS pipeline at all.** No preprocessing, no `@import` inlining, no `url()` rebasing, no PostCSS, no minification — `./a.scss?raw` gives you Sass source text, not CSS.

### `?url` — a standalone, processed stylesheet asset

`?url` is also excluded from the transform, but CSS gets a dedicated `load` hook:

- **On a CSS module it throws**, with `?url is not supported with CSS modules. (tried to import …)`.
- **In dev**, the request is served by the assets plugin (the source says so in a comment).
- **In a build**, Vite re-imports the file under an internal `?transform-only` query so it is fully processed, marks it *"shouldn't be included in normal CSS chunks"*, emits it as its own `.css` asset, and replaces the import's value with that asset's final URL.

So `?url` gives you a real, processed, hashed, standalone stylesheet — deliberately excluded from the page's bundled CSS.

### The three, side by side

| | `import './a.css'` | `?inline` | `?raw` | `?url` |
|---|---|---|---|---|
| Preprocessor (Sass/Less) | ✅ | ✅ | ❌ | ✅ |
| `@import` inlining, `url()` rebasing | ✅ | ✅ | ❌ | ✅ |
| PostCSS / Lightning CSS | ✅ | ✅ | ❌ | ✅ |
| Minified in build | ✅ | ✅ | ❌ | ✅ |
| Applied to the page automatically | ✅ | ❌ | ❌ | ❌ |
| Import evaluates to | nothing useful | the CSS string | the file's source text | a URL string |
| In the bundled `.css` output | ✅ | ❌ | ❌ | ❌ (separate asset) |
| Works on `.module.css` | ✅ (map) | ✅ (returns **text**, not the map) | ✅ (source text) | ❌ **throws** |
| Self-accepting HMR | ✅ | ❌ | n/a | n/a |

## 2. Real-World Engineering Scenario

**A team ships a web component with a shadow root and needs its styles inside that root, where a document-level `<style>` cannot reach.** Their first attempt is `import css from './widget.css?raw'` because "raw sounds like the text of the file". It works locally with plain CSS, and breaks the week the file becomes `widget.scss`: the shadow root now contains Sass source. Their second attempt, `?inline`, is the correct one — same string shape, but it is the *output* of the pipeline, so nesting is compiled, `url()` references point at hashed build assets and autoprefixer has run. `?raw` is for showing a file to a human (a docs code sample, a theme editor); `?inline` is for feeding CSS to an API.

## 3. Production-Grade Code Example

```typescript
// widget.ts — CSS into a shadow root via a constructable stylesheet
import widgetCss from './widget.css?inline'; // processed, minified in build, NOT injected

const sheet = new CSSStyleSheet();
sheet.replaceSync(widgetCss);

export class WidgetElement extends HTMLElement {
  connectedCallback(): void {
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [sheet];
    root.innerHTML = `<div class="widget">…</div>`;
  }
}
customElements.define('x-widget', WidgetElement);
```

```typescript
// print.ts — a stylesheet loaded on demand, as a separate file
import printHref from './print.css?url'; // emitted as its own hashed .css asset

export function enablePrintStyles(): void {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.media = 'print';
  link.href = printHref;
  document.head.append(link);
}
```

```typescript
// ThemeSource.tsx — showing CSS to a human, so source text is what you want
import themeSource from './theme.css?raw'; // exactly the bytes on disk, unprocessed

export function ThemeSource() {
  return <pre><code className="language-css">{themeSource}</code></pre>;
}
```

## 4. Senior Engineer Edge Cases & Pitfalls

**`?inline` output is minified in production and not in dev.** The build branch runs `minifyCSS` on the inline string when `build.cssMinify` is truthy; the dev branch returns the processed text as-is. Any code that pattern-matches the string — a test asserting on whitespace, a parser looking for a specific selector formatting — will behave differently between the two.

**`?inline` breaks self-accepting HMR** for the stylesheet: the id carries `?inline`, so it is excluded from the self-accepting test and the update propagates to whoever imported the string. Correct, since the string has to be handed to your code again.

**A `?raw` CSS import is invisible to the CSS graph.** It is not tracked as a stylesheet, contributes nothing to the emitted CSS, and no `url()` inside it is turned into a build asset — so any relative path in that text is a path relative to nothing.

**`?url` on CSS is not documented.** [Static Asset Handling](https://vite.dev/guide/assets.md) documents `?url` for assets in general and does not describe its CSS behaviour; everything in this page about the `?transform-only` re-import and the standalone emit is read from `css.ts` at `v8.2.2` rather than from prose documentation. Treat the *mechanism* as version-specific even though the *behaviour* is stable.

**`?no-inline` is an asset suffix, not a CSS one.** It controls base64 inlining of binary assets and has nothing to do with `?inline` on a stylesheet, despite the names. See [Asset Handling](../06-asset-handling/01-static-asset-imports.md).

**Suffixes compose with the module system, not with each other.** There is no `?inline&raw`, and there is no query that returns both a CSS module's map and its text — import the file twice with different queries.

## Gotchas

**★ Symptom: `import styles from './a.css'` is `undefined`.** Cause: default and named imports from CSS files were removed in Vite 5. Fix: add the suffix that says what you want.

```javascript
import styles from './a.css?inline';   // the processed CSS text
```

**★ Symptom: shadow-DOM styles show Sass syntax, unprefixed properties, or a broken `url()`.** Cause: `?raw` returns the bytes on disk and bypasses the pipeline entirely — the transform filter excludes `SPECIAL_QUERY_RE`, which contains `raw`. Fix: use `?inline`, which is the same string shape but the pipeline's output.

```javascript
// ❌ unprocessed source
import css from './widget.scss?raw';
// ✅ compiled, rebased, minified in build
import css from './widget.scss?inline';
```

**★ Symptom: a `?url` import of a `.module.css` fails the build.** Cause: a deliberate guard — the class map cannot be delivered through a URL. Fix: drop `.module.` from the filename if you want a linkable stylesheet.

**★ Symptom: `?inline` CSS is missing from the emitted `.css` file, and someone files that as a bug.** Cause: intended. Inline requests are excluded from the extracted styles map, because injecting them would defeat the purpose of asking for a string. Fix: import the file a second time without the suffix if you want it applied *and* available as text.

**★ Symptom: a `?url` stylesheet is not in the page's bundled CSS and never loads.** Cause: also intended — the id is marked `?transform-only` and skipped when chunk CSS is assembled, because you asked for an address, not an application. Fix: create the `<link>` yourself, as in the example above.

**★ Symptom: a test asserting on the exact text of a `?inline` import passes in dev and fails in CI.** Cause: the production branch minifies the inline string. Fix: assert on a parsed form, or on a substring that survives minification.

**★ Symptom: `url('./icon.svg')` inside a `?raw` stylesheet 404s in production.** Cause: no rebasing and no asset emission happen for raw text; the SVG was never registered as a build input. Fix: `?inline`, or import the asset separately and interpolate its URL.

**★ Symptom: adding `?inline` to a stylesheet made HMR reload the page.** Cause: an `?inline` id is excluded from self-accepting HMR, so the update propagates to the importer. Fix: expected — accept it in the importing module if a reload is unacceptable.

## Interview questions

**★ What is the difference between `?inline` and `?raw` on a stylesheet, and which one belongs in a shadow root?**
`?inline` returns the **output** of the CSS pipeline: preprocessed, `@import`-inlined, `url()`-rebased, PostCSS-or-Lightning-processed, minified in a production build — just not injected into the page. `?raw` returns the **input**: the file's bytes, because the CSS transform explicitly excludes ids matching `SPECIAL_QUERY_RE`, which includes `raw`. A shadow root needs the output, so `?inline`. `?raw` is for showing source to a human.

**★ Why were default imports from CSS removed in Vite 5, and what replaced them?**
Because `import styles from './a.css'` was ambiguous: for `.module.css` it meant the class map, and for a plain stylesheet it meant the text — the same syntax with two unrelated meanings, and no way to ask for the text without also injecting the styles. Vite 5 removed the plain-CSS form and made the intent explicit with `?inline`. The documentation states the replacement in one line: *"Use the `?inline` query instead."*

**★ What does `?url` do to a stylesheet in a production build, and how is it different from just importing it?**
A plain import contributes the CSS to a bundled stylesheet that the page loads automatically. `?url` processes the file through the same pipeline, but emits it as its **own** hashed `.css` asset that is explicitly excluded from the normal CSS chunks, and evaluates to that asset's URL. You get a stylesheet nobody has applied — which is exactly what you want for a print or theme sheet you attach at runtime. It also throws on CSS modules, since a URL cannot carry a class map.

**★ Someone asks for both the class map and the text of the same CSS module. What do you tell them?**
That no single query returns both — `?inline` takes priority over the module semantics and returns the text, per an explicit branch in `css.ts` referencing the issues that prompted it. The supported answer is to import the file twice, once bare for the map and once with `?inline` for the text. Be honest about the cost: the query is part of the module id, so those are two distinct modules and the file is compiled twice.

---

← [Lightning CSS](01e-lightning-css.md) · [Vite overview](../../README.md) · Next → [Code Splitting & FOUC](01g-code-splitting-and-fouc.md)
