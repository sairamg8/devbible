---
title: "Module resolution"
sidebar_label: "05 · Module resolution"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**How a string in an `import` becomes a file on disk. Learn this once and every
"cannot find module" stops being a mystery.**

## Three kinds of specifier

Node decides what to do from the shape of the string, before anything else:

| Specifier | Kind | Resolved as |
|---|---|---|
| `node:fs`, `fs` | **Built-in** | Compiled into the binary — see [the `node:` prefix](03-node-prefix.md) |
| `./util.js`, `../lib/x.js`, `/abs/path.js` | **Relative / absolute** | A path, relative to the importing file |
| `express`, `@acme/ui`, `lodash/merge` | **Bare** | A package — triggers the `node_modules` walk |

Only bare specifiers do any searching. That is the whole reason the categories
matter.

## The `node_modules` walk

For a bare specifier, Node looks in `node_modules` in the importing file's
directory, then its parent, then *its* parent, all the way to the filesystem root.

```js
// deep/nested/where.js
console.log(require.resolve.paths('some-package').slice(0, 5));
```

```console
$ node deep/nested/where.js
[
  '/home/you/resolve/deep/nested/node_modules',
  '/home/you/resolve/deep/node_modules',
  '/home/you/resolve/node_modules',
  '/home/you/node_modules',
  '/home/node_modules'
]
```

First match wins. Three consequences:

1. **Depth costs nothing meaningful** — the list is short and the check is a
   `stat` per level.
2. **A stray `node_modules` higher up the tree silently satisfies imports.** This
   is why something works on your machine and fails in CI: you have a package
   installed two directories up that the repo never declared.
3. **Hoisting is why undeclared dependencies work.** npm flattens the tree, so
   `lodash` sits in the root `node_modules` even if only a transitive dependency
   asked for it — and your `require('lodash')` finds it. It breaks the day that
   dependency drops it. [pnpm](11-package-managers.md) exists largely to stop this.

Once Node finds the package directory, `package.json` takes over: the
[`exports` map](08-exports-map.md) if there is one, otherwise `main`, otherwise
`index.js`.

## Where CJS and ESM diverge

CommonJS guesses. ESM does not.

```js
// guess.cjs
console.log(require('./thing'));    // adds .js
console.log(require('./folder'));   // adds /index.js
```

```console
$ node guess.cjs
found without extension
found via index.js
```

```js
// strict.mjs
try { await import('./thing'); }  catch (e) { console.log('ESM ./thing   →', e.code); }
try { await import('./folder'); } catch (e) { console.log('ESM ./folder  →', e.code); }
console.log('ESM ./thing.js →', (await import('./thing.js')).default);
```

```console
$ node strict.mjs
ESM ./thing   → ERR_MODULE_NOT_FOUND
ESM ./folder  → ERR_UNSUPPORTED_DIR_IMPORT
ESM ./thing.js → found without extension
```

| | CommonJS | ESM |
|---|---|---|
| Missing extension | Tries `.js`, `.json`, `.node` | Fails — `ERR_MODULE_NOT_FOUND` |
| Directory import | Tries `package.json` `main`, then `index.js` | Fails — `ERR_UNSUPPORTED_DIR_IMPORT` |
| Case sensitivity | Follows the filesystem | Follows the filesystem |
| Cache key | Resolved filename | Resolved URL |
| Timing | Synchronous, at the point of call | Resolved before evaluation |

The extension rule is not pedantry. Every probe CommonJS makes is a filesystem
call that can fail differently on a case-insensitive macOS disk than on a Linux
container — which is exactly the bug where `require('./User')` works locally and
`ERR_MODULE_NOT_FOUND`s in production.

## The file that decides CJS or ESM

Resolution finds the file; the **nearest `package.json`** decides how to parse it.

| File | Parsed as |
|---|---|
| `.mjs` | Always ESM |
| `.cjs` | Always CommonJS |
| `.js` with nearest `"type": "module"` | ESM |
| `.js` with nearest `"type": "commonjs"` | CommonJS |
| `.js` with no `type` field | **Detected from the source** — on by default since v22.7.0 / v20.19.0 |

"Nearest" means: walk up from the file until a `package.json` appears. A
`node_modules/foo/package.json` with `"type": "module"` governs the files inside
`foo` and nothing outside it — which is how ESM and CJS packages coexist in one
tree.

Syntax detection is a fallback, not a feature to rely on. It costs a reparse and
says so:

```console
$ node mod2.js
(node:239915) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///…/mod2.js
is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a
performance overhead.
To eliminate this warning, add "type": "module" to /…/package.json.
this file has no "type": "module" and still ran as ESM
```

Always set `type` explicitly. See [package.json essentials](07-package-json.md).

## Gotchas

**Symptom:** `ERR_MODULE_NOT_FOUND` in CI for an import that works locally
**Cause:** Either a missing extension that CommonJS was forgiving about, or a
package resolved from a `node_modules` outside the repo on your machine.
**Fix:** Write extensions; add the package to `dependencies` explicitly. `npm ls
<name>` shows where it actually resolved from.

**Symptom:** `ERR_UNSUPPORTED_DIR_IMPORT`
**Cause:** An ESM import pointed at a directory.
**Fix:** Point at the file — `./routes/index.js`. In a package you own, add an
[`exports`](08-exports-map.md) entry so consumers can keep the short specifier.

**Symptom:** A dependency disappears after an unrelated `npm update`
**Cause:** You were relying on a hoisted transitive dependency that is no longer
in the tree.
**Fix:** Declare everything you import. `npm ls` before and after shows the change.

**Symptom:** `MODULE_TYPELESS_PACKAGE_JSON` warning on every start
**Cause:** No `type` field, and files that parse as ESM.
**Fix:** Add `"type": "module"`.

**Symptom:** Import works on macOS, fails on Linux
**Cause:** Filename case. macOS's default filesystem is case-insensitive; the
container's is not.
**Fix:** Match the case exactly. A CI job on Linux catches this on the first run.

## Interview questions

**★ How does Node resolve a bare specifier like `express`?**
It looks for `node_modules/express` in the importing file's directory, then walks
up parent directories to the filesystem root, taking the first match. Inside the
package, the `exports` map decides the file — falling back to `main`, then
`index.js`.

**★ What is the difference between CJS and ESM resolution?**
CommonJS probes: it will add `.js`, `.json` or `.node`, and will treat a directory
as `index.js`. ESM resolves the exact URL you wrote and fails otherwise. ESM
resolution is also performed ahead of evaluation, not at the moment of the call.

**★ How does Node decide whether a `.js` file is CommonJS or ESM?**
By the `type` field in the nearest `package.json` — `"module"` means ESM,
`"commonjs"` or absent means CommonJS. Since v22.7.0 / v20.19.0 a typeless file
that fails to parse as CommonJS is reparsed as ESM, with a warning about the cost.
`.mjs` and `.cjs` always override.

**★ Why does an undeclared dependency sometimes work?**
npm hoists transitive dependencies into the top-level `node_modules`, and the
upward walk finds them. It stops working as soon as the real dependent removes it
or a stricter package manager stops hoisting.

**What is `require.resolve` for?**
It runs the resolution algorithm and returns the resolved filename without loading
the module — useful for diagnosing which copy of a package is actually being
picked up, and for cache-key work.

---

← Prev: [CJS ↔ ESM interop](04-cjs-esm-interop.md) · Next → [Circular dependencies](06-circular-dependencies.md)
