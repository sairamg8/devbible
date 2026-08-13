---
title: "03 · Execution contexts and the call stack"
sidebar_label: "03 · The call stack"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6.233.17). Scripts:
> `sandbox/js-p0/ex1-stack.mjs`, `ex7-stack-extras.mjs`.

**One thread, one stack.** Every function call pushes a frame; every return pops
it. When the stack cannot hold another frame you get `RangeError: Maximum call
stack size exceeded` — and the number of frames you get is **not a fixed count**,
which is the part almost everyone has wrong.

## What a frame holds

Calling a function creates an **execution context** and pushes it. It holds:

- the **arguments** and local variables
- a reference to the **scope** the function was defined in (this is what makes
  closures work — see Phase 3)
- the value of **`this`**
- the **return address** — where to continue when this call finishes

The stack is what a stack trace prints. Reading one is a daily skill.

## Reading a stack trace

```js
// sandbox/js-p0/ex1-stack.mjs
function level3() { throw new Error('boom'); }
function level2() { level3(); }
function level1() { level2(); }
try { level1(); } catch (err) {
  console.log(err.stack.split('\n').slice(0, 5).join('\n'));
}
```

```
Error: boom
    at level3 (file:///…/sandbox/js-p0/ex1-stack.mjs:10:27)
    at level2 (file:///…/sandbox/js-p0/ex1-stack.mjs:11:21)
    at level1 (file:///…/sandbox/js-p0/ex1-stack.mjs:12:21)
    at file:///…/sandbox/js-p0/ex1-stack.mjs:13:7
```

**Top line is where it broke. Every line below is who called it.** The order is
the reverse of how you read the code, and the last line is the outermost call —
here, module top level, which has no function name.

The two habits worth building:

1. **Read top-down until you reach your own code.** A trace that starts with
   twelve frames of library internals is still telling you that *your* frame,
   the first one in your file, passed something wrong.
2. **The `:10:27` is line:column.** The column matters when several calls sit on
   one line — `a().b().c()` gives you the exact one.

### Only the first 10 frames are captured

```
default Error.stackTraceLimit: 10
```

V8 truncates at ten frames by default. In a deep call chain the frame you need
may already be gone. `Error.stackTraceLimit = 50` (or `Infinity`) captures more
— set it once at startup while debugging, and revert it, because capturing
stacks is not free.

## The limit is bytes, not calls

This is the measurement that corrects the common belief.

```js
// sandbox/js-p0/ex7-stack-extras.mjs
let dSmall = 0;
function s() { dSmall++; s(); }
try { s(); } catch {}

let dBig = 0;
function b(p1, p2, p3, p4, p5, p6) {
  const local = [p1, p2, p3, p4, p5, p6];
  dBig++;
  b(local[0], 1, 2, 3, 4, 5);
}
try { b(0, 1, 2, 3, 4, 5); } catch {}

console.log('frames, no locals:', dSmall, '| frames, 6 args + array local:', dBig);
```

```
frames, no locals: 12524 | frames, 6 args + array local: 5442
```

**12 524 frames versus 5 442 — the same stack, less than half the depth**, purely
because each frame is bigger. The stack is a fixed-size memory region; a
function with more arguments and more locals consumes more of it per call.

Two things follow:

- **Never treat "about 10 000 calls" as a budget you can rely on.** It varies
  with your function's shape, the engine, and the platform. Node's `--stack-size`
  can change it; browsers do not let you.
- **A recursion that works on your test data can overflow on real data.** If the
  depth scales with user input — a category tree, a comment thread, a JSON
  document — recursion is a liability.

## The fix is almost always iteration

```js
function sumRecursive(n) { return n === 0 ? 0 : n + sumRecursive(n - 1); }
function sumIterative(n) { let t = 0; for (let i = n; i > 0; i--) t += i; return t; }

try { console.log('recursive 100000:', sumRecursive(100000)); }
catch (e) { console.log('recursive 100000:', e.constructor.name + ':', e.message); }
console.log('iterative 100000:', sumIterative(100000));
```

```
recursive 100000: RangeError: Maximum call stack size exceeded
iterative 100000: 5000050000
```

Identical arithmetic. One completes, one cannot.

> **Tail-call optimisation would fix this, and V8 does not implement it.** It is
> in the ES2015 spec; only JavaScriptCore ships it. Writing a recursion in "tail
> position" buys you nothing in Chrome or Node. Do not rely on it.

For a genuinely recursive shape — walking a category tree — convert to an
explicit stack:

```js
function collectLeafCategories(root) {
  const out = [];
  const stack = [root];              // your own stack, on the heap
  while (stack.length > 0) {
    const node = stack.pop();
    if (node.children.length === 0) out.push(node);
    else stack.push(...node.children);
  }
  return out;
}
```

The heap is orders of magnitude larger than the stack, so depth stops being a
failure mode. This is exactly the technique Phase 15 formalises as iterative DFS.

## `await` does not consume stack

```js
async function tick(n) { if (n === 0) return 0; await null; return tick(n - 1); }
tick(200000).then(v => console.log('async recursion 200000 frames deep: ok, returned', v));
```

```
async recursion 200000 frames deep: ok, returned 0
```

**200 000 deep, no overflow** — sixteen times past the synchronous ceiling.
Every `await` returns control to the event loop and the frame is torn down; the
continuation is scheduled as a microtask and runs on a *fresh* stack. The
recursion is real, but it is not on the stack at the same time.

This is worth understanding rather than exploiting. It explains why async stack
traces are historically poor (the frames genuinely are gone), and it is the
first concrete hint of the model Phase 7 builds out.

## Gotchas

**Symptom:** `RangeError: Maximum call stack size exceeded` with no obvious
recursion.
**Cause:** usually accidental recursion — a getter that reads its own property,
`toString` that interpolates itself, an event handler that re-dispatches its own
event, or two modules calling each other.
**Fix:** set `Error.stackTraceLimit = 50` and look for the repeating pair of
frames in the trace. A cycle of two names repeating is the signature.

**Symptom:** recursion works in tests, overflows in production.
**Cause:** depth scales with real data, and the ceiling is bytes, not calls.
**Fix:** convert to iteration with an explicit stack. Do not "fix" it by making
the function smaller — that only moves the cliff.

**Symptom:** the stack trace is all framework internals and none of your code.
**Cause:** the ten-frame default truncated your frames away.
**Fix:** raise `Error.stackTraceLimit` while debugging. In Chrome DevTools,
enable "Show framework internals" off and async stack traces on.

**Symptom:** `catch` did not catch the error thrown inside a `setTimeout`
callback.
**Cause:** the callback runs later, on a **new stack**. The `try` block's frame
is long gone, so there is nothing to unwind into.
**Fix:** put the `try`/`catch` inside the callback, or use a promise chain with
`.catch`. Covered fully in Phase 7.

**Symptom:** rewrote a recursion into tail position and it still overflows.
**Cause:** V8 does not implement tail-call optimisation.
**Fix:** iterate. Tail position is not a strategy on V8.

## Interview questions

**★ What is the call stack, and what happens when it overflows?**
A LIFO structure of execution contexts. Each call pushes a frame holding
arguments, locals, `this` and the return address; returning pops it. When there
is no room for another frame the engine throws
`RangeError: Maximum call stack size exceeded`. It is a synchronous,
single-threaded structure — one stack per thread.

**★ How many calls deep can you go?**
There is no fixed answer, and that is the point. Measured on Node 24, a
zero-local function reached **12 524** frames while one with six arguments and an
array local reached **5 442** — same engine, same run. The limit is stack *bytes*,
not call count, so it varies with frame size, engine and platform.

**★ Why doesn't deep `async` recursion overflow?**
Each `await` suspends the function and returns to the event loop; the frame is
destroyed and the continuation is queued as a microtask, then runs on a fresh
stack. The calls are sequential in time but never simultaneously on the stack —
200 000 deep completes without error.

**★ How do you read a stack trace?**
Top line is the throw site; each line below is its caller, out to the entry
point. Read down until the first frame in your own code — that is usually where
the bad value came from, even when the throw happened inside a library. Note
V8 only captures ten frames by default.

**Does JavaScript optimise tail calls?**
The spec defines proper tail calls (ES2015), but V8 and SpiderMonkey never
shipped them; only JavaScriptCore did. On Node and Chrome, tail position gives
no benefit — convert to a loop with an explicit stack instead.

**When would you deliberately keep a recursion?**
When depth is bounded and small by construction and the recursive form is
markedly clearer — a fixed-depth config merge, a binary-search tree whose height
is logarithmic. If depth is a function of untrusted input, iterate.

---

← [02 · Parse, compile, execute](./02-parse-compile-execute.md) · [Phase index](./) · Next: [04 · Strict mode](./04-strict-mode.md) →
