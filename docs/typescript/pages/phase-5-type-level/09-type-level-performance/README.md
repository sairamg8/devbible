---
title: "Type-level performance"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08. 🔴 **Every limit in this topic was read out of the compiler's own source**
> — **TypeScript 5.9.3**, `sandbox/ts-p0/node_modules/typescript5/lib/typescript.js` — rather
> than recalled: the `TS2589` guard in `instantiateTypeWithAlias`, the `overflow` block in
> `checkTypeRelatedTo` that picks between `TS2321` and `TS2859`, both `TS2590` sites, the
> `couldContainTypeVariables` early-out and `isNonGenericTopLevelType`. Diagnostic wording comes
> from the same file's numbered table and every string was confirmed present in the installed
> **TypeScript 7.0.2** native compiler. The four quotations are from the **TypeScript wiki,
> *Performance***, verbatim. ⚠️ **The numeric constants belong to 5.9.3 and are not claimed for
> the 7.0.2 Go port** — only the *shape* of each limit transfers. **No sandbox, no console
> block, and no timings anywhere in this topic**: nothing was run on this machine, so nothing is
> ranked by seconds.

Type-level programming is a program the compiler runs on every keystroke, and it fails by
**giving up** — with a message that names no branch, no line of your type, and no cause.

This topic makes that legible. Not by benchmarking, which would need a sandbox this corpus no
longer builds, but by reading **what the checker actually counts** and which diagnostic each
counter produces when it runs out.

| # | Chunk | What it settles |
|---|---|---|
| 01 | [The three budgets](./01-the-three-budgets.md) | Instantiation, comparison and union size — the exact guard conditions, and 🔴 why the comparison budget **shrinks as your project grows** |
| 02 | [Caching, and why naming is a performance fix](./02-caching-and-naming.md) | The early-out, the per-mapper instantiation cache, the relation cache — and 🔴 why a `type` alias inside a function body is not eligible for the cheapest one |
| 03 | [What actually makes a codebase slow](./03-what-makes-it-slow.md) | Seven shapes ranked by the budget they burn, worst first — and the editor's separate per-keystroke bill |
| 04 | [The fixes, in order](./04-the-fixes-in-order.md) | Budget → fix, then the seven steps, everything defensible without a measurement first |

## The one-sentence version

**Six failures share two messages, so read the diagnostic to find out which budget ran out
before choosing a fix.**

## The five sentences to keep

1. **`TS2589` is two failures with one message** — `instantiationDepth === 100` (cap the
   recursion) or `instantiationCount >= 5e6` (do less work). That is why "I added a depth cap and
   it still fails" happens.
2. 🔴 **`TS2859` and `TS2321` are different diagnostics with opposite fixes.** Both come from
   one `overflow` flag; the message is chosen by whether the *comparison budget* or the *depth
   counter* ran out.
3. 🔴 **The comparison budget is `(16e6 − relation.size) >> 3`** — sixteen million minus the
   relation cache, divided by eight. **It shrinks as the project fills that cache**, which is the
   real answer to *"it compiles in the playground and fails in the repo"*.
4. **Naming a type is a caching change, not a style change.** The early-out needs the
   `aliasSymbol`; the instantiation cache key is built from it. Declare the alias at module top
   level, because the ancestor walk quits at a function body.
5. **Union reduction is quadratic and cross products multiply** — so the widest union on the
   path is where the largest win is, and the arithmetic tells you before you refactor.

## Where this connects

- **← [08 · Knowing when to stop](../08-knowing-when-to-stop/README.md)** — the readability
  argument. This topic is its compile-time counterpart, and the two agree at every point:
  named, flat, narrow types print better *and* check faster.
- **← [05 · Distributive conditional types](../05-distributive-conditionals.md)** — where a
  union you did not write comes from.
- **← [07 · Template literal types](../07-template-literal-types.md)** — the cross product,
  and `TS2590` as arithmetic rather than bad luck.
- **← [01 · Mapped types · chunk 04](../01-mapped-types/04-limits.md)** — the limits page that
  forward-referenced this topic for `TS2589`.
- **→ 11 · Recursive types** *(not written yet)* — the depth-cap construction this topic
  defers.
- **→ Phase 12 · Tooling, performance and testing** *(not written yet)* — `--extendedDiagnostics`,
  `--generateTrace`, `incremental` and project references. **Measurement lives there; this topic
  is about what to look for and what it will cost you to fix.**

---

← [Phase 5 index](../README.md) · Next → [01 · The three budgets](./01-the-three-budgets.md)
