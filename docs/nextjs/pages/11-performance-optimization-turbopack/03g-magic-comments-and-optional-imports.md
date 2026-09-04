---
title: "Magic comments are the only way to tell the bundler to leave a dynamic import alone, they do nothing at all on a static `import` statement, and `webpackOptional` is the one webpack name Turbopack refuses to accept"
sidebar_label: "03g · Magic comments"
sidebar_position: 119
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Next.js [lazy loading guide](https://nextjs.org/docs/app/guides/lazy-loading)
> (docs build `version: 16.3.4`, `lastUpdated: 2026-03-10`) and the Next.js
> [Turbopack API reference](https://nextjs.org/docs/app/api-reference/turbopack) (`version: 16.3.4`,
> `lastUpdated: 2026-08-03`).
> Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4 · Turbopack default since 16.0**.

**A magic comment is an instruction to the bundler smuggled inside the argument of a dynamic `import()`, and it
has exactly two failure modes: putting it on the wrong kind of import, and using a webpack name that Turbopack
does not implement.** Both fail quietly in the direction that costs you — the comment is a comment, so nothing
warns you that it did nothing. This page covers the four comments that matter under Turbopack, the one rule
that governs where they may appear, and the specific pairing that is a documented incompatibility rather than a
gap: `turbopackOptional` exists, `webpackOptional` is not supported. `next/dynamic` itself is
[03e](03e-next-dynamic-and-lazy-loading.md).

## 🔴 The rule that makes most of them do nothing

> *"Magic comments do not work with static `import` statements (`import x from 'y'`). They only work with
> dynamic expressions."*

That is the sentence to internalise, because the failure is silent. A `/* webpackIgnore: true */` written
above a top-of-file `import` is a comment in a JavaScript file and nothing more — no error, no warning, and the
module is bundled exactly as it would have been. The comment must live **inside the parentheses of a dynamic
`import()`**, where the bundler parses it as part of the import expression.

```js
// ❌ Does nothing. It is a comment above a static import.
/* turbopackIgnore: true */
import { widget } from './vendor/widget.js'

// ✅ Inside the dynamic import expression, where the bundler reads it.
const { widget } = await import(/* turbopackIgnore: true */ './vendor/widget.js')
```

## The comments

| Comment | What it does | Notes |
|---|---|---|
| `turbopackIgnore: true` | Leave the import alone — do not resolve or bundle it | The Turbopack spelling |
| `webpackIgnore: true` | The webpack spelling of the same intent | Recognised for compatibility |
| `turbopackOptional: true` | Suppress the **build error** when the module may not exist | 🔴 It still throws at run time if it is missing |
| `webpackOptional: true` | 🔴 **Not supported** | *"Use `turbopackOptional` instead when using Turbopack."* |

`turbopackOptional`, verbatim, including the half people forget:

> *"`turbopackOptional` … suppress build errors when a module might not exist. The import will still throw at
> runtime if the module is missing"*

And the incompatibility, verbatim:

> *"`webpackOptional` is not supported. Use `turbopackOptional` instead when using Turbopack."*

⚠️ **Note the asymmetry.** `webpackIgnore` has a Turbopack counterpart and is recognised; `webpackOptional`
does not and is not. A codebase migrating off webpack can carry both comments and only discover the second one
matters when a build fails.

## When you actually want `turbopackIgnore`

The honest answer is: rarely, and always because something outside the module graph owns the file.

```js
// A script served by the host application at a path the bundler must not rewrite.
const mod = await import(/* turbopackIgnore: true */ '/vendor/host-runtime.js')
```

The bundler leaves the specifier exactly as written and emits the import as-is, so the browser resolves it at
run time against the deployed origin. That is what you want for a file the deployment provides rather than the
build — a runtime-configured plugin, a script served by a CDN under a path only the environment knows, a module
that must not be fingerprinted.

🔴 **The cost is that you have opted that module out of everything the bundler does for you**: no resolution
check at build time, no tree-shaking, no chunking, no fingerprinting, no analyzer visibility. A module behind
`turbopackIgnore` will never appear in `next experimental-analyze`
([03b](03b-the-two-analyzers-and-how-to-read-them.md)), which makes it precisely the kind of weight that
disappears from a bundle audit while still being downloaded.

## When you actually want `turbopackOptional`

For an import that is *allowed* to be absent at build time — an optional peer dependency, a plugin package
present in some deployments and not others. Without it, the build fails because the specifier does not resolve.
With it, the build succeeds and the failure moves to run time, where you must handle it:

```ts
export async function loadTelemetry() {
  try {
    const mod = await import(/* turbopackOptional: true */ 'optional-telemetry-agent')
    return mod.default
  } catch {
    // The documented behaviour: the build did not fail, but the import still throws
    // at runtime if the package is not installed here.
    return null
  }
}
```

🔴 **Without the `try`/`catch` this comment converts a build error into a production error**, which is a
strictly worse place to discover the same fact. The comment moves *when* you find out, not *whether*.

## Gotchas

**★ Symptom: a magic comment was added and the bundler ignored it completely — no error, no change.** Cause: it
is on a static `import` statement. *"Magic comments do not work with static `import` statements … They only
work with dynamic expressions."* Fix: convert the site to a dynamic `import()` and put the comment inside the
parentheses.

```js
// ❌
/* turbopackIgnore: true */
import widget from './vendor/widget.js'

// ✅
const widget = (await import(/* turbopackIgnore: true */ './vendor/widget.js')).default
```

**★ Symptom: a build fails on a `webpackOptional` comment carried over from a webpack config.** Cause: it is
explicitly not implemented — *"`webpackOptional` is not supported. Use `turbopackOptional` instead when using
Turbopack."* Note that `webpackIgnore` *is* recognised, which is why the failure is surprising. Fix: rename
this one comment.

```js
// ❌ const mod = await import(/* webpackOptional: true */ 'maybe-installed')
const mod = await import(/* turbopackOptional: true */ 'maybe-installed')
```

**★ Symptom: `turbopackOptional` made the build pass and production now throws a module-not-found at run
time.** Cause: exactly what the documentation says it does — *"The import will still throw at runtime if the
module is missing."* Suppressing the build error does not create the module. Fix: wrap the call site and decide
what absence means for the feature.

```ts
let agent = null
try {
  agent = (await import(/* turbopackOptional: true */ 'optional-telemetry-agent')).default
} catch {
  agent = null // degrade the feature rather than the request
}
```

**★ Symptom: a dependency you know ships a lot of JavaScript never appears in the bundle analysis.** Cause: it
is behind `turbopackIgnore`, so it was never in the module graph the analyzer reads. Fix: keep a deliberate
inventory of ignored imports — they are real download weight that no audit will surface for you.

```bash
# The ignored imports are invisible to the analyzer; find them in source instead.
grep -rn 'turbopackIgnore\|webpackIgnore' app components lib
```

**Symptom: a module behind `turbopackIgnore` 404s in production but works locally.** Cause: you removed the
bundler's involvement, so the specifier is resolved by the browser against the deployed origin at run time —
whatever path you wrote must exist there, unhashed, and be served correctly. Locally it happened to. Fix: use
an absolute path served by the host application, and treat that path as part of the deployment contract rather
than a source-tree detail.

**Symptom: the comment is inside the import but on its own line and appears to be ignored.** Cause: the comment
must be part of the import *expression*. Keeping it on the same line as the specifier, inside the parentheses,
is the form the documentation shows and the form that is unambiguous. Fix: put it immediately before the
specifier string.

```js
const mod = await import(/* turbopackIgnore: true */ '/vendor/host-runtime.js')
```

## Interview questions

**★ Where do magic comments have to go, and what happens if you put one somewhere else?**
Inside the parentheses of a dynamic `import()`, immediately before the specifier. The documentation is explicit
that they *"do not work with static `import` statements … They only work with dynamic expressions."* If you put
one anywhere else it is simply a comment: no error, no warning, no effect. That silence is the whole problem —
someone adds `/* webpackIgnore: true */` above an import, the build succeeds, and they conclude it worked. Any
review of one of these comments should check the call site is a dynamic import first.

**★ `webpackIgnore` works under Turbopack but `webpackOptional` does not. Why does that asymmetry matter in
practice?**
Because it makes the failure unexpected. A team migrating from webpack sees their ignore comments continue to
work and reasonably assumes the compatibility layer covers the family — then a build breaks on the one comment
that has no Turbopack implementation. The documentation states it directly: *"`webpackOptional` is not
supported. Use `turbopackOptional` instead when using Turbopack."* The practical rule when migrating is to grep
for `webpack` inside `import(` expressions and convert them, rather than trusting that whatever compiled
yesterday still compiles.

**★ What does `turbopackOptional` actually promise, and what does it not?**
It suppresses the *build* error for a module that might not exist — an optional peer dependency, a plugin
package present in some environments. It promises nothing about run time: *"The import will still throw at
runtime if the module is missing."* So it moves the failure from the build to production unless you wrap the
import in a `try`/`catch` and decide what absence means. Used without that handler it is strictly worse than
the build error it replaced, because it converts a fast, local, obvious failure into a slow, remote one.

**Why is `turbopackIgnore` a decision with an audit cost as well as a build cost?**
Because an ignored import leaves the module graph entirely, and the module graph is what the analyzer reads. A
dependency behind `turbopackIgnore` never appears in `next experimental-analyze`, so it is real download weight
that no bundle audit will ever attribute to you — the one category of bundle problem that cannot be found with
the standard tool. If you use it, the ignored specifiers should be enumerated somewhere a human reads, and
grep-able in source, because nothing else will surface them.

**When is `turbopackIgnore` the right call at all?**
When something outside the build owns the file: a script the hosting environment serves at a fixed path, a
runtime-configured plugin, a module that must not be fingerprinted because another system references it by URL.
In those cases you genuinely want the specifier emitted as written and resolved by the browser at run time.
What you are giving up is everything else the bundler does — build-time resolution checking, tree-shaking,
chunking, fingerprinting and analyzer visibility — so it should be a deliberate, documented exception rather
than a way to quieten a resolution error.

---

← [03f · The `ssr: false` rules](03f-the-ssr-false-and-code-splitting-rules.md) · [Chapter index](01-explanation.md) · Next → [04 · Node.js runtime vs Edge runtime](04-nodejs-runtime-vs-edge-runtime-capabilities-cold-starts-choo.md)
