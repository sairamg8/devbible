---
title: "A recursive function is a contract with two clauses — a base case that returns without recursing, and a step that provably moves every input toward it — and the frame that makes the contract work is also the space bound and the reason a hundred-thousand-deep recursion is a RangeError rather than a slow answer"
sidebar_label: "01 · Recursion and the call stack"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. The JavaScript error facts are MDN,
> [*too much recursion*](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion)
> (quoted verbatim below). 🔴 **MDN documents no stack-depth number, and none exists as a
> specification guarantee** — the limit is engine- and platform-dependent, and no figure for Node,
> V8 or any browser appears on this page or its siblings. Java's `StackOverflowError` and the
> `-Xss` / `stackSize` knob are named as mechanism, without a number, from the JDK 25 javadocs
> quoted in [phase 1 · 04](../phase-1-complexity/04-space-and-the-recursion-stack.md). The
> recursion patterns themselves are common practice, written out rather than cited. **No sandbox
> run.**

**Recursion is not a trick and it is not "a loop written strangely" — it is a claim you are making
about a function, and the claim has exactly two clauses: there is an input on which the function
returns without calling itself, and every other input is transformed by the recursive step into
one that is strictly closer to that input.** Break either clause and the program does not produce
a wrong answer; it produces a `RangeError` or a `StackOverflowError`, because each unreturned call
holds a frame on a stack whose size the runtime picked and neither language documents. That makes
recursion the one control structure whose *correctness* argument and whose *resource* argument are
the same argument — the thing that proves termination (progress toward the base case) is the thing
that bounds the depth, and the depth is the memory. This page is what a frame actually holds, the
two-clause contract stated as something you can check line by line, and the reason the contract and
the resource bound are read off the same measure. Its siblings take it from there:
[01b](01b-the-three-ways-the-contract-breaks.md) is the three distinct ways the contract is broken,
[01c](01c-recursion-as-the-shape-of-the-data.md) is the shapes — trees, grids, decision sequences —
where recursion is not a stylistic choice but the structure of the data written down,
[01d](01d-tail-position-and-mutual-recursion.md) is tail position and functions that recurse into
each other, [01e](01e-memoising-a-recursive-function.md) is memoisation, and
[01f](01f-converting-recursion-to-an-explicit-stack.md),
[01g](01g-post-order-and-the-resume-point-frame.md) and
[01h](01h-choosing-recursion-and-reading-the-overflow.md) are the conversion to iteration, the
post-order case, and what the overflow looks like in each runtime.

[Phase 1 · 04](../phase-1-complexity/04-space-and-the-recursion-stack.md) owns the *cost*: that the
recursion stack is auxiliary space, that its bound is Θ(depth), and what the runtime limits are.
[Phase 1 · 04b](../phase-1-complexity/04b-tail-calls-and-the-explicit-stack.md) owns *tail calls*
and why they do not rescue you. This page and its siblings own **writing** the recursion, converting
it, and the failure modes you meet at a whiteboard: the division of labour is that phase 1 states
the bound and phase 2 produces the code that has it.

## What a frame holds, and why it is the space bound

A call does not just jump. The runtime pushes an **activation record** — a frame — and the frame is
what makes returning possible at all. Every language on this track puts roughly the same four things
in it:

| In the frame | Why it must be there | What makes it big |
|---|---|---|
| **the arguments** | the callee reads them; each call has its own copy of the *bindings* | many parameters; large value types in Java (a `record` passed by value is a reference, so usually small) |
| **the local variables** | `let mid`, `int pivot` — each invocation needs its own | a local array allocated per call is on the *heap*, but the reference is in the frame |
| **the return address** | where to resume in the caller after this call returns | fixed |
| **saved registers / bookkeeping** | the callee may clobber registers the caller still needs | fixed, and platform-specific |

Two consequences fall straight out, and both get asked.

**First: space is depth × frame size, not total calls.** Only the calls that have *not yet
returned* hold frames. Naive Fibonacci makes about 2ⁿ calls in total and is Θ(n) space, because at
any instant the live frames are a single root-to-leaf path — the left subtree has fully returned
before the right one is entered. That distinction — total calls is time, simultaneously-live calls
is space — is the one sentence phase 1's
[02b](../phase-1-complexity/02b-recursion-as-a-tree.md) draws as a tree.

**Second: a "small" recursion can still overflow, because the frame is not one word.** The frame
carries every local you declared, so a recursive function with eight locals and a destructured
parameter object overflows shallower than one with two `int`s. This is precisely why no depth
figure is quotable: the limit is a byte budget divided by a frame size you control, on a stack
whose size the engine chose.

```ts
// Every live call here holds: node, i, and the loop's temporaries.
// Depth = length of the longest root-to-leaf path. Space = that, times the frame.
type TreeNode = { val: number; left: TreeNode | null; right: TreeNode | null };

export function height(node: TreeNode | null): number {
  if (node === null) return 0;                       // base case: returns without recursing
  return 1 + Math.max(height(node.left), height(node.right));
}
```

When `height` is called on the left child, the parent's frame is still live — it is holding the
return address it needs to compute `1 + Math.max(...)` once both children answer. That is the
whole mechanism, and it is why the "combine after the calls return" style costs depth while a loop
costs nothing.

## The contract: a base case, and progress toward it

MDN states the two clauses in the plainest possible form, and it is worth having the words:

> *"A function that calls itself is called a recursive function."* — *"Once a condition is met, the
> function stops calling itself."* — *"This is called a base case."* — MDN, *too much recursion*

> *"When there are too many function calls, or a function is missing a base case, JavaScript will
> throw this error."* — MDN, *too much recursion*

Stated as something you can check line by line before you run anything:

1. **There is at least one input for which the function returns without recursing.** Name it. If you
   cannot name it, the function does not terminate.
2. **Every recursive call is made on an input strictly closer to a base case, under some measure
   that cannot decrease forever.** Name the measure: the array length, `hi - lo`, the number of
   remaining choices, the depth budget. A measure that is a non-negative integer and strictly
   decreases is a proof of termination; anything vaguer is a hope.
3. **The base case is reachable from every input the function accepts.** Clause 2 is about *moving*;
   clause 3 is about *arriving*. They fail separately, which is why they are separate clauses.

The habit that makes this automatic: write the base case *first*, before the recursive line exists,
and write the function's contract as a sentence — *"returns the height of the subtree rooted here;
an empty subtree has height 0"* — because the sentence tells you what the base case must return.
Half of all recursion bugs at a whiteboard are a base case that returns the wrong *value*, not a
missing one.
## Gotchas

**★ Symptom: "the space is O(1), it's just recursion — I didn't allocate anything."** Cause: the
frames not counted as memory. Fix: Θ(depth) × frame, always. The depth is the height of the tree,
the length of the path, the number of cells in a snake-shaped region — and it is auxiliary space
in exactly the sense an interviewer means.
[Phase 1 · 04](../phase-1-complexity/04-space-and-the-recursion-stack.md) states the bound in full.

**★ Symptom: naive Fibonacci's space quoted as Θ(2ⁿ).** Cause: total calls confused with live
calls. Fix: time counts every call the tree ever makes; space counts the calls that have not
returned, which at any instant is one root-to-leaf path. Θ(2ⁿ) time, Θ(n) space. The tree is deep,
not wide, at any given moment.

**★ Symptom: a recursion that is correct in Java and overflows in Node at the same depth, or the
reverse.** Cause: different default stack budgets and different frame sizes; nothing about the
algorithm changed. Fix: do not tune to a limit that neither runtime documents as a number — pick
the structure the constraint demands. A constraint of 10⁵ on a linear structure means iterative,
in both languages, without measuring anything.

**★ Symptom: a helper with six parameters and four locals overflows shallower than a two-parameter
version of the same recursion.** Cause: the frame is not one word — every parameter and local you
declared is in it, so the depth a fixed byte budget can hold is inversely proportional to a size
you chose. Fix: when depth is the binding constraint, hoist invariants (the grid, the target, the
memo, the output accumulator) into a closure or an instance field rather than threading them
through every frame.

**Symptom: a local `new Array(n)` inside a recursive function and a space bound of Θ(depth).**
Cause: the array is on the heap and does not show up in the frame, but it is still live for as
long as the frame is. Fix: the bound is Θ(depth × per-call allocation) — a per-call copy inside a
depth-n recursion is Θ(n²) space, not Θ(n), and that is a common accidental blow-up in "recurse on
`arr.slice(1)`" solutions.

**Symptom: "recursion is slower because of function-call overhead", offered as the complexity
answer.** Cause: a constant-factor argument mistaken for an asymptotic one. Fix: the call overhead
is a constant factor and does not change the class; what *does* change is the space, from Θ(1) to
Θ(depth), and the fact that the space is on a stack with a hard, undocumented ceiling. Say the
space, not the speed.

**Symptom: a recursion in a request handler that is fine in every test and takes the process down
in production.** Cause: on Node, an uncaught `RangeError` propagates like any other exception, but
the depth at which it fires depends on how deep the *rest* of the stack already was when the
recursion started — a handler called from a deep async chain has less headroom than the same
function called from the top level. Fix: recursion depth that is a function of untrusted input
(a user-supplied nesting depth, a JSON document, a category tree) is an availability concern;
bound it explicitly or convert it.

## Interview questions

**★ Why is a recursive DFS Θ(depth) space when it allocates nothing?**
Because a call that has not returned holds a frame — its parameters, its locals, its return
address, and whatever registers the calling convention makes the caller responsible for — and a
frame is memory. The frames live simultaneously are exactly the calls on the path from the entry
point to the call currently executing, so the space is the maximum depth times the frame size.
Nothing was allocated on the heap; the space is on the call stack, which is the smaller and less
forgiving of the two. That is also why the number is depth and not total calls: naive Fibonacci
makes about 2ⁿ calls and holds at most n frames, because the left subtree fully returns before
the right one starts.

**★ What actually goes on the stack when a function calls itself?**
An activation record: the arguments, as this invocation's own bindings; the locals declared in the
body; the address to resume at in the caller; and the saved registers. It stays there until the
call returns, which is why a function that does work *after* its recursive calls — the combine
step, `1 + Math.max(left, right)` — cannot have its frame discarded at the point of call; the
frame is holding the return address that the addition needs. The frame size varies from function
to function because the locals are yours, and that is the mechanical reason no runtime publishes a
maximum depth: what it has is a stack size in bytes, and the number of frames that fits is a
division.

**★ What has to be true for a recursive function to terminate?**
Two things, and they fail separately. There has to be at least one input on which the function
returns without calling itself — the base case — and every recursive call has to be made on an
input that is strictly closer to a base case under some measure that is a non-negative integer:
the array length, `hi - lo`, the count of unvisited vertices, the number of remaining choices. A
strictly decreasing non-negative integer cannot decrease forever, and that is the termination
proof. There is a third condition that is really the second one done carelessly — the base case
has to be *reachable*, and a step of `n - 2` against a base case of `n === 0` moves and shrinks
correctly and still never arrives for odd n.
[01b](01b-the-three-ways-the-contract-breaks.md) is each failure with its own fix.

**★ How do you state the complexity of a recursive solution so that the interviewer believes it?**
Two sentences with the recursion named in both. Time: the number of calls times the work per call
— "each node is visited once and does constant work, so Θ(n)" — or, when the shape is a split, the
recurrence, which
[phase 1 · 08](../phase-1-complexity/08-recurrences-and-the-master-theorem.md) solves. Space: the
maximum depth, named as a property of the input — "Θ(h) for the recursion stack, which is log n on
a balanced tree and n on a skewed one." Giving the time and stopping is the omission interviewers
score; the recursion stack is the space bound they are waiting for.

**How do you decide whether a problem wants recursion at all?**
By asking whether the *data* is recursive and whether the depth is bounded. A tree is a value plus
two subtrees, so a function over a tree is a base case plus a combine over two recursive results,
and writing it any other way is fighting the type. A grid, a decision sequence and a divide-and-
conquer split are the same story with a different branching factor. Against that, the depth: if
the depth is proportional to the input size and the input can be 10⁵, the recursion is correct and
unusable, and the answer is the same algorithm with an explicit stack. Recursion is the right
shape when the data branches and the depth is logarithmic or bounded by the problem; it is a
liability when the data is linear and long.

**What is the difference between the space a recursion uses and the space its results use?**
The recursion stack is Θ(depth) and exists only while calls are outstanding; the results are
whatever the algorithm accumulates and can be far larger. Backtracking is the clearest case: the
stack is Θ(n) for a depth-n decision sequence, and the collected output — every subset, every
permutation — is exponential, so the honest bound is "Θ(n) auxiliary beyond the output, and the
output is 2ⁿ items of length up to n." Separating the two is how you avoid quoting an exponential
space bound for a recursion that holds n frames, and how you avoid quoting Θ(n) for a function
that is about to materialise every permutation.

{/* FOOTER */}
