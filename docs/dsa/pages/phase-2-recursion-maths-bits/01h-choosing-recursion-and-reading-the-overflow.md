---
title: "The decision is not \"recursion or loop\" in the abstract but \"is this depth bounded by log n, by the problem, or by the input\" — and because neither Node nor the JVM documents a maximum depth, the constraint in the problem statement is the only evidence you get before it fails"
sidebar_label: "01h · Choosing, and reading the overflow"
sidebar_position: 1.7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. The JavaScript error strings and their engine mapping are MDN,
> [*too much recursion*](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion),
> quoted verbatim. 🔴 **No maximum depth is stated for Node, V8, any browser or the JVM — MDN
> documents none and it is not a specification guarantee**; the limit is engine- and
> platform-dependent and this page says so rather than giving a figure. Java's `StackOverflowError`
> and the `Thread` constructor's `stackSize` parameter are the JDK 25 javadocs quoted in
> [phase 1 · 04](../phase-1-complexity/04-space-and-the-recursion-stack.md), named here as
> mechanism. ⚠️ I could not confirm from a primary source whether Node exposes a supported
> stack-size setting or what its default is, so no such knob is claimed. That V8 does not implement
> ES2015 proper tail calls and the JVM never had tail-call elimination is widely reported engine
> behaviour, stated as such. Last file of topic 01. **No sandbox run.**

**Every recursion in this topic can be converted, so the interesting question is when to bother —
and the answer is a property of the depth, not of taste.** Logarithmic depth: keep the recursion,
it reads as the recurrence and it will never overflow. Depth bounded by the problem: keep it and
say why. Depth proportional to the input, on a problem whose constraints allow the input to be
large: convert, and say that too. There is a fourth case that is not a performance question at
all — depth controlled by untrusted input — and it is the one that turns a recursion into an
availability incident. This page is that decision, the tail-position special case where the
conversion is a plain loop rather than a stack, and what the failure actually looks like in each
runtime when you get it wrong.

## Tail-recursive functions do not need a stack at all

If the recursion is in tail position there is no work to resume, so rule 2 produces no resume point
and rule 1 produces no frame: the parameters become mutable locals and the call becomes an
assignment.

```ts
// tail-recursive
function gcdRec(a: number, b: number): number {
  return b === 0 ? a : gcdRec(b, a % b);
}

// the same function as a loop: no stack, Θ(1) space, purely mechanical conversion
export function gcd(a: number, b: number): number {
  while (b !== 0) { const t = a % b; a = b; b = t; }
  return a;
}
```

Half-tail cases are worth recognising too: quicksort recurses twice, but the second call is in tail
position, so you can loop on the larger side and recurse only on the smaller. That bounds the stack
to Θ(log n) regardless of pivot quality, which is the standard production quicksort and a good
answer to "what if the pivots are bad".

```java
// recurse on the smaller side, loop on the larger — stack depth is log n even with bad pivots
static void quicksort(int[] a, int lo, int hi) {
    while (lo < hi) {
        int p = partition(a, lo, hi);
        if (p - lo < hi - p) { quicksort(a, lo, p - 1); lo = p + 1; }   // recurse small, loop large
        else                 { quicksort(a, p + 1, hi); hi = p - 1; }
    }
}
```

## When recursion is genuinely clearer, and when it is not

The conversion always exists, so the choice is about readability against a depth risk. Say the
trade-off rather than defaulting:

| Keep the recursion | Convert it |
|---|---|
| depth bounded by log n — binary search, balanced-tree operations, merge sort, quicksort with a randomised pivot | depth proportional to n — linked lists, path graphs, a string one character per call |
| depth bounded by the problem — trie over short words, recursion over the digits of an `int`, a fixed board size | grids flooded cell by cell, where a snake-shaped region is a path through every cell |
| the combine step is the algorithm and the recursion reads as the recurrence — divide and conquer, tree DP | a DFS on a graph that could be a chain, on any real constraint |
| backtracking, where the undo after the call is the whole point and depth is the (small) number of decisions | anything whose depth is attacker-controlled: user-supplied nesting, an uploaded document, a category tree of unknown shape |
| a parser whose grammar depth is bounded by a validated input size | a parser over untrusted input, which needs an explicit depth budget at minimum |

The senior version of the answer names both: *"I'd write it recursively because the recurrence is
the code, and note that it's Θ(h) on the call stack — at h up to 10⁵ I'd convert to an explicit
stack, which is mechanical and doesn't change the bound."* That sentence gets full credit without
writing the iterative version at all.

## What the overflow looks like, per runtime

**JavaScript.** MDN names the failure and the two error types, and gives no depth:

> *"When there are too many function calls, or a function is missing a base case, JavaScript will
> throw this error."* — MDN, *too much recursion*

> *"`InternalError` in Firefox; `RangeError` in Chrome and Safari."* — MDN, *too much recursion*

So in Node the exception is a `RangeError`, message `Maximum call stack size exceeded`; in Firefox
an `InternalError` reading `too much recursion`. Two practical consequences. First, it is a
catchable exception like any other, so a `try`/`catch` around a deep recursion *will* catch it — and
should not, because the stack is unwound to an arbitrary point and any invariant the recursion was
maintaining is now half-updated. Second, the depth at which it fires is not a property of the
function alone: it depends on how much of the stack the surrounding code was already using, so the
same function called from the top level and from deep inside a framework's call chain fails at
different depths.

**Java.** The recursion throws `StackOverflowError` — an `Error`, not an `Exception`, which is the
language's way of saying *do not catch this*. Catching it is worse than in JavaScript, because
`Error` signals a condition the application is not expected to recover from, and the stack may
already be too shallow to run the handler. The stack size is a per-thread property: the JVM takes a
size hint through the `Thread` constructor's `stackSize` parameter, which the JDK 25 javadoc
describes as highly platform dependent and free to be treated as a suggestion (quoted in full in
[phase 1 · 04](../phase-1-complexity/04-space-and-the-recursion-stack.md)), and there is a
corresponding VM flag. Running a known-deep recursion on a thread created with a larger stack is a
real technique for a bounded depth; it is not a fix for an unbounded one, and the javadoc's own
hedging is why.

🔴 **Neither runtime documents a maximum depth, and any number you have seen is a measurement of
one machine with one frame size.** The correct statement is that the limit is engine- and
platform-dependent, that a depth of 10³ is safe everywhere and a depth of 10⁵ is not, and that the
problem's constraints tell you which regime you are in without measuring anything.

## Gotchas

**★ Symptom: a `try`/`catch` around a deep recursion that "handles" the overflow, and the data is
corrupt afterwards.** Cause: `RangeError` is catchable and `StackOverflowError` is technically
catchable too, but the stack has been unwound to an arbitrary point mid-update. Fix: do not catch
it; bound the depth or convert. In Java, `StackOverflowError` is an `Error` precisely to signal
that recovery is not expected.

**★ Symptom: "it works locally and overflows in the service".** Cause: the depth at which the
limit fires depends on how much stack the surrounding code already consumed, which differs between
a direct call and one nested inside a framework's chain. Fix: never tune to a depth; convert
anything whose depth is a function of input size.

**Symptom: an explicit-stack conversion that is slower than the recursion.** Cause: the frame is a
heap-allocated object per node, where the runtime's frame was a stack push. Fix: this is a real
constant-factor cost and it is a legitimate reason to keep the recursion when the depth is
provably small; it is not a reason to keep it when the depth is the input size. Say the trade-off
rather than pretending the conversion is free.

**Symptom: quicksort converted to "iterative" by pushing both halves onto an explicit stack, and
the stack grows to Θ(n).** Cause: both sides pushed unconditionally, so a bad pivot produces n
entries. Fix: push the larger side and loop on the smaller (or the reverse, with the loop on the
larger) — the stack is then Θ(log n) because each pushed range is at most half the current one.

**★ Symptom: a number quoted for the maximum recursion depth — "Node handles about ten thousand
frames".** Cause: a figure remembered from one measurement on one machine with one frame size. Fix:
neither runtime documents a maximum depth; what exists is a stack size in bytes and a frame size
you control, so the depth is a division. State it as engine- and platform-dependent, and use the
problem's constraints instead: 10³ deep is safe everywhere, 10⁵ deep is not.

**★ Symptom: a recursion whose depth comes from user input — nesting in an uploaded JSON document,
a category tree, a user-supplied filter expression — and a single request takes the process down.**
Cause: an unbounded depth on an untrusted path. Fix: an explicit depth budget threaded through the
recursion and checked as an extra base case, rejecting the input past the limit; or the iterative
form. This is a control, not an optimisation, and it belongs in the code review checklist for any
parser or serialiser exposed to a client.

**Symptom: `-Xss` or a bigger thread stack applied as the fix, and it still fails in production
under load.** Cause: the knob is per thread, so a larger stack multiplies by the number of threads
and the javadoc explicitly reserves the right to ignore it — the JDK 25 `Thread` documentation
calls the effect *highly platform dependent* and says the VM may treat the value as a suggestion.
Fix: use it for a depth you can bound and have measured a need for; convert for a depth you
cannot bound.

**Symptom: a tail-recursive-looking function that is not actually in tail position because of a
surrounding expression.** Cause: `return 1 + f(n - 1)` or `return f(n - 1) || g(n)` — the call is
an operand, so work follows it. Fix: the test is whether the recursive call's value is returned
*unchanged*; if any operator, cast, `try` block or logging statement wraps it, it is not a tail
call and the loop conversion needs an accumulator.

**Symptom: converting a recursion to a loop and quietly changing the traversal order, breaking a
test that depended on it.** Cause: the loop written from the algorithm rather than from the
recursion. Fix: convert mechanically first — same order, same output — and only then simplify. An
order change is a legitimate optimisation and an illegitimate accident.

## Interview questions

**★ How does the failure look different in Node and in Java, and does that change what you do?**
In Node it is a `RangeError` with the message `Maximum call stack size exceeded`; MDN documents
that the type differs by engine — `InternalError` in Firefox, `RangeError` in Chrome and Safari.
In Java it is a `StackOverflowError`, which is an `Error` rather than an `Exception`, meaning the
platform is telling you not to catch it. That difference matters for one thing only: in JavaScript
the overflow is a catchable exception and it is tempting to wrap the recursion in a `try`, which
you should not do, because the stack has been unwound at an arbitrary point and whatever the
recursion was mutating is half-updated. Neither runtime documents a maximum depth, so in both the
answer to "at what depth" is that it is engine- and platform-dependent and the constraints, not a
measurement, decide whether you convert.

**★ When would you keep the recursion, knowing it could overflow?**
When the depth is provably bounded and small: logarithmic in the input, as in binary search, a
balanced-tree operation, merge sort or quicksort with a randomised pivot and the recurse-on-the-
smaller-side trick; or bounded by the problem, as in a trie over short words or a recursion over
the digits of an `int`. Also when the recursion *is* the specification — a divide-and-conquer
recurrence or a backtracking search reads as the algorithm and the iterative version reads as
bookkeeping, and the frame object costs a heap allocation per node that the runtime's frame did
not. What I would not do is keep it when the depth is proportional to an input the problem allows
to be large, or when the depth is controlled by untrusted input, because that stops being a
correctness question and becomes an availability one.

**How do you bound quicksort's stack without making it fully iterative?**
By exploiting that the second recursive call is in tail position: recurse on the smaller partition
and loop on the larger, updating `lo` or `hi` in place. Each recursive call then handles at most
half the current range, so the depth is Θ(log n) regardless of how bad the pivots are — an
already-sorted input with a first-element pivot is still Θ(n²) in *time*, but it no longer
overflows. The same trick applied to an explicit-stack version means pushing the larger side and
looping on the smaller, which keeps the stack Θ(log n) instead of Θ(n).

**★ How deep can a recursion go in Node, or in Java?**
Neither runtime documents a number, and any figure you have seen is a measurement of one machine
with one frame size rather than a guarantee. What the runtimes have is a stack size in bytes; what
your function has is a frame containing every parameter and local you declared; the depth is the
division, so it changes when you add a variable. MDN gives no figure at all and names only the
failure and its engine-specific error type. The useful version of the answer is a regime rather
than a number: a depth of a few thousand is safe in practice everywhere, a depth of 10⁵ is not, and
the problem's constraints tell you which one you are in before you write a line. That is also why
"it worked on my machine at depth n" is not evidence — the depth at which it fires depends on how
much stack the surrounding code had already consumed.

**★ Should you catch a stack overflow?**
No, in both languages, for the same reason and with a different amount of enforcement. In
JavaScript the overflow is a `RangeError`, an ordinary catchable exception, so a `try` around the
recursion will swallow it — and the stack has been unwound at an arbitrary point, so anything the
recursion was mutating (a shared path, a partially painted grid, a half-built output) is in an
inconsistent state and the caught error tells you nothing about where. In Java it is a
`StackOverflowError`, deliberately an `Error` rather than an `Exception`, which is the platform
saying recovery is not expected; catching it may also fail because the handler itself needs stack.
The right response is to prevent it: bound the depth, or convert.

**★ You have a recursive parser over user-supplied input. What is the risk and what do you do?**
The depth is attacker-controlled, so the maximum recursion depth is a property of the request
rather than of your code, and a deeply nested document is a one-request denial of service. The fix
is a depth budget passed through the recursion and checked as an additional base case — reject
beyond the limit with a clear error, rather than letting the runtime decide — plus, where the input
size warrants it, an iterative parser with an explicit stack so the bound is memory rather than the
call stack. Real parsers do exactly this, which is why nesting limits appear in their
documentation. This is the case where "recursion depth" stops being a complexity question and
becomes a security one.

**Why is `return 1 + f(n - 1)` not a tail call?**
Because the recursive call's value is not returned unchanged — there is an addition waiting on it,
so the current frame has to survive the call in order to perform that addition, and the runtime has
no opportunity to reuse it even in a language that eliminates tail calls. The test is mechanical:
is the recursive call the entire returned expression? `return f(...)` yes; `return 1 + f(...)`,
`return f(...) || g(...)`, `return Math.max(f(...), g(...))`, and anything inside a `try` block, no.
Converting a non-tail recursion to a loop therefore needs either an accumulator parameter (which
turns it into a tail recursion first) or an explicit stack.

**If a bigger thread stack is available in Java, why is it not the answer?**
Because it is a hedge, not a bound. The JDK's own documentation for the `Thread` constructor's
`stackSize` parameter says the effect is highly platform dependent and that the virtual machine is
free to treat the value as a suggestion, so you cannot rely on getting the depth you asked for.
Beyond that, the setting is per thread, so a service that raises it pays the cost on every thread
in the pool, and it converts a crash at depth d into a crash at some larger depth d′ without
telling you what d′ is. It is a reasonable measure when the depth is known and bounded and the
recursion is genuinely clearer — a compiler pass over an AST of known shape, say. It is not a
substitute for converting a recursion whose depth is the input size.

{/* FOOTER */}
