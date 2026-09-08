---
title: "Two variations that change what a recursion costs without changing what it computes — tail position, which buys nothing in these two runtimes but tells you a plain loop is available, and mutual recursion, where the base case and the decreasing measure have to hold around a cycle of functions rather than inside one"
sidebar_label: "01d · Tail position and mutual recursion"
sidebar_position: 1.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. That V8 does not implement ES2015's proper tail calls and that the JVM has
> never had tail-call elimination is widely reported engine behaviour, stated as such and **not**
> quoted from a specification;
> [phase 1 · 04b](../phase-1-complexity/04b-tail-calls-and-the-explicit-stack.md) owns that argument
> and this page states it once. 🔴 **No stack-depth number for any engine** — MDN documents none.
> The mutual-recursion patterns are common practice, written out rather than cited. Fourth file of
> topic 01. **No sandbox run.**

**Two of the things an interviewer reaches for once the obvious recursion is on the board — "can
you make it tail-recursive?" and "what if the two functions call each other?" — and the first has a
counter-intuitive answer that candidates who have read about tail calls get wrong.** Tail position
does not save the stack in Node or on the JVM; what it does is guarantee that a plain loop with no
auxiliary structure is available, which is a better outcome than the explicit stack of
[01f](01f-converting-recursion-to-an-explicit-stack.md). Mutual recursion changes nothing about the
contract of [01](01-recursion-and-the-call-stack.md) except *where* you check it: around the cycle,
not inside one function, which is why a recursive-descent parser can be non-terminating with every
individual function looking correct. The third variation, memoisation, is
[01e](01e-memoising-a-recursive-function.md).

## Head recursion, tail recursion, and what actually changes

**Head recursion** does its work on the way *down* — before the recursive call. **Tail recursion**
does all its work before a call that is the last thing the function does, so the return value of
the recursive call is returned unchanged. Most real recursions are neither: they do work *after*
the calls return, which is the "combine" step and is the reason the frame has to stay live.

```ts
// tail: the recursive call IS the return expression; nothing happens after it
function sumTail(n: number, acc = 0): number {
  return n === 0 ? acc : sumTail(n - 1, acc + n);
}

// head/body: work happens after the call returns, so the frame must survive the call
function sumBody(n: number): number {
  return n === 0 ? 0 : n + sumBody(n - 1);   //   the "+ n" is why this frame cannot be discarded
}
```

The distinction matters in a language that eliminates tail calls: the frame of a tail call is dead
at the moment of the call, so a compiler may reuse it and the depth stays constant. **Neither of
this track's runtimes does that.** V8 does not implement ES2015's proper tail calls, and the JVM has
never eliminated tail calls in bytecode or JIT, so `sumTail` and `sumBody` produce one frame per
call alike and overflow at the same depth. "I'll make it tail-recursive" is therefore a wrong answer
to "it overflows", and hearing it is a scored negative.
[Phase 1 · 04b](../phase-1-complexity/04b-tail-calls-and-the-explicit-stack.md) owns that argument
in full — this paragraph is the whole of it that belongs here.

What tail position *is* still good for, in these runtimes: a tail-recursive function is the one that
converts to a `while` loop with no stack at all, by mechanical substitution — parameters become
mutable locals, the recursive call becomes an assignment plus `continue`. That is a strictly better
conversion than an explicit stack when it applies, and it applies exactly when the function is
tail-recursive.

```ts
// the same function as a loop — Θ(1) space, and the conversion is purely mechanical
function sumLoop(n: number): number {
  let acc = 0;
  while (n !== 0) { acc = acc + n; n = n - 1; }   // parameters became locals; the call became an assignment
  return acc;
}
```



## Mutual recursion

Two or more functions that call each other. The contract does not change, but it now has to hold
across the *cycle* rather than within one function: there must be a base case somewhere in the
cycle, and the measure must strictly decrease around one full trip, not necessarily at each
individual call.

```ts
// the toy version, and the one that makes the point: the base case is in one function, not both
export function isEven(n: number): boolean {
  if (n === 0) return true;
  return isOdd(n - 1);
}
export function isOdd(n: number): boolean {
  if (n === 0) return false;
  return isEven(n - 1);
}
```

`isEven` has no base case that fires for odd n and `isOdd` has none that fires for even n; the
*pair* has one, and the measure `n` drops by one per call. The depth is n, so the toy is a toy —
but the shape is not. Three places it is the right structure:

**A recursive-descent parser.** `parseExpression` calls `parseTerm` calls `parseFactor` calls
`parseExpression` for a parenthesised group. The measure is the number of unconsumed input tokens,
and it strictly decreases because a parenthesised group consumes at least the `(`. This is the
mutual recursion most backend engineers actually write — a filter-expression parser for an admin
search box, a rules DSL, a query string grammar.

```ts
// storefront: parsing an admin product filter — price>100 AND (tag=sale OR tag=clearance)
type Tok = { kind: "ident" | "op" | "lparen" | "rparen" | "and" | "or"; text: string };

function parseOr(toks: Tok[], i: number): [node: unknown, next: number] {
  let [left, j] = parseAnd(toks, i);
  while (toks[j]?.kind === "or") {
    const [right, k] = parseAnd(toks, j + 1);       // j + 1 consumes the OR: the measure drops
    left = { or: [left, right] }; j = k;
  }
  return [left, j];
}
function parseAnd(toks: Tok[], i: number): [node: unknown, next: number] {
  let [left, j] = parseAtom(toks, i);
  while (toks[j]?.kind === "and") {
    const [right, k] = parseAtom(toks, j + 1);
    left = { and: [left, right] }; j = k;
  }
  return [left, j];
}
function parseAtom(toks: Tok[], i: number): [node: unknown, next: number] {
  if (toks[i]?.kind === "lparen") {
    const [inner, j] = parseOr(toks, i + 1);        // back to the top of the cycle, one token in
    if (toks[j]?.kind !== "rparen") throw new Error("expected )");
    return [inner, j + 1];
  }
  return [{ leaf: toks[i].text }, i + 1];           // base case of the cycle: consumes one token
}
```

The thing to notice, and to say if asked: `parseAtom` is the only function in the cycle that
terminates without calling another, and every path back to `parseOr` goes through the `i + 1` that
consumes the `(`. Drop that `+ 1` and the parser loops forever on the first parenthesis — a clause-2
failure spread across three functions, which is exactly why mutual recursion is harder to debug
than the single-function kind.

**Grammar-shaped tree walks.** An interpreter's `evalStatement` / `evalExpression`, a JSON
serialiser's `writeValue` / `writeObject` / `writeArray`. The measure is the remaining depth of the
document — which is why a serialiser over untrusted JSON is a stack-overflow surface, and why
depth limits exist in real parsers.

**Game and DP formulations.** `canWin(state)` calls `canLose(next)` and back; the measure is the
number of moves remaining. These convert to a single function with a parity parameter, and doing so
is often the cleaner answer — mutual recursion between two functions with the same signature is
usually one function with an extra argument.

```java
// Java: mutual recursion collapses to one function plus a parameter, which is easier to memoise
static boolean canWin(int[] state, boolean maximising, Map<String, Boolean> memo) {
    String key = Arrays.toString(state) + maximising;   // key must capture BOTH arguments
    Boolean hit = memo.get(key);
    if (hit != null) return hit;
    // ... enumerate moves, recurse with !maximising ...
    boolean answer = false;
    memo.put(key, answer);
    return answer;
}
```

## Gotchas

**★ Symptom: "I'll make it tail-recursive" offered as the fix for a stack overflow, and it still
overflows.** Cause: tail-call elimination assumed. Fix: V8 does not implement ES2015's proper tail
calls and the JVM never had them, so the frame count is unchanged and the failure is at the same
depth. What tail position does tell you is that a `while` loop with no auxiliary structure is
available, which is strictly better than an explicit stack.

**★ Symptom: mutual recursion that never terminates on one specific input shape, and each function
looks correct in isolation.** Cause: the measure must decrease around one full trip through the
cycle, and one edge of the cycle consumes nothing — a parser that recurses on the same index after
seeing `(`. Fix: check the cycle, not the functions: identify the one function that can return
without calling into the cycle, and verify every path back to it consumes at least one unit of the
measure.

**★ Symptom: a function that looks tail-recursive and behaves like a head recursion.** Cause: the
recursive call is an operand rather than the whole returned expression — `return 1 + f(n - 1)`,
`return f(a) || g(b)`, `return Math.max(f(l), f(r))`, or a call inside a `try` block, whose frame
must survive for the handler. Fix: the test is whether the returned value passes through
*unchanged*. If it does not, the loop conversion needs an accumulator parameter first, which is
what turns `n + sumBody(n - 1)` into `sumTail(n - 1, acc + n)`.

**★ Symptom: a recursive-descent parser that consumes no input on one production and spins on the
first occurrence of that token.** Cause: a cycle edge that does not decrease the measure — the
classic case is left recursion, `expr → expr '+' term`, transcribed literally, where `parseExpr`
calls `parseExpr` at the same index. Fix: left recursion must be rewritten as iteration in the
loop — parse one term, then `while` over the trailing operators — which is exactly why the parser
above uses a `while` inside `parseOr` rather than recursing on the left.

**Symptom: two mutually recursive functions, one memoised and one not, returning stale answers.**
Cause: half the cycle caches and half does not, so the cached half serves values computed under a
different state of the uncached half. Fix: memoise the cycle as a unit — usually by collapsing it
into one function with a discriminating parameter, so the key covers the whole cycle. See
[01e](01e-memoising-a-recursive-function.md).

**Symptom: mutual recursion across module boundaries where one function is `undefined` at call
time.** Cause: in JavaScript, `const`/`let` function expressions are not hoisted, so
`const isEven = (n) => isOdd(n - 1)` defined before `isOdd` throws a `ReferenceError` only when the
call actually happens — which may be the first request in production rather than at load. Fix:
function declarations (hoisted) or make the ordering explicit; in Java the problem does not exist,
since methods are resolved by the compiler regardless of declaration order.

**Symptom: a JSON serialiser or config walker that overflows on deeply nested user input.** Cause:
mutual recursion over a document whose depth is attacker-controlled. Fix: an explicit depth budget
threaded through the cycle and checked as an extra base case; this is a real availability control,
not a stylistic one.

## Interview questions

**★ What is the difference between head and tail recursion, and does it matter in Node or Java?**
Head recursion does its work before the recursive call; a tail call is one in return position, so
nothing at all happens to the value it returns. In a runtime with tail-call elimination the
difference is enormous — the frame is dead at the moment of the call and can be reused, so the
depth stays constant. In these two runtimes it buys nothing: V8 does not implement ES2015's proper
tail calls and the JVM has never eliminated them in bytecode or the JIT, so a tail-recursive
function produces one frame per call and overflows at the same depth as any other. What tail
position still tells you is that the function converts to a `while` loop with no auxiliary stack at
all — parameters become mutable locals, the recursive call becomes an assignment — which is a
better outcome than an explicit stack.

**★ When is mutual recursion the right structure, and how do you verify it terminates?**
It is right when the grammar or the state machine is genuinely mutual — a recursive-descent parser
where an expression can contain a parenthesised expression, an interpreter's statement and
expression evaluators, a serialiser's value/object/array trio. Termination is verified around the
cycle rather than per function: identify the function that can return without calling back into the
cycle — the atom, the literal, the scalar — and check that every path from it back to the top
consumes at least one unit of the measure, which for a parser is one input token. A cycle edge that
consumes nothing is a non-terminating parser that looks correct function by function, and it is
much harder to spot than the single-function version of the same bug.

**★ How do you convert a non-tail recursion into a tail-recursive one, and is it worth doing?**
By introducing an accumulator: the work that was happening *after* the call moves into a parameter
that is passed *into* the call, so nothing remains to be done when it returns. `n + sumBody(n - 1)`
becomes `sumTail(n - 1, acc + n)`. Whether it is worth it depends entirely on the runtime. In a
language that eliminates tail calls it converts Θ(n) stack into Θ(1). In Node and on the JVM it
converts nothing — the frame count is identical — but it is still a useful intermediate step,
because a tail-recursive function converts to a `while` loop by pure substitution, with the
parameters becoming mutable locals and no auxiliary stack at all. So: not as a fix in itself, and
yes as the first half of the fix.

**Can mutual recursion always be rewritten as a single function?**
Usually, and often it should be. Two functions with the same signature that differ by a flag —
`canWin` / `canLose`, `isEven` / `isOdd` — are one function with an extra boolean parameter, and
the single-function form is easier to memoise because the flag becomes part of the key naturally.
Where the collapse is not worth it is a parser, because the separate functions *are* the grammar's
precedence levels and merging them into one function with a "level" parameter throws away the
readability that made recursive descent worth choosing. So: collapse when the functions differ only
by state, keep them apart when they differ by meaning.

---

← Prev: [01c · Recursion as the shape of the data](01c-recursion-as-the-shape-of-the-data.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [01e · Memoising a recursive function](01e-memoising-a-recursive-function.md)
