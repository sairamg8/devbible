---
title: "Sass, Less and Stylus are optional peer dependencies Vite resolves at first use — it prefers `sass-embedded`, falls back to `sass` when the native binary is missing, and names the package you did not install in the error"
sidebar_label: "Preprocessors"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Features › CSS Pre-processors](https://vite.dev/guide/features.md), [Shared Options › `css.preprocessorOptions`](https://vite.dev/config/shared-options.md), [Shared Options › `css.preprocessorMaxWorkers`](https://vite.dev/config/shared-options.md), [Performance › Use Lesser or Native Tooling](https://vite.dev/guide/performance.md) — plus the `vite@8.2.2` npm manifest (`peerDependenciesMeta`) and `packages/vite/src/node/plugins/css.ts` at tag `v8.2.2` (`loadPreprocessorPath`, `loadSassPackage`). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ CSS Preprocessors

**Vite ships no preprocessor and no preprocessor plugin. It ships the wiring, and resolves the compiler from your `node_modules` the first time a matching file is imported.** `sass`, `sass-embedded`, `less`, `stylus` and `sugarss` are all declared in `vite@8.2.2` as **optional** peer dependencies, so nothing is installed for you and nothing complains at install time. The failure surfaces at the first `.scss` import, and the message names a package — sometimes not the one you meant to use.

## 1. Under-The-Hood Mechanics

> *"That said, Vite does provide built-in support for `.scss`, `.sass`, `.less`, `.styl` and `.stylus` files. There is no need to install Vite-specific plugins for them, but the corresponding pre-processor itself must be installed."*
> — [Features › CSS Pre-processors](https://vite.dev/guide/features.md)

```bash
# .scss and .sass
npm add -D sass-embedded # or sass

# .less
npm add -D less

# .styl and .stylus
npm add -D stylus
```

(That block is quoted verbatim from the documentation, including its ordering: `sass-embedded` first.)

> *"If using Vue single file components, this also automatically enables `<style lang="sass">` et al."* — same page

> *"You can also use CSS modules combined with pre-processors by prepending `.module` to the file extension, for example `style.module.scss`."* — same page

### Resolution happens at first use, from two roots

`loadPreprocessorPath()` resolves the package **from the project root first, then from Vite's own installation path**, caches the result, and otherwise throws a message built like this:

```
Preprocessor dependency "<lang>" not found. Did you install it? Try `<pm> install -D <lang>`.
```

The two-root search is what makes a hoisted monorepo install work; the cache is why the failure is instant on every subsequent import rather than re-resolving.

### Sass specifically: `sass-embedded` preferred, `sass` as fallback

> *"Uses `sass-embedded` if installed, otherwise uses `sass`. For the best performance, it's recommended to install the `sass-embedded` package."*
> — [Shared Options › `css.preprocessorOptions`](https://vite.dev/config/shared-options.md)

`loadSassPackage()` tries `sass-embedded` and falls back to `sass`; if **both** are missing it rethrows the *first* error — the one naming `sass-embedded`. There is a second, subtler fallback: `sass-embedded` ships a native binary in a per-platform package, and if importing it fails with an error mentioning `sass-embedded-<platform>-<arch>`, Vite sets an internal `failedSassEmbedded` flag and re-resolves to plain `sass` for the rest of the process. That recovery only exists if `sass` is also installed.

The Sass options type in `v8.2.2` is `SassPreprocessorOptions = { additionalData } & SassModernPreprocessBaseOptions` — the **modern** Sass JS API only. There is no legacy-API switch to set.

### `preprocessorOptions` is keyed by extension

> *"Specify options to pass to CSS pre-processors. The file extensions are used as keys for the options."* — [Shared Options](https://vite.dev/config/shared-options.md)

The documented per-language surface:

| Key | Options accepted |
|---|---|
| `scss` / `sass` | Sass [`StringOptions`](https://sass-lang.com/documentation/js-api/interfaces/stringoptions/) — `importers`, `loadPaths`, `silenceDeprecations`, … |
| `less` | Less [options](https://lesscss.org/usage/#less-options) — e.g. `math: 'parens-division'` |
| `styl` / `stylus` | *"Only [`define`](https://stylus-lang.com/docs/js.html#define-name-node) is supported, which can be passed as an object."* |

Stylus really is that narrow: one option.

### `additionalData`, and the two warnings attached to it

> *"This option can be used to inject extra code for each style content. Note that if you include actual styles and not just variables, those styles will be duplicated in the final bundle."*
> — [Shared Options › `additionalData`](https://vite.dev/config/shared-options.md)

> *"Since the same code is prepended to files in different directories, relative paths won't resolve correctly. Use absolute paths or [aliases](https://vite.dev/config/shared-options#resolve-alias) instead."* — same page

Both warnings come from the same mechanism: the string is prepended to **every** file of that language, so it must be idempotent (declarations only) and location-independent (no relative imports).

### Workers

> *"Specifies the maximum number of threads CSS preprocessors can use. `true` means up to the number of CPUs minus 1."* — [`css.preprocessorMaxWorkers`](https://vite.dev/config/shared-options.md), **Default: `true`**

> *"When set to `0`, Vite will not create any workers and will run the preprocessors in the main thread. Depending on the preprocessor options, Vite may run the preprocessors on the main thread even if this option is not set to `0`."* — same page

That second sentence is the one to remember: worker execution is best-effort. Options that cannot cross a worker boundary — a JS `importer` function, a Stylus `define` holding a live object — force main-thread compilation, and the option silently has no effect.

### Vite's own advice is to use fewer of them

> *"Use CSS instead of Sass/Less/Stylus when possible (nesting can be handled by PostCSS / Lightning CSS)"* — [Performance](https://vite.dev/guide/performance.md)

> *"Because Vite targets modern browsers only, it is recommended to use native CSS variables with PostCSS plugins that implement CSSWG drafts (e.g. [postcss-nesting](https://github.com/csstools/postcss-plugins/tree/main/plugins/postcss-nesting)) and author plain, future-standards-compliant CSS."*
> — [Features › CSS Pre-processors](https://vite.dev/guide/features.md)

## 2. Real-World Engineering Scenario

**A team's local builds are fast; the Docker build fails at the first `.scss` file with a preprocessor error naming a package that *is* in `package.json`.** The image is Alpine on arm64, and `sass-embedded`'s per-platform native package did not install for that platform/arch combination. Vite's recovery path exists — it detects the `sass-embedded-<platform>-<arch>` error shape and re-resolves to `sass` — but the repo only ever installed `sass-embedded`, so there is nothing to fall back to. The robust fix is to install **both**: `sass-embedded` for speed where the binary works, `sass` as the guaranteed pure-JS floor.

## 3. Production-Grade Code Example

```jsonc
// package.json — preprocessors are BUILD-time tools: devDependencies, never dependencies
{
  "devDependencies": {
    "sass-embedded": "^1.70.0",
    "sass": "^1.70.0",
    "vite": "8.2.2"
  }
}
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // ✅ declarations and @use of a variables-only file — safe to prepend everywhere
        // ✅ an ALIAS, not a relative path: this string lands in files in every directory
        additionalData: `@use "@/styles/vars" as *;`,
      },
      less: {
        math: 'parens-division',
        // Less variables injected globally rather than imported per file
        globalVars: { brandColor: '#0ea5e9' },
      },
      styl: {
        // the ONLY documented Stylus option
        define: { $brandColor: '#0ea5e9' },
      },
    },
    preprocessorMaxWorkers: true, // default: CPUs - 1
  },
});
```

```scss
// src/styles/vars.scss — variables and mixins ONLY. No rules, no @font-face, no keyframes.
$space-1: 4px;
$space-2: 8px;
@mixin card { border-radius: 8px; padding: $space-2; }
```

## 4. Senior Engineer Edge Cases & Pitfalls

**`additionalData` containing real rules multiplies your bundle.** The documentation states it outright. One `@font-face` block in that string, in a project with sixty `.scss` files, is sixty copies before deduplication — and CSS deduplication is not something Vite promises.

**A JS `importer` in `preprocessorOptions.scss` can disable the worker pool.** Functions do not survive the structured clone to a worker, so Vite compiles on the main thread — documented as *"Vite may run the preprocessors on the main thread even if this option is not set to `0`"*. If preprocessor time jumps after adding a custom importer, that is why.

**Preprocessors run before the transformer branch.** Choosing `css.transformer: 'lightningcss'` does not disable Sass or Less; stage ① is upstream of stage ②. See [the pipeline](01-styling-pipeline.md).

**`.module.scss` is both.** The `.module.` test is a substring match on the id, so `style.module.scss` is preprocessed *and* treated as a CSS module. See [CSS Modules](01d-css-modules.md).

**Sass deprecation warnings are the compiler's, not Vite's.** They arrive from `sass`/`sass-embedded` and are silenced with Sass's own `silenceDeprecations` option passed through `preprocessorOptions.scss`, not with anything Vite owns.

## Gotchas

**★ Symptom: `Preprocessor dependency "sass-embedded" not found` — but you never asked for `sass-embedded`.** Cause: `loadSassPackage()` tries `sass-embedded` first and, when neither package resolves, rethrows the first error. The message names the package Vite *preferred*, not the one you intended. Fix: install either one; installing both gives you the fast path plus a fallback.

```bash
npm add -D sass-embedded sass
```

**★ Symptom: `.scss` compiles locally and fails in a container on a different CPU architecture.** Cause: `sass-embedded` resolves a native per-platform package that may not have installed for that platform/arch. Vite detects that specific error shape and retries with `sass` — which must be installed for the retry to succeed. Fix: install `sass` alongside `sass-embedded`, and do not `--omit=optional` in the image build.

**★ Symptom: an SCSS partial's styles appear dozens of times in the production stylesheet.** Cause: `additionalData` prepends its string to every file of that language, and the documentation warns *"those styles will be duplicated in the final bundle"*. Fix: keep the injected string to variables, mixins and `@use` of a declarations-free file.

```typescript
// ❌ duplicated into every compiled file
additionalData: `@import "@/styles/base.scss";`   // base.scss contains real rules
// ✅ variables and mixins only
additionalData: `@use "@/styles/vars" as *;`
```

**★ Symptom: `additionalData: '@import "./vars.scss";'` resolves for files in one directory and fails in another.** Cause: the identical string is prepended to files in different directories, so a relative path cannot be correct for all of them — documented verbatim. Fix: use an alias or an absolute path.

**★ Symptom: a Stylus option other than `define` appears to be ignored.** Cause: it is. *"Only `define` is supported."* Fix: configure it inside the Stylus files themselves, or move off Stylus — it is also the one language with no alias resolution and no `url()` rebasing.

**★ Symptom: `sass` is in `dependencies`, and it ships to production installs.** Cause: preprocessors are build-time only; nothing at runtime imports them. Fix:

```bash
npm uninstall sass && npm add -D sass
```

**★ Symptom: build memory spikes on a CI runner with many cores.** Cause: `preprocessorMaxWorkers` defaults to `true`, i.e. CPUs minus one, and each worker carries a compiler instance. Fix: cap it, or set `0` to stay on the main thread.

```typescript
export default defineConfig({ css: { preprocessorMaxWorkers: 2 } });
```

**★ Symptom: `.sss` files are not compiled and Vite complains about a missing dependency.** Cause: SugarSS is a PostCSS *syntax* and its package `sugarss` is an optional peer, resolved through the same `loadPreprocessorPath()` machinery. Fix: `npm add -D sugarss`. Note it is not a preprocessor and takes no `preprocessorOptions` entry.

**★ Symptom: switching from `sass` to `sass-embedded` changes error output or breaks a custom importer.** Cause: they are two implementations of the same modern API; `sass-embedded` runs the compiler out of process, so anything relying on shared JS state inside an importer behaves differently. Fix: keep importers pure and path-based; if that is impossible, pin to `sass` and accept the speed cost.

## Interview questions

**★ Why does Vite make Sass an optional peer dependency instead of bundling it?**
Because most projects do not use it, and a preprocessor is a large dependency with a native component. Declaring it as an optional peer means the package manager installs nothing, warns about nothing, and the cost is paid only by projects that opt in. The trade is that the failure moves from install time to first-import time, which is why the error message is written as an instruction (*"Did you install it? Try …"*) rather than a stack trace.

**★ Vite prefers `sass-embedded` over `sass`. What is the difference, and what breaks?**
`sass-embedded` runs the Dart Sass compiler as a separate process with a native binary per platform, which is the faster of the two and is what the documentation recommends. Plain `sass` is the pure-JS build: slower, but with no native artefact to fail to install. The breakage is architectural — a platform with no matching prebuilt binary. Vite recognises that specific failure and falls back to `sass`, so the resilient setup installs both.

**★ What are the two documented failure modes of `additionalData`, and what do they have in common?**
Duplicated styles, and unresolvable relative paths. Both follow from the fact that the string is prepended to every file of that language: anything with an output effect is emitted once per file, and any path is interpreted relative to whichever file it landed in. The rule that satisfies both is that the injected code must be inert (variables, mixins, `@use` of a declarations-free file) and location-independent (aliases or absolute paths).

**★ Vite's own performance guide tells you to use less Sass. What is the reasoning?**
That the language features people reach for a preprocessor for — nesting, variables, colour functions — are now either native CSS or available through PostCSS/Lightning CSS passes that are far cheaper than a full Dart Sass compile. The guide phrases it as reducing the amount of work per source file: native CSS custom properties survive to runtime and can be changed by theme without a rebuild, and nesting can be handled by `postcss-nesting` or Lightning CSS. The honest counter-argument is `@use`-based module organisation and mixins, which native CSS still does not replace.

**★ You set `preprocessorMaxWorkers: 4` and see no change in build time. What would you check first?**
Whether the preprocessor is running on the main thread anyway. The documentation says explicitly that *"depending on the preprocessor options, Vite may run the preprocessors on the main thread even if this option is not set to `0`"* — in practice, options that cannot be cloned into a worker, such as a JS `importer` or a Stylus `define` carrying live objects. Removing or replacing that option is what unlocks the workers; raising the count does nothing.

---

← [PostCSS Config Discovery](01b-postcss-config-discovery.md) · [Vite overview](../../README.md) · Next → [CSS Modules](01d-css-modules.md)
