---
title: "The built-declaration route"
sidebar_label: "02 · The built-declaration route"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TSConfig reference** for `declaration`,
> `declarationMap`, `composite` and `emitDeclarationOnly`, with the `composite`
> and `declarationMap` option records and `TS6304`/`TS6305`'s message text read
> from the compiler's own tables in the installed **TypeScript 5.9.3** build.
> **No sandbox, no console blocks.**

Route A: **`ui` imports `@org/shared` and gets `shared/dist/index.d.ts`**, exactly
as it would if `shared` came from npm.

This is the route that treats internal packages as real packages. It is more
work, and everything it costs you it costs *early*, which is the argument for
it.

## What it looks like

Each package is a genuine package — a real name, a real manifest — and the
workspace's `node_modules` symlinks make the name resolve:

```jsonc
// packages/shared/package.json
{
  "name": "@org/shared",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./package.json": "./package.json"
  }
}
```

🔴 **Every rule from [topic 11](../11-publishing-a-typed-package/README.md)
applies here, unchanged.** That is the point of this route and its main
benefit: your internal packages are exercised as published packages every day,
so the failures in topic 11 surface during development rather than at release.

📌 Which means the golden rule applies too — one `.d.ts` per JavaScript file. An
internal package that is dual-format has the same masquerade risk as a published
one ([topic 11 chunk 01](../11-publishing-a-typed-package/01-the-one-rule.md)),
and internal packages are usually single-format, which is one more reason this
route stays simple in practice.

## What it buys

**1. The boundary is real.** `ui` can see only what `shared` exported and
emitted. If `shared/src/internal/cache.ts` is not part of the public surface, it
does not exist as far as `ui` is concerned. That is the *reason you split the
packages*, and the source route does not give it to you.

**2. Declaration-emit failures surface immediately.** The `TS4053` "private
name" family and `TS2742` "cannot be named" from
[topic 07 chunk 08](../07-authoring-d-ts-files/08-when-declaration-emit-fails.md)
are errors in `shared`'s own build. On this route you cannot consume a package
whose declarations do not emit, because there are none.

**3. It is what a consumer would get.** Which is the only claim that ultimately
matters if the package is ever published — and increasingly matters even if it
is not, because the same `.d.ts` is what your bundler and your editor read.

**4. Inference is pinned.** A widened or accidentally-`any` inferred return type
becomes visible in the emitted declaration, where a reviewer can see it in a
diff. Against source, it is re-inferred silently on every check.

## What it costs

**1. Order.** `shared` must be built before `ui` is checked. In a graph of any
size that means an ordering mechanism — which is what project references and
`tsc -b` are for, and they are **13 · Project references and `tsc -b`** *(not
written yet)*.

**2. Staleness.** A `dist` built an hour ago is what you are checking against
now. This is the single largest source of monorepo confusion and it has its own
chunk — [chunk 05](./05-the-failure-catalogue.md).

**3. Navigation, unless you fix it.** Go-to-definition lands in a `.d.ts`, which
is a generated file with no implementation in it.

### 🔴 `declarationMap` is not optional on this route

```js
{
  name: "declarationMap",
  type: "boolean",
  affectsBuildInfo: true,
  category: Diagnostics.Emit,
  defaultValueDescription: false,
  description: Diagnostics.Create_sourcemaps_for_d_ts_files
}
```

*"Create sourcemaps for `.d.ts` files."* With it on, `shared` emits
`index.d.ts.map` alongside `index.d.ts`, and the editor follows go-to-definition
through the declaration into `shared/src/index.ts` — the real code, editable,
with the real implementation.

> **Without `declarationMap`, the built-declaration route makes the codebase feel
> worse to work in, and that feeling is what drives teams back to source
> imports.** It is one line.

⚠️ Its `.d.ts.map` files reference the source, so `shared/src` must be present —
fine in a monorepo, and a reason to exclude the maps from the published tarball
if the package also ships to npm.

## The `composite` requirement, and its two rules

If you use project references, the referenced project must set `composite: true`:

```js
{
  name: "composite",
  type: "boolean",
  affectsBuildInfo: true,
  isTSConfigOnly: true,
  category: Diagnostics.Projects,
  defaultValueDescription: false,
  description: Diagnostics
    .Enable_constraints_that_allow_a_TypeScript_project_to_be_used_with_project_references
}
```

*"Enable **constraints** that allow a TypeScript project to be used with project
references."* — the word is **constraints**, and the compiler enforces two of
them by diagnostic:

```text
TS6304: Composite projects may not disable declaration emit.
```

🔴 **`composite` implies `declaration: true` and refuses to let you turn it
off** — which is the compiler stating this whole chunk as a rule. A composite
project *must* produce declarations, because being consumable through them is
the entire point.

```text
TS6307: File '{0}' is not listed within the file list of project '{1}'.
        Projects must list all files or use an 'include' pattern.
```

The second constraint: a composite project's file set must be **enumerable up
front**. No open-ended resolution pulling in files nobody declared — which is
what makes build ordering computable at all.

📌 `composite` also implies `incremental`, so a `.tsbuildinfo` is always written
— and [topic 10 chunk 07](../10-skiplibcheck/07-the-tsbuildinfo-interaction.md)'s
warning about one buildinfo path per option set applies per package.

## Gotchas

**Symptom:** Go-to-definition lands in a generated `.d.ts` and everyone hates
the monorepo.
**Cause:** No `declarationMap`.
**Fix:** `declarationMap: true` in every internal package. One line, and it is
the difference between this route being pleasant and being resented.

**Symptom:** `TS6304` when adding `composite: true`.
**Cause:** The project sets `declaration: false` or `noEmit: true`.
**Fix:** A composite project must emit declarations. That is the constraint the
flag's own description names.

**Symptom:** `TS6307` on a file that is clearly part of the project.
**Cause:** It is reached by resolution but not covered by `files`/`include`.
**Fix:** Widen `include`. Composite projects must enumerate their inputs.

**Symptom:** `ui` imports something internal from `shared` and it resolves.
**Cause:** You are on the source route, not this one — or `shared` has no
`exports` map.
**Fix:** `exports` on the internal package. The boundary needs enforcing.

**Symptom:** A published version of an internal package has broken types that
never showed up internally.
**Cause:** Internal consumption bypassed something — usually `exports`, via a
`paths` alias.
**Fix:** Consume it the way npm would. That is this route's main benefit.

**Symptom:** `declarationMap` was enabled and the published tarball grew.
**Cause:** `.d.ts.map` files reference source and were included.
**Fix:** Exclude them from `files` for packages that publish, keep them for
internal use.

**Symptom:** Every change to `shared` requires a manual rebuild before `ui`
sees it.
**Cause:** The route's central cost.
**Fix:** `tsc -b --watch` over the solution, or the source route for the dev
loop. Chunk 06.

**Symptom:** Two packages both write `.tsbuildinfo` to the same place.
**Cause:** Shared `outDir` or an inherited `tsBuildInfoFile`.
**Fix:** One per package — topic 10 chunk 07's rule, applied per project.

## Interview questions

**★ What does the built-declaration route buy you?**
A real package boundary — consumers see only what was exported and emitted —
declaration-emit failures surfacing immediately, pinned inference visible in a
diff, and the confidence that internal consumption matches what a published
consumer would get.

**★ What does it cost?**
Build ordering (a package must be built before its consumers are checked),
staleness (you check against whatever `dist` currently holds), and navigation,
unless you enable `declarationMap`.

**★ Why is `declarationMap` close to mandatory on this route?**
Because without it, go-to-definition lands in a generated `.d.ts` with no
implementation. That single ergonomic failure is what drives teams back to
source imports, and it is fixed by one line.

**★ What does `composite: true` actually enforce?**
Its own description says *"constraints"*, and two are reported directly:
`TS6304` — composite projects may not disable declaration emit — and `TS6307` —
every file must be listed or matched by `include`. The first makes the package
consumable through declarations; the second makes build order computable.

**Why does `composite` refuse `declaration: false`?**
Because the entire purpose of a composite project is to be consumed through its
declarations. Allowing the emit to be disabled would leave nothing to consume.

**Does the built-declaration route change how topic 11's rules apply?**
No — it makes them apply *every day* rather than at publish time, which is its
main benefit. An internal package is consumed exactly as an npm package would
be.

**Where should `.d.ts.map` files go for a package that also publishes?**
Keep them for internal consumption, exclude them from the published tarball —
they reference source paths that will not exist on a consumer's disk.

---

← Prev: [01 · The question](./01-the-question-and-the-compilers-answer.md) · Next → [03 · The source route](./03-the-source-route.md)
