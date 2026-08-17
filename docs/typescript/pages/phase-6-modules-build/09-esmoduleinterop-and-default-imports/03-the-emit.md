---
title: "The emit — `__importDefault` and `__importStar`"
sidebar_label: "03 · The emit"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — 🔴 both helper bodies below are **quoted verbatim from the
> compiler's own helper table** (`importDefaultHelper` and `importStarHelper` in
> the installed **TypeScript 5.9.3** build), not reconstructed. The
> `importHelpers` description is its option record's own text. **No sandbox, no
> console blocks** — these are reads of the compiler's source, and no emit was
> run.

`esModuleInterop` has `affectsEmit` ([chunk 02](./02-the-two-flags.md)), so it
puts real code in your output. It is worth seeing exactly what — it is nine lines
in total, and every consequence in this topic is visible in them.

## `__importDefault` — the whole thing

```js
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
```

That is the entire synthetic-default rule from
[chunk 01](./01-what-a-default-import-means.md), executable:

- **Marker present** → the module is already ES-shaped; hand it back untouched
  and `.default` is the author's real default export.
- **Marker absent** → genuine CommonJS; wrap it so that `.default` **is the
  module itself**.

So your `import express from 'express'` becomes, in effect,
`__importDefault(require("express")).default` — and for real CommonJS that
resolves to `module.exports`, which is what you wanted all along.

📌 **Note the `(this && this.__importDefault) ||` prefix.** The helper reuses an
existing one if the surrounding environment already provides it, which is how
TypeScript output and Babel output coexist without defining it twice.

## `__importStar` — and the cost nobody mentions

```js
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
```

Read the `else` branch carefully, because it is doing something
`__importDefault` does not:

🔴 **It builds a brand-new object and copies every own key across.** The
namespace object you get from `import * as x from 'cjs-pkg'` is **not** the
package's `module.exports` — it is a fresh object with bindings created onto it,
plus `default` set to the original module.

Three consequences, none of them obvious from the flag's name:

1. **Identity changes.** `x !== require('cjs-pkg')`. Any code comparing the
   namespace object by reference — a registry keyed on the module object, an
   `===` check — sees a different value.
2. **It is a per-import cost, not a one-off.** Every `import * as` of a CommonJS
   module in every file runs this loop at load time. Usually trivial; occasionally
   not, for a module with a very large export surface.
3. **Bindings are created with `__createBinding`, not plain assignment.** That is
   what preserves *getter* semantics — a lazily-computed export still works —
   rather than snapshotting values at copy time. Worth knowing before concluding
   that the copy makes everything static.

⚠️ **`if (mod && mod.__esModule) return mod;` is the fast path in both helpers**,
and it is why interop feels free for modern packages: anything transpiled from ES
modules is handed straight back.

## `__setModuleDefault` and `__createBinding`

`__importStar` lists both as dependencies, so they come along with it. They exist
so the constructed namespace object behaves like a real one — including
`Object.defineProperty` with the right descriptors — rather than being a plain
object literal that happens to have the same keys.

You do not write them and you rarely read them, but their presence explains a
frequent surprise: **the interop helpers are more than a one-liner in real
output**, and a file that imports one CommonJS module namespace pulls in three
helper definitions.

## Where the helpers go — and `importHelpers`

By default the helpers are **inlined into every emitted file that needs them**.
In a project with hundreds of modules that is hundreds of copies.

The option that fixes it, in its own words:

> **`importHelpers`:** *"Allow importing helper functions from tslib once per
> project, instead of including them per file."* Default: `false`.

```json
{ "compilerOptions": { "esModuleInterop": true, "importHelpers": true } }
```

⚠️ **`importHelpers` makes `tslib` a real runtime dependency.** The emitted files
now `require("tslib")`, so it belongs in `dependencies` — not
`devDependencies` — for anything you publish. Getting that wrong produces a
package that installs cleanly and throws *"Cannot find module 'tslib'"* for your
consumers.

📌 **For a library, the trade is usually worth it**: one dependency against
per-file duplication in everything you ship. For an application that bundles
anyway, the bundler's deduplication makes the difference much smaller.

## What this means for a bundler-built project

If a bundler emits your JavaScript, `tsc` is not emitting these helpers at all —
and that is the entire justification for
`allowSyntheticDefaultImports`-without-`esModuleInterop` from chunk 02. The
bundler has its own interop implementation, generally modelled on the same
`__esModule` convention, and you do not want two of them.

🔴 **Two implementations of "close to the same convention" is where the
works-in-dev-fails-in-prod interop bugs live.** If you are getting different
behaviour between `tsc` output and bundler output for the same import, this is
the first place to look — not at the types.

## Gotchas

**Symptom:** `import * as x from 'cjs-pkg'` and `x !== require('cjs-pkg')`.
**Cause:** `__importStar` constructs a **new** object and copies own keys onto
it; only the `__esModule` fast path returns the original.
**Fix:** Do not compare namespace objects by identity. If you need the real
module object, use a default import (which for CJS *is* `module.exports`) or
`import x = require(…)`.

**Symptom:** Output size grew noticeably after enabling `esModuleInterop`.
**Cause:** The helpers are inlined per file, and `__importStar` brings
`__createBinding` and `__setModuleDefault` with it.
**Fix:** `importHelpers: true` with `tslib`.

**Symptom:** *"Cannot find module 'tslib'"* in a published package.
**Cause:** `importHelpers` emits `require("tslib")` and `tslib` was in
`devDependencies`.
**Fix:** Move it to `dependencies`. It is a runtime dependency the moment the
flag is on.

**Symptom:** A lazily-computed export stopped being lazy after interop.
**Cause:** Unlikely to be this — `__createBinding` deliberately preserves getter
semantics rather than snapshotting values.
**Fix:** Look at the package's own build rather than at the interop helper.

**Symptom:** The same import behaves differently under `tsc` and under the
bundler.
**Cause:** Two independent interop implementations of a convention, not a
specification.
**Fix:** Decide which one emits your production JavaScript and configure the
other not to. Turning both on is the usual root cause.

**Symptom:** Load time regressed in a module that namespace-imports a huge
CommonJS package.
**Cause:** `__importStar` iterates every own key, per import, per file.
**Fix:** Import the members you need, or use a default import. This is a real if
uncommon cost.

**Symptom:** Interop helpers appear twice in the bundle.
**Cause:** TypeScript inlined its own and the bundler added its own.
**Fix:** The `(this && this.__importDefault) ||` guard prevents redefinition at
runtime, but not duplicate *bytes*. `importHelpers`, or let the bundler do the
interop.

## Interview questions

**★ What does `esModuleInterop` actually emit?**
Two helpers. `__importDefault` is the synthetic-default rule in one line —
`return (mod && mod.__esModule) ? mod : { "default": mod }` — and `__importStar`
builds a namespace-like object for `import * as`. Because the flag has
`affectsEmit`, this is real code in your output, which is the difference from
`allowSyntheticDefaultImports`.

**★ Why is `import * as x` of a CommonJS module not the same object as
`require()` returns?**
Because `__importStar` copies: unless the module carries `__esModule`, it creates
a fresh object, binds every own key except `default` onto it, and sets `default`
to the original. So the namespace object is a constructed stand-in, and identity
comparisons against the real module fail.

**★ What is `importHelpers` for, and what does it cost?**
It pulls the emitted helpers from `tslib` once per project instead of inlining
them in every file. The cost is that `tslib` becomes a genuine runtime
dependency — it must be in `dependencies`, not `devDependencies`, or consumers
get *"Cannot find module 'tslib'"*.

**★ Why is `allowSyntheticDefaultImports` the right flag for a bundler-built
project?**
Because the bundler is emitting the JavaScript and already implements its own
interop. Enabling `esModuleInterop` would have TypeScript emit a second
implementation of the same convention, which is where works-in-one-tool-fails-in-
the-other bugs come from.

**What is the `__esModule` fast path, and why does it matter?**
Both helpers begin with `if (mod && mod.__esModule) return mod`. Anything
transpiled from ES modules is handed straight back with no copying or wrapping,
which is why interop costs effectively nothing for modern packages and only
engages for genuine CommonJS.

**Does the namespace copy snapshot values?**
No — `__createBinding` is used rather than plain assignment, specifically so
getter-backed exports keep working. The object is new, but the bindings are not
frozen values.

**Where would you look first if an import works in dev and breaks in production?**
At which tool emitted the JavaScript in each case, and whether both TypeScript
and the bundler are doing interop. `__esModule` is a convention rather than a
specification, so two implementations agree in the common cases and diverge at
the edges.

---

← Prev: [02 · The two flags](./02-the-two-flags.md) · Next → [04 · The errors](./04-the-errors.md)
