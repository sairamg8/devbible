---
title: "06.1 · What is captured"
sidebar_label: "01 · What is captured"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6) — **sandbox-proven**. Script: `sandbox/js-p3/ex6-closures.mjs`.

**A closure captures the variable, not the value.** Not a snapshot, not a copy —
a live reference to the binding. Everything surprising about closures follows
from that one sentence.

## The variable, not the value

```
--- a closure captures the VARIABLE, not the value at creation time ---
  read() after x was reassigned                    changed after the closure was created
  read() after set()                               set from outside
```

```js
function makeReader() {
  let x = 'first';
  const read = () => x;
  x = 'changed after the closure was created';
  return {read, set: (v) => { x = v; }};
}
```

`read` was created while `x` was `'first'`, yet it returns the current value —
both after the reassignment inside the factory and after a `set()` from outside.
The closure holds the *binding* `x`, and reads it at call time.

This cuts both ways, and which way it cuts is the whole topic:

- **Useful:** two functions closing over the same variable stay in sync, which is
  how a counter factory works.
- **Surprising:** a function that captured a loop variable sees its *final*
  value, not the one from its iteration.

## The classic `var`-in-a-loop bug

```
--- the classic var-in-a-loop bug ---
  var loop: [f(), f(), f()]                        [3,3,3]
    and i after the loop                           3
  let loop: [f(), f(), f()]                        [0,1,2]
  var + IIFE (the pre-ES6 fix)                     [0,1,2]
```

```js
const varFns = [];
for (var i = 0; i < 3; i++) varFns.push(() => i);
varFns.map((f) => f());        // [3, 3, 3]
```

**`var` is function-scoped, so there is exactly one `i`** for the whole loop. All
three closures capture that same binding, and by the time they run the loop has
finished and `i` is `3`.

Nothing is wrong with the closures — they are faithfully reporting the one
variable that exists. The bug is that you wanted three variables and `var` gave
you one.

### Three fixes, in historical order

```js
// 1. let — a new binding per iteration (ES6+, the answer)
for (let j = 0; j < 3; j++) letFns.push(() => j);          // [0, 1, 2]

// 2. IIFE — capture by parameter (the pre-ES6 idiom)
for (var k = 0; k < 3; k++) iifeFns.push(((captured) => () => captured)(k));   // [0, 1, 2]

// 3. forEach — the index is a parameter, so it is per-call
[0, 1, 2].forEach((idx) => fns.push(() => idx));           // [0, 1, 2]
```

The IIFE version works because **a function parameter is a fresh binding per
call**. Passing `k` in copies its current value into a new variable that only
that iteration's closure can see. It is worth understanding even though you will
never write it — it is what `let` automates, and it still appears in older code.

## `let` really does create a new binding per iteration

This is the part people take on faith. It is directly observable:

```
--- let in a for-loop: a NEW binding per iteration, not one shared ---
  each closure mutates its OWN n                   [10,11,12]
  calling them again                               [20,21,22]
```

```js
const bindings = [];
for (let n = 0; n < 3; n++) { bindings.push(() => { n += 10; return n; }); }
bindings.map((f) => f());     // [10, 11, 12]
bindings.map((f) => f());     // [20, 21, 22]
```

Each closure **mutates its own `n`** and the three do not interfere. If they
shared one binding the first call would give `[10, 20, 30]`. Calling them a
second time continues from each one's own state.

So `for (let …)` is not "the same variable, scoped to the block" — the
specification copies the loop variable into a fresh binding for each iteration,
which is exactly what the IIFE did by hand.

Two loop forms never had the problem at all:

```
--- for-of and forEach never had the bug ---
  for-of                                           ["a","b","c"]
  forEach (v is a parameter, so per-call)          ["a","b","c"]
```

`for…of` declares its binding per iteration by design, and `forEach`'s value is
a **parameter**, which is per-call. Neither can exhibit the `var` bug, which is
one more reason to prefer them.

## `setTimeout` — the interview favourite

```
--- setTimeout with var — the interview favourite ---
  after the timers fired                           ["var:3","var:3","var:3","let:0","let:1","let:2"]
```

```js
for (var t = 0; t < 3; t++) setTimeout(() => order.push(`var:${t}`), 0);
for (let u = 0; u < 3; u++) setTimeout(() => order.push(`let:${u}`), 0);
```

The timing makes it vivid rather than changing the rule. Every callback runs
*after* the synchronous loop has finished, so by then `var t` is `3` — three
times over. The `let` version prints `0,1,2` because each callback closed over a
different binding.

**`setTimeout` is not the cause.** The `var` loop gives `[3,3,3]` synchronously
too, as measured above. All the timer does is guarantee the callbacks run late,
which removes any doubt about ordering.

## Gotchas

**Symptom:** A loop that registers callbacks has them all report the last index
**Cause:** `var` is function-scoped — one binding shared by every closure.
Measured `[3,3,3]`, with `i === 3` after the loop.
**Fix:** `let`, or `forEach`, or an IIFE that takes the value as a parameter.

**Symptom:** Event handlers attached in a loop all act on the last element
**Cause:** Same bug wearing different clothes — the handler closed over the
shared loop variable.
**Fix:** `let`, or `for…of` over the elements rather than indices.

**Symptom:** A value captured "at the time" turns out to have changed
**Cause:** Closures capture the variable, not the value. Measured: a closure
created when `x` was `'first'` returned the reassigned value.
**Fix:** Copy into a new binding at capture time — a `const` inside the loop
body, or a parameter.

**Symptom:** Switching `var` to `let` changes behaviour in a loop
**Cause:** It should — `let` creates a fresh binding per iteration. Measured:
closures each mutate their own copy, `[10,11,12]` then `[20,21,22]`.
**Fix:** None; this is the fix. Just do not assume the two keywords differ only
in scope shape.

## Interview questions

**★ What does `for (var i = 0; i < 3; i++) setTimeout(() => console.log(i))`
print, and why?**
`3, 3, 3`. `var` is function-scoped, so all three callbacks close over the same
binding, and they run after the loop has finished. Measured. With `let` it is
`0, 1, 2`, because each iteration gets its own binding.

**★ Does a closure capture the value or the variable?**
The variable. Measured: a closure created while `x` was `'first'` returned the
later value after `x` was reassigned, and again after an external setter changed
it. This is why the loop bug exists and why counter factories work.

**★ How did people fix the loop bug before `let`?**
An IIFE taking the loop variable as a parameter — `((captured) => () =>
captured)(k)` — measured `[0,1,2]`. A parameter is a fresh binding per call, so
each iteration got its own copy. `let` automates exactly this.

**★ Does `let` in a `for` loop create one binding or one per iteration?**
One per iteration, and it is observable: three closures that each do `n += 10`
returned `[10,11,12]` and then `[20,21,22]`. A single shared binding would have
given `[10,20,30]`.

**Why do `for…of` and `forEach` not have this problem?**
`for…of` declares its binding per iteration by design; `forEach`'s value is a
callback parameter, which is per-call. Both measured as `["a","b","c"]`.

**Is `setTimeout` responsible for the `3,3,3` result?**
No. The synchronous version measures `[3,3,3]` as well. The timer only
guarantees the callbacks run after the loop, making the shared binding
unmistakable.

---

← [Topic index](./README.md) · Next → [Private state and memory](./02-state-and-memory.md)
