---
title: "Space is auxiliary space — what the algorithm allocates beyond its input, the recursion stack included — and the stack is the bound candidates forget: a recursive DFS on a path of a hundred thousand nodes is Θ(n) space and, in Node, a RangeError, because V8 does not eliminate tail calls"
sidebar_label: "04 · Space and the recursion stack"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. The error strings are MDN,
> [*too much recursion*](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion)
> (verbatim; ⚠️ MDN gives **no** stack-depth number and none is stated here). The Java facts are the
> JDK 25 javadocs for [`StackOverflowError`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/StackOverflowError.html)
> and the [`Thread`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.html)
> constructor's `stackSize` parameter (verbatim). ES2015's proper-tail-call section could **not**
> be fetched this session; the statement that V8 does not implement it is widely reported engine
> behaviour, not a quoted document. **No sandbox run.**

**When an interviewer asks for space, they mean *auxiliary* space — what your algorithm
allocates beyond the input it was handed — and the recursion stack counts.** A function that
allocates nothing explicit but recurses n deep uses Θ(n) memory, and in a JavaScript engine it
uses it in the worst possible place: the call stack, whose limit is implementation-defined and
small enough that a depth-first search written recursively over a hundred-thousand-node path
throws `RangeError: Maximum call stack size exceeded`. Java's default thread stack fails the
same way with `StackOverflowError`. Neither runtime rescues you with tail-call elimination —
the JVM has never had it, and V8 does not ship the one ES2015 specified — so a tail-recursive
rewrite changes nothing; the fix is an explicit stack, or a loop. This page is what counts as
space and what does not, in-place and the permission it needs, and the recursion stack as a bound
and a limit in both runtimes; its sibling [04b](04b-tail-calls-and-the-explicit-stack.md) is why
tail calls do not help and the conversion from recursive to iterative that every deep recursion
eventually needs.

## What counts

| Counts as auxiliary space | Does not count |
|---|---|
| a hash map or set built over the input | the input array or string itself |
| a copy — `slice`, spread, `Array.from`, `toSorted` | the output, when the problem requires it (say so) |
| a memo table, a DP table | constants — a few indices, a running sum |
| a queue or stack you allocate | — |
| **the recursion stack** — depth × frame | — |
| the sort's own working memory — Θ(n/2) references for the JDK's object sort at worst | — |

Two conventions to state rather than assume. The **output** is usually excluded — "Θ(1) auxiliary
beyond the result array" — because every algorithm that produces n items needs n slots. And
**in place** means Θ(1) auxiliary *and* the input modified; it requires permission, because the
caller may still need the original. "In place, if I may modify the input; otherwise Θ(n) for a
copy" is the sentence.

```ts
// Θ(1) auxiliary: reverses in place — the input is the workspace
export function reverseInPlace(a: number[]): void {
  for (let i = 0, j = a.length - 1; i < j; i++, j--) [a[i], a[j]] = [a[j], a[i]];
}

// Θ(n) auxiliary: the set of seen values grows with the input
export function hasDuplicate(a: number[]): boolean {
  const seen = new Set<number>();
  for (const x of a) { if (seen.has(x)) return true; seen.add(x); }
  return false;
}

// Θ(1) auxiliary with a sort — ONLY if the sort is in place and you may modify the input;
// note that a.sort() is in place in JavaScript and toSorted() is a copy
export function hasDuplicateSorted(a: number[]): boolean {
  a.sort((x, y) => x - y);                      // modifies the caller's array
  for (let i = 1; i < a.length; i++) if (a[i] === a[i - 1]) return true;
  return false;
}
```

## The recursion stack is space

Every active call holds a frame — its parameters, locals and return address — until it
returns. A recursion's space is therefore its **maximum depth** times the frame size, and the
depth is read off the recursion the same way time is read off the tree
([02b](02b-recursion-as-a-tree.md)): a call that shrinks by one is n deep; a call that halves is
log n deep; a DFS is as deep as the longest path it follows before backtracking.

| Recursion | Depth | Stack space | Note |
|---|---|---|---|
| binary search | log n | Θ(log n) | trivial; the iterative form is Θ(1) |
| merge sort | log n | Θ(log n) | plus Θ(n) for the merge buffers — the buffers dominate |
| quicksort, good pivots | log n | Θ(log n) | bad pivots: Θ(n) depth — the recursion, not the array, overflows |
| DFS on a balanced tree | log n | Θ(log n) | — |
| DFS on a path, a linked list, a skewed tree | n | Θ(n) | **the overflow case** |
| flood fill on a grid | up to the cell count | Θ(rows × cols) | a 1000 × 1000 grid recursed cell by cell overflows in Node |
| naive Fibonacci | n | Θ(n) | time is 2ⁿ; space only n — the tree is deep, not wide, at any moment |
| backtracking over n choices | n | Θ(n) plus the path | the output, if collected, is the big cost |

The Fibonacci row is the one to be able to explain: time is the *total* number of calls,
space is the *maximum simultaneously active* calls, which is the depth of one root-to-leaf
path.

## The limit is real, and it is not documented as a number

MDN names the failure and gives no figure:

> *"When there are too many function calls, or a function is missing a base case, JavaScript
> will throw this error."* — MDN, *too much recursion* — the string in Chrome, Node and Safari is
> `RangeError: Maximum call stack size exceeded`; in Firefox `InternalError: too much recursion`.

The limit is implementation-defined and depends on frame size, so no number is safe to state;
what is safe is that a recursion of depth 10⁵ fails and one of depth 10³ does not, and that the
problem's constraints tell you which you are in. Java fails at a comparable order of magnitude
on the default thread stack:

> *"Thrown when a stack overflow occurs because an application recurses too deeply."* — JDK 25,
> `StackOverflowError`

And the JVM offers a per-thread knob that the interviewer may know about — with a caveat in
the same paragraph:

> *"The stack size is the approximate number of bytes of address space that the virtual machine
> is to allocate for this thread's stack. The effect of the `stackSize` parameter, if any, is
> highly platform dependent."* — *"The virtual machine is free to treat the `stackSize`
> parameter as a suggestion."* — JDK 25, `Thread(ThreadGroup, Runnable, String, long stackSize)`

So "run it on a thread with a bigger stack" is a real Java answer for a known-deep recursion —
and a hedge, because the runtime may ignore it. The reliable answer in both languages is the
next section.

## Gotchas

**★ Symptom: "O(1) space" for a recursive DFS.** Cause: the call stack not counted. Fix:
Θ(depth) — the height of the tree, the length of the path; say it with the time bound, every
time.

**Symptom: "in place" claimed, and the caller's array is now sorted.** Cause: permission not
asked. Fix: "in place if I may modify the input" — and know that `sort()` mutates while
`toSorted()` copies.

**Symptom: the output counted as auxiliary space, and the bound looks worse than the
alternative's.** Cause: conventions unstated. Fix: "Θ(1) auxiliary beyond the result", said
explicitly; the interviewer accepts either convention if it is named.

**Symptom: merge sort's space given as Θ(log n).** Cause: only the stack counted. Fix: the
merge buffers are Θ(n) and dominate; the JDK's object sort documents up to n/2 references of
temporary storage.

**Symptom: naive Fibonacci's space given as Θ(2ⁿ).** Cause: total calls confused with
simultaneous calls. Fix: the depth of one root-to-leaf path — Θ(n); the tree is deep, not wide,
at any instant.

**Symptom: a stack-depth number quoted — "ten thousand frames".** Cause: a figure remembered
from one machine. Fix: implementation-defined and frame-size-dependent; MDN gives none. Say
"small enough that 10⁵ fails".

**Symptom: in Java, "just increase the thread stack size".** Cause: the knob mistaken for a
guarantee. Fix: the javadoc says the effect is highly platform dependent and the VM may treat
it as a suggestion; use it for a known depth, and convert for an unbounded one.

## Interview questions

**★ What is the space complexity of a recursive DFS, and why?**
Θ(h), where h is the maximum depth of the recursion — the height of the tree, or the length of
the longest path followed before backtracking — because each active call holds a frame until it
returns and the frames on the stack at any moment are one root-to-current path. On a balanced
tree that is log n; on a skewed tree, a linked list or a path graph it is n, which in Node
means `RangeError: Maximum call stack size exceeded` at depths the constraints routinely allow.

**★ Does auxiliary space include the input and the output?**
Neither, by convention — auxiliary is what the algorithm allocates beyond what it was given, and
the output is excluded because every algorithm producing n items needs n slots; but say the
convention. "Θ(1) auxiliary beyond the result array" is unambiguous. In place means Θ(1)
auxiliary with the input as workspace, and needs permission, because the caller may still hold
the original; in JavaScript `sort()` mutates and `toSorted()` copies, which is the difference
between the two bounds.

**Why is naive Fibonacci Θ(2ⁿ) time but only Θ(n) space?**
Time counts every call the tree ever makes — about 2ⁿ of them. Space counts the calls active
at once, which is one path from the root to the current leaf, at most n deep; siblings are
never on the stack together because the first returns before the second is called. The tree is
deep, not wide, at any instant.

**What is quicksort's space, and when does it go wrong?**
Θ(log n) for the recursion with good pivots, since each level halves; Θ(n) with consistently bad
pivots — an already-sorted input and a first-element pivot — because one side of every
partition is empty and the recursion is n deep. The array itself is sorted in place. The fix is
a randomised or median-of-three pivot, and recursing on the smaller side first while looping
on the larger, which bounds the stack to log n regardless of pivot quality.

---

← Prev: [03b · Union-find, and the limits of amortised](03b-union-find-and-the-limits-of-amortised.md) · Index: [Phase 1 — Complexity analysis](README.md) · Next → [04b · Tail calls, and the explicit stack](04b-tail-calls-and-the-explicit-stack.md)
