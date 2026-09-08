---
title: "A dual CJS/ESM package can be resolved twice into two separate module instances, and Node's own docs no longer explain the hazard in prose — pre-bundling is the reason most Vite users never meet it"
sidebar_label: "01l · CJS/ESM interop & dual packages"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Node.js documentation — [Modules: Packages, "Dual CommonJS/ES module packages"](https://nodejs.org/docs/latest-v22.x/api/packages.html#dual-commonjses-module-packages) (Node 22.x), and the Vite documentation — [Migration from v7](https://vite.dev/guide/migration), [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling), [Troubleshooting — Default import unexpectedly returns an object](https://vite.dev/guide/troubleshooting#others). One claim below (the mechanism of the dual-package hazard) is stated in our own words because current Node docs no longer spell it out in prose — flagged explicitly. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ CJS/ESM Interop at Resolution Time

**A "dual package" — one that ships both a CommonJS and an ESM entry point through
conditional `exports` — solves the compatibility problem and creates a subtler one: if the
same package gets loaded once via `require` and once via `import` anywhere in one process,
Node can end up running two separate copies of it, with two separate module-level states.
Most Vite apps never see this, not because Vite prevents it, but because dependency
pre-bundling collapses the dependency graph before the hazard has a chance to occur. Know
where that protection stops, and the failure becomes obvious instead of mysterious.**

## What a dual package actually is

Nothing more than a conditional `exports` map keyed on `import`/`require`, exactly as
introduced in [01g](01g-the-exports-and-imports-fields.md):

```json
{
  "name": "acme-formatters",
  "type": "module",
  "exports": {
    "import": "./index-module.js",
    "require": "./index-require.cjs"
  }
}
```

`require('acme-formatters')` and `import 'acme-formatters'` are each satisfied — by design —
by a **different file**. That is the entire feature; the hazard is a consequence of Node's
module registry, not a flaw in the feature itself.

## The hazard, explained plainly — because Node's own docs no longer do

Node's `packages.html` reference used to carry a full prose explanation of this. As fetched
directly against the Node 22.x docs (the pin-relevant branch) on 2026-09-08, the section
titled *"Dual CommonJS/ES module packages"* now reads, in its entirety:

> *"See the package examples repository for details."*

**This is stated here explicitly because it matters for how much to trust a paraphrase of
the mechanism** — no first-party prose remains at that anchor to quote. The mechanism
itself is nonetheless well-established and worth stating precisely, in our own words rather
than as a fabricated quote:

Node keeps a separate module registry for CommonJS (`require.cache`, populated by the CJS
loader) and for ESM (the internal module map populated by the ESM loader). If one part of
an application reaches a dual package via `require('acme-formatters')` and another part
reaches the *same* package via `import 'acme-formatters'`, each loader resolves its own
condition (`require` or `import`) to its own file, instantiates it independently, and
caches it in its own registry — with no awareness of the other. The result is two live
copies of the same package's module-scope state in one process: two different `Map`
instances if the package keeps an internal cache in one, two different results from
`instanceof` checks against a class the package exports, two different singletons if the
package's design assumed exactly one instance would ever exist.

```js
// two different files in the same application, same dependency
// file-a.cjs
const formatters = require('acme-formatters')
formatters.registry.set('currency', myCurrencyFormatter)

// file-b.mjs
import formatters from 'acme-formatters'
formatters.registry.get('currency')   // undefined — this is a DIFFERENT `registry` Map,
                                       // from the OTHER module instance
```

Nothing here is a bug in Node, in Vite, or usually even in the package — it is the
predictable consequence of two independent module loaders each doing exactly what they are
supposed to do, applied to a package that happens to be reachable through both.

## Why pre-bundling means most Vite apps never trigger this

[Dependency pre-bundling](../11-optimization-and-performance/01a-dependency-pre-bundling.md)
converts every CommonJs/UMD dependency to a single ESM module once, at cold start, and every
subsequent `import` in the dev graph goes through that one pre-bundled file. There is no
second, independent `require()` path left for application code to accidentally take through
a separate loader — Vite's own resolution and transform pipeline is the only door in. The
hazard specifically needs two *different* loaders (Node's own CJS loader and its own ESM
loader) to each independently instantiate the same package; a Vite app whose entire
dependency graph goes through Vite's pipeline never gives Node's dual loaders that chance.

The place the hazard can still surface in a Vite project is exactly where Vite's pipeline
stops applying: `vite.config.ts` itself (loaded by plain Node before Vite exists to
intercept anything), a build script invoked outside Vite, or an SSR-externalised dependency
(covered in [01k](01k-externalization-and-the-two-builds.md)) that Node resolves directly at
runtime rather than through Vite's bundled graph — if that externalised package is also
`require`d elsewhere in the same Node process by a different piece of tooling, the two
loaders can each get their own copy.

## `require`-only dependencies: the flip side of the same interop boundary

Some dependencies still ship no `exports.import` condition at all — CJS or UMD only, with no
ESM entry point whatsoever. These are not "dual" packages; they are single-format packages
being loaded into an ESM-first tool, and the relevant Vite mechanism is smart import
analysis rather than the dual-loader hazard:

> *"When converting CommonJS dependencies, Vite performs smart import analysis so that
> named imports to CommonJS modules will work as expected even if the exports are
> dynamically assigned (e.g. React)"*

```js
// works as expected — quoted from the Vite dependency pre-bundling docs
import React, { useState } from 'react'
```

The full mechanics of this conversion — why it exists, what breaks when a CJS package is
wrongly excluded from it, and the `optimizeDeps.include`/`exclude` levers — are covered
completely in
[../11-optimization-and-performance/01a-dependency-pre-bundling.md](../11-optimization-and-performance/01a-dependency-pre-bundling.md); this page's
concern is narrower: a `require`-only dependency has no dual-package hazard to trigger,
because there is only ever one loader's worth of module state — Vite's pre-bundled ESM
shim.

## Vite 8's own interop change: what counts as the "default" import of a CJS module

Separately from the dual-loader hazard, v8 changed a long-standing ambiguity in how Vite
itself decides what a `default` import of a CJS module actually returns:

> *"the `default` import is the `module.exports` value of the importee CJS module"* when
> *"the importer is `.mjs` or `.mts`"* or when *"the closest `package.json` for the
> importer has a `type` field set to `module`"* — unless *"the `module.exports.__esModule`
> value of the importee CJS module is not set to `true`"*, in which case the previous,
> narrower rule applies instead.

The troubleshooting guide frames the practical symptom directly:

> *"The default import returns the `module.exports` object for CJS modules, while you may
> expect it to return the `module.exports.default` value."*

producing errors that read as unrelated to imports at all:

> `Element type is invalid: expected a string (for built-in components) or a class/function
> (for composite components) but got: object.`
> `foo is not a function`

```js
// a CJS dependency with no __esModule marker
// module.exports = { formatDate, formatCurrency }

import formatters from 'acme-formatters-legacy'
// formatters is now the WHOLE module.exports object ({ formatDate, formatCurrency }),
// not a "default" property that does not exist on it — calling formatters() throws
```

A deprecated escape hatch exists for code that depended on the old rule:

> *"You can use the deprecated `legacy.inconsistentCjsInterop: true` option to temporarily
> restore the previous behavior."*

```js
// vite.config.js — temporary compatibility shim, not a long-term fix
import { defineConfig } from 'vite'

export default defineConfig({
  legacy: {
    inconsistentCjsInterop: true,
  },
})
```

> *"If you find a package that is affected by this change, please report it to the package
> author or send them a pull request."*

## Gotchas

**★ Symptom: a dual-published package's internal cache/registry appears empty in one part of the app even though another part just populated it.** Cause: the two call sites reached
the package through different Node loaders — commonly `vite.config.ts` (loaded by plain
Node, outside Vite's own graph) `require`-ing it in one place, and application code
`import`-ing it in another — each getting an independently instantiated copy. Fix: pick one
loading path for the whole process. If the package must be used both in config and in app
code, prefer requiring it consistently the same way in both, or restructure so the
config-time usage doesn't need shared state with the runtime usage at all.

**★ Symptom: `instanceof` against a class exported by a dependency returns `false` even though the value visibly came from that same dependency.** Cause: this is the dual-package
hazard's classic tell — the value and the class being tested against were instantiated from
two different loaded copies of the same package (one via the CJS entry, one via the ESM
entry), so they are, from the JS engine's point of view, genuinely unrelated classes that
happen to share a name. Fix: same as above — eliminate the second loading path rather than
working around the symptom with duck-typing, which just hides the real problem.

**★ Symptom: `Element type is invalid: expected a string... but got: object` after upgrading to Vite 8, for a component imported from a CJS dependency with no obvious code change.** Cause: v8's interop change to what counts as a CJS module's `default` import — the
dependency lacks `module.exports.__esModule = true`, so its whole `module.exports` object is
now returned as `default` instead of a `.default` property that never existed. Fix: use
`legacy.inconsistentCjsInterop: true` as an immediate unblock, then fix the actual import —
either a named import if the value is available that way, or reporting the missing
`__esModule` marker to the dependency's maintainer.
```js
// ✅ often the real fix, once you know the module shape
import * as formatters from 'acme-formatters-legacy'
formatters.formatDate(...)
```

**★ Symptom: a `require`-only (no `exports.import`) dependency behaves correctly with named imports, and someone assumes this means it is "basically ESM".** Cause: confusing smart
import analysis (Vite's pre-bundling feature, which makes named imports from CJS work) with
the package actually being a dual package. A single-format CJS dependency has no dual-loader
hazard to worry about at all — there is only ever one module instance, produced by Vite's own
pre-bundler — but it also has no `import` condition of its own, so anything resolving it
outside Vite's pipeline (a plain Node script, a different bundler) gets the CJS file only,
with none of Vite's analysis applied.

## Interview questions

**★ Why can a dual-published package end up with two separate, out-of-sync copies of its own module state in one process, and why don't most Vite apps ever see it?**
Because Node maintains separate module registries for CommonJS and ESM, and a dual
`exports` map deliberately routes `require` and `import` to different files — if both paths
are exercised for the same package in one process, each loader instantiates and caches its
own copy independently, with no shared state between them. Most Vite apps never trigger this
because dependency pre-bundling converts every CJS/UMD dependency into a single ESM module
once at cold start, and the entire application graph then goes through that one pre-bundled
copy via Vite's own pipeline — there is no second, independent `require()` path left for
ordinary application code to accidentally take. The hazard resurfaces exactly where Vite's
pipeline doesn't apply: config-time code loaded by plain Node, or an SSR-externalised
dependency resolved directly by Node's own runtime resolver.

**★ Node's own documentation used to explain the dual-package hazard in detail. What does it say now, and why does that matter for how confidently you can cite it?**
As fetched directly against the current Node 22.x docs, the "Dual CommonJS/ES module
packages" section is a single sentence pointing at an external examples repository — the
prose explanation of the hazard mechanism is no longer part of the first-party reference.
That matters because the mechanism (two independent module registries, two instantiations)
is still true and still worth explaining, but it can no longer be quoted verbatim from
Node's own docs; anyone stating it precisely should say so explicitly rather than presenting
a confident paraphrase as if it were a direct quote from a still-current source.

**★ What changed about CJS default-import interop in Vite 8, and what does the deprecated escape hatch trade away?**
Previously, whether a `default` import of a CommonJS module returned the whole
`module.exports` object or its `.default` property depended on a matrix of conditions
involving whether the importer was included in dependency optimization and its file
extension — inconsistent between dev and build. Vite 8 simplified the rule to: if the
importer is ESM (`.mjs`/`.mts`, or `type: module`) and the CJS module lacks an `__esModule`
marker, `default` is the whole `module.exports` object, full stop, in both dev and build.
`legacy.inconsistentCjsInterop: true` restores the old, inconsistent behaviour for code that
depended on it, which is a deliberate trade — it unblocks an upgrade immediately at the cost
of keeping the exact ambiguity the new rule was introduced to remove, and the documented
expectation is that it is temporary, with the real fix being to report the missing
`__esModule` marker upstream or switch to a namespace import.

---

← [01k · Externalisation & the two builds](01k-externalization-and-the-two-builds.md) · [Vite overview](../../README.md) · Next → [01m · Debugging resolution](01m-debugging-bare-specifier-resolution.md)
