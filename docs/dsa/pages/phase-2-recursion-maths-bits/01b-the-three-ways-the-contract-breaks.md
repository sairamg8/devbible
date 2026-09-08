---
title: "A broken recursion fails in three distinguishable ways — no base case, a step that does not shrink the measure, and a base case some inputs stride past — and because all three surface as the same RangeError, the diagnosis is the contract read line by line rather than the stack trace"
sidebar_label: "01b · The three ways the contract breaks"
sidebar_position: 1.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. MDN, [*too much recursion*](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion),
> quoted verbatim for the failure and the engine-specific error types. 🔴 **No stack-depth number
> is stated: MDN documents none and none is a specification guarantee** — the limit is engine- and
> platform-dependent. The bugs themselves are common practice, written out rather than cited.
> Second file of topic 01 — [01](01-recursion-and-the-call-stack.md) is the frame and the
> contract. **No sandbox run.**

**All three of these produce the identical symptom, and two of them produce it only on inputs your
example did not include — which is why "it ran on the sample" is worth nothing here and reading the
contract out loud is worth everything.** No base case, a step that fails to shrink the measure, and
a base case the step strides past are three separate bugs with three separate fixes, and an
interviewer who says "what if the input is odd?" or "what if the graph has a cycle?" is probing a
specific one of them. This page is each failure in code, the fix, and the habit that prevents it.

## 1 · No base case at all

The pure form, and the rarest in a real answer — it usually appears as an *unreached* base case
instead (below). It is the one MDN names:

> *"When there are too many function calls, or a function is missing a base case, JavaScript will
> throw this error."* — MDN, *too much recursion*

```ts
// ✗ no clause 1: nothing returns without recursing
function countDown(n: number): void {
  console.log(n);
  countDown(n - 1);        // n goes negative and keeps going
}
```

The fix is the guard, and the guard goes at the top, before the body has a chance to do work. The
version of this that does survive review is the one where a base case exists for the *typed*
domain but not the *actual* one — a function documented for non-negative n, called with a negative
n by a caller that computed it from a subtraction.

## 2 · A step that does not make progress

The base case exists and is correct; the recursive step fails to shrink the measure. This is the
one that survives a code review, because the line *looks* like progress.

```ts
// ✗ no clause 2: the "smaller" input is the same input
function sum(nums: number[], i: number): number {
  if (i === nums.length) return 0;
  return nums[i] + sum(nums, i);   // i never advances
}

// ✗ subtler: progress on the wrong axis. lo moves, hi does not, and mid can equal lo.
function badBinarySearch(a: number[], target: number, lo: number, hi: number): number {
  if (lo > hi) return -1;
  const mid = lo + Math.floor((hi - lo) / 2);
  if (a[mid] === target) return mid;
  if (a[mid] < target) return badBinarySearch(a, target, mid, hi);   // mid, not mid + 1
  return badBinarySearch(a, target, lo, mid - 1);
}
```

`badBinarySearch` is the canonical version and it is worth being able to explain out loud: when
`hi === lo + 1`, `mid` computes to `lo`, and the recursive call is `(lo, hi)` again — an identical
subproblem, forever. The measure `hi - lo` did not strictly decrease. The fix is `mid + 1`, and the
general rule is that **each recursive call must exclude at least one element from the range it was
given.**

```java
// Java: the fixed form. Each call drops at least the element at mid, so hi - lo strictly shrinks.
static int binarySearch(int[] a, int target, int lo, int hi) {
    if (lo > hi) return -1;
    int mid = lo + (hi - lo) / 2;               // and this form is also the overflow-safe one
    if (a[mid] == target) return mid;
    if (a[mid] < target) return binarySearch(a, target, mid + 1, hi);
    return binarySearch(a, target, lo, mid - 1);
}
```

That `lo + (hi - lo) / 2` rather than `(lo + hi) / 2` is an integer-overflow fix, not a termination
fix — it matters in Java, where `int` addition wraps silently. It is developed on **05 · Integer
limits and overflow** *(not written yet)*; here it is only the habit.

The graph version of the same bug is a cycle: DFS on a graph without a `visited` set makes progress
in no measure at all, because `u → v → u` is an infinite descent. The "measure" for a graph DFS is
the number of *unvisited* vertices, and it only decreases if you actually mark them — which is why
a traversal that is correct on a tree becomes non-terminating on a graph with the same code.

```ts
// ✗ terminates on any acyclic input, never terminates on a cycle
function reachableBroken(g: Map<number, number[]>, u: number, target: number): boolean {
  if (u === target) return true;
  return (g.get(u) ?? []).some((v) => reachableBroken(g, v, target));
}

// ✓ the mark IS the measure: unvisited vertices strictly decrease
export function reachable(g: Map<number, number[]>, u: number, target: number, seen = new Set<number>()): boolean {
  if (u === target) return true;
  if (seen.has(u)) return false;      // second base case, and the one that makes it terminate
  seen.add(u);
  return (g.get(u) ?? []).some((v) => reachable(g, v, target, seen));
}
```

## 3 · A base case that some inputs step over

The base case exists and the step shrinks the measure — but the measure jumps *past* the base case
for a subset of inputs.

```ts
// ✗ no clause 3: base case is n === 0, the step is n - 2, and odd n never lands on it
function isEvenBroken(n: number): boolean {
  if (n === 0) return true;
  return !isEvenBroken(n - 2);        // 5 → 3 → 1 → -1 → -3 → …
}
```

The fix is either to widen the base case to a *predicate* rather than an equality (`if (n <= 0)`),
or to make the step land exactly. Widening is almost always the right call, and it is a habit worth
adopting everywhere: `if (lo >= hi)`, `if (i >= a.length)`, `if (node === null)`. An equality base
case is a base case with one input; an inequality base case is a base case with a whole half-line,
and the half-line survives an off-by-one in the step.

The same bug wearing tree clothes:

```ts
type TreeNode = { val: number; left: TreeNode | null; right: TreeNode | null };

// ✗ guards the CHILD instead of the SELF — null is not a legal input, so every call site must know
function sumBad(node: TreeNode): number {
  let s = node.val;
  if (node.left !== null) s += sumBad(node.left);
  if (node.right !== null) s += sumBad(node.right);
  return s;               // correct here, and it breaks the moment a call site passes null
}

// ✓ guards the SELF — null is a legal input with a defined answer, and that IS the base case
export function sumGood(node: TreeNode | null): number {
  if (node === null) return 0;
  return node.val + sumGood(node.left) + sumGood(node.right);
}
```

`sumGood` is shorter, has one guard instead of two, and accepts `null` at the top level for free.
"Make null a legal input with a defined answer" is the single highest-leverage habit in recursive
tree code, and it is worth saying out loud in a round because it is what removes the null checks
the interviewer is watching for.

The value the base case returns has to be the **identity for the combine**, and choosing it wrong
is a wrong answer rather than a crash — the more expensive failure, because nothing throws:

| Combine | Base case must return | Getting it wrong looks like |
|---|---|---|
| `+` (sum, count, height) | `0` | every answer off by the number of leaves |
| `*` (product) | `1` | every answer zero |
| `Math.max` | `-Infinity` / `Integer.MIN_VALUE` | a maximum of 0 on an all-negative tree |
| `Math.min` | `Infinity` / `Integer.MAX_VALUE` | a minimum of 0 on an all-positive tree |
| `&&` ("all nodes satisfy P") | `true` | every empty subtree fails the predicate |
| `\|\|` ("some node satisfies P") | `false` | every empty subtree passes |
| list concatenation | `[]` | a `null` spread into a spread, or a TypeError |

## The check, as a habit

Before the recursive line is written, say three sentences:

1. *"The base case is `<input>`, and it returns `<value>`, because the contract says `<sentence>`."*
2. *"The measure is `<quantity>`, and it strictly decreases because `<the call drops at least one>`."*
3. *"Every input reaches the base case because the measure is bounded below and the guard is `≤`
   rather than `===`."*

Anything you cannot finish is the bug. This is faster than a stack trace, and it is the only method
that works for the two failures that are invisible on the sample input.

## Gotchas

**★ Symptom: `RangeError: Maximum call stack size exceeded` (Chrome, Node, Safari) or
`InternalError: too much recursion` (Firefox), and no obvious loop in the code.** Cause: one of the
three contract failures, or a genuinely deep but correct recursion. Fix: diagnose the contract
before reaching for a conversion, because a *missing* base case and a *deep* recursion produce the
identical error and have opposite fixes — one is a one-line guard, the other is
[01f](01f-converting-recursion-to-an-explicit-stack.md). MDN names both causes in one sentence and
names the engine difference explicitly: *"`InternalError` in Firefox; `RangeError` in Chrome and
Safari."*

**★ Symptom: a binary search or range recursion that hangs, or errors after a long pause, on
exactly the inputs where the target is absent.** Cause: clause 2 — a recursive call on the *same*
range, `(mid, hi)` instead of `(mid + 1, hi)`, so `hi - lo` stops shrinking once the range is two
wide. Fix: every recursive call excludes at least one element of the range it was given; check the
two-element case by hand, because that is the only size at which it misbehaves.

**★ Symptom: correct on even inputs, stack overflow on odd ones.** Cause: clause 3 — the step
strides past an equality base case. Fix: widen the base case to an inequality (`n <= 0`,
`lo >= hi`, `i >= a.length`) so a whole half-line is terminal rather than a single point.

**★ Symptom: a traversal that is correct on the tree test and never returns on the graph test with
identical code.** Cause: there is no measure at all on a cyclic structure — `u → v → u` shrinks
nothing, so clause 2 is vacuously false however the code is written. Fix: a `visited` set, checked
as a second base case *before* the marking; the measure is the count of unvisited vertices and it
decreases only because you mark.

**★ Symptom: a recursion over a tree that throws on an empty input but is correct everywhere
else.** Cause: the base case guards the children rather than the self, so `null` is outside the
function's domain. Fix: `if (node === null) return <identity>;` and pick the identity from the
combine — the table above.

**★ Symptom: a maximum-path or maximum-value recursion that returns 0 on an all-negative tree.**
Cause: the base case returns 0 for a `Math.max` combine, so an empty subtree beats every real
value. Fix: return `-Infinity` in TypeScript or `Integer.MIN_VALUE` in Java; and if the Java
version then adds to it, that addition underflows, which is the same problem in the other
direction and is why some solutions carry an explicit "no value" sentinel instead.

**Symptom: an off-by-one that only appears at the very top of the recursion.** Cause: the base case
was written for the recursive call's domain, not the caller's — `f(n - 1)` is guarded correctly but
`f(0)` from the top level hits a branch nobody considered. Fix: test the recursion by calling it
directly on each base-case input and on the smallest non-base input, before testing it on the
example.

**Symptom: a recursion guarded with `if (n === 1)` that is called with `n === 0` from a caller that
computed n as a length.** Cause: an equality guard against a value that is one step off the
domain's floor. Fix: `if (n <= 1)`, and state which values that covers.

**Symptom: `some`/`every`/short-circuit recursion that is correct but visits far more than
expected.** Cause: not a contract failure at all — the recursion terminates, but the visited set is
checked *after* recursing rather than at entry, so a vertex is entered once per incoming edge even
though it returns immediately. Fix: check `seen` as the first line of the function; it is the same
"mark on enqueue, not on dequeue" rule BFS has.

## Interview questions

**★ Your recursion overflows the stack. Walk me through what you check.**
First, whether it is a bug or a size problem, because the error message is identical and the fixes
are opposite. I name the base case and the measure: is there an input that returns without
recursing, does every call strictly shrink the measure, does every input land on the base case
rather than stride past it. Concretely, that means checking the two-element range for a range
recursion, the odd input for a step that moves by two, and the presence of a visited set for
anything that walks a graph. If the contract holds, then the depth is genuinely proportional to the
input, and the fix is structural — an explicit stack, or a loop if the function is tail-recursive.
What I would not do is make it tail-recursive and hope: V8 does not implement proper tail calls and
the JVM never had tail-call elimination, so the frame count is identical.

**★ Why do you write `if (node === null) return 0;` rather than checking the children before
recursing?**
Because it makes `null` a legal input with a defined answer, which is what a base case is. Guarding
the children means two guards instead of one, means the top-level call site has to know the tree is
non-empty, and means the pattern breaks as soon as a caller hands you an empty subtree. Guarding
the self means one guard, one recursive expression, and a total function whose contract is a
sentence: "returns the height of the subtree rooted here; the empty subtree has height 0." The only
care needed is that the value returned is the identity for the combine — 0 for a sum, 1 for a
product, `Integer.MIN_VALUE` for a maximum, `true` for a universal predicate. A wrong identity
returns a wrong answer with no error at all.

**★ Can a recursion with a missing base case still pass all your tests?**
Yes, and that is exactly why the check is the contract rather than the test run. A step of `n - 2`
against `n === 0` is correct on every even input and unbounded on the first odd one. A graph
traversal without a visited set terminates on any acyclic input, which includes every tree in your
test file. A range recursion that fails to exclude `mid` only misbehaves when the range narrows to
two elements *and* the target is absent. In each case the sample input is inside the subset where
the broken contract happens to hold, so passing is evidence of nothing.

**★ How do you prove a recursion terminates without running it?**
By exhibiting the measure and showing it strictly decreases into a bounded-below domain. For a
range recursion the measure is `hi - lo`, and the proof obligation is that each recursive call gets
a proper subrange — `mid + 1` rather than `mid`. For a tree it is the number of nodes in the
subtree, which decreases because a child's subtree excludes the parent. For a graph it is the count
of unvisited vertices, which decreases only because you mark. For a subset or permutation recursion
it is the number of remaining choices. If you cannot name the measure, you have not proved
anything, and in practice that is exactly where the non-terminating recursions live.

**What is the difference between "the step doesn't shrink" and "the base case isn't reached"?**
The first is a step that leaves the measure unchanged on at least one input — the recursive call
gets the same range, the same index, the same node — so the recursion is stationary. The second is
a step that shrinks the measure perfectly well but skips over the terminal value, so the measure
runs off past the bottom of the domain and keeps going negative. They look the same from the error
message and they have different fixes: the first is fixed by excluding an element from the
subproblem, the second by widening the guard from an equality to an inequality. Being able to say
which one you have is the difference between a targeted fix and adding `if (n < 0) return` and
hoping.

**Where does a `visited` set belong — before the recursive call or at the top of the function?**
At the top of the function, as a base case: check it first, mark it second, recurse third. Checking
before the call instead works for correctness but lets a vertex be entered once per incoming edge,
which is the recursive analogue of BFS marking on dequeue — the traversal is still correct and the
"each vertex once" argument is no longer true. Marking *after* the recursive calls is a different
and worse bug: the neighbour re-enters the current vertex while it is still unmarked, and the two
recurse into each other without bound.

{/* FOOTER */}
