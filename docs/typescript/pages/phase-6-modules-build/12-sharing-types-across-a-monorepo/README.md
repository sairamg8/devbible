---
title: "Sharing types across a monorepo"
sidebar_label: "12 · Sharing types across a monorepo"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TSConfig reference** (`composite`,
> `declaration`, `declarationMap`, `rootDir`, `rootDirs`, the `disable*` project
> options) with every option record, description string and diagnostic message
> read out of the compiler's own tables in the installed **TypeScript 5.9.3**
> build rather than recalled. **No sandbox, no console blocks** — and **no
> build-time figure is claimed anywhere in this topic**, because none was
> measured.

## The one-sentence version

> **When one package is type-checked, is its dependency represented by `.ts`
> source or by built `.d.ts`?** Everything else in a monorepo's type behaviour —
> including every "works in my editor, fails in CI" report — follows from that
> question and from answering it inconsistently.

## Four sentences worth keeping

1. 🔴 **The compiler already has an opinion.**
   `disableSourceOfProjectReferenceRedirect` is described as *"disable
   **preferring source files** instead of declaration files"* — so with project
   references, **preferring source is the default**, and most teams running
   `tsc -b` do not know that is the route they are on.
2. **The check and the emit take different routes on purpose.** The check uses
   source; the emitted declaration references the referenced project's
   `outputDts`. Good design — and the two halves disagree when `dist` is stale.
3. **`TS6305`'s absence is more dangerous than its presence.** A plain `tsc -p`
   resolving through `node_modules` to a stale `dist` reports nothing at all.
4. **`declarationMap: true` is what makes the built route bearable.** Without it,
   go-to-definition lands in generated files — the ergonomic failure that drives
   teams back to source imports.

## Chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [The question](./01-the-question-and-the-compilers-answer.md) | Source vs built `.d.ts`, and the redirect that shows the compiler's default |
| 02 | [The built-declaration route](./02-the-built-declaration-route.md) | Real boundaries, `composite`'s two enforced constraints, `declarationMap` |
| 03 | [The source route](./03-the-source-route.md) | Three ways to reach it, only one supported; cross-package refactors; `TS6059` |
| 04 | [Editor versus build](./04-editor-versus-build.md) | The four causes of divergence, and how to tell them apart fast |
| 05 | [The failure catalogue](./05-the-failure-catalogue.md) | Six failures with the compiler's own message text, in cost order |
| 06 | [Choosing](./06-choosing.md) | The recommendation, and a migration order that keeps the repo buildable |

## 🔴 The compiler behaviours this topic settles

Each read from the 5.9.3 build; none stated in the handbook's prose:

1. **Project references prefer source over declarations by default** — provable
   from the name and description of the option that disables it (chunk 01).
2. **The emitter substitutes `outputDts` for a redirected source file**, so the
   check and the emit deliberately take different routes (chunk 01).
3. **`isSourceOfProjectReferenceRedirect` is a clause in the skip predicate** —
   the same one `skipLibCheck` lives in, which is why a referenced project's
   files are not checked by its consumer ([topic 10 chunk 01](../10-skiplibcheck/01-what-it-actually-skips.md)).
4. **`composite` enforces two constraints by diagnostic** — `TS6304` (may not
   disable declaration emit) and `TS6307` (must enumerate files) (chunk 02).
5. **`rootDirs` is about module resolution, not output structure**, so it is the
   wrong answer to `TS6059` (chunks 03 and 05).
6. **Two options exist to make the editor deliberately less informed than the
   build** — `disableSolutionSearching` and `disableReferencedProjectLoad` — so
   divergence can be a configured outcome (chunk 04).

## The recommendation

```
project references throughout
  + redirect left at its default        → source route in the dev loop
  + declarationMap: true everywhere     → navigation lands on real code
  + one CI job emitting declarations    → the built route's guarantees
    and running topic 11's checks         enforced by a job, not by memory
```

## Where this connects

- **← [Topic 03 · Path aliases](../03-path-aliases/README.md)** — owns the alias
  decision and the `paths`-to-another-package's-`src` anti-pattern. This topic
  assumes that argument and owns what your types then mean.
- **← [Topic 10 · `skipLibCheck`](../10-skiplibcheck/README.md)** — its
  [chunk 02](../10-skiplibcheck/02-it-skips-your-declarations-too.md) already
  notes that a package consuming another's built `dist/*.d.ts` is consuming a
  *declaration file*, so the root `skipLibCheck` covers it. That is one more
  reason a monorepo's editor and build disagree.
- **← [Topic 11 · Publishing a typed package](../11-publishing-a-typed-package/README.md)**
  — on the built route, internal packages are consumed exactly as published ones,
  so every rule there applies daily instead of at release.
- **→ 13 · Project references and `tsc -b`** *(not written yet)* — this topic
  *uses* references; that one explains them.
- **→ 14 · Incremental builds** *(not written yet)* — `composite` implies
  `incremental`, so every package writes a `.tsbuildinfo`.
- **→ Phase 12 · Tooling, performance and testing** *(not written yet)* — the
  build-time comparison this topic deliberately does not make.

---

← [Phase 6 index](../README.md) · Start → [01 · The question](./01-the-question-and-the-compilers-answer.md)
