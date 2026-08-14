---
title: "03 · A problem-solving method"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — method material; JavaScript specifics against MDN ([`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER), [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Infinity`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Infinity)). Documentation-validated; **no timings**.

**The method is the thing being assessed**, not the algorithm. Someone who jumps to code tells an
interviewer nothing about how they would handle an unfamiliar problem — which is the actual
question being asked.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The loop to run under pressure](./01-the-loop.md)** | The seven steps, and 🔴 **why the first four decide the outcome**; the clarifying questions that change the answer, with ⚠️ **"how large is n?" as the highest-value one** because it turns optimisation into arithmetic; why examples must be written **before** any code; stating the brute force even when you will not write it — it is the fallback **and the input to the optimisation**; a signal→pattern table plus 🔴 **saying why the near-misses do not fit**; the three transformations that solve most problems; tracing your own code, including a **JavaScript-specific bug pass**; and volunteering the trade you did not take |
| 2 | **[A worked run](./02-a-worked-run.md)** | The same seven steps on coin change, written as it would be **said out loud** — three clarifying answers that changed the solution; 🔴 **an example chosen specifically to disprove greedy**; the brute force producing the state; **a near-miss (BFS) named and dismissed with a reason**; a full hand trace that confirms the `amount = 0` path depends on a line outside the loop; and a complexity statement that names 🔴 **where the approach dies** — the pseudo-polynomial limit at amount 10⁹ |

## The three sentences to keep

1. **Clarify, example, brute force, name the pattern — before any code.** That is a third of the
   time and most of the outcome.
2. **The brute force is not a formality; it is the input to the optimisation.** For DP its
   parameters are the state.
3. **Trace your own code out loud.** Finding your own bug is a positive signal; having it found
   for you is not.

## Phase gate

You are done with this topic when you run the loop without being prompted — including asking for
the input size before choosing an approach, choosing an example that discriminates between two
candidate approaches, and closing with a complexity statement that names the trade you did not
take.

## Where this connects

- [01 · What DP is](../01-what-dp-is/README.md) — the two conditions checked in step 4
- [02 · Memoization, top-down](../02-memoization/README.md) — the transformation applied in step 5
- [Phase 15 · Algorithmic patterns](../../phase-15-algorithm-patterns/README.md) — the pattern shortlist step 4 matches against
- [Phase 13 · 01 · Big-O notation](../../phase-13-complexity/01-big-o/README.md) — stating a bound as *states × work per state*

---

Start → [01 · The loop to run under pressure](./01-the-loop.md)
