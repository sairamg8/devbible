---
title: "A package's exports field is not documentation of its public API — it is enforcement, and Vite inherits Node's ERR_PACKAGE_PATH_NOT_EXPORTED failure mode exactly"
sidebar_label: "01g · The exports field"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Node.js documentation — [Modules: Packages](https://nodejs.org/docs/latest-v22.x/api/packages.html) (Node 22.x, the pin-relevant branch for Vite 8's `>=22.12.0` target). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ The Substrate: Node's `exports` Field

**Everything in this topic — `resolve.conditions`, `resolve.mainFields`, the SSR/client
split, the "deep import suddenly stopped working" bug reports — sits on top of a field in
`package.json` that Node itself defines and enforces: `exports`. Vite does not invent
bare-specifier resolution; it reads the same field Node reads, adds its own default
conditions and main-field order, and hands the rest to the same rules. If you do not know
what `exports` actually restricts, every Vite resolution error reads as arbitrary. The
companion `imports` field — Node's private, `#`-prefixed mechanism for a package's own
internal specifiers — and self-referencing are covered next, in
[01ga](01ga-the-imports-field-and-self-referencing.md).**

## Why `exports` exists: encapsulation, not convenience

Before `exports`, a package's `main` field named one entry point, but nothing stopped a
consumer from `require`-ing any file inside the package by its full path — `main` was
advisory, not enforced. `exports` changes that:

> *"The "exports" provides a modern alternative to "main" allowing multiple entry points
> to be defined, conditional entry resolution support between environments, and preventing
> any other entry points besides those defined in "exports". This encapsulation allows
> module authors to clearly define the public interface for their package."*

The consequence is stated just as directly, and it is the sentence every "why did this deep
import stop working" report traces back to:

> *"Existing packages introducing the "exports" field will prevent consumers of the
> package from using any entry points that are not defined, including the `package.json`
> (e.g. `require('your-package/package.json')`). This will likely be a breaking change."*

```json
// node_modules/acme-widgets/package.json
{
  "name": "acme-widgets",
  "exports": {
    ".": "./dist/index.js",
    "./styles.css": "./dist/styles.css"
  }
}
```

```js
import { Widget } from 'acme-widgets'              // ✅ resolves — "." is defined
import 'acme-widgets/styles.css'                    // ✅ resolves — explicitly exported
import { internalHelper } from 'acme-widgets/lib/helpers.js'  // ❌ was never re-exported
```

That last import worked for years while `acme-widgets` shipped no `exports` field — Node
resolved bare `main`-relative paths by filesystem lookup, so any file under the package
directory was reachable. The moment the maintainer adds `exports` (even just to modernise
the package, with no intent to break anyone), every deep import outside the declared map
starts failing:

> *"When the "exports" field is defined, all subpaths of the package are encapsulated and
> no longer available to importers. For example, `require('pkg/subpath.js')` throws an
> `ERR_PACKAGE_PATH_NOT_EXPORTED` error."*

And precedence is unconditional once `exports` exists at all:

> *"If both "exports" and "main" are defined, the "exports" field takes precedence over
> "main" in supported versions of Node.js."*

A stale `main` pointing at a valid file changes nothing if `exports` is present — Node
never consults it.

## `exports` is encapsulation, not a sandbox

One caveat matters for debugging: the restriction is at the *resolver*, not the filesystem.

> *"This encapsulation of exports provides more reliable guarantees about package
> interfaces for tools and when handling semver upgrades for a package. It is not a strong
> encapsulation since a direct require of any absolute subpath of the package such as [...]"*
> — the sentence continues to note that resolving an absolute filesystem path directly
> (bypassing specifier resolution entirely) still reaches the file.

That is not a loophole worth using — anything reached that way is explicitly unsupported by
the package's own contract and will break on the next minor release with no warning, because
the maintainer never promised it existed.

## Backward-compatible `exports`: naming every old entry point

A maintainer who wants to add `exports` without breaking every deep-import consumer has to
enumerate what used to work:

```json
{
  "name": "my-package",
  "exports": {
    ".": "./lib/index.js",
    "./lib": "./lib/index.js",
    "./lib/index": "./lib/index.js",
    "./lib/index.js": "./lib/index.js",
    "./feature": "./feature/index.js",
    "./feature/index.js": "./feature/index.js",
    "./package.json": "./package.json"
  }
}
```

Or use a pattern to cover a whole directory, with a `null` target to explicitly block a
private subfolder:

```json
{
  "name": "my-package",
  "exports": {
    ".": "./lib/index.js",
    "./lib/*": "./lib/*.js",
    "./lib/*.js": "./lib/*.js",
    "./lib/internal/*": null
  }
}
```

> *"`*` maps expose nested subpaths as it is a string replacement syntax only."* … *"This is
> a direct static matching and replacement without any special handling for file
> extensions."*

The static-enumerability property is deliberate:

> *"The property of exports being statically enumerable is maintained with exports patterns
> since the individual exports for a package can be determined by treating the right hand
> side target pattern as a `**` glob against the list of files within the package."*

That is what lets a bundler resolve `exports` without executing any of the package's code —
the whole map can be read as data.

## Export targets are validated, not just declared

An `exports` map is not free-form JSON — Node rejects several shapes of target string
outright, for reasons stated directly:

> *"All target paths in the "exports" map (the values associated with export keys) must be
> relative URL strings starting with `./`."*

```json
{
  "name": "my-package",
  "exports": {
    ".": "./dist/main.js",              // ✅ correct
    "./feature": "./lib/feature.js",    // ✅ correct
    "./origin-relative": "/dist/main.js",  // ❌ must start with ./
    "./outside": "../common/util.js"       // ❌ must start with ./
  }
}
```

The reasons are explicit, not incidental:

> *"Security: Prevents exporting arbitrary files from outside the package's own directory."*
> *"Encapsulation: Ensures all exported paths are resolved relative to the package root,
> making the package self-contained."*

And the restriction goes further than the leading `./` — traversal segments anywhere inside
the target are rejected too:

> *"Export targets must not resolve to a location outside the package's root directory.
> Additionally, path segments like `.` (single dot), `..` (double dot), or `node_modules`
> (and their URL-encoded equivalents) are generally disallowed within the target string
> after the initial `./` and in any subpath part substituted into a target pattern."*

```json
{
  "exports": {
    ".": "./dist/../../elsewhere/file.js"   // ❌ invalid: path traversal
  }
}
```

This is precisely the rule a monorepo package hits when it tries to export a file that
physically lives in a sibling package's build output — `"./shared": "../shared-lib/dist/index.js"` is rejected outright, regardless of whether the target file genuinely
exists on disk, because the rule is about the *specifier shape*, not reachability.

## Gotchas

**★ Symptom: a deep import that worked for months suddenly throws `ERR_PACKAGE_PATH_NOT_EXPORTED` after a routine dependency bump.** Cause: the dependency added an `exports` field
in what its author considered a non-breaking release (often a minor or even patch, since many
maintainers do not realise `exports` is enforcement). Any path not listed in the new map is
now unreachable, no matter how long it existed on disk before. Fix: use the path the package
actually exports — check its `package.json` `exports` map, not old habit or old blog posts.
If nothing equivalent is exported, that is a bug report for the maintainer, not a Vite
config to reach for.
```js
// ❌ relied on filesystem structure, never a documented entry point
import { formatCurrency } from 'acme-utils/dist/lib/currency.js'
// ✅ use the declared subpath, or the package's documented API
import { formatCurrency } from 'acme-utils/currency'
```

**★ Symptom: `require('some-package/package.json')` fails after the package added `exports`.** Cause: `package.json` itself is a subpath, and `exports` encapsulates it exactly like any
other file — tooling that read `version` out of a dependency's own manifest by path (a
common pattern for cache-busting or license scanning) breaks. Fix: the maintainer must
explicitly export it — `"./package.json": "./package.json"` — or the consumer must switch to
`require.resolve` plus `fs.readFileSync`, or to a package-manager API that does not rely on
the specifier resolver at all.

**★ Symptom: a bundler-analysis tool reports a package's exports incompletely, or a linter cannot "see" a subpath that resolves fine at runtime.** Cause: hand-authored subpath entries can technically point anywhere, but tools that statically enumerate an `exports` map (documentation generators, cross-package
type-checkers) rely on the map being complete and pattern-based, not scattered exact-string
entries added ad hoc over time. Fix: prefer the pattern form (`"./features/*.js": "./src/features/*.js"`) over enumerating every file by hand — it stays both enforceable and
statically enumerable as the package grows.

**★ Symptom: a monorepo package's `exports` entry pointing at a sibling package's build output is rejected outright — `npm publish`/`npm pack` or the resolver itself errors, even though the referenced file genuinely exists on disk.** Cause: export targets must be
relative URLs starting with `./` and cannot contain `..` segments after that prefix — this is
enforced regardless of whether the target file is reachable, precisely so a package cannot
export files from outside its own directory. Fix: the file has to physically live inside the
package being published; build/copy it in during the package's own build step rather than
referencing a sibling package's output by a traversal path.
```json
{
  "exports": {
    "./shared": "../shared-lib/dist/index.js"
  }
}
```
```json
{
  "exports": {
    "./shared": "./vendor/shared-lib/index.js"
  }
}
```

## Interview questions

**★ Why does adding `exports` to a widely-used package count as a breaking change, even when the maintainer changed no code?**
Because `exports`, once present, replaces filesystem-based resolution with an explicit
allow-list — *"preventing any other entry points besides those defined in \"exports\"."*
Every consumer who was reaching into the package by a path not in that list, including
`require('pkg/package.json')`, now hits `ERR_PACKAGE_PATH_NOT_EXPORTED`. The package's public
surface did not shrink from the maintainer's point of view — it was always meant to be just
the documented API — but it shrank from semver's point of view, because anything reachable at
runtime was part of the contract whether or not it was documented. This is exactly why
libraries publish a compatibility `exports` map (naming every previously-working path
explicitly) on the release that introduces the field, rather than trusting good intentions.

**★ Why does Node reject an `exports` target that points outside the package's own directory, even when the file genuinely exists there?**
Because the restriction is deliberately about the *specifier shape*, not filesystem
reachability — Node states the reasons directly: *"Security: Prevents exporting arbitrary
files from outside the package's own directory"* and *"Encapsulation: Ensures all exported
paths are resolved relative to the package root, making the package self-contained."* A
package that could export `../sibling-package/dist/index.js` would let its own version of
`exports` be used to reach into another package entirely, which breaks the guarantee that a
published package is a self-contained unit — you could not, for instance, safely delete or
relocate a package's dependencies without also potentially breaking what it exports. The
validation is enforced at the string level (must start with `./`, must not contain `..`
after that) specifically so it does not depend on what happens to exist on any given
machine's disk.

**★ Someone claims `exports` fully sandboxes a package's internals. What is wrong with that claim?**
It is not a strong encapsulation. The specifier resolver enforces the map, but a consumer
that resolves an absolute filesystem path directly — bypassing the package-name resolution
step entirely — still reaches the file; only specifier-based resolution is restricted. In
practice this rarely matters, because nobody does that by accident, but it matters for the
mental model: `exports` is a contract about *how imports are written*, not a filesystem
permission system. Treat anything reached by working around it as unsupported, since the
maintainer never promised that path and can move or delete it without warning.

---

← [01f · Aliasing to stubs & monorepo source](01f-aliasing-stubs-and-monorepo-source.md) · [Vite overview](../../README.md) · Next → [01ga · imports field & self-reference](01ga-the-imports-field-and-self-referencing.md)
