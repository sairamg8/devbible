---
title: "`@import` is inlined at build time and every `url()` is rewritten relative to the output file — which is why CSS that moves between directories keeps working, and why one Stylus caveat breaks that promise"
sidebar_label: "@import Inlining & URL Rebasing"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Features › CSS › `@import` Inlining and Rebasing](https://vite.dev/guide/features.md), [Features › CSS Pre-processors](https://vite.dev/guide/features.md), [Shared Options › `css.transformer`](https://vite.dev/config/shared-options.md), [Building for Production › Public Base Path](https://vite.dev/guide/build.md) — plus `packages/vite/src/node/plugins/css.ts` at tag `v8.2.2`. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ `@import` Inlining and `url()` Rebasing

**A browser's `@import` is a runtime request; Vite's `@import` is a build-time concatenation. Vite resolves the specifier the way it resolves a JS import — aliases, bare package names, `public/` files — inlines the file's text, and then rewrites every `url()` inside it so the reference still points at the right asset from wherever the merged stylesheet ends up.** Both halves matter: without inlining you would ship a request waterfall, and without rebasing every relative `url()` in an imported partial would break the moment its text landed in a file in a different directory.

## 1. Under-The-Hood Mechanics

The documentation states the contract in three sentences:

> *"Vite is pre-configured to support CSS `@import` inlining via [`postcss-import`](https://github.com/postcss/postcss-import). Vite aliases are also respected for CSS `@import`. In addition, all CSS `url()` references, even if the imported files are in different directories, are always automatically rebased to ensure correctness."*
> — [Features › CSS](https://vite.dev/guide/features.md)

> *"`@import` aliases and URL rebasing are also supported for Sass and Less files (see [CSS Pre-processors](https://vite.dev/guide/features#css-pre-processors))."* — same page

Three separate mechanisms hide behind that:

| Mechanism | Who does it | Scope |
|---|---|---|
| `@import` inlining | `postcss-import`, unshifted to the **front** of the PostCSS plugin chain | `.css`, `.pcss`, `.sss` |
| `@import` alias/bare-specifier resolution | Vite's own resolver, injected into `postcss-import` as its `resolve` hook | CSS, Sass, Less |
| `url()` rebasing | Vite's `cssUrlRE` / `cssImageSetRE` rewrite pass | CSS always; Sass/Less with caveats; **not Stylus** |

### The resolver is Vite's, not PostCSS's

`postcss-import` is handed a `resolve` callback that (in order) checks whether the specifier names a file in `publicDir`, then runs Vite's CSS `@import` resolver — the one that knows about `resolve.alias`, `resolve.extensions` and node resolution. That is why all of these work in a stylesheet:

```css
/* src/styles/app.css */
@import '@/styles/reset.css';        /* resolve.alias */
@import 'normalize.css';             /* a bare package specifier from node_modules */
@import './tokens.css';              /* ordinary relative path */
@import '/brand.css';                /* a file sitting in public/ */
```

If the specifier is relative and cannot be resolved, Vite warns rather than silently dropping it — the source notes that `postcss-import` would otherwise fall back to a `resolve` dependency Vite has shimmed away to keep its bundle small.

### Rebasing, and what "rebased" means

Rebasing rewrites the `url()` argument so it resolves from the **importing** file's location, then again against the final output location and `base`. The build guide is explicit that this applies at the `base` level too:

> *"JS-imported asset URLs, CSS `url()` references, and asset references in your `.html` files are all automatically adjusted to respect this option during build."* — [Building for Production](https://vite.dev/guide/build.md)

`image-set()` is covered by the same pass, not just `url()`.

### Preprocessor caveats, quoted exactly

> *"Vite improves `@import` resolving for Sass and Less so that Vite aliases are also respected. In addition, relative `url()` references inside imported Sass/Less files that are in different directories from the root file are also automatically rebased to ensure correctness. **Rebasing `url()` references that start with a variable or an interpolation is not supported due to its API constraints.**"*
> — [Features › CSS Pre-processors](https://vite.dev/guide/features.md)

> *"`@import` alias and url rebasing are not supported for Stylus due to its API constraints."* — same page

So the guarantee degrades in two documented steps: full for CSS, "except variables and interpolation" for Sass and Less, and **absent for Stylus**. A Stylus codebase that relies on aliases in `@import` is relying on something Vite does not claim to do.

### Hoisting, at the end of the chain

After processing, `finalizeCss()` hoists what survives:

```js
// #1845
// CSS @import can only appear at top of the file. We need to hoist all @import
// to top when multiple files are concatenated.
```

Surviving `@import` rules — the ones that were **not** inlined, typically remote URLs like a font stylesheet — are moved to the top of the chunk in their original relative order, because that is where the CSS spec requires them. Rules written above them in your source stay where they are; the `@import` jumps over them. `@charset` gets the same treatment, but only the first one survives.

### Duplicates behave differently from a browser

> *"Note that postcss (postcss-import) has a different behavior with duplicated `@import` from browsers. See [postcss/postcss-import#462](https://github.com/postcss/postcss-import/issues/462)."*
> — [Shared Options › `css.transformer`](https://vite.dev/config/shared-options.md)

That note sits on the `css.transformer` option because the two engines differ here: the PostCSS path deduplicates, the browser (and Lightning CSS's own bundler) does not necessarily. If your cascade depends on a file being imported twice at two different points, you are depending on the difference.

## 2. Real-World Engineering Scenario

**A design-system package ships `dist/tokens.css` containing `background: url('./assets/grid.svg')`. An app imports it with `@import 'design-system/tokens.css'` from `src/styles/app.css`.** No relative path in the app can reach `node_modules/design-system/dist/assets/grid.svg`, and after inlining the text physically lives in a file under `dist/assets/` with a hashed name. It still works, because rebasing rewrote the `url()` at the moment the text was inlined — the reference is resolved against `tokens.css`'s own directory, the SVG is emitted as a build asset, and the final URL is written against `base`. Move the same setup to Stylus with an aliased import and the two mechanisms you were relying on are both documented as unsupported.

## 3. Production-Grade Code Example

```css
/* src/styles/app.css — the entry stylesheet */
@charset "utf-8";

/* Remote: NOT inlined. Stays an @import and is hoisted to the top of the chunk. */
@import url('https://fonts.googleapis.com/css2?family=Inter&display=swap');

/* Local: inlined by postcss-import; url() inside is rebased for this file's output. */
@import '@/styles/tokens.css';
@import 'normalize.css';

.hero {
  /* rebased against the OUTPUT file, and prefixed with `base` */
  background-image: url('../images/hero.png');
  /* image-set() goes through the same pass */
  background-image: image-set(url('../images/hero.avif') type('image/avif'));
}
```

```typescript
// vite.config.ts — the alias that makes '@/styles/...' resolve in CSS as well as JS
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: '/app/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
```

## 4. Senior Engineer Edge Cases & Pitfalls

**A `public/` file referenced from CSS is not hashed and not tracked.** The `@import` resolver checks `publicDir` first, and `url()` references to public paths are rewritten to the public URL rather than turned into build assets. That means no content hash, no cache-busting, and no build error if the file is deleted. Use `public/` for CSS assets only when you want exactly that.

**`@import` inlining is not `@use`.** In Sass, `@use` and `@forward` are handled by Sass itself at stage ①, long before `postcss-import` sees anything. The Vite-specific alias and rebasing behaviour described here applies to Sass's own `@import`/`@use` resolution through the injected importer — not to `postcss-import`, which never sees `.scss` text.

**Rebasing runs on the text as it exists after the preprocessor.** If a Sass function generates a `url()` from a variable, the rewriter cannot see a static path and the documentation says so plainly. Anything of the form `url($iconPath + '/x.svg')` is out of scope.

**Lightning CSS bundles `@import` itself.** Under `css.transformer: 'lightningcss'` the PostCSS chain — including `postcss-import` — is not used at all; Lightning CSS resolves and bundles imports through Vite's resolver via its own `analyzeDependencies` integration. The observable behaviour around duplicates and ordering can differ. See [Lightning CSS](01e-lightning-css.md).

**Editing an `@import`ed partial hot-updates the importer, not the partial.** Vite records the imported files as dependencies in the module graph specifically so that *"edits to @import css can trigger main import to hot update"*. The partial is not a module the page ever loaded; only the file that inlined it is.

## Gotchas

**★ Symptom: `@import '@/styles/x.css'` fails in a `.styl` file but works in `.css` and `.scss`.** Cause: documented — *"`@import` alias and url rebasing are not supported for Stylus due to its API constraints."* Fix: use a real relative path in Stylus, or move the shared partial import out of Stylus.

```stylus
// ❌ alias is not resolved for Stylus
@import '@/styles/tokens.styl'
// ✅ relative path
@import '../styles/tokens.styl'
```

**★ Symptom: a background image resolves in dev and 404s in production under a non-root `base`.** Cause: almost always a `url()` Vite could not rewrite — a runtime-built string, a Sass variable, or a path inside a template literal. Fix: make the reference a static `url()` so the rebasing pass can see it, or import the asset in JS and set the value as a custom property.

```javascript
import gridUrl from './assets/grid.svg';
document.documentElement.style.setProperty('--grid', `url(${gridUrl})`);
```

**★ Symptom: a rule you wrote above `@import` stops applying after the build.** Cause: `finalizeCss()` hoists `@import` to the top of the concatenated chunk per spec, so declarations that were above it in source end up **after** the imported stylesheet, and the imported rules now win ties. Fix: do not write rules above `@import`; keep imports at the top of the file where they will end up anyway.

**★ Symptom: two `@charset` rules, and one silently disappears.** Cause: only the first `@charset` is kept and moved to the top; the rest are removed. Fix: nothing to fix — but do not treat `@charset` as a per-partial concern, because only one can survive concatenation.

**★ Symptom: importing the same partial from two files produces one copy under PostCSS and two under Lightning CSS.** Cause: the documented divergence in duplicate-`@import` handling between `postcss-import` and browsers. Fix: never rely on duplicate imports for cascade ordering; put the override in the file that needs it.

**★ Symptom: `@import 'some-package/theme.css'` throws "Failed to resolve" only in CI.** Cause: the specifier resolves through Vite's node resolution, which is case-sensitive on Linux and not on macOS. Fix: match the on-disk casing exactly; add the package to `optimizeDeps.exclude` only if it also ships JS you must not pre-bundle.

**★ Symptom: a remote `@import url(...)` is still a separate request in production.** Cause: correct and intended — `postcss-import` inlines local files, not remote ones. Fix: if you want the font CSS bundled, download it into the repo; if you want it fast, replace the `@import` with a `<link rel="preconnect">` plus `<link rel="stylesheet">` in `index.html`, since an `@import` chained inside CSS is discovered late by the browser.

## Interview questions

**★ Why does Vite inline `@import` at build time instead of leaving it for the browser?**
Because a browser discovers a CSS `@import` only after it has downloaded and started parsing the importing stylesheet, so each level of nesting adds a serial round trip on the critical rendering path — and CSS blocks rendering. Inlining collapses the whole tree into one file that is discovered from the HTML. The cost is that build-time inlining and runtime importing are not perfectly equivalent: deduplication differs, and non-local imports cannot be inlined at all.

**★ What exactly does "rebasing" rewrite, and why can it fail for Sass?**
It rewrites the argument of `url()` and `image-set()` so the reference remains correct after the file's text has been moved into a stylesheet in a different directory, then again so it respects `base` and the hashed output name. It works by pattern-matching static URLs in the CSS text. For Sass and Less the documentation supports it for relative references in imported files, and states the exception verbatim: references *"that start with a variable or an interpolation"* are not rebased, because at the point the rewriter runs there is no literal path to rewrite.

**★ A stylesheet imports a partial that lives in `node_modules`. How does Vite know where it is, and what does PostCSS have to do with it?**
`postcss-import` performs the inlining, but it does not do the resolving — Vite passes it a custom `resolve` hook that first checks `publicDir` and then delegates to Vite's own CSS `@import` resolver. That resolver applies `resolve.alias` and node resolution, which is why bare package specifiers and aliases work in CSS at all. PostCSS supplies the mechanism; Vite supplies the module resolution semantics.

**★ Your team wants a shared `theme.css` imported by twenty component stylesheets. What is the cost?**
Under the PostCSS path the duplicate imports are deduplicated, so you pay for the text roughly once — but you are now depending on documented behaviour that differs both from browsers and potentially from Lightning CSS, and any cascade ordering that relies on the twentieth import being "last" is fragile. The predictable pattern is to import the theme exactly once from the entry stylesheet and let the cascade flow from there, keeping component files free of shared imports.

---

← [Styling Pipeline](01-styling-pipeline.md) · [Vite overview](../../README.md) · Next → [PostCSS Config Discovery](01b-postcss-config-discovery.md)
