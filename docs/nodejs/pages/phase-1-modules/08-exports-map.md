---
title: "The exports map (and imports)"
sidebar_label: "08 · exports and imports"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`exports` defines your package's public surface and makes everything else
unreachable. `imports` gives your own files private aliases. Both live in
`package.json`.**

## The problem it solves

Without `exports`, every file in a published package is a public API. Someone
imports `your-pkg/src/internal/cache.js`, you refactor, and their build breaks —
even though you never documented that path. `exports` turns the package from an
open directory into a declared interface.

## Subpath exports

```json
{
  "name": "toolkit",
  "version": "2.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.js",
    "./parse": "./src/parse.js",
    "./package.json": "./package.json"
  }
}
```

```js
// use.js
import { name } from 'toolkit';
import { parse } from 'toolkit/parse';
console.log(name, '|', parse('  a  b  c '));
try { await import('toolkit/src/secret.js'); }
catch (e) { console.log('deep import blocked →', e.code); }
try { await import('toolkit/src/index.js'); }
catch (e) { console.log('even the real path is blocked →', e.code); }
```

```console
$ node use.js
toolkit | [ 'a', 'b', 'c' ]
deep import blocked → ERR_PACKAGE_PATH_NOT_EXPORTED
even the real path is blocked → ERR_PACKAGE_PATH_NOT_EXPORTED
```

Note the second failure: **the real file path is blocked too**. Once `exports`
exists, the *only* valid specifiers are the keys you listed. The left side is the
public name, the right side is the file — and they do not have to match, which is
what lets you move files without a breaking change.

Include `"./package.json": "./package.json"` deliberately. Tools read it to find
your version, and blocking it breaks them for no benefit.

Wildcards keep large surfaces manageable:

```json
{
  "exports": {
    ".": "./src/index.js",
    "./utils/*": "./src/utils/*.js"
  }
}
```

`toolkit/utils/date` now resolves to `./src/utils/date.js`. The `*` is a literal
substitution, not a glob — and it still cannot escape what you wrote, so
`../` tricks do not work.

## Conditional exports

The value can be an object keyed by **condition** instead of a string. Node picks
the first matching key, **in the order they are written**.

```json
{
  "name": "dual-pkg",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./types/index.d.ts",
      "import": "./esm/index.js",
      "require": "./cjs/index.cjs",
      "default": "./esm/index.js"
    }
  }
}
```

```console
$ node from-cjs.cjs      # require('dual-pkg').flavour
require() got: CJS build
$ node from-esm.mjs      # import { flavour } from 'dual-pkg'
import  got: ESM build
```

| Condition | Matches when |
|---|---|
| `node` | Running in Node (any module system) |
| `import` | Reached via `import` or `import()` |
| `require` | Reached via `require()` |
| `types` | TypeScript is resolving types — **must be first** |
| `browser` | A bundler targeting browsers |
| `development` / `production` | Set by the consumer's tooling |
| `default` | Always matches — **must be last** |

**Order is the whole game.** Keys are tried top to bottom, so `default` first
would shadow everything below it. `types` must come first or TypeScript resolves
the JavaScript file and finds no declarations.

### The dual package hazard

Shipping both builds means an app can load both — once through `import`, once
through `require`. Module-scope state then exists twice:

```js
// pseudo-code — the failure it causes
const a = require('dual-pkg');            // CJS copy
const b = await import('dual-pkg');       // ESM copy
a.registry.set('k', 1);
b.registry.get('k');                      // undefined — different Map
```

`instanceof` checks across the boundary fail for the same reason. Two ways out:

1. **Ship ESM only** and let `require(esm)` serve CommonJS consumers. On Node 24
   this works ([interop](04-cjs-esm-interop.md)) and it is the direction the
   ecosystem is going. The cost: consumers on Node 20.18 or older cannot
   `require` you, and top-level `await` locks them out entirely.
2. **Keep state out of module scope.** If the package is pure functions, two
   copies are only a size cost.

## Subpath imports — `#internal`

The mirror image, for use *inside* your own package. Keys must start with `#`,
which is what makes them unambiguously private — there is no npm package that can
collide with `#config`.

```json
{
  "name": "internal-demo",
  "type": "module",
  "imports": {
    "#config": "./src/config.js",
    "#db/*": "./src/db/*.js"
  }
}
```

```js
// src/deep/nested.js
import { port } from '#config';
import { connect } from '#db/client';
console.log('no ../../ needed →', port, connect());
```

```console
$ node src/deep/nested.js
no ../../ needed → 8080 connected
```

This replaces `../../../config.js` chains without a build step, a `tsconfig`
`paths` alias, or a bundler. It is resolved by Node itself, so it works in plain
`node`, in tests, and in production identically.

`imports` also accepts conditions, which is the clean way to swap an
implementation per environment:

```json
{
  "imports": {
    "#storage": {
      "node": "./src/storage-fs.js",
      "browser": "./src/storage-idb.js",
      "default": "./src/storage-memory.js"
    }
  }
}
```

## Gotchas

**Symptom:** `ERR_PACKAGE_PATH_NOT_EXPORTED` for a file that exists
**Cause:** The package has an `exports` map and that path is not a listed key.
**Fix:** Use a documented entry point. If you maintain the package, add the
subpath — adding is not a breaking change; removing is.

**Symptom:** Adding `exports` broke consumers who imported deep paths
**Cause:** `exports` is exhaustive the moment it exists. Previously-working paths
now fail.
**Fix:** This is a **major** version bump. Enumerate the paths people actually use
first, or ship a wildcard for a deprecation period.

**Symptom:** TypeScript cannot find types for a package that clearly ships them
**Cause:** `types` is not first in the condition object, so a JavaScript file
matched earlier.
**Fix:** Put `types` first in every condition block.

**Symptom:** A singleton inside a package is not a singleton
**Cause:** Dual package hazard — the CJS and ESM builds are separate modules with
separate state.
**Fix:** Ship one build, or move the state out of module scope.

**Symptom:** `Cannot find module '#config'`
**Cause:** `imports` keys must start with `#`, and only resolve inside the package
containing that `package.json`.
**Fix:** Check the `#` prefix and that the file is inside the same package.

**Symptom:** Tools crash reading your package's version
**Cause:** `exports` blocks `./package.json`.
**Fix:** Add `"./package.json": "./package.json"`.

## Interview questions

**★ What does the `exports` field do that `main` does not?**
It defines multiple named entry points, selects different files per condition
(`import`, `require`, `types`, `browser`), and — critically — makes every path not
listed unreachable. `main` names one file and blocks nothing.

**★ Why does order matter in a conditional export?**
Node takes the **first** matching condition, so a broad key placed early shadows
everything after it. `default` matches always and must be last; `types` must be
first or TypeScript resolves a `.js` file and reports no declarations.

**★ What is the dual package hazard?**
A package shipping both CJS and ESM builds can be loaded twice in one process.
Each copy has its own module-scope state, so caches, registries and `instanceof`
checks disagree. Avoid it by shipping a single build or keeping state out of
module scope.

**★ What are subpath imports (`#internal`) for?**
Private aliases inside your own package — `import x from '#config'` instead of
`../../../config.js`. The `#` prefix guarantees no collision with an npm package,
Node resolves them natively with no build step, and they support conditions for
per-environment implementations.

**Is adding an `exports` map a breaking change?**
Yes, if consumers were deep-importing. The map is exhaustive from the moment it
exists, so every unlisted path starts throwing `ERR_PACKAGE_PATH_NOT_EXPORTED`.
Treat it as a major version.

**Why export `./package.json` explicitly?**
Because `exports` blocks it otherwise, and a lot of tooling reads a dependency's
`package.json` to find its version or metadata.

---

← Prev: [package.json essentials](07-package-json.md) · Next → [Semver and lockfiles](09-semver-and-lockfiles.md)
