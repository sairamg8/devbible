---
title: "PostCSS is wired in by discovery, not by configuration — a config file anywhere in the workspace root silently becomes global, and an inline `css.postcss` silently switches discovery off"
sidebar_label: "PostCSS Config Discovery"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Features › CSS › PostCSS](https://vite.dev/guide/features.md), [Shared Options › `css.postcss`](https://vite.dev/config/shared-options.md), [Build Options › `build.cssTarget`](https://vite.dev/config/build-options.md) — plus `packages/vite/src/node/plugins/css.ts` at tag `v8.2.2` (`postcssPlugins` assembly, `PostcssUserConfig` re-export). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ PostCSS Config Discovery

**You never tell Vite to use PostCSS. Vite looks for a PostCSS config, and if it finds one it applies it to every piece of CSS in the project — imported stylesheets, `.module.css`, the CSS block of a Vue SFC, all of it.** There is no `plugins: [postcss()]` line to grep for and no per-directory scoping, which is exactly what makes this convenient in a small app and mystifying in a monorepo. `postcss` `^8.5.26` is a hard dependency of `vite@8.2.2`, so the machinery is always present; only the config is missing.

## 1. Under-The-Hood Mechanics

> *"If the project contains valid PostCSS config (any format supported by [postcss-load-config](https://github.com/postcss/postcss-load-config), e.g. `postcss.config.js`), it will be automatically applied to all imported CSS."*
> — [Features › CSS › PostCSS](https://vite.dev/guide/features.md)

> *"Note that CSS minification will run after PostCSS and will use the [`build.cssTarget`](https://vite.dev/config/build-options#build-csstarget) option."* — same page

Two facts to hold: **discovery is automatic and global**, and **PostCSS is not the last stage** — minification runs after it, with its own browser target.

### Where Vite looks, and where it refuses to look

`css.postcss` documents the search boundary, and this is the sentence people discover the hard way in a monorepo:

> *"The search is done using [postcss-load-config](https://github.com/postcss/postcss-load-config) and only the supported config file names are loaded. Config files outside the workspace root (or the [project root](https://vite.dev/guide/#index-html-and-project-root) if no workspace is found) are not searched by default. You can specify a custom path outside of the root to load the specific config file instead if needed."*
> — [Shared Options › `css.postcss`](https://vite.dev/config/shared-options.md)

So the search climbs to the **workspace** root, not to `/`, and stops. A config living beside a package but above the workspace boundary is not found — and nothing errors, because "no PostCSS config" is a legal state.

### The two shapes of `css.postcss`

> *"Inline PostCSS config or a custom directory to search PostCSS config from (default is project root)."*
> — [Shared Options › `css.postcss`](https://vite.dev/config/shared-options.md)

A **string** is a directory to search from — discovery still happens, just rooted elsewhere. An **object** is the config itself, and it turns discovery off:

> *"Note if an inline config is provided, Vite will not search for other PostCSS config sources."* — same page

> *"For inline PostCSS config, it expects the same format as `postcss.config.js`. But for `plugins` property, only [array format](https://github.com/postcss/postcss-load-config/blob/main/README.md#array) can be used."* — same page

That last constraint is real and easy to trip: the object-keyed form `plugins: { autoprefixer: {} }` that works in a `postcss.config.js` file is **not** accepted inline. Inline means an array of plugin instances.

### Where your plugins sit in the chain

Vite assembles the plugin array around yours (`css.ts`, `compilePostCSS`):

```
[ postcss-modules (only for *.module.*) ,
  postcss-import  (only when the file contains @import) ,
  ...your plugins, in config order... ,
  Vite's UrlRewritePostcssPlugin ]
```

Your plugins are bracketed. `postcss-import` and `postcss-modules` are `unshift`ed ahead of them; Vite's `url()`-rewriting plugin is `push`ed behind them, with a source comment explaining why it has to be last:

```js
// when a postcss plugin is used (including the internal postcss plugins),
// we need to add this plugin regardless of whether
// this file contains url() or image-set(),
// because we don't know the content injected by those plugins
```

That is the guarantee that matters: a URL your plugin *generates* is still rebased, because the rewriter runs after you.

### A typed config, in Vite 8

`vite@8.2.2` re-exports the `postcss-load-config` config type so a config file can be type-checked against the exact version Vite loads it with:

```ts
import type { PostcssUserConfig } from 'vite'

const config: PostcssUserConfig = { plugins: [] }
export default config
```

(That snippet is the JSDoc example on the re-export in `css.ts`.)

### It does not run at all under Lightning CSS

When `css.transformer` is `'lightningcss'`, `compileCSS()` dispatches to `compileLightningCSS()` instead of `compilePostCSS()`, and the plugin does not even warm the PostCSS config cache — the guard is literally `if (config.css.transformer !== 'lightningcss')`. Your `postcss.config.js` is not merged, not partially applied, and not warned about. See [Lightning CSS](01e-lightning-css.md).

## 2. Real-World Engineering Scenario

**A pnpm monorepo: `apps/web` and `packages/ui`, with `postcss.config.js` at the repo root.** `apps/web` builds with autoprefixer applied; a developer runs a Vite build with `root` set to `packages/ui` for a Storybook-style preview and the prefixes vanish — no error, no warning, just different output. The cause is the documented search boundary: the config is found relative to the workspace root that Vite detects, and the two invocations do not detect the same one. The fix is to stop relying on discovery for the shared case and name the config explicitly with `css.postcss`, which makes the dependency visible in the config file that every build reads.

## 3. Production-Grade Code Example

```javascript
// postcss.config.js — the discovered form. Object-keyed plugins are fine HERE.
export default {
  plugins: {
    autoprefixer: {},
    'postcss-preset-env': { stage: 1 },
  },
};
```

```typescript
// vite.config.ts — the explicit form: no discovery, array plugins only, monorepo-safe
import { defineConfig } from 'vite';
import autoprefixer from 'autoprefixer';
import postcssPresetEnv from 'postcss-preset-env';

export default defineConfig({
  css: {
    postcss: {
      // 🔴 inline config MUST use the array form; the object form is rejected
      plugins: [autoprefixer(), postcssPresetEnv({ stage: 1 })],
    },
  },
});
```

```typescript
// vite.config.ts — the middle road: keep the file, point at it deliberately
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  css: {
    // a STRING is a directory to search from — discovery still runs, rooted here
    postcss: fileURLToPath(new URL('../../', import.meta.url)),
  },
});
```

## 4. Senior Engineer Edge Cases & Pitfalls

**Discovery is a build-input you cannot see in `vite.config.ts`.** Two checkouts of the same repo can produce different CSS because one has a stray `postcss.config.cjs` in a parent directory that is inside the workspace root. If reproducibility matters more than convenience, set `css.postcss` explicitly and delete the file.

**Adding a config file changes performance for every CSS file.** The `compileCSS()` short-circuit that skips PostCSS entirely is disabled the moment a config resolves — see [the pipeline](01-styling-pipeline.md). This is the one config change that can slow a large project globally with no visible cause.

**PostCSS output is not the final output.** Minification runs afterwards with `build.cssTarget`, so a plugin that emits modern syntax can have that syntax lowered — or preserved — depending on a target you set somewhere else entirely. See [minification and targets](01h-minification-and-css-targets.md).

**`.pcss`, `.postcss` and `.sss` are recognised extensions.** They are in `CSS_LANGS_RE`, so they are treated as CSS regardless of whether a PostCSS config exists. `.sss` additionally needs the optional peer `sugarss` installed, because it is a parser, not just an extension.

**A PostCSS plugin that reads the file path sees Vite's id, not always a clean path.** Ids carry query strings (`?used`, `?inline`, `?direct`) and, for virtual modules, a `\0` prefix. A plugin doing `path.extname(from)` on a Vite id can mis-branch.

## Gotchas

**★ Symptom: autoprefixer stopped running the day someone added `css.postcss` to the config.** Cause: an inline object disables discovery entirely — *"if an inline config is provided, Vite will not search for other PostCSS config sources."* The `postcss.config.js` still on disk is now dead code. Fix: move every plugin into the inline array, or delete the inline object and keep the file.

**★ Symptom: `plugins: { autoprefixer: {} }` inside `css.postcss` throws or applies nothing.** Cause: the documented restriction — inline config supports *only* the array format for `plugins`. Fix:

```typescript
import autoprefixer from 'autoprefixer';
export default defineConfig({
  css: { postcss: { plugins: [autoprefixer()] } },
});
```

**★ Symptom: the PostCSS config works from the repo root and is ignored when building one package of a monorepo.** Cause: *"Config files outside the workspace root (or the project root if no workspace is found) are not searched by default."* Fix: point at it with the string form of `css.postcss`, which is the documented escape hatch.

```typescript
export default defineConfig({
  css: { postcss: fileURLToPath(new URL('../../', import.meta.url)) },
});
```

**★ Symptom: you switched `css.transformer` to `'lightningcss'` and every prefix, nesting transform and custom-media rule disappeared.** Cause: the PostCSS branch is not taken at all — the two engines are alternatives, not layers, and no warning is emitted about the orphaned config. Fix: either revert the transformer, or reimplement the pieces you need through `css.lightningcss` (`drafts`, `include`/`exclude`, `targets`) and accept that plugins with no Lightning CSS equivalent are gone.

**★ Symptom: a plugin that rewrites `url()` values works, but its output is not hashed or rebased.** Cause: it would be — Vite's rewriter is appended after your plugins precisely so it can see injected content. If it is not happening, your plugin most likely ran in a file where PostCSS was skipped entirely, or emitted the URL inside a value form the rewriter does not match. Fix: verify with a file that also contains a plain static `url()`; if that one is rewritten and yours is not, the shape of your generated value is the problem.

**★ Symptom: CSS is processed twice — once by your PostCSS plugin and once by a framework plugin.** Cause: PostCSS config applies to *all* imported CSS including framework-authored CSS pulled from `node_modules` via `@import`, and framework plugins may inject their own passes. Fix: constrain the plugin with its own file filters rather than expecting Vite to scope it; Vite offers no per-glob PostCSS scoping.

**★ Symptom: `postcss.config.js` throws `Cannot use import statement outside a module` (or the inverse) only in this repo.** Cause: the config file is loaded by `postcss-load-config`, which resolves module format from the nearest `package.json` `"type"` field, and a monorepo can have a different one at the package level than at the root. Fix: name the file for the format you want — `postcss.config.mjs` for ESM, `postcss.config.cjs` for CommonJS — instead of relying on `"type"`.

## Interview questions

**★ How does Vite decide to run PostCSS, and what is the blast radius of that decision?**
It does not decide — it discovers. `postcss-load-config` searches for a supported config file name from the project root upward, bounded by the workspace root, and if one resolves it is applied to *all* imported CSS. The blast radius is the whole project: every stylesheet, every `.module.css`, every SFC style block, and every third-party CSS file pulled in through `@import`. There is no per-directory or per-glob scoping in Vite; scoping has to be done inside the plugins themselves.

**★ What is the difference between passing a string and passing an object to `css.postcss`?**
A string is a **directory to search from** — discovery still runs, just rooted at a path you chose, which is the documented way to reach a config outside the workspace root. An object is the **config itself**, and providing it stops Vite searching for any other PostCSS config source. The object form additionally accepts only the array form of `plugins`, unlike a `postcss.config.js` file, which also accepts the object-keyed shorthand.

**★ Your PostCSS plugin injects `url('./icon.svg')` into a rule. Will Vite hash and rebase it?**
Yes, and by design. Vite appends its `UrlRewritePostcssPlugin` after your plugins rather than before, with a source comment stating that it must be added whenever any plugin is in play *"because we don't know the content injected by those plugins"*. So generated URLs go through the same asset resolution and rebasing as hand-written ones — provided the file went through PostCSS at all.

**★ Does switching to Lightning CSS mean your PostCSS plugins run through a compatibility layer?**
No. They do not run. `css.transformer` picks one engine for the whole of stage ②, and under `'lightningcss'` Vite does not even resolve the PostCSS config. There is no adapter, no partial application and no warning — which is why switching transformers is an audit of every plugin you depend on, not a one-line performance tweak.

---

← [@import Inlining & URL Rebasing](01a-import-inlining-and-url-rebasing.md) · [Vite overview](../../README.md) · Next → [Preprocessors](01c-preprocessors.md)
