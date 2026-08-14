---
title: "Phase 16 — Dynamic programming and the harder set"
sidebar_label: "Overview"
sidebar_position: 0
---

:::danger Dropped from scope — 2026-08-14
🚫 **This phase is dropped.** On the user's instruction (*"Dynamic programming and the harder
set — Drop Completly"*), topics **04–16 will not be written**. The corpus is refocused on the
**language** rather than interview algorithm practice.

**The three written Master topics (01–03) stay** — they are finished, verified and build-clean,
and dropping the phase does not mean deleting work already done (*"incase of if any already
developed … let it be"*). Phase 16 counts as **3 of 3 in scope**, not 3 of 16.
:::

*16 topics.* DP gets its own phase because it is the pattern people bounce off, and because the
top-down → bottom-up conversion is mechanical once seen.

## Status — **Master tier COMPLETE** (2026-08-14)

**Master tier first.** Phase 16 has **three** Master topics — 01, 02 and 03 — and **all three are
written**. The Understand and Know rows are deferred until the Master tiers of the remaining
phases are done.

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[What DP is](./01-what-dp-is/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | **[Memoization, top-down](./02-memoization/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 03 | **[A problem-solving method](./03-problem-solving-method/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| ~~04–13~~ | ~~Tabulation, 1-D and 2-D DP, state design, space optimisation, DP on strings, monotonic stack and queue, top-K and streaming, randomised algorithms, async-flavoured problems~~ | <span className="db-tier t-understand">Understand</span> | 🚫 **dropped** |
| ~~14–16~~ | ~~DP on trees and graphs, matrix and simulation problems, recognising NP-hardness~~ | <span className="db-tier t-know">Know</span> | 🚫 **dropped** |

## The phase gate

From the syllabus: **you can solve coin change top-down, convert it to bottom-up without looking,
and state both complexities.** All three parts are covered —
[02 · 01](./02-memoization/01-the-transformation.md) has the top-down version,
[02 · 02](./02-memoization/02-keys-and-conversion.md) the four-step conversion, and
[03 · 02](./03-problem-solving-method/02-a-worked-run.md) the whole run end to end with the
complexity and its limits.

## How these pages are verified

**Documentation-validated.** The algorithmic results are standard; every JavaScript-specific claim
is checked against MDN — `Map` key semantics, `Infinity` arithmetic, 32-bit bitwise coercion,
`MAX_SAFE_INTEGER`, and the call-stack limit. **No page prints a timing.**

## Where this connects

- [Phase 15 · Algorithmic patterns](../phase-15-algorithm-patterns/README.md) — the shortlist DP is chosen from
- [Phase 14 · Core data structures](../phase-14-data-structures/README.md) — the caches and stacks underneath
- [Phase 13 · Complexity and JavaScript's real costs](../phase-13-complexity/README.md) — the memoisation test, and what "pseudo-polynomial" means

---

Start → [01 · What DP is](./01-what-dp-is/README.md)
