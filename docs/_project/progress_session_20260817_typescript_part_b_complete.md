---
name: devbible-session-20260817-typescript-part-b-complete
description: Session c01e37bb — TypeScript Part B closed and TypeScript finished at 136/136. Phase 10 (topics 11-13) and the whole of phase 12 written in one session; carries the rule-1 measurement, the compiler-source finds, and the duplication check that became standard
metadata:
  type: progress
---

# Session `c01e37bb`, 2026-08-17 — **TypeScript Part B CLOSED, TypeScript COMPLETE**

Started on *"pick ts b"*. Took the lane over from `ede9cd9f` with phase 10 at 9/13
and phase 12 not started.

## What it delivered

| | Topics | Shape |
|---|---|---|
| **Phase 10** | 11, 12, 13 | closed the phase **13/13** |
| **Phase 12** | **all 15** | directory created from nothing → **15/15**, 33 files, **5,126 lines** |

🏁 **TypeScript moved 102 → 136 of 136 in-scope topics** (419 files) while three
other lanes wrote in the same checkout.

## 🔴 The rule-1 measurement, because the user asked for it twice

Topic 11 was **planned as 7 chunks and finished at 10.** The evidence that the cap
never became a content budget:

> **Chunk 06 drafted at 329 lines and was SPLIT, not trimmed — and the two halves
> came to 459 together.**

**The split ADDED 130 lines** (the `Number.isFinite` vs global `isFinite` trap, the
green-suite-proves-nothing gotcha, the two-rules-conflict gotcha, four extra
interview questions) — **material that trimming 329 down to 300 would have cost.**
Final spread across everything written: **155–294**, and **0 files over the cap
across the entire technology** at the close.

📌 **A "final" chunk list in a resume point is the same defect as a file-count
prediction.** The previous cursor called the 7-chunk layout final; that is a
content budget in a different disguise. **Write the list as provisional or not at
all.**

## 🔴 Finds read from the compiler, not recalled

1. **`TS8013` is the ONLY diagnostic mentioning non-null assertions — and it is
   about file extensions.** Nothing anywhere questions whether a `!` is justified.
   With `TS1360` (satisfies is verified) and `TS2352` (`as` is accepted unless types
   barely overlap) that gives a three-way ranking by oversight — **and the ordering
   is the reverse of the effort to type them.**
2. **The `skipLibCheck` predicate** (`typescript.js` ~22820) is gated on **nothing
   but `isDeclarationFile`** — so it skips your own declarations — **and sits in an
   OR chain with `isSourceOfProjectReferenceRedirect`**, so project references skip
   through the *same* code and their savings **overlap rather than stack**.
3. **The 4xxx range exists only in the declaration-emit path**, so a green
   `--noEmit` and a failing declaration build are consistent — and all of them are
   one problem: **the compiler must produce a NAME for every type in the public
   surface**, which your own source never requires.
4. **`TS2395`** is the only merged-declaration diagnostic and checks *export
   consistency*, so the class↔interface merge that type-checks and throws has **no
   compiler check at all**.
5. **`TS2356` lists `'any'` FIRST** among accepted arithmetic operands — the hole
   `no-unsafe-unary-minus` closes.
6. **`skipLibCheck` is one of the four `tsc --init` defaults**, so the live question
   is whether to turn it **off**.
7. **`--generateTrace` emits "an event trace *and a list of types*"** — the type
   list is the half that names the culprit — and **`--generateCpuProfile` exists**
   and is not in the syllabus.
8. **The `no-unsafe-*` rules are TEN, not nine, and the prefix is not a family:**
   five track `any` and only work as a set, five are unrelated checks.

## 🔴 The duplication check that became standard

**Topic 12 nearly duplicated phase 2**, which already owns assertion *mechanics* in
four topics. The fix — an explicit **"what this topic does not repeat"** table, and
the rule *phase 2 owns the mechanism, phase 10 owns the discipline* — was then run
**before every subsequent topic**, and it changed what topics 11, 13 and 14 of phase
12 were about. ⚠️ **Do this first, every time, in a corpus this size.**

## ⚠️ Two operational facts

- **A cross-lane staging collision, the fourth recorded.** Lane A's `git add -A`
  committed my `07-editor-performance.md` inside their phase-5 commit `1a94dfd4`.
  **Nothing lost** — `git show HEAD:<path>` diffs identical. 📌 **Detect it by a
  commit reporting fewer files than you staged**; do not re-commit.
- **`docs/README.md`'s TypeScript row moved under me on nearly every topic close.**
  It was **recomputed from `progress.js` and `find` and merged forward** every time,
  never incremented.

## ⚠️ One number to reconcile, deliberately not shipped

My grep counted **111** unique 4xxx codes; the shipped census on
`phase-10-strictness/10-the-error-codes/01-what-a-code-is.md` says **110**.
**Phase 12 topic 11 therefore links that page for the total instead of restating
it**, and uses only the two sub-counts measured here (**46** *"private name"*, **15**
*"cannot be named"*). 🔴 **Do not align one page to the other without re-counting
both by the same method.**

Related: [[devbible-typescript-part-b]] · [[devbible-typescript-split-4way]] ·
[[devbible-typescript-concepts-phase10]] · [[devbible-never-compress-to-fit-cap]]
