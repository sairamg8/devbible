---
title: "Memoisation is a table wrapped around a pure recursion that collapses an exponential call tree into one entry per distinct subproblem — it fixes the time and leaves the depth exactly where it was, which is why a memoised recursion is fast and still overflows"
sidebar_label: "01e · Memoising a recursive function"
sidebar_position: 1.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. The memoisation pattern is common practice, written out rather than cited.
> The `Map` / `HashMap` key semantics it depends on — reference identity for object keys, value
> equality for records and primitives — are the ones stated in
> [phase 1 · 06b](../phase-1-complexity/06b-hash-keys-and-the-test-for-hidden-loops.md). 🔴 **No
> stack-depth number for any engine** — MDN documents none, and the claim that a memoised recursion
> can still overflow is made as mechanism (the first descent reaches the base case before any entry
> is written), never as a measured depth. Fifth file of topic 01. **No sandbox run.**

**Memoisation is the smallest possible change to a recursion — a table keyed on the arguments,
checked on entry and written on exit — and it is worth understanding as two separate facts that
candidates merge into one.** It changes the number of *distinct* subproblems computed, which is
the time; it does not change the order they are computed in, which is the depth. So the memoised
Fibonacci is Θ(n) time and still Θ(n) stack, and still throws on a large n. The other half of the
page is the four ways the table itself is wrong: a key that omits an argument, a hit test that
cannot tell absent from falsy, a key compared by identity, and a table that outlives the data it
was computed for.

## Memoising a recursive function

Memoisation is one idea: if the function is **pure** — same arguments, same answer, no external
state read or written — then a table keyed by its arguments turns repeated subproblems into
lookups. The recursion is unchanged; a cache is wrapped around it.

```ts
// the exponential version: fib(n) recomputes fib(n - 2) once for every path that reaches it
function fibSlow(n: number): number {
  return n < 2 ? n : fibSlow(n - 1) + fibSlow(n - 2);
}

// memoised: each distinct n is computed once, so the call tree collapses to a chain of n nodes
export function fib(n: number, memo = new Map<number, number>()): number {
  if (n < 2) return n;
  const hit = memo.get(n);
  if (hit !== undefined) return hit;           // NOT `if (memo.get(n))` — 0 is a legal answer
  const value = fib(n - 1, memo) + fib(n - 2, memo);
  memo.set(n, value);
  return value;
}
```

Three things about that code carry the whole topic.

**The lookup test must distinguish "absent" from "falsy".** `if (memo.get(n))` is wrong the instant
`0` or `false` or `""` is a legal answer, and for `fib` it is. Use `memo.has(n)`, or compare against
`undefined`, or in Java compare the boxed result against `null` — and remember that a
`Map<Integer, Boolean>` whose stored value is `false` is a cache *hit*, not a miss.

**The key must capture every argument the answer depends on.** A recursion over `(i, remaining,
usedFlag)` memoised on `i` alone returns the answer computed for a different `remaining` — a wrong
answer with no error, and the single most common memoisation bug. In TypeScript the key is a
string or a nested `Map`; in Java, a `record` as a `HashMap` key, which gets `equals` and
`hashCode` for free and is the reason `record` beats a concatenated string here.

```java
// Java: a record key is exact, typed, and gets equals/hashCode from the compiler
record Key(int i, int remaining) {}

static long ways(int i, int remaining, int[] coins, Map<Key, Long> memo) {
    if (remaining == 0) return 1;
    if (remaining < 0 || i == coins.length) return 0;
    Key k = new Key(i, remaining);
    Long hit = memo.get(k);
    if (hit != null) return hit;                       // null means absent; 0L is a legal answer
    long answer = ways(i + 1, remaining, coins, memo)  // skip this coin
                + ways(i, remaining - coins[i], coins, memo); // take it, and it may be taken again
    memo.put(k, answer);
    return answer;
}
```

**Memoisation fixes the time and does not touch the depth.** This is the part candidates miss.
Memoised `fib(n)` makes Θ(n) *distinct* calls instead of Θ(2ⁿ) total, so the time collapses — but
the first descent still goes `n → n-1 → n-2 → … → 0` before any value is written to the table, so
the maximum depth is still n and the stack overflow is still there for large n. The fix for the
depth is the same as always: iterate. Bottom-up tabulation removes the recursion entirely, which is
why "memoised recursion" and "bottom-up DP" are the same algorithm with different space profiles:

```ts
// bottom-up: same Θ(n) time, Θ(1) space, and no stack at all
export function fibIterative(n: number): number {
  let a = 0, b = 1;
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
}
```

What memoisation costs, and what to say about it: Θ(number of distinct states) space for the table,
which for a two-parameter recursion is the product of the two ranges and is often the dominant
bound. A recursion over `(index, sum)` where the sum can be large is memoisable in principle and
not in memory, and noticing that before writing it is a senior signal.

Two more conditions that are easy to violate:

- **Purity.** If the function reads a mutable outer variable, or mutates a shared `path` array, the
  cached answer is the answer *for the state at the time it was cached*. Backtracking recursions
  that carry a mutable path are frequently not memoisable as written; the fix is to make the
  varying state part of the key, which is often what makes the table too large to be worth it.
- **Cache lifetime.** A memo allocated as a module-level constant persists across calls, which is
  correct only if the answer depends on nothing but the arguments. A memo for `ways(i, remaining,
  coins)` keyed on `(i, remaining)` and hoisted to module scope silently serves a previous run's
  `coins`. Allocate the table in a wrapper function per top-level call, or include everything
  varying in the key.

```ts
// the wrapper pattern: the memo's lifetime is exactly one top-level call
export function coinWays(coins: number[], target: number): number {
  const memo = new Map<string, number>();
  const go = (i: number, remaining: number): number => {
    if (remaining === 0) return 1;
    if (remaining < 0 || i === coins.length) return 0;
    const key = `${i}:${remaining}`;                 // both varying arguments, in the key
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    const answer = go(i + 1, remaining) + go(i, remaining - coins[i]);
    memo.set(key, answer);
    return answer;
  };
  return go(0, target);
}
```


## Gotchas

**★ Symptom: a memoised recursion that is fast and still throws `RangeError: Maximum call stack
size exceeded`.** Cause: memoisation collapses the *time* and leaves the *depth* untouched — the
first descent goes all the way to the base case before a single entry is written. Fix: bottom-up
tabulation, or an explicit stack; the memo is not a stack fix and saying so is the point.

**★ Symptom: a memoised function that returns a wrong answer, deterministically, with no error.**
Cause: the key does not capture every argument the answer depends on — memoised on `i` when the
answer also depends on `remaining`, or on `(i, j)` when a boolean flag also varies. Fix: put every
varying argument in the key. In Java use a `record` as the `HashMap` key so the compiler writes
`equals` and `hashCode`; in TypeScript a template-string key or a nested `Map`.

**★ Symptom: a memo that never hits, and the recursion is as slow as before.** Cause: a key built
from an object identity rather than its contents — a JavaScript `Map` keyed by an array or object
compares by reference, so a freshly built `[i, j]` is a new key every time. Fix: a primitive key
(`` `${i}:${j}` ``) or a nested `Map`; in Java, a `record` or any type with a value-based
`hashCode`, never a plain array, whose `hashCode` is identity-based.

**★ Symptom: a memoised boolean or counting function that recomputes every zero/false answer.**
Cause: the hit test is truthiness — `if (memo.get(k))` in TypeScript, `if (memo.get(k) != null &&
memo.get(k))` in Java. Fix: `memo.has(k)`, or compare against `undefined` / `null` explicitly. `0`,
`false` and `""` are legal cached answers.

**★ Symptom: the same function returns different answers on the second call with the same input.**
Cause: a memo hoisted to module or `static` scope while the answer depends on something outside the
key — the coin array, the grid, a configuration. Fix: allocate the table inside a wrapper so its
lifetime is one top-level call, or include the varying data in the key.

**Symptom: memoisation applied to a backtracking recursion and the answers are wrong.** Cause: the
function is not pure — it reads or mutates a shared `path`, `visited` or output array, so the
cached answer belongs to a state that no longer holds. Fix: either make the mutable state part of
the key (usually too large to be worth it) or accept that the recursion is not memoisable and
prune instead.

**Symptom: a memo table whose size is the product of two large ranges and the process runs out of
memory instead of time.** Cause: the state space, not the algorithm. Fix: notice the table size
before writing it — Θ(distinct states) is the space bound and it is often the binding one; a
recursion over `(index, runningSum)` with an unbounded sum is memoisable on paper only.

## Interview questions

**★ Does memoisation fix a stack overflow?**
No, and this is the trap in the question. Memoisation changes the number of *distinct* subproblems
computed, which fixes the time — `fib` goes from Θ(2ⁿ) to Θ(n) — but the recursion still descends
to the base case before any entry is written, so the maximum depth is unchanged and the overflow is
unchanged. The fix for depth is to remove the recursion: bottom-up tabulation, which computes the
same table in increasing order of subproblem size with a loop, or an explicit stack. That is also
the cleanest way to explain the relationship between memoised recursion and bottom-up DP — same
recurrence, same table, opposite direction, and only one of them uses the call stack.

**★ What can go wrong when you memoise?**
Four things, in roughly descending order of how often they appear. The key omits an argument the
answer depends on, which produces a deterministic wrong answer with no error. The hit test uses
truthiness, so every legitimately-zero or false answer is recomputed and the memo does nothing. The
key is an object or array in a JavaScript `Map`, which compares by identity, so no lookup ever
hits. And the memo outlives the data it was computed for — hoisted to module or `static` scope
while the answer also depends on the input array — so a second call serves the first call's
answers. Then a fifth that is about applicability rather than bugs: the function has to be pure, so
a backtracking recursion carrying a mutable path is usually not memoisable as written.

**★ How do you choose the memo key in each language?**
In TypeScript, a primitive: a template string like `` `${i}:${remaining}` `` for a `Map`, or nested
`Map`s if the components are already numbers and you want to avoid the string building. A `Map`
keyed on an array or object compares by reference, so a freshly constructed key never hits. In
Java, a `record` — `record Key(int i, int remaining) {}` — because the compiler generates
value-based `equals` and `hashCode`, which is exactly the contract `HashMap` needs; a plain `int[]`
as a key is the same identity bug as the JavaScript one, since arrays inherit identity `hashCode`.
When both components are small integers, a two-dimensional array indexed directly is better than
either: no hashing, no boxing, and the "not computed yet" sentinel is explicit.

**What is the space cost of memoisation, and when does it make the approach infeasible?**
Θ(number of distinct reachable states), which for a recursion over `(i, j)` is the product of the
two ranges. That is usually fine when both are bounded by the input size and is immediately
infeasible when one of them is a running sum, a bitmask over more than a handful of elements, or a
string built along the path. The senior move is to compute the state count before writing the code
and say it out loud: "the table is n × target, which at these constraints is fine" or "the second
dimension is unbounded, so memoising on it will not fit — I need a different state or a greedy
argument."

**★ What is the relationship between memoised recursion and bottom-up dynamic programming?**
They are the same recurrence and the same table, filled in opposite directions. Memoised recursion
(top-down) starts at the answer you want and descends, computing a subproblem the first time it is
asked for; bottom-up starts at the base cases and fills the table in increasing order of subproblem
size with a loop. Top-down computes only the reachable states, which is a real advantage when the
state space is sparse; bottom-up has no call stack, which is a real advantage when the depth is
large, and it often admits a rolling-array space optimisation that top-down does not. The pair of
sentences to have ready is: "I'd write it top-down first because the recurrence is the code, then
convert to bottom-up if the depth is a problem or if I can drop the table to two rows."

**Is every recursion memoisable?**
No — the function has to be pure with respect to its key. If the answer depends on anything not in
the key, the cache serves a wrong answer, and the two usual sources are mutable state carried along
the recursion (a shared `path`, a `visited` set, a partially built output) and data captured from
outside (the input array, the grid, a configuration) combined with a table whose lifetime is longer
than one top-level call. Backtracking recursions are the common non-memoisable case for exactly the
first reason: the answer at `(i, j)` genuinely depends on which elements the path has already used,
and putting that in the key usually makes the state space too large to be worth caching at all. The
alternative there is pruning, not memoising.

**Why is `if (memo.get(k))` wrong and `if (memo.has(k))` right?**
Because `0`, `false`, `""` and `NaN` are all legal answers and all falsy, so the truthy test treats
a correctly cached zero as a cache miss. For a counting problem where many subproblems legitimately
have zero ways, that is not a subtle inefficiency — it is the entire memo failing on precisely the
subtree that recursion spends most of its time in, and the function stays exponential while looking
memoised. `has` distinguishes presence from value; comparing the result against `undefined` does
the same thing with one lookup instead of two. In Java the equivalent is assigning `map.get(k)` to
a boxed `Long` or `Boolean` and comparing against `null`, never unboxing before the null check —
which would throw a `NullPointerException` on the first miss.

{/* FOOTER */}
