---
title: "CSS minification is a second, independent pipeline with its own engine and its own browser target — `build.cssTarget` silently inherits `build.target`, overrides `css.lightningcss.targets`, and decides how much of your modern CSS survives"
sidebar_label: "Minification & CSS Targets"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Build Options › `build.cssMinify`](https://vite.dev/config/build-options.md), [`build.cssTarget`](https://vite.dev/config/build-options.md), [`build.target`](https://vite.dev/config/build-options.md), [`build.minify`](https://vite.dev/config/build-options.md), [Migration from v7 › CSS Minification by Lightning CSS / Default Browser Target Change](https://vite.dev/guide/migration.md), [Features › PostCSS](https://vite.dev/guide/features.md) — plus `packages/vite/src/node/plugins/css.ts` at tag `v8.2.2` (`minifyCSS`, `convertTargets`). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ CSS Minification and `cssTarget`

**Minification is not a compression step bolted on at the end; in Vite 8 it is a full CSS transform that lowers syntax to a browser target.** That target is `build.cssTarget`, it defaults to `build.target`, and `build.target` now means Baseline Widely Available as of a date frozen per major release. Two consequences people meet the hard way: raising `build.target` to `esnext` turns CSS syntax lowering **off**, and `css.lightningcss` options apply at minification time even in a project that never set `css.transformer`.

## 1. Under-The-Hood Mechanics

### The three options and their defaults

> *"**Type:** `boolean | 'lightningcss' | 'esbuild'` · **Default:** `'lightningcss'`, but `false` if [`build.minify`](https://vite.dev/config/build-options#build-minify) is disabled for client build"*
> — [`build.cssMinify`](https://vite.dev/config/build-options.md)

> *"This option allows users to override CSS minification specifically instead of defaulting to `build.minify`, so you can configure minification for JS and CSS separately. Vite uses [Lightning CSS](https://lightningcss.dev/minification.html) by default to minify CSS. It can be configured using [`css.lightningcss`](https://vite.dev/config/shared-options#css-lightningcss). Set the option to `'esbuild'` to use esbuild instead. esbuild must be installed when it is set to `'esbuild'`."*
> — same page

> *"**Default:** the same as [`build.target`](https://vite.dev/config/build-options#build-target). This option allows users to set a different browser target for CSS minification from the one used for JavaScript transpilation. When `build.cssMinify` is `'lightningcss'` (the default), this option takes precedence over [`css.lightningcss.targets`](https://vite.dev/config/shared-options#css-lightningcss) for the minification step."*
> — [`build.cssTarget`](https://vite.dev/config/build-options.md)

> *"It should only be used when you are targeting a non-mainstream browser. One example is Android WeChat WebView, which supports most modern JavaScript features but not the [`#RGBA` hexadecimal color notation in CSS](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#rgb_colors). In this case, you need to set `build.cssTarget` to `chrome61` to prevent vite from transforming `rgba()` colors into `#RGBA` hexadecimal notations."*
> — same page

And the target everything inherits from:

> *"**Default:** `'baseline-widely-available'`, which targets the minimum browser versions compatible with Baseline Widely Available as of a date fixed for each major release (2026-01-01 for this major). Specifically, it is `['chrome111', 'edge111', 'firefox114', 'safari16.4', 'ios16.4']`."*
> — [`build.target`](https://vite.dev/config/build-options.md), condensed from the documented paragraph

The Vite 8 migration guide records the move: Chrome 107 → 111, Edge 107 → 111, Firefox 104 → 114, Safari 16.0 → 16.4.

### Ordering

> *"Note that CSS minification will run after PostCSS and will use the [`build.cssTarget`](https://vite.dev/config/build-options#build-csstarget) option."*
> — [Features › PostCSS](https://vite.dev/guide/features.md)

Minification is downstream of everything. A PostCSS or Lightning CSS transform that produces modern syntax can still have that syntax rewritten afterwards, against a target set somewhere else in the config.

### `css.lightningcss` leaks into minification

`minifyCSS()` builds the Lightning CSS call like this:

```js
transform({
  ...config.css.lightningcss,                     // ← your options, even under transformer: 'postcss'
  targets: convertTargets(config.build.cssTarget), // ← always wins, per the docs
  filename,
  code: Buffer.from(css),
  minify: true,
  cssModules: undefined,   // the transforms belong to compileLightningCSS
  visitor: undefined,
  customAtRules: undefined,
})
```

So `css.lightningcss.drafts`, `include`/`exclude` and `nonStandard` are read at minification time in **every** Vite 8 build, whatever `css.transformer` says — while `cssModules`, `visitor` and `customAtRules` are explicitly stripped, because those belong to the transform stage.

### How `cssTarget` is converted, and the `esnext` trapdoor

`convertTargets()` maps an esbuild-style target string onto Lightning CSS's `targets` object. Two behaviours matter:

```js
if (entry === 'esnext') continue
// …
// an empty object means "no browser supports anything" to lightningcss
const result = Object.keys(targets).length > 0 ? targets : undefined
```

- **`esnext` is skipped**, and a target list that produces no entries yields `undefined` — i.e. **no lowering at all**, minification only.
- Runtime-only targets (`node`, `hermes`, `rhino`) are mapped to "no mapping available" and skipped for the same reason.
- `esXXXX` targets are expanded through a table (`es2022 → chrome94, edge94, safari16.4, ios16.4, firefox93, opera80`), so an ES-year target *does* produce browser versions and *does* lower CSS.
- An unrecognised token throws `Unsupported target "<entry>"`.

That is the whole `esnext` trapdoor: setting `build.target: 'esnext'` for a modern-browsers-only app silently disables CSS syntax lowering as well, because `cssTarget` inherits it.

## 2. Real-World Engineering Scenario

**A team ships to an in-app WebView on Android and reports that colours render as black after upgrading to Vite 8.** The build never set `cssTarget`, so it inherited `build.target: 'baseline-widely-available'` — Chrome 111 and friends — and Lightning CSS, now the default minifier, compressed `rgba(14, 165, 233, 0.5)` into the four/eight-digit hex form that target permits. The WebView does not implement `#RGBA`. This is the exact case the documentation calls out, and the fix is a one-line, CSS-only target: `build.cssTarget: 'chrome61'`, leaving `build.target` where it is so JavaScript is not needlessly downlevelled. The wrong fixes are lowering `build.target` (which bloats the JS bundle) and switching to `cssMinify: 'esbuild'` (which now requires installing a package the project no longer has).

## 3. Production-Grade Code Example

```typescript
// vite.config.ts — separate targets for JS and CSS, which is the point of cssTarget
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'baseline-widely-available', // JS: the Vite 8 default, stated explicitly
    cssTarget: 'chrome61',               // CSS: prevent #RGBA lowering for a legacy WebView
    cssMinify: 'lightningcss',           // the Vite 8 default, stated explicitly
  },
});
```

```typescript
// vite.config.ts — unminified JS for a debug build, but keep CSS minified
export default defineConfig({
  build: {
    minify: false,             // ⚠️ this alone would set cssMinify to false as well
    cssMinify: 'lightningcss', // …so say it explicitly
  },
});
```

```typescript
// vite.config.ts — opting back into esbuild, with the install it now requires
// npm add -D esbuild
export default defineConfig({
  build: {
    cssMinify: 'esbuild',
  },
});
```

```typescript
// vite.config.ts — Lightning CSS options that apply even on the default PostCSS transformer,
// because minifyCSS() spreads css.lightningcss into the minify call
export default defineConfig({
  css: {
    lightningcss: {
      // stripping IE-era hacks the minifier would otherwise refuse to parse
      errorRecovery: true,
    },
  },
});
```

## 4. Senior Engineer Edge Cases & Pitfalls

**`cssTarget` overrides `css.lightningcss.targets` for minification only.** The documentation says so, and the code confirms it — `targets` is assigned after the spread. If you set `css.lightningcss.targets` for the *transform* stage and expect it to govern minification too, it does not.

**Minification can fail a build that used to pass.** Lightning CSS refuses to parse IE-era hacks, and the failure now occurs on the default path, not only for people who opted into the transformer. Vite appends its own hint when it recognises a star-property hack or the `@media (min-width: 0\0)` hack.

**`build.minify: 'esbuild'` is deprecated** (*"is deprecated and will be removed in the future"*), while `build.cssMinify: 'esbuild'` is not marked deprecated. They are separate options with separate lifecycles; do not assume one deprecation covers both.

**`build.minify` defaults to `'oxc'` for the client build and `false` for the SSR build.** Since `cssMinify` falls back to `false` when `build.minify` is disabled *for the client build*, an SSR-only config change does not silently turn CSS minification off.

**A duplicated browser at two versions now throws.** The Vite 8 migration guide lists, under Advanced, that *"passing identical browsers with multiple versions to `build.target` now throws errors"*. A generated target list assembled from a browserslist query can hit this.

**Minified output ends with a newline — except when inlined.** `minifyCSS` appends `'\n'` for emitted assets and omits it for `?inline` strings, deliberately. Tests that compare inline CSS strings byte-for-byte need to know that.

## Gotchas

**★ Symptom: `rgba()` colours became `#RRGGBBAA` and an old WebView renders them wrong.** Cause: Lightning CSS lowered them against the inherited `build.target`. Fix: the documented one-liner, which touches CSS only.

```typescript
export default defineConfig({ build: { cssTarget: 'chrome61' } });
```

**★ Symptom: you set `build.target: 'esnext'` and CSS nesting / modern colour syntax is no longer lowered.** Cause: `cssTarget` inherits it, and `convertTargets()` skips `esnext`, producing `undefined` targets — minification with no lowering. Fix: if you want modern JS but lowered CSS, split the two.

```typescript
export default defineConfig({
  build: { target: 'esnext', cssTarget: 'chrome111' },
});
```

**★ Symptom: `build.minify: false` for a debug build also produced unminified CSS.** Cause: documented default coupling. Fix: set `cssMinify` explicitly alongside it (example above).

**★ Symptom: the build throws `Unsupported target "…"`.** Cause: `convertTargets()` only understands esbuild-style browser tokens and `esXXXX` years; anything else — a browserslist string, a bare `"last 2 versions"` — is rejected. Fix: pass browser tokens, and convert a browserslist query yourself if that is your source of truth.

```typescript
// browserslist → esbuild-style tokens is NOT automatic; be explicit
export default defineConfig({ build: { cssTarget: ['chrome111', 'safari16.4'] } });
```

**★ Symptom: `cssMinify: 'esbuild'` fails with a missing-module error.** Cause: esbuild is an optional peer in Vite 8 and is not installed. Fix: `npm add -D esbuild` — or reconsider, since Lightning CSS is the maintained default.

**★ Symptom: a `[lightningcss minify]` error mentioning `*zoom` or `min-width: 0\0` breaks the production build after upgrading to Vite 8.** Cause: the default minifier changed and it will not parse IE hacks. Fix: delete the hacks, or use the escape hatch Vite's own error message names.

```typescript
export default defineConfig({ css: { lightningcss: { errorRecovery: true } } });
```

**★ Symptom: your CSS bundle got slightly larger after the Vite 8 upgrade, with no source change.** Cause: documented — *"Lightning CSS supports better syntax lowering and your CSS bundle size might increase slightly."* Fix: nothing, unless you can raise `cssTarget`; the extra bytes are compatibility you are now actually getting.

**★ Symptom: `css.lightningcss.visitor` or `customAtRules` appear to be ignored on a default build.** Cause: the minify call explicitly sets `cssModules`, `visitor` and `customAtRules` to `undefined`, because those belong to the transform stage — which, on a default build, is PostCSS. Fix: they only take effect with `css.transformer: 'lightningcss'`.

## Interview questions

**★ What is `build.cssTarget` for, and why does it exist separately from `build.target`?**
Because JavaScript support and CSS support are not the same axis in real browsers. The documented example is Android WeChat WebView: modern JavaScript, but no `#RGBA` hex colour notation. With one shared target you would have to downlevel the entire JS bundle to protect one CSS feature. `cssTarget` lets the CSS minifier lower to `chrome61` while JavaScript stays at the modern default. The documentation is explicit that this is a narrow tool — *"It should only be used when you are targeting a non-mainstream browser."*

**★ Setting `build.target: 'esnext'` — what does it do to your CSS?**
It turns syntax lowering off. `cssTarget` defaults to `build.target`, and Vite's converter skips the `esnext` token entirely; when nothing remains, it passes `undefined` targets to Lightning CSS, which then minifies without lowering. Usually that is what an `esnext` project wants, but it is a side effect of a JavaScript option and it is invisible — nested CSS, `color-mix()` and logical properties ship as written. If you want them lowered, set `cssTarget` explicitly.

**★ In a project that never sets `css.transformer`, do `css.lightningcss` options do anything?**
Yes — at minification time. `minifyCSS()` spreads `config.css.lightningcss` into the Lightning CSS transform call before overriding `targets` from `build.cssTarget`, so `drafts`, `include`/`exclude`, `nonStandard` and `errorRecovery` all apply. What does **not** apply is `cssModules`, `visitor` and `customAtRules`, which the minify call explicitly blanks because they belong to the transform stage. This is the cleanest way to explain why the two Lightning CSS roles are separate: one option object, two consumers, different subsets.

**★ Why did the Vite 8 upgrade make some CSS bundles bigger?**
Because minification changed engines and Lightning CSS does more syntax lowering than the previous default. The migration guide states both halves — Lightning CSS is now the default, and *"your CSS bundle size might increase slightly"*. The bytes buy compatibility with the browsers named by `cssTarget`. If you know your users are newer than the baseline, raising `cssTarget` recovers the size; reverting to esbuild recovers it too, but requires installing esbuild and gives up the maintained path.

**★ How would you debug "my CSS is minified differently in two environments"?**
Establish which of the three inputs differ, in this order: `build.cssMinify` (which engine ran at all), `build.cssTarget` — remembering it inherits `build.target`, so a mode-specific or environment-specific `target` silently moves it — and `css.lightningcss`, which is spread into the minify call and can therefore differ per config branch. Because the target is inherited rather than defaulted to a constant, the most common answer is that someone changed `build.target` in one environment and never realised CSS was downstream of it.

---

← [Code Splitting & FOUC](01g-code-splitting-and-fouc.md) · [Vite overview](../../README.md) · Next → [SSR Support](../10-ssr-support/01-server-side-rendering-primitives.md)
