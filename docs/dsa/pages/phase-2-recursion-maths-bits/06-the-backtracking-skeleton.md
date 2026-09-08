---
title: "Backtracking is one recursive shape — choose, explore, un-choose — and the un-choose exists only because the path is a single mutable object that every node of the call tree shares; the invariant is that the function returns the state it was handed"
sidebar_label: "06 · The backtracking skeleton"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The choose / explore / un-choose skeleton, the recursion-tree bound and
> the two pruning classes are **common practice and mathematics — derived on this page, never
> cited to a source**. The one language-behaviour citation is MDN's
> ["too much recursion"](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion)
> page, for the base case and the error a missing one throws. Reference-versus-copy semantics are
> stated as mechanism, with no figure attached. Java targets **JDK 25**; TypeScript first, Java
> second. **No sandbox run** — this page carries code, never program output.

**This page is deliberately a preview.** [Part 6 of the syllabus](../../syllabus/06-backtracking-greedy-and-dp.md)
owns backtracking in full — the problem catalogue, its overlap with dynamic programming, the greedy
contrast. What *this* phase owns is recursion, and backtracking is the single most important
recursive shape you will write: a depth-first walk of a tree of choices in which the tree is never
built, only the current root-to-node path exists, and that path is **one mutable object that every
node in the walk shares**. Every distinctive thing about backtracking follows from that one design
decision. The un-choose exists to restore the shared object. The answer has to be *copied* at the
leaf, because the shared object keeps changing after you store it. The complexity is read off the
tree rather than off the code. And pruning — cutting a subtree before descending into it — is the
only thing between a correct solution and one that never returns.

This chunk is the shape and the un-choose. Memory and cost are [06b](06b-copies-and-the-two-path-designs.md)
and [06c](06c-the-cost-of-the-search-tree.md); the enumerations are [06d](06d-subsets-and-combinations.md)
and [06e](06e-permutations-and-the-used-array.md); duplicate input is
[06f](06f-duplicates-in-subsets-and-combinations.md) and [06g](06g-duplicates-in-permutations.md);
pruning is [06h](06h-feasibility-pruning.md), [06i](06i-bound-pruning-and-ordering.md) and [06j](06j-n-queens-and-symmetry.md).

## The skeleton, written once

Four moving parts, in this order, every time: a base case that emits, a loop over the candidate
choices at this node, a feasibility test that skips a choice, and the choose / explore /
un-choose triple around the recursive call.

```ts
// The shape. Every backtracking solution in this topic is this, with the four holes filled in.
function backtrack(state: State, path: Choice[], out: Choice[][]): void {
  if (isComplete(state)) {
    out.push([...path]);            // 🔴 COPY. `path` keeps mutating after this line.
    return;
  }
  for (const c of choicesAt(state)) {
    if (!feasible(state, c)) continue;   // pruning — cut the subtree before descending

    apply(state, c);                     // choose  — mutate the shared state
    path.push(c);
    backtrack(state, path, out);         // explore — the subtree under this choice
    path.pop();                          // un-choose — exact inverse, in reverse order
    undo(state, c);
  }
}
```

```java
// Java, same four holes. `path` is one ArrayList for the whole search.
void backtrack(State state, List<Integer> path, List<List<Integer>> out) {
    if (state.isComplete()) {
        out.add(new ArrayList<>(path));   // 🔴 COPY, via the copy constructor
        return;
    }
    for (int c : state.choicesAt()) {
        if (!state.feasible(c)) continue;

        state.apply(c);                   // choose
        path.add(c);
        backtrack(state, path, out);      // explore
        path.remove(path.size() - 1);     // un-choose — reverse order of the applies
        state.undo(c);
    }
}
```

Note the undo order. If entering a choice does `apply(state, c)` and then `path.push(c)`, leaving
it does `path.pop()` and then `undo(state, c)` — last applied, first undone, exactly like the call
stack itself. It rarely matters when the two mutations are independent; it matters the moment
`undo` reads something `path` also touched, and the habit costs nothing.

MDN's framing of recursion puts the base case first, and so should you:

> *"Once a condition is met, the function stops calling itself."* … *"This is called a base
> case."*

> *"When there are too many function calls, or a function is missing a base case, JavaScript will
> throw this error."* — MDN, *RangeError: Maximum call stack size exceeded*

The engine-dependent error type is documented too, and the two runtimes disagree:

> *"`InternalError` in Firefox; `RangeError` in Chrome and Safari."*

In backtracking the base case is usually not "the input ran out" but "the path is a complete
answer" — `path.length === k`, all `n` rows placed, the remaining target is zero. A search whose
completion test is wrong does not usually overflow the stack; it emits the wrong *set* of answers,
which is far harder to see than a crash.

## Backtracking is DFS plus two extra obligations

Worth naming, because the three get conflated in a round. A **plain recursive enumeration** walks a
structure that already exists. A **DFS** walks a graph and marks nodes visited so it never returns
to one. **Backtracking** walks a tree of *choices* that does not exist in memory, and adds two
things a DFS does not have: an undo on the way out, and a feasibility test that refuses to descend
at all. The undo is required because the "nodes" are states you construct, not objects you visit;
the prune is required because the tree is exponential and most of it is dead.

The practical consequence is the one people get wrong when they port a DFS habit across: a backtracking
search usually has **no visited set**, because the same state is generally not reachable by two different
routes once the choice loop is written correctly — and where it *is* (word-search on a grid, say), the
visited mark is per-path state that must be undone, not a global set that persists. A global `visited` in
a backtracking search is a bug unless you meant "never use this cell again in any answer".

## The invariant the un-choose maintains

State this out loud in a round; it is the sentence that makes the code obviously right:

> **On entry to `backtrack`, `path` holds exactly the choices on the route from the root of the
> search tree to this node. On return, `path` — and every other piece of shared state — is
> exactly what it was on entry.**

The second clause is the un-choose. Every mutation performed between the two — the push, the
`used[i] = true`, the `cols.add(c)`, the decrement of a remaining budget — must be reversed
before the loop iterates to the next sibling, because that sibling starts from the *same* node
and expects the same state.

That is also the proof obligation for correctness, and it is an induction. Assume every recursive
call returns the state it was given. A node then applies a choice, recurses (unchanged, by
assumption), and applies the exact inverse — so the node returns the state it was given too. The
base case mutates nothing. What that induction buys you is that the check is **local**: read one
loop body, count the mutations, count the inverses. You never have to trace an example. If the
inverse is not exact — you pushed two elements and popped one, you set a flag inside the loop and
cleared it outside — the induction breaks and the wrong answer surfaces not at the node that
caused it but at some cousin, many nodes later, with no local evidence.

## What it looks like without the un-choose

```ts
// 🔴 BROKEN — the pop is missing. Every subtree leaks its choices into its siblings.
function subsetsBroken(nums: number[]): number[][] {
  const out: number[][] = [];
  const path: number[] = [];
  const go = (start: number): void => {
    out.push([...path]);
    for (let i = start; i < nums.length; i++) {
      path.push(nums[i]);
      go(i + 1);
      // path.pop();   ← removed
    }
  };
  go(0);
  return out;
}
```

The mechanism, not the symptom: `path` is never shortened, so it only grows. Each recursive call
appends and the append survives the return, which means every node visited after a subtree sees
that whole subtree's choices still sitting in the path. What comes out is not a subset lattice at
all — it is a set of ever-lengthening prefixes of one traversal order, and its length is wrong as
well as its contents.

Java's version of the same bug is the same missing line:

```java
// 🔴 BROKEN — path.remove(path.size() - 1) omitted
void go(int[] nums, int start, List<Integer> path, List<List<Integer>> out) {
    out.add(new ArrayList<>(path));
    for (int i = start; i < nums.length; i++) {
        path.add(nums[i]);
        go(nums, i + 1, path, out);
        // path.remove(path.size() - 1);   ← removed
    }
}
```

## State that is not the path

The path is the obvious shared object, and it is rarely the only one. Anything the recursion
writes and a sibling later reads has to be undone by the same discipline, and forgetting one of
these is the most common real bug in an otherwise correct-looking search:

| Shared state | Choose | Un-choose |
|---|---|---|
| the path itself | `path.push(c)` | `path.pop()` |
| a `used` flag array (permutations) | `used[i] = true` | `used[i] = false` |
| conflict sets (N-Queens) | `cols.add(c)`, `diag.add(r - c)` | `cols.delete(c)`, `diag.delete(r - c)` |
| a remaining budget or target | `remaining -= v` | `remaining += v` |
| a grid cell marked in-use (word search) | `grid[r][c] = '#'` | `grid[r][c] = saved` |
| a running count or sum | `sum += v` | `sum -= v` |
| a `Map` of counts (multiset choices) | `counts.set(v, k - 1)` | `counts.set(v, k)` |

Three of these have a trap of their own. **A grid cell must be restored from a saved value, not
to a constant** — writing back `'.'` is right only if every cell that can be visited started as
`'.'`. **A budget passed as a parameter needs no undo at all**, because a parameter is per-frame;
the undo is only needed for state reachable from the *outside* of the call, which is exactly why
passing `remaining - v` as an argument is often simpler than mutating a field. And **a
floating-point running sum is not exactly restorable** — `sum += v` followed by `sum -= v` need
not return the original bits, so a search that accumulates prices should carry integer cents, or
recompute rather than undo.

That last one shows up in a storefront: a checkout search that tries combinations of promotions
against an order total, mutating a running discount as a `number`, drifts as the tree gets deep.
Carry the total in integer minor units and the undo is exact.

## Gotchas

**★ Symptom: the emitted answers are ever-lengthening prefixes rather than the intended
enumeration.** Cause: a missing or inexact un-choose, so a subtree's mutations survive into its
siblings. Fix: the mechanical review rule — every mutation of shared state inside the loop body
has a matching inverse inside the same loop body, in reverse order. Count them; the two numbers
must match.

**★ Symptom: the un-choose is written after the loop rather than inside it.** Cause:
pattern-matching on "cleanup goes at the end". Fix: the inverse belongs immediately after the
recursive call and inside the loop body. After the loop it runs once for `b` chooses, so the
state is wrong for every sibling except the last — and, unlike a missing pop, the answer count
often still looks plausible.

**★ Symptom: the path is restored correctly and the answers are still wrong.** Cause: a second
piece of shared state — a `used[]`, a conflict set, a marked grid cell, a running sum — that the
subtree wrote and nobody undid. Fix: enumerate every piece of state the recursion writes, not
just the path, and decide for each whether it is per-branch (undo it) or deliberately global (a
best-so-far, a memo — say so in a comment so the next reader does not "fix" it).

**Symptom: a grid cell restored to `'.'` and a later answer walks through a wall.** Cause: the
un-choose writes a constant instead of the saved value. Fix: `const saved = grid[r][c]` before the
mark, `grid[r][c] = saved` after the recursion.

**Symptom: the search never terminates on an input that should be small.** Cause: a completion
test that can be stepped *past* rather than landed on — `path.length === k` when a branch adds two
elements, or `remaining === 0` when `remaining` can go negative. Fix: make the base case a `>=`
guard, or make every step change the measure by exactly one. MDN's rule that a missing base case
throws is the friendly failure; a base case that is merely unreachable is the unfriendly one.

**Symptom: a stale `visited` set makes whole regions unreachable in later answers.** Cause: a DFS
habit — a global visited set — imported into a search where the mark is per-path. Fix: mark on the
way in and unmark on the way out, or reason explicitly that the cell may never be reused in any
answer.

**Symptom: an accumulated floating-point total does not return to its original value after the
undo.** Cause: `sum += v; …; sum -= v` is not the identity in binary floating point. Fix: carry
integer minor units, or pass the total as a parameter so no undo is needed.

## Interview questions

**★ Why does backtracking need an un-choose at all?**
Because the path is a single mutable object shared by every node of the search tree. The
recursion only ever holds the current root-to-node route, and it moves between routes by mutating
that one object rather than building a new one per node — which is what makes each edge of the
tree cost Θ(1) instead of Θ(depth). The price of the sharing is that leaving a node must restore
the object to exactly what the parent handed over, or the next sibling starts its subtree from a
polluted state. Stated as an invariant: on entry the path holds exactly the choices from the root
to this node, and on return it is exactly what it was on entry. The un-choose is the second
clause.

**★ How do you convince someone the un-choose is correct without running it?**
Induction on the tree. Assume every recursive call returns the state it was given; a node then
applies a choice, recurses (unchanged by the assumption), and applies the exact inverse in reverse
order, so the node also returns the state it was given, and the base case mutates nothing. The
obligation that reduces to is purely local and readable off one loop body: is the inverse exact,
and is it inside the loop? That is why the review rule is "count the mutations, count the
inverses" rather than "trace an example" — an inexact inverse shows up at a cousin node, far from
its cause.

**★ What is the difference between backtracking and DFS?**
A DFS traverses a graph that exists, marking nodes visited so it never revisits one. Backtracking
traverses a tree of choices that does not exist in memory — the "nodes" are states you construct
by mutating one shared object — and it adds two obligations a DFS does not have: an undo on the
way out, and a feasibility test that refuses to descend into a subtree that cannot contain an
answer. The practical fallout is that a backtracking search usually has no global visited set;
where it needs a mark at all (word search on a grid), the mark is per-path state and must be
unmarked on the way out.

**Why does the order of the undos matter?**
Because the applies form a stack. If entering a node mutated shared state and then pushed onto
the path, and the pop reads something the state-undo would have destroyed — or the state-undo
reads the top of the path — doing them in the wrong order restores something that is no longer
what was saved. When the two mutations are genuinely independent the order is irrelevant, which
is most of the time, and is exactly why the habit is worth having: the day they are not
independent, there is no local evidence of the bug.

**Where do you put the base case, and what belongs in it?**
At the top of the function, testing *completeness of the path*, not exhaustion of the input.
`path.length === k`, all rows placed, target reached. Two things belong in it and nothing else:
emitting a copy of the answer, and returning. Emitting from inside the loop instead — after the
choose but before the recursion — is a legitimate variant for problems where every node is an
answer (subsets is exactly that), and it is worth saying which of the two shapes you are writing,
because it changes whether the recursion needs a base case at all: a subsets search terminates
because `start` runs off the end of the array, so the base case is the empty loop.

**Why is a parameter often better than mutable state in a backtracking search?**
Because a parameter is per-frame and therefore self-restoring — passing `remaining - v` down needs
no undo, while mutating a `remaining` field does. The cost is that a parameter is copied per call,
which is free for a number and Θ(depth) for an array, so the rule of thumb is: scalars go as
parameters, aggregates go as shared state with an explicit undo. That split removes most of the
opportunities to forget an inverse, and it is the reason the standard subsets/permutations
skeletons carry `start` and `target` as arguments and the path as a field.

{/* FOOTER */}
