---
title: "The two pipeline shapes"
sidebar_label: "02 · The two shapes"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **`tsconfig` reference** for `noEmit`,
> `emitDeclarationOnly`, `declaration`, `outDir` and `rootDir`, and the **esbuild**,
> **swc**, **Rollup** and **Vite** documentation. ⚠️ **What ships in the package and
> how consumers resolve it is phase 6 · 11's** — this page stops at the build.
> **No timing figure is ours. No console block.**

[Chunk 01](./01-four-jobs-not-one.md) separated the four jobs. In practice they
combine into **two shapes**, and knowing which one you are in answers most
configuration questions before they are asked.

## Shape 1 · The application

**Nobody consumes your types, so nothing needs declarations.**

| Job | Who |
|---|---|
| Transform + bundle | the bundler (Vite, esbuild, Rollup, whatever ships the app) |
| Check | 🔴 **`tsc --noEmit`, as a separate step** |
| Declarations | ⛔ not produced, and not needed |

**The whole shape is one sentence: the bundler builds, `tsc` checks, and they never
talk to each other.** They read the same `tsconfig.json` for *settings*, but neither
consumes the other's output — which is why the check can be a parallel CI job
([topic 01 · chunk 03](../01-type-checking-in-ci/03-where-the-gate-goes.md)).

📌 **`noEmit` is doing something specific here**, and it is worth being precise
about: it does not make the check cheaper — the checking is the expensive part
([chunk 01](./01-four-jobs-not-one.md)) — it stops `tsc` writing output that would
collide with the bundler's. **It is about ownership of the output directory, not
about speed.**

## Shape 2 · The library

**Someone consumes your types, so declarations are a deliverable.**

| Job | Who |
|---|---|
| Transform + bundle the JavaScript | the bundler |
| 🔴 Emit declarations | **`tsc --emitDeclarationOnly`** — nothing else can |
| Check | ⚠️ **the declaration emit already did it** |

🔴 **That last row is the shape's one real insight, and it saves a whole run.**
Declaration emit needs inferred return types, so it type-checks on the way through
([chunk 01](./01-four-jobs-not-one.md)). **A library that runs
`tsc --emitDeclarationOnly` does not need a separate `tsc --noEmit` — it has
already checked.**

⚠️ **With two conditions, both easy to get wrong:**

1. **The declaration build must cover the same program as the check would have.** If
   it is pointed at a narrower config — only `src`, excluding tests — then your gate
   just got narrower too, and that is
   [topic 01 · chunk 02](../01-type-checking-in-ci/02-what-the-gate-guarantees.md)'s
   coverage question arriving through the build config.
2. **It must fail the pipeline.** A declaration step whose exit code is ignored
   because "the types still got written" is not a gate.

📌 **Where a library does still want both:** when the declaration build is scoped to
the published surface deliberately, and tests and scripts need checking too. **Then
you have two runs, and you should know that is what you are paying for** rather than
discovering it.

## The output layout, and the one setting that decides it

Both shapes eventually have to answer: where does the compiler put things, and does
it collide with the bundler?

- **`outDir`** — where emitted files go. In shape 1, ⚠️ **it is the flag that matters
  even though nothing is emitted**, because a misconfigured `noEmit` project that
  later turns emit on writes into the bundler's directory.
- **`rootDir`** — 🔴 **the one that surprises people**: it decides the *shape* of the
  output tree, and it is inferred from the common root of the input files. **So
  adding a single file outside `src/` silently re-roots every emitted path**, which
  in shape 2 changes where your declarations land relative to your JavaScript, and
  breaks consumers rather than the build.

⚠️ **That failure has the worst possible signature: the build stays green and the
package is wrong.** It is the strongest argument for the release-path validation
that **phase 6 · 11 · Publishing a typed package** covers — testing the package as a
consumer sees it, rather than trusting that the build succeeded.

## Choosing, in one question

> **Does anything outside this repository import from it?**
>
> **No** → shape 1. Bundler builds, `tsc --noEmit` checks.
> **Yes** → shape 2. Bundler builds the JavaScript, `tsc --emitDeclarationOnly`
> produces the types *and* does your checking.

📌 **A monorepo package is "yes" even though it never reaches a registry** — its
consumers are other packages, and how they consume it is exactly what phase 6 · 12
is about. **Internal packages are libraries; the only thing they skip is publishing.**

## Gotchas

**Symptom:** a library runs `tsc --noEmit` and `tsc --emitDeclarationOnly` as two CI
steps.
**Cause:** the two were treated as different jobs.
**Fix:** 🔴 the declaration build already type-checked. Keep one, and make sure its
exit code fails the pipeline. ⚠️ Only keep both if the declaration build is
deliberately narrower — and then know you are paying for two.

**Symptom:** the declaration step "passes" while reporting errors.
**Cause:** its exit code is being ignored because the `.d.ts` files were still
written.
**Fix:** it is your gate in shape 2. If it does not fail the build, you have the
untested-gate problem from
[topic 01 · chunk 02](../01-type-checking-in-ci/02-what-the-gate-guarantees.md).

**Symptom:** declarations land one directory deeper than expected after adding a
file.
**Cause:** `rootDir` is inferred from the common root of the inputs, and the new file
moved it.
**Fix:** 🔴 set `rootDir` explicitly. And note the build did not fail — this is a
green build that produces a wrong package.

**Symptom:** the bundler's output directory has stray `.js` files from the compiler.
**Cause:** `noEmit` was removed or overridden, and `outDir` points at the bundler's
directory.
**Fix:** give the compiler its own `outDir` even when it emits nothing. ⚠️ It costs
one line and removes an entire class of confusing collisions.

**Symptom:** an internal monorepo package is set up as shape 1 and other packages
cannot see its types.
**Cause:** it is a library — its consumers are just in the same repository.
**Fix:** shape 2. The only thing internal packages skip is publishing, and how they
are consumed is phase 6 · 12's subject.

**Symptom:** the app's check and the app's build disagree about a setting.
**Cause:** the bundler was configured independently of `tsconfig.json`, which is the
subject of chunk 03.
**Fix:** ⚠️ they must agree on the settings that change meaning — not just on the
ones that change output.

## Interview questions

**What are the two pipeline shapes?**
The application, where nothing consumes your types: the bundler transforms and
bundles, `tsc --noEmit` checks, and the two never exchange output. And the library,
where declarations are a deliverable: the bundler produces the JavaScript and
`tsc --emitDeclarationOnly` produces the types.

**In a library, do you need a separate `tsc --noEmit`?**
Usually not — declaration emit needs inferred return types, so it type-checks on the
way through. The conditions are that the declaration build covers the same program a
check would have, and that its exit code actually fails the pipeline. If the
declaration build is deliberately scoped to the published surface, then you do want
both, and you should know that is what you are paying for.

**What is `noEmit` actually doing in an app build?**
Stopping the compiler writing output that would collide with the bundler's. It is
about ownership of the output directory, not about speed — the checking is the
expensive part, and `noEmit` does not reduce it.

**What is the trap with `rootDir`?**
It is inferred from the common root of the input files, so adding one file outside
`src/` silently re-roots the whole output tree. In a library that changes where
declarations land relative to the JavaScript and breaks consumers — while the build
stays green. Set it explicitly, and validate the package as a consumer sees it.

**Is an internal monorepo package an app or a library?**
A library. Its consumers are other packages rather than strangers, but they still
import from it, so it needs declarations. The only thing it skips is publishing —
which is why "do we publish this?" is the wrong question and "does anything outside
this directory import from it?" is the right one.

---

← [01 · Four jobs, not one](./01-four-jobs-not-one.md) · [Topic index](./README.md) · Next → **03 · Making two tools agree** *(not written yet)*
