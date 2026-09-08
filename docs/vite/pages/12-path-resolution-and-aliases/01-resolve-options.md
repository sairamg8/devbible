---
title: "resolve.alias is a plain string substitution that runs before Vite's resolver ever sees the specifier, which is exactly why an unresolved relative path, a shadowed short prefix, or __dirname in an ESM config all fail silently"
sidebar_label: "01 · resolve.alias fundamentals"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vite documentation — [Shared Options](https://vite.dev/config/shared-options), [Configuring Vite](https://vite.dev/config/), [Migration from v7](https://vite.dev/guide/migration), [Static Asset Handling](https://vite.dev/guide/assets), and Node.js — [`import.meta.dirname`](https://nodejs.org/api/esm.html#importmetadirname). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ resolve.alias fundamentals

**`resolve.alias` is not resolution — it is text substitution that happens one step before resolution.** Vite (via a Rolldown-level layer modelled on `@rollup/plugin-alias`) rewrites a matching import specifier into a replacement string, and only *then* hands that string to the real resolver. Every alias bug in this section is a consequence of that ordering: a replacement value that looks like a path but isn't resolved as one, an alias that shadows a longer alias because it happens to match first, or a config file that cannot even compute the path it wants to substitute because it is loaded as native ESM and `__dirname` does not exist there.

## What resolve.alias actually does

> *"Defines aliases used to replace values in `import` or `require` statements. This works similar to [`@rollup/plugin-alias`](https://github.com/rollup/plugins/tree/master/packages/alias). The order of the entries is important, in that the first defined rules are applied first."* — [Shared Options](https://vite.dev/config/shared-options)

Two syntaxes are supported. The object form:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
    },
  },
});
```

and the array form, which is required the moment you need a `RegExp` match:

```typescript
resolve: {
  alias: [
    { find: '@', replacement: '/src' },
    { find: '@components', replacement: '/src/components' },
    // RegExp find lets the replacement reuse capture groups
    { find: /^(.*)\.js$/, replacement: '$1.alias' },
  ],
},
```

> *"When `find` is a regular expression, the `replacement` can use [replacement patterns](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#specifying_a_string_as_the_replacement), such as `$1`."* — [Shared Options](https://vite.dev/config/shared-options)

The documentation's own schematic example for the object form is deliberately minimal about correctness — it exists only to show the key/value shape, not a pattern to copy:

```js
// from the Vite documentation, shown only to illustrate the { find: replacement } shape
resolve: {
  alias: {
    utils: '../../../utils',
    'batman-1.0.0': './joker-1.5.0',
  },
},
```

## Absolute paths are mandatory — a relative alias value is used as-is, not resolved

> *"When aliasing to file system paths, always use absolute paths. Relative alias values will be used as-is and will not be resolved into file system paths."* — [Shared Options](https://vite.dev/config/shared-options)

Read that literally: giving `resolve.alias` a relative string like `'../../../utils'` does not make Vite compute an absolute path from the config file's location. The string is substituted verbatim, and *whatever specifier results* is then handed to the resolver exactly as if you had written it by hand at the import site. That is rarely what anyone wants, which is why every real config computes an absolute filesystem path before it ever reaches `alias`:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
});
```

## Why `'/src'` and `path.resolve(import.meta.dirname, 'src')` are not interchangeable

Both look correct and both work in the common case of a single-package project where the config file sits at the project root. They diverge the moment that assumption breaks.

A leading-`/` replacement value, like `'@': '/src'`, is not a filesystem-root path — Vite's own convention for root-relative specifiers is *project root*, not disk root. The documentation states the same convention for public assets, and `resolve.alias` follows it because the resulting specifier goes through the identical resolution pipeline:

> *"The difference is that the import can be either using absolute public paths (based on project root during dev) or relative paths."* — [Static Asset Handling](https://vite.dev/guide/assets)

So `'@': '/src'` means *"the `src` directory under whatever Vite considers `root`."* `path.resolve(import.meta.dirname, 'src')` means *"the `src` directory next to this config file, on disk, full stop"* — it has no idea what `root` is set to and does not care.

These are the same value only when `root` equals the config file's own directory, which is the default but is not guaranteed:

```typescript
// vite.config.ts — root deliberately points at a subdirectory (common in monorepo
// setups where one vite.config.ts drives multiple app packages)
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(import.meta.dirname, 'apps/storefront'),
  resolve: {
    alias: {
      // '@': '/src' now means <root>/src === apps/storefront/src — almost certainly
      // what you want here, and it moves automatically if `root` moves.
      '@': '/src',
      // this one is pinned to a physical location regardless of `root`, which is
      // exactly right for a path that is NOT inside the app being served
      '@shared': path.resolve(import.meta.dirname, 'packages/shared/src'),
    },
  },
});
```

Neither form is "the correct one" in general — `'/src'` tracks `root`, `path.resolve(...)` tracks the filesystem. Pick the one that matches what you actually mean, and do not assume they are synonyms just because they usually produce the same directory in a single-package project.

## `__dirname` does not exist in an ESM config file

`__dirname` and `__filename` are CommonJS module-scope variables. The moment `vite.config.ts` is loaded as native ECMAScript modules — because it uses a `.mjs`/`.mts` extension, or the nearest `package.json` sets `"type": "module"` — those two names are simply not defined, and referencing `__dirname` throws a `ReferenceError` at config-load time, before Vite has resolved a single module.

> *"Note that to use ES modules syntax in the config file, it should be in a file detected as ESM by Node.js, e.g. `.mjs` or `.js` with `"type": "module"` in closest `package.json`."* — [Configuring Vite](https://vite.dev/config/)

Vite 8 also changed *how* the config file is loaded, which matters if you are chasing why an old `esbuild`-based transform quirk no longer applies:

> *"By default, Vite uses Rolldown to bundle the config into a temporary file and load it."* — [Configuring Vite](https://vite.dev/config/)

The fix is Node's own ESM replacement for `__dirname`, not a Vite API:

> *"`import.meta.dirname`" — Added in: v21.2.0, v20.11.0. Type: `<string>` — The directory name of the current module. This is the same as the `path.dirname()` of `import.meta.filename`.* — Node.js API docs, [`import.meta.dirname`](https://nodejs.org/api/esm.html#importmetadirname)

Both floors this track targets (Node `^20.19.0 || >=22.12.0`) sit above the `20.11.0`/`21.2.0` versions where `import.meta.dirname` was added, so it is safe to use unconditionally on this target:

```typescript
// vite.config.ts — package.json has "type": "module", so this file loads as ESM
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'), // ✅ works — no __dirname needed
    },
  },
});
```

Where a codebase still needs to support a Node floor below `20.11`/`21.2`, the older idiom reconstructs the same value from `import.meta.url`:

```typescript
// vite.config.ts — the pre-import.meta.dirname idiom, for a lower Node floor
import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
```

## Ordering and prefix shadowing

> *"The order of the entries is important, in that the first defined rules are applied first."* — [Shared Options](https://vite.dev/config/shared-options)

This is not a hypothetical warning; it is the direct mechanism of a real class of bug. Alias matching is a specifier match, and a shorter alias that happens to be a prefix of a longer one will shadow it if it is declared first:

```typescript
// ❌ WRONG — '@' matches the START of '@components/Button', so it fires first and
// the string substitution turns '@components/Button' into '/src/components/Button'
// via the WRONG rule, purely by accident of ordering rather than by design.
resolve: {
  alias: {
    '@': '/src',
    '@components': '/src/ui/components', // never reached for anything under '@components/*'
  },
},

// ✅ CORRECT — declare the more specific alias first
resolve: {
  alias: {
    '@components': '/src/ui/components',
    '@': '/src',
  },
},
```

In this particular example the two resolved paths happen to coincide, which is exactly what makes the bug hard to notice — it only surfaces once `@components` and `@` are pointed at genuinely different directories, and by then the shadowing has been shipping silently for a while.

## The Rolldown layer and the deprecated `customResolver`

`resolve.alias` is not a Vite-invented mini-language — it is documented as working *"similar to `@rollup/plugin-alias`"*, and on Vite 8 the layer doing the substitution sits on top of Rolldown rather than Rollup. One piece of the old array-form surface did not survive that move: a `customResolver` function on an individual alias entry.

> *"`resolve.alias[].customResolver`: Use a custom plugin with `resolveId` hook and `enforce: 'pre'` instead"* — [Migration from v7](https://vite.dev/guide/migration), under "Other Related Deprecations"

The migration guide states this as a deprecation with a named replacement; it does not state whether the property is already inert on 8.2.2 or merely scheduled for removal, so treat any config still setting it as needing the rewrite regardless of whether it currently still fires:

```typescript
// ❌ DEPRECATED (Vite 8) — an alias-level customResolver
resolve: {
  alias: [
    {
      find: '@legacy-icons',
      replacement: 'ignored-by-customResolver',
      // customResolver(source, importer) { /* ... */ }  — deprecated, see below
    },
  ],
},

// ✅ CORRECT (Vite 8) — the same behaviour as a resolveId plugin hook, running
// before Vite's own resolution
import type { Plugin } from 'vite';

function legacyIconsResolver(): Plugin {
  return {
    name: 'legacy-icons-resolver',
    enforce: 'pre',
    resolveId(source) {
      if (source.startsWith('@legacy-icons/')) {
        const iconName = source.slice('@legacy-icons/'.length);
        return path.resolve(import.meta.dirname, 'legacy-assets/icons', `${iconName}.svg`);
      }
      return null;
    },
  };
}
```

## Gotchas

**★ Symptom: an alias substitution "does nothing" — the import specifier still fails to resolve.** Cause: the replacement value was a relative string (`'../shared'`), and per the documentation *"Relative alias values will be used as-is and will not be resolved into file system paths"* — the substituted specifier is then resolved exactly as if you had typed it at the import site, relative to the importing file, not to the config. Fix: always compute an absolute path.
```typescript
resolve: { alias: { '@shared': path.resolve(import.meta.dirname, '../shared') } },
```

**★ Symptom: an alias with a longer, more specific name (`@components`) never seems to apply — everything routes through a shorter one (`@`) instead.** Cause: prefix shadowing — the shorter alias is declared first and *"the first defined rules are applied first"*. Fix: reorder so the more specific alias comes first, in either the object or array form.

**★ Symptom: `vite.config.ts` throws `ReferenceError: __dirname is not defined in ES module scope` the moment the dev server starts.** Cause: the config file is loaded as native ESM (`.mts`/`.mjs`, or `"type": "module"` in `package.json`), and `__dirname` is a CommonJS-only binding that does not exist there. Fix: use `import.meta.dirname` (Node 20.11+/21.2+, safely inside this track's floor) or reconstruct it via `fileURLToPath(import.meta.url)` for a lower Node floor.
```typescript
import path from 'node:path';
resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
```

**★ Symptom: `resolve.alias: { '@': '/src' }` resolves to the wrong directory after `root` was pointed at a subdirectory for a multi-app monorepo config.** Cause: a leading-`/` replacement is root-relative, and `root` moved out from under it — this is the intended, documented behaviour, not a bug, but it is easy to forget which of your aliases are meant to track `root` and which are meant to be pinned to a fixed location. Fix: use `'/src'`-style aliases only for paths that should move with `root`; use `path.resolve(import.meta.dirname, ...)` for anything that must stay fixed regardless of which app `root` currently points at.

**★ Symptom: a config still sets a per-alias `customResolver` function and it is unclear whether it still runs on Vite 8.** Cause: `resolve.alias[].customResolver` is listed under the v7→v8 migration guide's "Other Related Deprecations," with no statement of whether it is inert now or only scheduled for removal. Fix: do not rely on it either way — replace it with a `resolveId` plugin hook set to `enforce: 'pre'`, which the migration guide names as the direct equivalent.

## Interview questions

**★ Why does `resolve.alias` need `enforce: 'pre'`-style semantics rather than being "just another resolver"?**
Because it runs as a textual substitution *before* the specifier reaches Vite's normal module resolution, not as a resolver competing with it. That ordering is why the documentation frames it as similar to `@rollup/plugin-alias`: the alias step rewrites the string you asked to import, and only the rewritten string goes on to be resolved as a real module path — including, if it's still relative, being resolved relative to the *importing file*, not to the alias declaration.

**★ Why does the documentation insist on absolute paths for filesystem aliases instead of just resolving relative ones for you?**
Because a relative string has no unambiguous "relative to what" once it is detached from both the config file and the importing module — the documentation's own answer is that it is deliberately *not* resolved and is instead "used as-is," which pushes the ambiguity back onto whoever wrote the config rather than having Vite guess. Passing an already-absolute path (via `path.resolve` or `import.meta.dirname`) removes the ambiguity entirely.

**★ Given `alias: { '@': '/src', '@app': '/src/app' }`, which rule fires for `import x from '@app/router'`, and why does the order in the object matter at all if `'@app'` is the more specific key?**
`'@'` fires first, because *"the first defined rules are applied first"* and matching is on the specifier's prefix, not on which key is "more specific" by some length heuristic. `'@app/router'` starts with `'@'`, so the shorter alias wins purely because it was declared earlier — object key order is preserved and is exactly the order used. Swapping the declaration order (`'@app'` before `'@'`) is the actual fix, not renaming either alias.

**★ Two engineers each configure `'@': path.resolve(__dirname, 'src')` and one gets a `ReferenceError` at startup while the other doesn't. What differs between their setups?**
Whether their `vite.config` file is loaded as CommonJS or as native ESM. If the nearest `package.json` has no `"type": "module"` and the file is `.js`/`.ts` without an `.mjs`/`.mts` extension, `__dirname` is a real CommonJS binding and the line works. If the project uses `"type": "module"` (or the file is `.mts`), the same file is native ESM, `__dirname` is undefined, and the config throws before Vite resolves anything. The fix that works in both cases is `import.meta.dirname`.

---

← [01h · Sourcemaps, target and minifiers](../11-optimization-and-performance/01h-sourcemaps-target-and-minifiers.md) · [Vite overview](../../README.md) · Next → [01a · tsconfig paths vs resolve.alias](01a-tsconfig-paths-and-vite-alias.md)
