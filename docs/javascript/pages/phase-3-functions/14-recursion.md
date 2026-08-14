---
title: "14 · Recursion"
sidebar_label: "14 · Recursion"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`RangeError: Maximum call stack size exceeded`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion), [Functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions), [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone), [`queueMicrotask()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/queueMicrotask); tail-call status from the TC39 [proposal-ptc-syntax](https://github.com/tc39/proposal-ptc-syntax) discussion and V8's published position. Documentation-validated; **the stack-depth measurements are linked, not repeated** — see [Phase 0 · 03 · Execution contexts and the call stack](../phase-0-how-javascript-runs/03-call-stack.md).

**Recursion is a function calling itself on a smaller version of the same problem.** The
mechanism is not the hard part — the call stack already does the work
([Phase 0 · 03](../phase-0-how-javascript-runs/03-call-stack.md)).
What is worth learning is **where it is the right shape, where JavaScript's stack makes it the
wrong one, and what to do when the data is deeper than the stack**.

## The base case is a design decision, not a formality

Every recursive function is two questions: *when do I stop*, and *how does each call get closer
to stopping*. Get the first wrong and you get a `RangeError`; get the second wrong and you also
get a `RangeError`, from a different bug.

```js
function depth(node) {
  if (node == null) return 0;                                    // 🔴 base case
  return 1 + Math.max(...node.children.map(depth));              // 🔴 strictly smaller
}
```

🔴 **The base case must cover every way the input can bottom out**, not just the one you had in
mind. For a tree that is `null`, a leaf with `children: []`, and — if the data comes from
anywhere you do not control — a node that is missing `children` entirely. `Math.max()` of an
empty spread is `-Infinity`, so a leaf here returns `-Infinity + 1`, not `1`. Base cases are
where recursive functions are actually wrong; the recursive step is usually fine.

**Write the base case first.** It is the only part you can test on its own, and doing it first
forces you to say what "smallest" means before you write the step that has to reach it.

⚠️ **"Smaller" has to be guaranteed, not likely.** `f(n - 1)` on a negative `n` recurses forever
past a `n === 0` check; `f(Math.floor(n / 2))` on `n === 1` gives `0` and terminates, on `n === 0`
gives `0` and does not. A cyclic graph traversed as if it were a tree revisits nodes forever —
the fix there is not a better base case but a `visited` set, which is what turns tree recursion
into graph traversal.

## The stack is the real constraint

A `RangeError: Maximum call stack size exceeded` means the engine ran out of stack, and MDN is
explicit that this is what "too much recursion" reports. Two things about it surprise people:

🔴 **The limit is bytes, not calls.** Each frame holds that call's arguments, locals and
bookkeeping, so a function with six parameters and an array local exhausts the stack in far
fewer calls than a function with none. **There is no "about 10,000 calls" budget** — it is a
property of the frame, the engine and what else is on the stack, and it varies between runs. The
measured spread is on
[Phase 0 · 03](../phase-0-how-javascript-runs/03-call-stack.md), which
owns that output.

🔴 **`await` does not consume the stack.** An `async` function suspends and returns to the event
loop, so its continuation is not a stack frame — asynchronous recursion goes far deeper than
synchronous recursion for the same shape. Same page, same run.

**What this means in practice:** recursion depth proportional to your *data* is a production bug
waiting for a big input. A linked list of 50,000 nodes, a deeply nested JSON document, a
directory tree from a user's disk — all of these will overflow. Recursion depth proportional to
the *logarithm* of the data (binary search, balanced-tree descent, divide and conquer) is
completely safe: 2⁵⁰ elements is 50 frames.

## There is no tail-call optimisation in practice

**Proper tail calls are in the ES2015 specification.** A call in tail position — where the
result of the call is immediately returned and nothing remains to be done — is specified to
reuse the current frame rather than push a new one, making tail recursion run in constant stack
space.

⚠️ **Almost no engine implements it.** JavaScriptCore (Safari) does; **V8 and SpiderMonkey do
not**, and V8's position has been that it stayed unimplemented over debugging and
implementation concerns while TC39 discussed a syntactic opt-in
(`proposal-ptc-syntax`) that has not shipped. So in Node and in Chrome — where essentially all of
this code runs — rewriting a function to be tail-recursive **buys nothing**:

```js
const sum = (arr, i = 0, acc = 0) =>
  i === arr.length ? acc : sum(arr, i + 1, acc + arr[i]);   // ⚠️ still overflows in V8
```

🔴 **This is the single most useful fact in the topic**, because the folk advice ("make it tail
recursive and it's fine") is wrong on the platform you are targeting. If you need constant stack
space, you convert to iteration or a trampoline — the language will not do it for you.

## Converting recursion you cannot afford

**Iteration with an explicit stack** is the general answer, and it is mechanical: the array *is*
the call stack, and you control its size.

```js
function walk(root, visit) {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    visit(node);
    for (const child of node.children) stack.push(child);   // 🔴 heap, not stack
  }
}
```

The array lives on the heap, which is orders of magnitude larger than the stack, so depth stops
being the constraint. ⚠️ **Note the traversal order changed**: `pop` gives depth-first with
children visited in reverse. Push them reversed, or use `shift` for breadth-first — and know
that `shift` is O(n) on a large array, which is why a real BFS uses an index pointer or a deque.

**A trampoline** keeps the recursive *shape* when the algorithm is genuinely easier to read that
way. The function returns a thunk instead of calling itself, and a loop keeps invoking thunks:

```js
const trampoline = (fn) => (...args) => {
  let result = fn(...args);
  while (typeof result === "function") result = result();
  return result;
};

const sumT = trampoline(function rec(arr, i = 0, acc = 0) {
  return i === arr.length ? acc : () => rec(arr, i + 1, acc + arr[i]);
});
```

The stack never grows because `rec` **returns** rather than calls. It is what tail-call
optimisation would have done, written by hand. ⚠️ It only works for tail positions, it allocates
a closure per step, and it obscures stack traces — reach for it when the recursive formulation is
genuinely clearer, not by default.

**For asynchronous work, `await` in a loop already solves it** — since awaiting does not consume
the stack, an async recursive walk over a deep structure will not overflow the way its
synchronous twin does.

## Mutual recursion

Two or more functions that call each other — the classic being a parser where `parseExpression`
calls `parseTerm` calls `parseFactor` calls `parseExpression` for a parenthesised group.

```js
const isEven = (n) => n === 0 ? true  : isOdd(n - 1);
const isOdd  = (n) => n === 0 ? false : isEven(n - 1);
```

Two practical notes. **Hoisting makes it work**: `isEven` references `isOdd` before it is
defined, which is fine because the reference is resolved when the function *runs*, not when it is
defined — but only if both are initialised before the first call. With `const` arrow functions,
calling `isEven` at module top level before `isOdd`'s line has evaluated is a `ReferenceError`
from the temporal dead zone ([08 · Hoisting and the TDZ](./08-hoisting-and-tdz/README.md)).
Function *declarations* are hoisted whole and have no such window.

**And the depth is the sum, not each function's own.** Mutual recursion overflows exactly as fast
as direct recursion; it just makes the stack trace alternate, which is a useful signature when
reading one.

## Where recursion is the right answer

**Recursive data.** Trees, nested JSON, the DOM, an abstract syntax tree, a file system. When the
data structure is defined in terms of itself, the code that walks it is clearest defined the same
way — and the depth of real trees is usually small.

**Divide and conquer.** Merge sort, quicksort, binary search, balanced-tree operations. Depth is
logarithmic, so the stack is a non-issue and the recursive formulation is much easier to prove
correct.

**Backtracking.** Permutations, N-queens, sudoku — the call stack *is* the undo mechanism, and
writing it iteratively means rebuilding that by hand.

**Where it is not:** anything with depth proportional to input size — a list walk, a counter, a
string scan. Those are loops. And **overlapping subproblems** — naive `fib` recomputes the same
values exponentially often, which is memoization's job ([13 · Memoization](./13-memoization.md))
and the whole subject of **Phase 16 · Dynamic programming**.

**The deep-clone case is worth naming**: hand-written recursive clones are a classic interview
answer, but for structured data the platform already has one. MDN documents `structuredClone()`
as handling cycles and many built-in types — and note it throws on functions, DOM nodes and
property descriptors, so it is not a universal answer either.

## Gotchas

**Symptom:** `RangeError: Maximum call stack size exceeded`
**Cause:** Recursion depth proportional to input size, or a base case never reached.
**Fix:** An explicit stack on the heap, or a trampoline; check that each call is strictly smaller.

**Symptom:** A leaf node returns `-Infinity` or `NaN`
**Cause:** The base case missed a way the input bottoms out — `Math.max()` of an empty spread is `-Infinity`.
**Fix:** Write the base case first and cover `null`, empty, and missing fields.

**Symptom:** A "tail recursive" rewrite still overflows
**Cause:** Proper tail calls are specified but unimplemented in V8 and SpiderMonkey.
**Fix:** Convert to a loop or a trampoline; do not rely on the optimisation.

**Symptom:** A graph traversal never terminates
**Cause:** Tree recursion applied to data with cycles.
**Fix:** A `visited` set — the base case cannot fix this.

**Symptom:** Traversal order changed after converting to an explicit stack
**Cause:** `pop` visits children in reverse; `shift` is breadth-first and O(n).
**Fix:** Push children reversed, or use an index pointer for a queue.

**Symptom:** `ReferenceError` in mutually recursive arrow functions
**Cause:** The temporal dead zone — one `const` had not been evaluated when the other ran.
**Fix:** Function declarations, or ensure both are defined before the first call.

**Symptom:** A recursive function is correct but exponentially slow
**Cause:** Overlapping subproblems recomputed on every branch.
**Fix:** Memoize the recursive binding, or go bottom-up.

**Symptom:** A hand-written deep clone loops forever or drops data
**Cause:** Cycles, or types the clone does not handle.
**Fix:** `structuredClone()` for structured data — noting it throws on functions and DOM nodes.

## Interview questions

**★ What are the two parts of a recursive function?**
A base case that covers every way the input bottoms out, and a recursive step that is
*guaranteed* strictly smaller. Write the base case first — it is the part you can test alone, and
it is where recursive functions are usually wrong.

**★ What causes `RangeError: Maximum call stack size exceeded`?**
The engine ran out of stack. The limit is **bytes, not calls** — each frame holds that call's
arguments and locals, so a heavier function overflows in far fewer calls. There is no fixed
call budget to code against.

**★ Does JavaScript optimise tail calls?**
Proper tail calls are in the ES2015 spec, but **V8 and SpiderMonkey do not implement them**
(JavaScriptCore does). So on Node and Chrome, a tail-recursive rewrite still overflows. Use an
explicit stack or a trampoline.

**★ What is a trampoline?**
Return a thunk instead of recursing; a loop keeps invoking thunks until the result is not a
function. The stack never grows because the function returns rather than calls. It is manual
tail-call optimisation — worth it only when the recursive shape is genuinely clearer.

**★ How do you convert recursion to iteration?**
Make the call stack explicit: push work onto an array and loop while it is non-empty. The array
lives on the heap, so depth stops being the constraint. Watch the traversal order — `pop` is
depth-first with children reversed.

**★ When would you choose recursion in production JavaScript?**
Recursive data (trees, nested JSON, the DOM), divide and conquer where depth is logarithmic, and
backtracking where the stack is the undo mechanism. Not for anything whose depth scales with
input size.

**★ Why is recursion cheaper when the function is `async`?**
Because `await` suspends the function and returns to the event loop rather than holding a frame,
so the continuation is not on the stack. Asynchronous recursion goes far deeper than synchronous
recursion of the same shape.

**What does mutual recursion cost?**
Nothing extra — the depth is the total number of calls, so it overflows exactly as fast as direct
recursion. The one real trap is the temporal dead zone with `const` arrow functions.

---

← [13 · Memoization](./13-memoization.md) · [Phase index](./README.md) · **15 · Pure functions and side effects** *(not written yet)* →
