---
name: devbible-typescript-concepts-phase5
description: TypeScript phase 5 (type-level programming) — every load-bearing claim with its source, so a later session can review or reuse without re-reading the 65 pages
metadata:
  type: reference
---

# TypeScript · Phase 5 — Type-level programming, the concept record

✅ **COMPLETE 2026-08-17 — 16 topics, 65 files, 14,031 lines, 64–295 per file, 0 over the
300-line cap, 694 links resolving, 0 broken.** Lane A, sessions `bbd2d39d` → `8b70b2f9` →
`65de22b3`.

⚠️ **Evidence rule for the whole phase: no sandbox, no console blocks, no timings.** Claims
are validated against the handbook and release notes, or **read out of the compiler's own
source** — `sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`, **TypeScript 5.9.3**.
🔴 **Every constant below is 5.9.3's and is explicitly NOT claimed for the 7.0.2 Go port**;
each page says so where it quotes one.

## 🔴 The compiler-source finds — this is the reusable asset

Nine things in this phase came from reading the checker rather than the docs. None of them is
documented anywhere else, and several contradict common advice.

| Find | Where in 5.9.3 | Why it matters |
|---|---|---|
| `TS2589` guard is `instantiationDepth === 100 \|\| instantiationCount >= 5e6` | `instantiateTypeWithAlias` | **Two failures, one message** — so "add a depth cap" is a coin flip |
| `relationCount = (16e6 − relation.size) >> 3` | `checkTypeRelatedTo` | **The comparison budget SHRINKS as the project fills the relation cache** — the real explanation for *"it compiles in the playground and fails in the repo"* |
| `TS2321` vs `TS2859` chosen by `relationCount <= 0` | same `overflow` flag | Two codes, one condition |
| `isNonGenericTopLevelType` quits at a function body | instantiation early-out | **A `type` alias inside a function is not eligible** — hoist aliases to module top level |
| `getConditionalType` is a `while (true)` **loop** with `tailCount === 1e3` | `getConditionalType` | **TWO recursion ceilings an order of magnitude apart** — 100 nested, 1,000 tail |
| `tailCount++` only fires `if (newRoot.aliasSymbol)` | same loop | **An anonymous tail call is not counted** — third independent reason to name helper types |
| Distribution **bails out** of that loop | same loop | `[T] extends [[…]]` is a *performance* tool as well as a correctness one |
| `elements.length + expandedTypes.length >= 1e4` → `TS2799`/`TS2800` | `createNormalizedTupleType` | 🔴 **A THIRD ceiling, not about recursion at all** — 10,000 tuple elements, checked **at the spread** |
| `instantiateConstituent` returns non-object constituents via a bare `return t` | `instantiateMappedType` | 🔴 **A homomorphic mapped type NEVER maps a primitive** — the `T extends object` guard everyone writes is unnecessary for the reason always given |
| `resolveMappedTypeMembers` sets call/construct signature lists to `emptyArray` and never refills | `resolveMappedTypeMembers` | 🔴 **A mapped type structurally cannot carry a call signature** — that is why deep helpers destroy methods |

## Diagnostics quoted in this phase, with what each actually means

`TS2589` (two guards) · `TS2321` / `TS2859` (**distinct** — stack depth vs complexity) ·
`TS2590` (**no type-position variant exists**, so *"Expression produces a union type…"* can
appear where there is no expression) · `TS2799` / `TS2800` (tuple > 10,000, type vs expression
position) · `TS2574` (unconstrained accumulator at a spread) · `TS2615` (circular in a mapped
type) · `TS2456` (circular alias) · **`TS2313`** (circular constraint) · **`TS2716`** (circular
default — ⚠️ **the depth-cap construction itself causes this one**) · `TS7056` · `TS2344` ·
`TS2769` / `TS2772` / `TS2770`.

⚠️ **`TS2313` and `TS2716` were new to this corpus** and came from topic 11 chunk 05.

## Per-topic, what each settles

| # | Topic | Files | The claim worth keeping |
|---|---|---|---|
| 01 | Mapped types | 5 | Homomorphic = `[K in keyof T]` over a type parameter, and it buys **three** things (2.8 + 3.1 notes): modifier preservation, array/tuple preservation, union distribution |
| 02 | Conditional types | 5 | The assignability question it actually asks |
| 03 | The utility types | 6 | Which are mapped and which conditional, so you can write the missing one |
| 04 | Key remapping | 1 | `as` **breaks homomorphism**, so modifiers stop being preserved |
| 05 | Distributive conditionals | 1 | The bracket form, introduced for correctness |
| 06 | `infer` | 3 | Pattern matching, and writing your own extractor |
| 07 | Template literal types | 1 | Typed event names and routes |
| 08 | **Knowing when to stop** | 11 | The phase's spine. **The checker reports on the type you produced, not the program that produced it** — there is no diagnostic for "the third branch did not match". Seven stopping tests; six cases that earn it |
| 09 | Type-level performance | 4 | The **three budgets**, read from the checker. Seven slow shapes ranked **by budget consumed, not by seconds** |
| 10 | Deriving function types | 3 | 🔴 **Infer the parameter tuple, do not extract it.** `Parameters<typeof f>` sees only the **last** overload; the return-position half of that collapse type-checks and is untrue |
| 11 | Recursive types | 5 | **Three ceilings.** The accumulator conversion in the 4.5 notes' own words; order-safe for unions, order-changing for tuples and strings |
| 12 | `DeepPartial` / `DeepReadonly` | 5 | The unnecessary guard; the impossible call signature; 🔴 **`DeepReadonly` should NOT have an array branch and `DeepPartial` MUST** |
| 13 | Tuple manipulation | 5 | **Spread preserves structure, rebuilding from indexed access destroys it.** Positions before an unbounded spread survive; after it, they do not |
| 14 | `NoInfer<T>` | 1 | **Nothing goes wrong in the failing case** — two positions means two inference sites. Mark the consumers, never the source |
| 15 | The identities | 1 | **Union → intersection is contravariance applied deliberately.** Recognition, not recipe |
| 16 | Higher-kinded types | 1 | No type constructors; defunctionalisation encodes **application as an indexed access**, at five stated costs |

## The five sentences that carry the phase

1. **A clever type that produces an unreadable error message is a net loss** (topic 08, and
   every topic after it defers to this).
2. **The checker reports on the type you produced, not on the program that produced it.**
3. **`TS2589` is two failures with one message**, and the comparison budget shrinks as the
   project grows.
4. **Spread preserves structure; rebuilding destroys it** — labels, `?` and rest elements
   belong to positions, not to types.
5. **Recursion over an object fans out**, so it has no tail call to convert and no accumulator
   to write.

## ⚠️ Traps confirmed in this phase — check these on any later edit

- 🔴 **`docs/README.md`: an unescaped `|` inside a code span still splits a GFM table cell**,
  which unbalances the backticks for the rest of the row and makes the next `<=` or `<Foo>`
  parse as JSX. **14 pipes** had to be escaped across three lanes' rows at the phase close.
  Anyone writing `||`, `A | B` or `T[number]` into a claims row must write `\|`.
- **A flat `NN-topic.md` in a phase directory links to a topic directory as `./NN-…/README.md`,
  not `../`.** Caught by the link check at the topic-13 close.
- 🔴 **Repoint forward references at the PHASE close, not only per topic.** Six more stale
  markers surfaced at this close, three of whose targets had landed long before — including
  **intra-topic footers left stale by an earlier session**. They are plain text, so a link
  check cannot see them: `grep -rn "not written yet" docs/typescript/pages/phase-N-*/`.
- **Shared-file edits must assert their match count.** `docs/README.md`'s TypeScript row moved
  between read and write once during this session; the assertion caught it and the fix was to
  re-read and keep the other lane's recomputed counts.

## Not fetched, if a later phase needs them

Fetched and quoted in this phase: **2.1, 2.8, 3.1, 4.0, 4.1, 4.5, 4.7, 4.8, 5.4** release
notes; handbook *Mapped Types*, *Conditional Types*, *Utility Types*, *Template Literal
Types*, *Declaration Files → Do's and Don'ts*; the wiki *Performance* page.

Related: [[devbible-typescript-build-progress]] · [[devbible-typescript-split-4way]] ·
[[devbible-never-compress-to-fit-cap]] · [[devbible-no-new-sandbox-scripts]]
