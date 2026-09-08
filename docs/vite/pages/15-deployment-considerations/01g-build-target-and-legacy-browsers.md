---
title: "build.target's Baseline Widely Available default is a browser-support commitment your team makes without writing it down, and @vitejs/plugin-legacy is the only way to ship past it"
sidebar_label: "01g · build.target & legacy browsers"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vite documentation — [Building for Production](https://vite.dev/guide/build), [Build Options](https://vite.dev/config/build-options), [Migration from v7](https://vite.dev/guide/migration), the [`@vitejs/plugin-legacy` README](https://github.com/vitejs/vite/blob/main/packages/plugin-legacy/README.md). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+ · @vitejs/plugin-legacy 8.2.3**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

**`build.target` is not a performance knob — it is the line between "renders" and "blank page" for whoever visits your site on a browser you didn't test.** Vite 8 moved that line without anyone touching a config file: the special value `'baseline-widely-available'` re-resolves to newer browser versions on every major release, and the resolution for v8 is four browsers newer than v7's. This chunk is about what that default actually commits you to when you deploy, and about `@vitejs/plugin-legacy`, the tool that lets you ship a modern build and still support browsers below the line — because the mechanism it uses changes what's literally inside the artifact you serve. The transpilation cost of `build.target` — Oxc's lowering, the `cssTarget` split, minifier interaction — is covered in depth in **11 · Optimization and performance** at [`01h-sourcemaps-target-and-minifiers.md`](../11-optimization-and-performance/01h-sourcemaps-target-and-minifiers.md); this chunk does not repeat that mechanism, only the deployment consequence.

## The default, quoted, and what moved between v7 and v8

> *"By default, the production bundle targets the minimum browser versions compatible with [Baseline](https://web-platform-dx.github.io/baseline/) Widely Available as of a date fixed for each major release."* — [Building for Production](https://vite.dev/guide/build)

> *"The default value is a Vite special value, `'baseline-widely-available'`, which targets the minimum browser versions compatible with Baseline Widely Available as of a date fixed for each major release. Specifically, it is `['chrome111', 'edge111', 'firefox114', 'safari16.4', 'ios16.4']`."* — [Build Options](https://vite.dev/config/build-options)

The migration guide names exactly what changed:

> *"The default browser values of `build.target` and `'baseline-widely-available'` are updated to newer browser versions: Chrome 107 → 111, Edge 107 → 111, Firefox 104 → 114, Safari 16.0 → 16.4."* — [Migration from v7](https://vite.dev/guide/migration)

> *"These browser versions align with [Baseline Widely Available](https://web-platform-dx.github.io/baseline/) feature sets as of 2026-01-01."*

Read that last sentence as a deployment fact, not a technical footnote: **"Baseline Widely Available" is a rolling definition anchored to a date**, and the date advances with every Vite major. A project that pinned nothing and simply upgraded from Vite 7 to Vite 8 shipped a bundle that assumes four browser versions it did not assume the week before — with no line changed in `vite.config.ts`, no warning, and no build failure. The failure, if there is one, appears on a visitor's device as a syntax error or a missing API, weeks or months after the upgrade shipped.

## Why this is a deployment decision, not a build-engine one

`build.target` answers one question that has nothing to do with Vite internals: **which browsers, running your marketing site or your internal tool today, can execute the JavaScript you are about to serve them?** That question has an answer specific to your product — a consumer storefront with organic traffic from ten-year-old Android devices in markets with slow upgrade cycles has a different floor than an internal admin panel used only by employees on managed, auto-updating Chrome. `'baseline-widely-available'` is Vite's guess at a reasonable floor for "a typical web project," and a guess that moves is fine for a project with no stated support commitment and a liability for one that has made a promise — contractually, in a support matrix, or just informally to a QA team that tests against a fixed device list.

**The deployment-side move is to stop trusting the moving name and pin explicit versions**, the moment you have any actual commitment:

```typescript
// vite.config.ts — the v8 default, written out so an upgrade can no longer move it
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: ['chrome111', 'edge111', 'firefox114', 'safari16.4', 'ios16.4'],
  },
});
```

This is not a lower bar than the default — it is the *same* bar, made immune to the next major release silently raising it. If your actual audience needs older browsers than that, `build.target` alone cannot get you there: lowering it changes what syntax Oxc emits, but plenty of runtime APIs (not just syntax) simply do not exist on an old engine no matter how conservatively you transpile. That gap is what `@vitejs/plugin-legacy` fills.

## `@vitejs/plugin-legacy` — shipping past the target, and what it puts in `dist/`

> *"This plugin provides support for legacy browsers that do not support those features when building for production."* — [`@vitejs/plugin-legacy` README](https://github.com/vitejs/vite/blob/main/packages/plugin-legacy/README.md)

The mechanism is a **second, parallel build of every chunk**, and this is the part that matters for what you ship:

> *"Generate a corresponding legacy chunk for every chunk in the final bundle, transformed with [@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env) and emitted as [SystemJS modules](https://github.com/systemjs/systemjs)."*

> *"Generate a polyfill chunk including SystemJS runtime, and any necessary polyfills determined by specified browser targets."*

> *"Inject `<script nomodule>` tags into generated HTML to conditionally load the polyfills and legacy bundle only in browsers without widely-available features support."*

So `dist/` after this plugin runs contains **your entire bundle twice** — once as native ESM for `build.target`, and once again as Babel-transformed SystemJS modules plus a polyfill chunk — and the emitted `index.html` carries a `nomodule`/`module` split so a modern browser fetches only the first copy and an old one fetches only the second. That is the deployment fact worth stating plainly: **legacy support roughly doubles the JavaScript your build produces**, every one of those extra files needs the same immutable, content-hashed cache headers as the modern set (the same `Cache-Control: public, max-age=31536000, immutable` pattern — **the shape of `dist/`** is Agent A's territory, *not written yet*), and none of it is downloaded by the majority of your traffic, because the whole point of the `nomodule` trick is that a modern browser never requests the legacy chunk at all.

```javascript
// vite.config.js — the documented minimal configuration
import legacy from '@vitejs/plugin-legacy'

export default {
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11'],
    }),
  ],
}
```

The `targets` option is Babel's, not Vite's:

> *"passed on to [@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env#targets) when rendering **legacy chunks**"* — default `'last 2 versions and not dead, > 0.3%, Firefox ESR'`, a [Browserslist](https://browsersl.ist/) query.

This is a genuinely separate configuration surface from `build.target`: `build.target` decides how far the **modern** bundle is lowered by Oxc; `plugin-legacy`'s `targets` decides how far the **legacy** bundle is lowered by Babel and which polyfills the polyfill chunk includes. Setting one and not the other is a common source of confusion — raising `build.target` to `'esnext'` for a snappier modern bundle does nothing to the legacy bundle's floor, and lowering `plugin-legacy`'s `targets` to cover an ancient browser does nothing to what the modern bundle assumes.

## Gotchas

**★ Symptom: the app breaks on an older browser after upgrading to Vite 8, with no config change on your side.** Cause: `build.target` defaults to `'baseline-widely-available'`, and the resolution moved forward across the major — Chrome 107→111, Edge 107→111, Firefox 104→114, Safari 16.0→16.4. Fix: pin explicit versions the moment you have any real support commitment, so the next major cannot move your floor for you.
```typescript
build: { target: ['chrome111', 'edge111', 'firefox114', 'safari16.4', 'ios16.4'] },
```

**★ Symptom: `@vitejs/plugin-legacy` is added, and total transferred bytes for the deploy roughly double, even though nobody using a modern browser downloads the legacy files.** Cause: the plugin emits a full second copy of every chunk — *"a corresponding legacy chunk for every chunk in the final bundle"* plus a SystemJS polyfill chunk — and the `nomodule`/`module` split means only old browsers ever fetch the second copy, but it still has to be built, hosted, and cache-controlled like the first. Fix: nothing to fix — this is the cost of supporting the browsers that need it. What you should not do is apply the plugin globally on a project where the actual audience data shows near-zero traffic on unsupported browsers; check analytics before paying the build-time and storage cost.

**★ Symptom: raising `build.target` to `'esnext'` for a faster build had no effect on legacy-browser support, and lowering `plugin-legacy`'s `targets` had no effect on the modern bundle's size.** Cause: these are two independent configuration surfaces — Oxc transpiles the modern bundle against `build.target`; Babel, inside the plugin, transpiles the legacy bundle against its own `targets` option. Fix: treat them as two separate decisions. Raise `build.target` when you want a leaner modern bundle for the browsers you already support; adjust `plugin-legacy`'s `targets` when you want to change which *additional* browsers get a legacy chunk at all.

**★ Symptom: a browser-support table in a contract or a QA test matrix disagrees with what the app actually runs on, and nobody can say why.** Cause: `build.target` was left at its default, so the actual floor is whatever `'baseline-widely-available'` resolves to for the Vite major currently installed — a value that is not written down anywhere in the repository and that changes on every major upgrade. Fix: whenever there is a real, external support commitment, write the versions into `build.target` explicitly. The written table and the config should be the same document, not two things that happen to agree today.

## Interview questions

**★ Why is `'baseline-widely-available'` a risky default for a team that has made a browser-support promise, even though it is a perfectly sensible default in general?**
Because the name is bound to an external, dated definition that Vite re-resolves on every major release rather than to a fixed set of versions. Between Vite 7 and 8 that resolution moved four browsers forward — Chrome and Edge from 107 to 111, Firefox from 104 to 114, Safari from 16.0 to 16.4 — with no config edit on any project's part and no build error. Code that previously got lowered for the older floor no longer is, and the failure surfaces on a user's actual device rather than in CI. The default is good for a project that just wants "recent browsers, whatever that means today"; it is the wrong choice for a project that has told a customer or a QA process which specific browsers it supports, because the commitment and the enforced floor can silently drift apart. The fix is one line: write the versions explicitly.

**★ What does `@vitejs/plugin-legacy` actually add to `dist/`, and why does that matter for hosting?**
A second, parallel build of the entire bundle. Every chunk gets transformed by Babel and re-emitted as a SystemJS module, and a separate polyfill chunk is generated containing the SystemJS runtime and whatever polyfills the configured legacy `targets` require. The emitted HTML injects `<script nomodule>` tags so only browsers that don't support native ES modules ever request the legacy set — a modern browser loads only the first copy. For hosting, this means your build artifact is meaningfully larger (roughly double the JavaScript, though only the modern half is normally downloaded), every legacy file needs the same immutable, hashed cache-control treatment as the modern set, and the decision to add the plugin at all should be backed by actual traffic data showing you have visitors on browsers below `build.target`'s floor — otherwise you are building, storing and cache-warming an artifact nobody fetches.

**★ Is `build.target` and `@vitejs/plugin-legacy`'s `targets` the same configuration, just read by two different tools?**
No, and treating them as the same is a common mistake. `build.target` controls how far Oxc lowers the syntax of the single modern build Vite always produces — it never adds a second bundle. `plugin-legacy`'s `targets` is a Browserslist query handed to Babel, and it controls an entirely separate, additional legacy build that only exists when the plugin is installed. Raising `build.target` makes the modern bundle assume more; it does nothing to whether a legacy bundle exists or what it contains. Lowering `plugin-legacy`'s `targets` widens which old browsers get a legacy chunk; it has no effect on the modern bundle Oxc produces. A project can legitimately set `build.target: 'esnext'` for the fastest possible modern bundle while separately configuring `plugin-legacy` to support browsers far below that — the two numbers answer different questions and are read by different transpilers.

---

← [01f · Caching strategy](01f-caching-strategy-and-library-mode-deployment.md) · [Vite overview](../../README.md) · Next → [01h · Env baking & runtime config](01h-env-baking-and-runtime-config.md)
