---
title: "Phase 13 — Complexity and JavaScript's real costs"
sidebar_label: "Overview"
sidebar_position: 0
---

:::caution Parked — 2026-08-14
⏸ **This phase is parked, not dropped.** On the user's instruction (*"Complexity and
JavaScript's real costs remove this one too"*), the unwritten topics are **out of the queue**
while the corpus stays on the **language** itself. They keep their syllabus rows and can be
resumed later.

The three written Master topics are unaffected. This parks the last of the DSA phases:
13, [14](../phase-14-data-structures/README.md) and
[15](../phase-15-algorithm-patterns/README.md) are **parked**;
[16](../phase-16-dynamic-programming/README.md) was **dropped**.
[17 · Machine coding](../phase-17-machine-coding/README.md) stays **in scope** — it implements
JavaScript's own library functions from scratch, which is language work, not algorithm practice.
:::

*10 topics.* Big-O first, then the part most courses skip: what the notation means once V8 is
underneath it.

## Status — **Master tier COMPLETE** (2026-08-14)

**Master tier first.** Phase 13 has **three** Master topics — 01, 02 and 03 — and **all three are
written**. The Understand and Know rows are deferred until the Master tiers of the remaining
phases are done.

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[Big-O notation](./01-big-o/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | **[The complexity classes you actually meet](./02-complexity-classes/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 03 | **[Choosing a structure from the operations you need](./03-choosing-a-structure/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 04–09 | Space complexity and the call stack, what a JavaScript array really is, `Object` vs `Map` performance, amortised analysis, recursion vs iteration in V8, measuring honestly | <span className="db-tier t-understand">Understand</span> | ⏸ **parked** |
| 10 | Stating a bound in an interview | <span className="db-tier t-know">Know</span> | ⏸ **parked** |

## The phase gate

From the syllabus: **you can explain why building a string with `+=` in a loop is fine in V8 but
concatenating arrays with spread in a loop is O(n²)**. Both halves are covered in
[01 · 02 · Reading a bound off the code](./01-big-o/02-reading-a-bound.md) — V8's internal
`ConsString` defers the copy for strings, while `[...acc, item]` genuinely copies the whole
accumulator on every iteration.

## How these pages are verified

**Documentation-validated.** Complexity results are definitional; JavaScript-specific claims are
checked against MDN and the specification requirement MDN quotes (notably that `Map` access is
required to be **sublinear**, not O(1)), and engine behaviour against the V8 blog. **No page
prints a timing**, because no benchmark was run — and a benchmark is exactly the kind of evidence
that is easy to get wrong.

## Where this connects

- [Phase 5 · The built-in library](../phase-5-built-in-library/README.md) — `sort`, `Map`, `Set`, and the array methods whose costs this phase counts
- [Phase 12 · 01 · DevTools](../phase-12-browser-platform/01-devtools/README.md) — the profiler that answers what Big-O cannot
- [Phase 0 · How JavaScript runs](../phase-0-how-javascript-runs/README.md) — the engine underneath the notation

---

Start → [01 · Big-O notation](./01-big-o/README.md)
