---
title: "Vite 8's CSS pipeline is a fixed chain of stages — preprocessor, then PostCSS *or* Lightning CSS, then hoisting, then Lightning CSS minification — and every CSS bug you will file is a bug about which stage owns the rule"
sidebar_label: "Styling Pipeline"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Features › CSS](https://vite.dev/guide/features.md), [Shared Options › `css`](https://vite.dev/config/shared-options.md), [Build Options](https://vite.dev/config/build-options.md), [Migration from v7](https://vite.dev/guide/migration.md) — plus the `vite@8.2.2` npm manifest and `packages/vite/src/node/plugins/css.ts` at tag `v8.2.2`. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ The Vite 8 CSS Pipeline

**Vite does not "have a CSS loader". It has an ordered chain, and every stage in it is replaceable independently of the others.** A file is recognised as CSS by extension, run through a preprocessor if its extension demands one, handed to **either** PostCSS **or** Lightning CSS (never both — `css.transformer` picks one), normalised (`@import` and `@charset` hoisted to the top of the chunk), and finally minified — by Lightning CSS, by default, *regardless of which transformer processed it*. That last split is the single most misread thing about CSS in Vite 8: **the default processor is PostCSS and the default minifier is Lightning CSS**, and they are two different options.

## 1. Under-The-Hood Mechanics

### What counts as CSS

Recognition is by extension, from one regex in `packages/vite/src/node/constants.ts` at `v8.2.2`:

```js
export const CSS_LANGS_RE: RegExp =
  /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/
```

Nine extensions. `.pcss` and `.postcss` are plain CSS routed through PostCSS; `.sss` is SugarSS, a PostCSS *dialect* rather than a preprocessor. Anything not in that list is an asset, not a stylesheet — see [Asset Handling](../06-asset-handling/01-static-asset-imports.md).

### The stage chain

Read `compileCSS()` in `packages/vite/src/node/plugins/css.ts` and the order is unambiguous:

```
  .scss/.less/.styl  ──►  ① preprocessor (sass-embedded | sass | less | stylus)
                              │  optional peer dep; not installed = hard error
                              ▼
  any CSS text       ──►  ② EITHER  PostCSS   (default: postcss-import → your
                              │              postcss.config.js plugins → postcss-modules)
                              │     OR      Lightning CSS  (css.transformer: 'lightningcss')
                              ▼
                       ──►  ③ finalizeCss(): hoist @import and @charset to the top
                              ▼
                       ──►  ④ minify — Lightning CSS by default (build.cssMinify)
                              ▼
              dev: injected as a <style> tag   build: emitted as a .css asset
```

Stage ② is exclusive. `css.transformer` selects the engine; PostCSS and Lightning CSS do not compose. Stage ① runs **before** the branch, so Sass and Less keep working under Lightning CSS. Stage ④ is a separate option with a separate default, which is why a project that never touched `css.transformer` is still being minified by Lightning CSS in Vite 8.

### Vite 8 changed the floor under this

> *"Vite 8 uses [Rolldown](https://rolldown.rs/) and [Oxc](https://oxc.rs/) based tools instead of [esbuild](https://esbuild.github.io/) and [Rollup](https://rollupjs.org/)."* — [Migration from v7](https://vite.dev/guide/migration.md)

> *"[Lightning CSS](https://lightningcss.dev/) is now used for CSS minification by default. You can use the [`build.cssMinify: 'esbuild'`](https://vite.dev/config/build-options#build-cssminify) option to switch back to esbuild. Note that you need to install `esbuild` as a `devDependency`. Lightning CSS supports better syntax lowering and your CSS bundle size might increase slightly."* — [Migration from v7](https://vite.dev/guide/migration.md)

The `vite@8.2.2` manifest makes the consequence concrete. Hard `dependencies`: `postcss` `^8.5.26`, `lightningcss` `^1.33.0`, `rolldown` `~1.2.4`, `picomatch`, `tinyglobby`. **Every one of `esbuild`, `sass`, `sass-embedded`, `less`, `stylus`, `sugarss` and `terser` is an optional peer dependency.** So:

- PostCSS and Lightning CSS are **both already installed** the moment you install Vite. Neither needs adding.
- **esbuild is not installed.** `build.cssMinify: 'esbuild'` is now an opt-in that requires `npm add -D esbuild` first.
- Any page, blog post or config comment describing Vite's CSS minifier as esbuild, or the bundler behind CSS code splitting as Rollup, is describing Vite ≤ 7.

⚠️ One inconsistency worth knowing: the JSDoc on `CSSOptions.transformer` in `css.ts` still reads *"It requires to install it as a peer dependency."* The 8.2.2 manifest lists `lightningcss` under `dependencies`, not peers. Trust the manifest; the comment is stale.

### The short-circuit that makes "PostCSS is slow" untrue for most files

PostCSS is not run on every file. From `compileCSS()`:

```js
// postcss processing is not needed
if (lang !== 'sss' && !postcssConfig && !isModule && !needInlineImport && !hasUrl) {
  return
}
```

A plain `.css` file with no `@import`, no `url()`, no `.module.` in its name, in a project with no PostCSS config, is passed through untouched. Adding `postcss.config.js` to the root flips that for **every** CSS file in the project at once.

### Dev output and build output are different artefacts

In dev, the CSS module you import is rewritten to JavaScript that calls the client runtime — `__vite__updateStyle(__vite__id, __vite__css)` — so styles arrive as a `<style>` element and are swapped in place on edit:

> *"Importing `.css` files will inject its content to the page via a `<style>` tag with HMR support."* — [Features › CSS](https://vite.dev/guide/features.md)

In build, the CSS is collected out of the JS graph and emitted as `.css` assets referenced by `<link>` tags. **Nothing about the dev artefact survives to production**, which is why "it works in dev" is worth nothing as evidence about a CSS ordering or FOUC problem.

## 2. Real-World Engineering Scenario

**A team upgrades a Vite 6 app to Vite 8 and the CSS bundle grows by a few percent while an old Android WebView starts rendering wrong colours.** Nothing in their config changed. What changed is stage ④: esbuild's CSS minifier is gone and Lightning CSS is the default, and Lightning CSS does real syntax lowering against `build.cssTarget` (which defaults to `build.target`, itself now `'baseline-widely-available'` — Chrome 111 / Edge 111 / Firefox 114 / Safari 16.4 / iOS 16.4). Bigger output is documented and expected (*"your CSS bundle size might increase slightly"*). The WebView breakage is the documented `#RGBA` case and is fixed by lowering `build.cssTarget`, not by reverting the minifier. The wrong reflex — `cssMinify: 'esbuild'` — additionally requires installing a package the team no longer has.

## 3. Production-Grade Code Example

Every CSS-related option, annotated with the stage it belongs to:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  css: {
    // ── stage ② : which engine processes CSS. Exclusive choice. Experimental.
    transformer: 'postcss',        // default; 'lightningcss' swaps the whole stage

    // ── stage ② (PostCSS branch only) : CSS Modules behaviour
    modules: { localsConvention: 'camelCaseOnly' },

    // ── stage ② (PostCSS branch only) : inline config INSTEAD of postcss.config.js
    // postcss: { plugins: [] },

    // ── stage ① : options handed to sass / less / stylus
    preprocessorOptions: {
      scss: { additionalData: `@use "@/styles/vars" as *;` },
    },
    preprocessorMaxWorkers: true,  // default: CPUs - 1

    // ── stage ② (Lightning CSS branch only)
    // lightningcss: { drafts: { customMedia: true } },

    // ── dev only. Does not affect the production build.
    devSourcemap: true,
  },
  build: {
    // ── stage ④ : the minifier, independent of css.transformer
    cssMinify: 'lightningcss',     // default in Vite 8; 'esbuild' needs esbuild installed
    cssTarget: 'chrome111',        // defaults to build.target
    cssCodeSplit: true,            // default; false = one stylesheet for the whole app
  },
});
```

🔴 **`css.transformer` and `build.cssMinify` are not the same switch and do not have the same default.** Leaving `transformer` alone still gets you Lightning CSS at minification time. Setting `transformer: 'lightningcss'` does *not* imply anything about minification — `cssMinify` is still consulted separately.

## 4. Senior Engineer Edge Cases & Pitfalls

**`@import` and `@charset` are hoisted, not preserved in place.** `finalizeCss()` rewrites the chunk so that surviving `@import` rules move to the top in original order, and only the **first** `@charset` is kept and moved to the very top; later ones are deleted. Both are spec requirements for concatenated stylesheets. If you were relying on an `@charset` in the middle of a file, it is gone from the output.

**`css.transformer` and `css.devSourcemap` are both flagged experimental in the documentation.** They are not deprecated and not unstable in practice, but they carry a "Give Feedback" discussion link, which in Vite's convention means the option shape may change in a minor. Pin your Vite version if you build tooling on them.

**A CSS-only entry still produces a JS chunk in the graph before Vite removes it.** Vite tracks "pure CSS chunks" and strips them from the bundle after rendering — covered in [code splitting](01g-code-splitting-and-fouc.md).

**Node 20.19 is the floor.** The manifest declares `"engines": { "node": "^20.19.0 || >=22.12.0" }`. Node 20.18 and Node 22.11 are not merely untested; they are excluded by the range, and CI images that pin `node:20` without a minor can drift below it.

## Gotchas

**★ Symptom: you upgraded to Vite 8, changed nothing, and `build.cssMinify: 'esbuild'` now fails the build.** Cause: esbuild is no longer a dependency of Vite — it is an optional peer, so nothing installed it for you. The documentation is explicit: *"esbuild must be installed when it is set to `'esbuild'`."* Fix: install it, or (better) delete the override and accept the new default.

```bash
npm add -D esbuild     # only if you genuinely need esbuild's CSS minifier back
```

**★ Symptom: a config comment or a tutorial says "Vite minifies CSS with esbuild", and your output disagrees.** Cause: true up to Vite 7, false from Vite 8. Fix: read the default off the option, not off memory — `build.cssMinify` is documented as *"**Default:** `'lightningcss'`, but `false` if `build.minify` is disabled for client build"*.

**★ Symptom: setting `build.minify: false` silently disabled CSS minification too.** Cause: that is the documented default coupling — `cssMinify` falls back to `false` when `build.minify` is disabled for the client build. Fix: set it back explicitly if you wanted unminified JS with minified CSS.

```javascript
export default defineConfig({
  build: { minify: false, cssMinify: 'lightningcss' },
});
```

**★ Symptom: a `.sss` file is ignored or throws.** Cause: `.sss` is SugarSS, and `sugarss` is an optional peer dependency that is not installed by default. Fix: `npm add -D sugarss`. Note it is a PostCSS *syntax*, so it is handled by stage ②, not stage ①.

**★ Symptom: adding `postcss.config.js` for one directory slowed the whole build.** Cause: there is no per-directory scoping. A resolvable PostCSS config disables the "postcss processing is not needed" short-circuit for **every** imported CSS file in the project. Fix: scope the work inside the config with per-plugin `include`/`exclude` options, or use `css.postcss` to point at a config deliberately rather than letting one be discovered.

**★ Symptom: CSS behaves correctly in `vite dev` and wrongly in `vite preview`.** Cause: the two produce different artefacts — a JS-injected `<style>` in dev, an emitted `.css` asset with a `<link>` in build, with hoisting and minification applied only to the latter. Fix: debug CSS ordering, `@charset`, `@import` and FOUC questions against `vite build && vite preview` only; a dev-server reproduction is not evidence.

**★ Symptom: `vite build` fails on a CI image that works locally, with a Node syntax or engine error.** Cause: `vite@8.2.2` declares `"node": "^20.19.0 || >=22.12.0"`. Fix: pin the CI image to a minor that satisfies the range.

```yaml
# .github/workflows/build.yml
- uses: actions/setup-node@v4
  with:
    node-version: '22.12'
```

## Interview questions

**★ In Vite 8, which tool processes your CSS and which tool minifies it — and are they the same tool?**
No, and this is the trap. The *processor* is chosen by `css.transformer`, which defaults to `'postcss'`. The *minifier* is chosen by `build.cssMinify`, which defaults to `'lightningcss'`. A default Vite 8 project therefore runs its CSS through PostCSS (with `postcss-import`, your `postcss.config.js` plugins and `postcss-modules`) and then minifies the result with Lightning CSS. Both packages are hard dependencies of `vite@8.2.2`, so both are present with no install. Setting one option tells you nothing about the other.

**★ Vite 8 replaced esbuild and Rollup. What does that actually change for CSS?**
Two concrete things. Minification moved from esbuild to Lightning CSS, and esbuild is no longer installed, so `cssMinify: 'esbuild'` became an opt-in that needs `npm add -D esbuild`. And the bundler that performs CSS code splitting and chunk assignment is Rolldown, configured through `build.rolldownOptions` (`build.rollupOptions` still works as a deprecated alias). What did *not* change is the CSS pipeline's shape: PostCSS is still the default transformer, preprocessors are still optional peer dependencies, and `.module.css` still means CSS Modules.

**★ Why does a plain stylesheet with no `@import` and no `url()` skip PostCSS entirely, and when does that stop being true?**
Because running PostCSS is measurable work with no possible effect on such a file. `compileCSS()` returns early when the file is not SugarSS, not a CSS module, has no `@import`, has no `url()` or `image-set()`, and no PostCSS config resolved. It stops being true the instant any one of those is false — most commonly the moment someone adds `postcss.config.js` (or a Tailwind/autoprefixer setup) at the project root, which switches PostCSS on for every CSS file in the project.

**★ Where in the chain do Sass and Less run, and does choosing Lightning CSS turn them off?**
They run first, at stage ①, before the transformer branch. `compileCSS()` invokes the preprocessor on the source text, and only then chooses between `compileLightningCSS()` and `compilePostCSS()`. So `css.transformer: 'lightningcss'` still compiles `.scss` and `.less` normally. What it does turn off is the PostCSS half of stage ② — your `postcss.config.js` plugins and `css.modules`.

**★ Why is "it looks right in the dev server" not an acceptable answer to a CSS ordering bug?**
Because dev and build emit different artefacts. In dev, each CSS module becomes a small JS module that pushes its text into a `<style>` element at execution time, in module-evaluation order, with HMR swapping it in place. In build, the CSS is extracted, concatenated per chunk, `@import`/`@charset`-hoisted, minified and served as a `<link>`ed asset whose ordering follows chunk graph and load order. Cascade-order bugs, FOUC and `@charset` problems can only exist in one of those two worlds, and it is not the one with the dev server.

---

← [Plugin API & Conventions](../08-plugin-system/01-plugin-api.md) · [Vite overview](../../README.md) · Next → [@import Inlining & URL Rebasing](01a-import-inlining-and-url-rebasing.md)
