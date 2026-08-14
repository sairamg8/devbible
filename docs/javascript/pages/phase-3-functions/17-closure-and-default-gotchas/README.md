---
title: "17 · Closure and default-parameter gotchas"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [Default parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Default_parameters), [Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures), [`let`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let) — and react.dev for the framework-scale case. Documentation-validated; **no timings**.

**Two mechanisms, one failure mode.** A default parameter and a closure are both *deferred
expressions* — code written in one place and evaluated somewhere else, later, against whatever
the variables hold at that moment. Almost every bug filed against either of them is the gap
between **when you wrote it** and **when it ran**.

The mechanisms themselves are Master-tier material and already written:

- [02 · Parameters](../02-parameters/README.md) — how a default is evaluated, the parameter
  scope, the TDZ, and `fn.length`
- [06 · Closures](../06-closures/README.md) — the variable-not-value rule, the `var`-in-a-loop
  bug, and what a closure keeps alive

**This topic does not repeat them.** It is the field guide: the shapes these two facts take at an
API boundary, in an options merge, in a loop, and in a framework that rebuilds your functions on
every render — plus which fix belongs to which symptom.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[`null`, `undefined` and the API boundary](./01-null-undefined-and-the-api-boundary.md)** | Why JSON defeats every default, `??` vs `||`, the "absent versus cleared" decision a PATCH forces, and nested destructuring defaults |
| 2 | **[Merging, forwarding and identity](./02-merging-forwarding-and-identity.md)** | Spread vs `Object.assign` vs destructuring on an explicit `undefined`, pass-through parameters, a fresh object every call, and defaults that run code |
| 3 | **[Which binding did you get?](./03-which-binding-did-you-get.md)** | Too few bindings versus too many, which loop constructs give a fresh one, and why `await` in a loop half-breaks it |
| 4 | **[Snapshots and the four fixes](./04-snapshots-and-the-four-fixes.md)** | Registration-time copies, the counter that works, the four fixes and how to choose, and diagnosing one in ten seconds |
| 5 | **The stale closure, framework-scale** *(not written yet)* | Why every render makes new closures, the interval that logs `0` forever, and choosing between an updater, a ref and a dependency list |

## Phase gate

You are done with this topic when, shown a callback holding the wrong value, you can say in one
sentence **whether it is holding too few bindings or an old one** — and name the fix that follows
from the answer.

## Where this connects

- [02 · Parameters](../02-parameters/README.md) — the measured mechanism behind every default trap here
- [06 · Closures](../06-closures/README.md) — variable-not-value, and what a closure retains
- [07 · Lexical scope and the scope chain](../07-lexical-scope/README.md) — why `var` and `let` differ in a loop
- [13 · Memoization](../13-memoization.md) — cache keys, which the identity-per-call problem breaks
- [16 · There is no function overloading](../16-no-function-overloading.md) — why a default beats an arity check

---

Start → [`null`, `undefined` and the API boundary](./01-null-undefined-and-the-api-boundary.md)
