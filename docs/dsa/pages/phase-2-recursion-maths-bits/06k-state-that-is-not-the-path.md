---
title: "The path is the obvious shared object and almost never the only one — every flag array, conflict set, running total, grid mark and count map the recursion writes needs the same choose/un-choose discipline, and the ones that cannot be undone exactly are the ones that quietly produce wrong answers"
sidebar_label: "06k · State that is not the path"
sidebar_position: 6.05
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The choose / un-choose discipline and the per-frame-versus-shared
> distinction are **common practice, derived on this page rather than cited**. The one
> arithmetic claim — that a floating-point `+=` followed by `-=` is not the identity — follows
> from MDN's documented [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)
> mantissa sentence, quoted in full on
> [05 · Integer limits and overflow](05-integer-limits-and-overflow.md), and is stated here as
> its consequence, not as a measurement. Java targets **JDK 25**; TypeScript first, Java second.
> **No sandbox run** — this page carries code, never program output.

**The un-choose is not a rule about the path; it is a rule about every mutable thing the
recursion can reach.** [06](06-the-backtracking-skeleton.md) establishes the invariant — a call
returns the state it was handed — and demonstrates it on the path, because the path is the object
the skeleton makes visible. In real searches the path is one of four or five mutable objects, and
the bug that survives code review is never the missing `path.pop()`. It is the conflict set nobody
restored, the grid cell written back as a constant, the accumulated `number` that does not return
to its own bits. This chunk is the inventory: what else is shared, how each one is undone, and the
three kinds that need something other than a plain inverse.

## The inventory

Anything the recursion writes and a sibling later reads has to be undone by the same discipline,
and forgetting one of these is the most common real bug in an otherwise correct-looking search:

| Shared state | Choose | Un-choose |
|---|---|---|
| the path itself | `path.push(c)` | `path.pop()` |
| a `used` flag array (permutations) | `used[i] = true` | `used[i] = false` |
| conflict sets (N-Queens) | `cols.add(c)`, `diag.add(r - c)` | `cols.delete(c)`, `diag.delete(r - c)` |
| a remaining budget or target | `remaining -= v` | `remaining += v` |
| a grid cell marked in-use (word search) | `grid[r][c] = '#'` | `grid[r][c] = saved` |
| a running count or sum | `sum += v` | `sum -= v` |
| a `Map` of counts (multiset choices) | `counts.set(v, k - 1)` | `counts.set(v, k)` |
| a string being built | `sb.append(c)` | `sb.setLength(len)` |
| a bitmask of used columns | `mask \|= 1 << c` | `mask ^= 1 << c` |

The last two are worth separating out. **A `StringBuilder` is undone by length, not by
`deleteCharAt`** — record `int len = sb.length()` before the append and restore with
`sb.setLength(len)`, which is correct even when the choose appended more than one character and
is the only form that survives a later edit changing how much gets appended. **A bitmask passed
as a parameter needs no undo at all**; a bitmask held as a field does, and `mask ^= 1 << c` is
exact only because the bit was known to be clear on the way in. If it might already have been
set, the inverse is not XOR but a restore of the saved value.

## Three that are not a plain inverse

**A grid cell must be restored from a saved value, not to a constant.** Writing back `'.'` is
right only if every cell that can be visited started as `'.'`. The moment the board has two kinds
of passable cell — a floor and a coin, a letter and a blank — the constant silently rewrites the
board as the search unwinds, and the corruption shows up in an answer found much later.

```ts
// wrong: assumes every visitable cell was '.'
grid[r][c] = '#';  go(r, c); grid[r][c] = '.';

// right: the inverse is defined by what was there
const saved = grid[r][c];
grid[r][c] = '#';
go(r, c);
grid[r][c] = saved;
```

```java
char saved = grid[r][c];
grid[r][c] = '#';
go(r, c);
grid[r][c] = saved;
```

**A budget passed as a parameter needs no undo at all**, because a parameter is per-frame. The
undo is only needed for state reachable from *outside* the call, which is exactly why passing
`remaining - v` as an argument is usually simpler than mutating a field:

```ts
// no undo needed: `remaining` is a fresh binding in each frame
function go(i: number, remaining: number, path: number[], out: number[][]): void {
  if (remaining === 0) { out.push([...path]); return; }
  if (remaining < 0 || i === nums.length) return;
  path.push(nums[i]);
  go(i, remaining - nums[i], path, out);   // reuse allowed
  path.pop();                              // the path still needs one
  go(i + 1, remaining, path, out);
}
```

Note what survives: the path is an aggregate, so it stays shared and keeps its explicit undo; the
scalar becomes an argument and its undo disappears. That split is the whole design rule.

**A floating-point running sum is not exactly restorable.** `sum += v` followed by `sum -= v`
need not return the original bits, because each operation rounds to the nearest representable
double. The drift is invisible on a shallow tree and decisive on a deep one, since the comparison
that ends the search is an equality or a threshold test against a value that has now moved.

That one shows up in the storefront directly: a checkout search that tries combinations of
promotions against an order total, mutating a running discount as a `number`, drifts as the tree
gets deep and starts accepting or rejecting bundles at the boundary for no reason a reader can
see. Carry the total in **integer minor units** — cents, not pounds — and the undo is exact,
because integer addition and subtraction below 2^53 are exact in a double. `05 ·
[Integer limits and overflow](05-integer-limits-and-overflow.md)` is where that exactness bound
is derived; here it is the reason a search that looks correct returns different answers on
different inputs.

## Deciding, per piece of state, which kind it is

The review question is not "did I undo everything" but "what kind is each thing":

1. **Per-frame** — a parameter, a local. Self-restoring; no undo, and adding one is a bug.
2. **Per-branch shared** — the path, `used[]`, conflict sets, the grid mark. Needs an exact
   inverse, inside the loop body, immediately after the recursive call.
3. **Deliberately global** — a best-so-far incumbent, a memo table, a counter of answers found.
   Must **not** be undone, and must say so in a comment, or the next reader "fixes" it and breaks
   the search. [06i](06i-bound-pruning-and-ordering.md) is where the incumbent's exemption from
   the invariant is argued properly.

Classify each name once, write the classification next to the declaration, and the enumeration
becomes mechanical rather than a memory exercise.

## Gotchas

**★ Symptom: the path is restored correctly and the answers are still wrong.** Cause: a second
piece of shared state — a `used[]`, a conflict set, a marked grid cell, a running sum — that the
subtree wrote and nobody undid. Fix: enumerate every piece of state the recursion writes, not
just the path, and classify each as per-frame, per-branch or deliberately global before deciding
whether it needs an inverse.

**★ Symptom: a grid cell restored to `'.'` and a later answer walks through a wall.** Cause: the
un-choose writes a constant instead of the saved value. Fix: `const saved = grid[r][c]` before the
mark, `grid[r][c] = saved` after the recursion — an inverse defined by what was there, not by what
you assume was there.

**★ Symptom: an accumulated floating-point total does not return to its original value after the
undo.** Cause: `sum += v; …; sum -= v` is not the identity in binary floating point. Fix: carry
integer minor units, or pass the total as a parameter so no undo is needed.

**★ Symptom: a stale `visited` set makes whole regions unreachable in later answers.** Cause: a
DFS habit — a single global visited set — imported into a search where the mark is per-path. Fix:
mark on the way in and unmark on the way out, or reason explicitly that the cell can never be
reused in any answer and say so in a comment.

**Symptom: a `StringBuilder` loses more or fewer characters than the choose appended.** Cause:
`deleteCharAt(sb.length() - 1)` as the inverse of an append that added two characters — a
separator and a value. Fix: save the length before the append and `setLength(len)` after; it is
exact regardless of how much was appended, and stays correct when the append later changes.

**Symptom: a bitmask undo clears a bit that a caller had set.** Cause: `mask ^= 1 << c` as the
inverse, when the bit was not guaranteed clear on entry. Fix: either establish the precondition
(the loop only descends on `(mask & (1 << c)) === 0`, which is the usual case and makes XOR
correct) or restore a saved mask.

**Symptom: the answer count is right and the incumbent is wrong.** Cause: the best-so-far value
was undone along with everything else, because the un-choose block was written by pattern rather
than by classification. Fix: the incumbent is deliberately global — it is the one thing in the
search that must survive leaving the node, and it belongs outside the undo block with a comment
saying why.

**Symptom: a `Map` of counts ends the search with entries that should have been removed.** Cause:
the choose used `delete` when a count reached zero, so the inverse `set(v, k)` restores an entry
whose absence a sibling relied on — or, worse, the choose decremented and the inverse re-inserted
in a different order, changing iteration order for later branches. Fix: keep the zero entry rather
than deleting it, so the inverse is a pure `set` and the key set never changes shape during the
search.

## Interview questions

**★ Why is a parameter often better than mutable state in a backtracking search?**
Because a parameter is per-frame and therefore self-restoring — passing `remaining - v` down needs
no undo, while mutating a `remaining` field does. The cost is that a parameter is copied per call,
which is free for a number and Θ(depth) for an array, so the rule of thumb is: scalars go as
parameters, aggregates go as shared state with an explicit undo. That split removes most of the
opportunities to forget an inverse, and it is the reason the standard subsets and permutations
skeletons carry `start` and `target` as arguments and the path as a field.

**★ How do you find a missing un-choose in code you did not write?**
Not by tracing an example — an inexact inverse shows up at a cousin node, arbitrarily far from its
cause. Enumerate instead: list every name the recursive function assigns to that is not a local,
and for each, find the inverse in the same loop body. Two numbers, and they match or they do not.
The enumeration also catches the opposite bug, an undo applied to something that was meant to be
global, which no amount of tracing will make look wrong because the search still terminates and
still emits answers.

**★ Which pieces of state should deliberately *not* be undone?**
Anything whose purpose is to accumulate across the whole search rather than to describe the
current path: the best-so-far bound in a branch-and-bound, a memo table, a count of answers found,
a cache of computed feasibility. Undoing those is not a small inefficiency — it destroys the
pruning, because the bound resets every time the search leaves a node and no subtree is ever cut.
The give-away in review is an undo block that touches something never read as part of the current
path.

**Why does a `StringBuilder` get restored by length rather than by deleting characters?**
Because the inverse should be defined by the state before the choose, not by a count of what the
choose did. `setLength(len)` is correct whether the append added one character, a digit pair or a
separator plus a value, and it stays correct when someone later edits the append. `deleteCharAt`
encodes an assumption about the size of the mutation in a different place from the mutation
itself, which is exactly the shape of edit that rots.

**A search over promotions gives different results depending on the order the promotions are
listed. What is the first thing you check?**
Whether any accumulated value is floating point. Order-dependence in a search whose branches are
supposed to be independent almost always means the state is not being restored exactly, and the
only common non-exact inverse is the floating-point one — `sum += v` then `sum -= v` does not
return the original bits, so branches explored later start from a slightly different total than
branches explored earlier. Integer minor units make the undo exact and the order-dependence
disappears. If the totals are already integers, the next candidate is a shared collection whose
*iteration order* is being mutated, such as a `Map` gaining and losing a key.

**In a word search on a grid, why is the mark per-path rather than a global visited set?**
Because a cell that cannot be part of *this* word may well be part of another, and a global
visited set makes that cell unusable for every later answer. The mark exists only to stop the
current path from reusing a cell within itself, which is a statement about the path, not about the
grid — so it is per-branch state and it must be unmarked on the way out. This is one of the two
obligations that separates backtracking from a plain DFS, and it is the one people import the
wrong habit for.

---

← Prev: [06 · The backtracking skeleton](06-the-backtracking-skeleton.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [06b · Copies and the two path designs](06b-copies-and-the-two-path-designs.md)
