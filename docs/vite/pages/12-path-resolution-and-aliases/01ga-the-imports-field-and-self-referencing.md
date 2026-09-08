---
title: "The imports field is exports turned inward — a package's own private, hash-prefixed aliasing mechanism that resolve.alias cannot substitute for because it can point at an external package and travels with the package itself"
sidebar_label: "01ga · imports field & self-reference"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Node.js documentation — [Modules: Packages](https://nodejs.org/docs/latest-v22.x/api/packages.html) (Node 22.x, the pin-relevant branch for Vite 8's `>=22.12.0` target). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ The `imports` Field, and Self-Referencing by Name

**[01g](01g-the-exports-and-imports-fields.md) covers `exports` — what a package exposes to
consumers, enforced as an allow-list. This chunk covers the field that solves the opposite
problem: how a package's own source imports things from itself, including conditionally,
without leaking that mechanism to anyone consuming the package. `imports` and
self-referencing are two names for close variations on the same idea, and both are things
`resolve.alias` cannot substitute for, because both live in the package's own
`package.json` and travel with it.**

## `imports` — private, `#`-prefixed, and able to point outside the package

`exports` governs what *consumers* can reach. `imports` governs what a package can import
*from itself*, including conditionally:

> *"In addition to the "exports" field, there is a package "imports" field to create
> private mappings that only apply to import specifiers from within the package itself."*
> *"Entries in the "imports" field must always start with `#` to ensure they are
> disambiguated from external package specifiers."*

```json
// package.json — a package that wants a native binding on Node and a WASM shim elsewhere
{
  "imports": {
    "#dep": {
      "node": "dep-node-native",
      "default": "./dep-polyfill.js"
    }
  },
  "dependencies": {
    "dep-node-native": "^1.0.0"
  }
}
```

```js
// inside the package's own source
import dep from '#dep'
```

> *"where `import '#dep'` does not get the resolution of the external package
> `dep-node-native` (including its exports in turn), and instead gets the local file
> `./dep-polyfill.js` relative to the package in other environments."*

The one asymmetry worth remembering:

> *"Unlike the "exports" field, the "imports" field permits mapping to external packages."*
> *"The resolution rules for the imports field are otherwise analogous to the exports
> field."*

`exports` can never point a subpath at a different npm package — only at files inside the
package's own directory (and validated, per [01g](01g-the-exports-and-imports-fields.md), to
stay inside it). `imports` has no such restriction, which is exactly what makes it useful for
conditional native-vs-polyfill swaps like the one above: the "real" implementation is a
whole separate published package, reached only through this private indirection.

Subpath patterns work the same way on `imports` as on `exports`:

```json
{
  "imports": {
    "#internal/*.js": "./src/internal/*.js"
  }
}
```

```js
import internalZ from '#internal/z.js'   // loads ./src/internal/z.js
```

`#`-imports are invisible outside the package — a consumer can never `import '#dep'` from
`acme-widgets`, because the specifier is scoped to files that live inside that package's own
`node_modules`-resolution root. This is the field Vite's `resolve.alias` cannot substitute
for and does not need to: `imports` is Node's own private-alias mechanism, and Vite resolves
it as part of the same substrate it resolves `exports` against.

## Self-referencing: a package importing its own name

Related, but distinct: with `exports` defined, a package's own source can `import` the
package **by its own published name**, rather than by a relative path — useful for keeping
internal imports written exactly the way an external consumer would write them:

```json
{
  "name": "a-package",
  "exports": {
    ".": "./index.mjs",
    "./foo.js": "./foo.js"
  }
}
```

```js
// inside a-package's own source
import { something } from 'a-package'        // ✅ loads ./index.mjs
import { another } from 'a-package/m.mjs'    // ❌ ERR_PACKAGE_PATH_NOT_EXPORTED — not listed
```

Self-reference obeys the exact same `exports` map as an external consumer — there is no
special internal-only bypass, which is the point: it forces the package's own code to prove
its public surface actually works, and fails exactly the way an outside consumer's mistake
would:

> *"Self-referencing is available only if package.json has "exports", and will allow
> importing only what that "exports" (in the package.json) allows."*

Self-reference works through both module systems, and with scoped package names:

> *"Self-referencing is also available when using require, both in an ES module, and in a
> CommonJS one."*
> *"self-referencing also works with scoped packages"*

```js
// package.json: { "name": "@my/package", "exports": "./index.js" }
// ./other.js, inside the same package
console.log(require('@my/package'))
```

## Gotchas

**★ Symptom: `import '#dep'` throws "package subpath is not defined" even though it is only ever imported from inside the package that declares it.** Cause: the `imports` map is
missing the entry, or the file computing the specifier is outside the package root that owns
that `package.json` — `imports` entries are scoped to the nearest `package.json`, same as
`exports`. Fix: confirm the importing file's nearest parent `package.json` is the one that
declares the `#dep` entry; a monorepo package importing a sibling's internal `#dep` will not
see it, by design — `imports` is not shared between workspace packages just because they live
in the same repository.

**★ Symptom: `import 'my-own-package-name'` from inside the package's own source throws `ERR_PACKAGE_PATH_NOT_EXPORTED`, even though the package's `name` field matches.** Cause:
self-referencing is only available at all when `package.json` has an `exports` field — a
package that only ever shipped `main` (no `exports`) cannot self-reference by name under any
circumstances, regardless of what its `name` field says. Fix: either add `exports` (which
then also gates every consumer, per [01g](01g-the-exports-and-imports-fields.md)), or use a
relative import for the internal case instead of the by-name form.

**★ Symptom: a package renamed on npm (or republished under a new scope) breaks its own internal self-referencing imports after the rename, with no other code changes.** Cause:
self-referencing resolves by matching the specifier against the package's own `name` field —
rename the package without updating every internal `import 'old-package-name'` and each one
becomes, from the resolver's point of view, an attempt to import a *different*, unrelated
package by that old name (which may not even be installed). Fix: treat internal
self-referencing imports as coupled to the `name` field the same way public API consumers
are; update them in the same commit that changes `name`.

## Interview questions

**★ What is the difference between `exports` and `imports`, and why can't `resolve.alias` replace `imports`?**
`exports` defines what a package exposes to the outside world, enforced as an allow-list;
`imports` defines private, `#`-prefixed aliases a package can use *inside its own source*,
and — unlike `exports` — it can map to an entirely different, external package rather than
only a local file. `resolve.alias` operates at the level of the whole project's resolution
graph: an alias defined in `vite.config.ts` rewrites specifiers everywhere in that project,
including inside third-party dependencies' source if they happen to use a matching bare
specifier, which is almost never what you want. `imports` is scoped per-package by
construction, invisible to every other package including the app consuming it, and travels
with the package itself rather than living in the consuming project's config. They solve
related but distinct problems — one is the app's resolution policy, the other is a package's
own internal indirection that the package author controls and ships.

**★ Why does self-referencing require `exports` to exist at all, rather than working for any package that has a `name` field?**
Because self-referencing is explicitly built as a consequence of the `exports` map, not an
independent feature — it lets internal code use exactly the same specifier an external
consumer would, and resolves against exactly the same allow-list. A package with no
`exports` field has no enforced public surface for internal code to "agree with"; allowing
self-reference there would mean inventing a second resolution behaviour with no `exports` map
to check it against, which defeats the purpose of the feature — internal code proving the
public API actually works by using it the same way a consumer does.

**★ A package's `imports` map conditionally swaps a native Node binding for a pure-JS polyfill depending on environment. Could `exports` express the same thing?**
No — not cleanly, because the two fields serve opposite directions. `exports` could
conditionally point a *subpath* at different files based on `node`/`browser`/`default`
conditions, but that subpath would be part of the package's public API, forcing every
consumer to know about and import through it. `imports` keeps the swap entirely internal:
the package's own code writes one specifier (`#dep`), and the conditional resolution — native
binding on Node, polyfill everywhere else — is invisible to anyone using the package.
`imports`'s ability to map to an external package name (rather than only a local file, which
is all `exports` targets are allowed to be) is exactly what makes swapping in a whole
separate dependency, rather than just another file in the same package, possible at all.

---

← [01g · The exports field](01g-the-exports-and-imports-fields.md) · [Vite overview](../../README.md) · Next → [01h · resolve.conditions](01h-resolve-conditions.md)
