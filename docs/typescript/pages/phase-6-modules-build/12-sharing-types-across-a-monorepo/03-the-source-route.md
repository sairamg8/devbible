---
title: "The source route"
sidebar_label: "03 · The source route"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — the `disableSourceOfProjectReferenceRedirect` and
> `rootDirs` option records and the `TS6059` message text are read out of the
> installed **TypeScript 5.9.3** build. The `paths` behaviour is
> [topic 03](../03-path-aliases/README.md)'s, which owns it and is linked rather
> than restated. **No sandbox, no console blocks.**

Route B: **`ui` is type-checked against `shared`'s `.ts` source.** No build step
between them, changes visible instantly, and — as
[chunk 01](./01-the-question-and-the-compilers-answer.md) established — this is
what the compiler already does by default when you use project references.

It is more popular than its reputation suggests, and the reason is simple: it
makes a monorepo feel like one program.

## Three ways to get here, and they are not equivalent

### 1. 🔴 Project references — the redirect, which is the default

If `ui` references `shared` and `shared` is `composite`, TypeScript prefers
`shared`'s source **without you configuring anything**. This is the version of
the source route that is *supported*: the boundary still exists in the reference
graph, the emit still points at `outputDts`, and build order is still modelled.

📌 **If you have project references, you are already on the source route** unless
you set `disableSourceOfProjectReferenceRedirect: true`. A surprising number of
teams believe they are on the built-declaration route because they run `tsc -b`.

### 2. `paths` pointing at `src` — the version to avoid

```jsonc
{ "compilerOptions": { "paths": { "@org/*": ["./packages/*/src"] } } }
```

⚠️ **[Topic 03 chunk 05](../03-path-aliases/05-the-decision.md) settles this
one**, and its wording is worth carrying: it means *"every package is compiled
against another package's source rather than its published interface — so the
boundary you created by splitting the packages does not exist."*

The additional problem specific to *this* topic: `paths` is a **type-level**
redirect only. `tsc` resolves `@org/shared` to `packages/shared/src/index.ts`;
Node, at runtime, resolves it through `node_modules` to
`packages/shared/dist/index.js`. So your types describe one file and your runtime
loads another. They are usually the same code — right up until `dist` is stale,
at which point you have a divergence with no diagnostic attached.

### 3. A `"development"` or custom export condition

```jsonc
// packages/shared/package.json
{
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  }
}
```

Some toolchains resolve a `development` condition in the dev server and not in
the build. It is honest — the divergence is *declared* rather than accidental —
but ⚠️ **TypeScript itself matches only `types` and `default`**
([topic 11 chunk 03](../11-publishing-a-typed-package/03-exports-and-the-types-condition.md)),
so `tsc` will not follow it. Whatever reads it is the bundler, not the compiler,
and your type-checking is therefore still on whichever route the `types`
condition points at.

## What the source route buys

**1. No build step in the inner loop.** Change `shared`, and `ui` sees it. For a
monorepo where packages change together — which is usually *why* it is a monorepo
— this is the whole argument.

**2. Nothing can be stale.** The single largest category of monorepo confusion
([chunk 05](./05-the-failure-catalogue.md)) simply does not arise. There is no
second artefact to be out of date.

**3. Navigation works with no configuration.** Go-to-definition lands on the real
code because the real code *is* what was loaded. No `declarationMap` needed.

**4. Refactors cross package boundaries.** Rename a symbol in `shared` and the
editor updates `ui`, because both are in one program. On the built route the
editor sees a declaration file and cannot rewrite the source behind it.

🔴 **That fourth point is underrated and is often the real reason teams choose
this route.** A monorepo whose packages cannot be refactored together has given
up most of its advantage over separate repositories.

## What it costs

**1. The boundary is advisory.** `ui` can import
`@org/shared/src/internal/cache` if resolution allows it. Nothing in the type
system objects, and the day `shared` is published or extracted, that import
breaks.

**2. Declaration emit is never exercised.** A `TS4053` or `TS2742` failure
([topic 07 chunk 08](../07-authoring-d-ts-files/08-when-declaration-emit-fails.md))
sits latent until someone runs a build that emits declarations. In a repo that
only ever type-checks, that is release day.

**3. Inference is re-done, not pinned.** An accidentally widened return type
never appears in a reviewable artefact. On the built route it shows up as a diff
in a `.d.ts`.

**4. Every consumer compiles every dependency's source.** On a large graph this
is slower than reading declarations, and it scales with the *source* size rather
than the *interface* size.

## ⚠️ `rootDir` and the trap that follows

```text
TS6059: File '{0}' is not under 'rootDir' '{1}'. 'rootDir' is expected to
        contain all source files.
```

If `ui` compiles `shared`'s source as part of its own program **without** project
references — the `paths` version — then `shared/src/*.ts` are inputs to `ui`'s
build, and `ui`'s `rootDir` does not contain them. The output structure then
mirrors the *common ancestor* of all inputs rather than `ui/src`, so `dist`
acquires an unexpected extra directory level.

📌 **`rootDirs` is a different option and does not fix this.** Its description is
*"Allow multiple folders to be treated as one when resolving modules"* — it is
about *resolution*, for generated-alongside-source layouts, not about output
structure. Reaching for it here is a common wrong turn.

🔴 **The correct fix is project references**, which make `shared` a separate
program with its own `rootDir` and its own outputs — which is chunk 01's point
that the supported source route is the referenced one.

## Gotchas

**Symptom:** You use `tsc -b` and assume you are checking against declarations.
**Cause:** The redirect prefers source by default.
**Fix:** `disableSourceOfProjectReferenceRedirect: true` if you meant the other
route. Knowing which one you are on is the point.

**Symptom:** `ui` imports a `shared` internal and nothing complains.
**Cause:** The source route's boundary is advisory.
**Fix:** `exports` on the internal package, or the built route.

**Symptom:** `TS6059` after adding a `paths` alias to another package's `src`.
**Cause:** That package's files are now inputs to your program and sit outside
your `rootDir`.
**Fix:** Project references. `rootDirs` is a different feature and will not help.

**Symptom:** `dist` layout gained an extra directory level.
**Cause:** Same root cause — the common ancestor of all inputs moved.
**Fix:** Same fix.

**Symptom:** Types resolve to `src` and the runtime loads `dist`, and they
disagree.
**Cause:** `paths` is a type-level redirect only; Node resolves through
`node_modules`.
**Fix:** This is the `paths`-to-`src` failure. Topic 03 chunk 05.

**Symptom:** A `"development"` condition was added and `tsc` ignored it.
**Cause:** TypeScript matches only `types` and `default`.
**Fix:** Expected. The condition affects the bundler; type-checking follows
`types`.

**Symptom:** A declaration-emit error appears the first time a package is
published.
**Cause:** Declaration emit was never exercised internally.
**Fix:** Run one build with `declaration: true` in CI even if nothing consumes
its output.

**Symptom:** Type-checking got slow as the monorepo grew.
**Cause:** Every consumer compiles every dependency's source, so cost scales with
source size rather than interface size.
**Fix:** The built route for the CI graph, or project references so each package
is checked once.

## Interview questions

**★ What is the supported way to be on the source route?**
Project references. If `ui` references a `composite` `shared`, TypeScript prefers
`shared`'s source by default — the redirect — while still modelling build order
and still emitting references to the built declarations.

**★ Why is a `paths` alias to another package's `src` worse than the reference
version?**
Because it removes the boundary entirely and it is type-level only: `tsc`
resolves the specifier to source while Node resolves it through `node_modules` to
the built output. The types describe one file and the runtime loads another,
with no diagnostic when they diverge.

**★ What does the source route buy that the built route cannot?**
No build step in the inner loop, no staleness, navigation that works without
configuration, and — most underrated — cross-package refactors, because
everything is in one program and the editor can rewrite the real source.

**★ What does it cost?**
The boundary becomes advisory, declaration emit is never exercised until release,
inference is re-derived rather than pinned in a reviewable artefact, and
type-checking cost scales with total source rather than interface size.

**You add a `paths` alias to another package's `src` and get `TS6059`. Why?**
Because that package's files are now inputs to your program and lie outside your
`rootDir`, so the compiler cannot place outputs relative to it. The fix is
project references, not `rootDirs` — that option is about module resolution, not
output structure.

**Does a `"development"` export condition put you on the source route?**
Not for type-checking. TypeScript matches only `types` and `default`, so whatever
reads `development` is your bundler. Your types still follow `types`.

**If you use `tsc -b`, which route are you on?**
The source route, unless you explicitly set
`disableSourceOfProjectReferenceRedirect`. Many teams believe otherwise.

---

← Prev: [02 · The built-declaration route](./02-the-built-declaration-route.md) · Next → [04 · Why the editor and the build disagree](./04-editor-versus-build.md)
