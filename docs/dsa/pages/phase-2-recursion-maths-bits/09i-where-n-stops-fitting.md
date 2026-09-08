---
title: "The constraint in the statement has already told you whether a bitmask is the intended solution, and when it is borderline the thing that stops you is memory rather than time — because the table has to exist all at once while the time is merely spent"
sidebar_label: "09i · Where n stops fitting"
sidebar_position: 9.8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. Every figure on this page is **arithmetic** — powers of two and three, and
> cell counts multiplied by a stated element width — derived here and checkable on paper. None is a
> benchmark, a timing or a measured allocation. ⚠️ The JVM's storage size for a `boolean[]` element
> and the internal representation of a JavaScript `Array` are **not specified by the respective
> language documents** and are stated as "do not rely on it" rather than as facts. The 32-bit mask
> ceiling is quoted from MDN in [09b](09b-precedence-and-the-32-bit-loop-bound.md) and
> [04g](04g-the-32-bit-ceiling-and-what-to-use-instead.md). **No sandbox run.**
> Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**Every technique in this topic is exponential, so the only interesting engineering question is
where it stops — and unusually, that question has a precise answer you can compute before writing a
line.** Count the states, multiply by the bytes per state, and compare against what you are allowed
to allocate. The result is the largest `n` you should attempt, and it is almost always smaller than
the largest `n` you could wait for. This page is that arithmetic, the reading of the constraint that
makes it unnecessary, and the four things to do when `n` is past the line.

## The constraint has already told you

[Phase 0 · reading the constraints](../phase-0-the-interview-and-practice/05-reading-the-constraints.md)
and [phase 1 · the common classes](../phase-1-complexity/05-the-common-classes-and-what-the-limits-imply.md)
own this argument in general. The bitmask-specific reading:

| The statement says | What it is telling you |
|---|---|
| `n ≤ 15` or `n ≤ 16` | `Θ(3^n)` is on the table — a submask/partition DP ([09g](09g-submask-dp-and-partitions.md)) |
| `n ≤ 20` | `Θ(2^n · n)` — the standard `dp[mask]` shape; the single most common bitmask constraint |
| `n ≤ 18` with a `dp[mask][last]` shape | `Θ(2^n · n²)` — the tour; the extra dimension has cost you two of `n`'s units |
| `n ≤ 22` … `n ≤ 24` | a `dp[mask]` with a *narrow* cell and no second dimension, and you will be counting bytes |
| `n ≤ 40` | **not** a plain bitmask — meet in the middle, `2^(n/2)` on each half |
| `n ≤ 1000` | not exponential at all, whatever the problem looks like |

🔴 **`n ≤ 20` in a statement is not a hint that a bitmask might work. It is the setter telling you
which algorithm they wrote.** Almost nothing else is polynomial-in-`n` for an `n` that small — a
limit that low exists precisely because the intended solution is exponential.

## The arithmetic, twice: states and bytes

Powers, as plain arithmetic:

| `n` | `2^n` | `2^n · n` | `2^n · n²` | `3^n` |
|---:|---:|---:|---:|---:|
| 15 | 32,768 | 491,520 | 7,372,800 | 14,348,907 |
| 16 | 65,536 | 1,048,576 | 16,777,216 | 43,046,721 |
| 18 | 262,144 | 4,718,592 | 84,934,656 | 387,420,489 |
| 20 | 1,048,576 | 20,971,520 | 419,430,400 | 3,486,784,401 |
| 22 | 4,194,304 | 92,274,688 | 2,030,043,136 | — |
| 24 | 16,777,216 | 402,653,184 | — | — |

Now the same table as memory, at **four bytes per cell** — a 32-bit integer or a `Float32Array`
entry:

| Shape | `n = 18` | `n = 20` | `n = 22` | `n = 24` |
|---|---:|---:|---:|---:|
| `dp[mask]` | 1,048,576 B | 4,194,304 B | 16,777,216 B | 67,108,864 B |
| `dp[mask][last]` | 18,874,368 B | 83,886,080 B | 369,098,752 B | 1,610,612,736 B |
| `dp[mask][last]` + parent | 37,748,736 B | 167,772,160 B | 738,197,504 B | — |

**Read that table across, not down.** `dp[mask]` is comfortable well past the point at which the
time is unaffordable; `dp[mask][last]` runs out of memory at `n = 22` while its `2,030,043,136`
transitions were already the binding problem. And adding a parent array for path reconstruction
([09f](09f-dp-over-masks-with-a-last-element.md)) moves the wall down by two whole units of `n`,
which is why "recover the path by replaying the recurrence" is not a micro-optimisation.

## Memory is the ceiling, and time is not

The asymmetry is structural rather than incidental. **Time is spent; memory is held.** A `Θ(2^n · n²)`
loop that takes longer than you like still produces an answer if you wait, and can be attacked with a
better constant, an early exit, or a pruned search. A table that does not fit does not exist —
allocation fails, or the process is killed, and no constant factor helps. So the first calculation is
always cells times cell width, and only then the operation count.

Three consequences worth having:

- **Narrow the cell before you narrow the algorithm.** A reachability DP needs one bit per state,
  not one `int`. `Uint8Array` is a quarter of `Int32Array`; a packed bitset over `Uint32Array` is a
  thirty-second ([04g](04g-the-32-bit-ceiling-and-what-to-use-instead.md) has the word-array
  mechanics). A cost DP whose values fit in 16 bits can use `Int16Array` — check the maximum
  possible cost first, because a silent wrap in a typed array is not an error
  ([05e](05e-overflow-on-purpose.md)).
- **Never hold a state in a boxed container.** `HashMap<Integer, Integer>` or a
  `Map<number, number>` for `2^20` states pays an object header, a reference and a hash per entry
  instead of four contiguous bytes. This is a mechanism argument — no measurement is offered — but
  the direction is not in doubt, and the whole reason to encode a set as an integer was to be able to
  use a flat array ([09](09-bitmask-enumeration.md)).
- ⚠️ **Do not reason from unspecified representations.** The JLS does not promise a `boolean[]`
  element is one byte, and no MDN page fetched for this topic describes how a plain JavaScript
  `Array` stores its elements. Use `Uint8Array` / `Int32Array` when you need to know the width, and
  treat everything else as "at least as large as you think".

## When the transform is the memory fix

Two techniques in this topic exist mainly to reduce memory, not time:

- **Layered by popcount** ([09c](09c-generating-masks-in-a-useful-order.md)): if every transition
  adds exactly one element, only two popcount layers are live, so the table is
  `C(n, k-1) + C(n, k)` rather than `2^n`. Combined with the combinatorial ranking in
  [09d](09d-fixed-size-subsets-and-gray-code.md), those layers can be stored densely.
- **Replay instead of storing parents** ([09f](09f-dp-over-masks-with-a-last-element.md)): recompute
  each predecessor by checking which one satisfies the recurrence, at `Θ(n)` per step and no memory.

Both trade time for memory, which is the correct direction when memory is what binds.

## Past the line: the four escapes

1. **Meet in the middle.** Split the `n` items into two halves and enumerate `2^(n/2)` subsets of
   each — for `n = 40` that is 1,048,576 per side instead of 1,099,511,627,776 in total. Then join
   the halves by sorting one side and binary-searching it, or by hashing. It applies when the
   objective decomposes over a split, which subset-sum-shaped problems do and path-shaped ones
   generally do not.
2. **A polynomial algorithm you had forgotten.** Assignment has the Hungarian algorithm at `Θ(n³)`;
   many "choose a subset" problems are flow or matching in disguise. 🔴 **Check for this before
   proposing an exponential algorithm, and say the result either way** — proposing `2^n` when a
   cubic algorithm exists is the specific failure the question is often testing for
   ([09e](09e-dp-over-masks-the-shape-and-the-cost.md)).
3. **Search with pruning instead of a table.** Branch and bound over the same states visits a small
   fraction of them when a bound is available ([06i](06i-bound-pruning-and-ordering.md)), at the cost
   of a worst case that is no better. This is the honest answer when `n` is 25 and the structure is
   favourable: no guarantee, often fine.
4. **Structure in the problem.** A tree, a bounded-width graph, a precedence order that makes most
   masks unreachable — all of these shrink the reachable state space far below `2^n`, and the
   `if (dp[mask] === INF) continue;` guard already exploits it
   ([09c](09c-generating-masks-in-a-useful-order.md)). Counting how many masks are actually reachable
   is sometimes the whole solution.

## The language decision, and why it is usually moot

`2^31` masks is unreachable in both time and memory, so **for anything that enumerates all masks the
32-bit ceiling is never the binding constraint** — the state count kills you around `n = 24`, seven
bits early. Do not spend interview time on `BigInt` for a DP.

Where the width does bind is the other family: holding a large set as a mask *without* enumerating
all of them. A permissions or feature-flag bitfield on a storefront product, a visited-set over 40
graph nodes inside a search that reaches a minuscule fraction of the space, a bitset of candidate
rows. There the answer is Java's `long` (to 63 elements), an array of 32-bit words, or `BigInt` —
[04g](04g-the-32-bit-ceiling-and-what-to-use-instead.md) is the trade-off in full, and
[09b](09b-precedence-and-the-32-bit-loop-bound.md) is the failure mode if you ignore it.

## Gotchas

**★ Symptom: the solution works at `n = 18` and dies at `n = 22` with no error message.** Cause: a
`dp[mask][last]` table at `n = 22` is 92,274,688 four-byte cells — 369,098,752 bytes — and the
process was killed rather than throwing. Fix: compute cells × width *before* writing code; if it does
not fit, the second dimension has to go, or the cell has to narrow, or the technique is wrong for
this `n`.

**★ Symptom: an approach is rejected for being too slow when it was actually too large.** Cause: the
operation count was estimated and the memory was not. Fix: estimate both, and estimate memory first —
a table that does not allocate cannot be made to work by any constant factor, while a slow loop
sometimes can.

**★ Symptom: `n ≤ 40` and the bitmask solution is correct but hopeless.** Cause: `2^40` is
1,099,511,627,776 — the constraint was telling you to split. Fix: meet in the middle, enumerating
`2^20` subsets of each half and joining them; the constraint `n ≤ 40` is close to a signature for
that technique.

**★ Symptom: memory doubles the moment path reconstruction is added.** Cause: a parent array is the
same shape as the DP table. Fix: replay the recurrence backwards instead — at each state find the
predecessor whose value plus the transition cost equals the current cell — for `Θ(n)` per step and
no additional memory ([09f](09f-dp-over-masks-with-a-last-element.md)).

**★ Symptom: a `Map`-based memo over masks is far heavier than the state count suggests.** Cause:
every entry carries an object header, a boxed key and a hash bucket rather than four contiguous
bytes. Fix: a flat typed array indexed by the mask — which is the entire reason the set was encoded
as an integer in the first place. Stated as mechanism; no measurement is offered.

**Symptom: narrowing the cell to `Int16Array` produced wrong answers.** Cause: an intermediate cost
exceeded the type's range and wrapped silently — a typed array truncates rather than throwing
([05e](05e-overflow-on-purpose.md)). Fix: bound the maximum possible value before narrowing, and
leave headroom for the sentinel too.

**Symptom: the reachable-state optimisation gives no benefit.** Cause: the guard `if (dp[mask] ===
INF) continue;` saves the *transitions* from unreachable states but not the *allocation* of the full
table. Fix: if most masks are unreachable, switch to an explicit frontier — a queue or a set of live
masks — rather than a table over all `2^n`, and accept the hashing cost in exchange for the memory.

## Interview questions

**★ The constraint says `n ≤ 20`. What has the setter told you?**
That the intended solution is exponential in `n`, almost certainly `Θ(2^n · n)` with the state being
a subset. Nothing else needs a limit that low — a polynomial algorithm would have been given `n` in
the thousands or more. So `n ≤ 20` is not a hint that a bitmask *might* fit; it is a statement about
which algorithm was written. The neighbouring readings are worth having too: 15 or 16 admits `3^n`,
so a partition or submask DP; 18 with a `dp[mask][last]` shape is the tour at `2^n · n²`; and 40
means meet in the middle, not a mask.

**★ What is the largest `n` you would attempt for a TSP-shaped mask DP, and why that number?**
Around 20, and the reasoning is arithmetic rather than experience. The table is `2^n · n` cells; at
`n = 20` that is 20,971,520 cells, 83,886,080 bytes at four bytes each — large but liveable — with
419,430,400 transitions. At `n = 22` the table is 369,098,752 bytes and the transitions are
2,030,043,136, and both are past the line. Say the memory figure first, because it is the one that
kills the process outright rather than merely making it slow.

**★ Why is memory the binding constraint rather than time?**
Because the table has to exist all at once, while the time is spent incrementally. A slow loop still
produces an answer if you wait, and can be attacked with a tighter constant, an early exit or
pruning; a table that fails to allocate does not run at all, and no constant factor rescues it. That
asymmetry is why the first estimate to make is cells × bytes per cell, and why "drop the second
dimension" and "narrow the cell type" are the first two things to try when a bitmask solution is
borderline.

**★ `n` is 40. What now?**
Meet in the middle. Split the items into two halves of 20, enumerate the `2^20` subsets of each —
1,048,576 per side rather than 1,099,511,627,776 in total — and combine, typically by sorting one
side's results and binary-searching for each of the other side's, or by hashing. It applies when the
objective decomposes across the split, which subset-sum, partition-into-two and closest-pair-of-sums
problems do. It does not apply to path-shaped problems where the two halves interact throughout,
which is worth saying so the interviewer knows you are not pattern-matching on the number 40.

**★ Does JavaScript's 32-bit limit stop your bitmask DP?**
Practically never, and knowing why is the point. `2^31` states is unreachable in both time and
memory — the state count kills a mask DP around `n = 24`, seven bits before the width matters. So for
an enumeration or a DP, the width is not the constraint and `BigInt` is not the answer. The ceiling
does bind for the other use of masks: holding a large set without enumerating all of them — a
permissions bitfield, a visited-set over 40 nodes in a pruned search — where a Java `long`, a word
array or `BigInt` is a real decision.

**How would you cut memory without changing the algorithm?**
Four moves, in the order I would try them. Narrow the cell — a reachability table wants one bit or
one byte per state, not four. Drop derived dimensions — if the second index is a function of the
mask, like a popcount-implied position, it is duplication. Replay rather than store parents, trading
`Θ(n)` per reconstruction step for the entire parent array. And if every transition changes the
popcount by exactly one, keep only two popcount layers, which turns `2^n` into `C(n, k-1) + C(n, k)`.
Each is a time-for-memory trade, which is the right direction when memory is what binds.

{/* FOOTER */}
