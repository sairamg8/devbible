---
title: "The failure catalogue"
sidebar_label: "05 · The failure catalogue"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — every diagnostic below is quoted from the compiler's own
> numbered message table in the installed **TypeScript 5.9.3** build, with the
> `composite`, `declaration` and `rootDir` behaviour from the **TSConfig
> reference**. **No sandbox, no console blocks** — no build was run and no output
> is reproduced.

Six failures, in rough order of how often they cost a day. Each one is a
consequence of a choice from chunks 02 and 03 rather than a bug, which is why
knowing which route you are on is the fastest diagnosis available.

## 1. 🔴 Stale `dist` — the big one

```text
TS6305: Output file '{0}' has not been built from source file '{1}'.
```

**What it means:** the compiler found a declaration file whose corresponding
source is newer, or whose output does not correspond to the source at all. It is
the compiler telling you plainly that you are checking against something out of
date.

⚠️ **The far worse case is when it does *not* fire.** `TS6305` needs the compiler
to be reasoning about a project reference. A plain `tsc -p ui` that resolves
`@org/shared` through `node_modules` to a stale `dist` has no idea `shared/src`
exists — so it checks happily against old declarations and reports nothing.

> **Silence is the dangerous outcome here, not the error.**

**The three mitigations, in increasing robustness:**

1. `tsc -b` over the solution, which rebuilds what is out of date before checking.
2. `tsc -b --watch` in the dev loop, so `dist` is never behind for long.
3. The source route ([chunk 03](./03-the-source-route.md)), on which there is no
   second artefact to be stale.

## 2. The package that was never built at all

Not a diagnostic — a resolution failure. `ui` imports `@org/shared`, the
workspace symlink resolves, `package.json` points `types` at
`./dist/index.d.ts`, and that file does not exist because nobody has built
`shared` in this checkout.

**Symptoms:** `TS2307` *"Cannot find module"*, or — if `main` resolves and
`types` does not — an untyped `any` with no error at all under
`noImplicitAny: false`.

📌 **The fresh-clone case is the one that matters**, because it is a new
contributor's first experience of the repo. A `postinstall` that builds the
packages, or a documented `npm run build` before anything else, is the whole fix.

## 3. `TS6304` — composite may not disable declaration emit

```text
TS6304: Composite projects may not disable declaration emit.
```

Reached by setting `composite: true` alongside `declaration: false` or
`noEmit: true`. As [chunk 02](./02-the-built-declaration-route.md) put it, this
is the compiler stating the built route as a rule: a project consumed through
project references *must* produce something to consume.

⚠️ **The common trigger is a shared base config with `noEmit: true`** — perfectly
reasonable for an application — inherited by a library package that then adds
`composite`. The fix is to override in the library, not to remove `composite`.

## 4. `TS6307` — the file that is not in the file list

```text
TS6307: File '{0}' is not listed within the file list of project '{1}'.
        Projects must list all files or use an 'include' pattern.
```

A composite project must be able to enumerate its inputs up front. A file reached
only through an import, from outside `files`/`include`, breaks that.

**Usual causes:** an `include` of `["src"]` with a file in `test/` importing into
it; a generated file written outside `src`; or an import reaching into a sibling
package's source without a project reference (which is
[chunk 03](./03-the-source-route.md)'s `paths`-to-`src` shape).

## 5. `TS6202` — the circular reference graph

```text
TS6202: Project references may not form a circular graph. Cycle detected: {0}
```

🔴 **This one is usually a design finding rather than a configuration bug.** If
`shared` needs something from `ui`, the two are not the packages you think they
are. The fixes, in order of preference:

1. **Extract the shared piece into a third package** that both depend on. Almost
   always correct.
2. **Move the type to the lower package.** Types often point the wrong way when
   an interface was defined where it was first used rather than where it is owned.
3. **Invert the dependency** — the higher package supplies an implementation of an
   interface the lower one declares.

📌 A type-only cycle *feels* harmless because types erase, but the reference graph
is a build-order graph and build order cannot be circular. `import type` does not
rescue it once the projects reference each other.

## 6. `TS6059` — outside `rootDir`

```text
TS6059: File '{0}' is not under 'rootDir' '{1}'. 'rootDir' is expected to
        contain all source files.
```

Covered in [chunk 03](./03-the-source-route.md): another package's source became
an input to this program without a project reference, so the output structure
mirrors a higher common ancestor. ⚠️ **`rootDirs` is not the fix** — its
description is about module *resolution* (*"Allow multiple folders to be treated
as one when resolving modules"*), not output layout.

## The diagnosis table

| Symptom | Most likely | Then check |
|---|---|---|
| Types are correct but old | Stale `dist` | Is anything in `src` newer than `dist`? |
| `TS2307` on an internal package | Never built | Does `dist` exist at all? |
| `any` with no error on an internal import | `types` missing, `main` resolved | The package's `types` field |
| `TS6304` | `composite` + inherited `noEmit` | The base config |
| `TS6307` | `include` too narrow | What actually imports the file |
| `TS6202` | Circular packages | Whether the type is owned in the right place |
| `TS6059` | Cross-package source without a reference | `paths`, and whether references exist |

🔴 **Two of these — the stale `dist` and the never-built package — account for
most of the time this topic costs**, and both are removed entirely by the source
route or by a watch build. That is the trade [chunk 06](./06-choosing.md) turns
into a decision.

## Gotchas

**Symptom:** `TS6305` in a build that used to be fine.
**Cause:** Source moved ahead of its declarations.
**Fix:** `tsc -b`, which rebuilds before checking.

**Symptom:** No error at all, and the types are visibly out of date.
**Cause:** Plain `tsc -p` with no project reference — nothing knows the source
exists.
**Fix:** This silence is worse than `TS6305`. Add references, or move to the
source route.

**Symptom:** A fresh clone cannot type-check anything.
**Cause:** No package has been built, so no `dist` exists.
**Fix:** A `postinstall` build, or a documented first command.

**Symptom:** `TS6304` after adding `composite` to a library.
**Cause:** An inherited `noEmit: true` from a base config written for apps.
**Fix:** Override it in the library. Do not remove `composite`.

**Symptom:** `TS6307` naming a test file.
**Cause:** `include: ["src"]` while a test imports across the boundary.
**Fix:** Widen `include`, or give tests their own project.

**Symptom:** `TS6202` on a type-only import.
**Cause:** The reference graph is a build-order graph regardless of erasure.
**Fix:** Extract to a third package. `import type` does not break the cycle.

**Symptom:** `TS6059` after adding a cross-package alias.
**Cause:** Another package's files became inputs to this program.
**Fix:** Project references. Not `rootDirs`.

**Symptom:** An internal package silently resolves to `any`.
**Cause:** `main` resolved and `types` did not — so there was a module, just no
types.
**Fix:** Check the `types` field and whether `dist/index.d.ts` exists.
`noImplicitAny` makes this loud instead of silent.

## Interview questions

**★ What does `TS6305` mean, and why is its absence more dangerous than its
presence?**
*"Output file has not been built from source file"* — you are checking against
declarations older than their source. It requires the compiler to be reasoning
about a project reference; a plain `tsc -p` resolving through `node_modules` to a
stale `dist` reports nothing at all and checks happily against old types.

**★ Why can't a monorepo have circular project references, even for types only?**
Because the reference graph is a build-order graph, and build order cannot be
circular — `TS6202`. Erasure is irrelevant. The fix is normally to extract the
shared piece into a third package, or to notice the type is owned in the wrong
place.

**★ You add `composite: true` to a library and get `TS6304`. What happened?**
The project disables declaration emit — usually `noEmit: true` inherited from a
base config written for applications. A composite project must produce
declarations, so the fix is to override in the library rather than drop
`composite`.

**★ An internal package's import silently becomes `any`. What is the likely
cause?**
`main` resolved and `types` did not — the module exists but its declarations do
not, typically because the package has never been built or its `types` field
points somewhere absent. `noImplicitAny` turns the silence into an error.

**What does `TS6307` protect?**
The property that a composite project's inputs are enumerable up front, which is
what makes build order computable. A file reached only through an import from
outside `include` breaks it.

**Which two failures account for most of the time this topic costs?**
A stale `dist` and a package that was never built. Both disappear entirely on the
source route, and both are largely removed by a watch build on the built route.

**What is the right response to `TS6059` in a monorepo?**
Project references, so the other package is a separate program with its own
`rootDir`. `rootDirs` is about module resolution, not output structure, and is
the common wrong turn.

---

← Prev: [04 · Editor versus build](./04-editor-versus-build.md) · Next → [06 · Choosing](./06-choosing.md)
